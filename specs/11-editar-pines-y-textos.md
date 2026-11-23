# SPEC 11 — Editar pines y textos

> **Estado:** Implementado
> **Depende de:** SPEC 08, SPEC 09, SPEC 10
> **Fecha:** 2026-11-22
> **Objetivo:** Dar función al botón "Editar" del popup del pin y añadirlo al popup del texto, de modo que abra el mismo panel de "Añadir pin" o "Añadir texto" con los datos del elemento para cambiar todos sus campos y su posición, y guardarlos.

## Por qué existe esta spec

SPEC 09 dejó el botón "Editar" en el popup del pin sin función, y SPEC 10 dejó fuera editar un texto guardado.
Hoy, para corregir un nombre, una nota, el icono, el color o el tamaño hay que borrar y volver a crear.
El usuario quiere pulsar "Editar" y poder cambiarlo todo de nuevo con el mismo panel con el que lo creó.

## Alcance

**Dentro:**

- **Botón "Editar" en los popups:**
  - Pin: el `.pin-popup__edit` que ya existe (`.btn--edit`, SPEC 09/10) pasa a tener función.
  - Texto: botón nuevo `.label-popup__edit` (`.btn btn--edit`, texto "Editar"), a la izquierda de "Borrar" en `.label-popup__actions`, como en el pin.
  - Clic, Enter o Espacio cierran el popup y abren el **modo "editar"** de ese elemento.
- **Modo "editar pin":** el mismo panel `.pin-editor` de SPEC 08 (con su selector de iconos `.pin-picker`), en modo edición.
  - Título "Editar pin" (en vez de "Añadir pin").
  - Campos rellenos con los valores guardados: Nombre, Nota, Icono, Color y Tamaño (la barra en el tamaño del pin, no en `SIZE.default`).
  - Nombre: se muestra el nombre guardado, aunque sea la etiqueta del icono.
  - "Último usado" se mantiene con el mismo comportamiento de SPEC 08 (aplica icono y color del pin más reciente del juego y devuelve el tamaño a `SIZE.default`).
  - La raíz lleva `.viewer--adding-pin`, como al añadir: se ocultan los controles de vista y + / −.
- **Modo "editar texto":** el mismo panel `.label-editor` de SPEC 10, en modo edición.
  - Título "Editar texto" (en vez de "Añadir texto").
  - Campos rellenos: Texto, Nota, Color y Tamaño.
  - "Guardar" deshabilitado con "Texto" vacío o solo espacios, como al añadir.
  - La raíz lleva `.viewer--adding-label`, como al añadir.
- **Borrador en edición:**
  - El elemento guardado sale del mapa y en su lugar aparece el borrador, en la misma posición, con su estilo. **Sin caída**: no hay animación ni búsqueda de hueco.
  - Un pin encontrado (SPEC 09) se ve translúcido también como borrador (`.pin--found`).
  - Refleja en vivo los cambios de campos, como al añadir.
  - **Mover:** como al añadir. Arrastrarlo lo mueve sin mover el mapa; un clic simple en el mapa lo lleva a ese punto; nunca sale de la imagen. La posición no se guarda hasta "Guardar".
  - Los demás pines y textos guardados están en modo colocar (SPEC 08/10): sin popup, un clic sin arrastre lleva el borrador ahí y arrastrarlos los mueve y guarda.
- **Guardar:**
  - Pin: `markerService.update` con posición y campos. Nombre vacío → etiqueta del icono, como al crear.
  - Texto: `labelService.update` con posición y campos.
  - No cambian `id`, `mapId`, `createdAt` ni `found`. "Último usado" no cambia por editar.
  - "Guardar" siempre habilitado (salvo texto vacío). Guardar sin cambios escribe igual y cierra.
  - Al terminar: se cierra el panel, el borrador desaparece y el elemento vuelve a pintarse con los datos nuevos en la nueva posición. El popup queda cerrado. Vuelven los controles de vista.
  - El pin vuelve a pintarse respetando los filtros de SPEC 09: si el filtro lo oculta, no se pinta.
  - El foco va al pin o texto editado; si no está pintado (oculto por filtro), al contenedor del mapa.
  - Si falla: aviso con `notice.show`, el panel y el borrador siguen y nada cambia en la base. Mensajes, los mismos que al crear: "No queda espacio para guardar el pin." / "No se pudo guardar el pin." y "No queda espacio para guardar el texto." / "No se pudo guardar el texto.".
- **Cancelar** sin preguntar, aunque haya cambios: el botón "Cancelar" (`.btn--cancel`), Esc (si el selector de iconos no está abierto, como en SPEC 08) y cualquier cambio de ruta o desmontaje del visor.
  - Quita el borrador y el panel, y el elemento vuelve a pintarse con sus datos y su posición originales. Nada se guarda.
  - El foco va al pin o texto editado (con Esc o "Cancelar").
- Solo un modo a la vez: con "añadir" o "editar" abierto, los popups no se abren (modo colocar), así que no se puede empezar otro.
- Pantalla completa (SPEC 06): editar funciona igual.
- **Tooltip con la nota del texto:**
  - Al pasar el ratón sobre un texto guardado con nota, aparece un tooltip con la nota (mismo estilo y posición que el del pin: `.pin-tooltip`, arriba).
  - Sin nota (vacía o solo espacios), no hay tooltip.
  - La nota se muestra tal cual, con sus saltos de línea, con un ancho máximo y cortando palabras largas.
  - Se oculta con el popup del texto abierto, y en los modos añadir/editar (como los de los pines guardados).
  - Al editar, el tooltip se actualiza con la nota nueva al guardar. El borrador no lleva tooltip.
- Crear `tools/acceptance/spec-11.js`.

**Fuera de alcance (para specs futuras):**

- Borrar o marcar "Encontrado" desde el panel de edición (siguen en el popup).
- Confirmación de "¿Descartar cambios?" al cancelar.
- Deshabilitar "Guardar" cuando no hay cambios.
- Deshacer una edición; historial de cambios.
- Editar varios pines o textos a la vez.
- Fecha de modificación (`updatedAt`) en pines o textos.
- Cambiar un pin a texto o al revés.
- Atajos de teclado.

## Modelo de datos

No hay cambios de esquema: sigue en v3.
Los stores `markers` y `labels` no ganan campos.

API nueva en `Waypoint.services.markerService`:

```js
markerService.update(id, { x, y, name, note, icon, color, size }); // → Promise<marker>
```

- Valida igual que `create` (posición 0–1, nombre ≤ 80 tras quitar espacios, nota, icono, color, tamaño). Con nombre vacío, la etiqueta del icono la pone `pin-editor.js` antes de llamar, como al crear (`pinIcons` es de `ui`, no de `services`).
- Conserva `id`, `mapId`, `found` y `createdAt`.
- Lanza `InvalidMarkerError` si un campo no es válido o el pin no existe, sin escribir nada.
- Usa `markersRepository.update`; el repositorio no cambia.

API nueva en `Waypoint.services.labelService`:

```js
labelService.update(id, { x, y, text, note, color, size }); // → Promise<label>
```

- Valida igual que `create` (texto 1–40, nota ≤ 500, color de `COLORS`, tamaño 8–32 par).
- Conserva `id`, `mapId` y `createdAt`.
- Lanza `InvalidLabelError` si un campo no es válido o el texto no existe, sin escribir nada.
- Usa `labelsRepository.update`; el repositorio no cambia.

Las reglas de validación de `create` se comparten con `update` dentro de cada servicio (la misma función `validate`); no se duplican.

API nueva en las capas (`pin-layer.js` y `label-layer.js`):

```js
pinLayer.create(leafletMap, map, { onEdit });   // onEdit(marker): clic en "Editar" del popup
labelLayer.create(leafletMap, map, { onEdit }); // onEdit(label)

pins.startEditing(id);           // quita el pin del mapa mientras se edita; lo sigue guardando en memoria
pins.stopEditing(id, marker);    // vuelve a pintarlo; marker = datos nuevos, o null para los originales
pins.focus(id);                  // foco en el pin (false si no está pintado)
labels.startEditing(id);
labels.stopEditing(id, label);
labels.focus(id);
```

API cambiada en los editores:

```js
pinEditor.open({ …opciones de SPEC 08/10, marker });  // con marker: modo "editar pin"
labelEditor.open({ …opciones de SPEC 10, label });    // con label: modo "editar texto"
// onSaved(marker | label) y onClose(reason) igual que al añadir
```

Estado en memoria del visor (`viewer-view.js`): el cierre del modo editar se guarda en las mismas variables que el de añadir (`closeEditor` / `closeLabelEditor`), así el desmontaje lo cancela igual.

## Archivos

Modificados:

- `js/services/marker-service.js`: `update`; comentario de cabecera.
- `js/services/label-service.js`: `update`; comentario de cabecera.
- `js/ui/pin-layer.js`: handler de "Editar" (`onEdit`), `startEditing`, `stopEditing`, `focus`; comentario de cabecera.
- `js/ui/label-layer.js`: botón "Editar" en el popup, `onEdit`, `startEditing`, `stopEditing`, `focus`; tooltip con la nota; comentario de cabecera.
- `js/ui/pin-editor.js`: opción `marker` (título, campos rellenos, borrador en su sitio sin caída, `.pin--found`, `update` al guardar); comentario de cabecera.
- `js/ui/label-editor.js`: opción `label` (título, campos rellenos, borrador sin caída, `update` al guardar); comentario de cabecera.
- `js/ui/viewer-view.js`: pasa `onEdit` a las capas; abre el editor en modo edición; al cerrar llama a `stopEditing` y devuelve el foco al elemento.
- `css/labels.css`: espaciado de `.label-popup__actions` con dos botones, si hace falta; tooltip de la nota (ancho, saltos de línea, oculto en los modos añadir/editar).
- `README.md`: cómo editar pines y textos; estado SPEC 11.
- `CLAUDE.md`: `markerService.update`, `labelService.update`, modo editar en los editores, `startEditing` / `stopEditing`; `spec-11.js` en la regresión.

Nuevos:

- `tools/acceptance/spec-11.js`.

## Plan de implementación

1. Servicios: `markerService.update` y `labelService.update`, reutilizando `validate`. Prueba manual: desde consola, `update` cambia nombre, color y `x` sin tocar `createdAt` ni `found`; con `size: 13` o un id inexistente lanza y no escribe.
2. Capas: `onEdit` en `pinLayer.create` y `labelLayer.create`; "Editar" del pin con handler y botón "Editar" nuevo en el popup del texto; `startEditing`, `stopEditing` y `focus`. Prueba manual: con un `onEdit` de consola, "Editar" cierra el popup y llama al handler; `startEditing` quita el elemento y `stopEditing(id, null)` lo devuelve.
3. Editar pin: `pinEditor.open({ marker })` con título "Editar pin", campos rellenos, selector en el icono y tamaño del pin, borrador en su sitio sin caída (translúcido si está encontrado), "Último usado" igual; `viewer-view.js` lo conecta con `startEditing` / `stopEditing` y el foco. Cancelar (botón, Esc, ruta) deja el pin como estaba. Prueba manual: editar, mover el borrador y cancelar deja el pin en su sitio original.
4. Guardar pin editado: `markerService.update`, repintado con filtros, foco al pin, avisos de error. Prueba manual: cambiar nombre, icono, color, tamaño y posición, guardar, recargar y verlo así; sigue encontrado si lo estaba.
5. Editar texto: `labelEditor.open({ label })` con título "Editar texto", campos rellenos, borrador sin caída, guardar con `labelService.update`, cancelar y avisos; conexión en `viewer-view.js`. Prueba manual: cambiar texto, nota, color, tamaño y posición, guardar, recargar y verlo así; cancelar no toca nada.
6. Tests y docs: `tools/acceptance/spec-11.js`, `README.md` y `CLAUDE.md`. Prueba manual: `spec-01.js` a `spec-11.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] El popup del texto tiene "Editar" (`.label-popup__edit`, `.btn--edit`) a la izquierda de "Borrar"; el del pin sigue con "Editar" a la izquierda de "Borrar".
- [x] Clic en "Editar" de un pin cierra el popup y muestra `.pin-editor` con el título "Editar pin", y Nombre, Nota, Icono, Color y Tamaño con los valores guardados; la raíz tiene `.viewer--adding-pin`.
- [x] Clic en "Editar" de un texto cierra el popup y muestra `.label-editor` con el título "Editar texto", y Texto, Nota, Color y Tamaño con los valores guardados; la raíz tiene `.viewer--adding-label`.
- [x] Al abrir la edición, el elemento guardado no está en el mapa y el centro del borrador coincide (±2 px) con su posición, ya en su sitio en el primer fotograma (sin caída).
- [x] Editar un pin encontrado muestra el borrador con `.pin--found`.
- [x] Arrastrar el borrador 100 px lo mueve 100 px (±2) sin mover la vista ni escribir en la base; un clic en el mapa lo lleva a ese punto (±2 px).
- [x] Con el modo editar abierto, clic en otro pin o texto guardado no abre su popup y lleva el borrador a ese punto.
- [x] "Guardar" tras cambiar nombre, nota, icono, color, tamaño y posición de un pin actualiza su registro en `markers` con esos valores y el mismo `id`, `mapId`, `found` y `createdAt`; el panel se cierra, el pin se ve con los datos nuevos en la nueva posición (±2 px), sin popup abierto, y el foco queda en el pin.
- [x] Guardar un pin con Nombre vacío lo guarda con la etiqueta del icono.
- [x] "Guardar" tras cambiar texto, nota, color, tamaño y posición de un texto actualiza su registro en `labels` con esos valores y el mismo `id`, `mapId` y `createdAt`; el panel se cierra, el texto se ve con los datos nuevos (±2 px) y el foco queda en él.
- [x] En edición de texto, "Guardar" está deshabilitado con "Texto" vacío o "   ".
- [x] Guardar sin cambios cierra el panel y deja el registro con los mismos valores.
- [x] Editar un pin no cambia `markerService.lastStyle` (el pin más reciente sigue siendo el mismo).
- [x] Guardar un pin encontrado con "Encontrados" apagado (SPEC 09) no lo pinta y el foco va al contenedor del mapa.
- [x] "Cancelar", Esc o cambiar de ruta durante la edición, tras cambiar campos y mover el borrador, no escriben en la base; el elemento vuelve a su posición y estilo originales; con "Cancelar" o Esc el foco queda en él.
- [x] Esc con el selector de iconos abierto cierra solo el selector, no la edición.
- [x] Si `markerService.update` falla con cuota aparece "No queda espacio para guardar el pin.", y con otro error "No se pudo guardar el pin."; el panel y el borrador siguen y el registro no cambia. Lo mismo para textos con sus mensajes.
- [x] Tras recargar, los pines y textos editados aparecen con los datos guardados.
- [x] `markerService.update` con `size: 13`, `color: "pink"`, `x: 1.2` o un id inexistente lanza `InvalidMarkerError` y no escribe; `labelService.update` con `size: 13`, texto vacío o de 41 caracteres o un id inexistente lanza `InvalidLabelError` y no escribe.
- [x] Con pantalla completa simulada, "Editar" abre el panel visible.
- [x] Pasar el ratón sobre un texto con nota muestra un tooltip con la nota; sobre uno sin nota, ninguno.
- [x] Con el popup del texto abierto, o con un modo de añadir/editar abierto, el tooltip del texto no se ve.
- [x] Tras editar la nota de un texto y guardar, el tooltip muestra la nota nueva; si se borró, ya no hay tooltip.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo.
- [x] `tools/acceptance/spec-01.js` a `spec-11.js` pasan con un `WP_PROFILE` vacío.

## Decisiones

- **Sí:** reutilizar los paneles de "Añadir pin" y "Añadir texto" con un modo edición (opción `marker` / `label`). Decisión del usuario. Mismo aspecto y mismo código; solo cambian título, valores iniciales y la llamada al guardar.
- **No:** editar dentro del popup. El popup crecería mucho y el selector de iconos no cabe.
- **Sí:** editar también los textos, con un botón "Editar" nuevo en su popup. Decisión del usuario ("el modal del pin y el del label").
- **Sí:** la posición se edita en el mismo modo: el guardado sale del mapa y el borrador ocupa su lugar sin caída. Decisión del usuario. Cancelar lo devuelve a su sitio; la caída no tiene sentido para algo que ya está colocado.
- **No:** dejar la posición fuera de la edición. Mover arrastrando el guardado sigue funcionando fuera del modo editar.
- **Sí:** "Último usado" se mantiene en la edición de pines. Decisión del usuario.
- **Sí:** solo "Cancelar" y "Guardar" en el panel; "Borrar" y el ojo siguen en el popup. Decisión del usuario.
- **Sí:** `update` no toca `found` ni `createdAt`. Editar no cambia "Último usado" ni el estado encontrado.
- **Sí:** al guardar, panel y popup cerrados y foco en el elemento. Decisión del usuario.
- **No:** reabrir el popup tras guardar.
- **Sí:** cancelar sin preguntar, como al añadir. Decisión del usuario.
- **No:** confirmación "¿Descartar cambios?".
- **Sí:** "Guardar" siempre habilitado (salvo texto vacío). Decisión del usuario. Evita comparar estados en los dos editores.
- **Sí:** mismos mensajes de error que al crear. El usuario no necesita distinguir crear de editar en el aviso.
- **Sí:** `startEditing` / `stopEditing` en las capas en vez de borrar y volver a añadir el marcador. La capa conserva el marcador original para cancelar y el resto de su estado (popups, filtros).
- **Sí:** clases de raíz `.viewer--adding-pin` / `.viewer--adding-label` también en edición. Ocultan los mismos controles; una clase nueva solo duplicaría CSS.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cancelar no restaura el elemento (queda fuera del mapa) | `stopEditing(id, null)` se llama en todo cierre (`onClose` con `"cancel"` y `"unmount"`). Criterio de cancelar. |
| El borrador de edición busca hueco o cae y se aleja del sitio original | En modo edición no se llama a `findFreeSpot` ni a la animación. Criterio de posición ±2 px en el primer fotograma. |
| El pin editado y encontrado se oculta al guardar con el filtro activo | Comportamiento esperado (filtros de SPEC 09); el foco va al contenedor del mapa. Criterio propio. |
| `pin-editor.js` crece demasiado (735 líneas) | El modo edición solo cambia valores iniciales, título, colocación inicial y la llamada al guardar; si pasa de ~80 líneas nuevas, se extrae a una función local de arranque. |
| "Editar" en el popup quita del DOM el nodo clicado y Leaflet cierra mal el popup (gotcha de SPEC 09) | Cerrar el popup con `closePopup()` antes de abrir el editor, sin quitar el botón a mano. |
| Respuesta de `update` tras desmontar | Comprobar `closed` antes de tocar la capa, como al crear. |

## Qué **no** entra en esta spec

- Borrar o marcar "Encontrado" desde el panel.
- Confirmar al descartar cambios.
- Deshabilitar "Guardar" sin cambios.
- Deshacer, historial o `updatedAt`.
- Edición múltiple.
- Convertir pin en texto o al revés.
- Atajos de teclado.

Cada una de estas, si llega, va en su propia spec.
