# SPEC 06 — Controles de vista: pantalla completa y escala (1:1 / ajustar)

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 04, SPEC 05
> **Fecha:** 2026-11-21
> **Objetivo:** Añadir al visor, encima de los botones + / −, tres botones: añadir pin (solo el botón), pantalla completa del navegador y un botón de escala que alterna entre tamaño real (1:1) y ajustar el mapa a la ventana.

## Por qué existe esta spec

Hoy el visor solo tiene + / − abajo a la derecha.
El usuario quiere el patrón de MapGenie: un botón de pantalla completa encima del zoom, y otros botones laterales de vista.
"Ajustar a la ventana" quedó fuera de alcance en SPEC 04; entra aquí.

Esta spec toma el número 06. Los marcadores pasan a SPEC 08, como ya hicieron SPEC 02, 03, 04 y 05.

## Alcance

**Dentro:**

- Tres botones en columna, encima del bloque + / − (abajo a la derecha), **cada uno en su propia caja `.leaflet-bar`, separado de los demás** y del bloque + / −, con el mismo estilo arcade. De arriba abajo:
  1. **Añadir pin.**
  2. **Pantalla completa.**
  3. **Escala:** un solo botón que alterna entre tamaño real (1:1) y ajustar a la ventana.
- **Añadir pin:** solo el botón, **sin acción**. La funcionalidad (colocar pines personalizados) llega con los marcadores en SPEC 08.
  - Icono SVG inline: pin de mapa con un punto central y un "+" arriba a la derecha. Color con `currentColor`.
  - `aria-label` y `title`: "Añadir pin".
  - El control acepta un callback opcional `onAddPin`; sin él, el clic no hace nada.
- **Pantalla completa:**
  - Usa la Fullscreen API del navegador (`document.documentElement.requestFullscreen()`): la app ocupa todo el monitor sin la interfaz de Chrome.
  - El mismo botón sale (`document.exitFullscreen()`). Esc (nativo del navegador) también sale.
  - En pantalla completa solo se ve el mapa y los controles de la derecha: el panel lateral y su pestaña ◀/▶ se ocultan.
  - Al salir, el panel vuelve en el estado (expandido o contraído) que tenía al entrar.
  - El estado visual se decide por el evento `fullscreenchange`, no por el clic: así Esc y el botón dejan la UI igual.
  - Icono SVG inline de cuatro esquinas: hacia fuera para entrar, hacia dentro para salir. Color con `currentColor`.
  - `aria-label` y `title`: "Pantalla completa" / "Salir de pantalla completa".
  - Al entrar o salir, el zoom y el punto central de la vista se mantienen. El zoom mínimo y los límites de arrastre se recalculan como hoy en `resize` (SPEC 04).
  - Al desmontar el visor (← Mapas, botón atrás o cualquier cambio de ruta) en pantalla completa, se sale de ella.
  - Si `requestFullscreen()` falla (promesa rechazada), aviso con `notice.show("No se pudo activar la pantalla completa.", { type: "error" })` y la UI no cambia.
- **Botón de escala:** ofrece siempre la acción contraria a la vista actual.
  - Con el zoom a 0 (±0,01, tamaño real) muestra el icono de ajustar y su clic ajusta. En cualquier otro zoom muestra "1:1" y su clic pone el tamaño real.
  - Su forma, `aria-label` y `title` se actualizan en cada `zoomend` (botones, rueda, doble clic, ajustar y 1:1), no solo al pulsarlo.
- **Ajustar a la ventana** (acción del botón de escala):
  - Vuelve a la vista inicial: "mapa entero visible" y centrado, con el zoom de ajuste calculado en ese momento para el tamaño actual de la ventana.
  - Animado con la animación de zoom de Leaflet, como + / −.
  - Icono SVG inline (un recuadro). `aria-label` y `title`: "Ajustar a la ventana".
- **Tamaño real (1:1)** (acción del botón de escala):
  - Pone el zoom a 0 (1 px de imagen = 1 px de pantalla), manteniendo en el centro el punto de la imagen que estaba en el centro de la vista.
  - Si 0 queda fuera de `[minZoom, MAX_ZOOM]`, se usa el valor más cercano dentro del rango.
  - Animado con la animación de zoom de Leaflet.
  - Texto "1:1" en `--font-pixel`. `aria-label` y `title`: "Tamaño real (1:1)".
- Con `prefers-reduced-motion: reduce`, ajustar y 1:1 cambian la vista sin animación.
- Los tres son `<button>` con foco visible (contorno hacia dentro, como `.btn`).
- Los clics y la rueda sobre el bloque no llegan al mapa (no hacen zoom ni arrastre).
- El bloque se crea en un archivo nuevo `js/ui/view-controls.js`, como un `L.Control` en `bottomright` añadido después que el de zoom (en las esquinas de abajo Leaflet apila el último añadido arriba).
- Renumerar a SPEC 08 las menciones a "SPEC 06" como marcadores.
- Crear `tools/acceptance/spec-06.js`.

**Fuera de alcance (para specs futuras):**

- Atajos de teclado (F para pantalla completa u otros).
- Otros botones laterales (capas, medir, compartir, etc.).
- Mostrar el panel lateral dentro de pantalla completa.
- Indicador del nivel de zoom o del porcentaje.
- Acción del botón de añadir pin y cualquier marcador (SPEC 08).
- Deshabilitar el botón de escala o recordar la última acción pulsada: su estado sale del zoom actual.
- Recordar la pantalla completa entre mapas o aperturas.
- Pantalla completa fuera del visor (inicio o biblioteca).
- Marcadores (SPEC 08).

## Modelo de datos

Esta spec no introduce estructuras de datos persistentes. No toca IndexedDB, el esquema v2 ni `localStorage`.

Constante nueva en el visor:

```js
var ACTUAL_SIZE_ZOOM = 0; // CRS.Simple con la imagen en [0,0]–[height,width]: zoom 0 = 1:1
```

API del archivo nuevo, registrada en `window.Waypoint.ui.viewControls`:

```js
// Devuelve el L.Control; viewer-view.js lo añade al mapa antes que L.control.zoom.
viewControls.create({
  onToggleFullscreen: function () {},
  onFit: function () {},
  onActualSize: function () {},
});
// handlers.onAddPin es opcional: sin él, el botón de pin no hace nada (SPEC 08 lo conecta).
// control.setFullscreen(isFullscreen) cambia icono, aria-label y title del primer botón.
// control.setActualSize(isActualSize) cambia forma, aria-label y title del botón de escala.
```

Estado en memoria, por visor montado: ninguno nuevo para pantalla completa. Se lee de `document.fullscreenElement`.
Clase nueva en la raíz del visor: `.viewer--fullscreen` (oculta `.viewer__panel` y `.viewer__toggle`).

## Archivos

Nuevos:

- `js/ui/view-controls.js`: el `L.Control` con los tres botones, iconos SVG inline y `L.DomEvent.disableClickPropagation` / `disableScrollPropagation`.
- `tools/acceptance/spec-06.js`.

Modificados:

- `js/ui/viewer-view.js`: añade el control; implementa ajustar (reutiliza `fitZoom`), 1:1 y pantalla completa, y sincroniza el botón de escala en `zoomend`; escucha `fullscreenchange` y lo quita al desmontar; sale de pantalla completa al desmontar; clase `.viewer--fullscreen`.
- `css/viewer.css`: estilos del bloque y sus iconos; `.viewer--fullscreen` oculta panel y pestaña.
- `index.html`: `js/ui/view-controls.js` antes de `js/ui/viewer-view.js`.
- `README.md`: botones de vista; marcadores en SPEC 08.
- `CLAUDE.md`: `view-controls.js`, pantalla completa sobre `documentElement` y cómo probarla.
- `specs/01-*` a `specs/05-*` y `js/data/db.js`: renumeración de marcadores a SPEC 08.

## Plan de implementación

1. Renumerar: los marcadores pasan de SPEC 06 a SPEC 08 en `README.md`, `specs/01-*` a `specs/05-*` y el comentario de `js/data/db.js`. Prueba manual: `grep "SPEC 06"` solo encuentra esta spec.
2. Bloque de controles: crear `js/ui/view-controls.js` con los botones (el de pin sin acción) (iconos, `aria-label`, `title`) sin acciones, cargarlo en `index.html` y añadirlo en `viewer-view.js` encima de + / −. Estilos en `viewer.css`. Prueba manual: el bloque se ve encima de + / −, separado, con el estilo arcade; clic y rueda sobre él no mueven el mapa.
3. Ajustar a la ventana: `onFit` hace `setView(centro de la imagen, fitZoom(bounds))` animado (sin animación con movimiento reducido). Prueba manual: tras hacer zoom y arrastrar, el botón deja el mapa entero visible y centrado.
4. Tamaño real: `onActualSize` hace `setZoom` a 0 limitado a `[minZoom, MAX_ZOOM]`, manteniendo el centro. Prueba manual: la imagen se ve a 1 px por px y el punto central no cambia.
5. Pantalla completa: `onToggleFullscreen` pide o sale de pantalla completa sobre `document.documentElement`; `fullscreenchange` pone o quita `.viewer--fullscreen` y llama a `control.setFullscreen`; aviso si la petición falla; al desmontar se quita el listener y se sale si sigue activa. Prueba manual: el botón entra y sale; Esc sale; el panel se oculta dentro y vuelve como estaba al salir; salir del visor (cambio de ruta) en pantalla completa sale de ella.
6. Tests y docs: `tools/acceptance/spec-06.js` con los criterios automatizables y actualizar `README.md` y `CLAUDE.md`. Prueba manual: `spec-01.js` a `spec-06.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] En `#/map/<id>` hay tres botones, cada uno en su propia caja separada de las otras, en este orden de arriba abajo: añadir pin, pantalla completa y escala.
- [x] Los tres botones están encima del bloque + / −, en la esquina inferior derecha, y no se solapan con él.
- [x] El botón de pin tiene `aria-label` y `title` "Añadir pin", un `<svg>`, y su clic no cambia la vista ni lanza errores. Pantalla completa tiene `aria-label` y `title` "Pantalla completa". El botón de escala tiene "Tamaño real (1:1)" cuando el zoom no es 0 y "Ajustar a la ventana" cuando es 0 (±0,01).
- [x] El botón de escala muestra el texto "1:1" en `--font-pixel` (sin `<svg>`) cuando ofrece tamaño real, y un `<svg>` (sin texto) cuando ofrece ajustar; el de pin y el de pantalla completa siempre un `<svg>`.
- [x] Tras pulsar el botón de escala dos veces desde la vista inicial, la vista pasa a tamaño real y vuelve a "mapa entero"; tras un zoom con la rueda, el botón vuelve a mostrar "1:1".
- [x] Un clic en cualquiera de los tres no inicia un arrastre ni hace zoom por doble clic; un evento de rueda sobre el bloque no cambia el zoom.
- [x] Tras hacer zoom y arrastrar, el botón de escala (acción ajustar) deja la imagen centrada (±2 px) y tocando el ancho o el alto de la ventana (±2 px).
- [x] Tras la acción de tamaño real, `leafletMap.getZoom()` es 0 (±0,01) y el punto de la imagen en el centro de la vista sigue ahí (±2 px).
- [x] Con una imagen cuyo zoom mínimo es mayor que 0, la acción de tamaño real deja el zoom en el mínimo.
- [x] Con `prefers-reduced-motion: reduce` emulado, ajustar y 1:1 dejan la vista final en el mismo fotograma del clic (sin `zoomanim`).
- [x] Clic en pantalla completa: `document.fullscreenElement` es `document.documentElement`, la raíz tiene `.viewer--fullscreen` y `.viewer__panel` y `.viewer__toggle` no se ven.
- [x] En pantalla completa, el botón tiene `aria-label="Salir de pantalla completa"` y su icono cambia.
- [x] Un segundo clic sale de pantalla completa: `document.fullscreenElement` es `null`, sin `.viewer--fullscreen`, `aria-label="Pantalla completa"`.
- [x] Salir con Esc deja la UI igual que salir con el botón.
- [x] Con el panel contraído antes de entrar, al salir sigue contraído; con el panel expandido, sigue expandido.
- [x] Entrar y salir de pantalla completa mantiene el zoom (±0,01) y el punto de la imagen en el centro de la vista (±2 px).
- [x] Un cambio de ruta estando en pantalla completa (activar "← Mapas" por DOM, que el panel oculto no deja pulsar, o el botón atrás) lleva a `#/game/<gameId>` y `document.fullscreenElement` es `null`.
- [x] Si `requestFullscreen` se rechaza, aparece el aviso "No se pudo activar la pantalla completa." y la raíz no tiene `.viewer--fullscreen`.
- [x] Salir del visor no deja listeners de `fullscreenchange` (entrar y salir de pantalla completa en `#/game/<id>` no lanza errores).
- [x] Los botones tienen contorno de foco visible al recibir foco con Tab.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo.
- [x] `tools/acceptance/spec-01.js` a `spec-06.js` pasan con un `WP_PROFILE` vacío.
- [x] `grep "SPEC 06"` en `README.md`, `specs/01-*` a `specs/05-*` y `js/` no encuentra menciones a marcadores.

## Decisiones

- **Sí:** tres botones en esta spec: añadir pin (solo el botón, icono pin con "+" arriba a la derecha), pantalla completa y escala (alterna 1:1 / ajustar). Decisión del usuario (revisada en la implementación: antes eran tres botones, con ajustar y 1:1 separados).
- **Sí:** pantalla completa con la Fullscreen API del navegador, como MapGenie. Decisión del usuario.
- **No:** interpretar "tamaño real" del botón de pantalla completa como zoom 1:1. El 1:1 va en su propio botón.
- **Sí:** pantalla completa sobre `document.documentElement`, no sobre `.viewer`. Los avisos de `notice` y los diálogos cuelgan de `body`; con `.viewer` como elemento en pantalla completa no se verían.
- **Sí:** en pantalla completa solo el mapa: panel y pestaña ocultos. Al salir, el panel vuelve como estaba. Decisión del usuario.
- **No:** panel contraído con la pestaña visible dentro de pantalla completa. Descartado por el usuario.
- **Sí:** estado visual guiado por `fullscreenchange`. Esc lo gestiona el navegador y no pasa por el botón.
- **Sí:** mantener zoom y centro al entrar o salir; solo se recalculan zoom mínimo y límites con el `resize` existente. Decisión del usuario.
- **No:** reajustar a "mapa entero" al cambiar de modo. Pierde el zoom del usuario.
- **Sí:** salir de pantalla completa al desmontar el visor. La biblioteca nunca queda en pantalla completa. Decisión del usuario.
- **Sí:** botones sueltos, cada uno en su propia caja, encima de + / −. Decisión del usuario (revisada en la implementación: antes eran un solo bloque).
- **No:** un solo bloque con todos los botones ni una sola columna de cinco botones.
- **Sí:** el botón de escala deriva su estado del zoom actual (0 → ofrece ajustar; otro → ofrece 1:1), no de la última pulsación. Si el usuario hace zoom con la rueda, el botón vuelve a "1:1" y nunca queda desincronizado.
- **No:** alternar estrictamente por pulsación (1:1, ajustar, 1:1…) sin mirar la vista.
- **Sí:** ajustar y 1:1 animados como + / −; sin animación con movimiento reducido. Decisión del usuario.
- **Sí:** 1:1 centrado en el centro de la vista actual. Decisión del usuario.
- **No:** 1:1 centrado en el centro de la imagen. Pierde el sitio donde estaba el usuario.
- **Sí:** iconos SVG inline con `currentColor`. Press Start 2P no tiene glifos de pantalla completa y nada de CDN. Decisión del usuario.
- **Sí:** "1:1" como texto pixel en lugar de icono. Se lee sin ambigüedad.
- **Sí:** sin atajo de teclado. Coherente con SPEC 05. Decisión del usuario.
- **Sí:** control en archivo propio (`view-controls.js`). `viewer-view.js` ya es largo y el control es una pieza aislada.
- **Sí:** esta spec es la 06 y los marcadores pasan a SPEC 08. Numeración secuencial sin huecos, como en SPEC 02 a 05.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Chrome headless no concede pantalla completa o exige gesto de usuario | Pulsar el botón con entrada real (`cdpInput` / `Input.dispatchMouseEvent`). Si headless no la concede, probar los criterios de UI disparando `fullscreenchange` con `document.fullscreenElement` simulado y documentar el gotcha en `CLAUDE.md`. |
| `requestFullscreen` rechazado sin gesto (p. ej. llamado tras una promesa) | Llamarlo directamente dentro del handler de clic. Aviso de error si falla. |
| El `resize` de pantalla completa con zoom por debajo del nuevo mínimo cambia el zoom | Comportamiento ya existente de SPEC 04: sube al mínimo. Aceptado; el criterio de zoom estable se prueba con un zoom dentro del rango. |
| Clics o rueda sobre el bloque llegan a Leaflet o a `wheel-zoom.js` | `L.DomEvent.disableClickPropagation` y `disableScrollPropagation` en el contenedor del control. Criterio dedicado. |
| Animación de ajustar o 1:1 se anida con la inercia de un arrastre | Usar `setView`/`setZoom` de Leaflet (paran la inercia). `_panInsideMaxBounds` ya va sin animación (gotcha de CLAUDE.md). |
| `clip-path` recorta el foco de los botones | `outline-offset` negativo, como `.btn` (gotcha de CLAUDE.md). |
| Listener de `fullscreenchange` vivo tras desmontar | Quitarlo en la función de desmontaje. Criterio dedicado. |

## Qué **no** entra en esta spec

- Atajos de teclado.
- Otros botones laterales.
- Panel lateral dentro de pantalla completa.
- Indicador de zoom o botones deshabilitados según la vista.
- Pantalla completa fuera del visor o recordada entre aperturas.
- Marcadores y la acción del botón de pin (SPEC 08).

Cada una de estas, si llega, va en su propia spec.
