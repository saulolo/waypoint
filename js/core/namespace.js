/*
 * Namespace global de Waypoint.
 * Sin ES modules (no cargan con file://): cada script clásico registra su API aquí.
 * Capas: ui → services → data. Nunca al revés.
 */
(function () {
  "use strict";

  window.Waypoint = window.Waypoint || {
    core: {},
    data: {},
    services: {},
    ui: {},
  };
})();
