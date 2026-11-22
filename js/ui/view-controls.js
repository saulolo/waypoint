/*
 * Controles del visor (SPEC 06): añadir pin (solo el botón; la acción llega con los marcadores,
 * SPEC 08), pantalla completa y un botón de escala que alterna entre tamaño real (1:1) y ajustar
 * a la ventana. Tres botones separados, cada uno en su propia caja.
 * Es un L.Control en la
 * esquina inferior derecha; viewer-view.js lo añade después del de zoom, porque en las esquinas
 * de abajo Leaflet apila el último añadido arriba.
 *
 * Son <button>. Los iconos son SVG inline con currentColor; "1:1" es texto en pixel.
 * El botón de escala ofrece la acción contraria a la vista actual: a tamaño real muestra el
 * icono de ajustar; en cualquier otro zoom muestra "1:1". Quien lo usa le dice en cuál está
 * con setActualSize(), no se decide aquí.
 * El control no hace nada por sí mismo: llama a los callbacks que recibe.
 *
 * No toca IndexedDB ni conoce el mapa: solo pinta y avisa.
 */
(function (Waypoint) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  var LABEL_ADD_PIN = "Añadir pin";
  var LABEL_FULLSCREEN_ENTER = "Pantalla completa";
  var LABEL_FULLSCREEN_EXIT = "Salir de pantalla completa";
  var LABEL_FIT = "Ajustar a la ventana";
  var LABEL_ACTUAL_SIZE = "Tamaño real (1:1)";

  // Cuatro esquinas hacia fuera (entrar) y hacia dentro (salir), en una rejilla de 16×16.
  var PATH_ENTER = "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4";
  var PATH_EXIT = "M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4";
  // Un recuadro con margen: "el mapa entero dentro de la ventana".
  var PATH_FIT = "M3 3h10v10H3z";

  // Pin de mapa con punto central y un "+" arriba a la derecha, en una rejilla de 24×24.
  var PATH_PIN = "M11 21S5 15.6 5 10.5a6 6 0 0 1 12 0C17 15.6 11 21 11 21zM9 10.5a2 2 0 1 0 4 0 2 2 0 1 0-4 0M19 2v6M16 5h6";

  function svgIcon(pathData, grid) {
    grid = grid || 16;
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + grid + " " + grid);
    svg.setAttribute("width", String(grid));
    svg.setAttribute("height", String(grid));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "square");
    svg.appendChild(path);
    return svg;
  }

  function button(label) {
    var node = document.createElement("button");
    node.type = "button";
    node.className = "view-controls__btn";
    node.setAttribute("aria-label", label);
    node.title = label;
    return node;
  }

  /**
   * Crea el control. Hay que añadirlo al mapa con control.addTo(map).
   * @param {{ onToggleFullscreen: function, onFit: function, onActualSize: function, onAddPin?: function }} handlers
   *   onAddPin es opcional: sin él, el botón de pin no hace nada (SPEC 08 lo conecta).
   * @returns {L.Control} con setFullscreen(isFullscreen)
   */
  function create(handlers) {
    var fullscreenBtn = null;
    var fullscreenIcon = null;
    var scaleBtn = null;
    var atActualSize = false; // la vista está a tamaño real: el botón ofrece ajustar

    // A tamaño real el botón ofrece ajustar (icono); si no, tamaño real (texto "1:1").
    function renderScale() {
      var label = atActualSize ? LABEL_FIT : LABEL_ACTUAL_SIZE;
      scaleBtn.setAttribute("aria-label", label);
      scaleBtn.title = label;
      scaleBtn.classList.toggle("view-controls__btn--text", !atActualSize);
      scaleBtn.textContent = "";
      if (atActualSize) {
        scaleBtn.appendChild(svgIcon(PATH_FIT));
      } else {
        scaleBtn.textContent = "1:1";
      }
    }

    var ViewControls = L.Control.extend({
      options: { position: "bottomright" },

      onAdd: function () {
        // Contenedor sin marco: cada botón va en su propia .leaflet-bar, separado de los demás.
        var bar = L.DomUtil.create("div", "view-controls");

        var pinBtn = button(LABEL_ADD_PIN);
        pinBtn.appendChild(svgIcon(PATH_PIN, 24));
        pinBtn.addEventListener("click", function () {
          if (handlers.onAddPin) {
            handlers.onAddPin();
          }
        });

        fullscreenBtn = button(LABEL_FULLSCREEN_ENTER);
        fullscreenIcon = svgIcon(PATH_ENTER);
        fullscreenBtn.appendChild(fullscreenIcon);

        scaleBtn = button(LABEL_ACTUAL_SIZE);
        renderScale();

        fullscreenBtn.addEventListener("click", function () {
          handlers.onToggleFullscreen();
        });
        scaleBtn.addEventListener("click", function () {
          if (atActualSize) {
            handlers.onFit();
          } else {
            handlers.onActualSize();
          }
        });

        [pinBtn, fullscreenBtn, scaleBtn].forEach(function (btn) {
          var block = L.DomUtil.create("div", "leaflet-bar view-controls__block", bar);
          block.appendChild(btn);
        });

        // Los clics y la rueda sobre el bloque no llegan al mapa.
        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.disableScrollPropagation(bar);
        return bar;
      },

      /** Indica si la vista está a tamaño real; cambia la forma y la acción del botón de escala. */
      setActualSize: function (isActualSize) {
        if (!scaleBtn || isActualSize === atActualSize) {
          return;
        }
        atActualSize = isActualSize;
        renderScale();
      },

      /** Cambia icono, aria-label y title del botón de pantalla completa. */
      setFullscreen: function (isFullscreen) {
        if (!fullscreenBtn) {
          return;
        }
        var label = isFullscreen ? LABEL_FULLSCREEN_EXIT : LABEL_FULLSCREEN_ENTER;
        fullscreenBtn.setAttribute("aria-label", label);
        fullscreenBtn.title = label;
        fullscreenIcon.firstChild.setAttribute("d", isFullscreen ? PATH_EXIT : PATH_ENTER);
      },
    });

    return new ViewControls();
  }

  Waypoint.ui.viewControls = { create: create };
})(window.Waypoint);
