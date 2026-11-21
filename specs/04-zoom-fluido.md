# SPEC 04 — Zoom fluido y alejamiento ampliado en el visor

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 03
> **Fecha:** 2026-11-21
> **Objetivo:** Que la rueda del ratón haga zoom en el visor de forma continua y suave, a 1/3 de nivel por clic, y que el mapa pueda alejarse hasta un cuarto del tamaño de "mapa entero visible".

## Por qué existe esta spec

Hoy la rueda va lenta (`wheelPxPerZoomLevel: 120`, el doble que el valor de Leaflet).
Además Leaflet anima la rueda a saltos: acumula eventos, espera y anima hasta el nuevo nivel.
El zoom mínimo es justo el de "mapa entero visible", así que no se puede ver el mapa más pequeño.

La fluidez no se consigue solo con opciones de Leaflet.
Por eso el zoom de rueda pasa a un handler propio que interpola el zoom en cada fotograma.

Esta spec toma el número 04. Los marcadores pasan a SPEC 07, como ya hicieron SPEC 02 y SPEC 03.

## Alcance

**Dentro:**

- Handler propio de rueda que sustituye a `scrollWheelZoom` de Leaflet en el visor.
- Zoom de rueda continuo: el zoom avanza hacia un zoom destino en cada fotograma, sin saltos.
- Velocidad de rueda: un clic de rueda (`deltaY` 100 px) = 1/3 de nivel de zoom (×1,26 de tamaño; 3 clics duplican), como MapGenie.
- El punto de la imagen bajo el cursor se queda bajo el cursor durante el zoom.
- Touchpad: desplazamiento a dos dedos y pellizco (`wheel` con `ctrlKey`) hacen zoom proporcional a `deltaY`. El pellizco no escala la página.
- Zoom mínimo = zoom de "mapa entero visible" − 2 (la imagen puede verse a 1/4 de ese tamaño).
- El zoom mínimo se recalcula al cambiar el tamaño de la ventana, como hoy.
- Arrastre como en MapGenie: la imagen puede salir de la vista por cualquier borde ("se va por detrás"), a cualquier zoom.
- En cada eje quedan siempre al menos 100 px de imagen dentro de la vista (o la imagen entera, si mide menos), para no perderla. Sustituye al criterio 17 de SPEC 01 ("no se puede sacar la imagen de la vista").
- Botones + / − y doble clic: paso de 1 nivel (hoy 0,5), con la animación de Leaflet. Respetan el nuevo mínimo.
- `prefers-reduced-motion: reduce`: el zoom de rueda salta al destino sin interpolar.
- Al abrir un mapa, la vista inicial sigue siendo "mapa entero visible" y centrado.
- Renumerar a SPEC 07 las menciones a "SPEC 04" como marcadores.
- Adaptar `tools/acceptance/spec-01.js` al nuevo mínimo y crear `tools/acceptance/spec-04.js`.

**Fuera de alcance (para specs futuras):**

- Ajustar la velocidad de zoom desde la UI o guardarla como preferencia.
- Cambiar el zoom máximo (sigue en 2, 4× el tamaño real).
- Inercia al soltar un arrastre.
- Zoom táctil en pantallas táctiles.
- Botón "ajustar a la ventana" o indicador de nivel de zoom.
- Recordar el zoom y la posición de cada mapa al volver a abrirlo.
- Cambiar los botones + / − o el doble clic bajo `prefers-reduced-motion`.
- Marcadores (SPEC 07).

## Modelo de datos

Esta spec no introduce estructuras de datos persistentes. No toca IndexedDB ni el esquema v2 de SPEC 03.

Constantes nuevas en el visor (valores iniciales):

```js
var MAX_ZOOM = 2;                 // sin cambios: 4× el tamaño real
var MIN_VISIBLE_PX = 100;         // px de imagen que siempre quedan dentro de la vista, por eje
var MIN_ZOOM_BELOW_FIT = 2;       // zoom mínimo = fitZoom − 2 → 1/4 del tamaño de ajuste
var ZOOM_PER_WHEEL_PX = 1 / 300;  // 300 px de deltaY = 1 nivel de zoom (un clic de 100 px = 1/3)
var WHEEL_LINE_PX = 40;           // deltaMode 1 (líneas) → px
var WHEEL_SMOOTH_MS = 45;         // constante de tiempo de la interpolación (con 60 un nivel tardaba ~414 ms en asentarse)
var WHEEL_SETTLE_EPSILON = 0.001; // diferencia con el destino por debajo de la cual se para
```

Estado del handler de rueda (en memoria, por visor montado):

```js
const wheelState = {
  targetZoom: 1.25,      // zoom destino, limitado a [minZoom, MAX_ZOOM]
  anchor: L.point(x, y), // posición del cursor en el contenedor, en px
  frameId: null,         // requestAnimationFrame en curso o null
  lastTime: 0,           // timestamp del fotograma anterior
};
```

Convenciones:

- Paso por fotograma: `zoom += (targetZoom − zoom) × (1 − exp(−dt / WHEEL_SMOOTH_MS))`.
- Cada evento `wheel` suma `−deltaY × ZOOM_PER_WHEEL_PX` al zoom destino (`deltaY` en px tras normalizar `deltaMode`).
- El ancla es la posición del último evento: el punto de imagen bajo ella no se mueve.
- Límites de arrastre por eje, en px de pantalla al zoom vigente: la intersección de imagen y vista mide al menos `min(MIN_VISIBLE_PX, imagen, vista)`. Con `maxBounds`: los bounds de la imagen ampliados por cada lado en (vista − ese mínimo).

## Archivos

Nuevos:

- `js/ui/wheel-zoom.js`: `Waypoint.ui.wheelZoom.attach(leafletMap, { maxZoom })` registra el handler de rueda en el contenedor del mapa y devuelve la función `detach()`.
- `tools/acceptance/spec-04.js`.

Modificados:

- `js/ui/viewer-view.js`: `scrollWheelZoom: false`, `zoomDelta: 1`, sin `wheelPxPerZoomLevel`; mínimo `fitZoom − 2`; límites de arrastre por eje recalculados tras cada zoom y al redimensionar; llama a `wheelZoom.attach` y a `detach()` al desmontar. Comentario de cabecera actualizado.
- `index.html`: carga `js/ui/wheel-zoom.js` antes de `viewer-view.js`.
- `tools/acceptance/spec-01.js`: el criterio 16 comprueba el nuevo mínimo (1/4 del ajuste) en vez de "no baja del ajuste".
- `README.md`: rueda, touchpad y nuevo rango de zoom; marcadores en SPEC 07.
- `CLAUDE.md`: el zoom de rueda es propio (`wheel-zoom.js`), no de Leaflet.
- `specs/01-biblioteca-de-mapas.md`, `specs/02-tema-arcade-retro.md`, `specs/03-carpetas-de-juegos.md`, `js/data/db.js`: renumeración de marcadores a SPEC 07.

## Plan de implementación

1. Renumerar: los marcadores pasan de SPEC 04 a SPEC 07 en `README.md`, `specs/01-*`, `specs/02-*`, `specs/03-*` y el comentario de `js/data/db.js`. Prueba manual: `grep "SPEC 04"` solo encuentra esta spec.
2. Zoom mínimo y botones en `viewer-view.js`: mínimo `fitZoom − MIN_ZOOM_BELOW_FIT` (también en `resize`), `zoomDelta: 1`. Vista inicial en `fitZoom`. Prueba manual: con − se aleja dos pasos por debajo del ajuste y no más; con + llega a 4×.
3. Límites de arrastre por eje en `viewer-view.js`: sustituir `maxBounds` fijo por `updateMaxBounds()`, que amplía los bounds de la imagen para que siempre queden `MIN_VISIBLE_PX` de ella dentro. Se llama en `zoomend` y en `resize`. Prueba manual: a cualquier zoom, el mapa se arrastra fuera de la ventana y siempre queda un trozo visible.
4. `js/ui/wheel-zoom.js` con rueda de ratón: `wheel` con `passive: false` y `preventDefault`, zoom destino acumulado y limitado, bucle `requestAnimationFrame` con interpolación exponencial anclada al cursor, límites de arrastre aplicados en cada fotograma. Conectarlo en `viewer-view.js` con `scrollWheelZoom: false` y `detach()` al desmontar. Cargarlo en `index.html`. Prueba manual: la rueda acerca y aleja sin saltos y el punto bajo el cursor no se mueve.
5. Touchpad y movimiento reducido en `wheel-zoom.js`: normalizar `deltaMode` 1 con `WHEEL_LINE_PX`; `ctrlKey` (pellizco) usa el mismo cálculo y su `preventDefault` evita el zoom de página; con `prefers-reduced-motion: reduce` (consultado en cada evento) aplica el destino sin interpolar. Prueba manual: pellizco en un touchpad hace zoom del mapa y no de la página.
6. Adaptar el criterio 16 de `tools/acceptance/spec-01.js`, escribir `tools/acceptance/spec-04.js` con los criterios automatizables y actualizar `README.md` y `CLAUDE.md`. Prueba manual: `spec-01.js`, `spec-02.js`, `spec-03.js` y `spec-04.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] Al abrir un mapa, la imagen entera se ve centrada, al zoom de ajuste (igual que antes).
- [x] Un evento de rueda con `deltaY = −100` sobre el visor acaba en un zoom 1/3 de nivel mayor (±0,02) que el de partida, si no toca el máximo.
- [x] Tras ese evento, el zoom pasa por al menos 3 valores intermedios distintos antes de llegar al destino (muestreo por fotograma).
- [x] 400 ms después del último evento de rueda, el zoom ya no cambia.
- [x] Durante y después de un zoom de rueda, el punto de la imagen bajo el cursor sigue bajo el cursor (±2 px), salvo cuando lo impide un límite de arrastre.
- [x] Muchos eventos de rueda hacia fuera dejan la imagen a 1/4 (±1 %) del ancho de ajuste, y no menos.
- [x] Muchos eventos de rueda hacia dentro dejan la imagen a 4× su tamaño real (±1 %), y no más.
- [x] Un evento `wheel` con `ctrlKey: true` hace zoom del mapa y `window.visualViewport.scale` sigue en 1.
- [x] Un evento `wheel` con `deltaMode: 1` y `deltaY: −3` hace zoom hacia dentro.
- [x] Con `prefers-reduced-motion: reduce` emulado, un evento de rueda deja el zoom en el destino en el primer fotograma, sin valores intermedios.
- [x] Pulsar + una vez sube el zoom 1 nivel; pulsar − baja 1 nivel; ninguno baja del mínimo nuevo.
- [x] Doble clic sobre el mapa sube el zoom 1 nivel.
- [x] Al zoom mínimo, tras arrastrar 4000 px en cualquier dirección, la imagen sale por ese borde y quedan 100 px (±1) de ella dentro del visor en cada eje desplazado.
- [x] Acercado por encima del ajuste, tras arrastrar hasta el tope hacia cualquier esquina, quedan 100 px (±1) de imagen dentro del visor en cada eje (sustituye al criterio 17 de SPEC 01).
- [x] Al hacer la ventana más pequeña con la imagen al mínimo, el zoom no queda por debajo del nuevo mínimo y siguen quedando al menos 100 px de imagen dentro en cada eje.
- [x] Salir del visor y volver a entrar no deja listeners de `wheel` duplicados (un evento produce un solo paso de zoom).
- [x] La rueda fuera del visor (en `#/` y `#/game/<id>`) sigue haciendo scroll normal de la página.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo.
- [x] `tools/acceptance/spec-01.js`, `spec-02.js`, `spec-03.js` y `spec-04.js` pasan con un `WP_PROFILE` vacío.
- [x] `grep "SPEC 04"` en `README.md`, `specs/01-*`, `specs/02-*`, `specs/03-*` y `js/` no encuentra menciones a marcadores.

## Decisiones

- **Sí:** handler de rueda propio con `requestAnimationFrame`. Da zoom continuo y anclado al cursor. Decisión del usuario.
- **No:** solo ajustar opciones de Leaflet (`wheelPxPerZoomLevel`, `wheelDebounceTime`). Más rápido, pero sigue a saltos.
- **No:** plugin Leaflet.SmoothWheelZoom en `vendor/`. Poco mantenido; el código propio es corto y se adapta a los límites de arrastre por eje.
- **Sí:** el handler en un archivo aparte (`js/ui/wheel-zoom.js`) con `attach`/`detach`. Mantiene `viewer-view.js` legible y el desmontaje explícito.
- **Sí:** 300 px de `deltaY` = 1 nivel: un clic de rueda = 1/3 de nivel (×1,26), como MapGenie. Decisión del usuario tras probarlo.
- **No:** 100 px = 1 nivel (un clic duplica o divide el tamaño). Primer valor de la spec; en la práctica cada clic acercaba o alejaba demasiado.
- **No:** velocidad configurable en la UI. Otra spec si hace falta.
- **Sí:** interpolación exponencial hacia un zoom destino. Los eventos seguidos se suman al destino sin reiniciar la animación.
- **Sí:** zoom mínimo = ajuste − 2 (1/4 del tamaño de ajuste). Sigue legible como miniatura. Decisión del usuario.
- **No:** 1/2 ni 1/8 del ajuste. Uno se queda corto; el otro deja la imagen casi como un punto.
- **Sí:** la imagen puede salir de la vista por cualquier borde, dejando siempre 100 px dentro por eje, como MapGenie. Decisión del usuario tras probarlo.
- **No:** imagen siempre entera dentro (al alejarse) y sin hueco en el borde (al acercarse). Primer diseño de la spec; se sentía rígido al arrastrar.
- **No:** arrastre totalmente libre ni límite "el borde llega hasta el centro de la pantalla". El primero deja perder el mapa; el segundo deja muy poco recorrido.
- **No:** imagen fija y centrada al alejarse (lo que haría `maxBounds` de Leaflet). Impide colocar la miniatura donde se quiera.
- **Sí:** botones + / − y doble clic con paso de 1 nivel. Decisión del usuario.
- **Sí:** touchpad y pellizco con el mismo cálculo por `deltaY`. Rueda y touchpad comparten código. Decisión del usuario.
- **Sí:** zoom de rueda instantáneo con `prefers-reduced-motion: reduce`. Coherente con la regla global de `css/effects.css`. Decisión del usuario.
- **Sí:** zoom máximo sin cambios (2, 4× el tamaño real). No se pidió.
- **Sí:** esta spec es la 04 y los marcadores pasan a SPEC 07. Numeración secuencial sin huecos, como en SPEC 02 y 03. Decisión del usuario.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cambiar el zoom de Leaflet en cada fotograma es lento con imágenes grandes | Mover la vista sin animación ni `viewreset` por fotograma y disparar `zoomend`/`moveend` solo al terminar. Probarlo en el paso 4 con el mapa más grande del usuario. |
| El pellizco del touchpad envía `deltaY` pequeños y se siente lento | `ZOOM_PER_WHEEL_PX` es una constante; ajustarla en el paso 5 sobre un touchpad real y anotar el valor en esta spec. |
| `wheel` como listener pasivo no permite `preventDefault` y la página hace scroll o zoom | Registrar con `{ passive: false }`. Criterio de `visualViewport.scale` dedicado. |
| Los límites de arrastre por eje chocan con la interpolación y la vista tiembla en el borde | Aplicar el límite dentro del mismo fotograma, después de mover, y cancelar el ancla en el eje limitado. |
| El bucle de animación sigue vivo tras salir del visor | `detach()` cancela el `requestAnimationFrame` y quita el listener; `viewer-view.js` lo llama al desmontar. Criterio de listeners duplicados. |
| El criterio 16 de `spec-01.js` falla con el nuevo mínimo | Adaptarlo en el paso 6. |

## Qué **no** entra en esta spec

- Velocidad de zoom configurable.
- Cambio del zoom máximo.
- Inercia al arrastrar y zoom táctil.
- Botón de ajustar, indicador de zoom o recordar la vista de cada mapa.
- Cambios en botones o doble clic bajo movimiento reducido.
- Marcadores (SPEC 07).

Cada una de estas, si llega, va en su propia spec.
