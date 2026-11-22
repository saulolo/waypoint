/*
 * Servicio de marcadores (pines, SPEC 08): validar, crear, listar, mover, borrar y
 * deducir el estilo del último pin guardado en un juego.
 * No conoce el catálogo de iconos (es presentación, vive en js/ui/pin-icons.js):
 * solo comprueba que `icon` sea un texto no vacío. El nombre por defecto lo pone la UI.
 * No toca el DOM de la UI.
 */
(function (Waypoint) {
  "use strict";

  var repository = Waypoint.data.markersRepository;
  var mapsRepository = Waypoint.data.mapsRepository;
  var mapService = Waypoint.services.mapService;

  var COLORS = ["gold", "white", "black", "red", "orange", "green", "cyan", "violet"];
  var SIZE = { min: 20, max: 64, step: 4, default: 32 };
  var DEFAULT_STYLE = { icon: "exclamation", color: "gold", size: 32 };
  var NAME_MAX_LENGTH = 60;
  var NOTE_MAX_LENGTH = 500;

  function InvalidMarkerError(message) {
    this.name = "InvalidMarkerError";
    this.message = message;
  }
  InvalidMarkerError.prototype = Object.create(Error.prototype);
  InvalidMarkerError.prototype.constructor = InvalidMarkerError;

  function isRelative(value) {
    return typeof value === "number" && isFinite(value) && value >= 0 && value <= 1;
  }

  function isValidSize(size) {
    return (
      typeof size === "number" &&
      size >= SIZE.min &&
      size <= SIZE.max &&
      (size - SIZE.min) % SIZE.step === 0
    );
  }

  /**
   * Valida los campos de un pin nuevo.
   * @returns {object} Los campos normalizados (nombre sin espacios en los extremos, nota "" si falta).
   * @throws {InvalidMarkerError}
   */
  function validate(fields) {
    var f = fields || {};
    if (!isRelative(f.x) || !isRelative(f.y)) {
      throw new InvalidMarkerError("La posición debe estar entre 0 y 1.");
    }
    var name = String(f.name == null ? "" : f.name).trim();
    if (name.length < 1 || name.length > NAME_MAX_LENGTH) {
      throw new InvalidMarkerError("El nombre debe tener entre 1 y " + NAME_MAX_LENGTH + " caracteres.");
    }
    var note = f.note == null ? "" : String(f.note);
    if (note.length > NOTE_MAX_LENGTH) {
      throw new InvalidMarkerError("La nota no puede pasar de " + NOTE_MAX_LENGTH + " caracteres.");
    }
    if (COLORS.indexOf(f.color) === -1) {
      throw new InvalidMarkerError("Color no válido: " + f.color);
    }
    if (!isValidSize(f.size)) {
      throw new InvalidMarkerError("Tamaño no válido: " + f.size);
    }
    if (typeof f.icon !== "string" || f.icon.trim() === "") {
      throw new InvalidMarkerError("Falta el icono.");
    }
    return { x: f.x, y: f.y, name: name, note: note, icon: f.icon, color: f.color, size: f.size };
  }

  /**
   * Crea y guarda un pin.
   * @param {string} mapId
   * @param {{x, y, name, note, icon, color, size}} fields
   * @returns {Promise<object>} El marcador guardado. Rechaza con InvalidMarkerError sin escribir nada.
   */
  function create(mapId, fields) {
    var valid;
    try {
      valid = validate(fields);
    } catch (error) {
      return Promise.reject(error);
    }
    var marker = {
      id: crypto.randomUUID(),
      mapId: mapId,
      x: valid.x,
      y: valid.y,
      name: valid.name,
      note: valid.note,
      icon: valid.icon,
      color: valid.color,
      size: valid.size,
      createdAt: Date.now(),
    };
    return repository.add(marker).then(function () {
      return marker;
    });
  }

  /**
   * @param {string} mapId
   * @returns {Promise<object[]>} Pines del mapa, del más antiguo al más reciente.
   */
  function listByMap(mapId) {
    return repository.listByMap(mapId).then(function (markers) {
      return markers.sort(function (a, b) {
        return a.createdAt - b.createdAt;
      });
    });
  }

  /**
   * Mueve un pin: solo cambia x/y (createdAt no cambia, así no altera "Último usado").
   * @param {string} id
   * @param {number} x  0–1
   * @param {number} y  0–1
   * @returns {Promise<object>} El marcador actualizado.
   *   Rechaza con InvalidMarkerError (sin escribir) si x/y salen de 0–1, o si el pin no existe.
   */
  function move(id, x, y) {
    if (!isRelative(x) || !isRelative(y)) {
      return Promise.reject(new InvalidMarkerError("La posición debe estar entre 0 y 1."));
    }
    return repository.update(id, { x: x, y: y }).then(function (marker) {
      if (!marker) {
        throw new InvalidMarkerError("El pin no existe: " + id);
      }
      return marker;
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  function remove(id) {
    return repository.remove(id);
  }

  /**
   * Estilo del pin guardado más reciente (mayor createdAt) entre los mapas del juego.
   * @param {string} gameId
   * @returns {Promise<{icon, color, size}|null>} null si el juego no tiene pines.
   */
  function lastStyle(gameId) {
    return mapsRepository
      .listByGame(gameId)
      .then(function (maps) {
        return repository.listByMaps(
          maps.map(function (map) {
            return map.id;
          })
        );
      })
      .then(function (markers) {
        var latest = null;
        markers.forEach(function (marker) {
          if (!latest || marker.createdAt > latest.createdAt) {
            latest = marker;
          }
        });
        return latest ? { icon: latest.icon, color: latest.color, size: latest.size } : null;
      });
  }

  Waypoint.services.markerService = {
    COLORS: COLORS,
    SIZE: SIZE,
    DEFAULT_STYLE: DEFAULT_STYLE,
    NAME_MAX_LENGTH: NAME_MAX_LENGTH,
    NOTE_MAX_LENGTH: NOTE_MAX_LENGTH,
    InvalidMarkerError: InvalidMarkerError,
    isQuotaError: mapService.isQuotaError,
    create: create,
    listByMap: listByMap,
    move: move,
    remove: remove,
    lastStyle: lastStyle,
  };
})(window.Waypoint);
