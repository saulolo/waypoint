/*
 * Servicio de imágenes: validar tipo, medir, generar miniatura y detectar imágenes grandes.
 * No toca el DOM de la UI; usa createImageBitmap y OffscreenCanvas.
 */
(function (Waypoint) {
  "use strict";

  var ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  var EXTENSION_TYPES = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };

  // Tipos que el navegador asigna cuando no sabe qué es el archivo: ahí la extensión decide.
  var UNKNOWN_TYPES = ["", "application/octet-stream"];

  var LARGE_MAX_SIDE_PX = 16384;
  var LARGE_MAX_BYTES = 100 * 1024 * 1024;

  var THUMBNAIL_MAX_SIDE_PX = 320;
  var THUMBNAIL_TYPE = "image/webp";
  var THUMBNAIL_QUALITY = 0.8;

  /**
   * Error de imagen no válida.
   * reason: "unsupported-type" (no es JPG/PNG/WebP) | "decode-failed" (no se pudo leer).
   */
  function InvalidImageError(reason, fileName, cause) {
    this.name = "InvalidImageError";
    this.reason = reason;
    this.fileName = fileName;
    this.cause = cause;
    this.message =
      reason === "unsupported-type"
        ? "Formato no admitido: " + fileName
        : "No se pudo leer la imagen: " + fileName;
  }
  InvalidImageError.prototype = Object.create(Error.prototype);
  InvalidImageError.prototype.constructor = InvalidImageError;

  function extensionOf(fileName) {
    var dot = fileName.lastIndexOf(".");
    return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
  }

  /**
   * Devuelve el MIME admitido del archivo, o null si no es JPG, PNG ni WebP.
   * Usa file.type y, si el navegador no lo conoce, la extensión como respaldo.
   * @param {File} file
   * @returns {string|null}
   */
  function detectMimeType(file) {
    var type = (file.type || "").toLowerCase();

    if (ACCEPTED_TYPES.indexOf(type) !== -1) {
      return type;
    }
    if (UNKNOWN_TYPES.indexOf(type) !== -1) {
      return EXTENSION_TYPES[extensionOf(file.name || "")] || null;
    }
    return null;
  }

  /**
   * Mide la imagen decodificándola con createImageBitmap.
   * @param {Blob} blob
   * @param {string} fileName  Solo para el mensaje de error.
   * @returns {Promise<{width: number, height: number}>}
   */
  function getDimensions(blob, fileName) {
    return createImageBitmap(blob)
      .then(function (bitmap) {
        var size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
      })
      .catch(function (error) {
        throw new InvalidImageError("decode-failed", fileName, error);
      });
  }

  /**
   * Indica si una imagen supera los límites de aviso (16384 px en algún lado o 100 MB).
   * @param {{width: number, height: number, fileSize: number}} info
   * @returns {{isLarge: boolean, tooManyPixels: boolean, tooHeavy: boolean}}
   */
  function detectLarge(info) {
    var tooManyPixels = info.width > LARGE_MAX_SIDE_PX || info.height > LARGE_MAX_SIDE_PX;
    var tooHeavy = info.fileSize > LARGE_MAX_BYTES;
    return { isLarge: tooManyPixels || tooHeavy, tooManyPixels: tooManyPixels, tooHeavy: tooHeavy };
  }

  /**
   * Valida y mide un archivo. No genera la miniatura: eso se hace tras el aviso de imagen grande.
   * @param {File} file
   * @returns {Promise<{mimeType: string, width: number, height: number, fileSize: number,
   *   large: {isLarge: boolean, tooManyPixels: boolean, tooHeavy: boolean}}>}
   *   Rechaza con InvalidImageError si el archivo no es una imagen admitida.
   */
  function inspect(file) {
    var mimeType = detectMimeType(file);
    if (!mimeType) {
      return Promise.reject(new InvalidImageError("unsupported-type", file.name));
    }

    return getDimensions(file, file.name).then(function (size) {
      var info = {
        mimeType: mimeType,
        width: size.width,
        height: size.height,
        fileSize: file.size,
      };
      info.large = detectLarge(info);
      return info;
    });
  }

  /**
   * Genera la miniatura WebP con el lado mayor a 320 px (las imágenes más pequeñas no se amplían).
   * El redimensionado lo hace createImageBitmap para no decodificar la imagen entera en un canvas.
   * @param {Blob} blob
   * @param {number} width   Ancho original.
   * @param {number} height  Alto original.
   * @returns {Promise<Blob>}
   */
  function createThumbnail(blob, width, height) {
    var scale = Math.min(1, THUMBNAIL_MAX_SIDE_PX / Math.max(width, height));
    var thumbWidth = Math.max(1, Math.round(width * scale));
    var thumbHeight = Math.max(1, Math.round(height * scale));

    return createImageBitmap(blob, {
      resizeWidth: thumbWidth,
      resizeHeight: thumbHeight,
      resizeQuality: "high",
    }).then(function (bitmap) {
      var canvas = new OffscreenCanvas(thumbWidth, thumbHeight);
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.convertToBlob({ type: THUMBNAIL_TYPE, quality: THUMBNAIL_QUALITY });
    });
  }

  Waypoint.services.imageService = {
    ACCEPTED_TYPES: ACCEPTED_TYPES,
    LARGE_MAX_SIDE_PX: LARGE_MAX_SIDE_PX,
    LARGE_MAX_BYTES: LARGE_MAX_BYTES,
    THUMBNAIL_MAX_SIDE_PX: THUMBNAIL_MAX_SIDE_PX,
    InvalidImageError: InvalidImageError,
    detectMimeType: detectMimeType,
    detectLarge: detectLarge,
    inspect: inspect,
    createThumbnail: createThumbnail,
  };
})(window.Waypoint);
