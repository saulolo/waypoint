/*
 * Arranque de Waypoint: db → router → vistas.
 * Solo arranca y conecta; no contiene lógica de negocio.
 */
(function (Waypoint) {
  "use strict";

  function startRouter(container) {
    Waypoint.core.router.start({
      library: function () {
        return Waypoint.ui.libraryView.mount(container);
      },
      viewer: function (params) {
        return Waypoint.ui.viewerView.mount(container, params);
      },
    });
  }

  function start() {
    var container = document.getElementById("app");

    Waypoint.data.db
      .open()
      .then(function () {
        Waypoint.data.db.requestPersistence().then(function (persisted) {
          console.info("[app] Almacenamiento persistente:", persisted);
        });
        startRouter(container);
      })
      .catch(function (error) {
        console.error("[app] No se pudo abrir IndexedDB:", error);
        Waypoint.ui.libraryView.mountUnavailable(container);
      });
  }

  document.addEventListener("DOMContentLoaded", start);
})(window.Waypoint);
