# Waypoint — guía técnica

App web local (vanilla JS/HTML/CSS) para seguir progreso en videojuegos sobre imágenes de mapas.
Uso y limitaciones para el usuario: `README.md`. Qué se construye y por qué: `specs/`.

## Restricciones duras

- Se abre con doble clic en `index.html` (`file://`): sin servidor, sin build, sin red.
- **Scripts clásicos, no ES modules**: los módulos no cargan con `file://` (CORS). Cada archivo es una IIFE que registra su API en `window.Waypoint.{core,data,services,ui}`.
- Dependencias externas solo copiadas en `vendor/` (Leaflet 1.9.4; fuentes Press Start 2P y JetBrains Mono en `vendor/fonts/` con su OFL). Nada de CDN.
- Objetivo: Chrome/Edge (Chromium). Firefox no está soportado.

## Arquitectura

Capas con dependencia en un solo sentido: `ui → services → data`. `core` (namespace, router) lo puede usar cualquier capa.

Rutas (`js/core/router.js`): `#/` → `games-view` (inicio con hero y juegos), `#/game/<id>` → `library-view` (cabecera del juego + mapas filtrados por `gameId`, en orden alfabético; reutiliza `.library` y `.map-card`), `#/map/<id>` → `viewer-view` (mapa a pantalla completa con panel lateral superpuesto, controles de vista abajo a la derecha y pines; "← Mapas" vuelve a `#/game/<gameId>`). Cualquier otro hash vuelve a `#/`.

- `data/` habla con IndexedDB y nunca toca `document`.
- `services/` contiene la lógica; puede usar `createImageBitmap`/`OffscreenCanvas`, pero no el DOM de la UI.
- `ui/` nunca usa `indexedDB`: siempre pasa por `services`.
- `app.js` solo arranca y conecta (db → router → vistas).

Un archivo nuevo se añade a `index.html` **en orden de capa**: un script solo puede usar lo registrado por los que van antes.

Las vistas exponen `mount(container, params)` y devuelven una función de desmontaje; el router la llama al cambiar de ruta. Ahí se libera todo: listeners de `window`, object URLs y el mapa Leaflet.

El modelo de datos (stores `maps`, `images`, `markers`), la conversión de coordenadas y el orden de la biblioteca (alfabético desde SPEC 07; SPEC 01 lo definía por último abierto) están en `specs/01-biblioteca-de-mapas.md` → *Modelo de datos*. Desde el esquema v2 (SPEC 03) hay además el store `games` y cada mapa lleva `gameId` (índice `gameId`); ver `specs/03-carpetas-de-juegos.md` → *Modelo de datos*. El store `markers` (keyPath `id`, índice `mapId`) se usa desde SPEC 08: `{ id, mapId, x, y, name, note, icon, color, size, found, createdAt }`, con `x`/`y` relativas 0–1 a la imagen; ver `specs/08-pines-en-el-mapa.md` → *Modelo de datos*. Desde SPEC 09, `found` (ausente = `false`, sin migración; `markerService.setFound`) y, en `maps`, `hideFound` y `hidePending` (ausentes = `false`; `mapService.setHideFound` / `setHidePending`, preferencias de vista que no tocan `updatedAt`); ver `specs/09-pines-encontrados.md`. "Último usado" no se guarda: es el marcador con mayor `createdAt` entre los mapas del juego (`markerService.lastStyle`). Desde el esquema v3 (SPEC 10) hay además el store `labels` (keyPath `id`, índice `mapId`): `{ id, mapId, x, y, text, note, color, size, createdAt }`, con los mismos colores que los pines y `size` 8–32 px par; ver `specs/10-textos-en-el-mapa.md` → *Modelo de datos*. Los textos no tienen "Último usado": el borrador empieza siempre en `labelService.DEFAULT_STYLE` (Blanco, 12 px). Las migraciones de esquema van en `MIGRATIONS[version]` de `js/data/db.js` y reciben `(db, tx)`; `MIGRATIONS[2]` vacía `maps`, `images` y `markers`; `MIGRATIONS[3]` solo crea `labels`.

## Convenciones

- UI, comentarios y mensajes en español; identificadores en inglés.
- Colores, espacios y radios solo vía tokens de `css/tokens.css` (tema arcade, SPEC 02). Ningún hex ni `rgb()` fuera de ahí, salvo los `fill` de `js/ui/silhouettes.js` y el SVG del ruido de `css/effects.css`.
- `css/effects.css` guarda lo que no es un componente: capas de fondo (`.app-bg`, `.app-noise`), texto neón (`.neon-*`), `.flicker`, `.blink-cursor`, siluetas y keyframes. Las capas decorativas llevan `pointer-events: none`; el contenido va encima con `z-index: 2`.
- Tipografía: `--font-pixel` (Press Start 2P) para títulos, botones y nombres de mapa, con sus tamaños `--font-size-pixel-*`; `--font-mono` para el resto. Lo que escribe el usuario (inputs) va siempre en mono.
- Movimiento: `prefers-reduced-motion: reduce` anula todas las animaciones con una regla global en `css/effects.css`; los `transform` de hover se anulan aparte en el CSS del componente.
- Errores de dominio como clases propias (`InvalidImageError`, `MapNotFoundError`, `InvalidNameError`, `DbUnavailableError`); la UI decide el aviso con `instanceof` o `mapService.isQuotaError()`.
- Errores de juego: `GameNotFoundError` e `InvalidNameError` en `game-service.js` (clase aparte de la de `map-service.js`: usa `instanceof` contra la del servicio que corresponda).
- Errores de pin: `InvalidMarkerError` en `marker-service.js` (posición fuera de 0–1, color, icono o tamaño no válidos, nombre o nota demasiado largos, pin inexistente al mover). `markerService.isQuotaError` es el de `mapService`.
- Errores de texto: `InvalidLabelError` en `label-service.js` (posición fuera de 0–1, texto vacío o de más de 40, nota de más de 500, color o tamaño no válidos, texto inexistente al mover). `labelService.isQuotaError` es el de `mapService`.
- Botones por grupo (SPEC 10): confirmar `.btn--primary` (cian), cancelar `.btn--cancel` (violeta), editar `.btn--edit` (dorado), borrar `.btn--danger` (magenta), navegación y secundarios `.btn--ghost` (gris). Un botón nuevo usa la clase de su grupo, no `.btn--ghost` para "Cancelar".
- `dialog.confirm` añade `.dialog--compact` (320 px, textos y botones pequeños); los diálogos con campos usan el `.dialog` normal (440 px).
- Avisos al usuario con `Waypoint.ui.notice.show()`; diálogos con `Waypoint.ui.dialog.{rename,confirm}` y `Waypoint.ui.gameDialog.open()` (crear juego / cambiar portada; usa `dialog.open`). `prompt()`/`confirm()` nativos no se usan.
- Borrar un juego es una sola transacción sobre `games`, `maps`, `images`, `markers` y `labels` (`gamesRepository.remove`); borrar un mapa, sobre `maps`, `images`, `markers` y `labels` (`mapsRepository.remove`). El nº de mapas por juego se cuenta con `index("gameId").count()`.

## Gotchas

- **Transacciones IDB**: un error de petición aborta la transacción, y así debe ser. Llamar a `preventDefault()` en `onerror` la hace commitear a medias.
- **Leaflet `getBoundsZoom()`** recorta el resultado al `minZoom` vigente (0 por defecto). El zoom de ajuste de una imagen mayor que la ventana es negativo: `viewer-view.js` abre el límite antes de medir.
- **Origen `file://`**: Chromium trata todos los `file://` como un único origen, así que mover la carpeta no pierde datos y cualquier HTML local abierto en ese perfil ve la misma base.
- Comprobar `crypto.randomUUID` y `navigator.storage.persist()` es innecesario: existen en `file://`. `persist()` puede devolver `false`.
- **`clip-path` recorta el `outline` y el `box-shadow` exteriores**: en `.btn` y `.dialog` el contorno de foco va hacia dentro (`outline-offset` negativo).
- **`[hidden]`** tiene `display: none !important` en `base.css`: sin eso, el `display` de un componente (`.btn` es `inline-flex`) lo pisa.
- **Cabecera sticky**: `body` usa `min-height: 100%`, no `height`; con `height` la cabecera se suelta al pasar la primera pantalla.
- **Leaflet** pinta fondo claro en `.leaflet-bar a:hover` y `:focus`: `viewer.css` sobrescribe los dos.
- **Zoom de rueda propio** (SPEC 04): `js/ui/wheel-zoom.js` sustituye a `scrollWheelZoom` de Leaflet (desactivado). Interpola el zoom por fotograma con `requestAnimationFrame` y mueve la vista con la API interna `_move`/`_moveStart`/`_moveEnd` de Leaflet 1.9.4 (sin `viewreset`; `zoomend` solo al terminar). Guarda el punto anclado en coordenadas del mapa: medirlo cada fotograma con `containerPointToLatLng` acumula el redondeo de Leaflet. `viewer-view.js` llama a su `detach()` al desmontar.
- **Límites de arrastre por eje**: `maxBounds` no es fijo; `updateMaxBounds()` lo recalcula en `zoomend` y `resize`, ampliando los bounds de la imagen para que siempre queden `MIN_VISIBLE_PX` (100) de ella dentro de la vista por eje. El handler de rueda aplica el mismo límite en cada fotograma (`minVisiblePx`).
- **Vuelta a `maxBounds` sin animación**: `viewer-view.js` sustituye `_panInsideMaxBounds` del mapa por una versión con `animate: false`, antes del primer `setMaxBounds`. La animada se anida con la inercia del arrastre: deja una animación huérfana que frena arrastres posteriores y lanza `classList` de `undefined` tras `remove()`.
- **Panel lateral del visor** (SPEC 05): `.viewer__panel` y la pestaña `.viewer__toggle` son hermanos de `.viewer__stage`, no hijos del contenedor de Leaflet. Así la rueda y el arrastre sobre ellos no llegan al mapa sin `stopPropagation`; meterlos dentro del escenario rompe eso. `.viewer__stage` lleva `isolation: isolate` para que los `z-index` de los panes de Leaflet no tapen el panel. Empieza contraído al abrir un mapa (desde SPEC 08); las pruebas que tocan el panel lo expanden antes. Contraído, el panel queda `inert`; por eso la pestaña va fuera de él. La transición se anula en `viewer.css` con movimiento reducido (la regla global solo anula `animation`).
- **Selector de mapas** (SPEC 07): con 2 o más mapas en el juego, `.viewer__title` contiene el botón `.viewer__map-trigger` (nombre + chevron SVG; su `textContent` sigue siendo el nombre) y `.viewer__map-list` va justo debajo, dentro del panel. La lista se pide al montar con `mapService.listByName`; si falla, el título queda como texto. Las filas y sus object URLs se crean al abrir por primera vez y se revocan al desmontar. Elegir una fila hace `router.goToMap(id)` (el visor se remonta). Cierran la lista el disparador, Esc, `pointerdown` fuera (listener en `document`, se quita al desmontar; no se detiene el evento) y contraer el panel. La biblioteca y la lista usan el mismo orden: alfabético por nombre (`localeCompare`, `sensitivity: "base"`). El panel ya no muestra la portada del juego, solo su nombre.
- **Controles de vista** (SPEC 06): `js/ui/view-controls.js` es un `L.Control` en `bottomright` con tres botones (añadir pin, pantalla completa y escala), cada uno en su propia `.leaflet-bar`. Se añade **después** del zoom: en las esquinas de abajo Leaflet apila el último añadido arriba. Los botones son `<button>`, así que `viewer.css` repite para `.view-controls__btn` lo que Leaflet da a `.leaflet-bar a`. El botón de escala no recuerda la última pulsación: `viewer-view.js` lo sincroniza en `zoomend` (zoom 0 ±0,01 → ofrece ajustar; otro → ofrece 1:1). Leaflet no mira `prefers-reduced-motion`: `viewer-view.js` pasa `animate: false` con `prefersReducedMotion()`.
- **Pantalla completa** (SPEC 06): se pide sobre `document.documentElement`, no sobre `.viewer`, para que `notice` y los diálogos (colgados de `body`) se vean. Se llama a `requestFullscreen()` directamente en el clic (exige gesto del usuario). La UI (`.viewer--fullscreen`, que oculta panel y pestaña con `display: none`) se decide en `fullscreenchange`, no en el clic, para que Esc y el botón coincidan. El panel conserva `panelExpanded`. Como el panel está oculto, "← Mapas" no se puede pulsar dentro de pantalla completa; el desmontaje (cualquier cambio de ruta) sale de ella.
- **Pines** (SPEC 08): `js/ui/pin-layer.js` pinta los guardados (`L.divIcon` de tamaño fijo en pantalla, ancla en el centro; tooltip con el nombre y popup propio con "Borrar"); `js/ui/pin-editor.js` es el modo "añadir pin" (panel `.pin-editor`, selector `.pin-picker` y borrador `.pin--draft`); `js/ui/pin-icons.js` es el catálogo (8 categorías, 54 glifos SVG con `currentColor`; la primera, "Por defecto", es la mano `pointer`; el contorno usa `--pin-outline`, claro para el color Negro).
  - **Pines encontrados** (SPEC 09): el popup lleva en su cabecera el botón ojo `.pin-popup__found` (`aria-pressed`, `aria-label` fijo "Encontrado") y abajo "Editar" (sin función aún) y "Borrar". El cambio es optimista: `toggleFound` pinta al momento y `markerService.setFound` revierte con aviso si falla. `.pin--found .pin-glyph` baja a `--pin-found-opacity`; la clase se guarda también en las opciones del `divIcon`, para que sobreviva a quitar y volver a pintar el pin.
  - **Filtro de pines** (SPEC 09): `pins.setHideFound(b)` y `pins.setHidePending(b)` son independientes; `shouldHide(marker)` decide por tipo. Un pin oculto sale del mapa (`hidePin`), no se pinta con `display: none`; el marcador sigue en `markers` y `boxes()` solo ve los pintados. Marcar con el filtro activo oculta el pin al cerrarse su popup (`popupclose`; un arrastre no cuenta). `viewer-view.js` llama a los dos antes de `pins.load()` y muestra dos botones `.viewer__pin-filter-btn` (`aria-pressed`, raya = ocultos) bajo el juego; al guardar un pin con "Pendientes" apagado, lo enciende.
  - **SVG y `hidden`**: los elementos SVG no tienen la propiedad `hidden`; usa `toggleAttribute("hidden", …)` (el `[hidden]` global de `base.css` sí aplica). Y no quites del DOM el nodo clicado dentro de un popup: Leaflet sube por `parentNode` para saber que el clic fue en el popup, y si no lo encuentra cierra el popup.
  - Los dos paneles **no son `<dialog>`**: son `aside.dialog` no modales, hermanos de `.viewer__stage` como el panel lateral, así que la rueda y el arrastre sobre ellos no llegan al mapa. `css/pins.css` va **después** de `css/dialog.css` en `index.html`: si no, el `width` de `.dialog` pisa el de los paneles.
  - El modo "añadir pin" pone `.viewer--adding-pin` en la raíz (oculta los controles de abajo a la derecha) y llama a `pins.setPlacing(fn)`: los guardados se desligan de su popup (se vuelven a ligar al cerrar), un clic sin arrastre sobre ellos lleva el borrador ahí y siguen siendo arrastrables. Su tooltip (`.pin-tooltip--saved`) se oculta por CSS. Esc del editor y del popup se ignora con un `dialog[open]` (la confirmación de borrar).
  - Mover (borrador y guardados) es el arrastre de `L.Marker` con `autoPan: false`, recolocado dentro de la imagen en cada `drag`. Leaflet no dispara `click` tras un arrastre: así soltar no abre el popup ni mueve el borrador. Guardar la posición es `markerService.move` en `dragend`; si falla, el pin vuelve.
  - La caída del borrador anima `.pin-glyph`, no el contenedor (Leaflet coloca el contenedor con `transform`); la distancia va en `--pin-drop-from`. Al caer evita los guardados con una búsqueda en anillos (`findFreeSpot`, cajas de `pins.boxes()`).
  - `.leaflet-popup-content p` trae `margin`: `.pin-popup .pin-popup__note` lo anula con más especificidad.
- **Textos** (SPEC 10): `js/ui/label-layer.js` pinta los guardados y `js/ui/label-editor.js` es el modo "añadir texto" (`.label-editor`, `.viewer--adding-label`). Siguen el patrón de los pines (panel `aside.dialog` hermano de `.viewer__stage`, arrastre de `L.Marker`, `setPlacing`), con estas diferencias:
  - El `L.divIcon` es de tamaño 0, anclado en el punto: el ancho del texto no se conoce al crearlo. `.label-glyph` se centra con la propiedad `translate: -50% -50%`, no con `transform`, para que la caída (`pin-drop`, que anima `transform`) se sume al centrado. `.label-text` va dentro, en flujo, con el tamaño de letra en línea.
  - Contorno con `-webkit-text-stroke` y `paint-order: stroke fill` (variable `--label-outline`, clara con Negro).
  - Sin tooltip, sin búsqueda de hueco y sin filtros: `pins.boxes()` no los ve.
  - En los dos modos de añadir, `labels.setPlacing(fn)` lo llama el editor activo (`pin-editor.js` recibe `labels` como opción). Los pines guardados no cambian en modo "añadir texto".
  - Solo un modo de añadir a la vez: `viewer-view.js` no abre uno si el otro está abierto.
- Press Start 2P no dibuja bien vocales acentuadas en mayúsculas ("VACÍA" → "VACıA"). Aceptado en SPEC 02.

## Verificar cambios

Verifica en el navegador con `tools/cdp-eval.mjs` (Chrome headless vía CDP; su cabecera documenta argumentos, variables y la entrada real de ratón/teclado). Playwright MCP bloquea `file://` y `chrome --dump-dom` congela IndexedDB, así que no sirven aquí.

- Regresión: `tools/acceptance/spec-01.js`, `spec-02.js`, `spec-03.js`, `spec-04.js`, `spec-05.js`, `spec-06.js`, `spec-07.js`, `spec-08.js`, `spec-09.js` y `spec-10.js`, cada uno con un `WP_PROFILE` vacío. Crean un juego por servicio y trabajan dentro de `#/game/<id>`. Cada spec nueva añade su `tools/acceptance/spec-NN.js`.
- La entrada sintética (`new KeyboardEvent`) no cierra un `<dialog>` con Esc: usa `window.cdpKey("Escape")`.
- Arrastrar un `L.Marker` con `Input.dispatchMouseEvent`: manda un último `mouseMoved` en el punto final y espera ~100 ms antes de soltar; si no, headless puede perder el último movimiento y el pin se queda corto (ver `drag` en `spec-08.js`).
- El botón de pin abre el panel de pin, que oculta los controles de vista: `spec-06.js` anula `Waypoint.ui.pinEditor.open` mientras comprueba que los clics en ese botón no llegan al mapa.
- Desde SPEC 10 el primer botón de vista es "Añadir texto": busca los botones por `aria-label` (`.view-controls__btn[aria-label="Añadir pin"]`), no por índice.
- `getComputedStyle` de un nodo ya quitado del DOM (un `<dialog>` cerrado) devuelve valores vacíos: lee los estilos antes de cerrar.
- Enter sintético con `Input.dispatchKeyEvent` solo activa un botón si el `keyDown` lleva `text: ""` (Espacio, `text: " "`); `cdpKey("Enter")` ya lo hace.
- Un clic "en el mapa" para cerrar un popup debe caer fuera de él (el popup sale encima del pin): usa una esquina lejana.
- `cdpKey` solo conoce Escape y Enter. Para un Tab real (recorrido de foco, `inert`) usa `cdpInput` con `Input.dispatchKeyEvent` (`key: "Tab"`, `windowsVirtualKeyCode: 9`); ver `tab` en `spec-05.js`.
- `Input.dispatchMouseEvent` descarta los eventos con coordenadas fuera de la ventana: un arrastre largo se hace en tramos dentro de ella (ver `dragBy` en `spec-04.js`). Quedarse quieto ~80 ms antes de soltar evita la inercia de Leaflet, que con eventos sintéticos dura segundos.
- `window.cdpInput` acepta cualquier método CDP, no solo entrada: `Emulation.setEmulatedMedia` emula `prefers-reduced-motion` y `Emulation.setDeviceMetricsOverride` cambia la ventana. `clearDeviceMetricsOverride` deja una ventana más baja en headless: vuelve a fijar 1280×800.
- **Pantalla completa en headless**: Chrome headless rechaza `requestFullscreen()` ("not granted") aunque el clic sea real, así que no se puede probar de verdad. `spec-06.js` simula `document.fullscreenElement`, `requestFullscreen`, `exitFullscreen` y dispara `fullscreenchange`; el cambio de ventana de entrar y salir se emula con `Emulation.setDeviceMetricsOverride`. Para tener el mapa Leaflet, instala `L.Map.addInitHook` antes de montar el visor. Navegar al mismo hash no remonta el visor: pasa antes por `#/`.
- Con `file://`, leer `document.styleSheets[i].cssRules` lanza `SecurityError`: comprueba estilos con `getComputedStyle`.

## Flujo de trabajo

Trabajo guiado por specs (`specs/NN-slug.md`): se implementa con `/spec-impl` en la rama `spec-NN-slug`, paso a paso. Lo que no está en la spec va a una spec nueva, no al código.
