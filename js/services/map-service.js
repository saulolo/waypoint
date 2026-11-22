/*
 * Servicio de mapas (dentro de un juego): importar, listar, renombrar, borrar y abrir.
 * Orquesta image-service (imágenes) y maps-repository (persistencia).
 * No toca el DOM de la UI.
 */
(function (Waypoint) {
  "use strict";

  var repository = Waypoint.data.mapsRepository;
  var gameService = Waypoint.services.gameService;
  var imageService = Waypoint.services.imageService;

  var NAME_MAX_LENGTH = 100;
  var DEFAULT_NAME = "Mapa sin nombre";

  function MapNotFoundError(id) {
    this.name = "MapNotFoundError";
    this.mapId = id;
    this.message = "El mapa no existe: " + id;
  }
  MapNotFoundError.prototype = Object.create(Error.prototype);
  MapNotFoundError.prototype.constructor = MapNotFoundError;

  function InvalidNameError(message) {
    this.name = "InvalidNameError";
    this.message = message;
  }
  InvalidNameError.prototype = Object.create(Error.prototype);
  InvalidNameError.prototype.constructor = InvalidNameError;

  /** true si el error indica que no queda espacio de almacenamiento. */
  function isQuotaError(error) {
    return !!error && (error.name === "QuotaExceededError" || (error.cause && error.cause.name === "QuotaExceededError"));
  }

  /**
   * Normaliza un nombre de mapa: trim y 1–100 caracteres.
   * @returns {string|null} El nombre válido, o null si no lo es.
   */
  function normalizeName(name) {
    var trimmed = String(name == null ? "" : name).trim();
    if (trimmed.length < 1 || trimmed.length > NAME_MAX_LENGTH) {
      return null;
    }
    return trimmed;
  }

  /** Nombre por defecto: el del archivo sin extensión, recortado a 100 caracteres. */
  function nameFromFile(fileName) {
    var dot = fileName.lastIndexOf(".");
    var base = (dot > 0 ? fileName.slice(0, dot) : fileName).trim();
    return base.slice(0, NAME_MAX_LENGTH).trim() || DEFAULT_NAME;
  }

  /** Orden alfabético por nombre (localeCompare, sensitivity "base": sin distinguir mayúsculas ni acentos). */
  function compareByName(a, b) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }

  function importOne(gameId, file, info) {
    return imageService.createThumbnail(file, info.width, info.height).then(function (thumbnail) {
      var now = Date.now();
      var map = {
        id: crypto.randomUUID(),
        gameId: gameId,
        name: nameFromFile(file.name),
        width: info.width,
        height: info.height,
        mimeType: info.mimeType,
        fileSize: info.fileSize,
        thumbnail: thumbnail,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: null,
      };
      return repository.add(map, file);
    });
  }

  /**
   * Importa varios archivos en un juego, uno detrás de otro.
   *
   * @param {string} gameId  Juego destino; debe existir.
   * @param {FileList|File[]} files
   * @param {function(File, object): Promise<boolean>} [onLargeImage]
   *   Se llama con (file, info) si la imagen supera los límites de aviso.
   *   Debe resolver true para continuar o false para saltar ese archivo.
   *   Si no se pasa, las imágenes grandes se importan sin preguntar.
   * @returns {Promise<{
   *   imported: object[],
   *   skipped: {fileName: string, reason: "unsupported-type"|"decode-failed"|"cancelled"|"error", error?: Error}[],
   *   quotaExceeded: boolean
   * }>}
   *   Rechaza con GameNotFoundError si el juego no existe.
   *   Si se llena el almacenamiento, se detiene y marca quotaExceeded; los archivos
   *   restantes no se intentan.
   */
  function importFiles(gameId, files, onLargeImage) {
    var list = Array.prototype.slice.call(files || []);
    var report = { imported: [], skipped: [], quotaExceeded: false };

    return gameService
      .get(gameId)
      .then(function () {
        return importAll(gameId, list, report, onLargeImage);
      });
  }

  function importAll(gameId, list, report, onLargeImage) {
    return list
      .reduce(function (chain, file) {
        return chain.then(function () {
          if (report.quotaExceeded) {
            return;
          }

          return imageService
            .inspect(file)
            .then(function (info) {
              if (!info.large.isLarge || typeof onLargeImage !== "function") {
                return info;
              }
              return Promise.resolve(onLargeImage(file, info)).then(function (proceed) {
                return proceed ? info : null;
              });
            })
            .then(function (info) {
              if (!info) {
                report.skipped.push({ fileName: file.name, reason: "cancelled" });
                return;
              }
              return importOne(gameId, file, info).then(function (map) {
                report.imported.push(map);
              });
            })
            .catch(function (error) {
              if (isQuotaError(error)) {
                report.quotaExceeded = true;
                report.skipped.push({ fileName: file.name, reason: "error", error: error });
                return;
              }
              var reason = error instanceof imageService.InvalidImageError ? error.reason : "error";
              report.skipped.push({ fileName: file.name, reason: reason, error: error });
            });
        });
      }, Promise.resolve())
      .then(function () {
        return report;
      });
  }

  /**
   * @param {string} gameId
   * @returns {Promise<object[]>} Mapas del juego en el orden de la biblioteca (alfabético por nombre).
   */
  function listSorted(gameId) {
    return repository.listByGame(gameId).then(function (maps) {
      return maps.sort(compareByName);
    });
  }

  /**
   * @param {string} gameId
   * @returns {Promise<object[]>} Mapas del juego ordenados por nombre; el mismo orden que la biblioteca.
   */
  function listByName(gameId) {
    return listSorted(gameId);
  }

  /**
   * Renombra un mapa.
   * @param {string} id
   * @param {string} name  1–100 caracteres tras trim.
   * @returns {Promise<object>} El mapa actualizado.
   *   Rechaza con InvalidNameError o MapNotFoundError.
   */
  function rename(id, name) {
    var normalized = normalizeName(name);
    if (!normalized) {
      return Promise.reject(
        new InvalidNameError("El nombre debe tener entre 1 y " + NAME_MAX_LENGTH + " caracteres.")
      );
    }
    return repository.update(id, { name: normalized, updatedAt: Date.now() }).then(function (map) {
      if (!map) {
        throw new MapNotFoundError(id);
      }
      return map;
    });
  }

  /**
   * Borra un mapa con su imagen y sus marcadores.
   * @param {string} id
   * @returns {Promise<void>}
   */
  function remove(id) {
    return repository.remove(id);
  }

  /**
   * Abre un mapa: devuelve metadatos + imagen original y actualiza lastOpenedAt
   * del mapa y lastUsedAt de su juego.
   * @param {string} id
   * @returns {Promise<{map: object, blob: Blob}>}  Rechaza con MapNotFoundError.
   */
  function open(id) {
    return Promise.all([repository.get(id), repository.getImage(id)]).then(function (results) {
      var map = results[0];
      var blob = results[1];
      if (!map || !blob) {
        throw new MapNotFoundError(id);
      }
      return repository
        .update(id, { lastOpenedAt: Date.now() })
        .then(function (updated) {
          return gameService.touch(map.gameId).then(function () {
            return { map: updated || map, blob: blob };
          });
        })
        .catch(function (error) {
          // Si no se puede guardar lastOpenedAt o lastUsedAt (p. ej. sin espacio), el mapa se abre igualmente.
          console.warn("[map-service] No se pudo actualizar lastOpenedAt o lastUsedAt:", error);
          return { map: map, blob: blob };
        });
    });
  }

  Waypoint.services.mapService = {
    NAME_MAX_LENGTH: NAME_MAX_LENGTH,
    MapNotFoundError: MapNotFoundError,
    InvalidNameError: InvalidNameError,
    isQuotaError: isQuotaError,
    normalizeName: normalizeName,
    importFiles: importFiles,
    listSorted: listSorted,
    listByName: listByName,
    rename: rename,
    remove: remove,
    open: open,
  };
})(window.Waypoint);
