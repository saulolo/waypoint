/*
 * Router por hash.
 *   #/            → inicio (juegos)
 *   #/game/<id>   → vista de juego (sus mapas)
 *   #/map/<id>    → visor
 * Cualquier otro hash redirige a #/.
 *
 * Cada handler recibe (params) y puede devolver una función de limpieza,
 * que el router llama antes de entrar en la siguiente ruta.
 */
(function (Waypoint) {
  "use strict";

  var ROUTES = [
    { name: "games", pattern: /^#\/?$/ },
    { name: "game", pattern: /^#\/game\/([^/]+)\/?$/ },
    { name: "viewer", pattern: /^#\/map\/([^/]+)\/?$/ },
  ];

  var handlers = {};
  var cleanup = null;

  function parse(hash) {
    for (var i = 0; i < ROUTES.length; i++) {
      var match = ROUTES[i].pattern.exec(hash);
      if (match) {
        var params = {};
        if (ROUTES[i].name !== "games") {
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
      // Ruta desconocida: volver al inicio sin dejar entrada en el historial.
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
   * @param {{ games: function(object): (function|void), game: function({id: string}): (function|void), viewer: function({id: string}): (function|void) }} routeHandlers
   */
  function start(routeHandlers) {
    handlers = routeHandlers || {};
    window.addEventListener("hashchange", resolve);
    resolve();
  }

  function goToGames() {
    window.location.hash = "#/";
  }

  function goToGame(id) {
    window.location.hash = "#/game/" + encodeURIComponent(id);
  }

  function goToMap(id) {
    window.location.hash = "#/map/" + encodeURIComponent(id);
  }

  /** Sustituye la entrada actual del historial (no deja rastro para el botón atrás). */
  function replaceWithGames() {
    window.location.replace("#/");
  }

  Waypoint.core.router = {
    start: start,
    goToGames: goToGames,
    goToGame: goToGame,
    goToMap: goToMap,
    replaceWithGames: replaceWithGames,
  };
})(window.Waypoint);
