# SPEC 12 — Progreso de pines

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 05, SPEC 06, SPEC 08, SPEC 09, SPEC 11
> **Fecha:** 2026-11-23
> **Objetivo:** Mostrar arriba a la derecha del visor un panel plegable estilo HUD arcade con el progreso de pines encontrados sobre el total, del mapa y del juego, con los filtros Pendientes / Encontrados de SPEC 09, que dejan el panel lateral.

## Por qué existe esta spec

SPEC 09 dejó fuera el contador de encontrados ("3 / 12").
Hoy el usuario solo ve su avance contando pines translúcidos a ojo.
Quiere un marcador siempre a mano, con el aspecto de una barra de vida o XP de un juego retro.
La esquina superior derecha del visor está libre: el panel lateral va a la izquierda y los controles de vista abajo a la derecha.

## Alcance

**Dentro:**

- **Panel de progreso** `.viewer__progress` (`<section>` con `aria-label="Progreso"`), arriba a la derecha del visor.
  - Es hermano de `.viewer__stage`, como `.viewer__panel` (SPEC 05): la rueda y el arrastre sobre él no llegan al mapa.
  - Fondo, borde y esquinas cortadas con `clip-path` como `.dialog` (SPEC 02); contorno de foco hacia dentro.
  - Plegado al montar el visor (enmienda del 2026-11-23, decisión del usuario; antes desplegado). El estado no se guarda.
- **Cabecera** con el título "PROGRESO" (`--font-pixel`) y el botón de plegar `.viewer__progress-toggle` (`aria-expanded`, `aria-controls`, `aria-label` "Plegar progreso" / "Desplegar progreso", chevron SVG con `currentColor`).
- **Plegado:** el panel queda como una píldora con el botón de plegar y la cifra del mapa ("12/40", `--font-pixel`). El cuerpo queda `hidden`. Pulsar la píldora (clic, Enter o Espacio) lo despliega.
- **Línea del mapa** (`.viewer__progress-map`):
  - Etiqueta "Mapa", cifra "12 / 40" y porcentaje "30 %".
  - Barra segmentada de 20 bloques (`.viewer__progress-seg`); cada bloque vale 5 %. Se encienden `floor(encontrados / total × 20)` bloques (`.is-on`, cian neón).
  - La barra lleva `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax` = total, `aria-valuenow` = encontrados y `aria-valuetext` "12 de 40 encontrados".
  - Porcentaje con `Math.floor`: solo marca 100 % si están todos.
- **Línea del juego** (`.viewer__progress-game`): etiqueta "Juego", cifra y porcentaje de todos los mapas del juego, con una barra de 20 bloques más fina.
  - Si no se puede leer el total del juego, la línea muestra "—" y se escribe el error en consola; sin aviso.
- **Panel lateral al cambiar de mapa** (enmienda del 2026-11-23, decisión del usuario): elegir otro mapa en el selector (SPEC 07) deja el panel lateral expandido en el mapa nuevo, como estaba; solo se contrae a mano.
  - Solo al cambiar con el selector. Abrir un mapa desde la biblioteca, con un hash nuevo o con atrás/adelante sigue empezando contraído (SPEC 08).
  - No se guarda nada: es el visor quien recuerda, en memoria, a qué mapa se saltó.
- **Lista del selector abierta por defecto** (enmienda del 2026-11-23, decisión del usuario): con 2 o más mapas, la lista de mapas (SPEC 07) está abierta al montar el visor, también tras cambiar de mapa.
  - Solo se cierra a mano: el disparador o Esc. Dejan de cerrarla el clic fuera (`pointerdown` en `document`, que se quita) y contraer el panel; al volver a expandirlo sigue como estaba.
  - No se guarda: cada visor nuevo la abre. Las filas y sus miniaturas se crean al montar.
- **Filtros de pines** (`.viewer__progress-filter`, botones `.viewer__progress-filter-btn`): dos botones bajo las barras, "Pendientes N" y "Encontrados N", con el icono, `aria-pressed` y raya de los filtros de SPEC 09.
  - Alternan `hidePending` / `hideFound`, guardan en el mapa y revierten con aviso "No se pudo guardar el filtro." si falla (el comportamiento de SPEC 09).
  - **Sustituyen a los del panel lateral:** `.viewer__pin-filter` y sus botones se quitan del panel lateral (enmienda del 2026-11-23, decisión del usuario). Los filtros solo están en el panel de progreso.
  - Deshabilitados hasta que la capa de pines esté lista.
  - Al guardar un pin nuevo con "Pendientes" apagado, se enciende (SPEC 09) y el botón del panel de progreso lo refleja.
- **Qué cuenta:** todos los pines del mapa (o del juego), visibles u ocultos por filtro. Los filtros no cambian las cifras. Los textos (SPEC 10) no cuentan.
- **Actualización en vivo**, sin recargar:
  - Marcar o desmarcar encontrado: cambia al momento (optimista, como el pin). Si `setFound` falla y revierte, la cifra también vuelve.
  - Crear un pin: suma 1 al total del mapa y del juego.
  - Borrar un pin: resta 1 al total (y a encontrados si lo estaba).
  - Editar o mover un pin no cambia las cifras.
- **Mapa sin pines:** cifra "0 / 0", porcentaje "0 %", barra apagada y el texto "Sin pines" en lugar de la etiqueta del porcentaje; la línea del mapa se atenúa. El panel sigue visible.
- **100 % del mapa:** la cifra del porcentaje se sustituye por "COMPLETADO" en texto neón (`.neon-green`).
  - Si se llega al 100 % marcando un pin en esta sesión, "COMPLETADO" hace un `.flicker` breve una sola vez.
  - Al abrir un mapa ya completo, "COMPLETADO" aparece fijo, sin flicker.
  - Desmarcar un pin vuelve al porcentaje normal.
- **Modos añadir/editar** (SPEC 08, 10, 11): con `.viewer--adding-pin` o `.viewer--adding-label` el panel se oculta por CSS, como los controles de vista. Vuelve al cerrar el editor.
- **Pantalla completa** (SPEC 06): el panel sigue visible y funciona igual.
- **Movimiento reducido:** sin flicker ni transición de los bloques (regla global de `css/effects.css` más la anulación de `transition` en el CSS del componente).
- Colores y espacios solo con tokens de `css/tokens.css`; si hace falta un token nuevo (por ejemplo, el bloque apagado), va ahí.
- Crear `tools/acceptance/spec-12.js`.

**Fuera de alcance (para specs futuras):**

- Desglose del progreso por categoría de icono.
- Lista de pines pendientes navegable (clic que centra el mapa).
- Progreso en la biblioteca (`#/game/<id>`) o en las tarjetas de inicio.
- Guardar el estado plegado entre sesiones.
- Mover el panel de esquina o redimensionarlo.
- Contar textos (SPEC 10) en el progreso.
- Fecha de encontrado, rachas o historial.
- Sonidos al completar.

## Modelo de datos

Esta spec no introduce datos persistentes ni migración: el esquema sigue en v3.
El progreso se calcula a partir de `markers.found` (SPEC 09).

API nueva en `Waypoint.services.markerService`:

```js
markerService.progressByGame(gameId); // → Promise<{ total, found }>, todos los mapas del juego
```

Reutiliza `mapsRepository.listByGame` y `markersRepository.listByMaps`, como `lastStyle`.
Un juego sin pines devuelve `{ total: 0, found: 0 }`.

API nueva en la capa de pines (`pin-layer.js`):

```js
pins.counts(); // → { total, found } del mapa, contando también los ocultos por filtro y el que se edita
pinLayer.create(leafletMap, map, { onEdit, onCountsChange }); // onCountsChange(counts) tras load, add, remove y cada cambio de found (también al revertir)
```

Estado del panel, solo en memoria del visor:

```js
var progress = {
  map: { total: 0, found: 0 },  // de pins.counts()
  otherMaps: null,              // { total, found } del resto de mapas del juego; null = no disponible
  expanded: false,
};
// juego = otherMaps + map. otherMaps = progressByGame(gameId) − pins.counts() al terminar de cargar.
```

Convenciones:

- Bloques encendidos: `floor(found / total × 20)`; con `total = 0`, ninguno.
- Porcentaje: `floor(found / total × 100)`; con `total = 0`, 0.
- `progressByGame` se pide una vez al montar el visor; los cambios posteriores del mapa abierto se suman sobre `otherMaps`.

Módulo nuevo `Waypoint.ui.progressHud` (`js/ui/progress-hud.js`):

```js
var hud = progressHud.create({ onToggleFilter });  // → { el, setMap(counts), setGame(counts | null), setFilters({ pending, found }), setFiltersEnabled(b), destroy() }
```

`onToggleFilter("pending" | "found")` llama a `toggleFilter` de `viewer-view.js`, que guarda el estado (`FILTERS`) y lo devuelve con `setFilters`. El SVG de los iconos de filtro vive en `progress-hud.js`.

## Archivos

Nuevos:

- `js/ui/progress-hud.js`: panel, plegado, barras segmentadas, atajos a filtros, "COMPLETADO".
- `css/progress.css`: estilos del panel; va después de `css/viewer.css` en `index.html`.
- `tools/acceptance/spec-12.js`.

Modificados:

- `js/services/marker-service.js`: `progressByGame`.
- `js/ui/pin-layer.js`: `counts()` y la opción `onCountsChange`.
- `js/ui/viewer-view.js`: crea el panel como hermano de `.viewer__stage`, le pasa las cifras y el estado de los filtros, quita los botones de filtro del panel lateral y destruye el panel al desmontar.
- `css/viewer.css`: quita los estilos de `.viewer__pin-filter`.
- `tools/acceptance/spec-09.js`, `spec-10.js`, `spec-11.js`: usan los botones de filtro del panel de progreso, desplegándolo antes.
- `js/ui/viewer-view.js` (enmienda): el panel lateral sigue expandido al cambiar de mapa con el selector.
- `js/ui/viewer-view.js` (enmienda): lista del selector abierta al montar; sin cierre por clic fuera ni al contraer el panel.
- `tools/acceptance/spec-07.js`: criterios 02, 04, 05, 09, 13 y 14 según las enmiendas (panel expandido tras saltar, lista abierta por defecto y que no se cierra sola).
- `tools/acceptance/spec-05.js`: el recorrido de Tab del criterio 10 pasa de 10 a 15 pulsaciones (el panel de progreso añade 3 paradas de foco); el criterio 17 admite las miniaturas del selector entre las URLs del visor (todas revocadas).
- `index.html`: `css/progress.css` y `js/ui/progress-hud.js` en orden de capa (antes de `viewer-view.js`).
- `css/tokens.css`: tokens nuevos del panel, si hacen falta.
- `README.md`: el panel de progreso; estado SPEC 12.
- `CLAUDE.md`: `progressByGame`, `counts`/`onCountsChange`, panel de progreso en gotchas; `spec-12.js` en la regresión.

## Plan de implementación

1. Servicio: `markerService.progressByGame(gameId)`. Prueba manual: desde consola, con dos mapas y pines marcados, devuelve el total y los encontrados de ambos; un juego sin pines da `{ total: 0, found: 0 }`.
2. Capa de pines: `pins.counts()` y `onCountsChange` en `load`, `add`, `remove` y `toggleFound` (y su vuelta atrás). Prueba manual: con un `console.log` en `onCountsChange`, marcar, crear y borrar un pin imprime las cifras correctas.
3. Panel base: `progress-hud.js` y `css/progress.css` con cabecera, plegado y línea del mapa con su barra de 20 bloques; montado en `viewer-view.js` y conectado a `onCountsChange`. Prueba manual: abrir un mapa, ver "PROGRESO" arriba a la derecha, marcar un pin y ver subir la cifra; plegar y ver la píldora "N/M".
4. Línea del juego: `progressByGame` al montar, `otherMaps` y "—" si falla. Prueba manual: con pines en otro mapa del juego, la línea "Juego" suma los dos y cambia al marcar en el mapa abierto.
5. Filtros: botones "Pendientes N" / "Encontrados N" llamando a `toggleFilter`; `renderFilter` actualiza el panel de progreso. Enmienda: se quitan los botones del panel lateral. Prueba manual: apagar "Encontrados" en el panel de progreso oculta los encontrados y no cambia las cifras; el panel lateral ya no tiene filtros.
   - Enmienda (en el paso 5): el panel de progreso empieza plegado.
   - Enmienda (en el paso 5): lista del selector abierta por defecto, cerrada solo a mano.
   - Enmienda (en el paso 5): panel lateral expandido al cambiar de mapa con el selector. Prueba manual: con el panel abierto, elegir otro mapa en el selector lo deja abierto; abrir un mapa desde la biblioteca lo abre contraído.
6. Estados y modos: "Sin pines", "COMPLETADO" con flicker solo al llegar marcando, oculto en `.viewer--adding-pin` / `.viewer--adding-label`, movimiento reducido. Prueba manual: marcar el último pendiente muestra "COMPLETADO" parpadeando una vez; recargar lo muestra fijo; abrir "Añadir pin" oculta el panel.
7. Tests y docs: `tools/acceptance/spec-12.js` con los criterios automatizables; `spec-09.js`, `spec-10.js` y `spec-11.js` usan los filtros del panel de progreso; actualizar `README.md` y `CLAUDE.md`. Prueba manual: `spec-05.js`, `spec-07.js`, `spec-09.js`, `spec-10.js`, `spec-11.js` y `spec-12.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] Al abrir un mapa, `.viewer__progress` aparece arriba a la derecha, plegado (píldora "N/M", `aria-expanded="false"`), con `aria-label="Progreso"`, es hermano de `.viewer__stage` y al desplegarlo muestra el título "PROGRESO".
- [x] Con 40 pines y 12 encontrados, la línea del mapa muestra "12 / 40" y "30 %", y hay exactamente 6 `.viewer__progress-seg.is-on` de 20.
- [x] La barra del mapa tiene `role="progressbar"`, `aria-valuenow="12"`, `aria-valuemax="40"` y `aria-valuetext="12 de 40 encontrados"`.
- [x] Marcar un pin como encontrado sube la cifra del mapa y del juego al momento; desmarcarlo la baja.
- [x] Si `markerService.setFound` falla, la cifra vuelve al valor anterior junto con el pin.
- [x] Crear un pin suma 1 al total del mapa y del juego; borrar un pin encontrado resta 1 al total y 1 a encontrados.
- [x] Editar o mover un pin no cambia las cifras.
- [x] Ocultar pendientes o encontrados con los filtros no cambia las cifras.
- [x] Con pines en dos mapas del juego, la línea "Juego" muestra la suma de los dos.
- [x] Si `markerService.progressByGame` falla, la línea "Juego" muestra "—", no hay aviso y la línea del mapa funciona.
- [x] Pulsar `.viewer__progress-toggle` pliega el panel: el cuerpo queda `hidden`, se ve "12/40", `aria-expanded="false"`; pulsarlo de nuevo lo despliega. Enter y Espacio hacen lo mismo.
- [x] Al volver a abrir el mapa, el panel está plegado aunque se desplegara antes.
- [x] Los botones "Pendientes" y "Encontrados" del panel de progreso muestran sus cifras y un `aria-pressed` que refleja `hidePending` / `hideFound` del mapa.
- [x] El panel lateral no tiene `.viewer__pin-filter` ni `.viewer__pin-filter-btn`.
- [x] Elegir otro mapa en el selector deja el panel lateral expandido en el mapa nuevo; abrir un mapa desde la biblioteca o por hash lo abre contraído.
- [x] Con 2 o más mapas, la lista del selector está abierta al montar (`aria-expanded="true"`), también tras cambiar de mapa.
- [x] Un clic en el mapa o contraer y expandir el panel no cierran la lista; el disparador y Esc sí.
- [x] Apagar "Encontrados" en el panel de progreso oculta los encontrados, pone `aria-pressed="false"` en su botón y guarda `hideFound: true` en el mapa.
- [x] Si `mapService.setHideFound` falla desde el panel de progreso, aparece "No se pudo guardar el filtro." y el botón vuelve al estado anterior.
- [x] Un mapa sin pines muestra "0 / 0", "Sin pines", ningún bloque encendido y la línea atenuada.
- [x] Marcar el último pendiente muestra "COMPLETADO" con `.neon-green` y `.flicker`; tras recargar, "COMPLETADO" aparece sin `.flicker`.
- [x] Desmarcar un pin con el mapa completo vuelve a mostrar el porcentaje.
- [x] Con el modo "añadir pin", "añadir texto", "editar pin" o "editar texto" abierto, el panel de progreso no se ve; al cerrar el editor vuelve.
- [x] Con pantalla completa simulada (como en `spec-06.js`), el panel de progreso sigue visible.
- [x] La rueda y el arrastre sobre el panel de progreso no mueven ni hacen zoom en el mapa.
- [x] Con `prefers-reduced-motion: reduce`, "COMPLETADO" no anima y los bloques no tienen transición.
- [x] El foco del botón de plegar y de los atajos se ve con contorno hacia dentro.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo.
- [x] `tools/acceptance/spec-05.js`, `spec-07.js`, `spec-09.js`, `spec-10.js`, `spec-11.js` y `spec-12.js` pasan con un `WP_PROFILE` vacío.

## Decisiones

- **Sí:** el progreso mide encontrados sobre el total. Decisión del usuario; es el avance real del juego.
- **No:** visibles frente a ocultos por filtro. Mide la vista, no el progreso.
- **Sí:** línea del mapa y línea del juego. Decisión del usuario.
- **No:** desglose por categoría. Más grande; spec futura.
- **Sí:** panel plegable con los filtros de SPEC 09. Decisión del usuario; también sirven en pantalla completa.
- **Sí (enmienda 2026-11-23):** la lista del selector abierta por defecto y cerrada solo a mano. Decisión del usuario. Revierte de SPEC 07 "lista cerrada al abrir", "clic fuera cierra" y "contraer el panel cierra".
- **Sí (enmienda 2026-11-23):** el panel lateral sigue expandido al cambiar de mapa con el selector. Decisión del usuario: cerrarlo solo a mano. Fuera del selector sigue la regla de SPEC 08 (contraído al abrir). Se recuerda en memoria del módulo del visor, sin guardar nada.
- **Sí (enmienda 2026-11-23):** los filtros salen del panel lateral y quedan solo en el panel de progreso. Decisión del usuario al ver el panel: dos pares de botones iguales sobraban. Consecuencia aceptada: con el panel plegado o en modo añadir/editar, los filtros no están a mano.
- **No:** solo lectura, ni lista de pendientes navegable (spec futura).
- **Sí:** barra segmentada estilo HUD con 20 bloques fijos de 5 % y cifras en Press Start 2P. Decisión del usuario; ancho estable con pocos o muchos pines.
- **No:** anillo circular ni barra continua. Menos arcade.
- **No:** un bloque por pin. Dos lógicas distintas según el número de pines.
- **Sí:** plegado sin guardar. Decisión del usuario; sin cambio de esquema y la app no usa `localStorage`.
- **Sí (enmienda 2026-11-23):** plegado al montar (antes desplegado). Decisión del usuario. Consecuencia aceptada: los filtros, que viven en el panel, piden desplegarlo antes.
- **Sí:** oculto en modos añadir/editar y visible en pantalla completa. Decisión del usuario; no compite con el panel del editor.
- **Sí:** "Sin pines" con 0 pines y "COMPLETADO" neón al 100 %, con flicker solo al llegar marcando. Decisión del usuario.
- **Sí:** los filtros no cambian las cifras y los textos no cuentan. El progreso es de pines, no de lo que se ve.
- **Sí:** porcentaje y bloques con `floor`. "100 %" solo si están todos; nunca "COMPLETADO" con un pendiente.
- **Sí:** cifras del mapa desde la capa de pines (`counts`, `onCountsChange`), no releyendo IndexedDB. La capa ya tiene todos los marcadores en memoria, también los ocultos; se actualiza al momento con el cambio optimista.
- **Sí:** el juego como `otherMaps + mapa`, con una sola lectura al montar. Evita releer todos los mapas en cada clic.
- **Sí:** panel hermano de `.viewer__stage`, no un `L.Control`. Así la rueda y el arrastre no llegan al mapa sin `stopPropagation`, y no se apila con los controles de Leaflet.
- **Sí:** módulo propio `progress-hud.js` y `css/progress.css`. `viewer-view.js` ya es grande.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La cifra del juego se desfasa si se cambian pines del mismo juego en otra pestaña | Aceptado: se recalcula al volver a montar el visor. Fuera de alcance la sincronización entre pestañas. |
| `onCountsChange` tras desmontar el visor | `pins.destroy()` deja de emitir; el visor comprueba `alive`, como en SPEC 08. |
| El panel tapa pines en la esquina superior derecha | Plegable a una píldora; con el panel plegado queda un hueco mínimo. |
| Ancho del panel con cifras de 3–4 dígitos en Press Start 2P | Ancho fijo con token y cifras en `tabular-nums` / tamaño `--font-size-pixel-*` pequeño; criterio con 40 pines, prueba manual con 1000. |
| El flicker de "COMPLETADO" se repite al repintar | Solo se añade `.flicker` en la transición de <100 % a 100 % por `onCountsChange`, no en `setMap` inicial. |

## Qué **no** entra en esta spec

- Progreso por categoría de icono.
- Lista de pendientes navegable.
- Progreso en la biblioteca o en inicio.
- Guardar el plegado.
- Mover o redimensionar el panel.
- Contar textos.
- Historial, rachas o sonidos.

Cada una de estas, si llega, va en su propia spec.
