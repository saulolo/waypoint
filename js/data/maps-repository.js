/*
 * Repositorio de mapas: CRUD sobre los stores "maps", "images", "markers" y "labels".
 * No toca el DOM ni conoce la UI.
 *
 * Las operaciones que tocan varios stores (add, remove) usan una sola transacción:
 * o se aplica todo o nada.
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
      // Un error en cualquier petición aborta la transacción (no se llama a preventDefault),
      // así ningún cambio parcial llega a guardarse.
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

  function transaction(storeNames, mode) {
    return db.open().then(function (conn) {
      return conn.transaction(storeNames, mode);
    });
  }

  /**
   * Guarda un mapa nuevo y su imagen original en una sola transacción.
   * @param {object} map  Registro completo del store "maps".
   * @param {Blob} blob   Imagen original, sin recomprimir.
   * @returns {Promise<object>} El mapa guardado.
   */
  function add(map, blob) {
    return transaction([STORES.maps, STORES.images], "readwrite").then(function (tx) {
      tx.objectStore(STORES.maps).add(map);
      tx.objectStore(STORES.images).add({ mapId: map.id, blob: blob });
      return done(tx).then(function () {
        return map;
      });
    });
  }

  /**
   * Lista los metadatos de todos los mapas (sin la imagen original), sin ordenar.
   * @returns {Promise<object[]>}
   */
  function list() {
    return transaction(STORES.maps, "readonly").then(function (tx) {
      return result(tx.objectStore(STORES.maps).getAll());
    });
  }

  /**
   * Lista los metadatos de los mapas de un juego (índice "gameId"), sin ordenar.
   * @param {string} gameId
   * @returns {Promise<object[]>}
   */
  function listByGame(gameId) {
    return transaction(STORES.maps, "readonly").then(function (tx) {
      return result(tx.objectStore(STORES.maps).index("gameId").getAll(gameId));
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<object|null>} Metadatos del mapa, o null si no existe.
   */
  function get(id) {
    return transaction(STORES.maps, "readonly").then(function (tx) {
      return result(tx.objectStore(STORES.maps).get(id)).then(function (map) {
        return map || null;
      });
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<Blob|null>} Imagen original, o null si no existe.
   */
  function getImage(id) {
    return transaction(STORES.images, "readonly").then(function (tx) {
      return result(tx.objectStore(STORES.images).get(id)).then(function (record) {
        return record ? record.blob : null;
      });
    });
  }

  /**
   * Aplica cambios parciales a un mapa. El id no se puede cambiar.
   * @param {string} id
   * @param {object} changes
   * @returns {Promise<object|null>} El mapa actualizado, o null si no existe.
   */
  function update(id, changes) {
    return transaction(STORES.maps, "readwrite").then(function (tx) {
      var store = tx.objectStore(STORES.maps);
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

  /** Borra los registros de un store con índice "mapId" que pertenecen a un mapa. */
  function deleteByMap(store, mapId) {
    var keysRequest = store.index("mapId").getAllKeys(mapId);
    keysRequest.onsuccess = function () {
      keysRequest.result.forEach(function (key) {
        store.delete(key);
      });
    };
  }

  /**
   * Borra un mapa, su imagen y todos sus marcadores y textos en una sola transacción.
   * @param {string} id
   * @returns {Promise<void>}
   */
  function remove(id) {
    var names = [STORES.maps, STORES.images, STORES.markers, STORES.labels];
    return transaction(names, "readwrite").then(function (tx) {
      tx.objectStore(STORES.maps).delete(id);
      tx.objectStore(STORES.images).delete(id);
      deleteByMap(tx.objectStore(STORES.markers), id);
      deleteByMap(tx.objectStore(STORES.labels), id);
      return done(tx);
    });
  }

  Waypoint.data.mapsRepository = {
    add: add,
    list: list,
    listByGame: listByGame,
    get: get,
    getImage: getImage,
    update: update,
    remove: remove,
  };
})(window.Waypoint);
