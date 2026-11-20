# Waypoint — guía técnica

App web local (vanilla JS/HTML/CSS) para seguir progreso en videojuegos sobre imágenes de mapas.
Uso y limitaciones para el usuario: `README.md`. Qué se construye y por qué: `specs/`.

## Restricciones duras

- Se abre con doble clic en `index.html` (`file://`): sin servidor, sin build, sin red.
- **Scripts clásicos, no ES modules**: los módulos no cargan con `file://` (CORS). Cada archivo es una IIFE que registra su API en `window.Waypoint.{core,data,services,ui}`.
- Dependencias externas solo copiadas en `vendor/` (Leaflet 1.9.4). Fuentes del sistema; nada de CDN.
- Objetivo: Chrome/Edge (Chromium). Firefox no está soportado.

## Arquitectura

Capas con dependencia en un solo sentido: `ui → services → data`. `core` (namespace, router) lo puede usar cualquier capa.

- `data/` habla con IndexedDB y nunca toca `document`.
- `services/` contiene la lógica; puede usar `createImageBitmap`/`OffscreenCanvas`, pero no el DOM de la UI.
- `ui/` nunca usa `indexedDB`: siempre pasa por `services`.
- `app.js` solo arranca y conecta (db → router → vistas).

Un archivo nuevo se añade a `index.html` **en orden de capa**: un script solo puede usar lo registrado por los que van antes.

Las vistas exponen `mount(container, params)` y devuelven una función de desmontaje; el router la llama al cambiar de ruta. Ahí se libera todo: listeners de `window`, object URLs y el mapa Leaflet.

El modelo de datos (stores `maps`, `images`, `markers`), la conversión de coordenadas y el orden de la biblioteca están en `specs/01-biblioteca-de-mapas.md` → *Modelo de datos*. Las migraciones de esquema van en `MIGRATIONS[version]` de `js/data/db.js`.

## Convenciones

- UI, comentarios y mensajes en español; identificadores en inglés.
- Colores, espacios y radios solo vía tokens de `css/tokens.css` (el tema es provisional).
- Errores de dominio como clases propias (`InvalidImageError`, `MapNotFoundError`, `InvalidNameError`, `DbUnavailableError`); la UI decide el aviso con `instanceof` o `mapService.isQuotaError()`.
- Avisos al usuario con `Waypoint.ui.notice.show()`; diálogos con `Waypoint.ui.dialog.{rename,confirm}`. `prompt()`/`confirm()` nativos no se usan.

## Gotchas

- **Transacciones IDB**: un error de petición aborta la transacción, y así debe ser. Llamar a `preventDefault()` en `onerror` la hace commitear a medias.
- **Leaflet `getBoundsZoom()`** recorta el resultado al `minZoom` vigente (0 por defecto). El zoom de ajuste de una imagen mayor que la ventana es negativo: `viewer-view.js` abre el límite antes de medir.
- **Origen `file://`**: Chromium trata todos los `file://` como un único origen, así que mover la carpeta no pierde datos y cualquier HTML local abierto en ese perfil ve la misma base.
- Comprobar `crypto.randomUUID` y `navigator.storage.persist()` es innecesario: existen en `file://`. `persist()` puede devolver `false`.

## Verificar cambios

Verifica en el navegador con `tools/cdp-eval.mjs` (Chrome headless vía CDP; su cabecera documenta argumentos, variables y la entrada real de ratón/teclado). Playwright MCP bloquea `file://` y `chrome --dump-dom` congela IndexedDB, así que no sirven aquí.

- Regresión de SPEC 01: `tools/acceptance/spec-01.js`, con un `WP_PROFILE` vacío. Cada spec nueva añade su `tools/acceptance/spec-NN.js`.
- La entrada sintética (`new KeyboardEvent`) no cierra un `<dialog>` con Esc: usa `window.cdpKey("Escape")`.

## Flujo de trabajo

Trabajo guiado por specs (`specs/NN-slug.md`): se implementa con `/spec-impl` en la rama `spec-NN-slug`, paso a paso. Lo que no está en la spec va a una spec nueva, no al código.
