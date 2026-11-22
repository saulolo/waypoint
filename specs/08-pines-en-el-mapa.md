# SPEC 08 — Pines en el mapa: añadir, ver y borrar

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03, SPEC 05, SPEC 06
> **Fecha:** 2026-11-22 (ampliada el mismo día durante la implementación: catálogo de 53 iconos en 7 categorías plegables, dorado oro, mover pines guardados también en modo "añadir pin", borrador que no cae encima de otro pin, tamaño fijo de 32 px y "Último usado" solo con icono y color)
> **Objetivo:** Dar acción al botón "Añadir pin" del visor: un panel derecho para nombrar el pin y elegir color, icono por categorías y tamaño, con un pin de vista previa que cae al mapa y se arrastra, y que al guardar queda en el mapa con un popup para verlo y borrarlo, y se puede mover arrastrándolo.

## Por qué existe esta spec

SPEC 06 dejó el botón "Añadir pin" sin acción y SPEC 01 reservó el store `markers` para esta spec.
El usuario quiere el patrón de los mapas interactivos de juegos (p. ej. th.gl, MapGenie): iconos por categoría con aspecto de juego, color y tamaño, colocados a mano sobre el mapa.

La spec es grande, así que se parte:

- **SPEC 08 (esta):** crear, ver, mover y borrar pines.
- **SPEC 09:** editar un pin guardado (nombre, nota y estilo), marcarlo como hecho y filtrar por categoría.

El "marcables como hechos" que SPEC 01 asignaba a SPEC 08 pasa a SPEC 09.

## Alcance

**Dentro:**

- **Abrir el modo "añadir pin":** clic en el botón "Añadir pin" (SPEC 06).
  - Se abre el **panel de pin** (`.pin-editor`), flotante y anclado a la derecha del visor.
  - Mientras está abierto, los controles de vista y el bloque + / − se ocultan (clase `.viewer--adding-pin` en la raíz). El zoom sigue funcionando con la rueda y el doble clic.
  - El panel lateral izquierdo (SPEC 05) no cambia: sigue como estaba, expandido o contraído.
  - El foco va al campo "Nombre".
- **Paneles no modales:** el panel de pin y el selector de iconos no son `<dialog>` modales. El mapa sigue usable a la vez (arrastrar, rueda, clic).
- **Panel de pin**, con el estilo de `.dialog` (SPEC 02). De arriba abajo:
  - Título "AÑADIR PIN" en `--font-pixel`.
  - **Último usado:** un botón con el icono en su color y solo el nombre del icono (p. ej. "Cofre"), sin color ni tamaño.
    - Muestra el icono y el color del pin guardado más reciente de **cualquier mapa del juego**.
    - Al abrir el panel, el borrador ya viene con su icono y su color. El tamaño no: empieza siempre en el de la barra por defecto, 32 px (`markerService.SIZE.default`).
    - Clic en el botón aplica al borrador su icono y su color, y deja el tamaño en el por defecto (32 px, la barra vuelve a 32), aunque ese pin tuviera otro tamaño.
    - Si el juego no tiene pines, muestra "Ninguno todavía", deshabilitado, y el borrador usa el estilo por defecto (icono `exclamation`, color `gold`, 32 px).
  - **Nombre:** `<input>` de una línea, opcional, máx. 60 caracteres (`maxlength`). Placeholder: la etiqueta del icono actual. Si se guarda vacío (o solo espacios), el pin toma la etiqueta del icono (p. ej. "Cofre").
  - **Nota:** `<textarea>` opcional, máx. 500 caracteres. Conserva los saltos de línea.
  - **Color:** grupo de 8 radios con muestra de color y `aria-label` con su nombre: Dorado, Blanco, Negro, Rojo, Naranja, Verde, Cian, Violeta.
  - **Icono:** botón que muestra el icono actual y su etiqueta. Clic abre el selector de iconos.
  - Abajo, dos botones `.btn`: "Cancelar" y "Guardar".
- **Selector de iconos** (`.pin-picker`): segundo panel flotante, a la izquierda del panel de pin, mismo estilo.
  - Título "ICONO".
  - Siete categorías, en este orden, cada una con su encabezado: Localizaciones, Enemigos, Tesoros, Equipo, Misiones, Información, Viaje.
  - **Categorías plegables:** el encabezado es un botón con chevron y `aria-expanded` que expande o contrae su cuadrícula.
    - Al abrir el selector solo está expandida la categoría del icono actual; las demás, contraídas.
    - Se pueden tener varias expandidas a la vez. Elegir un icono no contrae su categoría.
    - El estado solo dura mientras el panel de pin está abierto; no se guarda.
    - Los iconos de una categoría contraída no reciben foco.
  - Cuadrícula de dos columnas por categoría: icono + etiqueta (como las capturas de referencia). Cada opción es un radio; el icono elegido se resalta con el color de acento.
  - Debajo de los iconos, **barra de tamaño**: `<input type="range">` de 20 a 64 px, paso 4, con el valor visible ("32 px").
  - Botón "Listo" abajo: cierra el selector.
  - Elegir icono o mover la barra actualiza al momento el pin de vista previa y el botón "Icono" del panel de pin. El selector no se cierra al elegir.
  - Con scroll interno si no cabe en la altura de la ventana.
- **Pin de vista previa (borrador):**
  - Al abrir el panel de pin, el pin cae desde el borde superior del mapa hasta su sitio (~400 ms, `ease-out` con un rebote leve).
  - Su sitio inicial es el centro de la zona del mapa que no tapan el panel izquierdo (si está visible) ni el panel de pin. Si ese punto queda fuera de la imagen, va al punto de la imagen más cercano.
  - **Nunca cae encima de otro pin.** Si en ese sitio su caja (el cuadrado de `size` px) se solapa con la de un pin guardado, cae en el hueco libre más cercano: al lado o cerca, nunca superpuesto.
    - Se buscan puntos en anillos crecientes alrededor del sitio inicial, cada 8 px de pantalla y hasta 400 px. Gana el primero cuya caja, con 4 px de margen, no toca la de ningún pin guardado, y que queda dentro de la imagen y de la zona libre.
    - Si no hay ningún hueco en ese radio (mapa lleno de pines a ese zoom), cae en el sitio inicial.
    - Solo se aplica al caer. Después el usuario lo coloca donde quiera, también encima de otro pin.
  - Refleja en vivo color, icono y tamaño. Al pasar el ratón muestra el nombre escrito (o la etiqueta del icono).
  - **Mover:** arrastrarlo con clic sostenido lo mueve sin mover el mapa. Un clic simple en el mapa (sin arrastre) lo lleva a ese punto. Arrastrar el mapa fuera del pin mueve la vista, como siempre.
  - Nunca sale de la imagen: al arrastrarlo o al hacer clic fuera de ella, se queda en el borde más cercano.
  - Cursor `grab` / `grabbing` sobre él.
  - Mientras se añade un pin, los pines guardados no abren popup: un clic sin arrastre sobre ellos cuenta como clic en el mapa (lleva el borrador ahí). Arrastrarlos sí los mueve, como fuera de este modo (ver *Pines guardados*).
- **Aspecto de los pines** (borrador y guardados):
  - Glifo SVG inline del icono pintado con el color elegido (`currentColor`), con contorno para leerse sobre cualquier mapa: oscuro para todos los colores salvo Negro, que lleva contorno claro.
  - Tamaño fijo en píxeles de pantalla: no cambia con el zoom del mapa.
  - El centro del icono es el punto exacto del pin.
- **Guardar:**
  - Guarda el pin en el store `markers` con su posición relativa (0–1) y su estilo.
  - Al terminar: se cierran los paneles, vuelven los controles, el borrador pasa a ser un pin guardado (que se mueve como los demás) y el foco vuelve al botón "Añadir pin".
  - Si falla: aviso de error (`notice.show`), los paneles siguen abiertos y el borrador sigue en su sitio. Si es cuota (`isQuotaError`): "No queda espacio para guardar el pin."; si no: "No se pudo guardar el pin.".
- **Cancelar:** quita el borrador del mapa, cierra los paneles, vuelve los controles y devuelve el foco al botón "Añadir pin". Nada se guarda.
  - Lo hacen: el botón "Cancelar"; Esc (si el selector está abierto, Esc solo cierra el selector y devuelve el foco al botón "Icono"; con el selector cerrado, cancela); y cualquier cambio de ruta o desmontaje del visor (salir, cambiar de mapa con el selector de SPEC 07, Atrás), sin preguntar.
- **Pines guardados:**
  - Al montar el visor se cargan los pines del mapa y se pintan.
  - Si la carga falla: aviso "No se pudieron cargar los pines." y el mapa se abre igual.
  - Pasar el ratón muestra un tooltip con el nombre.
  - Cursor `grab` / `grabbing` sobre ellos, también en el modo "añadir pin".
  - **Mover:** clic sostenido y arrastrar lleva el pin a otro sitio sin mover el mapa; al soltar se guarda la nueva posición (`markerService.move`).
    - Nunca sale de la imagen: al arrastrarlo fuera, se queda en el borde más cercano.
    - Empezar a arrastrar cierra su popup si estaba abierto. Un clic sin arrastre sigue abriendo el popup.
    - Si guardar la posición falla: aviso "No se pudo mover el pin." y el pin vuelve a donde estaba.
    - También se pueden mover mientras se añade un pin: arrastrar un guardado lo mueve y lo guarda; el borrador no se mueve. En ese modo no abren popup ni tooltip.
  - Clic abre un **popup** con el estilo arcade (sustituye el fondo blanco de Leaflet): nombre en `--font-pixel`, nota en `--font-mono` con sus saltos de línea (sin nota, no hay párrafo) y un botón "Borrar" (`.btn` de peligro).
  - El popup se cierra con su botón ×, Esc o un clic en el mapa.
- **Borrar:** "Borrar" pide confirmación con `dialog.confirm({ title: "¿Borrar pin?", message: "Se borrará «<nombre>».", confirmLabel: "Borrar", danger: true })`.
  - Al confirmar, se borra de `markers` y desaparece del mapa. Si falla: aviso "No se pudo borrar el pin." y el pin se queda.
  - "Último usado" se recalcula con los pines que queden.
- **Pantalla completa (SPEC 06):** "Añadir pin" funciona igual. Los paneles de pin se ven dentro de pantalla completa; solo el panel izquierdo sigue oculto.
- Clics, arrastres y rueda sobre los paneles de pin no llegan al mapa.
- Foco visible (contorno hacia dentro) en todos los controles de los paneles y en el botón "Borrar".
- Movimiento reducido: la caída del pin no se anima (regla global de `css/effects.css`).
- Catálogo de 53 iconos SVG propios, dibujados para el proyecto con el estilo de las capturas de referencia (silueta sencilla y legible a 20 px). No se copia ningún icono de th.gl ni de otro sitio.
- Crear `tools/acceptance/spec-08.js`.

**Fuera de alcance (para specs futuras):**

- Editar un pin guardado: nombre, nota o estilo (SPEC 09). Moverlo sí entra en esta spec.
- Recordar entre aperturas qué categorías del selector estaban expandidas.
- Marcar pines como hechos (SPEC 09).
- Filtrar o mostrar/ocultar pines por categoría, contadores por categoría (SPEC 09).
- Lista de pines en el panel lateral, buscador de pines.
- Iconos o colores personalizados por el usuario (subir imágenes, selector de color libre).
- Tamaño que escala con el zoom del mapa.
- Agrupar pines cercanos (clustering).
- Deshacer un borrado.
- Copiar o mover pines entre mapas; exportar o importar pines.
- Atajos de teclado para añadir pin.

## Modelo de datos

No hay migración: el store `markers` (keyPath `id`, índice `mapId`) existe desde SPEC 01 y sigue en el esquema v2.
El borrado en cascada de mapas y juegos ya borra sus `markers` (SPEC 01 y SPEC 03).

Esta spec completa los campos del marcador:

```js
// Store "markers" — keyPath: "id", índice "mapId" (no único)
const marker = {
  id: "…",              // crypto.randomUUID()
  mapId: "b3f1c2e4-...",
  x: 0.42,              // 0–1, relativo al ancho de la imagen (SPEC 01)
  y: 0.17,              // 0–1, relativo al alto de la imagen (SPEC 01)
  name: "Cofre",        // 1–60 caracteres tras quitar espacios de los extremos
  note: "",             // 0–500 caracteres; "" si no hay nota
  icon: "chest",        // id del catálogo de js/ui/pin-icons.js
  color: "gold",        // una de markerService.COLORS
  size: 32,             // px de pantalla; 20–64, múltiplo de 4
  createdAt: 1763800000000,
};
```

Convenciones:

- Conversión relativa → Leaflet: `lat = height * (1 - y)`, `lng = width * x` (SPEC 01).
- `color` guarda la clave, no el valor: la UI la traduce al token `--color-pin-<clave>`.
- `icon` guarda el id del catálogo. Un id que no existe se pinta con el icono `question`.
- "Último usado" se deduce: el marcador con mayor `createdAt` entre los mapas del juego. No se guarda aparte (ni en `localStorage`).

API nueva en `Waypoint.data.markersRepository`:

```js
markersRepository.add(marker);            // → Promise<void>
markersRepository.listByMap(mapId);       // → Promise<object[]> (índice mapId)
markersRepository.listByMaps(mapIds);     // → Promise<object[]>
markersRepository.update(id, changes);    // → Promise<object|null> (null si no existe)
markersRepository.remove(id);             // → Promise<void>
```

API nueva en `Waypoint.services.markerService`:

```js
markerService.COLORS;        // ["gold", "white", "black", "red", "orange", "green", "cyan", "violet"]
markerService.SIZE;          // { min: 20, max: 64, step: 4, default: 32 }
markerService.DEFAULT_STYLE; // { icon: "exclamation", color: "gold", size: 32 }

markerService.create(mapId, { x, y, name, note, icon, color, size }); // → Promise<marker>
markerService.listByMap(mapId);    // → Promise<marker[]>
markerService.move(id, x, y);      // → Promise<marker>; solo cambia x/y (createdAt no cambia)
markerService.remove(id);          // → Promise<void>
markerService.lastStyle(gameId);   // → Promise<{ icon, color, size } | null>
markerService.isQuotaError(error); // como mapService.isQuotaError
```

`create` valida y lanza `InvalidMarkerError` (clase propia de `marker-service.js`) si `x`/`y` salen de 0–1, `name` queda vacío o pasa de 60, `note` pasa de 500, `color` no está en `COLORS`, `size` sale del rango o no es múltiplo de 4, o `icon` no es un texto no vacío.
`move` lanza `InvalidMarkerError` si `x`/`y` salen de 0–1 (sin escribir nada) y rechaza si el marcador no existe.
Mover no cambia `createdAt`, así que no altera "Último usado".
El nombre por defecto (la etiqueta del icono) lo pone la UI, que es quien conoce el catálogo.

Catálogo en `Waypoint.ui.pinIcons`:

```js
pinIcons.CATEGORIES; // [{ id: "locations", label: "Localizaciones", icons: [{ id: "cave", label: "Cueva" }, …] }, …]
pinIcons.label(iconId);  // "Cueva"; desconocido → etiqueta de "question"
pinIcons.svg(iconId);    // <svg> con fill="currentColor" y contorno; desconocido → "question"
```

Los 53 iconos (id → etiqueta), en 7 categorías y en este orden:

| Categoría (`id`) | Iconos |
| --- | --- |
| Localizaciones (`locations`, 9) | `cave` Cueva, `dungeon` Mazmorra, `town` Ciudad, `castle` Castillo, `shrine` Santuario, `camp` Campamento, `tower` Torre, `save-point` Punto de guardado, `viewpoint` Mirador |
| Enemigos (`enemies`, 8) | `boss` Jefe, `elite` Enemigo fuerte, `battle` Batalla, `beast` Bestia, `undead` No muerto, `hostile-npc` Hostil, `nest` Guarida, `sniper` Francotirador |
| Tesoros (`treasures`, 7) | `chest` Cofre, `item` Objeto, `key` Llave, `gem` Gema, `coin` Dinero, `collectible` Coleccionable, `easter-egg` Easter egg |
| Equipo (`gear`, 6) | `weapon` Arma, `armor` Armadura, `potion` Poción, `medicine` Medicina, `upgrade` Mejora, `resource` Recurso |
| Misiones (`quests`, 6) | `quest` Misión principal, `side-quest` Misión secundaria, `npc` Personaje, `shop` Compras, `minigame` Minijuego, `puzzle` Acertijo |
| Información (`info`, 8) | `exclamation` Aviso, `question` Misterio, `note` Nota, `danger` Peligro, `star` Destacado, `search` Buscar, `check` Hecho, `cancel` Descartado |
| Viaje (`travel`, 9) | `door` Puerta, `exit` Salida, `fast-travel` Viaje rápido, `vehicle` Vehículo, `motorcycle` Moto, `boat` Barco, `garage` Taller, `stairs` Escaleras, `portal` Portal |

Glifos de los iconos nuevos o cambiados:

- `quest` Misión principal: pergamino con "!" (el glifo de la antigua "Misión"). `side-quest` Misión secundaria: busto de personaje con "?" encima.
- `shop` Compras: carrito de la compra (sustituye a la tienda con toldo). El id no cambia.
- `check` Hecho: marca de verificación (✓). `cancel` Descartado: aspa (✕). Son iconos, no el estado "hecho" de SPEC 09.
- `easter-egg`: huevo con dibujo en zigzag. `search`: lupa. `motorcycle`: moto de perfil. `medicine`: botiquín con cruz. `armor`: peto. `minigame`: mando de juego. `viewpoint`: ojo. `upgrade`: flecha hacia arriba en un escudo. `resource`: mineral en bruto. `puzzle`: pieza de puzle.

Etiquetas de color (UI): `gold` Dorado, `white` Blanco, `black` Negro, `red` Rojo, `orange` Naranja, `green` Verde, `cyan` Cian, `violet` Violeta.

Tokens nuevos en `css/tokens.css`: `--color-pin-gold`, `--color-pin-white`, `--color-pin-black`, `--color-pin-red`, `--color-pin-orange`, `--color-pin-green`, `--color-pin-cyan`, `--color-pin-violet`, `--color-pin-outline-dark` y `--color-pin-outline-light`. Reutilizan los neón existentes donde encajan (rojo, verde, cian, violeta).
Dorado es oro metálico, `#d4af37`, no el `--color-neon-gold` amarillento del hero.

Estado en memoria, por visor montado:

```js
var draft = null;       // { marker: L.Marker, x, y, name, note, icon, color, size } mientras se añade
var pickerOpen = false;
var savedPins = {};     // id → L.Marker de los pines guardados
```

## Archivos

Nuevos:

- `js/data/markers-repository.js`: CRUD del store `markers`.
- `js/services/marker-service.js`: validación, `create`, `listByMap`, `move`, `remove`, `lastStyle`, `InvalidMarkerError`.
- `js/ui/pin-icons.js`: catálogo de categorías, etiquetas y los 53 glifos SVG.
- `js/ui/pin-layer.js`: pinta los pines guardados (`L.divIcon`), tooltip, popup arcade, borrado con confirmación y arrastre para moverlos.
- `js/ui/pin-editor.js`: panel de pin, selector de iconos, pin borrador (caída, arrastre, clic en mapa, límites), guardar y cancelar; devuelve una función de cierre que el visor llama al desmontar.
- `css/pins.css`: pines, paneles, selector (con categorías plegables), barra de tamaño, popup y animación de caída.
- `tools/acceptance/spec-08.js`.

Modificados:

- `index.html`: `css/pins.css`; `markers-repository.js` tras `maps-repository.js`, `marker-service.js` tras `map-service.js`, y `pin-icons.js`, `pin-layer.js`, `pin-editor.js` antes de `viewer-view.js`.
- `js/ui/viewer-view.js`: conecta `onAddPin`, carga los pines al montar, clase `.viewer--adding-pin`, cierra el editor y la capa al desmontar; comentario de cabecera.
- `js/ui/view-controls.js`: comentario de cabecera (el botón de pin ya tiene acción).
- `css/tokens.css`: tokens `--color-pin-*`, `--pin-editor-width` (280 px) y `--pin-picker-width` (320 px); `--viewer-panel-width` baja de 320 a 260 px.
- `js/ui/viewer-view.js`: el panel lateral empieza contraído al abrir un mapa (antes expandido, SPEC 05).
- `tools/acceptance/spec-05.js`, `spec-06.js`, `spec-07.js` y las specs 05 y 07: panel de 260 px y contraído al abrir (las pruebas lo expanden donde lo necesitan; spec-06 anula el panel de pin al comprobar que los clics en el botón de pin no llegan al mapa).
- `css/viewer.css`: `.viewer--adding-pin` oculta los controles de la esquina inferior derecha.
- `css/base.css`: `textarea` hereda color y fuente, como `input` (sin eso, la nota se escribe en negro sobre negro).
- `README.md`: cómo añadir, mover y borrar pines; editar y hechos en SPEC 09.
- `CLAUDE.md`: archivos nuevos, modelo de `markers`, paneles no modales, gotchas que salgan; `spec-08.js` en la regresión; hechos en SPEC 09.

## Plan de implementación

1. Datos y servicio: `markers-repository.js` y `marker-service.js` (con `InvalidMarkerError`, `COLORS`, `SIZE`, `DEFAULT_STYLE`, `lastStyle`), cargados en `index.html`. Prueba manual: desde consola, `create` guarda un pin, `listByMap` lo devuelve, `lastStyle(gameId)` devuelve su estilo, `create` con `size: 30` lanza `InvalidMarkerError` y `remove` lo quita.
2. Tokens y catálogo (parte 1): tokens `--color-pin-*`; `pin-icons.js` con la estructura completa de las 5 categorías y los glifos de Localizaciones y Enemigos (el resto con `question` provisional). Prueba manual: `pinIcons.svg("cave")` pintado en la página se ve con `currentColor` y contorno.
3. Catálogo (parte 2): glifos de Tesoros, Información y Viaje. Prueba manual: los 40 iconos pintados en una tira a 20 px y a 64 px se distinguen entre sí. (Pasos 2 y 3 hechos con el catálogo inicial de 40; el paso 10 lo amplía.)
4. Pines guardados: `pin-layer.js` pinta los pines del mapa al montar (aviso si falla), tooltip con el nombre, popup arcade con nombre y nota. Prueba manual: pines creados por consola aparecen en su sitio tras recargar, mantienen su tamaño al hacer zoom y el popup muestra nombre y nota.
5. Borrar: botón "Borrar" del popup con `dialog.confirm`, borrado y aviso si falla. Prueba manual: borrar un pin lo quita del mapa y de `markers`; cancelar la confirmación no lo borra.
6. Panel de pin y borrador: `pin-editor.js` abre el panel derecho al pulsar "Añadir pin" (campos Nombre, Nota, Color e Icono sin selector todavía), oculta los controles, deja caer el borrador al centro de la zona libre y lo refleja en vivo; "Cancelar", Esc y el desmontaje lo quitan. Prueba manual: abrir, cambiar color y nombre ve el cambio en el pin; cancelar no deja rastro; cambiar de mapa con el panel abierto no deja paneles ni borrador.
7. Mover el borrador: arrastre del pin sin mover el mapa, clic en el mapa lo lleva ahí, límites de la imagen y pines guardados sin popup mientras se añade. Prueba manual: el pin no sale de la imagen ni arrastrándolo ni con clic fuera.
8. Selector de iconos: panel `.pin-picker` a la izquierda del de pin, categorías, cuadrícula, barra de tamaño y "Listo"; Esc lo cierra primero. Prueba manual: elegir icono y mover la barra cambia el pin al momento.
9. Guardar y "Último usado": "Guardar" crea el marcador (nombre por defecto = etiqueta del icono), convierte el borrador en pin guardado y cierra; avisos de error; "Último usado" desde `lastStyle`. Prueba manual: tras guardar un cofre rojo de 40 px, el siguiente "Añadir pin" en otro mapa del mismo juego viene con ese estilo; recargar mantiene el pin.
10. Catálogo ampliado y dorado: `pin-icons.js` pasa a 7 categorías y 53 iconos (13 glifos nuevos; `shop` → Compras con carrito; `quest` → Misión principal); `--color-pin-gold` a `#d4af37`. Prueba manual: los 53 iconos en una tira a 20 y 64 px se distinguen; el dorado se ve oro, no amarillo.
11. Categorías plegables: encabezados del selector como botones con chevron y `aria-expanded`; al abrir, solo la categoría del icono actual expandida. Prueba manual: expandir y contraer con clic y con Enter; Tab no entra en las contraídas.
12. Mover pines guardados: `markersRepository.update`, `markerService.move` y arrastre en `pin-layer.js` (límites de la imagen, guardar al soltar, aviso y vuelta atrás si falla). Funciona también en modo "añadir pin", donde un clic sin arrastre sigue llevando el borrador al punto. Prueba manual: arrastrar un pin, recargar y verlo en el sitio nuevo; un clic sin arrastre abre el popup; con el panel de pin abierto, arrastrar un guardado lo mueve y el borrador no.
13. Ajustes del borrador: al caer no se solapa con ningún pin guardado (búsqueda en anillos) y el tamaño inicial es siempre 32 px ("Último usado" aporta icono y color; su botón también, y devuelve el tamaño a 32; su texto es solo el nombre del icono). Prueba manual: con un pin guardado en el centro de la zona libre, el borrador cae al lado sin tocarlo.
14. Tests y docs: `tools/acceptance/spec-08.js` con los criterios automatizables; actualizar `README.md` y `CLAUDE.md`. Prueba manual: `spec-01.js` a `spec-08.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] Clic en "Añadir pin" muestra `.pin-editor` a la derecha con el título "AÑADIR PIN", los campos Último usado, Nombre, Nota, Color (8 opciones) e Icono, y los botones "Cancelar" y "Guardar"; el foco queda en "Nombre".
- [x] Con el panel abierto, la raíz tiene `.viewer--adding-pin` y no se ven ni los controles de vista ni + / −; al cerrarlo vuelven.
- [x] Con el panel abierto, la rueda sobre el mapa cambia el zoom y arrastrar el mapa (fuera del pin) mueve la vista.
- [x] Al abrirse, aparece un pin borrador cuyo centro queda (±2 px) en el centro de la zona libre entre el panel izquierdo y `.pin-editor`; con el panel izquierdo contraído, la zona libre empieza en el borde izquierdo de la ventana.
- [x] Si hay un pin guardado en el centro de la zona libre, el borrador cae en otro sitio: su caja no se solapa con la del pin guardado, queda dentro de la imagen y su centro está a menos de 400 px del centro de la zona libre.
- [x] Con movimiento reducido emulado, el borrador está en su sitio final en el primer fotograma (sin animación).
- [x] Elegir el color Rojo pone el `color` calculado del glifo del borrador al valor de `--color-pin-red`; con Negro, el contorno usa `--color-pin-outline-light`.
- [x] El color calculado de un pin Dorado es `rgb(212, 175, 55)` (`#d4af37`).
- [x] Escribir en "Nombre" cambia el tooltip del borrador; con "Nombre" vacío, el placeholder y el tooltip son la etiqueta del icono.
- [x] "Nombre" no admite más de 60 caracteres y "Nota" más de 500.
- [x] El texto escrito en "Nota" tiene el mismo color calculado que el de "Nombre" (claro, no negro).
- [x] Clic en "Icono" abre `.pin-picker` a la izquierda de `.pin-editor`, sin solaparse, con las categorías Localizaciones, Enemigos, Tesoros, Equipo, Misiones, Información y Viaje en ese orden y 9, 8, 7, 6, 6, 8 y 9 iconos (53 en total), cada uno con su etiqueta.
- [x] El icono `shop` se llama "Compras" y `quest` "Misión principal"; existen `side-quest`, `check`, `cancel`, `easter-egg`, `search`, `motorcycle`, `medicine`, `armor` y `minigame`.
- [x] Al abrir el selector, solo la categoría del icono actual tiene `aria-expanded="true"` y sus iconos visibles; clic (o Enter) en el encabezado de otra la expande, y otro clic la contrae. Elegir un icono no contrae su categoría.
- [x] Tab no lleva el foco a iconos de categorías contraídas.
- [x] Elegir un icono en el selector cambia al momento el glifo del borrador y el botón "Icono" del panel, y el selector sigue abierto.
- [x] La barra de tamaño va de 20 a 64 en pasos de 4; ponerla en 48 deja el glifo del borrador en 48×48 px (±1) y muestra "48 px".
- [x] El tamaño de un pin en pantalla no cambia (±1 px) al hacer zoom con la rueda.
- [x] Arrastrar el borrador 100 px a la derecha lo mueve 100 px (±2) y el centro de la vista del mapa no cambia.
- [x] Un clic simple en el mapa lleva el borrador a ese punto (±2 px).
- [x] Arrastrar el borrador o hacer clic fuera de la imagen lo deja en el borde de la imagen: su `x` e `y` relativas quedan en 0–1.
- [x] Con el selector abierto, Esc (`cdpKey("Escape")`) cierra solo el selector y el foco queda en el botón "Icono"; un segundo Esc cancela: no hay `.pin-editor`, ni borrador, ni registros nuevos en `markers`.
- [x] "Cancelar" quita el borrador y los paneles, no crea registros en `markers` y deja el foco en "Añadir pin".
- [x] Con el panel abierto, cambiar de ruta (Atrás o "← Mapas") no deja `.pin-editor`, `.pin-picker`, borrador ni listeners de `keydown` del editor (Esc en `#/game/<id>` no lanza errores).
- [x] "Guardar" con nombre "Cofre del norte", nota de dos líneas, Rojo, `chest` y 40 px crea un registro en `markers` con esos valores, `mapId` del mapa abierto, `x`/`y` en 0–1 y `createdAt`; los paneles se cierran y el pin queda en el mapa en el mismo sitio (±2 px).
- [x] "Guardar" con "Nombre" vacío guarda `name` igual a la etiqueta del icono.
- [x] Si `markerService.create` falla con un error de cuota, aparece "No queda espacio para guardar el pin.", y con otro error "No se pudo guardar el pin."; en los dos casos los paneles y el borrador siguen.
- [x] Tras recargar (F5), los pines guardados del mapa aparecen en su sitio con su icono, color y tamaño; los de otro mapa no.
- [x] Si `markerService.listByMap` falla, el mapa se abre igual y aparece "No se pudieron cargar los pines.".
- [x] Pasar el ratón por un pin guardado muestra su nombre; clic abre un popup con fondo del tema (no blanco), el nombre en `--font-pixel`, la nota con sus saltos de línea y el botón "Borrar".
- [x] Un pin sin nota no muestra párrafo de nota en el popup.
- [x] Arrastrar un pin guardado 100 px a la derecha lo mueve 100 px (±2), no mueve el mapa y actualiza su `x`/`y` en `markers` (mismo `createdAt`); tras recargar sigue en el sitio nuevo.
- [x] Arrastrar un pin guardado fuera de la imagen lo deja en el borde: su `x` e `y` quedan en 0–1.
- [x] Un clic sin arrastre sobre un pin guardado sigue abriendo su popup.
- [x] Si `markerService.move` falla, aparece "No se pudo mover el pin." y el pin vuelve a su sitio anterior (±2 px).
- [x] Mientras se añade un pin, arrastrar un pin guardado lo mueve y guarda su nueva posición, sin mover el borrador ni abrir popup; un clic sin arrastre sobre él lleva el borrador a ese punto.
- [x] `markerService.move` con `x: 1.2` lanza `InvalidMarkerError` y no escribe nada.
- [x] Mientras se añade un pin, clic en un pin guardado no abre popup y lleva el borrador a ese punto.
- [x] "Borrar" abre la confirmación "¿Borrar pin?"; confirmar quita el pin del mapa y de `markers`; cancelar no lo toca.
- [x] "Último usado" en un juego sin pines muestra "Ninguno todavía" deshabilitado y el borrador usa `exclamation`, Dorado y 32 px.
- [x] Tras guardar un pin `chest` Rojo de 40 px, abrir "Añadir pin" en otro mapa del mismo juego muestra "Cofre" (sin color ni tamaño) en "Último usado", y el borrador con `chest`, Rojo y 32 px (la barra en 32). Tras cambiar el color a Cian y el tamaño a 48, clic en "Último usado" deja el borrador en `chest`, Rojo y 32 px, y la barra en 32.
- [x] En otro juego, "Último usado" no muestra el pin del primer juego.
- [x] Con pantalla completa simulada (como en `spec-06.js`), "Añadir pin" abre `.pin-editor` visible y `.viewer__panel` sigue oculto.
- [x] Clic, arrastre y rueda sobre `.pin-editor` y `.pin-picker` no mueven ni hacen zoom en el mapa ni mueven el borrador.
- [x] Los controles de los paneles y el botón "Borrar" tienen contorno de foco visible al recibir foco con Tab.
- [x] `markerService.create` con `size: 30`, `color: "pink"`, `x: 1.2` o una nota de 501 caracteres lanza `InvalidMarkerError` y no escribe nada.
- [x] Borrar el mapa o el juego borra también sus pines de `markers`.
- [x] Ningún archivo de `js/ui/` usa `indexedDB`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo (los glifos usan `currentColor`).
- [x] `tools/acceptance/spec-01.js` a `spec-08.js` pasan con un `WP_PROFILE` vacío.

## Decisiones

- **Sí:** SPEC 08 = crear, ver y borrar pines; editar, marcar como hechos y filtros pasan a SPEC 09. Decisión del usuario. La spec completa no cabía en una sola.
- **No:** solo crear y ver. Un pin mal puesto no se podría quitar.
- **No:** todo junto (con edición, hechos y filtros). Demasiado grande.
- **Sí:** paneles flotantes no modales, no `<dialog>` modal. `showModal()` deja el resto de la página `inert` y no se podría arrastrar el pin ni ver el mapa en vivo.
- **Sí:** panel de pin anclado a la derecha. Decisión del usuario.
- **No:** panel a la izquierda o caja centrada. A la izquierda descartado por el usuario; centrada tapa el punto donde cae el pin.
- **Sí:** ocultar los controles de vista y + / − mientras se añade un pin. Decisión del usuario. El panel derecho ocupa su esquina.
- **No:** desplazar los controles o acortar el panel para que quepan.
- **Sí:** selector de iconos como segundo panel a la izquierda del de pin. Decisión del usuario. Se ven los dos y el pin a la vez.
- **No:** sustituir el contenido del panel de pin ni modal centrado. Este último tapa el pin y bloquea el mapa.
- **Sí:** la barra de tamaño va en el selector de iconos, después de los iconos. Petición del usuario.
- **Sí:** glifo coloreado con contorno (claro para Negro). Decisión del usuario, como las capturas de referencia.
- **No:** insignia circular rellena ni gota de pin con glifo dentro.
- **Sí:** 8 colores (Dorado, Blanco, Negro, Rojo, Naranja, Verde, Cian, Violeta) como tokens. Decisión del usuario. Se guarda la clave, no el hex: el tema puede cambiarlos sin migrar datos.
- **Sí:** tamaño fijo en pantalla, 20–64 px en pasos de 4, 32 por defecto. Decisión del usuario. Como los mapas de referencia; al alejar no se vuelven diminutos.
- **No:** tamaño que escala con el zoom.
- **Sí:** "Último usado" = icono y color del pin más reciente del juego; al abrir se preaplican (el tamaño, desde la ampliación, empieza y vuelve siempre a 32). Decisión del usuario. Se deduce de `markers`: sin almacenamiento nuevo.
- **No:** lista de los 5 últimos ni "último usado" global en `localStorage`.
- **Sí:** nombre opcional; vacío toma la etiqueta del icono. Nombre máx. 60, nota máx. 500. Decisión del usuario. "Guardar" nunca queda bloqueado.
- **Sí:** iconos SVG propios por categoría. Decisión del usuario. Cubren aventura, RPG, mundo abierto, acción, estrategia y conducción (vehículo, moto, taller). Empezó con 40 (8 por categoría) y la ampliación lo dejó en 53 (ver abajo).
- **No:** copiar los iconos de th.gl u otros sitios. Son de terceros; solo sirven de referencia de estilo.
- **Sí:** iconos y etiquetas en `js/ui/pin-icons.js`, no en el servicio. Son presentación; el servicio solo valida que `icon` sea un texto. El nombre por defecto lo pone la UI.
- **Sí:** el pin cae al centro de la zona libre (sin paneles encima), dentro de la imagen. Decisión del usuario.
- **No:** centro exacto de la ventana. Puede quedar debajo de un panel.
- **Sí:** mover el borrador arrastrándolo y también con clic en el mapa; siempre dentro de la imagen. Decisión del usuario.
- **Sí:** mientras se añade, los pines guardados no abren popup. Un solo modo activo; el clic sirve para colocar.
- **Sí:** cancelar con el botón, Esc (cierra antes el selector) y cualquier cambio de ruta, sin preguntar. Decisión del usuario.
- **Sí:** clic en un pin guardado abre popup con nombre, nota y "Borrar"; hover muestra el nombre. Decisión del usuario.
- **No:** solo tooltip, o abrir el formulario de edición (eso es SPEC 09).
- **Sí:** borrar con `dialog.confirm`. Decisión del usuario. Coherente con borrar mapa y juego.
- **Sí:** "Añadir pin" funciona igual en pantalla completa; los paneles de pin se ven. Decisión del usuario.
- **Sí:** sin migración de esquema. El store `markers` y el borrado en cascada existen desde SPEC 01 y 03.
- **Sí:** editor y capa de pines en archivos propios (`pin-editor.js`, `pin-layer.js`). `viewer-view.js` ya pasa de 490 líneas.
- **Sí:** "marcables como hechos" pasa de SPEC 08 a SPEC 09.
- **Sí (ampliación):** 53 iconos en 7 categorías, con Equipo y Misiones nuevas; "Tienda" pasa a "Compras" con un carrito y "Misión" a "Misión principal". Petición del usuario durante la implementación. Los ids `shop` y `quest` no cambian: no hay pines reales que migrar, pero así no hace falta.
- **No:** mantener 8 iconos por categoría. Obligaba a meter iconos donde no encajan.
- **Sí (ampliación):** categorías plegables; al abrir, solo la del icono actual expandida. Petición del usuario: con 53 iconos el selector pedía mucho scroll.
- **No:** guardar entre aperturas qué categorías estaban expandidas. Fuera de alcance; abrir por la del icono actual ya lleva a lo que se está usando.
- **Sí (ampliación):** Dorado = oro metálico `#d4af37`. Petición del usuario: el neón dorado se veía amarillo.
- **Sí (ampliación):** mover pines guardados con clic sostenido y arrastre, guardando al soltar. Petición del usuario; sale de SPEC 09, que se queda con editar nombre, nota y estilo.
- **No:** pedir confirmación al mover. Mover es inmediato; si se equivoca, se vuelve a arrastrar.
- **Sí (ampliación):** los pines guardados también se mueven en modo "añadir pin". Petición del usuario. El arrastre mueve el guardado; el clic sin arrastre sigue colocando el borrador.
- **Sí (ampliación):** el borrador nunca cae encima de otro pin: busca el hueco libre más cercano. Petición del usuario. Solo al caer; después se puede poner donde se quiera.
- **No:** impedir siempre los solapes (también al arrastrar). Quitaría libertad para marcar dos cosas en el mismo sitio.
- **Sí (ampliación):** el tamaño del borrador es siempre 32 px al abrir y al pulsar "Último usado", que solo aporta icono y color y solo muestra el nombre del icono. Petición del usuario.
- **Sí (ampliación):** paneles más estrechos: "Añadir pin" 280 px, selector de iconos 320 px (glifos de 20 px para que ninguna etiqueta se parta a mitad de palabra) y panel lateral del visor 260 px (antes 320, decisión de SPEC 05). Popup del pin compacto (160–220 px). Petición del usuario.
- **Sí (ampliación):** el panel lateral del visor (con el selector de mapas) empieza contraído al abrir un mapa; la pestaña lo expande. Cambia la decisión de SPEC 05 (empezaba expandido). Petición del usuario. Sigue sin guardarse el estado.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El arrastre del borrador mueve también el mapa | Usar el arrastre de `L.Marker` (`draggable: true`), que desactiva el del mapa mientras dura. Criterio dedicado. |
| El clic que termina un arrastre del mapa mueve el borrador | Escuchar el `click` de Leaflet, que no se dispara tras un arrastre. Criterio de arrastre del mapa con el panel abierto. |
| Límite a la imagen con `drag` deja el pin fuera un fotograma | Recolocar dentro de los bounds en cada `drag` y en `dragend`. |
| Inercia o `_panInsideMaxBounds` mueven el pin al soltar | El pin está en coordenadas del mapa: se mueve con la imagen, no se desplaza respecto a ella. |
| Clics o rueda en los paneles llegan al mapa o a `wheel-zoom.js` | Los paneles son hermanos de `.viewer__stage`, como `.viewer__panel` (gotcha de CLAUDE.md), no hijos del contenedor de Leaflet. |
| Los `z-index` de los panes de Leaflet tapan los paneles | `.viewer__stage` ya lleva `isolation: isolate` (SPEC 05). |
| Esc del editor choca con Esc de la lista de mapas o del popup | El editor solo escucha Esc mientras está abierto; la lista de mapas y el popup no se abren a la vez que el editor. Criterio de Esc. |
| Paneles, borrador o listeners vivos tras desmontar | `pin-editor.js` devuelve una función de cierre que `viewer-view.js` llama al desmontar. Criterio dedicado. |
| Popup de Leaflet con fondo blanco y foco sin contorno | `pins.css` sobrescribe `.leaflet-popup-content-wrapper` y `.leaflet-popup-tip` con tokens; contorno hacia dentro en "Borrar". |
| Glifos ilegibles a 20 px o sobre mapas claros | Siluetas sencillas y contorno de color contrario. Prueba manual del paso 3 a 20 y 64 px. |
| `clip-path` recorta el foco de los controles | `outline-offset` negativo, como `.btn` (gotcha de CLAUDE.md). |
| Respuesta de `listByMap` o `lastStyle` tras desmontar | Comprobar `alive` antes de pintar, como el bloque del juego. |
| Arrastrar un pin guardado abre su popup al soltar | Leaflet no dispara `click` tras arrastrar un `L.Marker`. Criterio de clic sin arrastre. |
| Mover un pin y desmontar antes de que se guarde | La escritura termina igual; la capa destruida no pinta ni avisa. |
| En modo "añadir pin", soltar el arrastre de un guardado mueve también el borrador | Leaflet no dispara `click` tras arrastrar un `L.Marker`: el borrador solo se mueve con clic sin arrastre. Criterio dedicado. |
| La búsqueda de hueco es lenta con muchos pines | Como mucho unos 2.000 puntos de prueba, contra los pines del mapa; solo una vez, al caer. |

## Qué **no** entra en esta spec

- Editar nombre, nota o estilo de pines guardados (SPEC 09).
- Marcar pines como hechos (SPEC 09).
- Filtros y contadores por categoría (SPEC 09).
- Lista o buscador de pines.
- Iconos o colores personalizados.
- Tamaño que escala con el zoom, agrupar pines.
- Deshacer borrados; copiar o mover pines entre mapas; exportar o importar pines.
- Atajos de teclado.

Cada una de estas, si llega, va en su propia spec.
