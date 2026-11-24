/*
 * Panel de progreso del visor (SPEC 12): HUD arcade arriba a la derecha con los pines encontrados
 * sobre el total del mapa abierto y de todo su juego.
 *
 *   var hud = Waypoint.ui.progressHud.create({ onToggleFilter });
 *   root.appendChild(hud.el);  // hermano de .viewer__stage: la rueda y el arrastre no llegan al mapa
 *   hud.setMap({ total, found }, { live });  // cifra, porcentaje y barra de 20 bloques del mapa;
 *                                  // live: cambio en vivo (no la carga), para el flicker de COMPLETADO
 *   hud.setGame({ total, found } | null);  // lo mismo para todo el juego; null → "—" (no disponible)
 *   hud.setFilters({ pending, found });  // true = ese tipo de pin se ve (aria-pressed, sin raya)
 *   hud.setFiltersEnabled(b);      // los filtros, deshabilitados hasta que los pines estén cargados
 *   hud.destroy();                 // lo quita del DOM
 *
 * Plegado al crearlo (SPEC 12, enmienda; el estado no se guarda). El botón .viewer__progress-toggle lo
 * pliega a una píldora con la cifra del mapa ("12/40"); el cuerpo queda `hidden`. Pulsar la
 * píldora (es el mismo botón) lo despliega.
 *
 * Filtros de SPEC 09: "Pendientes N" y "Encontrados N" (N del mapa, sin mirar los
 * filtros). Pulsarlos llama a onToggleFilter("pending" | "found"); el visor guarda el estado y lo
 * devuelve con setFilters. Desde la enmienda de SPEC 12 son los únicos botones de filtro del visor.
 *
 * Estados de la línea del mapa: sin pines → "Sin pines" en lugar del porcentaje y la línea atenuada;
 * todos encontrados → "COMPLETADO" en neón verde. Si se llega a él marcando un pin en vivo
 * (sube `found`), lleva además un `.flicker` breve, una vez; al abrir un mapa ya completo, fijo.
 *
 * Bloques encendidos: floor(found / total × 20); porcentaje: floor(found / total × 100).
 * Con total 0, ninguno y 0 %. Solo presentación: las cifras se las da el visor.
 */
(function (Waypoint) {
  "use strict";

  var SEGMENTS = 20; // cada bloque vale 5 %
  var SVG_NS = "http://www.w3.org/2000/svg";

  // Iconos de los filtros de pines (SPEC 09), los que tenía el panel lateral:
  // Pendientes = chincheta de mapa; Encontrados = círculo con check. La raya marca "ocultos".
  var FILTER_ICONS = {
    pending: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    found: '<circle cx="12" cy="12" r="10"/><path d="M8 12.5l3 3 5-6"/>',
  };
  var FILTER_LABELS = { pending: "Pendientes", found: "Encontrados" };

  /**
   * SVG del icono de un filtro, con la raya (oculta o no según el estado) en la clase indicada.
   * @param {"pending"|"found"} key
   * @param {string} slashClass
   * @param {number} [size=22]
   */
  function filterIconSvg(key, slashClass, size) {
    var px = String(size || 22);
    return (
      '<svg viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      FILTER_ICONS[key] +
      '<path class="' + slashClass + '" d="M3 3l18 18"/></svg>'
    );
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

  function chevronIcon() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "viewer__progress-chevron");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M2 9.5 7 4.5 12 9.5"); // hacia arriba: plegar
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    svg.appendChild(path);
    return svg;
  }

  function ratio(counts, steps) {
    return counts.total > 0 ? Math.floor((counts.found / counts.total) * steps) : 0;
  }

  /**
   * Línea de progreso: etiqueta, cifra, porcentaje y barra segmentada.
   * @param {string} className  viewer__progress-map | viewer__progress-game
   * @param {string} label      "Mapa" | "Juego"
   */
  function createLine(className, label) {
    var line = el("div", "viewer__progress-line " + className);
    var row = el("div", "viewer__progress-row");
    var labelNode = el("span", "viewer__progress-label", label);
    var count = el("span", "viewer__progress-count");
    var pct = el("span", "viewer__progress-pct");
    row.appendChild(labelNode);
    row.appendChild(count);
    row.appendChild(pct);

    var bar = el("div", "viewer__progress-bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", label);
    bar.setAttribute("aria-valuemin", "0");
    var segments = [];
    for (var i = 0; i < SEGMENTS; i += 1) {
      var seg = el("span", "viewer__progress-seg");
      segments.push(seg);
      bar.appendChild(seg);
    }
    line.appendChild(row);
    line.appendChild(bar);

    function render(counts) {
      if (!counts) {
        // No disponible: "—", barra apagada y sin valor actual.
        count.textContent = "—";
        pct.textContent = "";
        segments.forEach(function (seg) {
          seg.classList.remove("is-on");
        });
        bar.removeAttribute("aria-valuenow");
        bar.removeAttribute("aria-valuemax");
        bar.setAttribute("aria-valuetext", "No disponible");
        return;
      }
      count.textContent = counts.found + " / " + counts.total;
      pct.textContent = ratio(counts, 100) + " %";
      var on = ratio(counts, SEGMENTS);
      segments.forEach(function (seg, index) {
        seg.classList.toggle("is-on", index < on);
      });
      bar.setAttribute("aria-valuemax", String(counts.total));
      bar.setAttribute("aria-valuenow", String(counts.found));
      bar.setAttribute("aria-valuetext", counts.found + " de " + counts.total + " encontrados");
    }

    return { el: line, pct: pct, render: render };
  }

  /**
   * @param {{ onToggleFilter?: function("pending" | "found") }} [options]
   */
  function create(options) {
    options = options || {};
    var expanded = false; // plegado al montar (SPEC 12, enmienda); no se guarda
    var mapCounts = { total: 0, found: 0 };

    var root = el("section", "viewer__progress");
    root.setAttribute("aria-label", "Progreso");

    var head = el("div", "viewer__progress-head");
    var title = el("h2", "viewer__progress-title", "Progreso");
    var toggle = el("button", "viewer__progress-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-controls", "viewer-progress-body");
    var pill = el("span", "viewer__progress-pill"); // cifra del mapa, solo visible plegado
    toggle.appendChild(pill);
    toggle.appendChild(chevronIcon());
    head.appendChild(title);
    head.appendChild(toggle);

    var body = el("div", "viewer__progress-body");
    body.id = "viewer-progress-body";
    var mapLine = createLine("viewer__progress-map", "Mapa");
    var gameLine = createLine("viewer__progress-game", "Juego");
    body.appendChild(mapLine.el);
    body.appendChild(gameLine.el);

    // Filtros de pines (SPEC 09), bajo las barras.
    var filterGroup = el("div", "viewer__progress-filter");
    filterGroup.setAttribute("role", "group");
    filterGroup.setAttribute("aria-label", "Pines visibles");
    var filterButtons = {};
    var filterCounts = {};
    ["pending", "found"].forEach(function (key) {
      var button = el("button", "viewer__progress-filter-btn");
      button.type = "button";
      button.disabled = true; // hasta que los pines estén cargados
      button.dataset.filter = key;
      button.innerHTML = filterIconSvg(key, "viewer__progress-filter-slash", 16);
      button.appendChild(el("span", "viewer__progress-filter-text", FILTER_LABELS[key]));
      filterCounts[key] = el("span", "viewer__progress-filter-count");
      button.appendChild(filterCounts[key]);
      button.addEventListener("click", function () {
        if (options.onToggleFilter) {
          options.onToggleFilter(key);
        }
      });
      filterButtons[key] = button;
      filterGroup.appendChild(button);
    });
    body.appendChild(filterGroup);

    root.appendChild(head);
    root.appendChild(body);

    function renderExpanded() {
      root.classList.toggle("viewer__progress--collapsed", !expanded);
      body.hidden = !expanded;
      title.hidden = !expanded;
      pill.hidden = expanded;
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-label", expanded ? "Plegar progreso" : "Desplegar progreso");
    }

    // Clic, Enter y Espacio: es un <button>.
    toggle.addEventListener("click", function () {
      expanded = !expanded;
      renderExpanded();
    });

    function isComplete(counts) {
      return counts.total > 0 && counts.found === counts.total;
    }

    /**
     * @param {{total, found}} counts
     * @param {{live?: boolean}} [opts]  live: cambio en vivo tras la carga (marcar, crear, borrar).
     */
    function setMap(counts, opts) {
      var previous = mapCounts;
      mapCounts = { total: counts.total, found: counts.found };
      mapLine.render(mapCounts);

      var pct = mapLine.pct;
      var empty = mapCounts.total === 0;
      var complete = isComplete(mapCounts);
      mapLine.el.classList.toggle("viewer__progress-line--empty", empty);
      if (empty) {
        pct.textContent = "Sin pines";
      }
      if (complete) {
        pct.textContent = "COMPLETADO";
        // Flicker solo al llegar marcando (sube found), no al cargar ni al borrar el último pendiente.
        var reached =
          opts && opts.live === true && !isComplete(previous) && mapCounts.found > previous.found;
        if (reached) {
          pct.classList.add("flicker");
        }
      } else {
        pct.classList.remove("flicker");
      }
      pct.classList.toggle("neon-green", complete);
      pct.classList.toggle("viewer__progress-pct--complete", complete);
      pill.textContent = mapCounts.found + "/" + mapCounts.total;
      filterCounts.pending.textContent = String(mapCounts.total - mapCounts.found);
      filterCounts.found.textContent = String(mapCounts.found);
    }

    /** @param {{pending: boolean, found: boolean}} visible  true = se ven (aria-pressed="true", sin raya). */
    function setFilters(visible) {
      Object.keys(filterButtons).forEach(function (key) {
        var on = visible[key] === true;
        var button = filterButtons[key];
        button.setAttribute("aria-pressed", on ? "true" : "false");
        // toggleAttribute: los SVG no tienen la propiedad `hidden`; el CSS global [hidden] sí aplica.
        button.querySelector(".viewer__progress-filter-slash").toggleAttribute("hidden", on);
      });
    }

    function setFiltersEnabled(enabled) {
      Object.keys(filterButtons).forEach(function (key) {
        filterButtons[key].disabled = !enabled;
      });
    }

    /** @param {{total, found}|null} counts  null: no se pudo leer el juego. */
    function setGame(counts) {
      gameLine.render(counts ? { total: counts.total, found: counts.found } : null);
    }

    function destroy() {
      root.remove();
    }

    renderExpanded();
    setMap(mapCounts);
    setGame(null); // hasta que llegue la cifra del juego
    setFilters({ pending: true, found: true });

    return {
      el: root,
      setMap: setMap,
      setGame: setGame,
      setFilters: setFilters,
      setFiltersEnabled: setFiltersEnabled,
      destroy: destroy,
    };
  }

  Waypoint.ui.progressHud = { create: create };
})(window.Waypoint);
