/*
 * Capa de pines guardados del visor (SPEC 08).
 *
 *   var layer = Waypoint.ui.pinLayer.create(leafletMap, map);  // map: { id, width, height }
 *   layer.load();          // lee los pines del mapa y los pinta; aviso si falla
 *   layer.add(marker);     // pinta un pin recién guardado
 *   layer.setHidePending(b); // true: quita del mapa los pines pendientes (independiente de setHideFound)
 *   layer.setHideFound(b); // true: quita del mapa los pines encontrados; false: los vuelve a pintar (SPEC 09)
 *   layer.setPlacing(fn);  // modo "añadir pin" on (fn(latLng) al hacer clic en un pin) / off (null)
 *   layer.destroy();       // quita marcadores y listeners (antes de leafletMap.remove())
 *
 * Cada pin es un L.Marker con L.divIcon: el glifo de pinIcons a `size` px de pantalla (no cambia con
 * el zoom), centrado en el punto del pin. Si `found === true` (SPEC 09) lleva `.pin--found`: glifo
 * translúcido. Hover → tooltip con el nombre; clic → popup arcade con
 * nombre, nota, el botón ojo "Encontrado" (alterna `found`, SPEC 09: cambio al momento, vuelta atrás con
 * aviso si falla el guardado) y "Borrar" (con dialog.confirm). El popup se cierra con su ×, Esc o un clic en el mapa.
 * Clic sostenido y arrastre mueve el pin (dentro de la imagen) y guarda la posición al soltar.
 * En modo "añadir pin" (setPlacing) siguen moviéndose, pero sin popup ni tooltip: un clic sin
 * arrastre lleva el borrador a ese punto.
 *
 * Posición: el marcador guarda x/y relativos (0–1); lat = height·(1 − y), lng = width·x (SPEC 01).
 * Nunca accede a IndexedDB: todo pasa por Waypoint.services.markerService.
 */
(function (Waypoint) {
  "use strict";

  var markerService = Waypoint.services.markerService;
  var pinIcons = Waypoint.ui.pinIcons;
  var notice = Waypoint.ui.notice;

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

  /** Clave de color válida; una desconocida se pinta en dorado. */
  function colorKey(color) {
    return markerService.COLORS.indexOf(color) === -1 ? markerService.DEFAULT_STYLE.color : color;
  }

  /**
   * Icono Leaflet de un pin: glifo coloreado de `size` px con su centro en el punto.
   * Lo comparten los pines guardados y el borrador (pin-editor.js).
   * @param {{icon, color, size}} style
   * @param {string} [extraClass]
   */
  function divIcon(style, extraClass) {
    var size = style.size;
    var half = size / 2;
    return L.divIcon({
      className:
        "pin pin--" +
        colorKey(style.color) +
        (style.found === true ? " pin--found" : "") +
        (extraClass ? " " + extraClass : ""),
      html: pinIcons.svg(style.icon),
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -half],
      tooltipAnchor: [0, -half],
    });
  }

  /** Coordenadas Leaflet de una posición relativa (0–1) de la imagen. */
  function toLatLng(map, x, y) {
    return L.latLng(map.height * (1 - y), map.width * x);
  }

  /** Posición relativa (0–1) de unas coordenadas Leaflet de la imagen. */
  function toRelative(map, latLng) {
    return { x: latLng.lng / map.width, y: 1 - latLng.lat / map.height };
  }

  /** Contenido del tooltip: un nodo de texto (Leaflet trata los strings como HTML). */
  function tooltipContent(name) {
    return el("span", "pin-tooltip__name", name);
  }

  // Ojo abierto (pendiente) y ojo tachado (encontrado) del botón del popup (SPEC 09); currentColor.
  var SVG_OPEN = '<svg class="pin-popup__found-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var EYE_SVG = SVG_OPEN + '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF_SVG = SVG_OPEN + '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>';

  function create(leafletMap, map) {
    var destroyed = false;
    var savedPins = {}; // id → L.Marker
    var popups = {}; // id → L.Popup (se desligan del pin en modo "añadir pin" y se vuelven a ligar)
    var foundButtons = {}; // id → botón ojo del popup
    var markers = {}; // id → marcador (todos, también los ocultos por el filtro; savedPins solo los pintados)
    var hideFound = false; // "Ocultar encontrados": los encontrados no están en el mapa
    var hidePending = false; // "Ocultar pendientes": los no encontrados no están en el mapa

    // ¿Debe estar este pin fuera del mapa con el filtro actual? (los dos filtros son independientes)
    function shouldHide(marker) {
      return marker.found === true ? hideFound : hidePending;
    }
    var hidden = {}; // id → true: pin quitado del mapa por el filtro (sigue en `markers`)
    var dragging = false; // un arrastre cierra el popup: eso no debe ocultar el pin que se arrastra
    var placeHandler = null; // modo "añadir pin": clic en un pin guardado → handler(latLng)

    // Pinta el estado "encontrado" del pin: clase en el icono (y en las opciones del icono, para que
    // sobreviva a un remove/addTo) y el aspecto del botón del popup, si existe.
    function paintFound(marker) {
      var found = marker.found === true;
      var pin = savedPins[marker.id];
      if (!pin && !found && hidden[marker.id] && !shouldHide(marker) && !destroyed) {
        // Marcado con el filtro activo, ocultado al cerrar el popup y revertido por un fallo al guardar.
        showPin(marker);
        return;
      }
      if (pin) {
        var icon = pin.options.icon;
        var base = (icon.options.className || "").replace(" pin--found", "");
        icon.options.className = base + (found ? " pin--found" : "");
        var node = pin.getElement();
        if (node) {
          node.classList.toggle("pin--found", found);
        }
      }
      var button = foundButtons[marker.id];
      if (button) {
        button.setAttribute("aria-pressed", found ? "true" : "false");
        button.title = found ? "Marcar como pendiente" : "Marcar como encontrado";
        // Los dos SVG se quedan en el DOM: si el nodo clicado se quitara, Leaflet no encontraría el
        // popup al subir desde él y trataría el clic como clic en el mapa (cerraría el popup).
        // toggleAttribute: los SVG no tienen la propiedad `hidden`; el CSS global [hidden] sí aplica.
        button.firstChild.toggleAttribute("hidden", found);
        button.lastChild.toggleAttribute("hidden", !found);
      }
    }

    // Alterna el estado al momento y lo guarda; si falla, vuelve al anterior con aviso.
    function toggleFound(marker) {
      var previous = marker.found === true;
      marker.found = !previous;
      paintFound(marker);
      markerService.setFound(marker.id, marker.found).catch(function (error) {
        if (destroyed) {
          return;
        }
        console.error("[pin-layer] No se pudo marcar el pin:", error);
        notice.show("No se pudo marcar el pin.", { type: "error" });
        marker.found = previous;
        paintFound(marker);
      });
    }

    function foundButton(marker) {
      var button = el("button", "pin-popup__found");
      button.type = "button";
      button.setAttribute("aria-label", "Encontrado");
      button.innerHTML = EYE_SVG + EYE_OFF_SVG;
      foundButtons[marker.id] = button;
      button.addEventListener("click", function () {
        toggleFound(marker);
      });
      paintFound(marker);
      return button;
    }

    function popupContent(marker) {
      var box = el("div", "pin-popup__body");
      // Cabecera: nombre a la izquierda y el ojo "Encontrado" arriba a la derecha (junto a la ×).
      var header = el("div", "pin-popup__header");
      header.appendChild(el("h2", "pin-popup__name", marker.name));
      header.appendChild(foundButton(marker));
      box.appendChild(header);
      if (marker.note) {
        box.appendChild(el("p", "pin-popup__note", marker.note));
      }
      var actions = el("div", "pin-popup__actions");
      // EDITAR: solo el botón, sin función todavía (editar pines es de una spec futura).
      var edit = el("button", "btn btn--edit pin-popup__edit", "Editar");
      edit.type = "button";
      actions.appendChild(edit);
      var del = el("button", "btn btn--danger pin-popup__delete", "Borrar");
      del.type = "button";
      del.addEventListener("click", function () {
        confirmRemove(marker);
      });
      actions.appendChild(del);
      box.appendChild(actions);
      return box;
    }

    // Borrar pide confirmación; el popup sigue abierto mientras tanto (cancelar deja todo igual).
    function confirmRemove(marker) {
      Waypoint.ui.dialog
        .confirm({
          title: "¿Borrar pin?",
          message: "Se borrará «" + marker.name + "».",
          confirmLabel: "Borrar",
          danger: true,
        })
        .then(function (confirmed) {
          if (!confirmed || destroyed) {
            return;
          }
          return markerService.remove(marker.id).then(
            function () {
              if (destroyed) {
                return;
              }
              var pin = savedPins[marker.id];
              if (pin) {
                pin.remove(); // cierra también su popup
                delete savedPins[marker.id];
                delete popups[marker.id];
                delete foundButtons[marker.id];
              }
              delete markers[marker.id];
              delete hidden[marker.id];
            },
            function (error) {
              console.error("[pin-layer] No se pudo borrar el pin:", error);
              notice.show("No se pudo borrar el pin.", { type: "error" });
            }
          );
        });
    }

    // Esc cierra el popup abierto. Se escucha en document solo mientras hay popup: el foco puede
    // estar en el mapa, en el pin o en ninguna parte. Con un diálogo modal abierto (la confirmación
    // de borrar), el Esc es del diálogo.
    function onKeyDown(event) {
      if (event.key === "Escape" && leafletMap && !document.querySelector("dialog[open]")) {
        leafletMap.closePopup();
      }
    }
    function onPopupOpen() {
      document.addEventListener("keydown", onKeyDown);
    }
    function onPopupClose() {
      document.removeEventListener("keydown", onKeyDown);
    }
    leafletMap.on("popupopen", onPopupOpen);
    leafletMap.on("popupclose", onPopupClose);

    function clampToImage(latLng) {
      return L.latLng(
        Math.min(map.height, Math.max(0, latLng.lat)),
        Math.min(map.width, Math.max(0, latLng.lng))
      );
    }

    // Mover: arrastre de L.Marker (no mueve el mapa). Se recoloca dentro de la imagen en cada `drag`
    // y al soltar; al soltar se guarda. Si falla, vuelve a donde estaba. Leaflet no dispara `click`
    // tras un arrastre, así que soltar no abre el popup ni (en modo "añadir pin") mueve el borrador.
    function makeDraggable(pin, marker) {
      var origin = null;
      function keepInside() {
        var latLng = pin.getLatLng();
        var inside = clampToImage(latLng);
        if (!inside.equals(latLng)) {
          pin.setLatLng(inside);
        }
      }
      pin.on("dragstart", function () {
        dragging = true;
        origin = toLatLng(map, marker.x, marker.y);
        pin.closePopup();
        pin.closeTooltip();
      });
      pin.on("drag", keepInside);
      pin.on("dragend", function () {
        dragging = false;
        keepInside();
        var relative = toRelative(map, pin.getLatLng());
        var back = origin;
        markerService.move(marker.id, relative.x, relative.y).then(
          function () {
            marker.x = relative.x;
            marker.y = relative.y;
          },
          function (error) {
            if (destroyed) {
              return;
            }
            console.error("[pin-layer] No se pudo mover el pin:", error);
            notice.show("No se pudo mover el pin.", { type: "error" });
            pin.setLatLng(back);
          }
        );
        // Marcado con el filtro activo y arrastrado con su popup abierto: se oculta al soltar.
        hideIfFound(marker);
      });
    }

    // Quita del mapa un pin encontrado si el filtro está activo (idempotente).
    function hideIfFound(marker) {
      if (shouldHide(marker)) {
        hidePin(marker.id);
      }
    }

    // Quita el pin del mapa sin borrar el marcador: no recibe clic, hover, foco ni arrastre.
    function hidePin(id) {
      var pin = savedPins[id];
      if (!pin) {
        return;
      }
      delete savedPins[id];
      delete popups[id];
      delete foundButtons[id];
      hidden[id] = true;
      pin.remove(); // cierra también su popup
    }

    // Registra un pin y lo pinta salvo que el filtro lo oculte.
    function add(marker) {
      markers[marker.id] = marker;
      if (shouldHide(marker)) {
        hidden[marker.id] = true;
        return null;
      }
      return showPin(marker);
    }

    function showPin(marker) {
      delete hidden[marker.id];
      var pin = L.marker(toLatLng(map, marker.x, marker.y), {
        icon: divIcon(marker),
        keyboard: false,
        riseOnHover: true,
        draggable: true,
        autoPan: false,
      });
      // pin-tooltip--saved: en modo "añadir pin" css/pins.css oculta los de los pines guardados.
      pin.bindTooltip(tooltipContent(marker.name), {
        direction: "top",
        className: "pin-tooltip pin-tooltip--saved",
      });
      var popup = L.popup({
        className: "pin-popup",
        maxWidth: 220,
        minWidth: 160,
        autoPanPadding: [24, 24],
      }).setContent(popupContent(marker));
      popups[marker.id] = popup;
      if (!placeHandler) {
        pin.bindPopup(popup);
      }
      // En modo "añadir pin", un clic sin arrastre cuenta como clic en el mapa, en el punto exacto.
      pin.on("click", function (event) {
        if (placeHandler) {
          placeHandler(leafletMap.mouseEventToLatLng(event.originalEvent));
        }
      });
      makeDraggable(pin, marker);
      // El tooltip sale por encima del pin, igual que el popup: con el popup abierto, sobra.
      pin.on("popupopen", function () {
        pin.closeTooltip();
      });
      pin.on("tooltipopen", function () {
        if (pin.isPopupOpen()) {
          pin.closeTooltip();
        }
      });
      // Con el filtro activo, un pin marcado con el popup abierto desaparece al cerrarlo.
      pin.on("popupclose", function () {
        if (!dragging && !destroyed) {
          hideIfFound(marker);
        }
      });
      pin.addTo(leafletMap);
      savedPins[marker.id] = pin;
      return pin;
    }

    function load() {
      return markerService
        .listByMap(map.id)
        .then(function (markers) {
          if (destroyed) {
            return;
          }
          markers.forEach(add);
        })
        .catch(function (error) {
          if (destroyed) {
            return;
          }
          console.error("[pin-layer] No se pudieron cargar los pines:", error);
          notice.show("No se pudieron cargar los pines.", { type: "error" });
        });
    }

    /**
     * Modo "añadir pin" (pin-editor.js): con un handler, los pines guardados no abren popup y un clic
     * sin arrastre sobre ellos llama a handler(latLng); siguen pudiéndose arrastrar. null lo quita.
     */
    function setPlacing(handler) {
      placeHandler = handler || null;
      Object.keys(savedPins).forEach(function (id) {
        var pin = savedPins[id];
        if (placeHandler) {
          pin.closePopup();
          pin.unbindPopup();
        } else if (!pin.getPopup()) {
          pin.bindPopup(popups[id]);
        }
      });
    }

    /**
     * "Ocultar encontrados" (SPEC 09): con true quita del mapa los pines encontrados (cerrando antes
     * su popup si está abierto); con false vuelve a pintarlos. También vale antes de load().
     */
    function setHideFound(hide) {
      hideFound = hide === true;
      refresh();
    }

    /** "Ocultar pendientes": con true quita del mapa los no encontrados; con false los vuelve a pintar. */
    function setHidePending(hide) {
      hidePending = hide === true;
      refresh();
    }

    // Aplica el filtro a todos los marcadores: quita (cerrando antes su popup) o vuelve a pintar.
    function refresh() {
      Object.keys(markers).forEach(function (id) {
        var marker = markers[id];
        if (shouldHide(marker)) {
          var pin = savedPins[id];
          if (pin && pin.isPopupOpen()) {
            pin.closePopup();
          }
          hidePin(id);
        } else if (!savedPins[id]) {
          showPin(marker);
        }
      });
    }

    /**
     * Cajas en pantalla de los pines pintados (para que el borrador no caiga encima);
     * los ocultos por el filtro no cuentan.
     * @returns {{x: number, y: number, size: number}[]} Centro en px del contenedor y lado en px.
     */
    function boxes() {
      return Object.keys(savedPins).map(function (id) {
        var pin = savedPins[id];
        var point = leafletMap.latLngToContainerPoint(pin.getLatLng());
        return { x: point.x, y: point.y, size: pin.options.icon.options.iconSize[0] };
      });
    }

    function destroy() {
      destroyed = true;
      placeHandler = null;
      document.removeEventListener("keydown", onKeyDown);
      leafletMap.off("popupopen", onPopupOpen);
      leafletMap.off("popupclose", onPopupClose);
      Object.keys(savedPins).forEach(function (id) {
        savedPins[id].remove();
      });
      savedPins = {};
      popups = {};
      foundButtons = {};
      markers = {};
      hidden = {};
    }

    return {
      load: load,
      add: add,
      setPlacing: setPlacing,
      setHideFound: setHideFound,
      setHidePending: setHidePending,
      boxes: boxes,
      destroy: destroy,
    };
  }

  Waypoint.ui.pinLayer = {
    create: create,
    divIcon: divIcon,
    toLatLng: toLatLng,
    toRelative: toRelative,
    tooltipContent: tooltipContent,
  };
})(window.Waypoint);
