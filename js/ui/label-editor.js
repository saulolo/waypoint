/*
 * Modos "añadir texto" (SPEC 10) y "editar texto" (SPEC 11) del visor: panel de texto y texto borrador.
 *
 *   var close = Waypoint.ui.labelEditor.open({
 *     root,        // .viewer: el panel se cuelga de él, como hermano de .viewer__stage
 *     leafletMap,
 *     map,         // { id, gameId, width, height }
 *     freeLeft,    // () → px que tapa el panel izquierdo (0 si está contraído u oculto)
 *     labels,      // capa de textos guardados (labelLayer): modo colocar con setPlacing
 *     label,       // opcional (SPEC 11): texto guardado a editar → modo "editar texto"
 *     pins,        // capa de pines (pinLayer): solo al editar, también en modo colocar
 *     onSaved,     // (label) → el visor lo añade a la capa de textos guardados (o lo repinta al editar)
 *     onClose,     // (reason: "save" | "cancel" | "unmount") → el visor devuelve el foco
 *   });
 *   close();       // cancela sin avisar (desmontaje del visor)
 *
 * Panel no modal (aside.dialog, como .pin-editor): el mapa sigue usable a la vez. Va fuera del
 * contenedor de Leaflet: la rueda y el arrastre que empiezan en él no llegan al mapa.
 * Mientras está abierto, la raíz lleva .viewer--adding-label (oculta los controles de vista y + / −).
 *
 * El borrador es un L.Marker con el mismo divIcon que los textos guardados (labelLayer.divIcon).
 * Al abrir cae desde el borde superior del mapa hasta el centro de la zona libre (entre el panel
 * izquierdo, si se ve, y el panel de texto), dentro de la imagen; no busca hueco. Refleja en vivo
 * texto, color y tamaño (sin repetir la caída); con "Texto" vacío muestra "Texto", atenuado.
 * Se mueve arrastrándolo (sin mover el mapa) o con un clic simple en el mapa; nunca sale de la
 * imagen. Mientras tanto, los textos guardados no abren popup: un clic sin arrastre sobre ellos
 * cuenta como clic en el mapa, y arrastrarlos los mueve a ellos.
 *
 * El borrador empieza siempre con el estilo por defecto (labelService.DEFAULT_STYLE: Blanco, 12 px).
 *
 * "Guardar" (deshabilitado con "Texto" vacío o solo espacios) crea el texto, llama a onSaved(label)
 * para que el visor lo pinte como texto guardado y cierra. Si falla, avisa y panel y borrador siguen.
 *
 * Cancelar (botón, Esc o desmontaje) quita borrador, panel y listeners; no se guarda nada.
 *
 * Modo "editar texto" (SPEC 11, opción `label`): título "Editar texto", campos con los valores del
 * texto y el borrador en su sitio, con su estilo, sin caída. Los pines guardados también pasan a
 * modo colocar (al añadir no cambian). "Guardar" (deshabilitado con "Texto"
 * vacío) llama a labelService.update. Quitar el texto guardado del mapa y devolverlo al cerrar es
 * cosa del visor (labels.startEditing / stopEditing).
 * Nunca accede a IndexedDB.
 */
(function (Waypoint) {
  "use strict";

  var labelService = Waypoint.services.labelService;
  var labelLayer = Waypoint.ui.labelLayer;
  var pinLayer = Waypoint.ui.pinLayer;
  var COLOR_LABELS = Waypoint.ui.pinEditor.COLOR_LABELS;

  var PLACEHOLDER = "Texto";

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

  function open(options) {
    var root = options.root;
    var leafletMap = options.leafletMap;
    var map = options.map;
    var uid = ++idCounter;
    var closed = false;
    // Modo "editar texto" (SPEC 11): el texto guardado que se edita; null al añadir.
    var editing = options.label || null;

    // { marker: L.Marker, x, y, text, note, color, size } mientras se añade o se edita.
    var draft = null;

    /* ---------- Panel de texto ---------- */

    var panel = el("aside", "dialog label-editor");
    panel.setAttribute("aria-labelledby", "label-editor-title-" + uid);
    var body = el("div", "dialog__form label-editor__body");
    panel.appendChild(body);

    var heading = el("h2", "dialog__title label-editor__title", editing ? "Editar texto" : "Añadir texto");
    heading.id = "label-editor-title-" + uid;
    body.appendChild(heading);

    // Texto (obligatorio, una línea)
    var textField = el("div", "dialog__field");
    var textLabel = el("label", "dialog__label", "Texto");
    var textInput = el("input", "dialog__input label-editor__text");
    textInput.type = "text";
    textInput.id = "label-editor-text-" + uid;
    textInput.maxLength = labelService.TEXT_MAX_LENGTH;
    textInput.placeholder = PLACEHOLDER;
    textInput.autocomplete = "off";
    textInput.required = true;
    textLabel.htmlFor = textInput.id;
    textField.appendChild(textLabel);
    textField.appendChild(textInput);
    body.appendChild(textField);

    // Nota (solo se ve en el popup)
    var noteField = el("div", "dialog__field");
    var noteLabel = el("label", "dialog__label", "Nota");
    var noteInput = el("textarea", "dialog__input pin-editor__note label-editor__note");
    noteInput.id = "label-editor-note-" + uid;
    noteInput.maxLength = labelService.NOTE_MAX_LENGTH;
    noteInput.rows = 3;
    noteLabel.htmlFor = noteInput.id;
    noteField.appendChild(noteLabel);
    noteField.appendChild(noteInput);
    body.appendChild(noteField);

    // Color: los mismos 8 radios que el panel de pin
    var colorName = "label-editor-color-" + uid;
    var colorField = el("fieldset", "dialog__field pin-editor__colors");
    colorField.appendChild(el("legend", "dialog__label", "Color"));
    var colorGrid = el("div", "pin-editor__color-grid");
    labelService.COLORS.forEach(function (key) {
      var radio = el("input", "pin-editor__color pin--" + key);
      radio.type = "radio";
      radio.name = colorName;
      radio.value = key;
      radio.setAttribute("aria-label", COLOR_LABELS[key]);
      radio.title = COLOR_LABELS[key];
      colorGrid.appendChild(radio);
    });
    colorField.appendChild(colorGrid);
    body.appendChild(colorField);

    // Tamaño: 8–32 px en pasos de 2, con el valor visible
    var sizeField = el("div", "dialog__field label-editor__size");
    var sizeHead = el("div", "pin-picker__size-head");
    var sizeLabel = el("label", "dialog__label", "Tamaño");
    var sizeInput = el("input", "pin-picker__range label-editor__range");
    sizeInput.type = "range";
    sizeInput.id = "label-editor-size-" + uid;
    sizeInput.min = String(labelService.SIZE.min);
    sizeInput.max = String(labelService.SIZE.max);
    sizeInput.step = String(labelService.SIZE.step);
    sizeLabel.htmlFor = sizeInput.id;
    var sizeValue = el("output", "pin-picker__size-value label-editor__size-value");
    sizeValue.htmlFor = sizeInput.id;
    sizeHead.appendChild(sizeLabel);
    sizeHead.appendChild(sizeValue);
    sizeField.appendChild(sizeHead);
    sizeField.appendChild(sizeInput);
    body.appendChild(sizeField);

    // Acciones
    var actions = el("div", "dialog__actions pin-editor__actions");
    var cancelButton = el("button", "btn btn--cancel", "Cancelar");
    cancelButton.type = "button";
    var saveButton = el("button", "btn btn--primary", "Guardar");
    saveButton.type = "button";
    actions.appendChild(cancelButton);
    actions.appendChild(saveButton);
    body.appendChild(actions);

    /* ---------- Estado → UI ---------- */

    function hasText() {
      return draft.text.trim() !== "";
    }

    // Lo que pinta el borrador: el texto tal cual, o "Texto" atenuado si está vacío.
    function draftStyle() {
      return {
        text: hasText() ? draft.text : PLACEHOLDER,
        color: draft.color,
        size: draft.size,
      };
    }

    function draftClass(dropping) {
      return "label--draft" + (hasText() ? "" : " label--empty") + (dropping ? " label--dropping" : "");
    }

    function renderControls() {
      colorGrid.querySelectorAll("input").forEach(function (radio) {
        radio.checked = radio.value === draft.color;
      });
      sizeInput.value = String(draft.size);
      sizeValue.textContent = draft.size + " px";
      saveButton.disabled = saving || !hasText();
    }

    // Texto, color o tamaño: nuevo icono del borrador (sin la clase de caída) y controles.
    function render() {
      draft.marker.setIcon(labelLayer.divIcon(draftStyle(), draftClass(false)));
      renderControls();
    }

    textInput.addEventListener("input", function () {
      draft.text = textInput.value;
      render();
    });

    noteInput.addEventListener("input", function () {
      draft.note = noteInput.value;
    });

    colorGrid.addEventListener("change", function (event) {
      if (event.target.name === colorName) {
        draft.color = event.target.value;
        render();
      }
    });

    sizeInput.addEventListener("input", function () {
      draft.size = Number(sizeInput.value);
      render();
    });

    cancelButton.addEventListener("click", function () {
      close("cancel");
    });

    /* ---------- Guardar ---------- */

    var saving = false;

    // Si falla, panel y borrador siguen. Al editar (SPEC 11) se actualiza el texto
    // (labelService.update: conserva id, mapId y createdAt); los avisos son los mismos.
    saveButton.addEventListener("click", function () {
      if (saving || !draft || !hasText()) {
        return;
      }
      saving = true;
      saveButton.disabled = true;
      var fields = {
        x: draft.x,
        y: draft.y,
        text: draft.text,
        note: draft.note,
        color: draft.color,
        size: draft.size,
      };
      (editing ? labelService.update(editing.id, fields) : labelService.create(map.id, fields))
        .then(
          function (label) {
            if (closed) {
              return;
            }
            // El borrador pasa a ser un texto guardado en el mismo sitio.
            if (options.onSaved) {
              options.onSaved(label);
            }
            close("save");
          },
          function (error) {
            saving = false;
            if (closed) {
              return;
            }
            saveButton.disabled = !hasText();
            console.error("[label-editor] No se pudo guardar el texto:", error);
            var message = labelService.isQuotaError(error)
              ? "No queda espacio para guardar el texto."
              : "No se pudo guardar el texto.";
            Waypoint.ui.notice.show(message, { type: "error" });
          }
        );
    });

    /* ---------- Borrador ---------- */

    function clampToImage(latLng) {
      return L.latLng(
        Math.min(map.height, Math.max(0, latLng.lat)),
        Math.min(map.width, Math.max(0, latLng.lng))
      );
    }

    // Centro de la franja libre entre el panel izquierdo (si se ve) y el panel de texto, a media
    // altura del mapa; si cae fuera de la imagen, el punto de la imagen más cercano.
    function initialLatLng() {
      var stageRect = leafletMap.getContainer().getBoundingClientRect();
      var left = options.freeLeft();
      var right = panel.getBoundingClientRect().left - stageRect.left;
      var point = L.point((left + right) / 2, stageRect.height / 2);
      return clampToImage(leafletMap.containerPointToLatLng(point));
    }

    // Nunca fuera de la imagen: se recoloca en cada `drag` (no queda fuera ni un fotograma) y al soltar.
    function keepDraftInside() {
      var latLng = draft.marker.getLatLng();
      var inside = clampToImage(latLng);
      if (!inside.equals(latLng)) {
        draft.marker.setLatLng(inside);
      }
    }

    function syncDraftPosition() {
      var relative = pinLayer.toRelative(map, draft.marker.getLatLng());
      draft.x = relative.x;
      draft.y = relative.y;
    }

    // Clic simple en el mapa (Leaflet no lo dispara tras un arrastre): el borrador va a ese punto,
    // o al borde de la imagen más cercano. Un clic sin arrastre sobre un texto guardado llega aquí
    // a través de labelLayer.setPlacing.
    function onMapClick(event) {
      placeDraft(event.latlng);
    }

    function placeDraft(latLng) {
      draft.marker.setLatLng(clampToImage(latLng));
      syncDraftPosition();
    }

    // Al añadir: en la zona libre, con caída y estilo por defecto. Al editar (SPEC 11): en el sitio
    // del texto, con sus campos, sin caída.
    function createDraft() {
      var latLng;
      if (editing) {
        latLng = pinLayer.toLatLng(map, editing.x, editing.y);
        draft = {
          marker: null,
          x: editing.x,
          y: editing.y,
          text: editing.text,
          note: editing.note || "",
          color: editing.color,
          size: editing.size,
        };
        textInput.value = draft.text;
        noteInput.value = draft.note;
      } else {
        latLng = initialLatLng();
        var relative = pinLayer.toRelative(map, latLng);
        draft = {
          marker: null,
          x: relative.x,
          y: relative.y,
          text: "",
          note: "",
          color: labelService.DEFAULT_STYLE.color,
          size: labelService.DEFAULT_STYLE.size,
        };
      }
      draft.marker = L.marker(latLng, {
        icon: labelLayer.divIcon(draftStyle(), draftClass(!editing)),
        keyboard: false,
        draggable: true, // el arrastre de L.Marker no mueve el mapa mientras dura
        autoPan: false,
        zIndexOffset: 1000,
      });
      draft.marker.on("drag", keepDraftInside);
      draft.marker.on("dragend", function () {
        keepDraftInside();
        syncDraftPosition();
      });
      draft.marker.addTo(leafletMap);

      // Caída desde el borde superior del mapa: la distancia es la altura del punto en la vista
      // más medio texto. La animación va en .label-glyph; Leaflet mueve el contenedor con transform.
      if (!editing) {
        var y = leafletMap.latLngToContainerPoint(latLng).y;
        draft.marker.getElement().style.setProperty("--pin-drop-from", -(y + draft.size / 2) + "px");
      }

      renderControls();
    }

    /* ---------- Teclado ---------- */

    function onKeyDown(event) {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) {
        return;
      }
      event.preventDefault();
      close("cancel");
    }

    /* ---------- Abrir y cerrar ---------- */

    function close(reason) {
      if (closed) {
        return;
      }
      closed = true;
      document.removeEventListener("keydown", onKeyDown);
      leafletMap.off("click", onMapClick);
      if (options.labels) {
        options.labels.setPlacing(null);
      }
      if (editing && options.pins) {
        options.pins.setPlacing(null);
      }
      if (draft) {
        draft.marker.remove();
        draft = null;
      }
      panel.remove();
      root.classList.remove("viewer--adding-label");
      if (options.onClose) {
        options.onClose(reason);
      }
    }

    function start() {
      // Un solo modo activo: el popup de un pin o texto guardado no sigue abierto mientras se añade.
      leafletMap.closePopup();
      root.classList.add("viewer--adding-label");
      root.appendChild(panel);
      createDraft();
      leafletMap.on("click", onMapClick);
      if (options.labels) {
        options.labels.setPlacing(placeDraft);
      }
      // Al editar, también los pines guardados en modo colocar (sin popup: un solo modo a la vez).
      // Al añadir no cambian (SPEC 10).
      if (editing && options.pins) {
        options.pins.setPlacing(placeDraft);
      }
      document.addEventListener("keydown", onKeyDown);
      textInput.focus();
    }

    start();

    return function () {
      close("unmount");
    };
  }

  Waypoint.ui.labelEditor = {
    open: open,
  };
})(window.Waypoint);
