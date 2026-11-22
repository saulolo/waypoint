/*
 * Capa de pines guardados del visor (SPEC 08).
 *
 *   var layer = Waypoint.ui.pinLayer.create(leafletMap, map);  // map: { id, width, height }
 *   layer.load();          // lee los pines del mapa y los pinta; aviso si falla
 *   layer.add(marker);     // pinta un pin recién guardado
 *   layer.setPlacing(fn);  // modo "añadir pin" on (fn(latLng) al hacer clic en un pin) / off (null)
 *   layer.destroy();       // quita marcadores y listeners (antes de leafletMap.remove())
 *
 * Cada pin es un L.Marker con L.divIcon: el glifo de pinIcons a `size` px de pantalla (no cambia con
 * el zoom), centrado en el punto del pin. Hover → tooltip con el nombre; clic → popup arcade con
 * nombre, nota y "Borrar" (con dialog.confirm). El popup se cierra con su ×, Esc o un clic en el mapa.
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
      className: "pin pin--" + colorKey(style.color) + (extraClass ? " " + extraClass : ""),
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

  function create(leafletMap, map) {
    var destroyed = false;
    var savedPins = {}; // id → L.Marker
    var popups = {}; // id → L.Popup (se desligan del pin en modo "añadir pin" y se vuelven a ligar)
    var placeHandler = null; // modo "añadir pin": clic en un pin guardado → handler(latLng)

    function popupContent(marker) {
      var box = el("div", "pin-popup__body");
      box.appendChild(el("h2", "pin-popup__name", marker.name));
      if (marker.note) {
        box.appendChild(el("p", "pin-popup__note", marker.note));
      }
      var actions = el("div", "pin-popup__actions");
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
              }
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
        origin = toLatLng(map, marker.x, marker.y);
        pin.closePopup();
        pin.closeTooltip();
      });
      pin.on("drag", keepInside);
      pin.on("dragend", function () {
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
      });
    }

    function add(marker) {
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
     * Cajas en pantalla de los pines guardados (para que el borrador no caiga encima).
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
    }

    return {
      load: load,
      add: add,
      setPlacing: setPlacing,
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
