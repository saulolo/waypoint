/*
 * Diálogo de juego: "Crear juego" (nombre + portada) y "Cambiar portada" (solo portada).
 *
 *   Waypoint.ui.gameDialog.open({ mode: "create" })
 *   Waypoint.ui.gameDialog.open({ mode: "cover", cover: blobActual })
 *     .then(function (result) { ... });   // { name, cover } o null si se cancela
 *
 * La portada puede venir del selector de archivos, de arrastrar una imagen sobre el diálogo
 * o de pegarla con Ctrl+V. Se valida con image-service y se muestra una vista previa antes de
 * guardar. `cover` es el archivo elegido (el servicio lo reduce a WebP), el Blob actual si no
 * se cambió, o null si no hay portada.
 * Esc o clic fuera del cuadro cancelan sin cambios.
 */
(function (Waypoint) {
  "use strict";

  var dialog = Waypoint.ui.dialog;
  var notice = Waypoint.ui.notice;
  var imageService = Waypoint.services.imageService;
  var gameService = Waypoint.services.gameService;

  var ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
  var idCounter = 0;

  var CLIPBOARD_MESSAGE = "El portapapeles no tiene una imagen: usa «Copiar imagen» en el navegador";

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

  function hasFiles(event) {
    var types = event.dataTransfer && event.dataTransfer.types;
    return !!types && Array.prototype.indexOf.call(types, "Files") !== -1;
  }

  /**
   * @param {{mode?: "create"|"cover", name?: string, cover?: Blob|null}} options
   * @returns {Promise<{name: string, cover: Blob|null}|null>}
   */
  function open(options) {
    options = options || {};
    var isCreate = options.mode !== "cover";
    var cover = options.cover || null;
    var previewUrl = null;
    var token = 0; // descarta validaciones antiguas si el usuario elige otra imagen
    var id = "wp-game-dialog-" + ++idCounter;

    var body = el("div", "game-dialog");

    // ---------- Nombre (solo al crear) ----------
    var input = null;
    var field = null;
    if (isCreate) {
      field = el("div", "dialog__field");
      var label = el("label", "dialog__label", "Nombre");
      label.htmlFor = id + "-name";
      input = el("input", "dialog__input");
      input.id = id + "-name";
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.maxLength = gameService.NAME_MAX_LENGTH;
      input.required = true;
      input.value = options.name || "";
      var hint = el("p", "dialog__hint", "El nombre no puede estar vacío.");
      hint.id = id + "-hint";
      input.setAttribute("aria-describedby", hint.id);
      field.appendChild(label);
      field.appendChild(input);
      field.appendChild(hint);
      body.appendChild(field);
    }

    // ---------- Zona de portada ----------
    var zone = el("div", "cover-zone");
    var preview = el("div", "cover-zone__preview");
    var zoneText = el("p", "cover-zone__hint", "Suelta una imagen aquí, pégala con Ctrl+V o elige un archivo (JPG, PNG o WebP)");
    var zoneActions = el("div", "cover-zone__actions");

    var pickButton = el("button", "btn btn--ghost", "Elegir imagen");
    pickButton.type = "button";
    var removeButton = el("button", "btn btn--ghost", "Quitar");
    removeButton.type = "button";

    var fileInput = el("input", "visually-hidden");
    fileInput.type = "file";
    fileInput.accept = ACCEPT;
    fileInput.tabIndex = -1;
    fileInput.setAttribute("aria-hidden", "true");

    zoneActions.appendChild(pickButton);
    zoneActions.appendChild(removeButton);
    zone.appendChild(preview);
    zone.appendChild(zoneText);
    zone.appendChild(zoneActions);
    zone.appendChild(fileInput);
    body.appendChild(zone);

    var ui = dialog.open({
      title: isCreate ? "Crear juego" : "Cambiar portada",
      content: body,
      confirmLabel: isCreate ? "Crear" : "Guardar",
    });

    // ---------- Vista previa ----------

    function revokePreview() {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
    }

    function renderPreview() {
      revokePreview();
      preview.innerHTML = "";
      zone.classList.toggle("cover-zone--filled", !!cover);
      removeButton.hidden = !cover;
      pickButton.textContent = cover ? "Cambiar imagen" : "Elegir imagen";

      if (cover) {
        previewUrl = URL.createObjectURL(cover);
        var img = el("img", "cover-zone__img");
        img.src = previewUrl;
        img.alt = "Vista previa de la portada";
        preview.appendChild(img);
      } else {
        var empty = el("div", "game-placeholder", "?");
        empty.setAttribute("aria-hidden", "true");
        preview.appendChild(empty);
      }
    }

    /** Valida la imagen y, si es buena, la pone como portada. Si no, avisa y deja todo igual. */
    function setCover(blob) {
      var current = ++token;
      var file = blob.name ? blob : new File([blob], "portada", { type: blob.type });
      return imageService
        .inspect(file)
        .then(function () {
          if (current === token) {
            cover = file;
            renderPreview();
          }
        })
        .catch(function (error) {
          if (current !== token) {
            return;
          }
          if (error instanceof imageService.InvalidImageError) {
            var message =
              error.reason === "unsupported-type"
                ? "Formato no admitido (solo JPG, PNG y WebP)"
                : "No se pudo leer la imagen";
            notice.show(message + ": " + file.name, { type: "warning", duration: 6000 });
          } else {
            console.error("[game-dialog] Error al validar la portada:", error);
            notice.show("No se pudo usar esa imagen como portada.", { type: "error" });
          }
        });
    }

    pickButton.addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = ""; // permite volver a elegir el mismo archivo
      if (file) {
        setCover(file);
      }
    });
    removeButton.addEventListener("click", function () {
      token++;
      cover = null;
      renderPreview();
    });

    // ---------- Arrastrar y soltar ----------
    // Se escucha en todo el diálogo para que soltar fuera de la zona tampoco abra la imagen.
    // stopPropagation evita que el aviso de la vista de fondo ("Entra en un juego…") se dispare.

    ui.dialog.addEventListener("dragover", function (event) {
      if (hasFiles(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        zone.classList.add("cover-zone--dragging");
      }
    });
    ui.dialog.addEventListener("dragleave", function (event) {
      if (hasFiles(event) && !ui.dialog.contains(event.relatedTarget)) {
        zone.classList.remove("cover-zone--dragging");
      }
    });
    ui.dialog.addEventListener("drop", function (event) {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove("cover-zone--dragging");
      var file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) {
        setCover(file);
      }
    });

    // ---------- Pegar (Ctrl+V) ----------

    function onPaste(event) {
      var data = event.clipboardData;
      var items = data ? Array.prototype.slice.call(data.items || []) : [];
      var imageItem = items.filter(function (item) {
        return item.kind === "file" && item.type.indexOf("image/") === 0;
      })[0];

      if (imageItem) {
        var blob = imageItem.getAsFile();
        if (blob) {
          event.preventDefault();
          setCover(blob);
          return;
        }
      }

      // Texto pegado en el campo de nombre: es un pegado normal, no un intento de portada.
      var hasText = items.some(function (item) {
        return item.kind === "string" && item.type === "text/plain";
      });
      if (event.target === input && hasText) {
        return;
      }

      event.preventDefault();
      notice.show(CLIPBOARD_MESSAGE, { type: "warning", duration: 6000 });
    }

    document.addEventListener("paste", onPaste);

    // ---------- Validación del nombre ----------

    function isValid() {
      return !isCreate || input.value.trim().length > 0;
    }

    function updateState() {
      var valid = isValid();
      ui.confirmButton.disabled = !valid;
      if (isCreate) {
        input.setAttribute("aria-invalid", String(!valid));
        field.classList.toggle("dialog__field--invalid", !valid);
      }
    }

    if (isCreate) {
      input.addEventListener("input", updateState);
    }

    ui.form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (isValid()) {
        ui.dialog.close("confirm");
      } else if (input) {
        input.focus();
      }
    });

    renderPreview();
    updateState();
    if (isCreate) {
      input.focus();
    } else {
      pickButton.focus();
    }

    return ui.closed.then(function (value) {
      token++;
      document.removeEventListener("paste", onPaste);
      revokePreview();
      if (value !== "confirm") {
        return null;
      }
      return { name: isCreate ? input.value.trim() : options.name || "", cover: cover };
    });
  }

  Waypoint.ui.gameDialog = { open: open };
})(window.Waypoint);
