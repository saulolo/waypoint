/*
 * Repositorio de juegos: CRUD sobre el store "games".
 * El borrado en cascada toca también "maps", "images", "markers" y "labels".
 * No toca el DOM ni conoce la UI.
 *
 * Las operaciones que tocan varios stores (remove) usan una sola transacción:
 * o se aplica todo o nada.
 * Los errores de IndexedDB se propagan tal cual, para que la capa de servicios decida qué hacer.
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

  function transaction(storeNames, mode) {
    return db.open().then(function (conn) {
      return conn.transaction(storeNames, mode);
    });
  }

  /**
   * Guarda un juego nuevo.
   * @param {object} game  Registro completo del store "games".
   * @returns {Promise<object>} El juego guardado.
   */
  function add(game) {
    return transaction(STORES.games, "readwrite").then(function (tx) {
      tx.objectStore(STORES.games).add(game);
      return done(tx).then(function () {
        return game;
      });
    });
  }

  /**
   * Lista todos los juegos (con su portada), sin ordenar.
   * @returns {Promise<object[]>}
   */
  function list() {
    return transaction(STORES.games, "readonly").then(function (tx) {
      return result(tx.objectStore(STORES.games).getAll());
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<object|null>} El juego, o null si no existe.
   */
  function get(id) {
    return transaction(STORES.games, "readonly").then(function (tx) {
      return result(tx.objectStore(STORES.games).get(id)).then(function (game) {
        return game || null;
      });
    });
  }

  /**
   * Aplica cambios parciales a un juego. El id no se puede cambiar.
   * @param {string} id
   * @param {object} changes
   * @returns {Promise<object|null>} El juego actualizado, o null si no existe.
   */
  function update(id, changes) {
    return transaction(STORES.games, "readwrite").then(function (tx) {
      var store = tx.objectStore(STORES.games);
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
   * Borra un juego y, en cascada, sus mapas, imágenes, marcadores y textos, en una sola transacción.
   * @param {string} id
   * @returns {Promise<void>}
   */
  function remove(id) {
    var names = [STORES.games, STORES.maps, STORES.images, STORES.markers, STORES.labels];
    return transaction(names, "readwrite").then(function (tx) {
      var maps = tx.objectStore(STORES.maps);
      var images = tx.objectStore(STORES.images);
      var markers = tx.objectStore(STORES.markers);
      var labels = tx.objectStore(STORES.labels);

      tx.objectStore(STORES.games).delete(id);

      var mapKeys = maps.index("gameId").getAllKeys(id);
      mapKeys.onsuccess = function () {
        mapKeys.result.forEach(function (mapId) {
          maps.delete(mapId);
          images.delete(mapId);
          deleteByMap(markers, mapId);
          deleteByMap(labels, mapId);
        });
      };

      return done(tx);
    });
  }

  /**
   * Cuenta los mapas de un juego con el índice "gameId", sin leerlos.
   * @param {string} gameId
   * @returns {Promise<number>}
   */
  function countMaps(gameId) {
    return transaction(STORES.maps, "readonly").then(function (tx) {
      return result(tx.objectStore(STORES.maps).index("gameId").count(gameId));
    });
  }

  Waypoint.data.gamesRepository = {
    add: add,
    list: list,
    get: get,
    update: update,
    remove: remove,
    countMaps: countMaps,
  };
})(window.Waypoint);
