/*
 * Visor de mapas a pantalla completa con Leaflet (CRS.Simple).
 *
 * La imagen ocupa los bounds [[0, 0], [height, width]]: 1 unidad = 1 px de la imagen a zoom 0.
 *   - Zoom mínimo: el de "mapa entero visible" (se recalcula al cambiar el tamaño de la ventana).
 *   - Zoom máximo: 2 (4× el tamaño real).
 *   - maxBounds = bounds de la imagen con viscosidad 1: no se puede sacar la imagen de la vista.
 * Al salir se destruye el mapa Leaflet y se revoca el object URL.
 *
 * Nunca accede a IndexedDB: todo pasa por Waypoint.services.mapService.
 */
(function (Waypoint) {
  "use strict";

  var mapService = Waypoint.services.mapService;
  var notice = Waypoint.ui.notice;
  var router = Waypoint.core.router;

  var MAX_ZOOM = 2; // 2^2 = 4× el tamaño real
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

    var root = el("section", "viewer");
    root.setAttribute("aria-label", "Visor de mapa");

    var bar = el("header", "viewer__bar");
    var back = el("a", "btn btn--ghost viewer__back", "← Biblioteca");
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

    function createLeafletMap(map, url) {
      var bounds = L.latLngBounds([0, 0], [map.height, map.width]);

      leafletMap = L.map(stage, {
        crs: L.CRS.Simple,
        attributionControl: false,
        zoomControl: false,
        zoomSnap: 0, // zoom continuo: el ajuste inicial es exacto
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 120,
        minZoom: UNBOUNDED_MIN_ZOOM, // se sustituye por el zoom de ajuste al crear el mapa
        maxZoom: MAX_ZOOM,
        maxBounds: bounds,
        maxBoundsViscosity: 1,
        bounceAtZoomLimits: false,
      });

      L.control.zoom({ position: "bottomright", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(leafletMap);

      var overlay = L.imageOverlay(url, bounds, { alt: map.name }).addTo(leafletMap);
      overlay.on("error", function () {
        notice.show("No se pudo mostrar la imagen del mapa.", { type: "error" });
      });

      // getBoundsZoom necesita que el mapa ya tenga una vista: se fija una provisional primero.
      leafletMap.setView(bounds.getCenter(), 0, { animate: false });
      var minZoom = fitZoom(bounds);
      leafletMap.setMinZoom(minZoom);
      leafletMap.setView(bounds.getCenter(), minZoom, { animate: false });

      // Al cambiar el tamaño de la ventana, el zoom mínimo sigue siendo "mapa entero visible".
      leafletMap.on("resize", function () {
        var newMin = fitZoom(bounds);
        leafletMap.setMinZoom(newMin);
        if (leafletMap.getZoom() < newMin) {
          leafletMap.setZoom(newMin, { animate: false });
        }
      });
    }

    function showMap(result) {
      var map = result.map;
      title.textContent = map.name;
      title.title = map.name;
      document.title = map.name + " · " + APP_TITLE;

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
        router.replaceWithLibrary();
      });

    return function unmount() {
      alive = false;
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
