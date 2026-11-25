/*
 * Visor de mapas a pantalla completa con Leaflet (CRS.Simple).
 *
 * El mapa ocupa toda la ventana. Encima, a la izquierda, un panel lateral (.viewer__panel) con
 * "← Mapas", el nombre del juego (si se pudo leer) y el nombre del mapa; con 2 o más mapas en el
 * juego, el nombre del mapa es un desplegable (selector) con los mapas del juego, en orden alfabético,
 * abierto por defecto (SPEC 12, enmienda). Es hermano
 * del escenario, no hijo del contenedor de Leaflet: superponerlo no redimensiona el mapa.
 * La pestaña .viewer__toggle lo pliega y despliega (empieza contraído y no se guarda; salvo al
 * cambiar de mapa con el selector, que lo deja expandido: SPEC 12, enmienda).
 * Contraído, el panel sale por la izquierda y queda inert; la pestaña, fuera de él, queda en el borde.
 *
 * La imagen ocupa los bounds [[0, 0], [height, width]]: 1 unidad = 1 px de la imagen a zoom 0.
 *   - Zoom mínimo: el de "mapa entero visible" − 2, 1/4 de ese tamaño (se recalcula al cambiar el tamaño de la ventana).
 *   - Vista inicial: "mapa entero visible", centrado.
 *   - Botones + / − y doble clic: paso de 1 nivel, con la animación de Leaflet.
 *   - Rueda y touchpad: zoom continuo propio (Waypoint.ui.wheelZoom), no el de Leaflet.
 *   - Zoom máximo: 2 (4× el tamaño real).
 *   - Límites de arrastre (maxBounds con viscosidad 1, recalculados tras cada zoom y al
 *     redimensionar): la imagen puede salir de la vista por cualquier borde, pero en cada eje
 *     quedan siempre al menos MIN_VISIBLE_PX de ella dentro, para no perderla de vista.
 *   - Pantalla completa (botón de view-controls): Fullscreen API sobre <html>; en ella solo se ve el
 *     mapa y los controles (.viewer--fullscreen oculta el panel y su pestaña).
 *   - Pines (SPEC 08): al crear el mapa, Waypoint.ui.pinLayer pinta los pines guardados. El botón
 *     "Añadir pin" abre Waypoint.ui.pinEditor (panel derecho y borrador; .viewer--adding-pin).
 *   - Filtro de pines (SPEC 09): "Pendientes" y "Encontrados", independientes; se guardan por mapa
 *     (mapService.setHideFound / setHidePending) y se aplican con pins.setHideFound / setHidePending.
 *     Desde SPEC 12 sus botones están en el panel de progreso, no en el panel lateral.
 *   - Textos (SPEC 10): Waypoint.ui.labelLayer pinta los textos guardados; los filtros de pines no
 *     les afectan. El botón "Añadir texto" abre Waypoint.ui.labelEditor (panel derecho y borrador;
 *     .viewer--adding-label). Solo un modo de añadir a la vez.
 *   - Progreso (SPEC 12): Waypoint.ui.progressHud, arriba a la derecha y hermano del escenario,
 *     con las cifras de pins.counts() que llegan por onCountsChange. La línea del juego es
 *     otherMaps + mapa: otherMaps = progressByGame − pins.counts(), leído una vez al cargar los pines.
 * Al salir se quitan el handler de rueda y el de fullscreenchange, se sale de pantalla completa,
 * se cancelan los paneles de pin y de texto si están abiertos, se destruyen las capas de pines y de textos
 * y el panel de progreso, se destruye el mapa Leaflet y se revocan los
 * object URLs de la imagen y de las miniaturas del selector.
 *
 * Nunca accede a IndexedDB: todo pasa por Waypoint.services.mapService y gameService.
 */
(function (Waypoint) {
  "use strict";

  var mapService = Waypoint.services.mapService;
  var markerService = Waypoint.services.markerService;
  var gameService = Waypoint.services.gameService;
  var notice = Waypoint.ui.notice;
  var router = Waypoint.core.router;
  var wheelZoom = Waypoint.ui.wheelZoom;
  var viewControls = Waypoint.ui.viewControls;
  var pinLayer = Waypoint.ui.pinLayer;
  var pinEditor = Waypoint.ui.pinEditor;
  var labelLayer = Waypoint.ui.labelLayer;
  var labelEditor = Waypoint.ui.labelEditor;
  var progressHud = Waypoint.ui.progressHud;
  var favicon = Waypoint.ui.favicon;

  var MAX_ZOOM = 2; // 2^2 = 4× el tamaño real
  var MIN_ZOOM_BELOW_FIT = 2; // zoom mínimo = fitZoom − 2 → 1/4 del tamaño de ajuste
  var MIN_VISIBLE_PX = 100; // px de imagen que siempre quedan dentro de la vista, por eje
  // getBoundsZoom limita su resultado al minZoom vigente; para medir el ajuste real
  // (negativo en imágenes más grandes que la ventana) se abre el límite antes de calcular.
  var UNBOUNDED_MIN_ZOOM = -20;
  var ACTUAL_SIZE_ZOOM = 0; // CRS.Simple con la imagen en [0,0]–[height,width]: zoom 0 = 1:1
  var ACTUAL_SIZE_EPSILON = 0.01; // tolerancia para dar por "tamaño real" un zoom casi 0
  var APP_TITLE = "Waypoint";

  // Cambiar de mapa con el selector remonta el visor; este id hace que el visor nuevo (y solo ese
  // mapa) empiece con el panel expandido, como estaba (SPEC 12, enmienda). Se consume al montar.
  var keepPanelOpenFor = null;

  // Leaflet no mira prefers-reduced-motion: las animaciones propias del visor lo consultan aquí.
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  }

  /**
   * Monta la vista en el contenedor y devuelve la función de desmontaje.
   * @param {HTMLElement} container
   * @param {{ id: string }} params
   * @returns {function}
   */
  function mount(container, params) {
    var alive = true;
    var leafletMap = null;
    var imageUrl = null;
    var detachWheel = null;
    var controls = null; // L.Control de vista (pantalla completa, ajustar, 1:1)
    var pins = null; // capa de pines guardados (pin-layer.js)
    var labels = null; // capa de textos guardados (label-layer.js)
    var hud = null; // panel de progreso (progress-hud.js), desde que hay capa de pines
    var progress = {
      map: { total: 0, found: 0 }, // de pins.counts()
      otherMaps: null, // { total, found } del resto de mapas del juego; null = no disponible
      loaded: false, // pins.load() terminado: los cambios siguientes son en vivo
    };

    // Cifras del panel: mapa y juego (otherMaps + mapa, o "—" si no se pudo leer el juego).
    function renderProgress(live) {
      if (!hud) {
        return;
      }
      hud.setMap(progress.map, { live: live === true });
      hud.setGame(
        progress.otherMaps
          ? {
              total: progress.otherMaps.total + progress.map.total,
              found: progress.otherMaps.found + progress.map.found,
            }
          : null
      );
    }

    // Una sola lectura del juego, tras cargar los pines; los cambios posteriores del mapa abierto se
    // suman sobre otherMaps. Si falla: "—" y error en consola, sin aviso.
    function loadGameProgress(gameId) {
      markerService
        .progressByGame(gameId)
        .then(function (game) {
          if (!alive || !pins) {
            return;
          }
          var loaded = pins.counts();
          progress.otherMaps = {
            total: Math.max(0, game.total - loaded.total),
            found: Math.max(0, game.found - loaded.found),
          };
          renderProgress();
        })
        .catch(function (error) {
          if (!alive) {
            return;
          }
          console.error("[viewer] No se pudo leer el progreso del juego:", error);
        });
    }
    var closeLabelEditor = null; // cierre del modo "añadir texto" mientras está abierto (label-editor.js)
    var closeEditor = null; // cierre del modo "añadir pin" mientras está abierto (pin-editor.js)

    var root = el("section", "viewer");
    root.setAttribute("aria-label", "Visor de mapa");

    // Escenario a pantalla completa; el panel y la pestaña van encima, como hermanos, fuera del
    // contenedor de Leaflet. Así la rueda (wheel-zoom.js) y el arrastre (mousedown de Leaflet),
    // que escuchan en ese contenedor, no reciben los eventos que empiezan sobre el panel.
    var stage = el("div", "viewer__stage");
    var status = el("p", "viewer__status", "Cargando mapa…");
    stage.appendChild(status);

    var panel = el("aside", "viewer__panel");
    panel.id = "viewer-panel";
    panel.setAttribute("aria-label", "Panel del mapa");
    var back = el("a", "btn btn--ghost viewer__back", "← Mapas");
    back.href = "#/";
    var title = el("h1", "viewer__title", "Cargando…");
    panel.appendChild(back);

    // Filtros de pines (SPEC 09): dos estados independientes, cada uno decide si se ven los pines
    // pendientes / encontrados; se guardan por mapa (maps.hidePending / hideFound). Desde SPEC 12 sus
    // botones están solo en el panel de progreso (progress-hud.js); aquí queda el estado.
    // El valor inicial lo pone createLeafletMap.
    var FILTERS = [
      { key: "pending", visible: true },
      { key: "found", visible: true },
    ];

    function renderFilters() {
      if (hud) {
        hud.setFilters({ pending: FILTERS[0].visible, found: FILTERS[1].visible });
      }
    }

    function applyFilter(item, visible) {
      item.visible = visible;
      renderFilters();
      if (pins) {
        if (item.key === "found") {
          pins.setHideFound(!visible);
        } else {
          pins.setHidePending(!visible);
        }
      }
    }

    // Cambio al momento; si no se puede guardar, vuelve al estado anterior con aviso.
    function toggleFilter(item) {
      if (!pins) {
        return;
      }
      var previous = item.visible;
      applyFilter(item, !previous);
      var save = item.key === "found" ? mapService.setHideFound : mapService.setHidePending;
      save(params.id, previous).catch(function (error) {
        if (!alive) {
          return;
        }
        console.error("[viewer] No se pudo guardar el filtro:", error);
        notice.show("No se pudo guardar el filtro.", { type: "error" });
        applyFilter(item, previous);
      });
    }
    panel.appendChild(title);

    // Pestaña de plegado: fuera del panel, para que siga activa cuando el panel queda inert.
    var toggle = el("button", "viewer__toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-controls", panel.id);

    // Contraído al montar (desde SPEC 08; antes expandido); el estado no se guarda. Excepción: si se
    // llega desde el selector de mapas, expandido (SPEC 12, enmienda).
    // La clase se pone antes de insertar el panel: no hay transición al abrir.
    var panelExpanded = keepPanelOpenFor === params.id;
    keepPanelOpenFor = null;

    function renderPanelState() {
      root.classList.toggle("viewer--panel-collapsed", !panelExpanded);
      panel.inert = !panelExpanded;
      toggle.setAttribute("aria-expanded", String(panelExpanded));
      toggle.setAttribute("aria-label", panelExpanded ? "Contraer panel" : "Expandir panel");
      toggle.textContent = panelExpanded ? "◀" : "▶";
    }

    toggle.addEventListener("click", function () {
      panelExpanded = !panelExpanded;
      renderPanelState();
    });
    renderPanelState();

    root.appendChild(stage);
    root.appendChild(panel);
    root.appendChild(toggle);
    container.appendChild(root);
    document.body.classList.add("is-viewer");

    function fitZoom(bounds) {
      // Mayor zoom con el que la imagen entera cabe en la vista, sin pasar del máximo.
      var previousMin = leafletMap.getMinZoom();
      leafletMap.options.minZoom = UNBOUNDED_MIN_ZOOM;
      var zoom = leafletMap.getBoundsZoom(bounds, false);
      leafletMap.options.minZoom = previousMin;
      return Math.min(zoom, MAX_ZOOM);
    }

    /**
     * maxBounds para el zoom vigente. Que la vista no salga de ellos equivale a que, en cada eje,
     * queden al menos `m` px de imagen dentro de la vista: los bounds de la imagen se amplían por
     * cada lado en (vista − m). `m` no pasa del tamaño de la imagen ni del de la vista.
     */
    function updateMaxBounds(bounds) {
      var scale = Math.pow(2, leafletMap.getZoom()); // px de pantalla por unidad
      var size = leafletMap.getSize();
      var imageW = bounds.getEast() - bounds.getWest();
      var imageH = bounds.getNorth() - bounds.getSouth();
      var viewW = size.x / scale;
      var viewH = size.y / scale;
      var padW = viewW - Math.min(MIN_VISIBLE_PX / scale, imageW, viewW);
      var padH = viewH - Math.min(MIN_VISIBLE_PX / scale, imageH, viewH);
      leafletMap.setMaxBounds(
        L.latLngBounds([bounds.getSouth() - padH, bounds.getWest() - padW], [bounds.getNorth() + padH, bounds.getEast() + padW])
      );
    }

    // Pantalla completa del navegador sobre <html>, no sobre .viewer: los avisos y diálogos cuelgan
    // de <body> y no se verían. Se pide directamente en el clic (la API exige un gesto del usuario).
    function toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function (error) {
          console.error("[viewer] No se pudo salir de la pantalla completa:", error);
        });
        return;
      }
      var request;
      try {
        request = document.documentElement.requestFullscreen();
      } catch (error) {
        request = Promise.reject(error);
      }
      request.catch(function () {
        notice.show("No se pudo activar la pantalla completa.", { type: "error" });
      });
    }

    // El estado visual sale del evento, no del clic: así Esc y el botón dejan la UI igual.
    // El panel conserva su estado (panelExpanded): solo se oculta mientras dure la pantalla completa.
    function onFullscreenChange() {
      var active = document.fullscreenElement === document.documentElement;
      root.classList.toggle("viewer--fullscreen", active);
      if (controls) {
        controls.setFullscreen(active);
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);

    function createLeafletMap(map, url) {
      var bounds = L.latLngBounds([0, 0], [map.height, map.width]);

      leafletMap = L.map(stage, {
        crs: L.CRS.Simple,
        attributionControl: false,
        zoomControl: false,
        zoomSnap: 0, // zoom continuo: el ajuste inicial es exacto
        zoomDelta: 1,
        scrollWheelZoom: false, // la rueda la gestiona wheel-zoom.js
        minZoom: UNBOUNDED_MIN_ZOOM, // se sustituye por fitZoom − 2 al crear el mapa
        maxZoom: MAX_ZOOM,
        maxBoundsViscosity: 1, // maxBounds lo fija updateMaxBounds()
        bounceAtZoomLimits: false,
      });

      // Leaflet anima la vuelta a maxBounds en cada moveend; si coincide con otra animación (inercia),
      // la anida y deja un bucle huérfano que mueve el mapa durante el arrastre y falla tras remove().
      // Sin animación no hay anidamiento. Se fija antes del primer setMaxBounds, que es quien lo registra.
      leafletMap._panInsideMaxBounds = function () {
        if (!this._enforcingBounds) {
          this.panInsideBounds(this.options.maxBounds, { animate: false });
        }
      };

      L.control.zoom({ position: "bottomright", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(leafletMap);

      // Después del zoom: en las esquinas de abajo Leaflet apila el último añadido arriba.
      //
      controls = viewControls
        .create({
          onAddLabel: function () {
            openLabelEditor(map);
          },
          onAddPin: function () {
            openPinEditor(map);
          },
          onToggleFullscreen: toggleFullscreen,
          onFit: function () {
            // Vista inicial: mapa entero visible y centrado, con el ajuste para la ventana de ahora.
            leafletMap.setView(bounds.getCenter(), fitZoom(bounds), { animate: !prefersReducedMotion() });
          },
          onActualSize: function () {
            // 1 px de imagen = 1 px de pantalla, sobre el punto que está en el centro de la vista.
            // Si el 0 queda fuera del rango, se usa el valor más cercano dentro de él.
            var zoom = Math.max(leafletMap.getMinZoom(), Math.min(MAX_ZOOM, ACTUAL_SIZE_ZOOM));
            leafletMap.setView(leafletMap.getCenter(), zoom, { animate: !prefersReducedMotion() });
          },
        });
      controls.addTo(leafletMap);

      // El botón de escala cambia según el zoom: a tamaño real ofrece ajustar; si no, 1:1.
      function syncScaleButton() {
        controls.setActualSize(Math.abs(leafletMap.getZoom() - ACTUAL_SIZE_ZOOM) < ACTUAL_SIZE_EPSILON);
      }
      leafletMap.on("zoomend", syncScaleButton);

      var overlay = L.imageOverlay(url, bounds, { alt: map.name }).addTo(leafletMap);
      overlay.on("error", function () {
        notice.show("No se pudo mostrar la imagen del mapa.", { type: "error" });
      });

      // getBoundsZoom necesita que el mapa ya tenga una vista: se fija una provisional primero.
      leafletMap.setView(bounds.getCenter(), 0, { animate: false });
      var initialZoom = fitZoom(bounds);
      leafletMap.setMinZoom(initialZoom - MIN_ZOOM_BELOW_FIT);
      leafletMap.setView(bounds.getCenter(), initialZoom, { animate: false });
      updateMaxBounds(bounds);

      leafletMap.on("zoomend", function () {
        updateMaxBounds(bounds);
      });

      detachWheel = wheelZoom.attach(leafletMap, { maxZoom: MAX_ZOOM, bounds: bounds, minVisiblePx: MIN_VISIBLE_PX });

      // Al cambiar el tamaño de la ventana, el zoom mínimo sigue a "mapa entero visible" − 2.
      leafletMap.on("resize", function () {
        var newMin = fitZoom(bounds) - MIN_ZOOM_BELOW_FIT;
        leafletMap.setMinZoom(newMin);
        if (leafletMap.getZoom() < newMin) {
          leafletMap.setZoom(newMin, { animate: false });
        }
        updateMaxBounds(bounds);
      });

      // Panel de progreso (SPEC 12): hermano del escenario, como el panel lateral.
      hud = progressHud.create({
        onToggleFilter: function (key) {
          toggleFilter(key === "found" ? FILTERS[1] : FILTERS[0]);
        },
      });
      root.appendChild(hud.el);

      // Pines guardados del mapa: si la carga falla, avisa y el mapa sigue abierto.
      pins = pinLayer.create(leafletMap, map, {
        onEdit: function (marker) {
          openPinEditor(map, marker);
        },
        onCountsChange: function (counts) {
          if (alive) {
            progress.map = counts;
            renderProgress(progress.loaded);
            // Favicon verde con el mapa completado (SPEC 13), misma regla que "COMPLETADO".
            favicon.setComplete(counts.total > 0 && counts.found === counts.total);
          }
        },
      });
      // Antes de load(): los pines ocultos ni se pintan.
      applyFilter(FILTERS[0], map.hidePending !== true);
      applyFilter(FILTERS[1], map.hideFound !== true);
      hud.setFiltersEnabled(true);
      pins.load().then(function () {
        if (alive) {
          progress.loaded = true;
          loadGameProgress(map.gameId);
        }
      });

      // Textos guardados (SPEC 10): si la carga falla, avisa y el mapa sigue abierto.
      labels = labelLayer.create(leafletMap, map, {
        onEdit: function (label) {
          openLabelEditor(map, label);
        },
      });
      labels.load();
    }

    // El panel izquierdo tapa el mapa solo si está expandido y fuera de pantalla completa.
    function freeLeft() {
      var hidden = !panelExpanded || root.classList.contains("viewer--fullscreen");
      return hidden ? 0 : panel.offsetWidth;
    }

    // Foco en un elemento recién editado; si no está pintado (oculto por un filtro), en el mapa.
    function focusEdited(layer, id) {
      if (!layer || !layer.focus(id)) {
        if (leafletMap) {
          leafletMap.getContainer().focus();
        }
      }
    }

    // Modo "añadir pin": panel derecho y borrador. Los controles de la esquina se ocultan mientras
    // dura (.viewer--adding-pin); al cancelar vuelven y el foco regresa al botón "Añadir pin".
    // Con `editing` (SPEC 11), modo "editar pin": el pin guardado sale del mapa mientras dura y
    // vuelve al cerrar (con los datos nuevos al guardar, con los originales en otro caso); el foco
    // va al pin.
    function openPinEditor(map, editing) {
      if (closeEditor || closeLabelEditor || !pins) {
        return;
      }
      var saved = null; // al editar: el marcador guardado, para repintarlo al cerrar
      if (editing) {
        pins.startEditing(editing.id);
      }
      closeEditor = pinEditor.open({
        root: root,
        leafletMap: leafletMap,
        map: map,
        pins: pins,
        labels: labels,
        marker: editing || null,
        freeLeft: freeLeft,
        onSaved: function (marker) {
          if (editing) {
            saved = marker;
            return;
          }
          if (pins) {
            // Los pines nacen pendientes: con "Pendientes" apagado el nuevo no se vería.
            if (!FILTERS[0].visible) {
              toggleFilter(FILTERS[0]);
            }
            pins.add(marker);
          }
        },
        onClose: function (reason) {
          closeEditor = null;
          if (editing) {
            if (pins) {
              pins.stopEditing(editing.id, saved);
            }
            if (reason !== "unmount") {
              focusEdited(pins, editing.id);
            }
            return;
          }
          if (reason !== "unmount" && controls) {
            controls.focusAddPin();
          }
        },
      });
    }

    // Modo "añadir texto" (SPEC 10): como el de pin, con .viewer--adding-label; al cancelar el foco
    // regresa al botón "Añadir texto". Con `editing` (SPEC 11), modo "editar texto", como el de pin.
    function openLabelEditor(map, editing) {
      if (closeEditor || closeLabelEditor || !labels) {
        return;
      }
      var saved = null; // al editar: el texto guardado, para repintarlo al cerrar
      if (editing) {
        labels.startEditing(editing.id);
      }
      closeLabelEditor = labelEditor.open({
        root: root,
        leafletMap: leafletMap,
        map: map,
        freeLeft: freeLeft,
        labels: labels,
        pins: pins,
        label: editing || null,
        onSaved: function (label) {
          if (editing) {
            saved = label;
            return;
          }
          if (labels) {
            labels.add(label);
          }
        },
        onClose: function (reason) {
          closeLabelEditor = null;
          if (editing) {
            if (labels) {
              labels.stopEditing(editing.id, saved);
            }
            if (reason !== "unmount") {
              focusEdited(labels, editing.id);
            }
            return;
          }
          if (reason !== "unmount" && controls) {
            controls.focusAddLabel();
          }
        },
      });
    }

    // Nombre del juego, entre "← Mapas" y el nombre del mapa. Solo informativo: no es enlace.
    function showGame(game) {
      var block = el("div", "viewer__game");
      block.appendChild(el("p", "viewer__game-name", game.name));
      panel.insertBefore(block, title);
    }

    // Selector de mapas: con 2 o más mapas en el juego, el nombre pasa a ser un botón con chevron.
    // textContent de .viewer__title sigue siendo el nombre (el SVG no aporta texto).
    // Con 1 mapa, o mientras la lista no ha llegado o si falla, el título queda como texto.
    // Abierta al montar (SPEC 12, enmienda; antes cerrada). Solo se cierra a mano: el disparador o Esc.
    // Contraer el panel no la cierra: al volver a expandirlo sigue como estaba.
    var mapListOpen = true;
    var mapTrigger = null;
    var mapList = null; // <ul class="viewer__map-list">, bajo el nombre del mapa
    var mapListBuilt = false; // las filas (y sus object URLs) se crean al abrir por primera vez (al montar)
    var thumbUrls = []; // object URLs de las miniaturas, revocados al desmontar
    var listedMaps = [];
    var currentMapId = null;

    function renderMapList() {
      if (!mapTrigger) {
        return;
      }
      if (mapListOpen && !mapListBuilt) {
        buildMapList();
      }
      mapList.hidden = !mapListOpen;
      mapTrigger.setAttribute("aria-expanded", String(mapListOpen));
      mapTrigger.classList.toggle("viewer__map-trigger--open", mapListOpen);
    }

    function closeMapList() {
      if (!mapListOpen) {
        return;
      }
      mapListOpen = false;
      renderMapList();
    }

    // Esc con el foco en el panel: cierra la lista y devuelve el foco al disparador.
    panel.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && mapListOpen) {
        closeMapList();
        mapTrigger.focus();
      }
    });

    // Hueco de 48×32 con el fondo de las tarjetas; con miniatura lleva un <img>.
    function mapThumb(map) {
      var thumb = el("span", "viewer__map-thumb");
      if (map.thumbnail) {
        var url = URL.createObjectURL(map.thumbnail);
        thumbUrls.push(url);
        var img = el("img", "viewer__map-thumb-img");
        img.src = url;
        img.alt = "";
        thumb.appendChild(img);
      }
      return thumb;
    }

    function buildMapList() {
      mapListBuilt = true;
      listedMaps.forEach(function (map) {
        var item = el("li", "viewer__map-item");
        var row;
        if (map.id === currentMapId) {
          // El mapa abierto: solo resaltado, ni botón ni foco.
          row = el("div", "viewer__map-row viewer__map-row--current");
          row.setAttribute("aria-current", "page");
        } else {
          row = el("button", "viewer__map-row");
          row.type = "button";
        }
        row.dataset.mapId = map.id;
        row.appendChild(mapThumb(map));
        row.appendChild(el("span", "viewer__map-row-name", map.name));
        item.appendChild(row);
        mapList.appendChild(item);
      });
    }

    function chevronIcon() {
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "viewer__map-chevron");
      svg.setAttribute("viewBox", "0 0 14 14");
      svg.setAttribute("width", "14");
      svg.setAttribute("height", "14");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M2 4.5 7 9.5 12 4.5");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      svg.appendChild(path);
      return svg;
    }

    function showMapTrigger(map, maps) {
      if (maps.length < 2) {
        return;
      }
      mapTrigger = el("button", "viewer__map-trigger");
      mapTrigger.type = "button";
      mapTrigger.setAttribute("aria-haspopup", "true");
      mapTrigger.setAttribute("aria-controls", "viewer-map-list");
      mapTrigger.appendChild(el("span", "viewer__map-name", map.name));
      mapTrigger.appendChild(chevronIcon());
      mapTrigger.addEventListener("click", function () {
        mapListOpen = !mapListOpen;
        renderMapList();
      });
      title.textContent = "";
      title.appendChild(mapTrigger);

      listedMaps = maps;
      currentMapId = map.id;
      mapList = el("ul", "viewer__map-list");
      mapList.id = "viewer-map-list";
      mapList.hidden = true;
      // Delegado: clic o Enter en una fila abre ese mapa (nueva entrada de historial).
      mapList.addEventListener("click", function (event) {
        var row = event.target.closest("button.viewer__map-row");
        if (row && mapList.contains(row)) {
          keepPanelOpenFor = row.dataset.mapId; // el visor nuevo abre con el panel expandido
          router.goToMap(row.dataset.mapId);
        }
      });
      panel.insertBefore(mapList, title.nextSibling);
      renderMapList();
    }

    function showMap(result) {
      var map = result.map;
      title.textContent = map.name;
      title.title = map.name;
      document.title = map.name + " · " + APP_TITLE;
      back.href = "#/game/" + encodeURIComponent(map.gameId);

      imageUrl = URL.createObjectURL(result.blob);
      status.remove();
      createLeafletMap(map, imageUrl);
    }

    mapService
      .open(params.id)
      .then(function (result) {
        if (!alive) {
          return;
        }
        showMap(result);
        // El juego llega aparte: si falla, el panel queda sin su bloque y el mapa sigue abierto.
        gameService
          .get(result.map.gameId)
          .then(function (game) {
            if (alive) {
              showGame(game);
            }
          })
          .catch(function (error) {
            console.error("[viewer] No se pudo leer el juego del mapa:", error);
          });
        // La lista de mapas del juego también llega aparte: si falla, el título queda como texto.
        mapService
          .listByName(result.map.gameId)
          .then(function (maps) {
            if (alive) {
              showMapTrigger(result.map, maps);
            }
          })
          .catch(function (error) {
            console.error("[viewer] No se pudo leer la lista de mapas del juego:", error);
          });
      })
      .catch(function (error) {
        if (!alive) {
          return;
        }
        if (error instanceof mapService.MapNotFoundError) {
          notice.show("Ese mapa no existe o se ha borrado.", { type: "warning" });
        } else {
          console.error("[viewer] No se pudo abrir el mapa:", error);
          notice.show("No se pudo abrir el mapa.", { type: "error" });
        }
        // replace: el id inexistente no queda en el historial del botón atrás.
        router.replaceWithGames();
      });

    return function unmount() {
      alive = false;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
      }
      if (detachWheel) {
        detachWheel();
        detachWheel = null;
      }
      // Cambiar de ruta con el panel de pin o de texto abierto cancela sin preguntar.
      if (closeEditor) {
        closeEditor();
        closeEditor = null;
      }
      if (closeLabelEditor) {
        closeLabelEditor();
        closeLabelEditor = null;
      }
      if (pins) {
        pins.destroy();
        pins = null;
      }
      if (labels) {
        labels.destroy();
        labels = null;
      }
      if (hud) {
        hud.destroy();
        hud = null;
      }
      if (leafletMap) {
        leafletMap.remove();
        leafletMap = null;
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        imageUrl = null;
      }
      thumbUrls.forEach(function (url) {
        URL.revokeObjectURL(url);
      });
      thumbUrls = [];
      document.body.classList.remove("is-viewer");
      document.title = APP_TITLE;
      // Fuera del visor el favicon siempre es el normal (SPEC 13).
      favicon.setComplete(false);
      container.innerHTML = "";
    };
  }

  Waypoint.ui.viewerView = { mount: mount };
})(window.Waypoint);
