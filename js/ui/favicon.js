/*
 * Favicon de la pestaña (SPEC 13): normal o "mapa completado" (pin verde).
 *
 *   Waypoint.ui.favicon.setComplete(true);  // href → img/favicon-complete.svg
 *   Waypoint.ui.favicon.setComplete(false); // href → img/favicon.svg
 *   Waypoint.ui.favicon.isComplete();       // → estado actual
 *
 * Cambia el href del <link id="app-favicon"> de index.html; si no existe, no hace nada.
 * Solo lo usa el visor; al desmontarse vuelve al normal.
 */
(function (Waypoint) {
  "use strict";

  var HREF_NORMAL = "img/favicon.svg";
  var HREF_COMPLETE = "img/favicon-complete.svg";

  var complete = false;

  function setComplete(value) {
    var next = !!value;
    if (next === complete) {
      return;
    }
    complete = next;
    var link = document.getElementById("app-favicon");
    if (link) {
      link.setAttribute("href", complete ? HREF_COMPLETE : HREF_NORMAL);
    }
  }

  function isComplete() {
    return complete;
  }

  Waypoint.ui.favicon = { setComplete: setComplete, isComplete: isComplete };
})(window.Waypoint);
