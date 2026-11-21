/*
 * Visor de mapas a pantalla completa con Leaflet (CRS.Simple).
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
 * Al salir se quita el handler de rueda, se destruye el mapa Leaflet y se revoca el object URL.
 *
 * Nunca accede a IndexedDB: todo pasa por Waypoint.services.mapService.
 */
(function (Waypoint) {
  "use strict";

  var mapService = Waypoint.services.mapService;
  var notice = Waypoint.ui.notice;
  var router = Waypoint.core.router;
  var wheelZoom = Waypoint.ui.wheelZoom;

  var MAX_ZOOM = 2; // 2^2 = 4× el tamaño real
  var MIN_ZOOM_BELOW_FIT = 2; // zoom mínimo = fitZoom − 2 → 1/4 del tamaño de ajuste
  var MIN_VISIBLE_PX = 100; // px de imagen que siempre quedan dentro de la vista, por eje
  // getBoundsZoom limita su resultado al minZoom vigente; para medir el ajuste real
  // (negativo en imágenes más grandes que la ventana) se abre el límite antes de calcular.
  var UNBOUNDED_MIN_ZOOM = -20;
  var APP_TITLE = "Waypoint";

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

    var root = el("section", "viewer");
    root.setAttribute("aria-label", "Visor de mapa");

    var bar = el("header", "viewer__bar");
    var back = el("a", "btn btn--ghost viewer__back", "← Mapas");
    back.href = "#/";
    var title = el("h1", "viewer__title", "Cargando…");
    bar.appendChild(back);
    bar.appendChild(title);

    var stage = el("div", "viewer__stage");
    var status = el("p", "viewer__status", "Cargando mapa…");
    stage.appendChild(status);

    root.appendChild(bar);
    root.appendChild(stage);
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
      if (detachWheel) {
        detachWheel();
        detachWheel = null;
      }
      if (leafletMap) {
        leafletMap.remove();
        leafletMap = null;
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        imageUrl = null;
      }
      document.body.classList.remove("is-viewer");
      document.title = APP_TITLE;
      container.innerHTML = "";
    };
  }

  Waypoint.ui.viewerView = { mount: mount };
})(window.Waypoint);
