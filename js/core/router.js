/*
 * Router por hash.
 *   #/            → biblioteca
 *   #/map/<id>    → visor
 * Cualquier otro hash redirige a #/.
 *
 * Cada handler recibe (params) y puede devolver una función de limpieza,
 * que el router llama antes de entrar en la siguiente ruta.
 */
(function (Waypoint) {
  "use strict";

  var ROUTES = [
    { name: "library", pattern: /^#\/?$/ },
    { name: "viewer", pattern: /^#\/map\/([^/]+)\/?$/ },
  ];

  var handlers = {};
  var cleanup = null;

  function parse(hash) {
    for (var i = 0; i < ROUTES.length; i++) {
      var match = ROUTES[i].pattern.exec(hash);
      if (match) {
        var params = {};
        if (ROUTES[i].name === "viewer") {
          params.id = decodeURIComponent(match[1]);
        }
        return { name: ROUTES[i].name, params: params };
      }
    }
    return null;
  }

  function runCleanup() {
    if (typeof cleanup === "function") {
      try {
        cleanup();
      } catch (error) {
        console.error("[router] Error al salir de la vista:", error);
      }
    }
    cleanup = null;
  }

  function resolve() {
    var route = parse(window.location.hash || "#/");

    if (!route) {
      // Ruta desconocida: volver a la biblioteca sin dejar entrada en el historial.
      window.location.replace("#/");
      return;
    }

    runCleanup();

    var handler = handlers[route.name];
    if (handler) {
      cleanup = handler(route.params) || null;
    }
  }

  /**
   * Arranca el router.
   * @param {{ library: function(object): (function|void), viewer: function({id: string}): (function|void) }} routeHandlers
   */
  function start(routeHandlers) {
    handlers = routeHandlers || {};
    window.addEventListener("hashchange", resolve);
    resolve();
  }

  function goToLibrary() {
    window.location.hash = "#/";
  }

  function goToMap(id) {
    window.location.hash = "#/map/" + encodeURIComponent(id);
  }

  /** Sustituye la entrada actual del historial (no deja rastro para el botón atrás). */
  function replaceWithLibrary() {
    window.location.replace("#/");
  }

  Waypoint.core.router = {
    start: start,
    goToLibrary: goToLibrary,
    goToMap: goToMap,
    replaceWithLibrary: replaceWithLibrary,
  };
})(window.Waypoint);
