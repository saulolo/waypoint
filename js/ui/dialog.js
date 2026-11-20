/*
 * Diálogos propios con <dialog>: renombrar y confirmar.
 * Esc o clic fuera del cuadro cierran sin cambios.
 *
 *   Waypoint.ui.dialog.rename({ title: "Renombrar mapa", value: "Lapis", maxLength: 100 })
 *     .then(function (name) { ... });   // string sin espacios en los extremos, o null si se cancela
 *
 *   Waypoint.ui.dialog.confirm({ title: "¿Borrar?", message: "...", confirmLabel: "Borrar", danger: true })
 *     .then(function (ok) { ... });     // true / false
 */
(function (Waypoint) {
  "use strict";

  var idCounter = 0;

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

  function button(label, className, value) {
    var node = el("button", "btn " + className, label);
    node.type = value === "cancel" ? "button" : "submit";
    node.value = value;
    return node;
  }

  /**
   * Crea un <dialog> modal con título, contenido y botones, y lo abre.
   * @returns {{dialog: HTMLDialogElement, form: HTMLFormElement, closed: Promise<string>}}
   *   closed se resuelve con el returnValue ("" si se canceló).
   */
  function openDialog(options) {
    var id = "wp-dialog-" + ++idCounter;

    var dialog = el("dialog", "dialog");
    dialog.setAttribute("aria-labelledby", id + "-title");

    var form = el("form", "dialog__form");
    form.method = "dialog";
    form.noValidate = true;

    var title = el("h2", "dialog__title", options.title);
    title.id = id + "-title";

    var body = el("div", "dialog__body");
    if (options.message) {
      var message = el("p", "dialog__message", options.message);
      message.id = id + "-message";
      dialog.setAttribute("aria-describedby", message.id);
      body.appendChild(message);
    }
    if (options.content) {
      body.appendChild(options.content);
    }

    var actions = el("div", "dialog__actions");
    var cancel = button(options.cancelLabel || "Cancelar", "btn--ghost", "cancel");
    var confirm = button(options.confirmLabel || "Aceptar", options.danger ? "btn--danger" : "btn--primary", "confirm");
    actions.appendChild(cancel);
    actions.appendChild(confirm);

    form.appendChild(title);
    form.appendChild(body);
    form.appendChild(actions);
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    cancel.addEventListener("click", function () {
      dialog.close("");
    });

    // Clic en el fondo (fuera del cuadro): cancelar.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close("");
      }
    });

    var closed = new Promise(function (resolve) {
      dialog.addEventListener("close", function () {
        var value = dialog.returnValue;
        dialog.remove();
        resolve(value);
      });
    });

    dialog.returnValue = "";
    dialog.showModal();

    return { dialog: dialog, form: form, confirmButton: confirm, cancelButton: cancel, closed: closed };
  }

  /**
   * Diálogo de confirmar.
   * @param {{title: string, message?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean}} options
   * @returns {Promise<boolean>}
   */
  function confirm(options) {
    var ui = openDialog(options);
    // Foco en "Cancelar": la opción segura por defecto.
    ui.cancelButton.focus();
    return ui.closed.then(function (value) {
      return value === "confirm";
    });
  }

  /**
   * Diálogo de renombrar. No permite guardar un nombre vacío o solo con espacios.
   * @param {{title: string, value?: string, label?: string, maxLength?: number, confirmLabel?: string}} options
   * @returns {Promise<string|null>} El nombre sin espacios en los extremos, o null si se cancela.
   */
  function rename(options) {
    var inputId = "wp-dialog-input-" + ++idCounter;
    var maxLength = options.maxLength || 100;

    var field = el("div", "dialog__field");
    var label = el("label", "dialog__label", options.label || "Nombre");
    label.htmlFor = inputId;
    var input = el("input", "dialog__input");
    input.id = inputId;
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = maxLength;
    input.required = true;
    input.value = options.value || "";
    var hint = el("p", "dialog__hint", "El nombre no puede estar vacío.");
    hint.id = inputId + "-hint";
    input.setAttribute("aria-describedby", hint.id);

    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(hint);

    var ui = openDialog({
      title: options.title,
      content: field,
      confirmLabel: options.confirmLabel || "Guardar",
    });

    function isValid() {
      return input.value.trim().length > 0;
    }

    function updateState() {
      var valid = isValid();
      ui.confirmButton.disabled = !valid;
      input.setAttribute("aria-invalid", String(!valid));
      field.classList.toggle("dialog__field--invalid", !valid);
    }

    input.addEventListener("input", updateState);

    // Enter o "Guardar": solo cierra si el nombre es válido.
    ui.form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (isValid()) {
        ui.dialog.close("confirm");
      } else {
        input.focus();
      }
    });

    updateState();
    input.focus();
    input.select();

    return ui.closed.then(function (value) {
      return value === "confirm" ? input.value.trim() : null;
    });
  }

  Waypoint.ui.dialog = {
    confirm: confirm,
    rename: rename,
  };
})(window.Waypoint);
