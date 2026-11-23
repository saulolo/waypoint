# SPEC 10 — Textos en el mapa

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03, SPEC 06, SPEC 08
> **Fecha:** 2026-11-22
> **Objetivo:** Añadir un botón "Añadir texto" encima de "Añadir pin" que abre un panel derecho (Texto, Nota, Color, Tamaño) con un texto de vista previa que cae al mapa y se arrastra, y que al guardar queda en el mapa con un popup para verlo y borrarlo, y se puede mover arrastrándolo.

## Por qué existe esta spec

Los pines marcan puntos, pero no sirven para rotular zonas: el nombre de una ciudad, una región o un río.
El usuario quiere poner textos cortos sobre el mapa con el mismo flujo que "Añadir pin" (SPEC 08): panel derecho, vista previa que cae, mismos colores, barra de tamaño, "Cancelar" y "Guardar".

Durante la implementación, el usuario pidió además que los botones de acción de toda la app se distingan por grupo (cancelar, guardar, editar, borrar…): "Cancelar" era gris y no encajaba con el tema. También pidió que la confirmación de borrar sea mucho más pequeña.

## Alcance

**Dentro:**

- **Botón "Añadir texto"** en los controles de vista (SPEC 06), justo encima de "Añadir pin", en su propia `.leaflet-bar`.
  - `<button class="view-controls__btn">` con `aria-label` y `title` "Añadir texto".
  - Icono SVG inline con `currentColor`: una "T" con un "+" arriba a la derecha, en la rejilla de 24×24 del botón de pin.
  - Clic abre el modo "añadir texto".
- **Modo "añadir texto":**
  - Se abre el **panel de texto** (`.label-editor`), flotante y anclado a la derecha del visor, como `.pin-editor`.
  - Mientras está abierto, los controles de vista y el bloque + / − se ocultan (clase `.viewer--adding-label` en la raíz). El zoom sigue funcionando con la rueda y el doble clic.
  - El panel lateral izquierdo (SPEC 05) no cambia.
  - El foco va al campo "Texto".
  - No es `<dialog>` modal: es `aside.dialog` hermano de `.viewer__stage`, como `.pin-editor`. El mapa sigue usable a la vez.
  - "Añadir pin" y "Añadir texto" no pueden estar abiertos a la vez: los dos ocultan los controles de vista.
- **Panel de texto**, con el estilo de `.dialog` (SPEC 02) y el ancho de `.pin-editor` (`--pin-editor-width`). De arriba abajo:
  - Título "AÑADIR TEXTO" en `--font-pixel`.
  - Sin "Último usado": al abrir el panel, el borrador viene siempre con el estilo por defecto, Blanco y 12 px (la barra en 12).
  - **Texto:** `<input>` de una línea, obligatorio, máx. 40 caracteres (`maxlength`). Placeholder "Texto".
  - **Nota:** `<textarea>` opcional, máx. 500 caracteres. Conserva los saltos de línea. Solo se ve en el popup.
  - **Color:** el mismo grupo de 8 radios de "Añadir pin": Dorado, Blanco, Negro, Rojo, Naranja, Verde, Cian, Violeta.
  - **Tamaño:** `<input type="range">` de 8 a 32 px, paso 2, con el valor visible ("12 px"). Va en el propio panel (no hay selector de iconos).
  - Abajo, dos botones `.btn`: "Cancelar" y "Guardar".
  - **"Guardar" deshabilitado** mientras "Texto" esté vacío o solo tenga espacios.
- **Texto de vista previa (borrador):**
  - Al abrir el panel, cae desde el borde superior del mapa hasta su sitio, con la misma animación que el borrador del pin (~400 ms, `ease-out` con un rebote leve).
  - Su sitio inicial es el centro de la zona libre (sin el panel izquierdo, si está visible, ni el panel de texto). Si ese punto queda fuera de la imagen, va al punto de la imagen más cercano.
  - No busca hueco: no evita pines ni otros textos.
  - Refleja en vivo texto, color y tamaño. Con "Texto" vacío muestra "Texto", atenuado.
  - **Mover:** igual que el borrador del pin. Arrastrarlo lo mueve sin mover el mapa. Un clic simple en el mapa (sin arrastre) lo lleva a ese punto. Nunca sale de la imagen. Cursor `grab` / `grabbing`.
- **Aspecto de los textos** (borrador y guardados):
  - `--font-pixel` (Press Start 2P), en el color elegido, sin fondo.
  - Contorno oscuro para leerse sobre cualquier mapa (`--color-pin-outline-dark`); claro con Negro (`--color-pin-outline-light`).
  - Una sola línea, sin cortes (`white-space: nowrap`). Sin `text-transform`: se pinta tal cual se escribió.
  - Tamaño de letra fijo en píxeles de pantalla: no cambia con el zoom del mapa.
  - El centro del texto es el punto exacto guardado.
- **Guardar:**
  - Guarda el texto en el store nuevo `labels` con su posición relativa (0–1) y su estilo.
  - Al terminar: se cierra el panel, vuelven los controles, el borrador pasa a ser un texto guardado y el foco vuelve al botón "Añadir texto".
  - Si falla: aviso de error (`notice.show`), el panel sigue abierto y el borrador en su sitio. Cuota (`isQuotaError`): "No queda espacio para guardar el texto."; otro error: "No se pudo guardar el texto.".
- **Cancelar:** quita el borrador, cierra el panel, vuelven los controles y el foco va a "Añadir texto". Nada se guarda.
  - Lo hacen: el botón "Cancelar", Esc y cualquier cambio de ruta o desmontaje del visor, sin preguntar.
- **Textos guardados:**
  - Al montar el visor se cargan los textos del mapa y se pintan.
  - Si la carga falla: aviso "No se pudieron cargar los textos." y el mapa se abre igual.
  - Sin tooltip: el texto ya se ve.
  - Cursor `grab` / `grabbing`.
  - **Mover:** clic sostenido y arrastrar lo lleva a otro sitio sin mover el mapa; al soltar se guarda (`labelService.move`).
    - Nunca sale de la imagen.
    - Empezar a arrastrar cierra su popup si estaba abierto. Un clic sin arrastre abre el popup.
    - Si guardar falla: aviso "No se pudo mover el texto." y vuelve a donde estaba.
  - Clic abre un **popup** con el estilo arcade de los pines: el texto en `--font-pixel`, la nota en `--font-mono` con sus saltos de línea (sin nota, no hay párrafo) y un botón "Borrar" (`.btn` de peligro). Sin botón ojo ni "Editar".
  - El popup se cierra con su ×, Esc o un clic en el mapa.
- **En modo "añadir pin" o "añadir texto"**, los textos guardados se comportan como los pines guardados en modo "añadir pin" (SPEC 08): no abren popup, un clic sin arrastre lleva el borrador a ese punto y arrastrarlos los mueve y guarda.
- **Borrar:** `dialog.confirm({ title: "¿Borrar texto?", message: "Se borrará «<texto>».", confirmLabel: "Borrar", danger: true })`.
  - Al confirmar, se borra de `labels` y desaparece del mapa. Si falla: aviso "No se pudo borrar el texto." y se queda.
- **Filtros de pines** (SPEC 09): no afectan a los textos. Los textos siempre se ven.
- Los textos no cuentan para la búsqueda de hueco del borrador del pin (`pins.boxes()`).
- **Pantalla completa (SPEC 06):** "Añadir texto" funciona igual; el panel de texto se ve.
- Clics, arrastres y rueda sobre el panel de texto no llegan al mapa.
- Foco visible (contorno hacia dentro) en todos los controles del panel, en el botón nuevo y en "Borrar".
- Movimiento reducido: la caída no se anima (regla global de `css/effects.css`).
- Borrar un mapa o un juego borra también sus textos.
- **Botones por grupo (toda la app):** cada grupo de acción tiene su color, con tokens del tema (SPEC 02). La forma (`clip-path`, borde, relleno interior y brillo al pasar o con foco) es la de `.btn`; solo cambian las variables `--btn-color`, `--btn-inner` y `--btn-glow`.

  | Grupo | Botones | Clase | Color |
  | --- | --- | --- | --- |
  | Confirmar | Guardar, Crear juego, Aceptar, Listo, Cargar mapas, Elegir archivos, Reintentar | `.btn--primary` | cian, sin cambio |
  | Cancelar | "Cancelar" de los diálogos (`dialog.js`), del panel de pin y del panel de texto | `.btn--cancel` (nueva) | violeta `--color-neon-purple` |
  | Editar | "Editar" del popup de pin | `.btn--edit` (nueva) | dorado `--color-neon-gold` |
  | Borrar | "Borrar" de los popups y de las confirmaciones de borrar | `.btn--danger` | magenta, sin cambio |
  | Neutro | "← Juegos", "← Mapas", "Elegir imagen", "Quitar" | `.btn--ghost` | gris, sin cambio |

  - Tokens nuevos en `css/tokens.css`: `--color-btn-inner-purple`, `--shadow-btn-purple`, `--color-btn-inner-gold`, `--shadow-btn-gold` (mismo patrón que los de cian y magenta).
  - Contorno de foco hacia dentro en su color, como el resto de `.btn`.
- **Confirmaciones compactas (toda la app):** `dialog.confirm` (borrar pin, texto, mapa o juego; aviso de imagen grande) añade `.dialog--compact`: 320 px de ancho, menos relleno, título a `--font-size-pixel-sm`, mensaje a `--font-size-sm` y botones como los del popup de pin (`--font-size-pixel-xs`). Los diálogos con campos (renombrar, juego) no cambian.
- Crear `tools/acceptance/spec-10.js`.

**Fuera de alcance (para specs futuras):**

- Editar un texto guardado (texto, nota, color o tamaño).
- Textos de varias líneas, rotados o curvados.
- Tamaño que escala con el zoom del mapa.
- Fondo o placa detrás del texto; otras fuentes.
- Filtrar u ocultar textos (botón "Textos" en el filtro del panel lateral).
- Que el borrador del texto evite pines u otros textos al caer.
- Lista o buscador de textos.
- Deshacer un borrado; copiar, exportar o importar textos.
- Atajos de teclado.

## Modelo de datos

Esquema v3: store nuevo `labels`. La migración es aditiva y no borra datos.

```js
// MIGRATIONS[3] en js/data/db.js
// db.createObjectStore("labels", { keyPath: "id" }).createIndex("mapId", "mapId", { unique: false });

// Store "labels" — keyPath: "id", índice "mapId" (no único)
const label = {
  id: "…",              // crypto.randomUUID()
  mapId: "b3f1c2e4-...",
  x: 0.42,              // 0–1, relativo al ancho de la imagen (SPEC 01)
  y: 0.17,              // 0–1, relativo al alto de la imagen (SPEC 01)
  text: "Ciudad Ceniza", // 1–40 caracteres tras quitar espacios de los extremos
  note: "",             // 0–500 caracteres; "" si no hay nota
  color: "white",       // una de markerService.COLORS
  size: 12,             // px de letra en pantalla; 8–32, par
  createdAt: 1763800000000,
};
```

Convenciones:

- Conversión relativa → Leaflet como los pines: `lat = height * (1 - y)`, `lng = width * x`.
- `color` guarda la clave; la UI la traduce al token `--color-pin-<clave>` (mismos colores que los pines).
- Mover no cambia `createdAt`.

API nueva en `Waypoint.data.labelsRepository` (misma forma que `markersRepository`):

```js
labelsRepository.add(label);            // → Promise<void>
labelsRepository.listByMap(mapId);      // → Promise<object[]>
labelsRepository.listByMaps(mapIds);    // → Promise<object[]>
labelsRepository.update(id, changes);   // → Promise<object|null>
labelsRepository.remove(id);            // → Promise<void>
```

API nueva en `Waypoint.services.labelService`:

```js
labelService.COLORS;        // === markerService.COLORS
labelService.SIZE;          // { min: 8, max: 32, step: 2, default: 12 }
labelService.DEFAULT_STYLE; // { color: "white", size: 12 }

labelService.create(mapId, { x, y, text, note, color, size }); // → Promise<label>
labelService.listByMap(mapId);    // → Promise<label[]>
labelService.move(id, x, y);      // → Promise<label>; solo cambia x/y
labelService.remove(id);          // → Promise<void>
labelService.isQuotaError(error); // como mapService.isQuotaError
```

`create` lanza `InvalidLabelError` (clase propia de `label-service.js`) si `x`/`y` salen de 0–1, `text` queda vacío o pasa de 40, `note` pasa de 500, `color` no está en `COLORS`, o `size` sale de 8–32 o es impar.
`move` lanza `InvalidLabelError` si `x`/`y` salen de 0–1 o el texto no existe, sin escribir nada.

Borrado en cascada: `mapsRepository.remove` y `gamesRepository.remove` añaden `labels` a su transacción.

Estado en memoria, por visor montado:

```js
var draft = null;       // { marker: L.Marker, x, y, text, note, color, size } mientras se añade
var savedLabels = {};   // id → L.Marker de los textos guardados
```

## Archivos

Nuevos:

- `js/data/labels-repository.js`: CRUD del store `labels`.
- `js/services/label-service.js`: validación, `create`, `listByMap`, `move`, `remove`, `InvalidLabelError`.
- `js/ui/label-layer.js`: pinta los textos guardados (`L.divIcon`), popup, borrado con confirmación, arrastre y `setPlacing(fn)`.
- `js/ui/label-editor.js`: panel de texto, borrador (caída, arrastre, clic en mapa, límites), guardar y cancelar; devuelve una función de cierre.
- `css/labels.css`: textos, contorno, panel y barra de tamaño.
- `tools/acceptance/spec-10.js`.

Modificados:

- `js/data/db.js`: `DB_VERSION = 3`, `MIGRATIONS[3]`, `STORES.labels`.
- `js/data/maps-repository.js` y `js/data/games-repository.js`: cascada sobre `labels`.
- `js/ui/view-controls.js`: botón "Añadir texto" encima de "Añadir pin", `onAddLabel`, `focusAddLabel()`.
- `js/ui/viewer-view.js`: conecta `onAddLabel`, carga los textos al montar, clase `.viewer--adding-label`, avisa a la capa de textos al entrar y salir de los modos de añadir, cierra editor y capa al desmontar.
- `js/ui/pin-editor.js`: el modo "añadir pin" también pone los textos guardados en modo colocar (vía `viewer-view.js`).
- `css/viewer.css`: `.viewer--adding-label` oculta los controles de la esquina inferior derecha.
- `index.html`: `css/labels.css` después de `css/dialog.css`; `labels-repository.js` tras `markers-repository.js`, `label-service.js` tras `marker-service.js`, y `label-layer.js` y `label-editor.js` antes de `viewer-view.js`.
- `tools/acceptance/spec-06.js`: ahora son cuatro botones. `spec-03.js` (la base ya no está en v2 sino en v3), `spec-05.js` (un Tab más hasta la pestaña) y `spec-09.js` (busca "Añadir pin" por `aria-label`, no por índice).
- `css/tokens.css`: tokens de relleno y brillo violeta y dorado para los botones.
- `css/base.css`: `.btn--cancel` y `.btn--edit`.
- `js/ui/dialog.js`, `js/ui/pin-editor.js` y `js/ui/label-editor.js`: "Cancelar" con `.btn--cancel`; `dialog.confirm` con `.dialog--compact`.
- `css/dialog.css`: `.dialog--compact`.
- `js/ui/pin-layer.js`: "Editar" con `.btn--edit`.
- `README.md` y `CLAUDE.md`: textos, store `labels`, esquema v3, botones por grupo, `spec-10.js` en la regresión.

## Plan de implementación

1. Esquema y datos: `MIGRATIONS[3]` con el store `labels`, `labels-repository.js` y cascada en `mapsRepository.remove` y `gamesRepository.remove`. Prueba manual: una base v2 con mapas y pines abre en v3 sin perder nada; borrar un mapa con textos creados por consola los borra.
2. Servicio: `label-service.js` con `InvalidLabelError`, `SIZE`, `DEFAULT_STYLE`, `create`, `listByMap`, `move`, `remove`. Prueba manual: desde consola, `create` con `size: 13` lanza.
3. Textos guardados: `label-layer.js` y `css/labels.css` pintan los textos al montar (aviso si falla), con contorno y tamaño fijo, y popup con texto, nota y "Borrar" con confirmación. Prueba manual: textos creados por consola aparecen tras recargar, no cambian de tamaño con el zoom y se borran desde el popup.
4. Mover textos guardados: arrastre con límites, `move` al soltar, aviso y vuelta atrás si falla. Prueba manual: arrastrar, recargar y verlo en el sitio nuevo; clic sin arrastre abre el popup.
5. Botón y panel: botón "Añadir texto" en `view-controls.js`; `label-editor.js` abre el panel (Texto, Nota, Color, Tamaño), oculta los controles, deja caer el borrador y lo refleja en vivo; "Cancelar", Esc y el desmontaje lo quitan. Prueba manual: abrir, escribir y cambiar color y tamaño ve el cambio; cancelar no deja rastro.
6. Mover el borrador y modo colocar: arrastre, clic en el mapa, límites; textos guardados en modo colocar con los dos editores. Prueba manual: con "Añadir pin" abierto, clic en un texto guardado lleva el borrador del pin ahí.
7. Guardar: "Guardar" (deshabilitado con texto vacío) crea el texto, lo deja en el mapa y cierra; avisos de error. Prueba manual: tras guardar un texto Rojo de 20 px, el siguiente "Añadir texto" viene Blanco y 12 px.
8. Botones por grupo: tokens violeta y dorado, `.btn--cancel` y `.btn--edit` en `base.css`; "Cancelar" de diálogos, panel de pin y panel de texto con `.btn--cancel`; "Editar" del popup de pin con `.btn--edit`. Confirmaciones compactas con `.dialog--compact`. Prueba manual: los "Cancelar" se ven violeta, "Editar" dorado, "Guardar" cian y "Borrar" magenta; foco visible en todos; la confirmación de borrar un pin mide 320 px de ancho.
9. Tests y docs: `tools/acceptance/spec-10.js`, ajuste de `spec-06.js`, `README.md` y `CLAUDE.md`. Prueba manual: `spec-01.js` a `spec-10.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] Una base en v2 con juegos, mapas y pines abre en v3 con todos sus datos y un store `labels` vacío con índice `mapId`.
- [x] Los controles de vista tienen cuatro botones separados; "Añadir texto" está justo encima de "Añadir pin", es `<button>` con `aria-label="Añadir texto"` y tiene contorno de foco visible.
- [x] Clic en "Añadir texto" muestra `.label-editor` a la derecha con el título "AÑADIR TEXTO", Texto, Nota, Color (8 opciones), Tamaño y los botones "Cancelar" y "Guardar"; el foco queda en "Texto".
- [x] Con el panel abierto, la raíz tiene `.viewer--adding-label` y no se ven los controles de vista ni + / −; al cerrarlo vuelven.
- [x] Al abrirse, el centro del borrador queda (±2 px) en el centro de la zona libre.
- [x] Con movimiento reducido emulado, el borrador está en su sitio final en el primer fotograma.
- [x] Con "Texto" vacío, "Guardar" está deshabilitado y el borrador muestra "Texto"; con "   " sigue deshabilitado; al escribir "Ciudad Ceniza", se habilita y el borrador muestra "Ciudad Ceniza".
- [x] "Texto" no admite más de 40 caracteres y "Nota" más de 500.
- [x] Elegir Rojo pone el `color` calculado del borrador al valor de `--color-pin-red`; con Negro, el contorno usa `--color-pin-outline-light`.
- [x] La barra de tamaño va de 8 a 32 en pasos de 2; ponerla en 20 deja el `font-size` calculado del borrador en `20px` y muestra "20 px".
- [x] El texto se pinta con `--font-pixel`, en una sola línea, y su tamaño en pantalla no cambia (±1 px) al hacer zoom con la rueda.
- [x] Arrastrar el borrador 100 px a la derecha lo mueve 100 px (±2) sin mover la vista; un clic simple en el mapa lo lleva a ese punto (±2 px); fuera de la imagen queda en el borde (`x`/`y` en 0–1).
- [x] Esc, "Cancelar" o cambiar de ruta quitan el borrador y el panel sin crear registros en `labels`; con Esc o "Cancelar" el foco queda en "Añadir texto".
- [x] "Guardar" con "Ciudad Ceniza", nota de dos líneas, Rojo y 20 px crea un registro en `labels` con esos valores, el `mapId` del mapa, `x`/`y` en 0–1 y `createdAt`; el panel se cierra y el texto queda en el mismo sitio (±2 px).
- [x] Si `labelService.create` falla con cuota aparece "No queda espacio para guardar el texto.", y con otro error "No se pudo guardar el texto."; el panel y el borrador siguen.
- [x] Tras recargar, los textos del mapa aparecen en su sitio con su color y tamaño; los de otro mapa no.
- [x] Si `labelService.listByMap` falla, el mapa se abre igual y aparece "No se pudieron cargar los textos.".
- [x] Clic en un texto guardado abre un popup con fondo del tema, el texto en `--font-pixel`, la nota con sus saltos de línea y "Borrar"; sin nota no hay párrafo de nota.
- [x] Arrastrar un texto guardado 100 px lo mueve 100 px (±2), no mueve el mapa y actualiza `x`/`y` en `labels` con el mismo `createdAt`; si `move` falla aparece "No se pudo mover el texto." y vuelve a su sitio.
- [x] Con "Añadir pin" o "Añadir texto" abierto, clic en un texto guardado no abre popup y lleva el borrador a ese punto.
- [x] "Borrar" abre "¿Borrar texto?"; confirmar lo quita del mapa y de `labels`; cancelar no lo toca.
- [x] El panel no tiene "Último usado"; el borrador viene Blanco y 12 px, también tras guardar un texto Rojo de 20 px.
- [x] Apagar "Pendientes" y "Encontrados" (SPEC 09) no oculta ningún texto.
- [x] Con pantalla completa simulada, "Añadir texto" abre `.label-editor` visible.
- [x] Clic, arrastre y rueda sobre `.label-editor` no mueven ni hacen zoom en el mapa ni mueven el borrador.
- [x] `labelService.create` con `size: 13`, `size: 34`, `color: "pink"`, `x: 1.2`, texto vacío o de 41 caracteres lanza `InvalidLabelError` y no escribe nada.
- [x] Borrar el mapa o el juego borra también sus textos de `labels`.
- [x] Todos los botones "Cancelar" (diálogo de confirmación, diálogo de renombrar, diálogo de juego, panel de pin y panel de texto) llevan `.btn--cancel` y su borde calculado es `--color-neon-purple`; "Editar" del popup de pin lleva `.btn--edit` con borde `--color-neon-gold`; "Guardar" sigue cian y "Borrar" magenta. Con foco, el contorno va hacia dentro en el color del botón.
- [x] Los diálogos de `dialog.confirm` llevan `.dialog--compact` y miden 320 px de ancho (o la ventana menos márgenes); renombrar y el diálogo de juego siguen a 440 px.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo.
- [x] `tools/acceptance/spec-01.js` a `spec-10.js` pasan con un `WP_PROFILE` vacío.

## Decisiones

- **Sí:** campos Texto (lo que se pinta) y Nota (solo en el popup). Decisión del usuario. Mismo patrón que Nombre / Nota del pin.
- **No:** Título + Subtítulo pintados en dos líneas, ni solo Texto.
- **Sí:** `--font-pixel` con contorno, sin fondo. Decisión del usuario. Encaja con el tema y con el contorno de los glifos de pin.
- **No:** `--font-mono` ni cartel con placa de fondo.
- **Sí:** tamaño de letra fijo en pantalla, 8–32 px en pasos de 2, 12 por defecto. Decisión del usuario. Los 20–64 del pin son demasiado grandes para Press Start 2P.
- **No:** reutilizar `markerService.SIZE` ni escalar con el zoom.
- **Sí:** store nuevo `labels` con migración v3 aditiva. Decisión del usuario. No mezcla textos con `found`, filtros, "Último usado" ni `boxes()` de los pines.
- **No:** guardarlos en `markers` con `kind: "label"`. Obligaría a excluirlos en cada lectura de pines.
- **Sí:** texto obligatorio, una línea, máx. 40; "Guardar" deshabilitado si está vacío. Decisión del usuario. No hay etiqueta por defecto como la del icono.
- **Sí:** guardados con popup, mover y borrar, como los pines. Decisión del usuario. Editar va en otra spec.
- **Sí:** sin tooltip en los textos guardados. Repetiría lo que ya se ve.
- **Sí:** los filtros de pines no afectan a los textos. Decisión del usuario.
- **No:** "Último usado" en el panel de texto. Decisión del usuario durante la implementación (paso 7): no es necesario; el borrador empieza siempre en Blanco y 12 px. `labelService.lastStyle` no existe.
- **Sí:** mismos 8 colores y tokens `--color-pin-*` que los pines. Petición del usuario ("mismo sistema de colores"). `labelService.COLORS` reutiliza `markerService.COLORS`.
- **Sí:** misma caída que el borrador del pin, sin búsqueda de hueco. Petición del usuario (mismo efecto); evitar solapes con textos de ancho variable no compensa ahora.
- **Sí:** en modo "añadir pin" o "añadir texto", los textos guardados se comportan como los pines guardados en modo "añadir pin". Un solo modo activo; el clic sirve para colocar, como en SPEC 08.
- **Sí:** editor y capa en archivos propios (`label-editor.js`, `label-layer.js`). `pin-editor.js` ya tiene 727 líneas. Si la caída o el arrastre del borrador se duplican más de unas 30 líneas, se extraen a un helper compartido en `js/ui/` durante el paso 6.
- **Sí:** clase `.viewer--adding-label` aparte de `.viewer--adding-pin`. CSS y tests distinguen qué modo está activo.
- **Sí:** botones por grupo de acción en toda la app (Confirmar cian, Cancelar violeta, Editar dorado, Borrar magenta, Neutro gris). Petición del usuario durante la implementación. Se mete en esta spec a petición suya, aunque toca otras pantallas.
- **No:** cambiar `.btn--ghost`: también lo usan la navegación y "Elegir imagen" / "Quitar"; "Cancelar" pasa a su propia clase.
- **No:** magenta para "Cancelar": es el color de "Borrar" y se confundirían en las confirmaciones.
- **Sí:** confirmaciones compactas (`.dialog--compact`) en todas las de `dialog.confirm`, no solo la de borrar pin. Petición del usuario ("demasiado grande"); todas tienen la misma forma (título, mensaje, dos botones).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración v3 borra datos existentes | `MIGRATIONS[3]` solo crea el store; no toca `maps`, `images`, `markers` ni `games`. Criterio de base v2 → v3. |
| Otra pestaña abierta con la base v2 bloquea la subida de versión | `db.js` ya gestiona `onblocked` / `onversionchange` de la v2; se comprueba en el paso 1. |
| El ancho del texto no se conoce al crear el `L.divIcon` y el centro queda desplazado | Centrar con `transform: translate(-50%, -50%)` en un hijo, no con `iconAnchor`. Criterio de posición ±2 px. |
| Press Start 2P se ve borrosa en tamaños que no son múltiplo de 8 | Aceptado: la barra va de 2 en 2 a petición del usuario. Se ve en la prueba manual del paso 3. |
| Vocales acentuadas en mayúscula mal dibujadas ("CIUDAD ÍNDIGO") | Limitación ya aceptada en SPEC 02. Sin `text-transform`, el usuario decide las mayúsculas. |
| Abrir "Añadir texto" con "Añadir pin" abierto | Los dos ocultan los controles de vista: el otro botón no se puede pulsar. |
| Clics o rueda en el panel llegan al mapa | El panel es hermano de `.viewer__stage`, como `.pin-editor` (gotcha de CLAUDE.md). |
| `.dialog` pisa el ancho del panel | `css/labels.css` va después de `css/dialog.css` en `index.html`, como `pins.css`. |
| Respuesta de `listByMap` tras desmontar | Comprobar `alive` antes de pintar, como en SPEC 08. |
| `spec-06.js` cuenta tres botones | Se ajusta a cuatro en el paso 8. |

## Qué **no** entra en esta spec

- Editar textos guardados.
- Textos de varias líneas, rotados, curvados o con fondo.
- Tamaño que escala con el zoom.
- Filtro u ocultación de textos.
- Evitar solapes al caer.
- Lista, buscador, deshacer, exportar o importar textos.
- Atajos de teclado.

Cada una de estas, si llega, va en su propia spec.
