// Prueba de aceptación de SPEC 06 (controles de vista: pin, pantalla completa y escala 1:1 / ajustar).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-06.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } } }, numerados como en la spec.
// Pantalla completa: Chrome headless rechaza requestFullscreen() ("not granted") aunque el clic
// sea real. Los criterios 12 a 18 y 20 simulan la API (document.fullscreenElement,
// requestFullscreen, exitFullscreen y el evento fullscreenchange) y sí usan clics reales sobre
// el botón; el cambio de tamaño de ventana al entrar y salir se emula con Emulation.
// setDeviceMetricsOverride. El criterio 19 simula el rechazo.
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval.
//   22  grep "indexedDB" js/ui (sin usos).
//   23  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   24  spec-01.js a spec-05.js y este script pasan con un WP_PROFILE vacío.
//   25  grep "SPEC 06" en README.md, specs/01-* a specs/05-* y js/ sin menciones a marcadores.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const C = {};
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const $ = (s) => document.querySelector(s);
  const css = (e) => getComputedStyle(e);
  const isPixel = (e) => css(e).fontFamily.includes("Press Start 2P");
  const input = async (ev, wait = 0) => { await window.cdpInput(JSON.stringify(ev)); if (wait) await sleep(wait); };
  const M = (type, x, y, extra = {}) => ["Input.dispatchMouseEvent", Object.assign({ type, x, y }, extra)];
  const clickAt = (x, y, wait = 700, count = 1) => input([M("mouseMoved", x, y), M("mousePressed", x, y, { button: "left", clickCount: count }), M("mouseReleased", x, y, { button: "left", clickCount: count })], wait);
  const clickEl = (e, wait, count) => { const r = e.getBoundingClientRect(); return clickAt(r.left + r.width / 2, r.top + r.height / 2, wait, count); };
  const tab = () => input([["Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }], ["Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }]], 80);
  const wheelAt = (x, y, dy = -300) => input([M("mouseWheel", x, y, { deltaX: 0, deltaY: dy })], 1000);
  const drag = async (x0, y0, x1, y1) => {
    await input([M("mouseMoved", x0, y0), M("mousePressed", x0, y0, { button: "left", clickCount: 1 }),
      ...Array.from({ length: 6 }, (_, i) => M("mouseMoved", x0 + ((x1 - x0) * (i + 1)) / 6, y0 + ((y1 - y0) * (i + 1)) / 6, { button: "left", buttons: 1 }))], 80);
    await input([M("mouseReleased", x1, y1, { button: "left", clickCount: 1 })], 600);
  };
  const reducedMotion = (on) => input([["Emulation.setEmulatedMedia", { features: on ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [] }]], 200);
  const viewport = (w, h) => input([["Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }]], 600);

  // Acceso al mapa Leaflet y recuento de listeners de fullscreenchange (se instalan antes de montar el visor).
  let map = null;
  L.Map.addInitHook(function () { map = this; });
  const fsListeners = new Set();
  const realAdd = document.addEventListener.bind(document), realRemove = document.removeEventListener.bind(document);
  document.addEventListener = (t, fn, o) => { if (t === "fullscreenchange") fsListeners.add(fn); return realAdd(t, fn, o); };
  document.removeEventListener = (t, fn, o) => { if (t === "fullscreenchange") fsListeners.delete(fn); return realRemove(t, fn, o); };
  let pageError = null;
  window.addEventListener("error", (e) => { pageError = e.message; });

  const W = 3000, H = 2000;
  const png = async (name, w, h, color) => {
    const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, w, h);
    return new File([await c.convertToBlob({ type: "image/png" })], name, { type: "image/png" });
  };
  const gs = Waypoint.services.gameService, ms = Waypoint.services.mapService;
  const game = await gs.create("Juego spec 06", null);
  const mapId = (await ms.importFiles(game.id, [await png("Mapa.png", W, H, "hsl(200,40%,30%)")])).imported[0].id;

  const openViewer = async (id) => {
    // Con el mismo hash no hay cambio de ruta: se pasa por "#/" para montar un visor nuevo.
    if (window.location.hash === "#/map/" + id) { window.location.hash = "#/"; await sleep(500); }
    window.location.hash = "#/map/" + id;
    await waitFor(() => !!$(".leaflet-image-layer")?.complete); await sleep(500);
  };
  const btns = () => [...document.querySelectorAll(".view-controls__btn")];
  const pinBtn = () => btns()[0], fsBtn = () => btns()[1], scaleBtn = () => btns()[2];
  const rect = (e) => e.getBoundingClientRect();
  const ir = () => rect($(".leaflet-image-layer"));
  const imgPos = () => { const r = ir(); return [r.left, r.top, r.width, r.height]; };
  const same = (a, b, tol = 1) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  // Punto de la imagen (en px de imagen) que está en el centro de la vista.
  const centerPoint = () => { const c = map.getCenter(); return [c.lng, c.lat]; };
  const pointDiffPx = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) * Math.pow(2, map.getZoom());
  const viewer = () => $(".viewer");
  const panelEl = () => $(".viewer__panel"), toggleEl = () => $(".viewer__toggle");
  const hidden = (e) => rect(e).width === 0 && rect(e).height === 0;

  await openViewer(mapId);

  // 02. Tres botones, cada uno en su propia caja, en orden
  const b = btns();
  const boxes = b.map((e) => e.parentElement);
  const rects = b.map(rect);
  const separate = boxes.every((bx, i) => bx.classList.contains("leaflet-bar") && boxes.indexOf(bx) === i) && rects.every((r, i) => i === 0 || r.top > rects[i - 1].bottom);
  ok("02_three_separate_buttons", b.length === 3 && separate && b.every((e) => e.tagName === "BUTTON"),
    { count: b.length, tops: rects.map((r) => Math.round(r.top)), bottoms: rects.map((r) => Math.round(r.bottom)) });

  // 03. Encima de + / −, abajo a la derecha, sin solaparse
  const zc = rect($(".leaflet-control-zoom"));
  ok("03_above_zoom_bottom_right", rects[2].bottom < zc.top && rects.every((r) => r.right > innerWidth / 2 && r.left >= zc.left - 4 && r.right <= zc.right + 4) && innerWidth - zc.right <= 20 && innerHeight - zc.bottom <= 20,
    { lastBottom: rects[2].bottom, zoomTop: zc.top, rights: rects.map((r) => r.right) });

  // 04. aria-label y title (escala en sus dos estados: ver también 06)
  const lt = (e) => [e.getAttribute("aria-label"), e.title];
  const labelsOk = (e, text) => lt(e)[0] === text && lt(e)[1] === text;
  const scaleInitial = labelsOk(scaleBtn(), "Tamaño real (1:1)");
  ok("04_labels", labelsOk(pinBtn(), "Añadir pin") && labelsOk(fsBtn(), "Pantalla completa") && scaleInitial, b.map(lt));

  // 05. Icono o texto
  const scaleText = scaleBtn().textContent === "1:1" && !scaleBtn().querySelector("svg") && isPixel(scaleBtn());
  ok("05_icons_and_text", !!pinBtn().querySelector("svg") && !!fsBtn().querySelector("svg") && scaleText,
    { pin: !!pinBtn().querySelector("svg"), fs: !!fsBtn().querySelector("svg"), scaleText: scaleBtn().textContent, pixel: isPixel(scaleBtn()) });

  // 07. Clic, doble clic, arrastre y rueda sobre el bloque no llegan al mapa
  // Desde SPEC 08 el pin abre el panel de pin (que oculta estos controles): aquí solo interesa que
  // los eventos no lleguen al mapa, así que se anula la apertura mientras dura la comprobación.
  const realOpen = Waypoint.ui.pinEditor.open;
  Waypoint.ui.pinEditor.open = () => () => {};
  const z0 = map.getZoom(), pos0 = imgPos();
  await clickEl(pinBtn(), 400);
  await clickEl(pinBtn(), 600, 2); // doble clic real
  const r = rect(pinBtn());
  await drag(r.left + 18, r.top + 18, r.left - 200, r.top - 100);
  await wheelAt(r.left + 18, r.top + 18);
  Waypoint.ui.pinEditor.open = realOpen;
  ok("07_block_events_isolated", Math.abs(map.getZoom() - z0) < 0.01 && same(pos0, imgPos()) && !pageError,
    { z0, z1: map.getZoom(), before: pos0, after: imgPos(), pageError });

  // 06 + 08. Escala: de "mapa entero" a tamaño real y de vuelta; ajustar centra la imagen
  const fitPos = imgPos();
  await wheelAt(900, 300, -200);
  const scaleAfterWheel = labelsOk(scaleBtn(), "Tamaño real (1:1)") && scaleBtn().textContent === "1:1";
  // 09. Tamaño real: zoom 0 y mismo punto central (la vista ya está descentrada por la rueda)
  await drag(700, 500, 640, 460);
  const pt0 = centerPoint();
  await clickEl(scaleBtn(), 1000);
  const pt1 = centerPoint();
  ok("09_actual_size", Math.abs(map.getZoom()) <= 0.01 && pointDiffPx(pt0, pt1) <= 2, { zoom: map.getZoom(), diffPx: pointDiffPx(pt0, pt1) });
  const scaleAtActual = labelsOk(scaleBtn(), "Ajustar a la ventana") && !!scaleBtn().querySelector("svg") && scaleBtn().textContent === "";
  ok("04b_scale_label_at_actual_size", scaleAtActual, lt(scaleBtn()));
  await drag(700, 500, 400, 300);
  await clickEl(scaleBtn(), 1000);
  const fit = ir(), cx = fit.left + fit.width / 2 - innerWidth / 2, cy = fit.top + fit.height / 2 - innerHeight / 2;
  const touches = Math.abs(fit.width - innerWidth) <= 2 || Math.abs(fit.height - innerHeight) <= 2;
  ok("08_fit", Math.abs(cx) <= 2 && Math.abs(cy) <= 2 && touches && same(fitPos, imgPos(), 2), { cx, cy, img: imgPos(), fitPos });
  ok("06_scale_toggle", scaleInitial && scaleAfterWheel && scaleAtActual && scaleBtn().textContent === "1:1" && labelsOk(scaleBtn(), "Tamaño real (1:1)"),
    { scaleInitial, scaleAfterWheel, scaleAtActual, finalText: scaleBtn().textContent });

  // 10. Zoom mínimo mayor que 0: 1:1 deja el zoom en el mínimo
  map.setMinZoom(1);
  await sleep(300);
  const min = map.getMinZoom();
  if (Math.abs(map.getZoom()) <= 0.01 || map.getZoom() < 1) map.setZoom(1.5, { animate: false });
  await clickEl(scaleBtn(), 1000);
  const clamped = map.getZoom();
  ok("10_actual_size_clamped_to_min", min === 1 && Math.abs(clamped - 1) <= 0.01, { min, zoom: clamped });
  await openViewer(mapId); // visor nuevo: restablece zoom mínimo y vista

  // 11. Con movimiento reducido, ajustar y 1:1 cambian la vista sin zoomanim
  await reducedMotion(true);
  let anim = 0; map.on("zoomanim", () => anim++);
  await wheelAt(900, 300, -200);
  await clickEl(scaleBtn(), 100);
  const actualZoom = map.getZoom();
  await clickEl(scaleBtn(), 100);
  const fitZoomed = Math.abs(ir().width - innerWidth) <= 2 || Math.abs(ir().height - innerHeight) <= 2;
  await reducedMotion(false);
  ok("11_reduced_motion_no_animation", anim === 0 && Math.abs(actualZoom) <= 0.01 && fitZoomed, { zoomanim: anim, actualZoom, fitZoomed });

  // ---- Pantalla completa simulada (ver cabecera) ----
  let fsEl = null, rejectNext = false;
  Object.defineProperty(document, "fullscreenElement", { get: () => fsEl, configurable: true });
  const fire = () => document.dispatchEvent(new Event("fullscreenchange"));
  Element.prototype.requestFullscreen = function () {
    if (rejectNext) return Promise.reject(new TypeError("not granted"));
    fsEl = this; viewport(1600, 900).then(fire); return Promise.resolve();
  };
  document.exitFullscreen = function () { fsEl = null; viewport(1280, 800).then(fire); return Promise.resolve(); };
  const fsState = () => ({ fs: fsEl === document.documentElement, cls: viewer().classList.contains("viewer--fullscreen"), label: fsBtn().getAttribute("aria-label"),
    title: fsBtn().title, d: fsBtn().querySelector("path")?.getAttribute("d"), panelHidden: hidden(panelEl()), toggleHidden: hidden(toggleEl()) });

  await openViewer(mapId);
  await wheelAt(900, 300, -200); // zoom dentro del rango
  const zBefore = map.getZoom(), cBefore = centerPoint(), s0 = fsState();

  // 12-13. Entrar
  await clickEl(fsBtn(), 1200);
  const sIn = fsState();
  ok("12_fullscreen_enter", sIn.fs && sIn.cls && sIn.panelHidden && sIn.toggleHidden, sIn);
  ok("13_fullscreen_label_and_icon", sIn.label === "Salir de pantalla completa" && sIn.title === sIn.label && sIn.d !== s0.d, { label: sIn.label, before: s0.d, after: sIn.d });

  // 14. Segundo clic sale
  await clickEl(fsBtn(), 1200);
  const sOut = fsState();
  ok("14_fullscreen_exit_button", !sOut.fs && fsEl === null && !sOut.cls && sOut.label === "Pantalla completa" && !sOut.panelHidden && !sOut.toggleHidden && sOut.d === s0.d, sOut);

  // 17. Zoom y punto central estables al entrar y salir (ventana distinta dentro)
  ok("17_fullscreen_keeps_view", Math.abs(map.getZoom() - zBefore) <= 0.01 && pointDiffPx(cBefore, centerPoint()) <= 2,
    { zoomBefore: zBefore, zoomAfter: map.getZoom(), diffPx: pointDiffPx(cBefore, centerPoint()) });

  // 15. Esc: el navegador sale sin pasar por el botón; la UI queda igual que con el botón
  await clickEl(fsBtn(), 1200);
  fsEl = null; await viewport(1280, 800); fire(); await sleep(200);
  const sEsc = fsState();
  ok("15_fullscreen_exit_escape", JSON.stringify(sEsc) === JSON.stringify(sOut), { esc: sEsc, button: sOut });

  // 16. El panel conserva su estado (contraído y expandido). Desde SPEC 08 empieza contraído:
  // se expande primero.
  const collapsedFlag = () => viewer().classList.contains("viewer--panel-collapsed");
  await clickEl(toggleEl(), 400);
  const expandedBefore = !collapsedFlag();
  await clickEl(fsBtn(), 1200); await clickEl(fsBtn(), 1200);
  const expandedAfter = !collapsedFlag() && !panelEl().inert;
  await clickEl(toggleEl(), 400);
  const collapsedBefore = collapsedFlag();
  await clickEl(fsBtn(), 1200);
  const hiddenInside = fsState().panelHidden && fsState().toggleHidden;
  await clickEl(fsBtn(), 1200);
  const collapsedAfter = collapsedFlag() && panelEl().inert && toggleEl().getAttribute("aria-expanded") === "false";
  ok("16_panel_state_preserved", expandedBefore && expandedAfter && collapsedBefore && hiddenInside && collapsedAfter,
    { expandedBefore, expandedAfter, collapsedBefore, hiddenInside, collapsedAfter });
  await clickEl(toggleEl(), 400); // expandido otra vez

  // 19. requestFullscreen rechazado: aviso y sin clase
  rejectNext = true;
  await clickEl(fsBtn(), 700);
  rejectNext = false;
  const noticeShown = document.body.innerText.includes("No se pudo activar la pantalla completa.");
  ok("19_fullscreen_rejected", noticeShown && !viewer().classList.contains("viewer--fullscreen") && fsEl === null, { noticeShown, cls: viewer().classList.contains("viewer--fullscreen") });

  // 21. Foco visible con Tab
  document.activeElement.blur();
  const focusInfo = [];
  for (let i = 0; i < 14 && focusInfo.length < 3; i++) {
    await tab();
    const a = document.activeElement;
    if (btns().includes(a)) focusInfo.push({ label: a.getAttribute("aria-label"), visible: a.matches(":focus-visible"), style: css(a).outlineStyle, width: css(a).outlineWidth, offset: parseFloat(css(a).outlineOffset) });
  }
  ok("21_focus_visible", focusInfo.length === 3 && focusInfo.every((f) => f.visible && f.style !== "none" && parseFloat(f.width) >= 2 && f.offset < 0), focusInfo);

  // 18. Salir del visor en pantalla completa: va al juego y sale de pantalla completa.
  // El panel (y "← Mapas") está oculto en pantalla completa: se activa el enlace por DOM, que
  // es la misma navegación que el botón atrás del navegador o cualquier cambio de ruta.
  await clickEl(fsBtn(), 1200);
  const inFs = fsEl === document.documentElement;
  $(".viewer__back").click(); await sleep(800);
  ok("18_back_exits_fullscreen", inFs && window.location.hash === "#/game/" + game.id && document.fullscreenElement === null, { inFs, hash: window.location.hash, fs: document.fullscreenElement });
  await sleep(500);

  // 20. Sin listeners de fullscreenchange tras salir del visor
  pageError = null;
  fire(); await sleep(100);
  ok("20_no_fullscreen_listeners_left", fsListeners.size === 0 && !pageError, { listeners: fsListeners.size, pageError });

  await viewport(1280, 800);
  window.location.hash = "#/";
  return { criteria: Object.fromEntries(Object.entries(C).sort()) };
})()
