/*
 * Repositorio de textos: CRUD sobre el store "labels" (SPEC 10).
 * No toca el DOM ni conoce la UI.
 *
 * El borrado en cascada de mapas y juegos ya vive en maps-repository y games-repository.
 * Los errores de IndexedDB (p. ej. QuotaExceededError) se propagan tal cual,
 * para que la capa de servicios decida qué hacer.
 */
(function (Waypoint) {
  "use strict";

  var db = Waypoint.data.db;
  var STORES = db.STORES;

  /** Promesa que se resuelve cuando la transacción termina con éxito. */
  function done(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () {
        resolve();
      };
      // Un error en cualquier petición aborta la transacción (no se llama a preventDefault).
      tx.onabort = function () {
        reject(tx.error || new DOMException("Transacción abortada", "AbortError"));
      };
    });
  }

  /** Promesa con el resultado de una petición IDB. */
  function result(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function transaction(mode) {
    return db.open().then(function (conn) {
      return conn.transaction(STORES.labels, mode);
    });
  }

  /**
   * Guarda un texto nuevo.
   * @param {object} label  Registro completo del store "labels".
   * @returns {Promise<void>}
   */
  function add(label) {
    return transaction("readwrite").then(function (tx) {
      tx.objectStore(STORES.labels).add(label);
      return done(tx);
    });
  }

  /**
   * Textos de un mapa (índice "mapId"), sin ordenar.
   * @param {string} mapId
   * @returns {Promise<object[]>}
   */
  function listByMap(mapId) {
    return transaction("readonly").then(function (tx) {
      return result(tx.objectStore(STORES.labels).index("mapId").getAll(mapId));
    });
  }

  /**
   * Textos de varios mapas, en una sola transacción, sin ordenar.
   * @param {string[]} mapIds
   * @returns {Promise<object[]>}
   */
  function listByMaps(mapIds) {
    if (!mapIds || mapIds.length === 0) {
      return Promise.resolve([]);
    }
    return transaction("readonly").then(function (tx) {
      var index = tx.objectStore(STORES.labels).index("mapId");
      return Promise.all(
        mapIds.map(function (mapId) {
          return result(index.getAll(mapId));
        })
      ).then(function (lists) {
        return [].concat.apply([], lists);
      });
    });
  }

  /**
   * Aplica cambios parciales a un texto. El id no se puede cambiar.
   * @param {string} id
   * @param {object} changes
   * @returns {Promise<object|null>} El texto actualizado, o null si no existe.
   */
  function update(id, changes) {
    return transaction("readwrite").then(function (tx) {
      var store = tx.objectStore(STORES.labels);
      var updated = null;

      var request = store.get(id);
      request.onsuccess = function () {
        var current = request.result;
        if (!current) {
          return;
        }
        updated = Object.assign({}, current, changes, { id: current.id });
        store.put(updated);
      };

      return done(tx).then(function () {
        return updated;
      });
    });
  }

  /**
   * Borra un texto. Borrar un id inexistente no es un error.
   * @param {string} id
   * @returns {Promise<void>}
   */
  function remove(id) {
    return transaction("readwrite").then(function (tx) {
      tx.objectStore(STORES.labels).delete(id);
      return done(tx);
    });
  }

  Waypoint.data.labelsRepository = {
    add: add,
    listByMap: listByMap,
    listByMaps: listByMaps,
    update: update,
    remove: remove,
  };
})(window.Waypoint);
