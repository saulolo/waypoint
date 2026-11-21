# SPEC 01 — Biblioteca de mapas y visor

> **Estado:** Implementado
> **Depende de:** ninguna
> **Fecha:** 2026-11-20
> **Objetivo:** Cargar imágenes de mapas en el navegador, guardarlas en IndexedDB, listarlas en una biblioteca y abrirlas con zoom y arrastre.

## Por qué existe esta spec

Waypoint es una app web local para seguir el progreso en videojuegos sobre mapas grandes.
El MVP completo (mapas + marcadores marcables como hechos) se divide en dos specs.
Esta SPEC 01 construye la base: la biblioteca, la persistencia y el visor.
Los marcadores llegan en SPEC 06, sobre un modelo de datos que ya los contempla.

Restricciones del proyecto que esta spec fija para todas las siguientes:

- Vanilla JS/HTML/CSS, sin frameworks ni paso de compilación.
- Se abre con doble clic en `index.html` (`file://`), sin servidor y sin conexión a internet.
- Navegadores soportados: Chrome y Edge (Chromium). Firefox no está soportado oficialmente.

## Alcance

**Dentro:**

- Cargar uno o varios mapas desde un selector de archivos o arrastrándolos a la biblioteca.
- Formatos aceptados: JPG, PNG y WebP.
- Por cada mapa se guarda: nombre (por defecto el del archivo sin extensión), dimensiones, imagen original y miniatura.
- Aviso no bloqueante si una imagen supera 16384 px en algún lado o 100 MB, con opción de continuar o cancelar.
- Biblioteca en cuadrícula de tarjetas con miniatura y nombre, ordenada por último abierto primero.
- Estado vacío de la biblioteca con una zona grande para soltar archivos.
- Renombrar un mapa con un `<dialog>` propio.
- Borrar un mapa con confirmación en un `<dialog>` propio.
- Visor a pantalla completa con Leaflet (`CRS.Simple`): zoom, arrastre y barra superior con "← Biblioteca" y el nombre del mapa.
- Navegación por hash: `#/` (biblioteca) y `#/map/<id>` (visor).
- Persistencia completa en IndexedDB que sobrevive a cerrar el navegador y reiniciar el PC.
- Store `markers` creado vacío, listo para SPEC 06.
- Tema visual oscuro inspirado en MapGenie, definido con tokens CSS para poder cambiarlo después.

**Fuera de alcance (para specs futuras):**

- Marcadores: crearlos, editarlos, borrarlos y marcarlos como hechos (SPEC 06).
- Categorías de marcadores con color.
- Rutas entre puntos.
- Tiles para imágenes gigantes.
- Exportar e importar mapas o respaldos.
- Cuentas, sincronización y varios usuarios.
- Soporte oficial de Firefox y Safari.
- Rediseño visual definitivo.

## Modelo de datos

Base de datos IndexedDB `waypoint`, versión de esquema `1`, con tres object stores.

```js
// Store "maps" — keyPath: "id"
// Metadatos ligeros. Listar la biblioteca solo lee este store.
const map = {
  id: "b3f1c2e4-...",        // crypto.randomUUID()
  name: "Lapis",              // 1–100 caracteres tras trim; puede repetirse
  width: 8192,                // px de la imagen original
  height: 6144,               // px de la imagen original
  mimeType: "image/webp",     // "image/jpeg" | "image/png" | "image/webp"
  fileSize: 12582912,         // bytes de la imagen original
  thumbnail: Blob,            // WebP, lado mayor 320 px
  createdAt: 1763600000000,   // epoch ms
  updatedAt: 1763600000000,   // epoch ms; cambia al renombrar
  lastOpenedAt: null,         // epoch ms | null si nunca se abrió
};

// Store "images" — keyPath: "mapId"
// Imagen original pesada. Solo se lee al abrir el visor.
const image = {
  mapId: "b3f1c2e4-...",
  blob: Blob,                 // archivo original, sin recomprimir
};

// Store "markers" — keyPath: "id", índice "mapId" (no único)
// Se crea vacío en esta spec. SPEC 06 define el resto de campos.
const marker = {
  id: "…",
  mapId: "b3f1c2e4-...",
  x: 0.42,                    // 0–1, relativo al ancho de la imagen
  y: 0.17,                    // 0–1, relativo al alto de la imagen
};
```

Convenciones:

- Coordenadas relativas de marcadores: origen arriba a la izquierda, `x` hacia la derecha, `y` hacia abajo, rango 0–1.
- En el visor, la imagen ocupa los bounds `[[0, 0], [height, width]]` de `CRS.Simple`.
- Conversión relativa → Leaflet: `lat = height * (1 - y)`, `lng = width * x`. SPEC 06 la usará; esta spec solo la documenta.
- Orden de la biblioteca: `lastOpenedAt` descendente; los mapas con `lastOpenedAt` nulo van después, ordenados por `createdAt` descendente.
- Borrar un mapa elimina en una sola transacción su registro en `maps`, en `images` y todos sus `markers`.
- Las migraciones futuras van en `onupgradeneeded` de `js/data/db.js`, por número de versión.

## Arquitectura

Capas con dependencia en un solo sentido: `ui → services → data`. Nunca al revés.
Sin ES modules (no cargan con `file://`): scripts clásicos en orden, cada uno registra su API en el namespace global `window.Waypoint`.

```
index.html
css/
  tokens.css            colores, espacios, radios (tema oscuro tipo MapGenie)
  base.css              reset, layout, botones
  library.css           cuadrícula, tarjetas, zona de soltar
  viewer.css            barra superior + contenedor Leaflet
  dialog.css            <dialog> y avisos
js/
  core/
    namespace.js        window.Waypoint = { core, data, services, ui }
    router.js           hash: #/ y #/map/<id>
  data/
    db.js               abre IndexedDB, esquema v1, migraciones
    maps-repository.js  CRUD de maps + images + markers con transacciones
  services/
    image-service.js    validar tipo, medir, generar miniatura, detectar imagen grande
    map-service.js      importar, listar, renombrar, borrar, abrir
  ui/
    dialog.js           diálogos de renombrar y confirmar (<dialog>)
    notice.js           avisos no bloqueantes
    library-view.js     cuadrícula, carga por selector y por arrastre
    viewer-view.js      visor Leaflet CRS.Simple
  app.js                arranque: db → router → vistas
vendor/
  leaflet/              Leaflet 1.9.4 (leaflet.js, leaflet.css, images/)
```

Reglas de capas:

- `data` no toca el DOM ni conoce la UI.
- `services` no toca el DOM de la UI. Puede usar APIs de imagen (`createImageBitmap`, `OffscreenCanvas`).
- `ui` nunca accede a IndexedDB; siempre pasa por `services`.
- `app.js` solo arranca y conecta; no contiene lógica de negocio.

## Plan de implementación

1. Crear el esqueleto: `index.html`, `css/tokens.css`, `css/base.css`, `js/core/namespace.js` y `js/app.js`. Copiar Leaflet 1.9.4 en `vendor/leaflet/` y cargarlo desde `index.html`. Prueba manual: abrir `index.html` con doble clic y ver la cabecera "Waypoint" sin errores en consola.
2. Implementar `js/core/router.js` con las rutas `#/` y `#/map/<id>`, y vistas de marcador de posición. Prueba manual: cambiar el hash a mano y ver cambiar la vista; el botón atrás funciona.
3. Implementar `js/data/db.js`: abrir `waypoint` v1, crear los stores `maps`, `images` y `markers` (con índice `mapId`). Pedir `navigator.storage.persist()`. Prueba manual: DevTools → Application → IndexedDB muestra los tres stores.
4. Implementar `js/data/maps-repository.js`: `add(map, blob)`, `list()`, `get(id)`, `getImage(id)`, `update(id, cambios)` y `remove(id)`. `add` y `remove` usan una sola transacción sobre los stores implicados. Prueba manual: desde la consola, crear, listar y borrar un registro de prueba.
5. Implementar `js/services/image-service.js`: validar MIME (con la extensión como respaldo), obtener dimensiones con `createImageBitmap`, generar miniatura WebP de 320 px de lado mayor y detectar imágenes grandes (>16384 px o >100 MB). Prueba manual: desde la consola, procesar un `File` y ver dimensiones y miniatura.
6. Implementar `js/services/map-service.js`: `importFiles(files, onLargeImage)`, `listSorted()`, `rename(id, name)`, `remove(id)` y `open(id)`. `open` devuelve metadatos + Blob y actualiza `lastOpenedAt`. Prueba manual: desde la consola, importar un archivo y verlo en `listSorted()`.
7. Implementar `js/ui/notice.js` y sus estilos en `css/dialog.css`: avisos no bloqueantes que se cierran solos. Prueba manual: lanzar un aviso desde la consola.
8. Implementar `js/ui/library-view.js` con `css/library.css`: cuadrícula de tarjetas, estado vacío y botón "Cargar mapas" con selector múltiple. Al hacer clic en una tarjeta, navegar a `#/map/<id>`. Prueba manual: cargar dos imágenes y verlas en la cuadrícula.
9. Añadir arrastrar y soltar a la biblioteca: superposición visual al arrastrar y carga de todos los archivos soltados. Los archivos no válidos se saltan con un aviso. Prueba manual: soltar una imagen válida y un `.txt`.
10. Implementar `js/ui/dialog.js`: diálogo de renombrar (no admite nombre vacío; Esc cancela) y diálogo de confirmar. Conectar las acciones "Renombrar" y "Borrar" de cada tarjeta. Prueba manual: renombrar, recargar y ver el nombre nuevo; borrar y ver que desaparece.
11. Conectar el aviso de imagen grande al flujo de importación con el diálogo de confirmar: "Continuar" guarda y "Cancelar" salta ese archivo. Prueba manual: cargar una imagen de más de 16384 px de lado.
12. Implementar `js/ui/viewer-view.js` con `css/viewer.css`: Leaflet con `CRS.Simple`, imagen desde un object URL, ajuste inicial con `fitBounds`, `minZoom` = zoom de ajuste, `maxZoom` = 2 (4× tamaño real), `maxBounds` = bounds de la imagen y `maxBoundsViscosity: 1`. Barra superior con "← Biblioteca" y el nombre. Al salir, destruir el mapa Leaflet y revocar el object URL. Prueba manual: abrir un mapa, hacer zoom y arrastrar, volver.
13. Manejar los estados de error: IndexedDB no disponible (pantalla de error en lugar de la biblioteca), `#/map/<id>` inexistente (vuelve a `#/` con aviso) y `QuotaExceededError` al guardar (aviso "Sin espacio de almacenamiento"). Prueba manual: abrir `#/map/no-existe`.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic en Chrome carga la app sin errores en consola y sin peticiones de red externas.
- [x] Con la biblioteca vacía se ve el estado vacío con la zona para soltar archivos.
- [x] Elegir 3 imágenes (JPG, PNG y WebP) en el selector crea 3 tarjetas con miniatura y el nombre del archivo sin extensión.
- [x] Soltar 2 imágenes sobre la biblioteca crea 2 tarjetas.
- [x] Soltar un archivo `.txt` no crea ninguna tarjeta y muestra un aviso con su nombre.
- [x] Cargar una imagen de más de 16384 px de lado muestra el aviso. "Cancelar" no la guarda y "Continuar" sí.
- [x] En DevTools, cada mapa tiene un registro en `maps` y otro en `images`, con `width` y `height` iguales a los de la imagen original.
- [x] Abrir un mapa lo pone primero en la biblioteca al volver.
- [x] Renombrar un mapa cambia el nombre en la tarjeta y en la barra del visor.
- [x] El diálogo de renombrar no permite guardar un nombre vacío o solo con espacios.
- [x] Pulsar Esc en cualquier diálogo lo cierra sin cambios.
- [x] Borrar pide confirmación. "Cancelar" no borra nada.
- [x] Confirmar el borrado elimina la tarjeta y sus registros en `maps`, `images` y `markers`.
- [x] Clic en una tarjeta abre `#/map/<id>` con la imagen entera ajustada a la ventana.
- [x] En el visor, la rueda del ratón hace zoom y arrastrar mueve la imagen.
- [x] El zoom no baja de "mapa entero visible" ni sube de 4× el tamaño real.
- [x] No se puede arrastrar la imagen fuera de la vista.
- [x] "← Biblioteca" y el botón atrás del navegador vuelven a la biblioteca.
- [x] Recargar (F5) en `#/map/<id>` reabre el mismo mapa.
- [x] Abrir `#/map/no-existe` vuelve a la biblioteca y muestra un aviso.
- [x] Tras cerrar Chrome y reiniciar el PC, los mapas, nombres y miniaturas siguen ahí.
- [x] Ningún archivo de `js/ui/` usa `indexedDB` directamente.
- [x] Ningún archivo de `js/data/` usa `document`.

## Decisiones

- **Sí:** abrir con `file://` y scripts clásicos. Cumple "abrir el HTML" sin servidor.
- **No:** ES modules. No cargan con `file://` por CORS.
- **No:** servidor local (`npx serve`). Añade un paso y una dependencia para arrancar.
- **Sí:** solo Chrome/Edge. IndexedDB con `file://` es fiable en Chromium.
- **No:** soporte oficial de Firefox. Con `file://` su almacenamiento tiene casos raros.
- **Sí:** tres stores (`maps`, `images`, `markers`). Listar no carga Blobs pesados y SPEC 06 no necesita migración.
- **No:** un solo store con el Blob dentro. Listar cargaría todas las imágenes.
- **Sí:** crear el store `markers` vacío ya en v1. Evita subir la versión del esquema en SPEC 06.
- **Sí:** coordenadas de marcadores relativas (0–1). No dependen del zoom ni del tamaño de pantalla.
- **Sí:** guardar la imagen original sin recomprimir. No se pierde calidad.
- **Sí:** miniatura WebP de 320 px guardada en `maps`. La biblioteca carga rápido.
- **Sí:** hash routing. F5 reabre el mapa y el botón atrás funciona con `file://`.
- **No:** estado de vista en memoria. Recargar perdería el mapa abierto.
- **Sí:** `<dialog>` propio para renombrar y confirmar. Se le puede dar estilo y se reutiliza.
- **No:** `prompt()` y `confirm()` nativos. No admiten estilo.
- **Sí:** avisar sin bloquear con imágenes grandes. No impide usar mapas reales.
- **No:** rechazar imágenes grandes. Bloquearía mapas válidos.
- **No:** tiles. Quedan para una spec futura si el rendimiento lo exige.
- **Sí:** carga múltiple. Cuesta poco y es común cargar varias regiones de un juego.
- **Sí:** nombres repetidos permitidos. El `id` identifica el mapa, no el nombre.
- **Sí:** orden por último abierto. El mapa que se está jugando queda arriba.
- **Sí:** arquitectura por capas `ui → services → data` con namespace `Waypoint`. Es legible y separa responsabilidades.
- **No:** arquitectura hexagonal. Es demasiado compleja para este proyecto.
- **Sí:** Leaflet 1.9.4 copiado en `vendor/`. Funciona sin internet.
- **No:** Leaflet desde CDN. Rompe el uso sin conexión.
- **Sí:** tema oscuro tipo MapGenie con tokens en `css/tokens.css`. Es provisional: cambiarlo después solo toca los tokens.
- **Sí:** pedir `navigator.storage.persist()`. Reduce el riesgo de que el navegador borre los datos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Chrome borra los datos de IndexedDB al limpiar los datos de navegación | Pedir `navigator.storage.persist()`. Exportar/importar respaldos queda para una spec futura. |
| Mover o renombrar la carpeta del proyecto cambia el origen `file://` y la app no ve los datos | Verificarlo en el paso 3. Si pasa, documentarlo en el README como limitación conocida. |
| Una imagen enorme agota la memoria al decodificarse | Aviso previo por encima de 16384 px o 100 MB. La miniatura usa `createImageBitmap` con redimensionado. |
| La cuota de almacenamiento se llena | Capturar `QuotaExceededError` y mostrar el aviso "Sin espacio de almacenamiento". |
| Fuga de memoria al abrir y cerrar mapas | Destruir el mapa Leaflet y revocar el object URL al salir del visor. |
| `crypto.randomUUID()` no disponible en el contexto `file://` | Verificarlo en el paso 4. Usar un generador propio de respaldo si falla. |

## Qué **no** entra en esta spec

- Marcadores ni su estado de hecho (SPEC 06).
- Categorías con color.
- Rutas.
- Tiles para imágenes gigantes.
- Exportar e importar respaldos.
- Cuentas, sincronización y varios usuarios.
- Soporte oficial de Firefox y Safari.
- Diseño visual definitivo.

Cada una de estas, si llega, va en su propia spec.
