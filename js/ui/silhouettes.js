/*
 * Siluetas pixel decorativas del hero de la biblioteca (SPEC 02).
 * Copiadas tal cual de Arcade Vault (components/home/FloatingSilhouettes.tsx).
 *
 *   container.appendChild(Waypoint.ui.silhouettes.create());
 *
 * Los `fill` de los SVG son la única excepción a la regla de colores solo en css/tokens.css.
 * Posición, glow y animación `float` en css/effects.css.
 */
(function (Waypoint) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  // [clase, viewBox, fill del grupo, rects: [x, y, ancho, alto, fill propio?]]
  var SILHOUETTES = [
    // s1: invasor
    ["s1", "0 0 40 32", "#00f5ff", [
      [6, 4, 4, 4], [30, 4, 4, 4], [2, 8, 36, 4], [2, 12, 4, 4], [14, 12, 4, 4],
      [22, 12, 4, 4], [34, 12, 4, 4], [2, 16, 36, 4], [6, 20, 4, 4], [30, 20, 4, 4],
    ]],
    // s2: fantasma
    ["s2", "0 0 32 32", "#ff006e", [
      [8, 0, 16, 4], [4, 4, 24, 4], [0, 8, 32, 12], [0, 20, 6, 6], [10, 20, 4, 6],
      [18, 20, 4, 6], [26, 20, 6, 6],
    ]],
    // s3: calamar
    ["s3", "0 0 32 32", "#f5ff00", [
      [10, 0, 12, 4], [6, 4, 20, 4], [4, 8, 6, 6], [22, 8, 6, 6], [2, 14, 28, 10],
      [6, 24, 4, 4], [14, 24, 4, 4], [22, 24, 4, 4],
    ]],
    // s4: mira (el cuadrado central va sin relleno y con trazo)
    ["s4", "0 0 24 24", "#00ff88", [
      [10, 0, 4, 24], [0, 10, 24, 4],
    ]],
    // s5: platillo
    ["s5", "0 0 36 24", "#aa00ff", [
      [14, 2, 8, 4], [10, 6, 16, 4], [4, 10, 28, 4], [0, 14, 36, 4], [6, 18, 4, 2],
      [16, 18, 4, 2], [26, 18, 4, 2],
    ]],
    // s6: moneda
    ["s6", "0 0 20 20", "#ffcf3a", [
      [6, 0, 8, 2], [2, 2, 16, 2], [0, 4, 20, 12], [2, 16, 16, 2], [6, 18, 8, 2],
      [8, 4, 4, 12, "#0a0a0f"],
    ]],
    // s7: corazón
    ["s7", "0 0 24 22", "#ff3060", [
      [2, 2, 6, 2], [16, 2, 6, 2], [0, 4, 10, 4], [14, 4, 10, 4], [0, 8, 24, 4],
      [2, 12, 20, 2], [4, 14, 16, 2], [6, 16, 12, 2], [8, 18, 8, 2], [10, 20, 4, 2],
    ]],
    // s8: cruceta
    ["s8", "0 0 24 24", "#00d4ff", [
      [8, 2, 8, 6], [2, 8, 20, 8], [8, 16, 8, 6], [11, 6, 2, 2, "#0a0a0f"],
      [11, 16, 2, 2, "#0a0a0f"], [4, 11, 2, 2, "#0a0a0f"], [18, 11, 2, 2, "#0a0a0f"],
    ]],
  ];

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (name) {
      node.setAttribute(name, attrs[name]);
    });
    return node;
  }

  function createSilhouette(spec) {
    var svg = svgEl("svg", { class: "silhouette " + spec[0], viewBox: spec[1] });
    var group = svgEl("g", { fill: spec[2] });

    spec[3].forEach(function (r) {
      var attrs = { x: r[0], y: r[1], width: r[2], height: r[3] };
      if (r[4]) {
        attrs.fill = r[4];
      }
      group.appendChild(svgEl("rect", attrs));
    });

    if (spec[0] === "s4") {
      group.appendChild(
        svgEl("rect", { x: 6, y: 6, width: 12, height: 12, fill: "none", stroke: "#00ff88", "stroke-width": 2 })
      );
    }

    svg.appendChild(group);
    return svg;
  }

  /**
   * Crea el contenedor decorativo con las ocho siluetas.
   * @returns {HTMLElement}
   */
  function create() {
    var container = document.createElement("div");
    container.className = "silhouettes";
    container.setAttribute("aria-hidden", "true");
    SILHOUETTES.forEach(function (spec) {
      container.appendChild(createSilhouette(spec));
    });
    return container;
  }

  Waypoint.ui.silhouettes = { create: create };
})(window.Waypoint);
