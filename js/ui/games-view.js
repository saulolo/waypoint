/*
 * Inicio (#/): hero, barra "Juegos" y cuadrícula de tarjetas de juego con portada.
 * Nunca accede a IndexedDB: todo pasa por Waypoint.services.gameService.
 */
(function (Waypoint) {
  "use strict";

  var gameService = Waypoint.services.gameService;
  var notice = Waypoint.ui.notice;
  var gameDialog = Waypoint.ui.gameDialog;
  var dialog = Waypoint.ui.dialog;
  var imageService = Waypoint.services.imageService;

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

  /**
   * Monta la vista en el contenedor y devuelve la función de desmontaje.
   * @param {HTMLElement} container
   * @returns {function}
   */
  function mount(container) {
    var alive = true;
    var coverUrls = [];

    var root = el("section", "library games");
    root.setAttribute("aria-labelledby", "games-title");

    // Hero: título, subtítulo con cursor y siluetas flotando (decorativas).
    var hero = el("header", "library-hero");
    hero.appendChild(Waypoint.ui.silhouettes.create());
    hero.appendChild(el("h1", "library-hero__title", "Waypoint"));
    var heroSubtitle = el("p", "library-hero__subtitle");
    var heroSubtitleText = document.createTextNode("");
    heroSubtitle.appendChild(heroSubtitleText);
    heroSubtitle.appendChild(el("span", "blink-cursor", "_"));
    hero.appendChild(heroSubtitle);

    var toolbar = el("div", "library__toolbar");
    var heading = el("div", "library__heading");
    var title = el("h2", "library__title", "Mapas");
    title.id = "games-title";
    heading.appendChild(title);

    var createButton = el("button", "btn btn--primary", "Crear juego");
    createButton.type = "button";

    toolbar.appendChild(heading);
    toolbar.appendChild(createButton);

    var content = el("div", "library__content");

    root.appendChild(hero);
    root.appendChild(toolbar);
    root.appendChild(content);
    container.appendChild(root);

    function revokeCovers() {
      coverUrls.forEach(function (url) {
        URL.revokeObjectURL(url);
      });
      coverUrls = [];
    }

    function renderEmpty() {
      var zone = el("div", "games-empty");
      zone.appendChild(el("h2", "games-empty__title", "Aún no hay juegos"));
      zone.appendChild(el("p", "games-empty__hint", "Crea un juego y carga dentro las imágenes de sus mapas"));
      var button = el("button", "btn btn--primary", "Crear juego");
      button.type = "button";
      button.addEventListener("click", function () {
        createButton.click();
      });
      zone.appendChild(button);
      content.appendChild(zone);
    }

    function renderCard(game) {
      var card = el("article", "game-card");

      var link = el("a", "game-card__link");
      link.href = "#/game/" + encodeURIComponent(game.id);

      var cover = el("div", "game-card__cover");
      if (game.cover) {
        var url = URL.createObjectURL(game.cover);
        coverUrls.push(url);
        var img = el("img", "game-card__img");
        img.src = url;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        cover.appendChild(img);
      } else {
        var placeholder = el("div", "game-placeholder game-placeholder--card", Array.from(game.name)[0].toUpperCase());
        placeholder.setAttribute("aria-hidden", "true");
        cover.appendChild(placeholder);
      }

      var body = el("div", "game-card__body");
      var name = el("h2", "game-card__name", game.name);
      name.title = game.name;
      var meta = el("p", "game-card__meta", plural(game.mapCount, "mapa", "mapas"));

      body.appendChild(name);
      body.appendChild(meta);
      link.appendChild(cover);
      link.appendChild(body);
      card.appendChild(link);
      card.appendChild(renderActions(game));
      return card;
    }

    var ICONS = {
      rename:
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/>' +
        '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
      cover:
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16"/>' +
        '<circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-9 9"/></svg>',
      remove:
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/>' +
        '<path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    };

    function iconButton(action, label, gameName, handler) {
      var node = el("button", "game-card__action game-card__action--" + action);
      node.type = "button";
      node.innerHTML = ICONS[action];
      node.title = label;
      node.setAttribute("aria-label", label + " «" + gameName + "»");
      node.addEventListener("click", handler);
      return node;
    }

    function renderActions(game) {
      var actions = el("div", "game-card__actions");
      actions.appendChild(
        iconButton("rename", "Renombrar", game.name, function () {
          renameGame(game);
        })
      );
      actions.appendChild(
        iconButton("cover", "Cambiar portada de", game.name, function () {
          changeCover(game);
        })
      );
      actions.appendChild(
        iconButton("remove", "Borrar", game.name, function () {
          removeGame(game);
        })
      );
      return actions;
    }

    /** Aviso de error común a las acciones; después refresca por si el estado cambió. */
    function reportError(error, fallback) {
      console.error("[games] " + fallback, error);
      var message = fallback;
      if (error instanceof gameService.GameNotFoundError) {
        message = "Ese juego ya no existe.";
      } else if (error instanceof imageService.InvalidImageError) {
        message = "No se pudo usar esa imagen como portada.";
      } else if (Waypoint.services.mapService.isQuotaError(error)) {
        message = "Sin espacio de almacenamiento.";
      }
      notice.show(message, { type: "error" });
      return refresh();
    }

    function renameGame(game) {
      dialog
        .rename({ title: "Renombrar juego", value: game.name, maxLength: gameService.NAME_MAX_LENGTH })
        .then(function (name) {
          if (name === null || name === game.name) {
            return;
          }
          return gameService.rename(game.id, name).then(refresh);
        })
        .catch(function (error) {
          return reportError(error, "No se pudo renombrar el juego.");
        });
    }

    function changeCover(game) {
      gameDialog
        .open({ mode: "cover", name: game.name, cover: game.cover })
        .then(function (result) {
          // Cancelar o aceptar sin tocar la portada no cambia nada.
          if (!result || result.cover === game.cover) {
            return;
          }
          return gameService.setCover(game.id, result.cover).then(refresh);
        })
        .catch(function (error) {
          return reportError(error, "No se pudo cambiar la portada.");
        });
    }

    function removeGame(game) {
      var detail =
        game.mapCount === 0
          ? "El juego no tiene mapas."
          : "Se " + (game.mapCount === 1 ? "borrará 1 mapa" : "borrarán " + game.mapCount + " mapas") +
            " con sus marcadores.";
      dialog
        .confirm({
          title: "¿Borrar «" + game.name + "»?",
          message: detail + " Esta acción no se puede deshacer.",
          confirmLabel: "Borrar",
          danger: true,
        })
        .then(function (confirmed) {
          if (!confirmed) {
            return;
          }
          return gameService.remove(game.id).then(function () {
            notice.show("Juego borrado: " + game.name, { type: "success" });
            return refresh();
          });
        })
        .catch(function (error) {
          return reportError(error, "No se pudo borrar el juego.");
        });
    }

    function render(games) {
      revokeCovers();
      content.innerHTML = "";

      var isEmpty = games.length === 0;
      root.classList.toggle("library--empty", isEmpty);
      createButton.hidden = isEmpty;
      heroSubtitleText.data = isEmpty ? "CREA UN JUEGO PARA EMPEZAR " : "MI MAPA MI 100% ";

      if (isEmpty) {
        renderEmpty();
        return;
      }
      var grid = el("div", "game-grid");
      games.forEach(function (game) {
        grid.appendChild(renderCard(game));
      });
      content.appendChild(grid);
    }

    function refresh() {
      return gameService.listSorted().then(function (games) {
        if (alive) {
          render(games);
        }
      });
    }

    // ---------- Crear juego ----------

    function createGame() {
      gameDialog
        .open({ mode: "create" })
        .then(function (result) {
          if (!result) {
            return;
          }
          return gameService.create(result.name, result.cover).then(function (game) {
            notice.show("Juego creado: " + game.name, { type: "success" });
            return refresh();
          });
        })
        .catch(function (error) {
          console.error("[games] Error al crear el juego:", error);
          var message = "No se pudo crear el juego.";
          if (error instanceof imageService.InvalidImageError) {
            message = "No se pudo usar esa imagen como portada.";
          } else if (Waypoint.services.mapService.isQuotaError(error)) {
            message = "Sin espacio de almacenamiento.";
          }
          notice.show(message, { type: "error" });
        });
    }

    createButton.addEventListener("click", createGame);

    // ---------- Soltar archivos ----------
    // Los mapas solo se cargan dentro de un juego. Se bloquea el comportamiento del navegador
    // (abrir la imagen y salir de la app) y se avisa.

    function isFileDrag(event) {
      var types = event.dataTransfer && event.dataTransfer.types;
      return !!types && Array.prototype.indexOf.call(types, "Files") !== -1;
    }

    function onDragOver(event) {
      if (isFileDrag(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "none";
      }
    }

    function onDrop(event) {
      if (isFileDrag(event)) {
        event.preventDefault();
        notice.show("Entra en un juego para cargar mapas", { type: "info" });
      }
    }

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    refresh().catch(function (error) {
      console.error("[games] Error al listar los juegos:", error);
      notice.show("No se pudieron cargar los juegos.", { type: "error" });
    });

    return function unmount() {
      alive = false;
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      revokeCovers();
      container.innerHTML = "";
    };
  }

  Waypoint.ui.gamesView = { mount: mount };
})(window.Waypoint);
