# SPEC 13 — Favicon retro

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 12
> **Fecha:** 2026-11-24
> **Objetivo:** Dar a Waypoint un favicon pixel art de pin sobre mapa plegado en neón cian y magenta, usarlo como marca de la cabecera y ponerlo en verde cuando el mapa abierto en el visor está completado.

## Por qué existe esta spec

Hoy `index.html` no tiene `<link rel="icon">`: la pestaña muestra el icono genérico de archivo de Chromium.
Con varias pestañas abiertas, Waypoint no se distingue.
El usuario quiere un icono que diga "mapa con marcadores" y que siga el estilo arcade de SPEC 02.
De paso, la marca de la cabecera (el diamante CSS) pasa a ser el mismo dibujo, para que logo y pestaña coincidan.
El favicon además refleja el estado "COMPLETADO" de SPEC 12 del mapa abierto.

## Alcance

**Dentro:**

- **Dibujo:** pin de mapa sobre un mapa de pergamino plegado en 3 paneles (pliegues en zigzag), en pixel art sobre una rejilla de 16×16.
  - Mapa en cian (`#00f5ff`, con relleno cian tenue) y pin en magenta (`#ff006e`) encima, sobre fondo `#0a0a0f`.
  - Cada pixel es un `<rect>` de 1×1 (o una fila de rects contiguos) con `shape-rendering="crispEdges"`; `viewBox="0 0 16 16"`.
  - Legible a 16 px: pliegues y pin reconocibles sin detalles de 1 px aislados.
- **Dos archivos SVG** en una carpeta nueva `img/`:
  - `img/favicon.svg`: estado normal (pin magenta).
  - `img/favicon-complete.svg`: idéntico salvo el pin, en verde neón (`#00ff88`, el de `.neon-green` y "COMPLETADO").
- **Favicon de pestaña:** `<link rel="icon" type="image/svg+xml" href="img/favicon.svg">` en el `<head>` de `index.html`, con `id="app-favicon"`.
- **Favicon dinámico** (módulo `js/ui/favicon.js`, `Waypoint.ui.favicon`):
  - `favicon.setComplete(b)` cambia el `href` del `<link id="app-favicon">` entre los dos archivos. Llamarlo con el mismo valor no toca el DOM.
  - Solo el visor (`#/map/<id>`) lo usa: tras cada `onCountsChange` de la capa de pines (SPEC 12), `setComplete(total > 0 && found === total)`.
  - Mapa sin pines: normal.
  - Marcar el último pendiente lo pone verde al momento; desmarcar, crear un pin nuevo (pendiente) o el revert de un `setFound` fallido lo devuelve a normal.
  - Al desmontar el visor (cualquier cambio de ruta), `setComplete(false)`. Inicio y biblioteca siempre muestran el normal.
  - Sin animación ni parpadeo del icono.
- **Marca de la cabecera:** el `<span class="app-header__mark">` pasa a `<img class="app-header__mark" src="img/favicon.svg" alt="" aria-hidden="true">`.
  - Unos 24 px (tamaño con token de `css/tokens.css`), `image-rendering: pixelated`.
  - Siempre el dibujo normal: no cambia con el progreso. Sin `flicker` (sigue solo en "WAYPOINT").
  - Se quitan de `css/base.css` los estilos del diamante.
- **Excepción de color:** los dos SVG llevan los hex de la paleta, porque un archivo suelto no lee los tokens CSS. Se documenta en `CLAUDE.md` junto a la de `silhouettes.js`.
- Crear `tools/acceptance/spec-13.js`.

**Fuera de alcance (para specs futuras):**

- Más estados del icono (en progreso, barra de progreso dentro del icono, porcentaje).
- Favicon según el progreso del juego o en la biblioteca (`#/game/<id>`).
- Marca de la cabecera dinámica o animada.
- PNG, `.ico`, `apple-touch-icon` o manifiesto de app.
- Cambiar el `<title>` de la pestaña con el progreso.
- Otro dibujo para la pantalla de inicio o por juego.

## Modelo de datos

Esta spec no introduce datos persistentes ni migración: el esquema sigue en v3.
El estado "completado" sale de `pins.counts()` / `onCountsChange` (SPEC 12).

API nueva en `Waypoint.ui.favicon` (`js/ui/favicon.js`):

```js
favicon.setComplete(true);  // href → "img/favicon-complete.svg"
favicon.setComplete(false); // href → "img/favicon.svg"
favicon.isComplete();       // → boolean, estado actual (para pruebas)
```

Convenciones:

- Completado = `total > 0 && found === total`, la misma regla que "COMPLETADO" en SPEC 12.
- El módulo busca `#app-favicon`; si no existe, no hace nada (sin error).
- Rutas relativas a `index.html`, válidas con `file://`.

## Archivos

Nuevos:

- `img/favicon.svg`: pin magenta sobre mapa plegado cian, 16×16.
- `img/favicon-complete.svg`: mismo dibujo con el pin verde.
- `js/ui/favicon.js`: `setComplete`, `isComplete`.
- `tools/acceptance/spec-13.js`.

Modificados:

- `index.html`: `<link rel="icon" id="app-favicon">`; la marca de la cabecera pasa a `<img>`; `js/ui/favicon.js` en orden de capa (antes de `viewer-view.js`).
- `css/base.css`: estilos de `.app-header__mark` como imagen pixel; fuera los del diamante.
- `css/tokens.css`: token del tamaño de la marca, si hace falta.
- `js/ui/viewer-view.js`: llama a `favicon.setComplete` en `onCountsChange` y `setComplete(false)` al desmontar.
- `tools/acceptance/spec-02.js`: si su criterio de la marca deja de valer con el `<img>`, se ajusta (la marca sigue existiendo).
- `README.md`: el favicon; estado SPEC 13.
- `CLAUDE.md`: excepción de hex de `img/*.svg`; favicon dinámico en gotchas; `spec-13.js` en la regresión.

## Plan de implementación

1. Dibujo: crear `img/favicon.svg` (16×16, rects con `crispEdges`) y enlazarlo en `index.html` con `id="app-favicon"`. Prueba manual: abrir `index.html` con doble clic; la pestaña muestra el pin magenta sobre el mapa cian, nítido.
2. Variante completada: crear `img/favicon-complete.svg` con el pin verde. Prueba manual: cambiar a mano el `href` en DevTools y ver el pin verde en la pestaña.
3. Marca de la cabecera: `<img class="app-header__mark">` con el SVG normal, estilos pixel en `css/base.css` y token de tamaño. Prueba manual: la cabecera muestra el mismo dibujo junto a "WAYPOINT", alineado y sin parpadeo.
4. Módulo: `js/ui/favicon.js` con `setComplete` / `isComplete`, añadido a `index.html` antes de `viewer-view.js`. Prueba manual: `Waypoint.ui.favicon.setComplete(true)` desde consola pone el pin verde; `false` lo devuelve.
5. Visor: en `onCountsChange`, `favicon.setComplete(total > 0 && found === total)`; al desmontar, `setComplete(false)`. Prueba manual: marcar el último pendiente pone verde la pestaña; volver a "← Mapas" la devuelve a magenta.
6. Tests y docs: `tools/acceptance/spec-13.js`; ajustar `spec-02.js` si hace falta; actualizar `README.md` y `CLAUDE.md`. Prueba manual: `spec-02.js`, `spec-12.js` y `spec-13.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] `index.html` tiene un único `<link rel="icon">`, con `id="app-favicon"`, `type="image/svg+xml"` y `href` que termina en `img/favicon.svg`.
- [x] `img/favicon.svg` e `img/favicon-complete.svg` cargan como imagen (`naturalWidth > 0`) y su `viewBox` es `0 0 16 16`.
- [x] Los dos SVG solo usan colores de la paleta: `#0a0a0f`, `#00f5ff` (también con opacidad) y `#ff006e` el normal; `#00ff88` en lugar de `#ff006e` el completado.
- [x] Los dos SVG tienen `shape-rendering="crispEdges"` y no tienen `<script>` ni referencias externas.
- [x] `.app-header__mark` es un `<img>` con `src` que termina en `img/favicon.svg`, `alt=""`, `aria-hidden="true"`, `image-rendering: pixelated` y sin animación.
- [x] En inicio (`#/`) y en la biblioteca (`#/game/<id>`), el `href` del favicon termina en `img/favicon.svg`.
- [x] En el visor, con un mapa de 3 pines y 2 encontrados, el favicon es el normal; marcar el tercero lo cambia a `img/favicon-complete.svg`.
- [x] Desmarcar un pin con el mapa completo vuelve a `img/favicon.svg`.
- [x] Crear un pin en un mapa completo vuelve a `img/favicon.svg`.
- [x] Si `markerService.setFound` falla al marcar el último pendiente, el favicon vuelve a `img/favicon.svg` junto con el pin.
- [x] Abrir un mapa ya completo muestra `img/favicon-complete.svg`; un mapa sin pines muestra `img/favicon.svg`.
- [x] Desde un mapa completo, pulsar "← Mapas" deja el favicon en `img/favicon.svg`.
- [x] Con el mapa completo, la marca de la cabecera sigue con `img/favicon.svg`.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo, salvo en `img/favicon.svg` e `img/favicon-complete.svg`.
- [x] `tools/acceptance/spec-02.js`, `spec-12.js` y `spec-13.js` pasan con un `WP_PROFILE` vacío.

## Decisiones

- **Sí:** pin sobre mapa plegado. Decisión del usuario; dice "mapa con marcadores".
- **No:** pin solo, diamante de la cabecera o brújula. El diamante no dice "mapa"; el pin solo pierde el contexto de mapa.
- **Sí:** pergamino plegado de 3 paneles. Silueta reconocible a 16 px.
- **No:** cuadrado con rejilla. A 16 px la rejilla es ruido.
- **Sí:** mapa cian y pin magenta. Decisión del usuario; el pin destaca, como el acento magenta de la marca anterior.
- **Sí:** rejilla de 16×16. Un pixel del dibujo es un pixel de la pestaña: nítido.
- **No:** 32×32. Se reescala en la pestaña y pierde detalle.
- **Sí:** SVG sin PNG ni `.ico`. Chromium soporta favicon SVG y Firefox no es objetivo; sin herramientas de generación.
- **Sí:** dos archivos SVG y un módulo que cambia el `href`. Sin generar SVG en código; los dos se pueden abrir y revisar a mano.
- **No:** SVG en data URL generado en JS. Duplicaría el dibujo o haría depender el estático de JS.
- **Sí:** favicon dinámico en esta spec. Decisión del usuario, aun advertido de que podía ir en otra.
- **Sí:** solo dos estados, normal y completado (pin verde). Legibles a 16 px y coherentes con "COMPLETADO" de SPEC 12.
- **No:** estado "en progreso" o barra dentro del icono. A 16 px la diferencia no se lee.
- **Sí:** depende solo del mapa abierto en el visor, con `pins.counts()`. Ya está en memoria; sin lecturas nuevas.
- **No:** progreso del juego ni favicon en la biblioteca. Más lecturas y más alcance.
- **Sí:** la marca de la cabecera usa el SVG normal, estática y sin flicker. Decisión del usuario; el logo no cambia con el progreso.
- **Sí:** `img/` como carpeta de recursos gráficos propios. Decisión del usuario; la raíz queda limpia.
- **Sí:** hex de la paleta dentro de los SVG como excepción documentada. Un archivo suelto no lee los tokens; mismo trato que `silhouettes.js`.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Chromium cachea el favicon y no refleja el cambio de `href` | Se cambia el `href` del mismo `<link>` a otro archivo (URL distinta); prueba manual en el paso 5. Si no basta, se reemplaza el `<link>` por uno nuevo. |
| El dibujo se emborrona a 16 px o en pantallas HiDPI | Rejilla 16×16 con `crispEdges`; revisión manual al 100 % y 200 % de zoom del sistema. |
| Contraste bajo del cian tenue en pestañas oscuras | Fondo `#0a0a0f` propio en el icono y borde cian pleno en el mapa. |
| Cambiar la marca a `<img>` rompe `spec-02.js` | El `<img>` conserva la clase `.app-header__mark`; el paso 6 ajusta el criterio si hace falta. |
| `setComplete` tras desmontar el visor deja el icono verde fuera del visor | `onCountsChange` no emite tras `pins.destroy()` (SPEC 12); el desmontaje llama a `setComplete(false)` al final. |

## Qué **no** entra en esta spec

- Estados intermedios o barra de progreso en el icono.
- Favicon por progreso del juego o en la biblioteca.
- Marca de la cabecera dinámica o animada.
- PNG, `.ico`, `apple-touch-icon` o manifiesto.
- Progreso en el `<title>` de la pestaña.
- Dibujos distintos por pantalla o por juego.

Cada una de estas, si llega, va en su propia spec.
