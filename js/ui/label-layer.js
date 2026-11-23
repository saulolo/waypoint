/*
 * Capa de textos guardados del visor (SPEC 10).
 *
 *   var layer = Waypoint.ui.labelLayer.create(leafletMap, map, { onEdit });  // map: { id, width, height }
 *   layer.load();          // lee los textos del mapa y los pinta; aviso si falla
 *   layer.add(label);      // pinta un texto recién guardado
 *   layer.setPlacing(fn);  // modo "añadir pin" o "añadir texto" on (fn(latLng) al hacer clic en un texto) / off (null)
 *   layer.startEditing(id);       // SPEC 11: quita el texto del mapa mientras se edita (sigue en memoria)
 *   layer.stopEditing(id, label); // lo vuelve a pintar con los datos nuevos, o los originales con null
 *   layer.focus(id);       // foco en el texto; false si no está pintado
 *   layer.destroy();       // quita marcadores y listeners (antes de leafletMap.remove())
 *
 * Cada texto es un L.Marker con L.divIcon de tamaño 0 anclado en el punto guardado; dentro, el texto
 * se centra con transform (su ancho no se conoce al crear el icono). Letra --font-pixel a `size` px de
 * pantalla (no cambia con el zoom), en su color, con contorno y sin fondo. Hover → tooltip con la
 * nota, si tiene (SPEC 11; oculto con el popup abierto y, por CSS, en los modos de añadir/editar). Clic → popup arcade con el texto, la nota, "Editar" (SPEC 11: cierra el popup y llama a
 * onEdit(label)) y "Borrar" (con dialog.confirm). El popup se cierra
 * con su ×, Esc o un clic en el mapa. Clic sostenido y arrastre mueve el texto (dentro de la imagen)
 * y guarda la posición al soltar. Los filtros de pines (SPEC 09) no les afectan.
 * En los modos de añadir (setPlacing) siguen moviéndose, pero sin popup: un clic sin arrastre lleva
 * el borrador a ese punto.
 *
 * Posición: x/y relativos (0–1); lat = height·(1 − y), lng = width·x (SPEC 01), como los pines.
 * Nunca accede a IndexedDB: todo pasa por Waypoint.services.labelService.
 */
(function (Waypoint) {
  "use strict";

  var labelService = Waypoint.services.labelService;
  var pinLayer = Waypoint.ui.pinLayer;
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

  /** Clave de color válida; una desconocida se pinta con el color por defecto. */
  function colorKey(color) {
    return labelService.COLORS.indexOf(color) === -1 ? labelService.DEFAULT_STYLE.color : color;
  }

  /**
   * Nodo del texto: .label-glyph (lo que anima la caída del borrador) con .label-text dentro
   * (centrado en el punto con translate(-50%, -50%)).
   * @param {{text, color, size}} style
   */
  function glyph(style) {
    var outer = el("span", "label-glyph");
    var inner = el("span", "label-text", style.text);
    inner.style.fontSize = style.size + "px";
    outer.appendChild(inner);
    return outer;
  }

  /**
   * Icono Leaflet de un texto. Lo comparten los textos guardados y el borrador (label-editor.js).
   * @param {{text, color, size}} style
   * @param {string} [extraClass]
   */
  function divIcon(style, extraClass) {
    var half = Math.ceil(style.size / 2);
    return L.divIcon({
      className: "label label--" + colorKey(style.color) + (extraClass ? " " + extraClass : ""),
      html: glyph(style),
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -half],
      tooltipAnchor: [0, -half],
    });
  }

  function create(leafletMap, map, options) {
    options = options || {};
    var destroyed = false;
    var savedLabels = {}; // id → L.Marker (los pintados)
    var labels = {}; // id → texto (todos, también el que está en edición)
    var popups = {}; // id → L.Popup (se desligan del texto en los modos de añadir y se vuelven a ligar)
    var placeHandler = null; // modo de añadir: clic en un texto guardado → handler(latLng)

    function popupContent(label) {
      var box = el("div", "pin-popup__body");
      box.appendChild(el("h2", "pin-popup__name label-popup__text", label.text));
      if (label.note) {
        box.appendChild(el("p", "pin-popup__note", label.note));
      }
      var actions = el("div", "pin-popup__actions label-popup__actions");
      // EDITAR (SPEC 11): cierra el popup (closePopup, sin quitar el botón a mano) y avisa al visor.
      var edit = el("button", "btn btn--edit label-popup__edit", "Editar");
      edit.type = "button";
      edit.addEventListener("click", function () {
        leafletMap.closePopup();
        if (options.onEdit && !destroyed) {
          options.onEdit(label);
        }
      });
      actions.appendChild(edit);
      var del = el("button", "btn btn--danger label-popup__delete", "Borrar");
      del.type = "button";
      del.addEventListener("click", function () {
        confirmRemove(label);
      });
      actions.appendChild(del);
      box.appendChild(actions);
      return box;
    }

    // Borrar pide confirmación; el popup sigue abierto mientras tanto (cancelar deja todo igual).
    function confirmRemove(label) {
      Waypoint.ui.dialog
        .confirm({
          title: "¿Borrar texto?",
          message: "Se borrará «" + label.text + "».",
          confirmLabel: "Borrar",
          danger: true,
        })
        .then(function (confirmed) {
          if (!confirmed || destroyed) {
            return;
          }
          return labelService.remove(label.id).then(
            function () {
              if (destroyed) {
                return;
              }
              var marker = savedLabels[label.id];
              if (marker) {
                marker.remove(); // cierra también su popup
                delete savedLabels[label.id];
                delete popups[label.id];
              }
              delete labels[label.id];
            },
            function (error) {
              console.error("[label-layer] No se pudo borrar el texto:", error);
              notice.show("No se pudo borrar el texto.", { type: "error" });
            }
          );
        });
    }

    // Esc cierra el popup abierto, como en pin-layer.js. Con un diálogo modal abierto (la
    // confirmación de borrar), el Esc es del diálogo.
    function onKeyDown(event) {
      if (event.key === "Escape" && leafletMap && !document.querySelector("dialog[open]")) {
        leafletMap.closePopup();
      }
    }

    function clampToImage(latLng) {
      return L.latLng(
        Math.min(map.height, Math.max(0, latLng.lat)),
        Math.min(map.width, Math.max(0, latLng.lng))
      );
    }

    // Mover: arrastre de L.Marker (no mueve el mapa). Se recoloca dentro de la imagen en cada `drag`
    // y al soltar; al soltar se guarda. Si falla, vuelve a donde estaba. Leaflet no dispara `click`
    // tras un arrastre, así que soltar no abre el popup.
    function makeDraggable(marker, label) {
      var origin = null;
      function keepInside() {
        var latLng = marker.getLatLng();
        var inside = clampToImage(latLng);
        if (!inside.equals(latLng)) {
          marker.setLatLng(inside);
        }
      }
      marker.on("dragstart", function () {
        origin = pinLayer.toLatLng(map, label.x, label.y);
        marker.closePopup();
      });
      marker.on("drag", keepInside);
      marker.on("dragend", function () {
        keepInside();
        var relative = pinLayer.toRelative(map, marker.getLatLng());
        var back = origin;
        labelService.move(label.id, relative.x, relative.y).then(
          function () {
            label.x = relative.x;
            label.y = relative.y;
          },
          function (error) {
            if (destroyed) {
              return;
            }
            console.error("[label-layer] No se pudo mover el texto:", error);
            notice.show("No se pudo mover el texto.", { type: "error" });
            marker.setLatLng(back);
          }
        );
      });
    }

    // Registra un texto y lo pinta.
    function add(label) {
      labels[label.id] = label;
      return show(label);
    }

    function show(label) {
      var marker = L.marker(pinLayer.toLatLng(map, label.x, label.y), {
        icon: divIcon(label),
        keyboard: false,
        draggable: true,
        autoPan: false,
      });
      var popup = L.popup({
        className: "pin-popup label-popup",
        maxWidth: 220,
        minWidth: 160,
        autoPanPadding: [24, 24],
      }).setContent(popupContent(label));
      popups[label.id] = popup;
      if (!placeHandler) {
        marker.bindPopup(popup);
      }
      // En los modos de añadir, un clic sin arrastre cuenta como clic en el mapa, en el punto exacto.
      marker.on("click", function (event) {
        if (placeHandler) {
          placeHandler(leafletMap.mouseEventToLatLng(event.originalEvent));
        }
      });
      // Tooltip con la nota (SPEC 11), solo si tiene. Un nodo de texto: Leaflet trata los strings
      // como HTML. Con el popup abierto, sobra (sale en el mismo sitio).
      if (label.note && label.note.trim()) {
        marker.bindTooltip(el("span", "label-tooltip__note", label.note), {
          direction: "top",
          className: "pin-tooltip label-tooltip",
        });
        marker.on("tooltipopen", function () {
          if (marker.isPopupOpen()) {
            marker.closeTooltip();
          }
        });
      }
      marker.on("popupopen", function () {
        marker.closeTooltip();
        document.addEventListener("keydown", onKeyDown);
      });
      marker.on("popupclose", function () {
        document.removeEventListener("keydown", onKeyDown);
      });
      makeDraggable(marker, label);
      marker.addTo(leafletMap);
      savedLabels[label.id] = marker;
      return marker;
    }

    function load() {
      return labelService
        .listByMap(map.id)
        .then(function (labels) {
          if (destroyed) {
            return;
          }
          labels.forEach(add);
        })
        .catch(function (error) {
          if (destroyed) {
            return;
          }
          console.error("[label-layer] No se pudieron cargar los textos:", error);
          notice.show("No se pudieron cargar los textos.", { type: "error" });
        });
    }

    /**
     * Modos "añadir pin" y "añadir texto": con un handler, los textos guardados no abren popup y un
     * clic sin arrastre sobre ellos llama a handler(latLng); siguen pudiéndose arrastrar. null lo quita.
     */
    function setPlacing(handler) {
      placeHandler = handler || null;
      Object.keys(savedLabels).forEach(function (id) {
        var marker = savedLabels[id];
        if (placeHandler) {
          marker.closePopup();
          marker.unbindPopup();
        } else if (!marker.getPopup()) {
          marker.bindPopup(popups[id]);
        }
      });
    }

    // Quita el texto del mapa sin olvidarlo (sigue en `labels`).
    function unpaint(id) {
      var marker = savedLabels[id];
      if (!marker) {
        return;
      }
      delete savedLabels[id];
      delete popups[id];
      marker.remove(); // cierra también su popup
    }

    /**
     * Modo "editar texto" (SPEC 11): quita el texto del mapa mientras el borrador ocupa su lugar.
     * El texto sigue en memoria para devolverlo tal cual al cancelar.
     */
    function startEditing(id) {
      if (labels[id]) {
        unpaint(id);
      }
    }

    /**
     * Fin de la edición: vuelve a pintar el texto con los datos nuevos (label) o con los originales
     * (null). Los datos nuevos se copian sobre el mismo objeto: el popup y el arrastre lo comparten.
     */
    function stopEditing(id, label) {
      var current = labels[id];
      if (!current || destroyed) {
        return;
      }
      if (label) {
        Object.assign(current, label);
      }
      unpaint(id);
      show(current);
    }

    /**
     * Foco en el texto (SPEC 11).
     * @returns {boolean} false si no está pintado (en edición).
     */
    function focus(id) {
      var marker = savedLabels[id];
      var node = marker && marker.getElement();
      if (!node) {
        return false;
      }
      // Fuera del orden de tabulación (keyboard: false): -1 lo hace enfocable por código.
      node.setAttribute("tabindex", "-1");
      node.focus();
      return true;
    }

    function destroy() {
      destroyed = true;
      placeHandler = null;
      document.removeEventListener("keydown", onKeyDown);
      Object.keys(savedLabels).forEach(function (id) {
        savedLabels[id].remove();
      });
      savedLabels = {};
      popups = {};
      labels = {};
    }

    return {
      load: load,
      add: add,
      setPlacing: setPlacing,
      startEditing: startEditing,
      stopEditing: stopEditing,
      focus: focus,
      destroy: destroy,
    };
  }

  Waypoint.ui.labelLayer = {
    create: create,
    divIcon: divIcon,
  };
})(window.Waypoint);
