/*
 * Modos "añadir pin" (SPEC 08) y "editar pin" (SPEC 11) del visor: panel de pin y pin borrador.
 *
 *   var close = Waypoint.ui.pinEditor.open({
 *     root,        // .viewer: los paneles se cuelgan de él, como hermanos de .viewer__stage
 *     leafletMap,
 *     map,         // { id, gameId, width, height }
 *     freeLeft,    // () → px que tapa el panel izquierdo (0 si está contraído u oculto)
 *     pins,        // capa de pines guardados (pinLayer): modo "añadir pin" con setPlacing
 *     labels,      // capa de textos guardados (labelLayer, SPEC 10): también en modo colocar
 *     marker,      // opcional (SPEC 11): pin guardado a editar → modo "editar pin"
 *     onSaved,     // (marker) → el visor lo añade a la capa de pines guardados (o lo repinta al editar)
 *     onClose,     // (reason: "save" | "cancel" | "unmount") → el visor devuelve el foco
 *   });
 *   close();       // cancela sin avisar (desmontaje del visor)
 *
 * Paneles no modales: no son <dialog>, así que el mapa sigue usable a la vez. Van fuera del
 * contenedor de Leaflet: la rueda y el arrastre que empiezan en ellos no llegan al mapa.
 * Mientras está abierto, la raíz lleva .viewer--adding-pin (oculta los controles de vista y + / −).
 *
 * El borrador es un L.Marker con el mismo divIcon que los pines guardados (pinLayer.divIcon).
 * Al abrir cae desde el borde superior del mapa hasta el centro de la zona libre (entre el panel
 * izquierdo, si se ve, y el panel de pin), dentro de la imagen. Cambiar color, icono o tamaño
 * sustituye su icono sin repetir la caída. Se mueve arrastrándolo (sin mover el mapa) o con un clic
 * simple en el mapa; nunca sale de la imagen. Mientras tanto, los pines guardados no abren popup:
 * un clic sin arrastre sobre ellos cuenta como clic en el mapa, y arrastrarlos los mueve a ellos.
 * Los textos guardados (SPEC 10) se comportan igual.
 *
 * El botón "Icono" abre el selector (.pin-picker), un segundo panel a la izquierda del de pin, con
 * los iconos por categoría (plegables: al abrir, solo la del icono actual) y la barra de tamaño.
 * Elegir o mover la barra se aplica al momento;
 * "Listo" o Esc lo cierran (Esc con el selector abierto no cancela el pin).
 *
 * "Último usado" (markerService.lastStyle) es el estilo del pin más reciente del juego: el borrador
 * cae con su icono y color, pero siempre a SIZE.default; su botón (texto: solo el nombre del
 * icono) vuelve a aplicar icono y color y devuelve el tamaño a SIZE.default.
 * Sin pines, estilo por defecto. El borrador nunca cae encima de un pin guardado (findFreeSpot).
 *
 * "Guardar" crea el marcador (nombre vacío → etiqueta del icono), llama a onSaved(marker) para que
 * el visor lo pinte como pin guardado y cierra. Si falla, avisa y paneles y borrador siguen.
 *
 * Cancelar (botón, Esc o desmontaje) quita borrador, paneles y listeners; no se guarda nada.
 *
 * Modo "editar pin" (SPEC 11, opción `marker`): título "Editar pin", campos con los valores del pin
 * (nombre tal cual, aunque sea la etiqueta del icono) y el borrador en su sitio, con su estilo y
 * .pin--found si está encontrado, sin caída ni findFreeSpot. "Último usado" funciona igual.
 * "Guardar" llama a markerService.update (siempre habilitado; sin cambios escribe igual). Quitar
 * el pin guardado del mapa y devolverlo al cerrar es cosa del visor (pins.startEditing / stopEditing).
 * Nunca accede a IndexedDB.
 */
(function (Waypoint) {
  "use strict";

  var markerService = Waypoint.services.markerService;
  var pinIcons = Waypoint.ui.pinIcons;
  var pinLayer = Waypoint.ui.pinLayer;

  var COLOR_LABELS = {
    gold: "Dorado",
    white: "Blanco",
    black: "Negro",
    red: "Rojo",
    orange: "Naranja",
    green: "Verde",
    cyan: "Cian",
    violet: "Violeta",
  };

  var idCounter = 0;

  // Chevron de las categorías plegables (gira 180° expandida, en css/pins.css).
  function chevronIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "pin-picker__chevron");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M2 4.5 7 9.5 12 4.5");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    svg.appendChild(path);
    return svg;
  }

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
    // Modo "editar pin" (SPEC 11): el pin guardado que se edita; null al añadir.
    var editing = options.marker || null;

    var style = {
      icon: markerService.DEFAULT_STYLE.icon,
      color: markerService.DEFAULT_STYLE.color,
      size: markerService.DEFAULT_STYLE.size,
    };

    // { marker: L.Marker, x, y, name, note, icon, color, size } mientras se añade.
    var draft = null;

    /* ---------- Panel de pin ---------- */

    var panel = el("aside", "dialog pin-editor");
    panel.setAttribute("aria-labelledby", "pin-editor-title-" + uid);
    var body = el("div", "dialog__form pin-editor__body");
    panel.appendChild(body);

    var heading = el("h2", "dialog__title pin-editor__title", editing ? "Editar pin" : "Añadir pin");
    heading.id = "pin-editor-title-" + uid;
    body.appendChild(heading);

    // Último usado: estilo del pin más reciente del juego (markerService.lastStyle).
    var lastStyle = null;
    var lastField = el("div", "dialog__field");
    var lastCaption = el("span", "dialog__label", "Último usado");
    lastCaption.id = "pin-editor-last-label-" + uid;
    var lastButton = el("button", "pin-editor__last");
    lastButton.type = "button";
    lastButton.setAttribute("aria-describedby", lastCaption.id);
    var lastGlyph = el("span", "pin-editor__last-glyph");
    var lastText = el("span", "pin-editor__last-text");
    lastButton.appendChild(lastGlyph);
    lastButton.appendChild(lastText);
    lastField.appendChild(lastCaption);
    lastField.appendChild(lastButton);
    body.appendChild(lastField);

    // Nombre
    var nameField = el("div", "dialog__field");
    var nameLabel = el("label", "dialog__label", "Nombre");
    var nameInput = el("input", "dialog__input pin-editor__name");
    nameInput.type = "text";
    nameInput.id = "pin-editor-name-" + uid;
    nameInput.maxLength = markerService.NAME_MAX_LENGTH;
    nameInput.autocomplete = "off";
    nameLabel.htmlFor = nameInput.id;
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    body.appendChild(nameField);

    // Nota
    var noteField = el("div", "dialog__field");
    var noteLabel = el("label", "dialog__label", "Nota");
    var noteInput = el("textarea", "dialog__input pin-editor__note");
    noteInput.id = "pin-editor-note-" + uid;
    noteInput.maxLength = markerService.NOTE_MAX_LENGTH;
    noteInput.rows = 3;
    noteLabel.htmlFor = noteInput.id;
    noteField.appendChild(noteLabel);
    noteField.appendChild(noteInput);
    body.appendChild(noteField);

    // Color: 8 radios con muestra
    var colorField = el("fieldset", "dialog__field pin-editor__colors");
    colorField.appendChild(el("legend", "dialog__label", "Color"));
    var colorGrid = el("div", "pin-editor__color-grid");
    markerService.COLORS.forEach(function (key) {
      var radio = el("input", "pin-editor__color pin--" + key);
      radio.type = "radio";
      radio.name = "pin-editor-color-" + uid;
      radio.value = key;
      radio.setAttribute("aria-label", COLOR_LABELS[key]);
      radio.title = COLOR_LABELS[key];
      colorGrid.appendChild(radio);
    });
    colorField.appendChild(colorGrid);
    body.appendChild(colorField);

    // Icono: botón con el glifo actual y su etiqueta (abre el selector, SPEC 08 paso 8)
    var iconField = el("div", "dialog__field");
    var iconLabelId = "pin-editor-icon-label-" + uid;
    var iconCaption = el("span", "dialog__label", "Icono");
    iconCaption.id = iconLabelId;
    var iconButton = el("button", "pin-editor__icon-btn");
    iconButton.type = "button";
    var iconGlyph = el("span", "pin-editor__icon-glyph");
    var iconText = el("span", "pin-editor__icon-text");
    iconButton.appendChild(iconGlyph);
    iconButton.appendChild(iconText);
    iconButton.setAttribute("aria-describedby", iconLabelId);
    iconField.appendChild(iconCaption);
    iconField.appendChild(iconButton);
    body.appendChild(iconField);

    // Acciones
    var actions = el("div", "dialog__actions pin-editor__actions");
    var cancelButton = el("button", "btn btn--cancel", "Cancelar");
    cancelButton.type = "button";
    var saveButton = el("button", "btn btn--primary", "Guardar");
    saveButton.type = "button";
    actions.appendChild(cancelButton);
    actions.appendChild(saveButton);
    body.appendChild(actions);

    /* ---------- Selector de iconos ---------- */

    // Segundo panel, a la izquierda del de pin. Se crea con el editor y se muestra u oculta.
    var pickerOpen = false;
    var picker = el("aside", "dialog pin-picker");
    picker.id = "pin-picker-" + uid;
    picker.hidden = true;
    picker.setAttribute("aria-labelledby", "pin-picker-title-" + uid);
    var pickerBody = el("div", "dialog__form pin-picker__body");
    picker.appendChild(pickerBody);

    var pickerTitle = el("h2", "dialog__title pin-picker__title", "Icono");
    pickerTitle.id = "pin-picker-title-" + uid;
    pickerBody.appendChild(pickerTitle);

    var iconRadioName = "pin-picker-icon-" + uid;
    // Categorías plegables: el encabezado es un botón con chevron. La cuadrícula contraída va con
    // [hidden], así sus radios no reciben foco. id de categoría → { toggle, grid }.
    var categoryParts = {};
    var categoriesInitialized = false; // al abrir el selector por primera vez, solo la del icono actual

    function setCategoryExpanded(categoryId, expanded) {
      var parts = categoryParts[categoryId];
      parts.grid.hidden = !expanded;
      parts.toggle.setAttribute("aria-expanded", String(expanded));
    }

    function categoryOf(iconId) {
      var found = null;
      pinIcons.CATEGORIES.forEach(function (category) {
        category.icons.forEach(function (icon) {
          if (icon.id === iconId) {
            found = category.id;
          }
        });
      });
      return found;
    }

    pinIcons.CATEGORIES.forEach(function (category) {
      var group = el("fieldset", "pin-picker__category");
      var legend = el("legend", "pin-picker__heading");
      var toggle = el("button", "pin-picker__toggle");
      toggle.type = "button";
      toggle.appendChild(el("span", "pin-picker__toggle-text", category.label));
      toggle.appendChild(chevronIcon());
      legend.appendChild(toggle);
      group.appendChild(legend);
      var grid = el("div", "pin-picker__grid");
      grid.id = "pin-picker-" + uid + "-" + category.id;
      toggle.setAttribute("aria-controls", grid.id);
      categoryParts[category.id] = { toggle: toggle, grid: grid };
      toggle.addEventListener("click", function () {
        setCategoryExpanded(category.id, grid.hidden);
      });
      category.icons.forEach(function (icon) {
        // El radio cubre toda la opción (transparente): su foco y su marca se ven sobre ella.
        var option = el("label", "pin-picker__option");
        var radio = el("input", "pin-picker__radio");
        radio.type = "radio";
        radio.name = iconRadioName;
        radio.value = icon.id;
        var glyph = el("span", "pin-picker__glyph");
        glyph.innerHTML = pinIcons.svg(icon.id);
        option.appendChild(radio);
        option.appendChild(glyph);
        option.appendChild(el("span", "pin-picker__label", icon.label));
        grid.appendChild(option);
      });
      group.appendChild(grid);
      pickerBody.appendChild(group);
    });

    // Tamaño: 20–64 px en pasos de 4, con el valor visible.
    var sizeField = el("div", "dialog__field pin-picker__size");
    var sizeHead = el("div", "pin-picker__size-head");
    var sizeLabel = el("label", "dialog__label", "Tamaño");
    var sizeInput = el("input", "pin-picker__range");
    sizeInput.type = "range";
    sizeInput.id = "pin-picker-size-" + uid;
    sizeInput.min = String(markerService.SIZE.min);
    sizeInput.max = String(markerService.SIZE.max);
    sizeInput.step = String(markerService.SIZE.step);
    sizeLabel.htmlFor = sizeInput.id;
    var sizeValue = el("output", "pin-picker__size-value");
    sizeValue.htmlFor = sizeInput.id;
    sizeHead.appendChild(sizeLabel);
    sizeHead.appendChild(sizeValue);
    sizeField.appendChild(sizeHead);
    sizeField.appendChild(sizeInput);
    pickerBody.appendChild(sizeField);

    var pickerActions = el("div", "dialog__actions");
    var doneButton = el("button", "btn btn--primary", "Listo");
    doneButton.type = "button";
    pickerActions.appendChild(doneButton);
    pickerBody.appendChild(pickerActions);

    iconButton.setAttribute("aria-controls", picker.id);
    iconButton.setAttribute("aria-expanded", "false");

    function renderPicker() {
      picker.querySelectorAll(".pin-picker__radio").forEach(function (radio) {
        radio.checked = radio.value === draft.icon;
      });
      sizeInput.value = String(draft.size);
      sizeValue.textContent = draft.size + " px";
    }

    // La primera vez, solo la categoría del icono actual expandida. Después se respeta lo que el
    // usuario haya expandido o contraído (mientras dure el panel), pero la del icono actual se abre.
    function expandCategories() {
      var current = categoryOf(draft.icon);
      if (!categoriesInitialized) {
        categoriesInitialized = true;
        Object.keys(categoryParts).forEach(function (id) {
          setCategoryExpanded(id, id === current);
        });
      } else if (current) {
        setCategoryExpanded(current, true);
      }
    }

    function openPicker() {
      if (!pickerOpen) {
        pickerOpen = true;
        picker.hidden = false;
        iconButton.setAttribute("aria-expanded", "true");
        renderPicker();
        expandCategories();
      }
      var checked = picker.querySelector(".pin-picker__radio:checked");
      if (checked) {
        checked.focus();
      }
    }

    function closePicker() {
      if (!pickerOpen) {
        return;
      }
      pickerOpen = false;
      picker.hidden = true;
      iconButton.setAttribute("aria-expanded", "false");
      iconButton.focus();
    }

    iconButton.addEventListener("click", openPicker);
    doneButton.addEventListener("click", closePicker);

    // Elegir icono o mover la barra cambia el borrador al momento; el selector sigue abierto.
    picker.addEventListener("change", function (event) {
      if (event.target.name === iconRadioName) {
        draft.icon = event.target.value;
        renderStyle();
      }
    });
    sizeInput.addEventListener("input", function () {
      draft.size = Number(sizeInput.value);
      sizeValue.textContent = draft.size + " px";
      renderStyle();
    });

    /* ---------- Estado → UI ---------- */

    function displayName() {
      return draft.name.trim() || pinIcons.label(draft.icon);
    }

    function renderIconButton() {
      iconGlyph.className = "pin-editor__icon-glyph pin--" + draft.color;
      iconGlyph.innerHTML = pinIcons.svg(draft.icon);
      iconText.textContent = pinIcons.label(draft.icon);
      iconButton.setAttribute("aria-label", "Icono: " + pinIcons.label(draft.icon));
    }

    function renderColor() {
      colorGrid.querySelectorAll("input").forEach(function (radio) {
        radio.checked = radio.value === draft.color;
      });
    }

    function renderTooltip() {
      draft.marker.setTooltipContent(pinLayer.tooltipContent(displayName()));
    }

    // Color, icono o tamaño: nuevo icono del borrador (sin la clase de caída), botón y placeholder.
    function renderStyle() {
      draft.marker.setIcon(pinLayer.divIcon(draft, "pin--draft"));
      nameInput.placeholder = pinIcons.label(draft.icon);
      renderIconButton();
      renderColor();
      renderTooltip();
    }

    nameInput.addEventListener("input", function () {
      draft.name = nameInput.value;
      renderTooltip();
    });

    noteInput.addEventListener("input", function () {
      draft.note = noteInput.value;
    });

    colorGrid.addEventListener("change", function (event) {
      if (event.target.name === "pin-editor-color-" + uid) {
        draft.color = event.target.value;
        renderStyle();
      }
    });

    cancelButton.addEventListener("click", function () {
      close("cancel");
    });

    /* ---------- Último usado ---------- */


    // Sin pines en el juego: "Ninguno todavía", deshabilitado.
    function renderLastButton() {
      if (!lastStyle) {
        lastButton.disabled = true;
        lastGlyph.hidden = true;
        lastText.textContent = "Ninguno todavía";
        return;
      }
      lastButton.disabled = false;
      lastGlyph.hidden = false;
      lastGlyph.className = "pin-editor__last-glyph pin--" + lastStyle.color;
      lastGlyph.innerHTML = pinIcons.svg(lastStyle.icon);
      lastText.textContent = pinIcons.label(lastStyle.icon);
    }

    // Vuelve a aplicar icono y color del último pin; el tamaño vuelve siempre al por defecto.
    lastButton.addEventListener("click", function () {
      if (!lastStyle || !draft) {
        return;
      }
      draft.icon = lastStyle.icon;
      draft.color = lastStyle.color;
      draft.size = markerService.SIZE.default;
      renderStyle();
      if (pickerOpen) {
        renderPicker();
      }
    });

    /* ---------- Guardar ---------- */

    var saving = false;

    // Nombre vacío (o solo espacios) → etiqueta del icono. Si falla, paneles y borrador siguen.
    // Al editar (SPEC 11) se actualiza el pin (markerService.update: conserva id, mapId, found y
    // createdAt); los avisos de error son los mismos.
    saveButton.addEventListener("click", function () {
      if (saving || !draft) {
        return;
      }
      saving = true;
      saveButton.disabled = true;
      var fields = {
        x: draft.x,
        y: draft.y,
        name: displayName(),
        note: draft.note,
        icon: draft.icon,
        color: draft.color,
        size: draft.size,
      };
      (editing ? markerService.update(editing.id, fields) : markerService.create(map.id, fields))
        .then(
          function (marker) {
            if (closed) {
              return;
            }
            // El borrador pasa a ser un pin guardado en el mismo sitio (al editar, el visor repinta el pin).
            if (options.onSaved) {
              options.onSaved(marker);
            }
            close("save");
          },
          function (error) {
            saving = false;
            saveButton.disabled = false;
            if (closed) {
              return;
            }
            console.error("[pin-editor] No se pudo guardar el pin:", error);
            var message = markerService.isQuotaError(error)
              ? "No queda espacio para guardar el pin."
              : "No se pudo guardar el pin.";
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

    // Centro de la franja libre entre el panel izquierdo (si se ve) y el panel de pin, a media
    // altura del mapa; si cae fuera de la imagen, el punto de la imagen más cercano.
    // Si ahí taparía un pin guardado, el hueco libre más cercano (findFreeSpot).
    function initialLatLng(size) {
      var stageRect = leafletMap.getContainer().getBoundingClientRect();
      var zone = {
        left: options.freeLeft(),
        right: panel.getBoundingClientRect().left - stageRect.left,
        top: 0,
        bottom: stageRect.height,
      };
      var point = L.point((zone.left + zone.right) / 2, stageRect.height / 2);
      var start = clampToImage(leafletMap.containerPointToLatLng(point));
      var free = findFreeSpot(leafletMap.latLngToContainerPoint(start), size, zone);
      return free ? leafletMap.containerPointToLatLng(free) : start;
    }

    var RING_STEP = 8; // px entre anillos y entre puntos de un anillo
    var RING_MAX = 400; // px: radio máximo de búsqueda
    var BOX_MARGIN = 4; // px de aire entre cajas

    // ¿La caja de lado `size` centrada en `point` toca (con margen) la de algún pin guardado?
    function touchesSaved(point, size, saved) {
      return saved.some(function (box) {
        var reach = (size + box.size) / 2 + BOX_MARGIN;
        return Math.abs(point.x - box.x) < reach && Math.abs(point.y - box.y) < reach;
      });
    }

    // Caja entera dentro de la zona libre y centro dentro de la imagen.
    function fits(point, size, zone, imageBox) {
      var half = size / 2;
      return (
        point.x - half >= zone.left &&
        point.x + half <= zone.right &&
        point.y - half >= zone.top &&
        point.y + half <= zone.bottom &&
        point.x >= imageBox.min.x &&
        point.x <= imageBox.max.x &&
        point.y >= imageBox.min.y &&
        point.y <= imageBox.max.y
      );
    }

    // Punto en px del contenedor donde cae el borrador sin tocar ningún pin guardado. Anillos
    // crecientes cada RING_STEP px hasta RING_MAX. null si el sitio inicial ya está libre o si no
    // hay hueco (entonces cae en el sitio inicial: solapar es mejor que no poder añadir).
    function findFreeSpot(start, size, zone) {
      var saved = options.pins ? options.pins.boxes() : [];
      if (!touchesSaved(start, size, saved)) {
        return null;
      }
      var imageBox = L.bounds(
        leafletMap.latLngToContainerPoint([map.height, 0]),
        leafletMap.latLngToContainerPoint([0, map.width])
      );
      for (var radius = RING_STEP; radius <= RING_MAX; radius += RING_STEP) {
        var count = Math.ceil((2 * Math.PI * radius) / RING_STEP);
        for (var i = 0; i < count; i++) {
          var angle = (2 * Math.PI * i) / count;
          var point = L.point(start.x + radius * Math.cos(angle), start.y + radius * Math.sin(angle));
          if (fits(point, size, zone, imageBox) && !touchesSaved(point, size, saved)) {
            return point;
          }
        }
      }
      return null;
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
    // o al borde de la imagen más cercano. Un clic sin arrastre sobre un pin guardado llega aquí a
    // través de pinLayer.setPlacing; arrastrarlo lo mueve a él, no al borrador.
    function onMapClick(event) {
      placeDraft(event.latlng);
    }

    function placeDraft(latLng) {
      draft.marker.setLatLng(clampToImage(latLng));
      syncDraftPosition();
    }

    // Al añadir: en la zona libre, con caída. Al editar (SPEC 11): en el sitio del pin, con sus
    // campos y su estado encontrado (.pin--found), sin caída ni búsqueda de hueco.
    function createDraft() {
      var latLng;
      if (editing) {
        latLng = pinLayer.toLatLng(map, editing.x, editing.y);
        draft = {
          marker: null,
          x: editing.x,
          y: editing.y,
          name: editing.name,
          note: editing.note || "",
          icon: editing.icon,
          color: editing.color,
          size: editing.size,
          found: editing.found === true,
        };
        nameInput.value = draft.name;
        noteInput.value = draft.note;
      } else {
        latLng = initialLatLng(style.size);
        var relative = pinLayer.toRelative(map, latLng);
        draft = {
          marker: null,
          x: relative.x,
          y: relative.y,
          name: "",
          note: "",
          icon: style.icon,
          color: style.color,
          size: style.size,
        };
      }
      // draggable: el arrastre de L.Marker no mueve el mapa mientras dura.
      draft.marker = L.marker(latLng, {
        icon: pinLayer.divIcon(draft, editing ? "pin--draft" : "pin--draft pin--dropping"),
        keyboard: false,
        draggable: true,
        autoPan: false,
        zIndexOffset: 1000,
      });
      draft.marker.on("drag", keepDraftInside);
      draft.marker.on("dragend", function () {
        keepDraftInside();
        syncDraftPosition();
      });
      draft.marker.bindTooltip(pinLayer.tooltipContent(displayName()), {
        direction: "top",
        className: "pin-tooltip",
      });
      draft.marker.addTo(leafletMap);

      // Caída desde el borde superior del mapa: la distancia es la altura del punto en la vista
      // más medio pin. La animación va en el glifo; Leaflet mueve el contenedor con transform.
      if (!editing) {
        var y = leafletMap.latLngToContainerPoint(latLng).y;
        draft.marker.getElement().style.setProperty("--pin-drop-from", -(y + draft.size / 2) + "px");
      }

      nameInput.placeholder = pinIcons.label(draft.icon);
      renderIconButton();
      renderColor();
    }

    /* ---------- Teclado ---------- */

    function onKeyDown(event) {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) {
        return;
      }
      event.preventDefault();
      // Con el selector abierto, Esc solo lo cierra (y el foco vuelve a "Icono").
      if (pickerOpen) {
        closePicker();
        return;
      }
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
      if (options.pins) {
        options.pins.setPlacing(null);
      }
      if (options.labels) {
        options.labels.setPlacing(null);
      }
      if (draft) {
        draft.marker.remove();
        draft = null;
      }
      pickerOpen = false;
      picker.remove();
      panel.remove();
      root.classList.remove("viewer--adding-pin");
      if (options.onClose) {
        options.onClose(reason);
      }
    }

    // Arranca cuando se sabe el último estilo: el borrador cae ya con él. Si la lectura falla,
    // se usa el estilo por defecto, como en un juego sin pines.
    function start() {
      // Un solo modo activo: el popup de un pin guardado no sigue abierto mientras se añade.
      leafletMap.closePopup();
      root.classList.add("viewer--adding-pin");
      root.appendChild(picker);
      root.appendChild(panel);
      renderLastButton();
      createDraft();
      leafletMap.on("click", onMapClick);
      if (options.pins) {
        options.pins.setPlacing(placeDraft);
      }
      if (options.labels) {
        options.labels.setPlacing(placeDraft);
      }
      document.addEventListener("keydown", onKeyDown);
      nameInput.focus();
    }

    markerService
      .lastStyle(map.gameId)
      .catch(function (error) {
        console.error("[pin-editor] No se pudo leer el último estilo:", error);
        return null;
      })
      .then(function (found) {
        if (closed) {
          return;
        }
        lastStyle = found;
        // El tamaño no se hereda: el borrador empieza siempre en SIZE.default (el botón sí lo aplica).
        // Al editar, el borrador empieza con el estilo del pin (createDraft).
        if (found && !editing) {
          style = { icon: found.icon, color: found.color, size: markerService.SIZE.default };
        }
        start();
      });

    return function () {
      close("unmount");
    };
  }

  Waypoint.ui.pinEditor = {
    open: open,
    COLOR_LABELS: COLOR_LABELS,
  };
})(window.Waypoint);
