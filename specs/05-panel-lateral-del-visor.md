# SPEC 05 — Panel lateral plegable en el visor

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03, SPEC 04
> **Fecha:** 2026-11-21
> **Objetivo:** Sustituir la barra superior del visor por un panel lateral izquierdo, superpuesto al mapa y plegable con un botón, para que el mapa ocupe toda la ventana.

## Por qué existe esta spec

Hoy el visor tiene una barra superior fija (`.viewer__bar`, 56 px) con "← Mapas" y el nombre del mapa.
Esa barra resta alto al mapa en todo momento.
El usuario quiere el patrón de MapGenie: un panel a la izquierda que se pliega con una pestaña y deja el mapa entero a la vista.

El panel nace con poco contenido (volver, juego y mapa).
Es el sitio donde SPEC 06 pondrá los filtros y listas de marcadores.

Esta spec toma el número 05. Los marcadores pasan a SPEC 06, como ya hicieron SPEC 02, 03 y 04.

## Alcance

**Dentro:**

- Quitar la barra superior del visor (`.viewer__bar`).
- El escenario del mapa (`.viewer__stage`) ocupa toda la ventana.
- Panel lateral izquierdo de 320 px, superpuesto al mapa (no lo empuja ni redimensiona Leaflet).
- Contenido del panel, de arriba abajo:
  - Botón "← Mapas" (vuelve a `#/game/<gameId>`, como hoy).
  - Portada pequeña del juego (o el placeholder `.game-placeholder` con la inicial si no tiene) y su nombre en pixel. Solo informativo: no es enlace.
  - Nombre del mapa en pixel (`.viewer__title`), con corte de líneas si es largo.
- Botón pestaña pegado al borde derecho del panel, arriba: "◀" con el panel expandido, "▶" con el panel contraído.
- Contraído: el panel sale por la izquierda y solo queda la pestaña en el borde izquierdo de la ventana.
- Expandir y contraer con una transición de deslizamiento de 200 ms. Con `prefers-reduced-motion: reduce`, sin transición.
- Al abrir un mapa, el panel siempre empieza expandido. No se guarda el estado.
- Accesibilidad: la pestaña es un `<button>` con `aria-expanded`, `aria-controls` y `aria-label` "Contraer panel" / "Expandir panel". Con el panel contraído, su contenido no recibe foco (`inert`).
- La rueda y el arrastre sobre el panel no mueven el mapa.
- La vista inicial "mapa entero visible" sigue ajustada a la ventana completa: con el panel expandido, la parte izquierda de la imagen queda debajo del panel.
- Los botones + / − siguen abajo a la derecha.
- Mientras carga, el panel ya se ve con "← Mapas" y "Cargando…" como nombre del mapa.
- Renumerar a SPEC 06 las menciones a "SPEC 05" como marcadores.
- Adaptar los tests de aceptación que dependan de la barra y crear `tools/acceptance/spec-05.js`.

**Fuera de alcance (para specs futuras):**

- Recordar expandido / contraído entre aperturas.
- Atajo de teclado para plegar el panel.
- Lista de los otros mapas del juego para saltar entre ellos.
- Portada o nombre del juego como enlace.
- Panel adaptado a ventanas estrechas o móviles.
- Ancho del panel ajustable arrastrando su borde.
- Reajustar el zoom o mover la imagen al expandir o contraer.
- Buscador, filtros, categorías o contadores (llegan con los marcadores).
- Marcadores (SPEC 06).

## Modelo de datos

Esta spec no introduce estructuras de datos persistentes. No toca IndexedDB, el esquema v2 ni `localStorage`.

Estado en memoria, por visor montado:

```js
var panelExpanded = true; // siempre true al montar
```

Token nuevo en `css/tokens.css`:

```css
--viewer-panel-width: 320px;
```

El juego del mapa se lee con `gameService.get(map.gameId)` después de `mapService.open(id)`.
Si falla, el panel se muestra sin el bloque del juego y se registra el error en consola; el mapa se abre igual.

## Archivos

Nuevos:

- `tools/acceptance/spec-05.js`.

Modificados:

- `js/ui/viewer-view.js`: sustituye `.viewer__bar` por `.viewer__panel` (volver, bloque del juego, nombre del mapa) y la pestaña `.viewer__toggle`; lee el juego con `gameService`; crea y revoca el object URL de la portada; comentario de cabecera actualizado.
- `css/viewer.css`: quita `.viewer__bar`; estilos de `.viewer__panel`, `.viewer__toggle`, bloque del juego y estado contraído (`.viewer--panel-collapsed`); transición anulada con `prefers-reduced-motion: reduce`.
- `css/tokens.css`: `--viewer-panel-width`.
- `tools/acceptance/spec-01.js`, `spec-02.js`, `spec-03.js`, `spec-04.js`: solo si algún criterio depende de la barra superior o del alto del escenario.
- `README.md`: el visor tiene panel lateral plegable; marcadores en SPEC 06.
- `CLAUDE.md`: el visor usa panel lateral, no barra.
- `specs/01-biblioteca-de-mapas.md`, `specs/02-tema-arcade-retro.md`, `specs/03-carpetas-de-juegos.md`, `specs/04-zoom-fluido.md`, `js/data/db.js`: renumeración de marcadores a SPEC 06.

`index.html` no cambia: `game-service.js` ya se carga antes de `viewer-view.js`.

## Plan de implementación

1. Renumerar: los marcadores pasan de SPEC 05 a SPEC 06 en `README.md`, `specs/01-*` a `specs/04-*` y el comentario de `js/data/db.js`. Prueba manual: `grep "SPEC 05"` solo encuentra esta spec.
2. Panel en lugar de barra: en `viewer-view.js`, `.viewer__panel` con "← Mapas" y `.viewer__title`; `.viewer__stage` a pantalla completa con el panel superpuesto (`position: absolute`, `z-index` sobre Leaflet). Token `--viewer-panel-width`. Prueba manual: el mapa llena la ventana, el panel queda encima a la izquierda y "← Mapas" vuelve al juego.
3. Bloque del juego: `gameService.get(map.gameId)`, portada pequeña con object URL (revocado al desmontar) o `.game-placeholder`, y nombre del juego en pixel. Si falla, sin bloque. Prueba manual: se ven portada y nombre; con un juego sin portada, la inicial.
4. Pestaña y plegado: `.viewer__toggle` con ◀ / ▶, `aria-expanded`, `aria-controls`, `aria-label`; clase `.viewer--panel-collapsed` que desplaza el panel con `transform` y 200 ms de transición; `inert` en el contenido contraído; transición anulada con movimiento reducido. Prueba manual: la pestaña pliega y despliega; contraído solo queda la pestaña en el borde.
5. Aislar el panel del mapa: la rueda y el arrastre sobre el panel no llegan a Leaflet ni a `wheel-zoom.js`. Prueba manual: rueda y arrastre sobre el panel no mueven el mapa; sobre el mapa sí.
6. Tests y docs: adaptar `spec-01.js` a `spec-04.js` donde dependan de la barra, escribir `tools/acceptance/spec-05.js` con los criterios automatizables y actualizar `README.md` y `CLAUDE.md`. Prueba manual: `spec-01.js` a `spec-05.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] En `#/map/<id>` no existe `.viewer__bar`.
- [x] `.viewer__stage` mide lo mismo que la ventana (±1 px) en ancho y alto.
- [x] Al abrir un mapa, `.viewer__panel` está expandido: su borde izquierdo en x = 0 y su ancho 320 px (±1).
- [x] El panel contiene "← Mapas", el nombre del juego y el nombre del mapa; ambos nombres en `--font-pixel`.
- [x] Con un juego con portada, el panel muestra un `<img>` con ella; con un juego sin portada, `.game-placeholder` con la inicial.
- [x] Clic en "← Mapas" lleva a `#/game/<gameId>` del mapa.
- [x] La pestaña `.viewer__toggle` tiene `aria-expanded="true"` y `aria-label="Contraer panel"` con el panel expandido.
- [x] Tras clic en la pestaña: `aria-expanded="false"`, `aria-label="Expandir panel"`, el panel queda fuera de la ventana (borde derecho ≤ 0) y la pestaña sigue visible pegada al borde izquierdo.
- [x] Con el panel contraído, `Tab` no lleva el foco a "← Mapas".
- [x] Un segundo clic en la pestaña deja el panel como al abrir.
- [x] Expandir o contraer no cambia el zoom ni la posición de la imagen en pantalla (±1 px).
- [x] El panel tiene `transition-duration` de 200 ms; con `prefers-reduced-motion: reduce` emulado, 0 s.
- [x] Al abrir el mapa, la imagen se ajusta a la ventana completa (toca su ancho o su alto, ±2 px), igual que en SPEC 04.
- [x] Un evento de rueda sobre el panel no cambia el zoom; sobre el mapa sí.
- [x] Un arrastre que empieza sobre el panel no mueve el mapa.
- [x] Salir del visor y volver a otro mapa abre el panel expandido y no deja object URLs de portada sin revocar.
- [x] Si `gameService.get` falla, el mapa se abre igual y el panel muestra "← Mapas" y el nombre del mapa.
- [x] Los botones + / − siguen en la esquina inferior derecha.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo.
- [x] `tools/acceptance/spec-01.js` a `spec-05.js` pasan con un `WP_PROFILE` vacío.
- [x] `grep "SPEC 05"` en `README.md`, `specs/01-*` a `specs/04-*` y `js/` no encuentra menciones a marcadores.

## Decisiones

- **Sí:** panel lateral izquierdo plegable en lugar de barra superior, como MapGenie. Gana alto de mapa. Decisión del usuario.
- **Sí:** contenido mínimo (volver, juego, mapa). Deja el hueco para los filtros de marcadores. Decisión del usuario.
- **No:** lista de los otros mapas del juego en el panel. Más alcance; otra spec si hace falta.
- **Sí:** panel superpuesto al mapa. Expandir y contraer no redimensiona Leaflet ni recalcula zoom mínimo ni límites. Decisión del usuario.
- **No:** panel que empuja el mapa. Obliga a `invalidateSize` y a recalcular zoom y límites en cada cambio.
- **Sí:** siempre expandido al abrir, sin persistencia. Decisión del usuario.
- **No:** recordar el último estado en `localStorage`. Se descartó a favor de un comportamiento fijo.
- **Sí:** deslizamiento de 200 ms, sin atajo de teclado. Decisión del usuario.
- **Sí:** anular la transición en el CSS del componente con `prefers-reduced-motion`. La regla global de `css/effects.css` solo anula `animation`, no `transition`.
- **Sí:** vista inicial ajustada a la ventana completa, aunque el panel tape la parte izquierda. Decisión del usuario.
- **No:** ajustar al hueco a la derecha del panel. Se descartó por el usuario.
- **Sí:** 320 px de ancho, como token. Decisión del usuario.
- **Sí:** alto fijo de media ventana (`height: 50%`, scroll interno si no cabe), tenga o no contenido, pegado arriba a la izquierda. Decisión del usuario.
- **No:** panel a todo el alto de la ventana, alto según el contenido ni tarjeta flotante con margen. Descartados por el usuario.
- **Sí:** portada y nombre del juego solo informativos. "← Mapas" ya vuelve al juego. Decisión del usuario.
- **Sí:** sin trato especial en ventanas estrechas. La app apunta a escritorio Chrome/Edge. Decisión del usuario.
- **Sí:** mantener las clases `.viewer__back`, `.viewer__title` y `.viewer__stage`. Los tests de SPEC 01 a 04 las usan.
- **Sí:** esta spec es la 05 y los marcadores pasan a SPEC 06. Numeración secuencial sin huecos, como en SPEC 02, 03 y 04.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La rueda o el arrastre sobre el panel llegan a Leaflet o a `wheel-zoom.js` | Panel fuera del contenedor de Leaflet (hermano de `.viewer__stage`) o `L.DomEvent.disableScrollPropagation`/`disableClickPropagation`. Criterios dedicados. |
| `clip-path` de `.btn` recorta el foco de la pestaña | Usar el mismo `outline-offset` negativo que `.btn` (gotcha de CLAUDE.md). |
| El panel contraído sigue recibiendo foco con `Tab` | `inert` en el panel contraído, conservando la pestaña fuera de él. Criterio dedicado. |
| La pestaña tapa controles de Leaflet o queda bajo ellos | Los controles de Leaflet están abajo a la derecha; la pestaña va arriba a la izquierda con `z-index` sobre `.leaflet-pane`. |
| Tests de SPEC 01 a 04 dependen del alto de la barra | Revisarlos en el paso 6 y adaptar solo lo necesario. |
| Object URL de la portada sin revocar al salir | Revocarlo en el desmontaje, junto al de la imagen del mapa. |

## Qué **no** entra en esta spec

- Recordar el estado del panel o atajo de teclado.
- Lista de mapas del juego o enlaces en el panel.
- Panel para móvil o ancho ajustable.
- Reajuste del zoom al plegar.
- Buscador, filtros y categorías.
- Marcadores (SPEC 06).

Cada una de estas, si llega, va en su propia spec.
