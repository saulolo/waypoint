/*
 * Servicio de textos sobre el mapa (SPEC 10): validar, crear, listar, mover, editar (SPEC 11) y borrar.
 * Usa los mismos colores que los pines (markerService.COLORS).
 * No toca el DOM de la UI.
 */
(function (Waypoint) {
  "use strict";

  var repository = Waypoint.data.labelsRepository;
  var mapService = Waypoint.services.mapService;
  var markerService = Waypoint.services.markerService;

  var COLORS = markerService.COLORS;
  var SIZE = { min: 8, max: 32, step: 2, default: 12 };
  var DEFAULT_STYLE = { color: "white", size: 12 };
  var TEXT_MAX_LENGTH = 40;
  var NOTE_MAX_LENGTH = 500;

  function InvalidLabelError(message) {
    this.name = "InvalidLabelError";
    this.message = message;
  }
  InvalidLabelError.prototype = Object.create(Error.prototype);
  InvalidLabelError.prototype.constructor = InvalidLabelError;

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
   * Valida los campos de un texto (al crear y al editar).
   * @returns {object} Los campos normalizados (texto sin espacios en los extremos, nota "" si falta).
   * @throws {InvalidLabelError}
   */
  function validate(fields) {
    var f = fields || {};
    if (!isRelative(f.x) || !isRelative(f.y)) {
      throw new InvalidLabelError("La posición debe estar entre 0 y 1.");
    }
    var text = String(f.text == null ? "" : f.text).trim();
    if (text.length < 1 || text.length > TEXT_MAX_LENGTH) {
      throw new InvalidLabelError("El texto debe tener entre 1 y " + TEXT_MAX_LENGTH + " caracteres.");
    }
    var note = f.note == null ? "" : String(f.note);
    if (note.length > NOTE_MAX_LENGTH) {
      throw new InvalidLabelError("La nota no puede pasar de " + NOTE_MAX_LENGTH + " caracteres.");
    }
    if (COLORS.indexOf(f.color) === -1) {
      throw new InvalidLabelError("Color no válido: " + f.color);
    }
    if (!isValidSize(f.size)) {
      throw new InvalidLabelError("Tamaño no válido: " + f.size);
    }
    return { x: f.x, y: f.y, text: text, note: note, color: f.color, size: f.size };
  }

  /**
   * Crea y guarda un texto.
   * @param {string} mapId
   * @param {{x, y, text, note, color, size}} fields
   * @returns {Promise<object>} El texto guardado. Rechaza con InvalidLabelError sin escribir nada.
   */
  function create(mapId, fields) {
    var valid;
    try {
      valid = validate(fields);
    } catch (error) {
      return Promise.reject(error);
    }
    var label = {
      id: crypto.randomUUID(),
      mapId: mapId,
      x: valid.x,
      y: valid.y,
      text: valid.text,
      note: valid.note,
      color: valid.color,
      size: valid.size,
      createdAt: Date.now(),
    };
    return repository.add(label).then(function () {
      return label;
    });
  }

  /**
   * @param {string} mapId
   * @returns {Promise<object[]>} Textos del mapa, del más antiguo al más reciente.
   */
  function listByMap(mapId) {
    return repository.listByMap(mapId).then(function (labels) {
      return labels.sort(function (a, b) {
        return a.createdAt - b.createdAt;
      });
    });
  }

  /**
   * Mueve un texto: solo cambia x/y (createdAt no cambia).
   * @param {string} id
   * @param {number} x  0–1
   * @param {number} y  0–1
   * @returns {Promise<object>} El texto actualizado.
   *   Rechaza con InvalidLabelError (sin escribir) si x/y salen de 0–1, o si el texto no existe.
   */
  function move(id, x, y) {
    if (!isRelative(x) || !isRelative(y)) {
      return Promise.reject(new InvalidLabelError("La posición debe estar entre 0 y 1."));
    }
    return repository.update(id, { x: x, y: y }).then(function (label) {
      if (!label) {
        throw new InvalidLabelError("El texto no existe: " + id);
      }
      return label;
    });
  }

  /**
   * Edita un texto (SPEC 11): posición y campos, con las mismas reglas que create.
   * Conserva id, mapId y createdAt.
   * @param {string} id
   * @param {{x, y, text, note, color, size}} fields
   * @returns {Promise<object>} El texto actualizado.
   *   Rechaza con InvalidLabelError (sin escribir) si un campo no es válido, o si el texto no existe.
   */
  function update(id, fields) {
    var valid;
    try {
      valid = validate(fields);
    } catch (error) {
      return Promise.reject(error);
    }
    return repository.update(id, valid).then(function (label) {
      if (!label) {
        throw new InvalidLabelError("El texto no existe: " + id);
      }
      return label;
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  function remove(id) {
    return repository.remove(id);
  }

  Waypoint.services.labelService = {
    COLORS: COLORS,
    SIZE: SIZE,
    DEFAULT_STYLE: DEFAULT_STYLE,
    TEXT_MAX_LENGTH: TEXT_MAX_LENGTH,
    NOTE_MAX_LENGTH: NOTE_MAX_LENGTH,
    InvalidLabelError: InvalidLabelError,
    isQuotaError: mapService.isQuotaError,
    create: create,
    listByMap: listByMap,
    move: move,
    update: update,
    remove: remove,
  };
})(window.Waypoint);
