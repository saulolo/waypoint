# SPEC 03 — Carpetas de juegos con portada

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-20
> **Objetivo:** Agrupar los mapas en carpetas de juego con portada, de modo que el inicio muestre los juegos y al entrar en uno se vea su lista de mapas.

## Por qué existe esta spec

Hoy el inicio (`#/`) es una lista plana de mapas.
Con varios juegos (por ejemplo "The Final Fantasy Legend" con sus regiones) la lista se mezcla.
El usuario quiere un nivel más: el juego, con su portada, y dentro sus mapas con el estilo actual.

Todo mapa pertenece a un juego. No existen mapas sueltos.
Los mapas guardados antes de esta spec se borran al actualizar: el usuario lo aceptó.

Esta spec toma el número 03. Los marcadores pasan a SPEC 04, como ya hizo SPEC 02.

## Alcance

**Dentro:**

- Store nuevo `games` en IndexedDB y campo `gameId` en cada mapa.
- Migración a esquema v2 que vacía `maps`, `images` y `markers`.
- Inicio (`#/`) con el hero de SPEC 02 y una cuadrícula de tarjetas de juego.
- Tarjeta de juego vertical 3:4 tipo carátula: portada recortada (`object-fit: cover`), nombre en pixel y nº de mapas.
- Juego sin portada: placeholder arcade con marco neón y la inicial del nombre.
- Crear juego con un diálogo propio: nombre obligatorio y portada opcional.
- Portada desde selector de archivo, arrastrando una imagen a la zona del diálogo o pegándola con Ctrl+V.
- Vista previa de la portada en el diálogo antes de guardar.
- Acciones de cada juego: renombrar, cambiar portada (también quitarla) y borrar.
- Borrar un juego borra también todos sus mapas, imágenes y marcadores, tras una confirmación con el nº de mapas.
- Vista de juego (`#/game/<id>`): cabecera con "← Juegos", portada pequeña, nombre en pixel neón, nº de mapas y "Cargar mapas".
- Debajo de la cabecera, la cuadrícula de mapas de SPEC 01/02 tal cual, filtrada por ese juego.
- Cargar mapas (selector y arrastrar) solo dentro de un juego.
- Visor: "← Biblioteca" pasa a "← Mapas" y vuelve al juego del mapa.
- Orden de juegos: último usado primero. Abrir el juego o uno de sus mapas cuenta como uso.
- Renumerar a SPEC 04 las menciones a "SPEC 03" como marcadores.
- Adaptar `tools/acceptance/spec-01.js` y `spec-02.js` a la nueva navegación y crear `tools/acceptance/spec-03.js`.

**Fuera de alcance (para specs futuras):**

- Descargar la portada desde una URL (rompe la regla "sin red" y CORS lo bloquea desde `file://`).
- Mover un mapa de un juego a otro.
- Mapas sin juego.
- Subcarpetas o juegos dentro de juegos.
- Pegar la portada directamente sobre una tarjeta, sin diálogo.
- Buscar o filtrar juegos.
- Orden manual de juegos o mapas.
- Recortar o encuadrar la portada a mano.
- Datos extra del juego (plataforma, año, progreso).
- Exportar e importar respaldos.
- Marcadores (SPEC 04).

## Modelo de datos

Base IndexedDB `waypoint`, esquema **v2**.

```js
// Store nuevo "games" — keyPath: "id"
const game = {
  id: "9a1d…",               // crypto.randomUUID()
  name: "The Final Fantasy Legend", // 1–100 caracteres tras trim; puede repetirse
  cover: Blob | null,         // WebP, lado mayor 600 px; null = placeholder
  createdAt: 1763600000000,   // epoch ms
  updatedAt: 1763600000000,   // epoch ms; cambia al renombrar o cambiar portada
  lastUsedAt: null,           // epoch ms | null; abrir el juego o uno de sus mapas
};

// Store "maps" — keyPath: "id", índice nuevo "gameId" (no único)
const map = {
  id: "b3f1c2e4-...",
  gameId: "9a1d…",            // obligatorio; el juego debe existir
  // ...resto de campos de SPEC 01 sin cambios
};

// "images" y "markers": sin cambios de forma.
```

Migración `MIGRATIONS[2]` en `js/data/db.js`:

- Vacía `maps`, `images` y `markers` (`clear()`).
- Crea el store `games`.
- Crea el índice `gameId` en `maps`.

Convenciones:

- Orden de juegos: `lastUsedAt` descendente; los nulos van después, por `createdAt` descendente.
- El orden de mapas dentro de un juego es el de SPEC 01.
- Abrir un mapa actualiza su `lastOpenedAt` y el `lastUsedAt` de su juego.
- Borrar un juego elimina en una sola transacción su registro en `games` y sus registros en `maps`, `images` y `markers`.
- El nº de mapas de cada juego se cuenta con el índice `gameId` (`count()`), sin leer los mapas.
- Portadas aceptadas: JPG, PNG y WebP, con las mismas reglas de validación que los mapas. Chrome pega del portapapeles como PNG.
- La portada original no se guarda: solo la versión WebP reducida.

## Archivos

Nuevos:

- `js/data/games-repository.js`: `add`, `list`, `get`, `update`, `remove` (en cascada) y `countMaps(gameId)`.
- `js/services/game-service.js`: `create(name, coverBlob)`, `listSorted()` (con nº de mapas), `get(id)`, `rename`, `setCover(id, blob | null)`, `remove`, `touch(id)` y la clase `GameNotFoundError`.
- `js/ui/game-dialog.js`: `Waypoint.ui.gameDialog.open({ mode, name, cover })` para "Crear juego" (nombre + portada) y "Cambiar portada" (solo portada). Devuelve `{ name, cover }` o `null` si se cancela.
- `js/ui/games-view.js`: inicio con hero, barra "Mapas" + "Crear juego", cuadrícula de tarjetas de juego y estado vacío.
- `css/games.css`: tarjeta de juego, placeholder, cabecera de la vista de juego y zona de portada del diálogo.
- `tools/acceptance/spec-03.js`.

Modificados:

- `js/data/db.js`: `DB_VERSION = 2`, store `games`, `MIGRATIONS[2]`.
- `js/data/maps-repository.js`: `listByGame(gameId)` por índice.
- `js/services/image-service.js`: `createCover(blob)` (WebP, lado mayor 600 px).
- `js/services/map-service.js`: `importFiles(gameId, files, onLargeImage)`, `listSorted(gameId)`; `open(id)` llama a `gameService.touch`.
- `js/core/router.js`: ruta `game` con `#/game/<id>`.
- `js/ui/library-view.js`: deja de ser el inicio; recibe `{ id }` del juego, monta la cabecera del juego encima de la cuadrícula de mapas y pierde el hero (pasa a `games-view.js`).
- `js/ui/viewer-view.js`: botón "← Mapas" hacia `#/game/<gameId>`.
- `js/app.js`: `#/` → `gamesView`, `#/game/<id>` → `libraryView`, `#/map/<id>` → `viewerView`.
- `index.html`: enlaza `games.css` y carga los scripts nuevos en orden de capa.
- `README.md`, `CLAUDE.md`, `specs/01-biblioteca-de-mapas.md`, `specs/02-tema-arcade-retro.md`, `js/data/db.js`: renumeración de marcadores a SPEC 04, rutas y modelo.
- `tools/acceptance/spec-01.js` y `spec-02.js`: crean un juego y trabajan dentro de `#/game/<id>`.

## Plan de implementación

1. Renumerar: los marcadores pasan de SPEC 03 a SPEC 04 en `README.md`, `specs/01-biblioteca-de-mapas.md`, `specs/02-tema-arcade-retro.md` y el comentario de `js/data/db.js`. Prueba manual: `grep "SPEC 03"` solo encuentra esta spec.
2. Esquema v2 en `js/data/db.js`: `DB_VERSION = 2` y `MIGRATIONS[2]` (vaciar `maps`, `images`, `markers`; crear `games`; índice `gameId` en `maps`). Prueba manual: con un perfil que tenga mapas de v1, DevTools → Application muestra `games` y los tres stores vacíos.
3. `js/data/games-repository.js` con `add`, `list`, `get`, `update`, `remove` en cascada y `countMaps`; `listByGame` en `maps-repository.js`. Cargarlo en `index.html`. Prueba manual: desde la consola, crear un juego, añadirle un mapa y borrarlo; los cuatro stores quedan vacíos.
4. `js/services/game-service.js` y `createCover` en `image-service.js`. Validación de nombre como en los mapas. Prueba manual: desde la consola, `create("Test", file)` guarda una portada WebP de lado mayor ≤ 600 px.
5. `map-service.js`: `importFiles` y `listSorted` reciben `gameId`; `importFiles` lanza `GameNotFoundError` si el juego no existe; `open` toca el juego. Prueba manual: importar un archivo en un juego desde la consola y verlo en `listSorted(gameId)`.
6. Router y `app.js`: ruta `#/game/<id>`. `#/` monta un `games-view.js` mínimo (lista de nombres) y `#/game/<id>` monta `library-view.js` filtrado por juego. Un `#/game/<id>` inexistente vuelve a `#/` con el aviso "Ese juego no existe". Prueba manual: cambiar el hash a mano entre las tres rutas.
7. `library-view.js` como vista de juego: cabecera con "← Juegos", portada pequeña o placeholder, nombre en pixel neón, nº de mapas y "Cargar mapas". Quitar el hero. Selector y arrastrar cargan en ese juego. Visor con "← Mapas" hacia su juego. Prueba manual: cargar dos mapas en un juego, abrir uno y volver.
8. `games-view.js` completo con `css/games.css`: hero de SPEC 02 (subtítulo "MI MAPA MI 100% _" con juegos, "CREA UN JUEGO PARA EMPEZAR _" sin juegos), barra "Mapas" con "Crear juego", tarjetas 3:4 con acento rotativo, nº de mapas y placeholder. Soltar archivos en el inicio no abre la imagen en la pestaña y avisa "Entra en un juego para cargar mapas". Prueba manual: tres juegos, uno sin portada; clic en una tarjeta abre su vista.
9. `js/ui/game-dialog.js` en modo "Crear juego": nombre (input mono) + zona de portada con "Elegir imagen", soltar y Ctrl+V, vista previa y "Quitar". Pegar algo que no es imagen avisa "El portapapeles no tiene una imagen: usa «Copiar imagen» en el navegador". Esc cancela. Conectar "Crear juego". Prueba manual: copiar una portada en Chrome, pegarla en el diálogo y crear el juego.
10. Acciones de la tarjeta de juego: "Renombrar" (`dialog.rename`), "Cambiar portada" (`gameDialog` en modo portada, permite quitarla) y "Borrar" (`dialog.confirm` con "Se borrarán N mapas"). Prueba manual: renombrar, cambiar portada, quitarla y borrar un juego con mapas.
11. Adaptar `tools/acceptance/spec-01.js` y `spec-02.js`: crean un juego por servicio, navegan a `#/game/<id>` y comprueban el hero en `#/`. Prueba manual: ambos pasan con un `WP_PROFILE` vacío.
12. Escribir `tools/acceptance/spec-03.js` con los criterios automatizables, incluido el pegado con un `ClipboardEvent` que lleva un `DataTransfer` con un PNG. Actualizar `README.md` (uso: crear juego, portada, cargar mapas dentro) y `CLAUDE.md` (rutas y stores). Prueba manual: los tres scripts pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] Con un perfil que tenía mapas de v1, al abrir la app la base está en versión 2, existe el store `games` y `maps`, `images` y `markers` están vacíos.
- [x] El store `maps` tiene el índice `gameId`.
- [x] Con cero juegos, `#/` muestra el hero con "CREA UN JUEGO PARA EMPEZAR _" y un botón "Crear juego".
- [x] Con al menos un juego, el subtítulo del hero es "MI MAPA MI 100% _".
- [x] `#/` no tiene botón "Cargar mapas" ni `input[type="file"]` para mapas.
- [x] Soltar una imagen en `#/` no crea mapas, no navega fuera de la app y muestra el aviso "Entra en un juego para cargar mapas".
- [x] El diálogo "Crear juego" no permite guardar con el nombre vacío o solo con espacios.
- [x] Crear un juego sin portada muestra una tarjeta con el placeholder y la inicial del nombre.
- [x] Elegir una imagen PNG de 2000×3000 como portada guarda en `games.cover` un Blob `image/webp` cuyo lado mayor es 600 px.
- [x] Pegar con Ctrl+V una imagen en el diálogo muestra su vista previa, y al guardar el juego tiene portada.
- [x] Pegar solo texto en el diálogo no cambia la vista previa y muestra el aviso del portapapeles.
- [x] Soltar una imagen en la zona de portada del diálogo muestra su vista previa.
- [x] Un archivo `.txt` como portada se rechaza con un aviso y no cambia la vista previa.
- [x] Pulsar Esc en el diálogo de juego lo cierra sin crear ni cambiar nada.
- [x] La tarjeta de juego tiene proporción 3:4 (alto / ancho = 1,33 ± 0,02) y la portada usa `object-fit: cover`.
- [x] La tarjeta muestra el nombre en Press Start 2P en mayúsculas y "N MAPAS" con el número real.
- [x] Cuatro tarjetas de juego consecutivas tienen los cuatro acentos neón en el orden de SPEC 02.
- [x] Clic en una tarjeta de juego abre `#/game/<id>`.
- [x] La vista de juego muestra "← Juegos", la portada (o el placeholder), el nombre del juego y "Cargar mapas".
- [x] Cargar 2 imágenes dentro de un juego crea 2 tarjetas de mapa y ambos registros de `maps` tienen ese `gameId`.
- [x] Los mapas de un juego no aparecen en la vista de otro juego.
- [x] Con un juego sin mapas, su vista muestra la zona de soltar de SPEC 01.
- [x] Abrir un mapa y pulsar "← Mapas" vuelve a `#/game/<id>` de su juego.
- [x] "← Juegos" y el botón atrás del navegador vuelven a `#/`.
- [x] Abrir un mapa del juego que estaba último lo pone primero en `#/`.
- [x] Renombrar un juego cambia el nombre en su tarjeta y en la cabecera de su vista.
- [x] Cambiar la portada de un juego la actualiza en la tarjeta; quitarla vuelve al placeholder.
- [x] Borrar un juego pide confirmación con su nº de mapas; "Cancelar" no borra nada.
- [x] Confirmar el borrado elimina el juego y todos sus registros en `maps`, `images` y `markers`, y no toca los de otros juegos.
- [x] Abrir `#/game/no-existe` vuelve a `#/` y muestra "Ese juego no existe".
- [x] Recargar (F5) en `#/game/<id>` reabre la misma vista de juego.
- [x] Tras cerrar Chrome, los juegos, sus portadas y sus mapas siguen ahí.
- [x] Ningún archivo de `js/ui/` usa `indexedDB` y ningún archivo de `js/data/` usa `document`.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` nuevo.
- [x] `tools/acceptance/spec-01.js`, `spec-02.js` y `spec-03.js` pasan con un `WP_PROFILE` vacío.
- [x] `grep "SPEC 03"` en `README.md`, `specs/01-*`, `specs/02-*` y `js/` no encuentra menciones a marcadores.

## Decisiones

- **Sí:** todo mapa pertenece a un juego. Modelo simple: una sola clase de tarjeta por pantalla. Decisión del usuario.
- **No:** mapas sueltos en el inicio. Mezclaría dos tipos de tarjeta.
- **Sí:** la migración v2 borra los mapas existentes. El usuario lo aceptó y evita inventar un juego "SIN JUEGO".
- **No:** carpeta automática "SIN JUEGO" para los mapas viejos. Innecesaria si se borran.
- **Sí:** cargar mapas solo dentro de un juego. Cada mapa nace con su `gameId` sin diálogos extra.
- **Sí:** portada pegada desde el portapapeles ("Copiar imagen" en el navegador + Ctrl+V). Funciona sin red y con `file://`.
- **No:** descargar la portada desde una URL. Rompe "sin red" y CORS lo bloquea desde `file://`.
- **Sí:** pegar solo dentro del diálogo de portada, con vista previa. Evita cambiar una portada sin querer.
- **No:** Ctrl+V sobre una tarjeta enfocada. Atajo con riesgo de pegados accidentales.
- **Sí:** portada opcional con placeholder arcade. Crear un juego no exige tener la imagen a mano.
- **Sí:** guardar la portada como WebP de lado mayor 600 px, sin la original. Solo se ve en tarjetas y cabecera; el inicio carga rápido.
- **No:** guardar la portada original. Varios MB por juego ralentizan el inicio sin ganancia visible.
- **Sí:** portada dentro del registro de `games`, no en un store aparte. Es pequeña y siempre se muestra al listar.
- **Sí:** tarjeta vertical 3:4 tipo carátula. Distingue juegos de mapas (horizontales).
- **Sí:** acciones renombrar, cambiar portada y borrar en cascada. Suficiente para gestionar carpetas.
- **No:** mover mapas entre juegos. Necesita un selector de juego; spec futura si hace falta.
- **Sí:** orden por último usado, contando la apertura de sus mapas. Coherente con SPEC 01: lo que se juega queda arriba.
- **No:** orden alfabético.
- **Sí:** cabecera compacta en la vista de juego y hero solo en el inicio. Los mapas quedan a la vista sin scroll.
- **Sí:** ruta `#/game/<id>` y `#/map/<id>` sin cambios. F5 y el botón atrás siguen funcionando; los enlaces a mapas no cambian.
- **Sí:** reutilizar `library-view.js` y sus clases (`.library`, `.map-card`) para la vista de juego. La cuadrícula de mapas se ve igual y los scripts de aceptación conservan sus selectores.
- **Sí:** nombres de juego repetidos permitidos. Igual que los mapas: el `id` identifica.
- **Sí:** contar mapas con `index.count()`. No carga miniaturas para pintar el inicio.
- **Sí:** esta spec es la 03 y los marcadores pasan a SPEC 04. Numeración secuencial sin huecos, como en SPEC 02.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración v2 borra mapas que el usuario sí quería | Aceptado por el usuario. El README avisa del borrado en la nota de la versión. |
| Copiar el enlace en vez de la imagen deja el portapapeles solo con texto | Aviso explícito con la instrucción "Copiar imagen". Criterio de aceptación dedicado. |
| Algunas webs no permiten "Copiar imagen" o copian un formato raro (AVIF, GIF) | Los formatos no admitidos se rechazan con aviso; queda subir el archivo o arrastrarlo. |
| Borrar un juego con muchos mapas falla a mitad | Una sola transacción sobre los cuatro stores: o se borra todo o nada. |
| Soltar una imagen en el inicio hace que Chrome abra el archivo y salga de la app | `preventDefault` en `dragover` y `drop` del inicio, con aviso. Criterio de aceptación dedicado. |
| Nombres de juego largos en pixel desbordan la tarjeta 3:4 o la cabecera | `overflow-wrap: anywhere` en la tarjeta y `text-overflow: ellipsis` en la cabecera. Probarlo en el paso 8 con 100 caracteres. |
| Muchos juegos con portada y object URLs sin liberar | `games-view.js` revoca todas las URLs de portada al desmontar y al volver a pintar. |
| Los scripts de aceptación de SPEC 01/02 dejan de pasar por el cambio de navegación | Adaptarlos en el paso 11 antes de escribir el de SPEC 03. |

## Qué **no** entra en esta spec

- Portada desde una URL.
- Mover mapas entre juegos.
- Mapas sin juego y subcarpetas.
- Pegar la portada sobre la tarjeta sin diálogo.
- Búsqueda, filtros u orden manual.
- Recorte manual de la portada.
- Datos extra del juego (plataforma, año, progreso).
- Exportar e importar respaldos.
- Marcadores (SPEC 04).

Cada una de estas, si llega, va en su propia spec.
