# Waypoint

App web local para seguir tu progreso en videojuegos sobre sus mapas grandes.
Creas una carpeta por juego (con su portada), cargas dentro las imágenes de sus mapas, se guardan en tu navegador y las abres con zoom y arrastre.

> Estado: **SPEC 09** (juegos con portada, biblioteca de mapas en orden alfabético y visor con zoom fluido, panel lateral plegable con selector de mapas, controles de vista, pines sobre el mapa y pines encontrados con filtro, con tema visual arcade retro). Editar pines llega en una spec futura.
>
> **Aviso de la versión SPEC 03:** al actualizar desde la versión anterior, los mapas que ya tenías guardados se **borran** (ahora todo mapa pertenece a un juego). Si quieres conservar alguno, vuelve a cargarlo dentro de un juego.

## Requisitos

- **Chrome o Edge** (Chromium). Firefox y Safari no están soportados.
- Nada más: sin instalación, sin servidor y sin conexión a internet.

## Cómo abrirla

Haz doble clic en `index.html`. Se abre en el navegador desde el disco (`file://`).

Si Windows lo abre con otro navegador: clic derecho → *Abrir con* → Chrome o Edge.

## Uso

### Juegos (inicio)

El inicio muestra una tarjeta por juego, tipo carátula. Los mapas siempre están dentro de un juego.

- **Crear juego**: botón *Crear juego*. El nombre es obligatorio (hasta 100 caracteres, puede repetirse) y la portada es opcional.
- **Portada**: elige un archivo (*Elegir imagen*), arrastra una imagen al diálogo o pégala con **Ctrl+V**. Verás una vista previa antes de guardar y puedes quitarla con *Quitar*.
  - Para pegar desde internet: clic derecho en la imagen → *Copiar imagen* (no «Copiar dirección de la imagen») y **Ctrl+V** en el diálogo.
  - Formatos: JPG, PNG y WebP. Se guarda una versión reducida (lado mayor 600 px); la original no se conserva.
  - Sin portada, la tarjeta muestra un recuadro neón con la inicial del nombre.
- **Orden**: el último juego usado va primero. Abrir un juego o uno de sus mapas cuenta como usarlo.
- **Renombrar**, **cambiar portada** (también quitarla) y **borrar**: iconos en la esquina de la tarjeta. Borrar un juego **borra también todos sus mapas** y pide confirmación con el número de mapas; no se puede deshacer.
- Soltar imágenes en el inicio no las carga: avisa «Entra en un juego para cargar mapas».
- La dirección de un juego (`#/game/<id>`) es estable: recargar (F5) reabre el mismo juego.

### Mapas de un juego

Al abrir un juego ves su cabecera (**← Juegos**, portada, nombre y número de mapas) y la cuadrícula de sus mapas.

- **Cargar mapas**: botón *Cargar mapas* (o *Elegir archivos* con el juego vacío), o arrastra las imágenes sobre la ventana. Puedes cargar varias a la vez, siempre dentro del juego abierto.
- **Formatos**: JPG, PNG y WebP. Los demás archivos se saltan con un aviso.
- **Imágenes muy grandes** (más de 16384 px de lado o más de 100 MB): se pregunta antes de guardarlas, porque pueden ir lentas. *Continuar* la guarda; *Cancelar* la salta.
- **Nombre**: por defecto el del archivo sin extensión. Puede repetirse.
- **Orden**: alfabético por nombre (sin distinguir mayúsculas ni acentos).
- **Renombrar**: icono del lápiz en la tarjeta. El nombre no puede quedar vacío.
- **Borrar**: icono de la papelera. Pide confirmación y no se puede deshacer.
- En cualquier diálogo, **Esc** cancela sin cambios.

### Visor

- Clic en una tarjeta para abrir el mapa a pantalla completa, ajustado a la ventana.
- **Panel lateral**: arriba a la izquierda, encima del mapa, con **← Mapas**, el nombre del juego y el nombre del mapa. Ocupa media ventana de alto y tapa esa parte del mapa.
  - Al entrar en un mapa está **plegado**: solo se ve la pestaña **▶** en el borde izquierdo. Púlsala para abrirlo; **◀** lo vuelve a plegar. Plegarlo o abrirlo no mueve ni cambia el zoom del mapa.
  - **Selector de mapas**: si el juego tiene 2 o más mapas, el nombre del mapa lleva un chevron y es un desplegable con los mapas del juego (miniatura y nombre, en orden alfabético). El mapa abierto aparece resaltado; elegir otro lo abre sin volver a la biblioteca (**Atrás** vuelve al anterior). Se cierra con otro clic en el nombre, **Esc**, clic fuera o al plegar el panel.
  - La rueda y el arrastre sobre el panel no mueven el mapa.
- **Rueda del ratón**: zoom continuo hacia el punto bajo el cursor. Cada clic de rueda acerca o aleja un poco (hacen falta 3 clics para doblar el tamaño).
- **Touchpad**: deslizar con dos dedos o pellizcar hace zoom del mapa (no de la página).
- **Botones + / −** y **doble clic**: un paso de zoom (el doble o la mitad).
- **Rango de zoom**: desde 1/4 de "mapa entero visible" hasta 4× el tamaño real.
- **Botones de vista** (abajo a la derecha, encima de + / −, cada uno en su propia caja):
  - **Pin con +**: añade un pin (ver *Pines*).
  - **Pantalla completa**: la app ocupa todo el monitor, sin la interfaz del navegador. En ella solo se ven el mapa y los botones: el panel lateral se oculta y vuelve como estaba al salir. Se sale con el mismo botón o con **Esc**. Salir del mapa también sale de pantalla completa.
  - **1:1 / ajustar**: un solo botón. Muestra **1:1** y pone el mapa a tamaño real, manteniendo el punto que estaba en el centro. Con el mapa a tamaño real cambia a un recuadro, y al pulsarlo deja el mapa entero visible y centrado. Si haces zoom con la rueda, vuelve a mostrar **1:1**.
- **Arrastrar**: mueve el mapa. Puede salir de la ventana por cualquier borde, pero siempre queda un trozo visible (100 px) para no perderlo.
- Con **reducir movimiento** activado, la rueda, 1:1 y ajustar saltan a la vista final sin animar.
- **← Mapas** (vuelve al juego del mapa) o el botón atrás del navegador para volver.
- La dirección (`#/map/<id>`) es estable: recargar (F5) reabre el mismo mapa.

### Pines

Marcas sobre el mapa con un icono, un color, un nombre y una nota. Se guardan en el mapa, en el sitio exacto de la imagen: no cambian de tamaño en pantalla al hacer zoom.

- **Añadir**: botón **pin con +**. A la derecha se abre el panel *Añadir pin* y cae un pin borrador en el centro de la zona libre del mapa (nunca encima de otro pin: si lo taparía, cae al lado). Mientras está abierto, los botones de vista y + / − se ocultan; el mapa se sigue moviendo y haciendo zoom.
  - **Colocarlo**: arrástralo, o haz clic en el mapa para llevarlo a ese punto. No puede salir de la imagen.
  - **Nombre** (hasta 60 caracteres) y **Nota** (hasta 500, admite varias líneas). Sin nombre, se usa el del icono.
  - **Color**: 8 opciones (dorado, blanco, negro, rojo, naranja, verde, cian y violeta).
  - **Icono**: abre al lado el selector con 54 iconos en 8 categorías plegables (Por defecto, Localizaciones, Enemigos, Tesoros, Equipo, Misiones, Información y Viaje; "Por defecto" es una mano que señala) y la barra de **tamaño** (20–64 px). Los cambios se ven al momento en el borrador. *Listo* o **Esc** lo cierran.
  - **Último usado**: el icono y el color del último pin guardado en cualquier mapa del juego. El borrador ya cae con ellos; el botón los vuelve a aplicar. El tamaño empieza siempre en 32 px.
  - **Guardar** lo deja en el mapa. **Cancelar** o **Esc** lo descartan.
- **Ver**: pasa el ratón por un pin para ver su nombre; haz clic para ver nombre, nota y *Borrar*. El popup se cierra con su ×, **Esc** o un clic en el mapa.
- **Mover**: mantén pulsado un pin y arrástralo; se guarda al soltar. También funciona con el panel *Añadir pin* abierto (ahí, un clic sin arrastrar sobre un pin lleva el borrador a ese punto).
- **Borrar**: *Borrar* en su popup; pide confirmación y no se puede deshacer. Borrar un mapa o un juego borra también sus pines.
- **Encontrados**: en el popup de un pin, el botón con un **ojo** (arriba a la derecha) lo marca como encontrado: el pin queda translúcido al momento y el ojo se muestra tachado. Púlsalo otra vez para volver a marcarlo como pendiente. Se guarda en el navegador.
- **Filtro de pines**: en el panel lateral, bajo el nombre del juego, dos botones con icono: **Pendientes** y **Encontrados**. Cada uno muestra u oculta los pines de ese tipo (un icono tachado = ocultos); con los dos activos se ven todos, con solo **Encontrados** ves únicamente los ya hallados, y con los dos apagados no se ve ninguno. El filtro se guarda por mapa. Si marcas un pin con su filtro oculto, el pin desaparece al cerrar su popup.
- El popup tiene también un botón **Editar**, todavía sin función: editar pines llega en una spec futura.

### Aspecto

- Tema arcade retro: neón, letra pixel, fondo con grid en movimiento y scanlines.
- Cada tarjeta de juego y de mapa lleva un color de acento (cian, magenta, amarillo, verde, por turnos). Los nombres se ven en mayúsculas.
- En el visor, la imagen del mapa se ve limpia, sin efectos encima.
- Si tienes activado **reducir movimiento** en Windows (*Configuración → Accesibilidad → Efectos visuales → Efectos de animación*, desactivado), la app no anima nada.
- La letra pixel no dibuja bien algunas vocales acentuadas en mayúsculas (la "Í" sale como "ı"). El nombre guardado no cambia: solo es cómo se ve.

## Dónde se guardan tus juegos y mapas

Todo se guarda **en el navegador** (IndexedDB), en este equipo. No se sube nada a ningún sitio.

Ten en cuenta:

- **Borrar los datos de navegación** de Chrome/Edge (cookies y datos de sitios) **borra tus juegos, portadas, mapas y pines**. Aún no hay exportar/importar copias de seguridad.
- Los datos son **de ese navegador y ese perfil**: Chrome y Edge, o dos perfiles de Chrome, tienen bibliotecas separadas.
- Puedes **mover o renombrar la carpeta** del proyecto: los datos no dependen de la ruta.
- Una ventana de **incógnito** no ve tu biblioteca y la pierde al cerrarse.
- La app pide al navegador *almacenamiento persistente* para reducir el riesgo de que lo borre por falta de espacio. Si el disco se llena, verás el aviso "Sin espacio de almacenamiento".

## Estructura del proyecto

```
index.html     punto de entrada
css/           estilos (colores en css/tokens.css, efectos arcade en css/effects.css)
js/            código de la app (core, data, services, ui)
vendor/        Leaflet 1.9.4 y fuentes, copiados para funcionar sin internet
specs/         especificaciones de cada fase
```

La documentación técnica está en [`CLAUDE.md`](CLAUDE.md) y las especificaciones en [`specs/`](specs/).

## Próximamente

- Editar pines guardados (nombre, nota y estilo), filtros por categoría y contador de encontrados.
- Ideas para después: categorías con color, rutas, exportar/importar copias de seguridad, tiles para imágenes gigantes.

## Créditos

- [Leaflet](https://leafletjs.com/) 1.9.4: licencia BSD-2-Clause (`vendor/leaflet/LICENSE`).
- [Press Start 2P](https://github.com/google/fonts/tree/main/ofl/pressstart2p): SIL Open Font License 1.1 (`vendor/fonts/press-start-2p/OFL.txt`). Convertida de TTF a WOFF2 sin cambios en los glifos.
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono): SIL Open Font License 1.1 (`vendor/fonts/jetbrains-mono/OFL.txt`).
