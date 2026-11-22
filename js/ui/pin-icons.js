/*
 * Catálogo de iconos de pin (SPEC 08): 7 categorías y 53 iconos, con etiqueta y glifo SVG propio.
 * Dibujados para Waypoint (silueta sencilla, legible a 20 px); no se copian de ningún otro sitio.
 *
 *   pinIcons.CATEGORIES      [{ id, label, icons: [{ id, label }] }]
 *   pinIcons.label(iconId)   "Cueva"; desconocido → etiqueta de "question"
 *   pinIcons.svg(iconId)     texto <svg>; desconocido → glifo de "question"
 *
 * Cada glifo vive en un viewBox de 24×24:
 *   - `body`: una o varias rutas que se pintan con el color del pin (fill="currentColor").
 *     Cada ruta lleva contorno por fuera (paint-order: stroke); varias rutas se solapan
 *     en orden, y el contorno de la de encima separa las piezas.
 *   - `detail`: huecos y rasgos (ventanas, ojos…) pintados con el color del contorno.
 *     Usa fill-rule evenodd: un subtrazo dentro de otro vuelve a dejar ver el cuerpo.
 * Ni el contorno ni los detalles llevan color propio: css/pins.css los toma de los tokens.
 */
(function (Waypoint) {
  "use strict";

  var FALLBACK = "question";

  var CATEGORIES = [
    {
      id: "locations",
      label: "Localizaciones",
      icons: [
        { id: "cave", label: "Cueva" },
        { id: "dungeon", label: "Mazmorra" },
        { id: "town", label: "Ciudad" },
        { id: "castle", label: "Castillo" },
        { id: "shrine", label: "Santuario" },
        { id: "camp", label: "Campamento" },
        { id: "tower", label: "Torre" },
        { id: "save-point", label: "Punto de guardado" },
        { id: "viewpoint", label: "Mirador" },
      ],
    },
    {
      id: "enemies",
      label: "Enemigos",
      icons: [
        { id: "boss", label: "Jefe" },
        { id: "elite", label: "Enemigo fuerte" },
        { id: "battle", label: "Batalla" },
        { id: "beast", label: "Bestia" },
        { id: "undead", label: "No muerto" },
        { id: "hostile-npc", label: "Hostil" },
        { id: "nest", label: "Guarida" },
        { id: "sniper", label: "Francotirador" },
      ],
    },
    {
      id: "treasures",
      label: "Tesoros",
      icons: [
        { id: "chest", label: "Cofre" },
        { id: "item", label: "Objeto" },
        { id: "key", label: "Llave" },
        { id: "gem", label: "Gema" },
        { id: "coin", label: "Dinero" },
        { id: "collectible", label: "Coleccionable" },
        { id: "easter-egg", label: "Easter egg" },
      ],
    },
    {
      id: "gear",
      label: "Equipo",
      icons: [
        { id: "weapon", label: "Arma" },
        { id: "armor", label: "Armadura" },
        { id: "potion", label: "Poción" },
        { id: "medicine", label: "Medicina" },
        { id: "upgrade", label: "Mejora" },
        { id: "resource", label: "Recurso" },
      ],
    },
    {
      id: "quests",
      label: "Misiones",
      icons: [
        { id: "quest", label: "Misión principal" },
        { id: "side-quest", label: "Misión secundaria" },
        { id: "npc", label: "Personaje" },
        { id: "shop", label: "Compras" },
        { id: "minigame", label: "Minijuego" },
        { id: "puzzle", label: "Acertijo" },
      ],
    },
    {
      id: "info",
      label: "Información",
      icons: [
        { id: "exclamation", label: "Aviso" },
        { id: "question", label: "Misterio" },
        { id: "note", label: "Nota" },
        { id: "danger", label: "Peligro" },
        { id: "star", label: "Destacado" },
        { id: "search", label: "Buscar" },
        { id: "check", label: "Hecho" },
        { id: "cancel", label: "Descartado" },
      ],
    },
    {
      id: "travel",
      label: "Viaje",
      icons: [
        { id: "door", label: "Puerta" },
        { id: "exit", label: "Salida" },
        { id: "fast-travel", label: "Viaje rápido" },
        { id: "vehicle", label: "Vehículo" },
        { id: "motorcycle", label: "Moto" },
        { id: "boat", label: "Barco" },
        { id: "garage", label: "Taller" },
        { id: "stairs", label: "Escaleras" },
        { id: "portal", label: "Portal" },
      ],
    },
  ];

  // Glifos: { body: string | string[], detail?: string }, uno por icono del catálogo.
  var GLYPHS = {
    /* --- Localizaciones --- */

    // Montaña de roca con la boca de la cueva.
    cave: {
      body: "M1 21L7 8l3 3 4-7 9 17z",
      detail: "M7.5 21v-4a4.5 4.5 0 0 1 9 0v4z",
    },
    // Portada de piedra con un rastrillo (barrotes) en el arco.
    dungeon: {
      body: "M2 22V10l10-7 10 7v12z",
      detail: "M6.5 22v-8a5.5 5.5 0 0 1 11 0v8z M9.4 22v-10h1.4v10z M13.2 22v-10h1.4v10z M6.5 16h11v1.2h-11z",
    },
    // Dos casas con tejado, puertas y ventana.
    town: {
      body: "M1 22V12l5-5 4 4V9l6.5-6L23 9v13z",
      detail: "M4.5 22v-4h3v4z M14.5 22v-5h4v5z M14.5 10h4v3.5h-4z",
    },
    // Dos torres almenadas unidas por la muralla, con puerta.
    castle: {
      body: "M2 22V4h2v2h1.5V4h2v2H9V4h2v6h2V4h2v2h1.5V4h2v2H20V4h2v18z",
      detail: "M9 22v-5a3 3 0 0 1 6 0v5z M4.5 10h2v3.5h-2z M17.5 10h2v3.5h-2z",
    },
    // Puerta torii.
    shrine: {
      body: "M1 2.5h22V6h-3.5v2.5h1V11h-1.5v11H16V11H8v11H5V11H3.5V8.5h1V6H1z",
      detail: "M7.5 6h9v2.5h-9z",
    },
    // Tienda de campaña con su entrada.
    camp: {
      body: "M12 2.5L23 21H1z",
      detail: "M12 10l4.5 11h-9z",
    },
    // Torre de vigía almenada, ventana y puerta.
    tower: {
      body: "M7 22l1-12H5.5V3H8v2h2V3h4v2h2V3h2.5v7H16l1 12z",
      detail: "M11 11.5h2v3.5h-2z M9.8 22v-3a2.2 2.2 0 0 1 4.4 0v3z",
    },
    // Disquete.
    "save-point": {
      body: "M2.5 2.5h15l4 4v15h-19z",
      detail: "M6.5 2.5h9v6.5h-9z M12.2 3.6h2v4.3h-2z M6 13h12v8.5H6z M7.5 15h9v.9h-9z M7.5 17.5h9v.9h-9z",
    },

    // Ojo (punto de vista).
    viewpoint: {
      body: "M1 12c2.8-4.9 6.6-7.4 11-7.4S20.2 7.1 23 12c-2.8 4.9-6.6 7.4-11 7.4S3.8 16.9 1 12z",
      detail: "M12 7.1a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 1 0 0-9.8z M12 9.1a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 1 1 0-5.8z M12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 1 0 0-2.8z",
    },

    /* --- Enemigos --- */

    // Calavera con corona.
    boss: {
      body: [
        "M12 8c-5 0-8.5 3.2-8.5 7.2 0 2 .9 3.3 2.2 4.1V22.5h12.6v-3.2c1.3-.8 2.2-2.1 2.2-4.1C20.5 11.2 17 8 12 8z",
        "M4.5 8.5L3.5 1.5l4.2 3.2L12 .8l4.3 3.9 4.2-3.2-1 7z",
      ],
      detail: "M7 13.5h4v3.5H7z M13 13.5h4v3.5h-4z M11.2 18l.8-1.4.8 1.4z M9.5 20.5h1.2v2h-1.2z M13.3 20.5h1.2v2h-1.2z",
    },
    // Cabeza con cuernos y mirada torva.
    elite: {
      body: "M2.5 1.5l5.2 6.2Q12 6 16.3 7.7l5.2-6.2-.9 9.7c0 6.2-3.4 10.2-8.6 11.3-5.2-1.1-8.6-5.1-8.6-11.3z",
      detail: "M6.5 12.5l4.5 2v1.5H6.5z M17.5 12.5l-4.5 2v1.5h4.5z M9 18.5h6v1.4H9z",
    },
    // Dos espadas cruzadas.
    battle: {
      body: [
        "M2 2h4.5l11 11-3.5 3.5L2 6.5z M10.5 18.5l8-8 1.8 1.8-8 8z M16.8 17.8l1.4-1.4 4.3 4.3-1.4 1.4z",
        "M22 2v4.5L10 17.5 6.5 14l11-11.5z M13.5 18.5l-8-8-1.8 1.8 8 8z M7.2 17.8l-1.4-1.4-4.3 4.3 1.4 1.4z",
      ],
    },
    // Huella de garra.
    beast: {
      body:
        "M12 11.5c-4 0-7 4.2-7 7.3 0 2 1.9 3.2 4 2.6 1.4-.4 2-.6 3-.6s1.6.2 3 .6c2.1.6 4-.6 4-2.6 0-3.1-3-7.3-7-7.3z" +
        "M2.3 10a2.2 2.7 0 1 0 4.4 0 2.2 2.7 0 1 0-4.4 0z" +
        "M6.8 5a2.2 2.8 0 1 0 4.4 0 2.2 2.8 0 1 0-4.4 0z" +
        "M12.8 5a2.2 2.8 0 1 0 4.4 0 2.2 2.8 0 1 0-4.4 0z" +
        "M17.3 10a2.2 2.7 0 1 0 4.4 0 2.2 2.7 0 1 0-4.4 0z",
    },
    // Lápida con cruz sobre un montículo.
    undead: {
      body: ["M5 20V8.5a7 7 0 0 1 14 0V20z", "M1.5 22.5c1-2.5 4-3.5 10.5-3.5s9.5 1 10.5 3.5z"],
      detail: "M11 5.5h2v3h3v2h-3v6h-2v-6H8v-2h3z",
    },
    // Busto de persona con ceño fruncido.
    "hostile-npc": {
      body: "M12 1.5a5.3 5.3 0 1 0 0 10.6 5.3 5.3 0 1 0 0-10.6z M2.5 22.5c0-5.3 4.2-8.8 9.5-8.8s9.5 3.5 9.5 8.8z",
      detail: "M8.2 6l3.3 1.6v1.3H8.2z M15.8 6l-3.3 1.6v1.3h3.3z M9.8 10.2h4.4v1h-4.4z",
    },
    // Nido con tres huevos.
    nest: {
      body: [
        "M5 11.5a2.7 3.4 0 1 0 5.4 0 2.7 3.4 0 1 0-5.4 0z M13.6 11.5a2.7 3.4 0 1 0 5.4 0 2.7 3.4 0 1 0-5.4 0z",
        "M9.2 9a2.8 3.6 0 1 0 5.6 0 2.8 3.6 0 1 0-5.6 0z",
        "M1.5 13.5h21c0 5-4.5 8.5-10.5 8.5S1.5 18.5 1.5 13.5z",
      ],
      detail: "M4.5 16.2h15v1H4.5z M7 18.8h10v1H7z",
    },
    // Mira telescópica.
    sniper: {
      body: [
        "M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 1 0 0-19z M12 5.8a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 1 1 0-12.4z",
        "M11 .5h2V8h-2z M11 16h2v7.5h-2z M.5 11H8v2H.5z M16 11h7.5v2H16z M10.8 10.8h2.4v2.4h-2.4z",
      ],
    },

    /* --- Tesoros --- */

    // Cofre con tapa curva, franja y cerradura.
    chest: {
      body: "M2 10h20v11.5H2z M2 10V8a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v2z",
      detail: "M2 9.6h20V11H2z M10.2 8.5h3.6v5.5h-3.6z M11.4 10.2h1.2v2.2h-1.2z",
    },
    // Saco atado.
    item: {
      body: "M7.5 1.5h9l-2.2 4.2c4 1.2 6.7 5 6.7 9.5 0 4.3-3.4 7.3-9 7.3s-9-3-9-7.3c0-4.5 2.7-8.3 6.7-9.5z",
      detail: "M8.8 5.6h6.4V7H8.8z M10 12.5h4v1.1h-4z",
    },
    // Llave antigua.
    key: {
      body: [
        "M9.3 10.7l1.6-1.6 11.6 11.6-1.6 1.6z M14 15.4l2 2-2.2 2.2-2-2z M17.2 18.6l1.6 1.6-1.6 1.6-1.6-1.6z",
        "M7 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 1 0 0-11z M7 5.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 1 1 0-4.6z",
      ],
    },
    // Diamante tallado.
    gem: {
      body: "M6 3h12l4.5 6L12 22 1.5 9z",
      detail: "M1.5 8.5h21v1.2h-21z M8.4 3.2l1.1.2-1.7 5.2H6.7z M15.6 3.2l-1.1.2 1.7 5.2h1.1z M7.3 9.7h1.2l4 10-.8 1.3z M16.7 9.7h-1.2l-4 10 .8 1.3z",
    },
    // Pila de monedas.
    coin: {
      body: [
        "M3 17v2.5c0 1.7 4 3 9 3s9-1.3 9-3V17c0-1.7-4-3-9-3s-9 1.3-9 3z",
        "M3 12v2.5c0 1.7 4 3 9 3s9-1.3 9-3V12c0-1.7-4-3-9-3s-9 1.3-9 3z",
        "M3 7v2.5c0 1.7 4 3 9 3s9-1.3 9-3V7c0-1.7-4-3-9-3s-9 1.3-9 3z",
      ],
      detail: "M3.5 7.3c1.3 1.2 4.6 2 8.5 2s7.2-.8 8.5-2v1.1c-1.3 1.2-4.6 2-8.5 2s-7.2-.8-8.5-2z",
    },
    // Matraz con burbujas.
    potion: {
      body: "M8.5 1.5h7v2.4h-1.3v4.4c3.6 1.2 6.3 4.4 6.3 8 0 3.7-3.2 6.2-8.5 6.2s-8.5-2.5-8.5-6.2c0-3.6 2.7-6.8 6.3-8V3.9H8.5z",
      detail: "M5.4 14h13.2v1.2H5.4z M9.5 17.6a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z M13.4 18.8a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z",
    },
    // Medalla con cintas y estrella.
    collectible: {
      body: ["M5.5 1.5h4.5l3.2 7.5H8.7z M18.5 1.5H14L10.8 9h4.5z", "M12 8.5a7 7 0 1 0 0 14 7 7 0 1 0 0-14z"],
      detail: "M12 11.3l1.2 2.5 2.7.3-2 1.9.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.9 2.7-.3z",
    },
    // Espada en diagonal.
    weapon: {
      body: [
        "M22 2v4.2L11.7 16.5l-4.2-4.2L17.8 2z",
        "M6.8 15.6l1.6 1.6-4.8 4.8L2 20.4z",
        "M3.8 11.6l1.6-1.6 8.6 8.6-1.6 1.6z",
      ],
      detail: "M19.4 3.4l1.1 1.1-8.3 8.3-1.1-1.1z",
    },

    // Huevo decorado con zigzag y puntos.
    "easter-egg": {
      body: "M12 1.5c-4.6 0-8 7-8 12.3 0 4.8 3.4 8.7 8 8.7s8-3.9 8-8.7C20 8.5 16.6 1.5 12 1.5z",
      detail: "M4.4 12.2l2.6-2 2.5 2 2.5-2 2.5 2 2.5-2 2.6 2v2.1l-2.6-2-2.5 2-2.5-2-2.5 2-2.5-2-2.6 2z M8.4 17.6a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z M13.4 17.6a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z M10.9 6.4a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0-2.2 0z",
    },

    /* --- Equipo --- */

    // Peto de armadura.
    armor: {
      body: "M7 1.5h2.6c.4 1.7 1.3 2.6 2.4 2.6s2-.9 2.4-2.6H17l5 3-1.6 5.3H18v11.3c-2 1-4 1.4-6 1.4s-4-.4-6-1.4V9.8H3.6L2 4.5z",
      detail: "M11.4 6.5h1.2v14.8h-1.2z M8 13.6h8v1.1H8z M8 17h8v1.1H8z",
    },
    // Botiquín con cruz.
    medicine: {
      body: "M2 7h20v14.5H2z M8 7V3.8h8V7h-2V5.8h-4V7z",
      detail: "M10.5 9.3h3v3.2h3.2v3h-3.2v3.2h-3v-3.2H7.3v-3h3.2z",
    },
    // Escudo con flecha hacia arriba.
    upgrade: {
      body: "M12 1.5l9 3.5v6c0 5.6-3.8 9.8-9 11.5-5.2-1.7-9-5.9-9-11.5V5z",
      detail: "M12 5.5l5.2 5.6H14v6.2h-4v-6.2H6.8z",
    },
    // Roca con cristales de mineral asomando.
    resource: {
      body: [
        "M6.5 15L8 6l3-4.5L12.5 14z M12 14l2.5-8.5L18 8.5 17 15z",
        "M1.5 22.5l2-7.3 5.5-3 6.5.6 6 3.2 1 6.5z",
      ],
      detail: "M9.4 3.6l.7.1.9 9.5h-.7z M15.2 7.5l.6.3-1 6.7h-.6z M7 17.5l3-1.5.4.8-3 1.5z M14.5 16.5l3.5 1.2-.3.8-3.5-1.2z",
    },

    /* --- Información --- */

    // Signo de exclamación.
    exclamation: {
      body: "M9.4 1.5h5.2l-1 14.2h-3.2z M9.8 17.5h4.4V22H9.8z",
    },
    // Signo de interrogación (también es el comodín de ids desconocidos).
    question: {
      body: "M5.5 8.2C5.5 4.3 8.4 1.5 12 1.5s6.5 2.6 6.5 6.2c0 3.6-4.3 4.4-4.3 7.8H9.8c0-4.6 4.4-5.4 4.4-7.8 0-1.3-.9-2.2-2.2-2.2S9.8 6.5 9.8 8.2z M9.8 17.5h4.4v4.5H9.8z",
    },
    // Hoja con esquina doblada y renglones.
    note: {
      body: "M3.5 1.5h11.5l5.5 5.5v15.5h-17z",
      detail: "M14.6 2v5.4H20z M7 11h10v1.3H7z M7 14.2h10v1.3H7z M7 17.4h7v1.3H7z",
    },
    // Pergamino con exclamación (misión principal).
    quest: {
      body: [
        "M5.5 4h13v14.5h-13z",
        "M3.5 1.5h17a2.3 2.3 0 0 1 0 4.6h-17a2.3 2.3 0 0 1 0-4.6z",
        "M3.5 17.4h17a2.3 2.3 0 0 1 0 4.6h-17a2.3 2.3 0 0 1 0-4.6z",
      ],
      detail: "M10.9 8h2.2l-.4 5.2h-1.4z M10.9 14.1h2.2v1.9h-2.2z",
    },
    // Carrito de la compra.
    shop: {
      body: [
        "M1 2.5h4l.8 3H22.5l-2.8 10H8.3l.5 1.8H20.5v2.4H6.9L3.2 4.9H1z",
        "M6.5 21a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0z M16 21a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0z",
      ],
      detail: "M9.6 7.5h1.2v6.3H9.6z M13.4 7.5h1.2v6.3h-1.2z M17.2 7.5h1.2v6.3h-1.2z",
    },
    // Busto con un signo de interrogación encima.
    "side-quest": {
      body: [
        "M12 9.6a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 1 0 0-7.2z M4.5 23c0-3.7 3.4-5.8 7.5-5.8s7.5 2.1 7.5 5.8z",
        "M9.6 3.6C9.6 2.2 10.6 1 12 1s2.4 1 2.4 2.4c0 1.5-1.4 1.8-1.4 3h-2c0-2.1 1.5-2.3 1.5-3 0-.4-.2-.6-.5-.6s-.5.3-.5.8z M11 7.1h2v1.7h-2z",
      ],
    },
    // Mando de juego.
    minigame: {
      body: "M6.5 6.5h11c3 0 5 2.8 5.5 6.6.4 3.5-.6 5.7-2.6 5.7-1.6 0-2.4-1.3-3.4-2.9H7c-1 1.6-1.8 2.9-3.4 2.9-2 0-3-2.2-2.6-5.7.5-3.8 2.5-6.6 5.5-6.6z",
      detail: "M5.4 9.6h1.7v2h2v1.7h-2v2H5.4v-2h-2v-1.7h2z M15.3 11a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0z M17.9 13.6a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0z",
    },
    // Pieza de puzle.
    puzzle: {
      body: "M3 6.5h4.5a2.5 2.5 0 1 1 5 0H17V11a2.5 2.5 0 1 1 0 5v5H12.5a2.5 2.5 0 1 0-5 0H3v-4.5a2.5 2.5 0 1 0 0-5z",
    },
    // Lupa.
    search: {
      body: [
        "M14.2 16.5l2.3-2.3 6.3 6.3-2.3 2.3z",
        "M9.5 1.5a8 8 0 1 0 0 16 8 8 0 1 0 0-16z M9.5 4.6a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 1 1 0-9.8z",
      ],
    },
    // Marca de verificación.
    check: {
      body: "M1.5 12.5l3.3-3.3 4.6 4.6L19.2 4l3.3 3.3L9.4 20.4z",
    },
    // Aspa.
    cancel: {
      body: "M4.8 1.5L12 8.7l7.2-7.2 3.3 3.3-7.2 7.2 7.2 7.2-3.3 3.3-7.2-7.2-7.2 7.2-3.3-3.3 7.2-7.2-7.2-7.2z",
    },
    // Busto con bocadillo de diálogo.
    npc: {
      body: [
        "M10 3.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 1 0 0-9.4z M1.5 22.5c0-5 3.8-8.5 8.5-8.5s8.5 3.5 8.5 8.5z",
        "M14.5 1h8v6.5h-4.7l-2.6 2.6V7.5h-.7z",
      ],
      detail: "M16 3.6h1.3v1.3H16z M17.9 3.6h1.3v1.3h-1.3z M19.8 3.6h1.3v1.3h-1.3z",
    },
    // Triángulo de peligro.
    danger: {
      body: "M12 1.5L23 21.5H1z",
      detail: "M10.7 8h2.6l-.4 7.2h-1.8z M10.7 16.6h2.6v2.6h-2.6z",
    },
    // Estrella de cinco puntas.
    star: {
      body: "M12 1.3l3.2 6.6 7.3.9-5.4 5 1.4 7.2L12 17.5 5.5 21l1.4-7.2-5.4-5 7.3-.9z",
    },

    /* --- Viaje --- */

    // Puerta de madera en arco con pomo.
    door: {
      body: "M4.5 22.5V8.5a7.5 6.5 0 0 1 15 0v14z",
      detail: "M8.6 6h1.1v16.5H8.6z M14.3 6h1.1v16.5h-1.1z M16.2 14.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0z",
    },
    // Marco de puerta y flecha que sale.
    exit: {
      body: [
        "M2 1.5h11.5v6H11V4H4.5v16H11v-3.5h2.5v6H2z",
        "M8.5 10.3h7.5V6.5l6.5 5.5-6.5 5.5v-3.8H8.5z",
      ],
    },
    // Marcador de ruta con un rayo.
    "fast-travel": {
      body: "M12 1.5a8.2 8.2 0 0 0-8.2 8.2c0 5.6 8.2 13.3 8.2 13.3s8.2-7.7 8.2-13.3A8.2 8.2 0 0 0 12 1.5z",
      detail: "M13.4 3.8L8.2 11h3.4l-1.2 5.6L15.8 9h-3.5z",
    },
    // Coche de perfil.
    vehicle: {
      body: [
        "M1.5 17.5V13l2.8-1.2 3.3-4.8h8.6l3.8 4.8 2.5.7v5z",
        "M4.2 17.3a2.8 2.8 0 1 0 5.6 0 2.8 2.8 0 1 0-5.6 0z M14.2 17.3a2.8 2.8 0 1 0 5.6 0 2.8 2.8 0 1 0-5.6 0z",
      ],
      detail: "M8.2 8.5h3.4v3.3H6z M13 8.5h2.6l2.5 3.3H13z M6.2 17.3a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0z M16.2 17.3a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0z",
    },
    // Moto de perfil.
    motorcycle: {
      body: [
        "M1.5 17a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0z M15.5 17a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0z",
        "M4.4 16.4L8 11.2h6l2-2.7h2.7l-.8 1.7 2 6.4-1.4.7-1.8-4.8-2.3 3.4H9.6L5.8 17.4z M6.6 9.6h5.8l-.9 1.8H6z M15.4 6.8h4v1.5h-4z",
      ],
      detail: "M4.2 17a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0z M18.2 17a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0z",
    },
    // Velero.
    boat: {
      body: ["M11 1.5v12H3.5z M12.8 3.5l7.2 10h-7.2z", "M1 15h22l-3.6 6.5H4.6z"],
      detail: "M5 17.5h14v1.1H5z",
    },
    // Llave inglesa.
    garage: {
      body: "M15.8 1.5a5.8 5.8 0 0 0-5.4 7.8L2.4 17.3a2.3 2.3 0 0 0 3.3 3.3l8-8a5.8 5.8 0 0 0 7.8-5.4c0-.6-.1-1.1-.2-1.6l-3.4 3.4-3.1-.9-.9-3.1 3.4-3.4c-.5-.1-1-.2-1.5-.2z",
      detail: "M3.4 19a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z",
    },
    // Escalera de peldaños.
    stairs: {
      body: "M1.5 22.5v-5h5v-5h5v-5h5v-5h6v20z",
      detail: "M6.5 17.5h16v1h-16z M11.5 12.5h11v1h-11z M16.5 7.5h6v1h-6z",
    },
    // Portal ovalado con remolino.
    portal: {
      body: "M12 1.5c-5 0-8.2 4.7-8.2 10.5S7 22.5 12 22.5s8.2-4.7 8.2-10.5S17 1.5 12 1.5z",
      detail: "M12 4.4c-3.2 0-5.2 3.4-5.2 7.6s2 7.6 5.2 7.6 5.2-3.4 5.2-7.6-2-7.6-5.2-7.6z M12 7.4c-1.8 0-2.7 2.2-2.7 4.6s.9 4.6 2.7 4.6 2.7-2.2 2.7-4.6-.9-4.6-2.7-4.6z M12 9.6c-.7 0-1.1 1.1-1.1 2.4s.4 2.4 1.1 2.4 1.1-1.1 1.1-2.4-.4-2.4-1.1-2.4z",
    },
  };

  var LABELS = {};
  CATEGORIES.forEach(function (category) {
    category.icons.forEach(function (icon) {
      LABELS[icon.id] = icon.label;
    });
  });

  function exists(iconId) {
    return Object.prototype.hasOwnProperty.call(LABELS, iconId);
  }

  /** Etiqueta visible del icono; un id desconocido usa la de "question". */
  function label(iconId) {
    return exists(iconId) ? LABELS[iconId] : LABELS[FALLBACK];
  }

  /**
   * Texto <svg> del glifo, pintado con currentColor y con contorno (css/pins.css).
   * Un id desconocido, o uno sin glifo todavía, usa el de "question".
   */
  function svg(iconId) {
    var glyph = (exists(iconId) && GLYPHS[iconId]) || GLYPHS[FALLBACK];
    var bodies = Array.isArray(glyph.body) ? glyph.body : [glyph.body];
    var paths = bodies
      .map(function (d) {
        return '<path class="pin-glyph__body" d="' + d + '"/>';
      })
      .join("");
    if (glyph.detail) {
      paths += '<path class="pin-glyph__detail" d="' + glyph.detail + '"/>';
    }
    return (
      '<svg class="pin-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">' +
      paths +
      "</svg>"
    );
  }

  Waypoint.ui.pinIcons = {
    CATEGORIES: CATEGORIES,
    label: label,
    svg: svg,
  };
})(window.Waypoint);
