# SPEC 07 — Selector de mapas en el panel del visor

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03, SPEC 05
> **Fecha:** 2026-11-22
> **Objetivo:** Convertir el nombre del mapa del panel lateral del visor en un desplegable que lista los mapas del mismo juego y abre el elegido sin volver a la biblioteca.

## Por qué existe esta spec

Hoy, para pasar de un mapa a otro del mismo juego hay que pulsar "← Mapas", buscar la tarjeta y abrirla.
El usuario quiere el patrón de MapGenie: junto al nombre del mapa, un chevron que despliega la lista de mapas del juego y salta al elegido.
SPEC 05 dejó fuera la "lista de los otros mapas del juego para saltar entre ellos"; entra aquí.

Esta spec toma el número 07. Los marcadores pasan a SPEC 08, como ya hicieron SPEC 02 a 06.

## Alcance

**Dentro:**

- **Disparador:** el nombre del mapa del panel (`.viewer__title`) y un chevron a su derecha forman un solo `<button>` (`.viewer__map-trigger`) dentro del `<h1>`.
  - Clic en cualquier parte del botón abre la lista; otro clic la cierra.
  - Chevron como SVG inline con `currentColor`: "∨" cerrada, "∧" abierta.
  - `aria-haspopup="true"`, `aria-expanded`, `aria-controls` apuntando a la lista.
  - El `textContent` de `.viewer__title` sigue siendo exactamente el nombre del mapa (el chevron no aporta texto).
- **Un solo mapa en el juego:** no hay chevron ni botón; `.viewer__title` es texto, como hoy.
- **Lista** (`.viewer__map-list`), dentro del panel, justo debajo del nombre:
  - Empuja hacia abajo el contenido que haya debajo y usa el scroll interno del panel (alto fijo de media ventana, SPEC 05).
  - Todos los mapas del juego, incluido el abierto, en orden alfabético por nombre (`localeCompare` con `sensitivity: "base"`).
  - Cada fila: miniatura de 48×32 px (`object-fit: cover`, el `thumbnail` del store `maps`) y nombre en `--font-pixel` con `--font-size-pixel-xs`, con corte de líneas si es largo.
  - Mapa sin miniatura: hueco de 48×32 px con el fondo de las tarjetas, sin imagen.
  - Fila del mapa abierto: resaltada con el color de acento (sin "✓"), `aria-current="page"`, no es botón (no recibe foco ni tiene acción).
  - Resto de filas: `<button>`; clic o Enter abre ese mapa.
- **Abrir un mapa desde la lista:** navega a `#/map/<id>` con `router.goToMap(id)` (nueva entrada de historial).
  - El visor se remonta como al abrirlo desde la biblioteca: vista inicial "mapa entero visible", panel expandido, lista cerrada.
  - Atrás del navegador vuelve al mapa anterior.
  - Como cualquier apertura, actualiza `lastOpenedAt` del mapa y `lastUsedAt` del juego (`mapService.open`).
- **Cerrar sin cambiar de mapa:**
  - Clic de nuevo en el disparador.
  - Esc: cierra y devuelve el foco al disparador.
  - Clic (`pointerdown`) fuera de la lista y del disparador, también sobre el mapa. Ese clic sigue llegando al mapa (arrastre normal).
  - Contraer el panel con la pestaña ◀ cierra la lista.
- **Teclado:** filas como botones; Tab / Shift+Tab las recorre y Enter abre. Sin flechas.
- **Carga de la lista:** al montar, junto al juego, con `mapService.listByName(map.gameId)`.
  - Mientras no ha llegado, el título es texto sin chevron.
  - Si falla, el título queda como texto sin chevron, se registra el error en consola y el mapa sigue abierto.
- Los object URLs de las miniaturas se crean al abrir la lista por primera vez y se revocan al desmontar el visor.
- La rueda y el arrastre sobre la lista no mueven el mapa (ya ocurre: el panel es hermano del escenario, SPEC 05).
- Foco visible en disparador y filas, con contorno hacia dentro (como `.btn`).
- **Panel sin portada:** el bloque del juego del panel (SPEC 05) muestra solo el nombre del juego; se quita la portada (o la inicial). Decisión del usuario.
- **Biblioteca en orden alfabético:** la biblioteca de mapas de un juego (`mapService.listSorted`) pasa a ordenarse por nombre, igual que la lista del selector. Sustituye al orden "último abierto primero" de SPEC 01. Decisión del usuario.
- Renumerar a SPEC 08 las menciones a "SPEC 07" como marcadores.
- Crear `tools/acceptance/spec-07.js`.

**Fuera de alcance (para specs futuras):**

- Buscador dentro del desplegable.
- Navegación con flechas, Home/End o tecleo rápido (patrón listbox).
- Icono de filtros por fila (llega con los marcadores, si llega).
- Lista flotante sobre el mapa o más ancha que el panel.
- Selector de juego (saltar a mapas de otro juego).
- Recordar zoom, posición o estado del panel por mapa al saltar entre ellos.
- Renombrar, borrar o importar mapas desde el desplegable.
- Selector dentro de pantalla completa (el panel está oculto ahí, SPEC 06).
- Marcadores (SPEC 08).

## Modelo de datos

Esta spec no introduce estructuras de datos persistentes. No toca IndexedDB, el esquema v2 ni `localStorage`.
Reutiliza los campos `name` y `thumbnail` del store `maps` (SPEC 01) y el índice `gameId` (SPEC 03).

Función nueva en `Waypoint.services.mapService`:

```js
// Mapas del juego ordenados por nombre (localeCompare, sensitivity: "base").
mapService.listByName(gameId); // → Promise<object[]>
```

Estado en memoria, por visor montado:

```js
var mapListOpen = false; // siempre false al montar
var thumbUrls = [];      // object URLs de las miniaturas, revocados al desmontar
```

## Archivos

Nuevos:

- `tools/acceptance/spec-07.js`.

Modificados:

- `js/services/map-service.js`: `listByName(gameId)`; `listSorted` (biblioteca) pasa a orden alfabético.
- `js/ui/viewer-view.js`: disparador, lista, apertura y cierre (disparador, Esc, clic fuera, contraer el panel), listener de `pointerdown` en `document` quitado al desmontar, object URLs de miniaturas; comentario de cabecera actualizado.
- `css/viewer.css`: `.viewer__map-trigger`, chevron, `.viewer__map-list` y sus filas, fila actual, foco.
- `tools/acceptance/spec-01.js` y `spec-05.js`: orden alfabético de la biblioteca y panel sin portada.
- `README.md`: selector de mapas en el panel; marcadores en SPEC 08.
- `CLAUDE.md`: el panel del visor tiene selector de mapas; `spec-07.js` en la lista de regresión; marcadores en SPEC 08.
- `specs/01-*` a `specs/06-*`, `js/data/db.js` y `js/ui/view-controls.js`: renumeración de marcadores a SPEC 08.

`index.html` no cambia.

## Plan de implementación

1. Renumerar: los marcadores pasan de SPEC 07 a SPEC 08 en `README.md`, `CLAUDE.md`, `specs/01-*` a `specs/06-*`, `js/data/db.js` y `js/ui/view-controls.js`. Prueba manual: `grep "SPEC 07"` solo encuentra esta spec.
2. Servicio: `mapService.listByName(gameId)`. Prueba manual: desde consola, con mapas "beta", "Alfa" y "Ñu", devuelve Alfa, beta, Ñu.
3. Disparador: en `viewer-view.js`, cargar la lista al montar; con 2 o más mapas, `.viewer__title` contiene el botón con nombre y chevron, que alterna `aria-expanded` y la clase de abierto sin lista todavía. Con 1 mapa o si falla la carga, texto como hoy. Estilos en `viewer.css`. Prueba manual: con 2 mapas se ve el chevron y cambia ∨/∧ al pulsar; con 1, no hay chevron.
4. Lista: `.viewer__map-list` bajo el nombre con miniatura y nombre por fila, `aria-current` y resaltado en el actual; object URLs creados al abrir por primera vez y revocados al desmontar. Prueba manual: la lista sale ordenada, el actual marcado, y el panel hace scroll si no cabe.
5. Abrir y cerrar: clic o Enter en una fila llama a `router.goToMap(id)`; Esc, clic fuera y contraer el panel cierran; `pointerdown` de `document` se quita al desmontar. Prueba manual: saltar de mapa abre el elegido ajustado y con el panel expandido; Atrás vuelve al anterior; Esc devuelve el foco al disparador.
6. Tests y docs: `tools/acceptance/spec-07.js` con los criterios automatizables y actualizar `README.md` y `CLAUDE.md`. Prueba manual: `spec-01.js` a `spec-07.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] Con un juego de 3 mapas, `.viewer__title` contiene un `<button class="viewer__map-trigger">` con un `<svg>`, `aria-expanded="false"` y `aria-haspopup="true"`; el `textContent` de `.viewer__title` es el nombre del mapa.
- [x] Con un juego de 1 mapa, `.viewer__title` no contiene `<button>` ni `<svg>`.
- [x] Al abrir un mapa, `.viewer__map-list` no está visible.
- [x] Clic en el disparador: `aria-expanded="true"` y `.viewer__map-list` visible dentro de `.viewer__panel`, debajo de `.viewer__title`.
- [x] La lista tiene una fila por mapa del juego (3), en orden alfabético sin distinguir mayúsculas ("Alfa", "beta", "Ñu").
- [x] Cada fila muestra un `<img>` de 48×32 px (±1) con `object-fit: cover`, y el nombre en `--font-pixel`.
- [x] La fila del mapa abierto tiene `aria-current="page"` (resaltada, sin "✓") y no es ni contiene un `<button>`; las otras dos son `<button>`.
- [x] Clic en otra fila lleva a `#/map/<id>` de ese mapa; el visor muestra su nombre, la imagen ajustada a la ventana (±2 px), el panel expandido y la lista cerrada.
- [x] Tras saltar de mapa, `history.back()` vuelve a `#/map/<id>` del mapa anterior.
- [x] Segundo clic en el disparador cierra la lista (`aria-expanded="false"`).
- [x] Con la lista abierta, Esc (`cdpKey("Escape")`) la cierra y el foco queda en el disparador.
- [x] Con la lista abierta, un clic sobre el mapa la cierra y no cambia de ruta.
- [x] Con la lista abierta, contraer el panel con la pestaña la cierra.
- [x] Con la lista abierta, Tab desde el disparador recorre solo las filas que no son el mapa actual, y Enter en una abre ese mapa.
- [x] Con más mapas de los que caben, el panel hace scroll vertical y su alto no cambia (media ventana, ±1 px).
- [x] Un evento de rueda sobre la lista no cambia el zoom del mapa.
- [x] Si `mapService.listByName` falla, el mapa se abre igual y `.viewer__title` muestra el nombre sin `<button>`.
- [x] Saltar entre mapas varias veces y salir del visor no deja object URLs de miniaturas sin revocar ni listeners de `pointerdown` en `document` (clic en `#/game/<id>` no lanza errores).
- [x] El disparador y las filas tienen contorno de foco visible al recibir foco con Tab.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo.
- [x] `tools/acceptance/spec-01.js` a `spec-07.js` pasan con un `WP_PROFILE` vacío.
- [x] `grep "SPEC 07"` en `README.md`, `CLAUDE.md`, `specs/01-*` a `specs/06-*` y `js/` no encuentra menciones a marcadores.

## Decisiones

- **Sí:** desplegable de mapas del juego en el panel del visor, como MapGenie. Decisión del usuario.
- **Sí:** toda la fila del nombre (nombre + chevron) es el disparador. Diana más grande. Decisión del usuario.
- **No:** solo el chevron como botón. Diana pequeña.
- **Sí:** el botón va dentro de `.viewer__title` y el chevron es SVG. El `textContent` del título sigue siendo el nombre, que usan los tests de SPEC 01, 02 y 05.
- **Sí:** orden alfabético. Estable al saltar entre mapas. Decisión del usuario.
- **No:** orden de la biblioteca (último abierto primero). La lista se reordenaría en cada salto.
- **Sí:** ordenar en `mapService.listByName`, no en la UI. La lógica va en `services`.
- **No:** buscador en el desplegable. Descartado por el usuario.
- **Sí:** miniatura de 48×32 px con `cover` y nombre en pixel pequeña. Decisión del usuario.
- **No:** solo nombre, miniatura cuadrada o con aspecto real.
- **Sí:** lista dentro del panel, usando su scroll. Decisión del usuario.
- **No:** caja flotante sobre el mapa. Descartada por el usuario.
- **Sí:** con un solo mapa, sin chevron. Decisión del usuario.
- **Sí:** navegar con nueva entrada de historial; Atrás vuelve al mapa anterior. Decisión del usuario.
- **No:** `location.replace`. Atrás saldría del visor.
- **Sí:** remontar el visor al saltar (vista inicial, panel expandido). Igual que abrir desde la biblioteca, sin estado nuevo. Decisión del usuario.
- **Sí:** filas como botones con Tab; Esc cierra y devuelve el foco. Decisión del usuario.
- **No:** patrón listbox con flechas. Más código y casos.
- **Sí:** cierran la lista el disparador, Esc, el clic fuera y contraer el panel. Decisión del usuario (contraer: derivado de que el panel queda `inert`).
- **Sí:** la fila del mapa abierto no es pulsable. Decisión del usuario.
- **No:** que recargue el mapa o solo cierre la lista.
- **Sí:** la lista se pide al montar, junto al juego. Hace falta saber si hay más de un mapa para mostrar el chevron.
- **Sí:** miniaturas creadas al abrir la lista la primera vez. No se crean object URLs si nunca se abre.
- **Sí:** esta spec es la 07 y los marcadores pasan a SPEC 08. Numeración secuencial sin huecos, como en SPEC 02 a 06.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `clip-path` recorta el foco del disparador o las filas | `outline-offset` negativo, como `.btn` (gotcha de CLAUDE.md). |
| Listener de `pointerdown` en `document` vivo tras desmontar | Quitarlo en la función de desmontaje. Criterio dedicado. |
| Object URLs de miniaturas sin revocar al saltar entre mapas | Cada salto desmonta el visor; revocar `thumbUrls` en el desmontaje. Criterio dedicado. |
| La respuesta de `listByName` llega después de desmontar | Comprobar `alive` antes de pintar, como el bloque del juego. |
| Tests que comparan `.viewer__title` con el nombre | El chevron es SVG sin texto; `textContent` no cambia. |
| Lista larga hace crecer el panel | El panel ya tiene alto fijo y scroll interno (SPEC 05). Criterio dedicado. |

## Qué **no** entra en esta spec

- Buscador o navegación con flechas en el desplegable.
- Lista flotante sobre el mapa.
- Selector de juego o acciones sobre mapas desde la lista.
- Recordar vista o estado del panel por mapa.
- Selector dentro de pantalla completa.
- Marcadores (SPEC 08).

Cada una de estas, si llega, va en su propia spec.
