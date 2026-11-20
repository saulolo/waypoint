/*
 * Servicio de juegos: crear, listar, renombrar, cambiar portada, borrar y marcar como usado.
 * Orquesta image-service (portadas) y games-repository (persistencia).
 * No toca el DOM de la UI.
 */
(function (Waypoint) {
  "use strict";

  var repository = Waypoint.data.gamesRepository;
  var imageService = Waypoint.services.imageService;

  var NAME_MAX_LENGTH = 100;

  function GameNotFoundError(id) {
    this.name = "GameNotFoundError";
    this.gameId = id;
    this.message = "El juego no existe: " + id;
  }
  GameNotFoundError.prototype = Object.create(Error.prototype);
  GameNotFoundError.prototype.constructor = GameNotFoundError;

  function InvalidNameError(message) {
    this.name = "InvalidNameError";
    this.message = message;
  }
  InvalidNameError.prototype = Object.create(Error.prototype);
  InvalidNameError.prototype.constructor = InvalidNameError;

  /**
   * Normaliza un nombre de juego: trim y 1–100 caracteres.
   * @returns {string|null} El nombre válido, o null si no lo es.
   */
  function normalizeName(name) {
    var trimmed = String(name == null ? "" : name).trim();
    if (trimmed.length < 1 || trimmed.length > NAME_MAX_LENGTH) {
      return null;
    }
    return trimmed;
  }

  function invalidName() {
    return new InvalidNameError("El nombre debe tener entre 1 y " + NAME_MAX_LENGTH + " caracteres.");
  }

  /**
   * Orden del inicio: lastUsedAt descendente; los nunca usados después,
   * por createdAt descendente.
   */
  function compareForHome(a, b) {
    var aUsed = a.lastUsedAt != null;
    var bUsed = b.lastUsedAt != null;
    if (aUsed && bUsed) {
      return b.lastUsedAt - a.lastUsedAt;
    }
    if (aUsed !== bUsed) {
      return aUsed ? -1 : 1;
    }
    return b.createdAt - a.createdAt;
  }

  /** Convierte un blob de portada en la versión WebP reducida, o null si no hay portada. */
  function prepareCover(blob) {
    return blob ? imageService.createCover(blob) : Promise.resolve(null);
  }

  /**
   * Crea un juego.
   * @param {string} name  1–100 caracteres tras trim.
   * @param {Blob|File|null} [coverBlob]  Portada opcional (JPG, PNG o WebP).
   * @returns {Promise<object>} El juego creado.
   *   Rechaza con InvalidNameError o InvalidImageError.
   */
  function create(name, coverBlob) {
    var normalized = normalizeName(name);
    if (!normalized) {
      return Promise.reject(invalidName());
    }
    return prepareCover(coverBlob).then(function (cover) {
      var now = Date.now();
      return repository.add({
        id: crypto.randomUUID(),
        name: normalized,
        cover: cover,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: null,
      });
    });
  }

  /**
   * @returns {Promise<object[]>} Juegos en el orden del inicio, cada uno con `mapCount`.
   */
  function listSorted() {
    return repository.list().then(function (games) {
      return Promise.all(
        games.map(function (game) {
          return repository.countMaps(game.id).then(function (count) {
            return Object.assign({}, game, { mapCount: count });
          });
        })
      ).then(function (withCount) {
        return withCount.sort(compareForHome);
      });
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<object>} Rechaza con GameNotFoundError.
   */
  function get(id) {
    return repository.get(id).then(function (game) {
      if (!game) {
        throw new GameNotFoundError(id);
      }
      return game;
    });
  }

  function updateOrThrow(id, changes) {
    return repository.update(id, changes).then(function (game) {
      if (!game) {
        throw new GameNotFoundError(id);
      }
      return game;
    });
  }

  /**
   * @param {string} id
   * @param {string} name  1–100 caracteres tras trim.
   * @returns {Promise<object>} El juego actualizado.
   *   Rechaza con InvalidNameError o GameNotFoundError.
   */
  function rename(id, name) {
    var normalized = normalizeName(name);
    if (!normalized) {
      return Promise.reject(invalidName());
    }
    return updateOrThrow(id, { name: normalized, updatedAt: Date.now() });
  }

  /**
   * Cambia la portada de un juego, o la quita si recibe null.
   * @param {string} id
   * @param {Blob|File|null} blob
   * @returns {Promise<object>} El juego actualizado.
   *   Rechaza con InvalidImageError o GameNotFoundError.
   */
  function setCover(id, blob) {
    return prepareCover(blob).then(function (cover) {
      return updateOrThrow(id, { cover: cover, updatedAt: Date.now() });
    });
  }

  /**
   * Borra un juego con todos sus mapas, imágenes y marcadores.
   * @param {string} id
   * @returns {Promise<void>}
   */
  function remove(id) {
    return repository.remove(id);
  }

  /**
   * Marca el juego como usado ahora (abrirlo o abrir uno de sus mapas).
   * @param {string} id
   * @returns {Promise<object>} Rechaza con GameNotFoundError.
   */
  function touch(id) {
    return updateOrThrow(id, { lastUsedAt: Date.now() });
  }

  Waypoint.services.gameService = {
    NAME_MAX_LENGTH: NAME_MAX_LENGTH,
    GameNotFoundError: GameNotFoundError,
    InvalidNameError: InvalidNameError,
    normalizeName: normalizeName,
    create: create,
    listSorted: listSorted,
    get: get,
    rename: rename,
    setCover: setCover,
    remove: remove,
    touch: touch,
  };
})(window.Waypoint);
