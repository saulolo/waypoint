# SPEC 09 — Pines encontrados

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 05, SPEC 08
> **Fecha:** 2026-11-22
> **Objetivo:** Marcar un pin como encontrado con un botón ojo en su popup, que lo deja translúcido al momento, y filtrar los pines pendientes o encontrados de un mapa con dos botones del panel lateral, todo guardado en IndexedDB. Incluye además el icono "Por defecto" (una mano que señala) y el botón "Editar" del popup, todavía sin función.

## Por qué existe esta spec

El usuario quiere el patrón de MapGenie: en el popup de un pin hay un control "FOUND"; al marcarlo, el icono pierde opacidad y se distingue de los pendientes de un vistazo.
SPEC 08 reservó SPEC 09 para editar pines, marcarlos como hechos y filtrar.
Esta spec se queda con marcar como encontrado y con ocultar los encontrados.
Editar un pin guardado y filtrar por categoría pasan a specs futuras.

## Alcance

**Dentro:**

- **Botón ojo en el popup** del pin guardado (SPEC 08), arriba a la derecha, en la cabecera (`.pin-popup__header`), a la derecha del nombre y junto a la ×.
  - Solo icono, sin texto: SVG inline con `currentColor`.
  - Pin pendiente: ojo abierto. Pin encontrado: ojo tachado. Los dos SVG están siempre en el DOM y solo se ve uno (`toggleAttribute("hidden")`: los SVG no tienen la propiedad `hidden`).
  - Es un `<button>` (`.pin-popup__found`) con `aria-pressed` (`"false"` pendiente, `"true"` encontrado) y `aria-label` fijo "Encontrado". `title` "Marcar como encontrado" o "Marcar como pendiente", según el estado.
  - Clic, Enter o Espacio alternan el estado. El popup sigue abierto y el foco se queda en el botón.
  - Foco visible con contorno hacia dentro, como `.btn`.
- **Aspecto de un pin encontrado:** clase `.pin--found` en el icono del pin; su `.pin-glyph` queda con opacidad 40 % (token `--pin-found-opacity: 0.4`).
  - Cambia al pulsar el botón, antes de que termine la escritura en IndexedDB.
  - Siempre translúcido: también con hover, con el popup abierto y mientras se arrastra.
  - Tooltip y popup no cambian (sin tachado ni otro estilo).
  - Se sigue pudiendo mover (arrastre de SPEC 08) y borrar.
- **Guardar el estado:** campo `found` del marcador en el store `markers`, con `markerService.setFound`.
  - Si falla: aviso "No se pudo marcar el pin." (`notice.show`), y el pin y el botón vuelven al estado anterior.
  - Perdura al recargar, cerrar el navegador o reiniciar el equipo (IndexedDB, como el resto de datos).
- **Filtro de pines** en el panel lateral del visor (SPEC 05), debajo del bloque del juego: dos botones independientes, **Pendientes** y **Encontrados** (`.viewer__pin-filter-btn`, en un grupo `.viewer__pin-filter`).
  - Cada botón es un `<button>` con icono SVG (chincheta de mapa para Pendientes, círculo con check para Encontrados) y su texto, en `--font-mono`, con `aria-pressed`: `"true"` = se ven los pines de ese tipo, `"false"` = ocultos (el icono lleva una raya transversal y el botón se atenúa).
  - Combinaciones: los dos activos = se ven todos; solo Encontrados = solo los encontrados; solo Pendientes = solo los pendientes; los dos apagados = ninguno.
  - Se guarda por mapa: campos `hideFound` y `hidePending` del store `maps`, con `mapService.setHideFound` y `mapService.setHidePending`. Un mapa sin esos campos se abre con los dos activos.
  - Al abrir un mapa, los botones y los pines reflejan esos campos.
  - Apagar un botón quita del mapa los pines de ese tipo; volver a activarlo los pinta (los encontrados, translúcidos).
  - Si falla guardar: aviso "No se pudo guardar el filtro.", y el botón y los pines vuelven al estado anterior.
  - Funciona igual con el panel contraído (el valor guardado se aplica) y en modo "añadir pin".
  - Al guardar un pin nuevo con "Pendientes" apagado, ese botón se activa para que el pin no desaparezca al nacer.
- **Marcar con "Encontrados" apagado:** el pin se vuelve translúcido al momento y desaparece del mapa al cerrarse su popup (×, Esc o clic en el mapa). Si se desmarca antes de cerrar, se queda.
- **Pines ocultos:**
  - No están en el mapa: no reciben clic, hover, foco ni arrastre.
  - No cuentan para la búsqueda de hueco del borrador al caer (SPEC 08): `pins.boxes()` solo devuelve los visibles.
- **Botón "Editar" en el popup** (`.pin-popup__edit`, `.btn--ghost`), a la izquierda de "Borrar" en la fila de acciones. Solo el botón: no tiene handler ni abre nada todavía.
- **Icono "Por defecto"**: una mano que señala, en una categoría nueva "Por defecto" que va la primera del selector de iconos (`js/ui/pin-icons.js`). Glifo `pointer`, con silueta y contorno como el resto. El catálogo pasa a 8 categorías y 54 iconos. El estilo inicial del editor (`exclamation`) no cambia.
- **Pines nuevos:** nacen pendientes (`found: false`). El panel "Añadir pin" no cambia.
- "Último usado" (SPEC 08) no mira `found`.
- Crear `tools/acceptance/spec-09.js`.

**Fuera de alcance (para specs futuras):**

- Editar un pin guardado: nombre, nota o estilo.
- Filtrar o mostrar/ocultar pines por categoría.
- Contador de encontrados ("3 / 12") por mapa o por juego.
- Función del botón "Editar" (solo está el botón).
- Marcar como encontrado desde el panel "Añadir pin".
- Marcar o desmarcar varios pines a la vez.
- Fecha de encontrado (`foundAt`) o historial.
- Opacidad configurable por el usuario.

## Modelo de datos

No hay migración: los campos nuevos son opcionales y su ausencia equivale a `false`.
El esquema sigue en v2.

```js
// Store "markers" (SPEC 08) — campo nuevo
const marker = {
  // …campos de SPEC 08
  found: false, // true = encontrado; ausente (pines de SPEC 08) = false
};

// Store "maps" (SPEC 01/03) — campo nuevo
const map = {
  // …campos existentes
  hideFound: false, // true = el visor oculta los pines encontrados de este mapa; ausente = false
  hidePending: false, // true = el visor oculta los pines pendientes de este mapa; ausente = false
};
```

Convenciones:

- La UI lee `marker.found === true`, `map.hideFound === true` y `map.hidePending === true`; cualquier otro valor cuenta como `false`.
- `setFound` no cambia `createdAt`, así que no altera "Último usado".
- `setHideFound` y `setHidePending` no cambian `updatedAt` ni `lastOpenedAt`: son preferencias de vista, no una edición del mapa.
- Los dos filtros son independientes: activar uno no toca el otro.

API nueva en `Waypoint.services.markerService`:

```js
markerService.create(mapId, { … });  // ahora guarda found: false
markerService.setFound(id, found);   // → Promise<marker>; solo cambia found
```

`setFound` lanza `InvalidMarkerError` si `found` no es booleano (sin escribir nada) y rechaza con `InvalidMarkerError` si el marcador no existe.
Usa `markersRepository.update` (SPEC 08); el repositorio no cambia.

API nueva en `Waypoint.services.mapService`:

```js
mapService.setHideFound(id, hideFound);     // → Promise<map>
mapService.setHidePending(id, hidePending); // → Promise<map>
```

Ambos rechazan con `MapNotFoundError` si el mapa no existe y con `TypeError` si el valor no es booleano (sin escribir).
Usa `mapsRepository.update`; el repositorio no cambia.

API nueva en la capa de pines (`pin-layer.js`), devuelta por su `mount` junto a `setPlacing` y `boxes`:

```js
pins.setHideFound(hide);   // quita del mapa los encontrados (true) o los vuelve a pintar (false)
pins.setHidePending(hide); // quita del mapa los pendientes (true) o los vuelve a pintar (false)
```

Token nuevo en `css/tokens.css`: `--pin-found-opacity: 0.4`.

## Archivos

Modificados:

- `js/services/marker-service.js`: `found: false` en `create`; `setFound`; comentario de cabecera.
- `js/services/map-service.js`: `setHideFound` y `setHidePending`.
- `js/ui/pin-layer.js`: cabecera del popup con el botón ojo (con sus dos SVG), botón "Editar", clase `.pin--found`, `setHideFound`, `setHidePending`, ocultar al cerrar popup, `boxes()` solo con visibles, aviso y vuelta atrás si falla; comentario de cabecera.
- `js/ui/viewer-view.js`: botones Pendientes / Encontrados en el panel, valor inicial desde el mapa, llamadas a `pins.setHideFound` y `pins.setHidePending`, aviso y vuelta atrás si falla.
- `css/tokens.css`: `--pin-found-opacity`.
- `js/ui/pin-icons.js`: categoría "Por defecto" con el glifo `pointer`; 8 categorías y 54 iconos.
- `css/pins.css`: `.pin--found .pin-glyph`, `.pin-popup__header`, botón `.pin-popup__found` (tamaño, foco, `aria-pressed`).
- `css/viewer.css`: `.viewer__pin-filter` y `.viewer__pin-filter-btn`.
- `README.md`: cómo marcar encontrados y filtrar; el icono "Por defecto"; estado SPEC 09; editar y filtros por categoría en specs futuras.
- `CLAUDE.md`: campos `found`, `hideFound` y `hidePending`, `setFound`, `setHideFound`, `setHidePending`; gotchas de SVG `hidden` y del popup; `spec-09.js` en la regresión.
- `tools/acceptance/spec-08.js`: el selector de iconos ahora tiene 8 categorías y 54 iconos.

Nuevos:

- `tools/acceptance/spec-09.js`.

## Plan de implementación

1. Servicios: `markerService.setFound` (y `found: false` en `create`) y `mapService.setHideFound`. Prueba manual: desde consola, `setFound(id, true)` guarda `found: true` sin tocar `createdAt`; `setFound(id, "sí")` lanza `InvalidMarkerError`; `setHideFound(mapId, true)` guarda el campo sin tocar `updatedAt`.
2. Aspecto encontrado: token `--pin-found-opacity` y clase `.pin--found` en `pin-layer.js` según `marker.found`. Prueba manual: un pin marcado por consola se ve translúcido tras recargar; los demás, opacos.
3. Botón ojo: en la cabecera del popup, arriba a la derecha, con `aria-pressed`, `title` y los dos SVG (más el botón "Editar" sin función); alterna el estado al momento, lo guarda y revierte con aviso si falla. Prueba manual: marcar, recargar y ver el pin translúcido con el ojo tachado en su popup; desmarcar lo devuelve.
4. Ocultar en la capa: `pins.setHideFound` y `pins.setHidePending`, ocultar al cerrar el popup si se marcó con el filtro activo, `boxes()` solo con visibles. Prueba manual: desde consola, `setHideFound(true)` quita los encontrados y `false` los devuelve.
5. Filtro del panel: botones Pendientes / Encontrados en `viewer-view.js`, valor inicial desde el mapa, guardado con `mapService.setHideFound` / `setHidePending`, aviso y vuelta atrás si falla. Prueba manual: apagar Pendientes, recargar y ver solo los encontrados y el botón tachado; en otro mapa siguen los dos activos.
6. Tests y docs: `tools/acceptance/spec-09.js` con los criterios automatizables; actualizar `README.md`, `CLAUDE.md` y `spec-08.js`. Prueba manual: `spec-01.js` a `spec-09.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] El popup de un pin guardado muestra `.pin-popup__found` en la cabecera (a la derecha del nombre), sin texto visible, con `aria-label="Encontrado"` y `aria-pressed="false"`, y la fila de abajo trae "Editar" y "Borrar".
- [x] Clic en el botón ojo pone `aria-pressed="true"`, cambia su SVG al ojo tachado, añade `.pin--found` al pin y deja la opacidad calculada de su `.pin-glyph` en `0.4`; el popup sigue abierto.
- [x] Un segundo clic devuelve `aria-pressed="false"`, el ojo abierto y opacidad `1`.
- [x] Con el foco en el botón ojo, Enter y Espacio alternan el estado, y el botón tiene contorno de foco visible.
- [x] Tras marcar un pin, su registro en `markers` tiene `found: true` y el mismo `createdAt`; tras recargar (F5), el pin sigue translúcido y su popup muestra `aria-pressed="true"`.
- [x] Un pin creado con "Añadir pin" se guarda con `found: false`.
- [x] Un marcador sin campo `found` (como los de SPEC 08) se pinta opaco y su popup muestra `aria-pressed="false"`.
- [x] Si `markerService.setFound` falla, aparece "No se pudo marcar el pin." y el pin y el botón vuelven al estado anterior.
- [x] Un pin encontrado mantiene la opacidad `0.4` con el ratón encima y con su popup abierto.
- [x] Un pin encontrado se puede arrastrar (su `x`/`y` cambian en `markers`) y borrar como uno pendiente.
- [x] `markerService.setFound(id, "sí")` lanza `InvalidMarkerError` y no escribe nada; con un `id` inexistente rechaza.
- [x] El panel lateral muestra, debajo del bloque del juego, los botones "Pendientes" y "Encontrados" (`.viewer__pin-filter-btn`), los dos con `aria-pressed="true"` en un mapa sin `hideFound` ni `hidePending`.
- [x] Apagar "Encontrados" quita del mapa los pines encontrados (sin elemento en el DOM) y deja los pendientes; volver a activarlo los pinta con opacidad `0.4`.
- [x] Tras apagar "Encontrados", el registro del mapa en `maps` tiene `hideFound: true` y el mismo `updatedAt`; tras recargar, el botón está en `aria-pressed="false"` y los encontrados siguen ocultos.
- [x] En otro mapa del mismo juego, los dos botones están activos y sus encontrados se ven.
- [x] Si `mapService.setHideFound` falla, aparece "No se pudo guardar el filtro." y el botón y los pines vuelven al estado anterior.
- [x] Con "Pendientes" apagado y "Encontrados" activo, solo se ven los pines encontrados y el mapa guarda `hidePending: true`.
- [x] Con "Encontrados" apagado, marcar un pin lo deja translúcido con el popup abierto; al cerrar el popup (×, Esc o clic en el mapa) el pin desaparece del mapa.
- [x] Con "Encontrados" apagado, marcar y desmarcar un pin antes de cerrar el popup lo deja en el mapa, opaco.
- [x] Con "Encontrados" apagado y un pin encontrado oculto en el centro de la zona libre, el borrador de "Añadir pin" cae en ese centro (±2 px).
- [x] Con el panel lateral contraído al abrir un mapa con `hideFound: true`, los encontrados no se pintan.
- [x] "Último usado" toma el pin más reciente del juego aunque esté encontrado u oculto.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo (los SVG del ojo usan `currentColor`).
- [x] El selector de iconos muestra "Por defecto" como primera categoría, con un solo icono (la mano `pointer`, etiqueta "Por defecto"); el catálogo suma 8 categorías y 54 iconos.
- [x] `tools/acceptance/spec-01.js` a `spec-09.js` pasan con un `WP_PROFILE` vacío.

## Decisiones

- **Sí:** SPEC 09 = marcar como encontrado + ocultar encontrados. Decisión del usuario. Editar pines y filtros por categoría, reservados por SPEC 08 para esta spec, pasan a specs futuras.
- **No:** solo marcar, sin ocultar. El usuario quiere poder limpiar el mapa de lo ya encontrado.
- **No:** contador "3 / 12". Fuera de alcance; cabe en una spec de filtros y progreso.
- **Sí:** botón ojo, solo icono (ojo abierto = pendiente, tachado = encontrado), con `aria-pressed`. Decisión del usuario.
- **No:** casilla "ENCONTRADO" como MapGenie, ni ojo con texto. Descartados por el usuario.
- **Sí:** `aria-label` fijo "Encontrado" y el estado en `aria-pressed`. Un lector de pantalla anuncia "Encontrado, pulsado / no pulsado"; cambiar la etiqueta y el estado a la vez se contradice.
- **Sí:** opacidad 40 % en el glifo, como token. Decisión del usuario; parecido a la referencia de MapGenie y legible en mapas claros.
- **No:** 25 % ni 60 %. Uno cuesta verlo, el otro se confunde con un pendiente.
- **Sí:** solo cambia la opacidad, siempre (también con hover y popup abierto). Decisión del usuario.
- **No:** recuperar opacidad con hover, ni nombre tachado en el popup.
- **Sí:** la opacidad va en `.pin-glyph`, no en el contenedor ni con `marker.setOpacity`. El contenedor lleva el `transform` de Leaflet y la animación de caída ya usa `.pin-glyph` (SPEC 08).
- **Sí:** cambio optimista (la UI cambia antes de guardar) y vuelta atrás con aviso si falla. Marcar debe sentirse instantáneo; el fallo es raro.
- **Sí:** filtro de pines en el panel lateral, guardado por mapa en `maps.hideFound` y `maps.hidePending`. Decisión del usuario.
- **Sí:** dos botones independientes (Pendientes / Encontrados), no tres modos exclusivos. Así se cubre "solo encontrados" sin un cuarto botón. Decisión del usuario.
- **No:** casilla "Ocultar encontrados", ni valor global en `localStorage`, ni botón en los controles de vista.
- **Sí:** el ojo del popup arriba a la derecha y un botón "Editar" (sin función) en la fila de acciones. Decisión del usuario; la función de editar va en una spec futura.
- **Sí:** categoría "Por defecto" con una mano que señala, la primera del selector. Decisión del usuario. No cambia el estilo inicial del editor.
- **Sí:** con el filtro activo, el pin marcado desaparece al cerrar su popup, no al momento. Decisión del usuario: deja desmarcarlo si fue un error.
- **Sí:** los pines ocultos salen del mapa (no solo `display: none`). Así no reciben foco, clic ni arrastre, y no cuentan para la caída del borrador.
- **Sí:** los pines nacen pendientes; el panel "Añadir pin" no cambia. Decisión del usuario.
- **Sí:** sin migración; `found` y `hideFound` ausentes valen `false`. Los pines y mapas de SPEC 08 siguen sirviendo tal cual.
- **Sí:** `setFound` y `setHideFound` no tocan `createdAt` ni `updatedAt`. "Último usado" y las fechas del mapa no deben moverse por marcar o filtrar.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Marcar y cerrar el popup antes de que termine la escritura, y esta falla con el pin ya oculto | Al revertir, si el pin estaba oculto por el filtro, se vuelve a pintar pendiente. Criterio de fallo de `setFound`. |
| Respuesta de `setFound` o `setHideFound` tras desmontar el visor | Comprobar `alive` antes de pintar o avisar, como en SPEC 08. La escritura termina igual. |
| Quitar del mapa un pin con su popup abierto deja listeners de Esc | Solo se quita en `popupclose`; con el filtro, desde `setHideFound` se cierra antes el popup abierto si es de un encontrado. |
| Pulsar el ojo cierra el popup o llega al mapa | El clic dentro del popup no llega al mapa en Leaflet (`L.DomEvent.disableClickPropagation` en el contenido, como "Borrar"). Criterio de popup abierto tras el clic. |
| Opacidad heredada no aplicada al contorno del glifo | La opacidad va en `.pin-glyph`, que contiene cuerpo y contorno. Criterio con la opacidad calculada. |
| Tests de SPEC 08 que cuentan botones del popup | `spec-08.js` busca "Borrar" por clase; si alguno cuenta botones, se ajusta en el paso 6. |

## Qué **no** entra en esta spec

- Editar nombre, nota o estilo de un pin guardado.
- Filtrar pines por categoría.
- Contador de encontrados.
- Marcar al crear el pin, o varios a la vez.
- Fecha de encontrado o historial.
- Opacidad configurable.

Cada una de estas, si llega, va en su propia spec.
