/*
 * Zoom de rueda continuo para el visor (sustituye a scrollWheelZoom de Leaflet).
 *
 *   var detach = Waypoint.ui.wheelZoom.attach(leafletMap, { maxZoom: 2, bounds: imageBounds, minVisiblePx: 100 });
 *   detach(); // al desmontar: quita el listener y cancela la animación
 *
 * Cada evento `wheel` suma −deltaY × ZOOM_PER_WHEEL_PX a un zoom destino, limitado a
 * [minZoom vigente, maxZoom]. Un bucle requestAnimationFrame acerca el zoom al destino con
 * interpolación exponencial, manteniendo bajo el cursor el punto de la imagen que había debajo.
 * En cada fotograma la vista se limita igual que el arrastre del visor: en cada eje quedan al
 * menos minVisiblePx de imagen dentro de la vista. En el eje limitado
 * el ancla se cancela: el punto de imagen anclado pasa a ser el que queda bajo el cursor.
 * El punto anclado se guarda en coordenadas del mapa y se recalcula desde el centro sin
 * redondear: medirlo en cada fotograma con containerPointToLatLng acumularía el redondeo de
 * Leaflet (hasta 0,5 px por fotograma).
 *
 * Touchpad: el desplazamiento a dos dedos y el pellizco (wheel con ctrlKey) usan el mismo cálculo
 * por deltaY; el preventDefault del pellizco evita que el navegador escale la página.
 * deltaMode 1 (líneas) se pasa a px con WHEEL_LINE_PX; deltaMode 2 (páginas), con el alto del mapa.
 * Con prefers-reduced-motion: reduce (consultado en cada evento) el zoom salta al destino.
 *
 * Los fotogramas mueven la vista con _move (sin viewreset ni animación); zoomstart/movestart
 * se disparan al empezar y zoomend/moveend solo al llegar al destino.
 */
(function (Waypoint) {
  "use strict";

  var ZOOM_PER_WHEEL_PX = 1 / 300; // 300 px de deltaY = 1 nivel: un clic de rueda (100 px) = 1/3 de nivel
  var WHEEL_LINE_PX = 40; // deltaMode 1 (líneas) → px
  var WHEEL_SMOOTH_MS = 45; // constante de tiempo de la interpolación (60 no asentaba en 400 ms)
  var WHEEL_SETTLE_EPSILON = 0.001; // diferencia con el destino por debajo de la cual se para

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // deltaY del evento en px, sea cual sea su deltaMode.
  function deltaPx(event, pageHeight) {
    if (event.deltaMode === 1) {
      return event.deltaY * WHEEL_LINE_PX;
    }
    if (event.deltaMode === 2) {
      return event.deltaY * pageHeight;
    }
    return event.deltaY;
  }

  /**
   * Registra el handler de rueda en el contenedor del mapa.
   * @param {L.Map} leafletMap
   * @param {{ maxZoom: number, bounds: L.LatLngBounds, minVisiblePx: number }} options
   *   bounds: los de la imagen; minVisiblePx: px de imagen que siempre quedan dentro, por eje
   * @returns {function} detach()
   */
  function attach(leafletMap, options) {
    var maxZoom = options.maxZoom;
    var bounds = options.bounds;
    var minVisiblePx = options.minVisiblePx;
    var container = leafletMap.getContainer();

    var wheelState = {
      targetZoom: leafletMap.getZoom(),
      anchor: L.point(0, 0),
      anchorLatLng: null, // punto de la imagen que debe quedarse bajo `anchor`
      frameId: null,
      lastTime: 0,
    };

    // Centro (en px proyectados a `zoom`) que deja el punto anclado bajo el cursor, limitado por eje.
    // Tras limitar, el punto anclado pasa a ser el que queda bajo el cursor (ancla cancelada en ese eje).
    function centerFor(zoom) {
      var half = leafletMap.getSize().divideBy(2);
      var anchor = wheelState.anchor;
      var center = leafletMap.project(wheelState.anchorLatLng, zoom).subtract(anchor).add(half);
      var image = L.bounds(leafletMap.project(bounds.getSouthWest(), zoom), leafletMap.project(bounds.getNorthEast(), zoom));
      // Al menos m px de imagen dentro de la vista: el centro va de (inicio − mitad + m) a (fin + mitad − m).
      var size = leafletMap.getSize();
      var mx = Math.min(minVisiblePx, image.max.x - image.min.x, size.x);
      var my = Math.min(minVisiblePx, image.max.y - image.min.y, size.y);
      center.x = clamp(center.x, image.min.x - half.x + mx, image.max.x + half.x - mx);
      center.y = clamp(center.y, image.min.y - half.y + my, image.max.y + half.y - my);
      wheelState.anchorLatLng = leafletMap.unproject(center.subtract(half).add(anchor), zoom);
      return leafletMap.unproject(center, zoom);
    }

    function moveTo(zoom) {
      leafletMap._move(centerFor(zoom), zoom);
    }

    function finish() {
      wheelState.frameId = null;
      leafletMap._moveEnd(true);
    }

    function frame(time) {
      var dt = Math.max(0, time - wheelState.lastTime);
      wheelState.lastTime = time;
      var zoom = leafletMap.getZoom();
      var diff = wheelState.targetZoom - zoom;
      if (Math.abs(diff) < WHEEL_SETTLE_EPSILON) {
        moveTo(wheelState.targetZoom);
        finish();
        return;
      }
      moveTo(zoom + diff * (1 - Math.exp(-dt / WHEEL_SMOOTH_MS)));
      wheelState.frameId = requestAnimationFrame(frame);
    }

    function onWheel(event) {
      event.preventDefault(); // también con ctrlKey (pellizco): evita el zoom de la página
      if (leafletMap._animatingZoom) {
        return; // hay una animación de Leaflet (botones o doble clic) en curso
      }

      var running = wheelState.frameId !== null;
      var base = running ? wheelState.targetZoom : leafletMap.getZoom();
      var delta = deltaPx(event, leafletMap.getSize().y);
      wheelState.targetZoom = clamp(base - delta * ZOOM_PER_WHEEL_PX, leafletMap.getMinZoom(), maxZoom);
      wheelState.anchor = leafletMap.mouseEventToContainerPoint(event);
      wheelState.anchorLatLng = leafletMap.containerPointToLatLng(wheelState.anchor);

      if (reducedMotion.matches) {
        // Sin interpolación: el destino se aplica en este mismo evento.
        if (running) {
          cancelAnimationFrame(wheelState.frameId);
        } else {
          leafletMap._stop();
          leafletMap._moveStart(true, false);
        }
        moveTo(wheelState.targetZoom);
        finish();
        return;
      }

      if (!running) {
        leafletMap._stop(); // corta un desplazamiento animado en curso
        leafletMap._moveStart(true, false);
        wheelState.lastTime = performance.now();
        wheelState.frameId = requestAnimationFrame(frame);
      }
    }

    container.addEventListener("wheel", onWheel, { passive: false });

    return function detach() {
      container.removeEventListener("wheel", onWheel, { passive: false });
      if (wheelState.frameId !== null) {
        cancelAnimationFrame(wheelState.frameId);
        wheelState.frameId = null;
      }
    };
  }

  Waypoint.ui.wheelZoom = { attach: attach };
})(window.Waypoint);
