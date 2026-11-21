# SPEC 02 — Tema visual arcade retro

> **Estado:** Implementado
> 
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-20
> **Objetivo:** Sustituir el tema provisional por el estilo arcade retro ochentero de Arcade Vault (neón, fuente pixel, fondo con grid y scanlines) en todas las pantallas existentes de Waypoint.

## Por qué existe esta spec

SPEC 01 dejó un tema oscuro provisional tipo MapGenie y fijó que cambiarlo "solo toca los tokens".
El usuario quiere la identidad visual de su proyecto de curso Arcade Vault (`D:\SOFTWARE\PROGRAMACION\CURSOS\ClaudeCode\ClaudeCode\05-arcade-vault`).
La referencia es `app/globals.css` de ese proyecto, `components/home/FloatingSilhouettes.tsx` y las capturas compartidas (home, biblioteca, detalle).

Arcade Vault es Next.js + Tailwind con fuentes de Google vía `next/font`.
Waypoint no puede usar nada de eso: se porta solo el CSS, a mano, respetando `file://`, scripts clásicos y cero red.
El tema nuevo no cabe solo en los tokens: añade fuentes, capas de fondo, efectos y un hero.

Esta spec toma el número 02. Los marcadores pasan a SPEC 07.

## Alcance

**Dentro:**

- Paleta Arcade Vault en `css/tokens.css`: fondos `#0a0a0f`/`#0f0f18`/`#15151f`, texto `#e6e9ff`/`#8a8fb5`/`#4a4f70`, neón cian `#00f5ff`, magenta `#ff006e`, amarillo `#f5ff00`, verde `#00ff88`.
- Fuentes Press Start 2P (pixel) y JetBrains Mono (texto) copiadas en `vendor/fonts/` con su licencia OFL.
- Fondo fijo de la app: grid en perspectiva animado, scanlines, viñeta de color y ruido SVG.
- Texto neón (glow con `text-shadow`), parpadeo `flicker` del logo y cursor `_` parpadeante.
- Cabecera: marca diamante magenta/cian + "WAYPOINT" en pixel, fija arriba con desenfoque.
- Botones neón con esquinas cortadas (`clip-path`), doble borde interior y glow al pasar el ratón.
- Hero en la biblioteca: título "WAYPOINT" con degradado blanco → cian → magenta y subtítulo amarillo.
- Subtítulo del hero: "INSERTA UN MAPA _" con mapas; "CARGA UN MAPA PARA EMPEZAR _" con la biblioteca vacía.
- Ocho siluetas pixel flotando en el hero, copiadas de `FloatingSilhouettes.tsx`.
- Tarjetas de mapa: degradado de fondo, acento rotativo por posición (cian, magenta, amarillo, verde), hover con elevación, tilt 3D y glow.
- Nombres de mapa en fuente pixel y mayúsculas, en la tarjeta y en la barra del visor.
- Zona de soltar, superposición de arrastre y pantalla de error de almacenamiento con el tema.
- Diálogos (`<dialog>`) y avisos con el tema; cada tipo de aviso con su neón.
- Visor: barra superior y controles de zoom de Leaflet con el tema; la imagen del mapa sin efectos encima.
- `prefers-reduced-motion: reduce` detiene todas las animaciones y el tilt de las tarjetas.
- Renumerar a SPEC 03 las menciones a "SPEC 02" como marcadores en `README.md`, `specs/01-biblioteca-de-mapas.md` y `js/data/db.js`.
- Script de aceptación `tools/acceptance/spec-02.js`.

**Fuera de alcance (para specs futuras):**

- Páginas nuevas (home, salón de la fama) y enlaces de navegación en la cabecera.
- Contador decorativo tipo "CRÉDITOS".
- Interruptor en la app para apagar efectos.
- Scanlines, ruido o grid encima de la imagen del mapa.
- Siluetas temáticas de mapas (pin, cofre, brújula).
- Sonidos.
- Tema claro o selector de temas.
- Estilo de los marcadores (llega con SPEC 07).
- Arreglar los acentos que Press Start 2P no dibuja.

## Modelo de datos

Esta spec no introduce estructuras de datos ni toca IndexedDB.
Reutiliza el modelo de SPEC 01.

Lo nuevo son tokens CSS en `css/tokens.css`.
Se mantienen los nombres semánticos de SPEC 01 con valores nuevos, y se añaden estos:

```css
:root {
  /* Neón */
  --color-neon-cyan: #00f5ff;
  --color-neon-magenta: #ff006e;
  --color-neon-yellow: #f5ff00;
  --color-neon-green: #00ff88;

  /* Líneas */
  --color-line: rgba(0, 245, 255, 0.18);
  --color-line-soft: rgba(255, 255, 255, 0.06);

  /* Glow */
  --glow-cyan: 0 0 6px rgba(0, 245, 255, 0.65), 0 0 16px rgba(0, 245, 255, 0.45);
  /* ...uno por color neón */

  /* Tipografía */
  --font-pixel: "Press Start 2P", monospace;
  --font-mono: "JetBrains Mono", "Courier New", monospace;

  /* Forma */
  --clip-corner: 8px;
}
```

Convenciones:

- Los radios (`--radius-*`) pasan a `0`: el estilo arcade es de esquinas rectas o cortadas.
- Las tarjetas reciben su acento con una propiedad `--card-accent` asignada por `:nth-child(4n+k)`.
- Los tamaños de la fuente pixel se definen aparte (`--font-size-pixel-*`), porque Press Start 2P es mucho más ancha que una fuente normal.

## Archivos

Nuevos:

- `vendor/fonts/press-start-2p/PressStart2P-Regular.woff2` y `OFL.txt`.
- `vendor/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2`, `JetBrainsMono-Bold.woff2` y `OFL.txt`.
- `css/fonts.css`: `@font-face` de ambas fuentes con `font-display: swap`.
- `css/effects.css`: capas de fondo, texto neón, keyframes, siluetas y bloque `prefers-reduced-motion`.
- `js/ui/silhouettes.js`: registra `Waypoint.ui.silhouettes.create()`, que devuelve el contenedor con los ocho SVG (`aria-hidden="true"`).
- `tools/acceptance/spec-02.js`.

Modificados:

- `index.html`: enlaza `fonts.css` y `effects.css`, añade `<div class="app-bg">` y `<div class="app-noise">` y carga `silhouettes.js` antes de `library-view.js`.
- `css/tokens.css`, `css/base.css`, `css/library.css`, `css/viewer.css`, `css/dialog.css`.
- `js/ui/library-view.js`: monta el hero; "Biblioteca" pasa de `h1` a `h2`.
- `README.md`, `CLAUDE.md`, `specs/01-biblioteca-de-mapas.md`, `js/data/db.js`: renumeración y mención del tema.

## Plan de implementación

1. Renumerar: en `README.md`, `specs/01-biblioteca-de-mapas.md` y el comentario de `js/data/db.js`, los marcadores pasan de SPEC 02 a SPEC 03. En `CLAUDE.md`, "el tema es provisional" pasa a "tema arcade, SPEC 02". Prueba manual: `grep "SPEC 02"` solo encuentra esta spec.
2. Fuentes: descargar una vez Press Start 2P y JetBrains Mono de sus repositorios oficiales y copiarlas en `vendor/fonts/` con su `OFL.txt`. Crear `css/fonts.css` y enlazarlo en `index.html`. Prueba manual: en DevTools, `document.fonts.check('12px "Press Start 2P"')` devuelve `true` tras cargar.
3. Tokens: poner la paleta, las fuentes, los radios a `0` y los tokens nuevos en `css/tokens.css`. `body` usa `--font-mono`. Prueba manual: la app se ve en negro azulado con texto mono y sin errores.
4. Fondo: crear `css/effects.css` con `.app-bg` (degradados, grid en perspectiva con `gridscroll`, scanlines) y `.app-noise`. Añadir los dos `div` a `index.html` y el bloque `prefers-reduced-motion`. Prueba manual: el grid se desplaza; con "reducir movimiento" en DevTools → Rendering se queda quieto.
5. Cabecera: marca diamante, "WAYPOINT" en pixel con neón y `flicker`, `position: sticky` con `backdrop-filter`. Prueba manual: la cabecera queda fija al hacer scroll en la biblioteca.
6. Botones y campos: `.btn` neón con `clip-path`, `::before` de doble borde y variantes `--primary` (cian), `--danger` (magenta) y `--ghost`. `:focus-visible` con contorno neón. Inputs en `--font-mono` con borde cian al enfocar. Prueba manual: tabular por la biblioteca muestra el foco en cada botón.
7. Hero: crear `js/ui/silhouettes.js` con los ocho SVG de `FloatingSilhouettes.tsx`. En `library-view.js`, montar el hero sobre la barra con el título, el subtítulo y las siluetas; el subtítulo cambia con la biblioteca vacía. Estilos en `library.css` y animación `float` en `effects.css`. Prueba manual: con y sin mapas se ve el subtítulo correcto; soltar un archivo sobre una silueta lo carga.
8. Tarjetas: fondo en degradado, `--card-accent` rotativo, etiqueta y acciones con el acento, nombre en pixel y mayúsculas, hover con `translateY(-6px) rotateX(2deg) rotateY(-2deg)` y glow cian. Prueba manual: cuatro tarjetas seguidas muestran cuatro acentos distintos.
9. Estados de la biblioteca: zona de soltar, superposición de arrastre y pantalla de error de almacenamiento con bordes neón y textos en pixel. Prueba manual: arrastrar un archivo muestra la superposición con el tema.
10. Diálogos y avisos: `<dialog>` con fondo `--color-surface`, borde cian, `clip-path` y `::backdrop` oscuro. El input de renombrar usa `--font-mono`. Avisos con borde lateral neón: info cian, éxito verde, advertencia amarillo, error magenta. Prueba manual: renombrar un mapa y lanzar un aviso de cada tipo desde la consola.
11. Visor: barra superior con el tema y nombre en pixel. Controles de zoom de Leaflet (`.leaflet-bar a`) con fondo `--color-bg-2`, borde cian y glow al pasar el ratón. El escenario es opaco y tapa las capas de fondo. Prueba manual: abrir un mapa; la imagen se ve sin scanlines y los botones + y − tienen el tema.
12. Escribir `tools/acceptance/spec-02.js` con las comprobaciones de los criterios automatizables, incluida la emulación de `prefers-reduced-motion` con `window.cdpInput` y `Emulation.setEmulatedMedia`. Prueba manual: el script y `tools/acceptance/spec-01.js` pasan con un `WP_PROFILE` vacío.

## Criterios de aceptación

- [x] Abrir `index.html` con doble clic carga la app sin errores en consola y sin peticiones de red externas.
- [x] `document.fonts.check('12px "Press Start 2P"')` y `document.fonts.check('12px "JetBrains Mono"')` devuelven `true`, y ambas fuentes se sirven desde `vendor/fonts/`.
- [x] El fondo computado de `body` es `rgb(10, 10, 15)`.
- [x] `.app-bg` y `.app-noise` existen, son `position: fixed` y tienen `pointer-events: none`.
- [x] El grid del fondo tiene la animación `gridscroll` en marcha.
- [x] La cabecera muestra la marca diamante y "WAYPOINT" en Press Start 2P con `text-shadow` neón.
- [x] La cabecera sigue visible arriba tras hacer scroll en una biblioteca con 12 mapas.
- [x] Con al menos un mapa, el hero muestra "WAYPOINT" y "INSERTA UN MAPA _".
- [x] Con la biblioteca vacía, el subtítulo del hero es "CARGA UN MAPA PARA EMPEZAR _".
- [x] El hero contiene 8 siluetas SVG dentro de un contenedor con `aria-hidden="true"` y `pointer-events: none`.
- [x] Soltar una imagen sobre una silueta crea su tarjeta.
- [x] Cuatro tarjetas consecutivas tienen como `--card-accent` los cuatro neones (cian, magenta, amarillo, verde) en ese orden.
- [x] Al pasar el ratón sobre una tarjeta, su `transform` deja de ser `none` y su `box-shadow` incluye cian.
- [x] El nombre del mapa en la tarjeta y en la barra del visor usa Press Start 2P con `text-transform: uppercase`.
- [x] El input del diálogo de renombrar usa JetBrains Mono.
- [x] Todo `.btn` tiene `clip-path` con un `polygon`.
- [x] Cada tipo de aviso (info, éxito, advertencia, error) tiene su color neón en el borde.
- [x] En el visor, `document.elementFromPoint` en el centro del escenario devuelve un elemento de Leaflet, no una capa de efectos.
- [x] Los botones de zoom de Leaflet no tienen fondo blanco.
- [x] Con `prefers-reduced-motion: reduce` emulado, el grid, las siluetas, el `flicker` y el cursor tienen `animation-name: none`.
- [x] Con `prefers-reduced-motion: reduce` emulado, una tarjeta con hover tiene `transform: none`.
- [x] `tools/acceptance/spec-01.js` sigue pasando con un `WP_PROFILE` vacío.
- [x] `tools/acceptance/spec-02.js` pasa con un `WP_PROFILE` vacío.
- [x] Fuera de `css/tokens.css` no aparece ningún color hexadecimal ni `rgb()` literal, salvo los `fill` de los SVG de `silhouettes.js` y el ruido SVG de `effects.css`.
- [x] `grep "SPEC 02"` en `README.md`, `specs/01-biblioteca-de-mapas.md` y `js/` no encuentra menciones a marcadores.

## Decisiones

- **Sí:** portar el CSS de Arcade Vault a mano. Waypoint no tiene Tailwind ni compilación.
- **No:** Tailwind ni `next/font`. Rompen `file://` y la regla de cero dependencias de build.
- **Sí:** fuentes copiadas en `vendor/fonts/`. Cumple "nada de CDN" y funciona sin internet.
- **No:** Google Fonts por CDN. Prohibido por `CLAUDE.md`.
- **No:** Courier Prime. Arcade Vault la usa solo como respaldo de JetBrains Mono; `Courier New` del sistema basta.
- **Sí:** mantener los nombres semánticos de los tokens de SPEC 01 con valores nuevos. Los CSS existentes siguen funcionando y el cambio es incremental.
- **Sí:** los efectos viven en `css/effects.css`. El tema ya no cabe solo en los tokens, como preveía SPEC 01.
- **Sí:** reskin + hero en la biblioteca. Da la identidad de Arcade Vault sin páginas nuevas.
- **No:** enlaces de navegación ni contador de créditos. Waypoint solo tiene dos rutas y el contador no tendría significado.
- **Sí:** fuente pixel también en los nombres de mapa, como en Arcade Vault. Decisión del usuario, aceptando acentos imperfectos.
- **No:** limitar la fuente pixel a textos fijos. Era la recomendación para no romper acentos; el usuario prefirió la fidelidad al estilo.
- **Sí:** el input de renombrar en JetBrains Mono. Escribir en Press Start 2P es ilegible y el texto escrito debe verse exacto.
- **Sí:** visor con el mapa limpio. Scanlines o ruido encima ensucian la imagen, que es lo que el usuario mira.
- **No:** scanlines suaves sobre el mapa. Necesitarían un interruptor, que queda fuera.
- **Sí:** siluetas de Arcade Vault copiadas tal cual. Decisión del usuario.
- **No:** siluetas temáticas de mapas. Posible spec futura.
- **Sí:** acento rotativo en las tarjetas. Es el rasgo más visible de la biblioteca de Arcade Vault.
- **Sí:** respetar `prefers-reduced-motion`. Arcade Vault no lo hace; Waypoint ya lo hacía en `dialog.css`.
- **No:** interruptor de efectos en la app. Necesita persistencia y UI; va en otra spec si hace falta.
- **Sí:** esta spec es la 02 y los marcadores pasan a SPEC 07. Numeración secuencial sin huecos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Press Start 2P no dibuja bien vocales acentuadas en mayúsculas ("Caída" → "CAıDA") | Aceptado por el usuario. Si molesta, una spec futura quita el `uppercase` de los nombres o usa otra fuente pixel. |
| Nombres largos en pixel desbordan la tarjeta o la barra del visor | `overflow-wrap: anywhere` en la tarjeta y `text-overflow: ellipsis` en la barra. Comprobarlo en el paso 8 con un nombre de 100 caracteres. |
| Grid animado, `backdrop-filter` y ruido a pantalla completa consumen GPU | Las capas son `position: fixed` y solo animan `background-position`. El visor las tapa con un escenario opaco. |
| El tilt 3D de las tarjetas descoloca las acciones (renombrar, borrar) al pasar el ratón | Mantener las acciones dentro de la tarjeta y comprobar en el paso 8 que siguen siendo clicables. |
| Las capas de fondo o las siluetas bloquean el arrastrar y soltar | `pointer-events: none` en todas, verificado por un criterio de aceptación. |
| Contraste bajo del texto atenuado (`#4a4f70`) sobre el fondo | Usarlo solo en textos secundarios no esenciales; los textos de estado usan `#8a8fb5` o superior. |
| Descargar las fuentes desde una copia no oficial trae una licencia distinta | Copiar solo de los repositorios oficiales e incluir `OFL.txt` junto a cada fuente. |

## Qué **no** entra en esta spec

- Páginas nuevas, navegación en la cabecera y contador de créditos.
- Interruptor de efectos en la app.
- Efectos encima de la imagen del mapa.
- Siluetas temáticas de mapas.
- Sonidos.
- Tema claro o selector de temas.
- Estilo de marcadores (SPEC 07).
- Arreglo de los acentos de Press Start 2P.

Cada una de estas, si llega, va en su propia spec.
