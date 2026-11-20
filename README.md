# Waypoint

App web local para seguir tu progreso en videojuegos sobre sus mapas grandes.
Cargas las imágenes de los mapas, se guardan en tu navegador y las abres con zoom y arrastre.

> Estado: **SPEC 02** (biblioteca de mapas y visor, con tema visual arcade retro). Los marcadores marcables como hechos llegan en SPEC 03.

## Requisitos

- **Chrome o Edge** (Chromium). Firefox y Safari no están soportados.
- Nada más: sin instalación, sin servidor y sin conexión a internet.

## Cómo abrirla

Haz doble clic en `index.html`. Se abre en el navegador desde el disco (`file://`).

Si Windows lo abre con otro navegador: clic derecho → *Abrir con* → Chrome o Edge.

## Uso

### Biblioteca

- **Cargar mapas**: botón *Cargar mapas* (o *Elegir archivos* con la biblioteca vacía), o arrastra las imágenes sobre la ventana. Puedes cargar varias a la vez.
- **Formatos**: JPG, PNG y WebP. Los demás archivos se saltan con un aviso.
- **Imágenes muy grandes** (más de 16384 px de lado o más de 100 MB): se pregunta antes de guardarlas, porque pueden ir lentas. *Continuar* la guarda; *Cancelar* la salta.
- **Nombre**: por defecto el del archivo sin extensión. Puede repetirse.
- **Orden**: el último mapa abierto va primero; los que nunca abriste, después, del más nuevo al más antiguo.
- **Renombrar**: icono del lápiz en la tarjeta. El nombre no puede quedar vacío.
- **Borrar**: icono de la papelera. Pide confirmación y no se puede deshacer.
- En cualquier diálogo, **Esc** cancela sin cambios.

### Visor

- Clic en una tarjeta para abrir el mapa a pantalla completa, ajustado a la ventana.
- **Rueda del ratón**: zoom, desde "mapa entero visible" hasta 4× el tamaño real. También con los botones **+** / **−**.
- **Arrastrar**: mueve el mapa. No se puede sacar de la vista.
- **← Biblioteca** o el botón atrás del navegador para volver.
- La dirección (`#/map/<id>`) es estable: recargar (F5) reabre el mismo mapa.

### Aspecto

- Tema arcade retro: neón, letra pixel, fondo con grid en movimiento y scanlines.
- Cada tarjeta de mapa lleva un color de acento (cian, magenta, amarillo, verde, por turnos). Los nombres se ven en mayúsculas.
- En el visor, la imagen del mapa se ve limpia, sin efectos encima.
- Si tienes activado **reducir movimiento** en Windows (*Configuración → Accesibilidad → Efectos visuales → Efectos de animación*, desactivado), la app no anima nada.
- La letra pixel no dibuja bien algunas vocales acentuadas en mayúsculas (la "Í" sale como "ı"). El nombre guardado no cambia: solo es cómo se ve.

## Dónde se guardan tus mapas

Todo se guarda **en el navegador** (IndexedDB), en este equipo. No se sube nada a ningún sitio.

Ten en cuenta:

- **Borrar los datos de navegación** de Chrome/Edge (cookies y datos de sitios) **borra tus mapas**. Aún no hay exportar/importar copias de seguridad.
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

- **SPEC 03**: marcadores sobre el mapa, marcables como hechos.
- Ideas para después: categorías con color, rutas, exportar/importar copias de seguridad, tiles para imágenes gigantes.

## Créditos

- [Leaflet](https://leafletjs.com/) 1.9.4: licencia BSD-2-Clause (`vendor/leaflet/LICENSE`).
- [Press Start 2P](https://github.com/google/fonts/tree/main/ofl/pressstart2p): SIL Open Font License 1.1 (`vendor/fonts/press-start-2p/OFL.txt`). Convertida de TTF a WOFF2 sin cambios en los glifos.
- [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono): SIL Open Font License 1.1 (`vendor/fonts/jetbrains-mono/OFL.txt`).
