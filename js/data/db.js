/*
 * Conexión a IndexedDB.
 * Base "waypoint", esquema v2: stores "games", "maps", "images" y "markers".
 * No toca el DOM ni conoce la UI.
 *
 * Migraciones: añadir un caso en MIGRATIONS por cada versión nueva y subir DB_VERSION.
 * Cada migración recibe (db, tx) y se aplica en orden desde oldVersion + 1 hasta DB_VERSION.
 */
(function (Waypoint) {
  "use strict";

  var DB_NAME = "waypoint";
  var DB_VERSION = 2;

  var STORES = {
    games: "games",
    maps: "maps",
    images: "images",
    markers: "markers",
  };

  var MIGRATIONS = {
    1: function (db) {
      // Metadatos ligeros. Listar la biblioteca solo lee este store.
      db.createObjectStore(STORES.maps, { keyPath: "id" });

      // Imagen original pesada. Solo se lee al abrir el visor.
      db.createObjectStore(STORES.images, { keyPath: "mapId" });

      // Vacío en SPEC 01; SPEC 04 define el resto de campos.
      var markers = db.createObjectStore(STORES.markers, { keyPath: "id" });
      markers.createIndex("mapId", "mapId", { unique: false });
    },

    // SPEC 03: todo mapa pertenece a un juego. Los datos de v1 se descartan (aceptado por el usuario).
    2: function (db, tx) {
      tx.objectStore(STORES.maps).clear();
      tx.objectStore(STORES.images).clear();
      tx.objectStore(STORES.markers).clear();

      // Carpeta de juego con portada (Blob WebP o null).
      db.createObjectStore(STORES.games, { keyPath: "id" });

      tx.objectStore(STORES.maps).createIndex("gameId", "gameId", { unique: false });
    },
  };

  var dbPromise = null;

  function DbUnavailableError(message, cause) {
    this.name = "DbUnavailableError";
    this.message = message;
    this.cause = cause;
  }
  DbUnavailableError.prototype = Object.create(Error.prototype);
  DbUnavailableError.prototype.constructor = DbUnavailableError;

  function upgrade(db, tx, oldVersion, newVersion) {
    for (var version = oldVersion + 1; version <= newVersion; version++) {
      var migrate = MIGRATIONS[version];
      if (migrate) {
        migrate(db, tx);
      }
    }
  }

  /**
   * Abre la base de datos (una sola vez) y la devuelve.
   * @returns {Promise<IDBDatabase>}
   */
  function open() {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise(function (resolve, reject) {
      var request;

      try {
        if (!window.indexedDB) {
          throw new Error("indexedDB no está definido");
        }
        request = window.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(new DbUnavailableError("IndexedDB no está disponible en este navegador.", error));
        return;
      }

      request.onupgradeneeded = function (event) {
        upgrade(request.result, request.transaction, event.oldVersion, event.newVersion || DB_VERSION);
      };

      request.onsuccess = function () {
        var db = request.result;
        // Si otra pestaña abre una versión más nueva, cerrar para no bloquearla.
        db.onversionchange = function () {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = function () {
        reject(new DbUnavailableError("No se pudo abrir la base de datos.", request.error));
      };

      request.onblocked = function () {
        console.warn("[db] Apertura bloqueada: cierra otras pestañas de Waypoint.");
      };
    });

    // Si falla, permitir reintentar en la siguiente llamada.
    dbPromise.catch(function () {
      dbPromise = null;
    });

    return dbPromise;
  }

  /**
   * Pide almacenamiento persistente para reducir el riesgo de que el navegador borre los datos.
   * @returns {Promise<boolean>} true si el almacenamiento es persistente.
   */
  function requestPersistence() {
    if (!navigator.storage || !navigator.storage.persist) {
      return Promise.resolve(false);
    }
    return navigator.storage
      .persisted()
      .then(function (alreadyPersisted) {
        return alreadyPersisted || navigator.storage.persist();
      })
      .catch(function () {
        return false;
      });
  }

  Waypoint.data.db = {
    STORES: STORES,
    DbUnavailableError: DbUnavailableError,
    open: open,
    requestPersistence: requestPersistence,
  };
})(window.Waypoint);
