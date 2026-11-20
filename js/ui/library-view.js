/*
 * Vista de juego (#/game/<id>): cabecera del juego y cuadrícula de mapas, estado vacío y carga
 * por selector o arrastrando.
 * Nunca accede a IndexedDB: todo pasa por Waypoint.services.mapService.
 */
(function (Waypoint) {
  "use strict";

  var mapService = Waypoint.services.mapService;
  var gameService = Waypoint.services.gameService;
  var router = Waypoint.core.router;
  var notice = Waypoint.ui.notice;
  var dialog = Waypoint.ui.dialog;

  var ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

  var SKIP_MESSAGES = {
    "unsupported-type": "Formato no admitido (solo JPG, PNG y WebP)",
    "decode-failed": "No se pudo leer la imagen",
    error: "No se pudo guardar",
  };

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

  function plural(count, singular, pluralForm) {
    return count + " " + (count === 1 ? singular : pluralForm);
  }

  function formatMegabytes(bytes) {
    return (bytes / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 1 }) + " MB";
  }

  /**
   * Pregunta si continuar con una imagen grande.
   * @returns {Promise<boolean>} true = guardar, false = saltar ese archivo.
   */
  function confirmLargeImage(file, info) {
    var imageService = Waypoint.services.imageService;
    var reasons = [];
    if (info.large.tooManyPixels) {
      reasons.push(
        "mide " + info.width + " × " + info.height + " px (más de " + imageService.LARGE_MAX_SIDE_PX + " px de lado)"
      );
    }
    if (info.large.tooHeavy) {
      reasons.push(
        "pesa " + formatMegabytes(info.fileSize) + " (más de " + formatMegabytes(imageService.LARGE_MAX_BYTES) + ")"
      );
    }

    return dialog.confirm({
      title: "Imagen muy grande",
      message:
        "«" + file.name + "» " + reasons.join(" y ") + ". " +
        "Puede tardar en cargar o hacer que el navegador vaya lento. ¿Quieres guardarla igualmente?",
      confirmLabel: "Continuar",
      cancelLabel: "Cancelar",
    });
  }

  /**
   * Monta la vista en el contenedor y devuelve la función de desmontaje.
   * @param {HTMLElement} container
   * @param {{id: string}} params  Id del juego cuyos mapas se muestran.
   * @returns {function}
   */
  function mount(container, params) {
    var gameId = params.id;
    var alive = true;
    var busy = false;
    var objectUrls = [];
    var coverUrl = null;

    var root = el("section", "library");
    root.setAttribute("aria-labelledby", "library-title");

    // Selector de archivos oculto, compartido por todos los botones "Cargar mapas".
    var fileInput = el("input", "visually-hidden");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = ACCEPT;
    fileInput.tabIndex = -1;
    fileInput.setAttribute("aria-hidden", "true");

    // Cabecera del juego: volver, portada pequeña (o placeholder), nombre, nº de mapas y carga.
    var head = el("header", "game-head");
    var back = el("a", "btn btn--ghost game-head__back", "← Juegos");
    back.href = "#/";
    var coverSlot = el("div", "game-head__cover");
    var heading = el("div", "game-head__info");
    var title = el("h1", "game-head__title neon-cyan");
    title.id = "library-title";
    var count = el("p", "library__count");
    heading.appendChild(title);
    heading.appendChild(count);

    var loadButton = el("button", "btn btn--primary game-head__load", "Cargar mapas");
    loadButton.type = "button";

    head.appendChild(back);
    head.appendChild(coverSlot);
    head.appendChild(heading);
    head.appendChild(loadButton);

    var content = el("div", "library__content");

    // Superposición que aparece al arrastrar archivos sobre la ventana.
    var dropOverlay = el("div", "drop-overlay");
    dropOverlay.setAttribute("aria-hidden", "true");
    var dropOverlayBox = el("div", "drop-overlay__box");
    dropOverlayBox.appendChild(el("p", "drop-overlay__title", "Suelta para cargar los mapas"));
    dropOverlayBox.appendChild(el("p", "drop-overlay__hint", "JPG, PNG o WebP"));
    dropOverlay.appendChild(dropOverlayBox);

    root.appendChild(head);
    root.appendChild(content);
    root.appendChild(fileInput);
    root.appendChild(dropOverlay);
    container.appendChild(root);

    function renderHeader(game) {
      title.textContent = game.name;
      title.title = game.name;

      coverSlot.innerHTML = "";
      if (game.cover) {
        coverUrl = URL.createObjectURL(game.cover);
        var img = el("img", "game-head__img");
        img.src = coverUrl;
        img.alt = "";
        coverSlot.appendChild(img);
      } else {
        var placeholder = el("div", "game-placeholder", Array.from(game.name)[0].toUpperCase());
        placeholder.setAttribute("aria-hidden", "true");
        coverSlot.appendChild(placeholder);
      }
    }

    function revokeThumbnails() {
      objectUrls.forEach(function (url) {
        URL.revokeObjectURL(url);
      });
      objectUrls = [];
    }

    function openPicker() {
      if (!busy) {
        fileInput.click();
      }
    }

    function setBusy(value) {
      busy = value;
      root.classList.toggle("library--busy", value);
      root.querySelectorAll("[data-load-button]").forEach(function (button) {
        button.disabled = value;
      });
      loadButton.disabled = value;
      loadButton.textContent = value ? "Importando…" : "Cargar mapas";
    }

    function renderEmpty() {
      var zone = el("div", "drop-zone");

      var icon = el("div", "drop-zone__icon");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" ' +
        'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14"/><path d="M15 6v14"/></svg>';

      var titleText = el("h2", "drop-zone__title", "Tu biblioteca está vacía");
      var hint = el("p", "drop-zone__hint", "Suelta aquí las imágenes de tus mapas (JPG, PNG o WebP)");
      var or = el("p", "drop-zone__or", "o");

      var pickButton = el("button", "btn btn--primary", "Elegir archivos");
      pickButton.type = "button";
      pickButton.setAttribute("data-load-button", "");
      pickButton.addEventListener("click", openPicker);

      zone.appendChild(icon);
      zone.appendChild(titleText);
      zone.appendChild(hint);
      zone.appendChild(or);
      zone.appendChild(pickButton);
      content.appendChild(zone);
    }

    function renderCard(map) {
      var card = el("article", "map-card");

      var link = el("a", "map-card__link");
      link.href = "#/map/" + encodeURIComponent(map.id);

      var thumb = el("div", "map-card__thumb");
      if (map.thumbnail) {
        var url = URL.createObjectURL(map.thumbnail);
        objectUrls.push(url);
        var img = el("img", "map-card__img");
        img.src = url;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        thumb.appendChild(img);
      }

      var body = el("div", "map-card__body");
      var name = el("h2", "map-card__name", map.name);
      name.title = map.name;
      var meta = el("p", "map-card__meta", map.width + " × " + map.height + " px");

      body.appendChild(name);
      body.appendChild(meta);
      link.appendChild(thumb);
      link.appendChild(body);
      card.appendChild(link);
      card.appendChild(renderCardActions(map));
      return card;
    }

    var ICONS = {
      rename:
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
      remove:
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/>' +
        '<path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    };

    function iconButton(action, label, mapName) {
      var node = el("button", "map-card__action map-card__action--" + action);
      node.type = "button";
      node.innerHTML = ICONS[action];
      node.title = label;
      node.setAttribute("aria-label", label + " «" + mapName + "»");
      return node;
    }

    function renderCardActions(map) {
      var actions = el("div", "map-card__actions");
      var renameButton = iconButton("rename", "Renombrar", map.name);
      var removeButton = iconButton("remove", "Borrar", map.name);

      renameButton.addEventListener("click", function () {
        renameMap(map);
      });
      removeButton.addEventListener("click", function () {
        removeMap(map);
      });

      actions.appendChild(renameButton);
      actions.appendChild(removeButton);
      return actions;
    }

    function renameMap(map) {
      dialog
        .rename({ title: "Renombrar mapa", value: map.name, maxLength: mapService.NAME_MAX_LENGTH })
        .then(function (name) {
          if (name === null || name === map.name) {
            return;
          }
          return mapService.rename(map.id, name).then(refresh);
        })
        .catch(function (error) {
          console.error("[library] Error al renombrar:", error);
          var message = "No se pudo renombrar el mapa.";
          if (error instanceof mapService.MapNotFoundError) {
            message = "Ese mapa ya no existe.";
          } else if (mapService.isQuotaError(error)) {
            message = "Sin espacio de almacenamiento.";
          }
          notice.show(message, { type: "error" });
          return refresh();
        });
    }

    function removeMap(map) {
      dialog
        .confirm({
          title: "¿Borrar «" + map.name + "»?",
          message: "Se borrarán el mapa y sus marcadores. Esta acción no se puede deshacer.",
          confirmLabel: "Borrar",
          danger: true,
        })
        .then(function (confirmed) {
          if (!confirmed) {
            return;
          }
          return mapService.remove(map.id).then(function () {
            notice.show("Mapa borrado: " + map.name, { type: "success" });
            return refresh();
          });
        })
        .catch(function (error) {
          console.error("[library] Error al borrar:", error);
          notice.show("No se pudo borrar el mapa.", { type: "error" });
        });
    }

    function renderGrid(maps) {
      var grid = el("div", "map-grid");
      maps.forEach(function (map) {
        grid.appendChild(renderCard(map));
      });
      content.appendChild(grid);
    }

    function render(maps) {
      revokeThumbnails();
      content.innerHTML = "";

      var isEmpty = maps.length === 0;
      root.classList.toggle("library--empty", isEmpty);
      count.textContent = plural(maps.length, "mapa", "mapas");

      if (isEmpty) {
        renderEmpty();
      } else {
        renderGrid(maps);
      }
    }

    function refresh() {
      return mapService.listSorted(gameId).then(function (maps) {
        if (alive) {
          render(maps);
        }
      });
    }

    function reportImport(report, totalFiles) {
      if (report.imported.length > 0) {
        notice.show(plural(report.imported.length, "mapa importado", "mapas importados"), { type: "success" });
      }
      report.skipped.forEach(function (item) {
        if (item.reason === "cancelled" || mapService.isQuotaError(item.error)) {
          return;
        }
        var reason = SKIP_MESSAGES[item.reason] || SKIP_MESSAGES.error;
        notice.show(reason + ": " + item.fileName, { type: "warning", duration: 6000 });
      });
      if (report.quotaExceeded) {
        // El archivo que llenó el almacenamiento + los que ya no se intentaron.
        var otherSkipped = report.skipped.filter(function (item) {
          return !mapService.isQuotaError(item.error);
        }).length;
        var notSaved = totalFiles - report.imported.length - otherSkipped;
        notice.show(
          "Sin espacio de almacenamiento. " +
            (notSaved === 1 ? "No se guardó 1 archivo." : "No se guardaron " + notSaved + " archivos."),
          { type: "error", duration: 0 }
        );
      }
    }

    /** Importa archivos (desde el selector o soltados) y refresca la cuadrícula. */
    function importFiles(files) {
      if (!files || files.length === 0) {
        return Promise.resolve();
      }
      if (busy) {
        notice.show("Espera a que termine la importación en curso.", { type: "info" });
        return Promise.resolve();
      }
      setBusy(true);
      return mapService
        .importFiles(gameId, files, confirmLargeImage)
        .then(function (report) {
          reportImport(report, files.length);
          return refresh();
        })
        .catch(function (error) {
          console.error("[library] Error al importar:", error);
          notice.show("No se pudieron importar los mapas.", { type: "error" });
        })
        .then(function () {
          if (alive) {
            setBusy(false);
          }
        });
    }

    loadButton.addEventListener("click", openPicker);
    fileInput.addEventListener("change", function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      fileInput.value = ""; // permite volver a elegir los mismos archivos
      importFiles(files);
    });

    // ---------- Arrastrar y soltar ----------
    // Se escucha en toda la ventana: soltar en cualquier punto de la biblioteca carga los
    // archivos y evita que el navegador abra la imagen y saque al usuario de la app.

    var dragDepth = 0;

    function isFileDrag(event) {
      var types = event.dataTransfer && event.dataTransfer.types;
      return !!types && Array.prototype.indexOf.call(types, "Files") !== -1;
    }

    function setDragging(value) {
      root.classList.toggle("library--dragging", value);
    }

    function onDragEnter(event) {
      if (!isFileDrag(event)) {
        return;
      }
      event.preventDefault();
      dragDepth++;
      setDragging(true);
    }

    function onDragOver(event) {
      if (!isFileDrag(event)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }

    function onDragLeave(event) {
      if (!isFileDrag(event)) {
        return;
      }
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        setDragging(false);
      }
    }

    function onDrop(event) {
      if (!isFileDrag(event)) {
        return;
      }
      event.preventDefault();
      dragDepth = 0;
      setDragging(false);
      importFiles(Array.prototype.slice.call(event.dataTransfer.files || []));
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    // Abrir el juego cuenta como uso. Si no existe, vuelve al inicio con un aviso.
    gameService
      .touch(gameId)
      .then(function (game) {
        if (alive) {
          renderHeader(game);
        }
        return refresh();
      })
      .catch(function (error) {
        if (error instanceof gameService.GameNotFoundError) {
          if (alive) {
            notice.show("Ese juego no existe", { type: "warning" });
            router.replaceWithGames();
          }
          return;
        }
        console.error("[library] Error al listar los mapas:", error);
        notice.show("No se pudo cargar la biblioteca.", { type: "error" });
      });

    return function unmount() {
      alive = false;
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      revokeThumbnails();
      if (coverUrl) {
        URL.revokeObjectURL(coverUrl);
        coverUrl = null;
      }
      container.innerHTML = "";
    };
  }

  /**
   * Pantalla de error que sustituye a la biblioteca cuando IndexedDB no está disponible.
   * @param {HTMLElement} container
   */
  function mountUnavailable(container) {
    container.innerHTML = "";

    var root = el("section", "library library--unavailable");
    root.setAttribute("role", "alert");

    var box = el("div", "storage-error");
    box.appendChild(el("h1", "storage-error__title", "No se puede guardar nada en este navegador"));
    box.appendChild(
      el(
        "p",
        "storage-error__text",
        "Waypoint guarda tus mapas en el almacenamiento del navegador (IndexedDB), y no está disponible."
      )
    );

    var tips = el("ul", "storage-error__tips");
    [
      "Abre Waypoint en Chrome o Edge.",
      "Si estás en una ventana de incógnito o invitado, usa una ventana normal.",
      "Comprueba que el navegador no bloquea los datos de sitios (Configuración → Privacidad).",
    ].forEach(function (tip) {
      tips.appendChild(el("li", null, tip));
    });
    box.appendChild(tips);

    var retry = el("button", "btn btn--primary", "Reintentar");
    retry.type = "button";
    retry.addEventListener("click", function () {
      window.location.reload();
    });
    box.appendChild(retry);

    root.appendChild(box);
    container.appendChild(root);
  }

  Waypoint.ui.libraryView = { mount: mount, mountUnavailable: mountUnavailable };
})(window.Waypoint);
