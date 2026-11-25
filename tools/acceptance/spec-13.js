// Prueba de aceptación de SPEC 13 (favicon retro y favicon dinámico del visor).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-13.js
//
// Devuelve { "<nº>_<nombre>": { pass, detail } }, numerados por orden en la spec.
// Notas:
//   - "Abrir" un mapa remonta el visor (pasar por "#/" y volver).
//   - El fallo de setFound rechaza con retraso para poder leer el estado optimista.
// Fuera de este script (con file:// la página no puede leer el texto de los SVG):
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval
//       (11 provoca a propósito un error "[pin-layer]" en consola).
//   03  viewBox → grep 'viewBox="0 0 16 16"' img/*.svg.
//   04  colores → grep -oE "#[0-9a-fA-F]{3,8}" img/favicon.svg img/favicon-complete.svg | sort -u
//       (normal: #0a0a0f #00f5ff #ff006e; completado: #0a0a0f #00f5ff #00ff88).
//   05  grep 'shape-rendering="crispEdges"' img/*.svg; grep -iE "<script|href=|url\(" img/*.svg (sin resultados).
//   15  grep "indexedDB" js/ui (sin usos).
//   16  grep de colores literales fuera de css/tokens.css (ver spec-02.js) → solo img/*.svg además de lo ya permitido.
//   17  spec-02, spec-12 y este script pasan con un WP_PROFILE vacío.
(async () => {
  const C = {};
  try {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const W = Waypoint, $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const png = async (n) => { const c = new OffscreenCanvas(1200, 800); const g = c.getContext("2d"); g.fillStyle = "#468"; g.fillRect(0, 0, 1200, 800); return new File([await c.convertToBlob({ type: "image/png" })], n, { type: "image/png" }); };
  const loadImg = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); i.src = src; });

  const NORMAL = "img/favicon.svg", COMPLETE = "img/favicon-complete.svg";
  const link = () => document.getElementById("app-favicon");
  const href = () => link().getAttribute("href");
  const isNormal = () => href().endsWith(NORMAL) && !W.ui.favicon.isComplete();
  const isComplete = () => href().endsWith(COMPLETE) && W.ui.favicon.isComplete();

  const gs = W.services.gameService, ms = W.services.mapService, mk = W.services.markerService;
  const st = { icon: "exclamation", color: "gold", size: 32 };
  const g = await gs.create("Juego 13", null);
  // A: 3 pines, 2 encontrados · B: 2 pines, 1 encontrado · C: completo · D: sin pines
  const [mA, mB, mC, mD] = (await ms.importFiles(g.id, [await png("A.png"), await png("B.png"), await png("C.png"), await png("D.png")])).imported.sort((a, b) => a.name.localeCompare(b.name));
  const pin = async (m, name, i, found) => { const p = await mk.create(m.id, { x: .2 + i * .25, y: .5, name, ...st }); if (found) await mk.setFound(p.id, true); };
  await pin(mA, "a0", 0, true); await pin(mA, "a1", 1, true); await pin(mA, "a2", 2, false);
  await pin(mB, "b0", 0, true); await pin(mB, "b1", 1, false);
  await pin(mC, "c0", 0, true); await pin(mC, "c1", 1, true);

  let map = null; L.Map.addInitHook(function () { map = this; });
  const go = async (id) => { location.hash = "#/"; await sleep(400); location.hash = "#/map/" + id; await waitFor(() => !!$(".viewer__progress") && $(".viewer__progress-filter-btn") && !$(".viewer__progress-filter-btn").disabled); await sleep(800); };
  const layerByName = (name) => { let f = null; map.eachLayer((l) => { if (l.getTooltip && l.getTooltip() && l.getTooltip().getContent().textContent === name) f = l; }); return f; };
  const openPopup = async (name) => { layerByName(name).openPopup(); await sleep(200); };

  // 02 un único <link rel="icon">
  const icons = $$('link[rel~="icon"]');
  ok("02_link_icon", icons.length === 1 && icons[0].id === "app-favicon" && icons[0].type === "image/svg+xml" && href().endsWith(NORMAL), { n: icons.length, href: href() });

  // 03 los dos SVG cargan como imagen
  const w1 = await loadImg(NORMAL), w2 = await loadImg(COMPLETE);
  ok("03_svg_cargan", w1 > 0 && w2 > 0, { w1, w2 });

  // 06 marca de la cabecera
  const mark = $(".app-header__mark"), ms6 = getComputedStyle(mark);
  ok("06_marca", mark.tagName === "IMG" && mark.getAttribute("src").endsWith(NORMAL) && mark.getAttribute("alt") === "" && mark.getAttribute("aria-hidden") === "true"
    && ms6.imageRendering === "pixelated" && ms6.animationName === "none" && !mark.classList.contains("flicker") && mark.naturalWidth > 0,
    { tag: mark.tagName, ir: ms6.imageRendering, anim: ms6.animationName });

  // 07 inicio y biblioteca
  location.hash = "#/"; await sleep(400); const home = isNormal();
  location.hash = "#/game/" + g.id; await waitFor(() => $$(".map-card").length === 4); await sleep(300); const lib = isNormal();
  ok("07_inicio_biblioteca", home && lib, { home, lib });

  // 08 3 pines con 2 encontrados → normal; marcar el tercero → completado
  await go(mA.id);
  const before8 = isNormal();
  await openPopup("a2"); $(".pin-popup__found").click(); await sleep(150);
  const after8 = isComplete();
  ok("08_marcar_ultimo", before8 && after8, { before8, after8, href: href() });

  // 09 desmarcar con el mapa completo
  $(".pin-popup__found").click(); await sleep(150);
  const after9 = isNormal();
  $(".pin-popup__found").click(); await sleep(300); map.closePopup(); await sleep(200);
  ok("09_desmarcar", after9 && isComplete(), { after9, back: href() });

  // 10 crear un pin en un mapa completo (por la UI: Añadir pin + Guardar)
  $('.view-controls__btn[aria-label="Añadir pin"]').click(); await sleep(1200);
  $(".pin-editor .btn--primary").click(); await sleep(600);
  ok("10_crear_pin", isNormal(), href());

  // 11 fallo de setFound al marcar el último pendiente
  await go(mB.id);
  const realSet = mk.setFound; mk.setFound = () => sleep(300).then(() => { throw new Error("fallo provocado (spec-13)"); });
  await openPopup("b1"); $(".pin-popup__found").click(); await sleep(50);
  const optimistic = isComplete(); await sleep(500);
  const reverted = isNormal() && !layerByName("b1").getElement().classList.contains("pin--found");
  mk.setFound = realSet; map.closePopup(); await sleep(200);
  ok("11_revert_setFound", optimistic && reverted, { optimistic, reverted, href: href() });

  // 12 abrir un mapa completo / sin pines
  await go(mC.id); const openComplete = isComplete();
  await go(mD.id); const openEmpty = isNormal();
  ok("12_abrir", openComplete && openEmpty, { openComplete, openEmpty });

  // 14 con el mapa completo, la marca sigue con el normal
  await go(mC.id);
  ok("14_marca_estatica", isComplete() && $(".app-header__mark").getAttribute("src").endsWith(NORMAL), $(".app-header__mark").getAttribute("src"));

  // 13 desde un mapa completo, "← Mapas" deja el normal
  $(".viewer__toggle").click(); await sleep(400);
  $(".viewer__back").click();
  await waitFor(() => location.hash === "#/game/" + g.id); await sleep(400);
  ok("13_volver_mapas", location.hash === "#/game/" + g.id && isNormal(), { hash: location.hash, href: href() });

  location.hash = "#/";
  } catch (e) { C.__error = { pass: false, detail: String(e && e.stack || e) }; }
  return C;
})()
