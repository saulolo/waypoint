/*
 * Avisos no bloqueantes (toasts) que se cierran solos.
 *
 *   Waypoint.ui.notice.show("Mapa guardado", { type: "success" });
 *   Waypoint.ui.notice.show("Formato no admitido: notas.txt", { type: "warning", duration: 6000 });
 *
 * Tipos: "info" (por defecto), "success", "warning", "error".
 * Pasar el ratón por encima pausa el cierre automático.
 */
(function (Waypoint) {
  "use strict";

  var DEFAULT_DURATION_MS = 4000;
  var EXIT_ANIMATION_MS = 200;
  var TYPES = ["info", "success", "warning", "error"];

  var region = null;

  function getRegion() {
    if (region && document.body.contains(region)) {
      return region;
    }
    region = document.createElement("div");
    region.className = "notice-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
    return region;
  }

  /**
   * Muestra un aviso.
   * @param {string} message
   * @param {{type?: string, duration?: number}} [options]  duration en ms; 0 = no se cierra solo.
   * @returns {function} Función para cerrarlo antes de tiempo.
   */
  function show(message, options) {
    options = options || {};
    var type = TYPES.indexOf(options.type) !== -1 ? options.type : "info";
    var duration = typeof options.duration === "number" ? options.duration : DEFAULT_DURATION_MS;

    var notice = document.createElement("div");
    notice.className = "notice notice--" + type;
    if (type === "error") {
      notice.setAttribute("role", "alert");
    }

    var text = document.createElement("p");
    text.className = "notice__message";
    text.textContent = message;

    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "notice__close";
    closeButton.setAttribute("aria-label", "Cerrar aviso");
    closeButton.textContent = "×";

    notice.appendChild(text);
    notice.appendChild(closeButton);
    getRegion().appendChild(notice);

    var timer = null;
    var closed = false;

    function close() {
      if (closed) {
        return;
      }
      closed = true;
      clearTimeout(timer);
      notice.classList.add("notice--leaving");
      setTimeout(function () {
        notice.remove();
      }, EXIT_ANIMATION_MS);
    }

    function schedule() {
      if (duration > 0) {
        clearTimeout(timer);
        timer = setTimeout(close, duration);
      }
    }

    closeButton.addEventListener("click", close);
    notice.addEventListener("mouseenter", function () {
      clearTimeout(timer);
    });
    notice.addEventListener("mouseleave", schedule);

    schedule();
    return close;
  }

  Waypoint.ui.notice = { show: show };
})(window.Waypoint);
