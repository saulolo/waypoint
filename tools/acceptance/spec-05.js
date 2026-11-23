// Prueba de aceptación de SPEC 05 (panel lateral plegable en el visor).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-05.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } } }, numerados como en la spec.
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval.
//       (El criterio 18 provoca a propósito un "[viewer] No se pudo leer el juego del mapa" en consola.)
//   20  grep "indexedDB" js/ui (sin usos).
//   21  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   22  spec-01.js a spec-04.js y este script pasan con un WP_PROFILE vacío.
//   23  grep "SPEC 05" en README.md, specs/01-* a specs/04-* y js/ sin menciones a marcadores.
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
  const clickAt = (x, y, wait = 400) => input([M("mouseMoved", x, y), M("mousePressed", x, y, { button: "left", clickCount: 1 }), M("mouseReleased", x, y, { button: "left", clickCount: 1 })], wait);
  const clickEl = (sel, wait) => { const r = $(sel).getBoundingClientRect(); return clickAt(r.left + r.width / 2, r.top + r.height / 2, wait); };
  const tab = () => input([["Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }], ["Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }]], 80);
  const wheelAt = (x, y) => input([M("mouseWheel", x, y, { deltaX: 0, deltaY: -300 })], 900);
  // Arrastre corto que se queda quieto 80 ms antes de soltar (sin inercia de Leaflet).
  const drag = async (x0, y0, x1, y1) => {
    await input([M("mouseMoved", x0, y0), M("mousePressed", x0, y0, { button: "left", clickCount: 1 }),
      ...Array.from({ length: 6 }, (_, i) => M("mouseMoved", x0 + ((x1 - x0) * (i + 1)) / 6, y0 + ((y1 - y0) * (i + 1)) / 6, { button: "left", buttons: 1 }))], 80);
    await input([M("mouseReleased", x1, y1, { button: "left", clickCount: 1 })], 600);
  };
  const reducedMotion = (on) => input([["Emulation.setEmulatedMedia", { features: on ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [] }]], 200);

  // Object URLs vivas (se envuelven create/revoke para comprobar el desmontaje).
  const liveUrls = new Set();
  const createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL;
  URL.createObjectURL = (b) => { const u = createUrl(b); liveUrls.add(u); return u; };
  URL.revokeObjectURL = (u) => { liveUrls.delete(u); revokeUrl(u); };

  const W = 3000, H = 2000;
  const png = async (name, w, h, color) => {
    const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, w, h);
    return new File([await c.convertToBlob({ type: "image/png" })], name, { type: "image/png" });
  };
  const gs = Waypoint.services.gameService, ms = Waypoint.services.mapService;
  const withCover = await gs.create("Juego portada", await png("portada.png", 300, 400, "hsl(0,60%,45%)"));
  const noCover = await gs.create("sin portada", null);
  const imported = (await ms.importFiles(withCover.id, [await png("Mapa A.png", W, H, "hsl(200,40%,30%)"), await png("Mapa B.png", W, H, "hsl(120,40%,30%)")])).imported;
  const mapA = imported.find((m) => m.name === "Mapa A").id, mapB = imported.find((m) => m.name === "Mapa B").id;
  const mapC = (await ms.importFiles(noCover.id, [await png("Mapa C.png", W, H, "hsl(60,40%,30%)")])).imported[0].id;

  const openViewer = async (id) => {
    window.location.hash = "#/map/" + id;
    await waitFor(() => !!$(".leaflet-image-layer")?.complete); await sleep(400);
  };
  const panel = () => $(".viewer__panel"), toggle = () => $(".viewer__toggle");
  const pr = () => panel().getBoundingClientRect(), tr = () => toggle().getBoundingClientRect();
  const ir = () => $(".leaflet-image-layer").getBoundingClientRect();
  const imgPos = () => { const r = ir(); return [r.left, r.top, r.width, r.height]; };
  const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 1);

  // ---------- Mapa A (juego con portada) ----------
  const urlsBefore = new Set(liveUrls);
  await openViewer(mapA);
  await waitFor(() => !!$(".viewer__game"));
  const viewerUrls = [...liveUrls].filter((u) => !urlsBefore.has(u));

  ok("02_no_bar", !$(".viewer__bar"));

  const st = $(".viewer__stage").getBoundingClientRect();
  ok("03_stage_full_window", Math.abs(st.width - innerWidth) <= 1 && Math.abs(st.height - innerHeight) <= 1 && st.left === 0 && st.top === 0,
    { stage: [st.width, st.height], window: [innerWidth, innerHeight] });

  // Desde SPEC 08 el panel empieza contraído (antes, expandido).
  ok("04_panel_collapsed_on_open", pr().right <= 0 && Math.abs(pr().width - 260) <= 1 && $(".viewer").classList.contains("viewer--panel-collapsed") && panel().inert,
    { right: pr().right, width: pr().width });

  ok("08_toggle_collapsed_aria", toggle().getAttribute("aria-expanded") === "false" && toggle().getAttribute("aria-label") === "Expandir panel"
    && toggle().getAttribute("aria-controls") === panel().id,
    { expanded: toggle().getAttribute("aria-expanded"), label: toggle().getAttribute("aria-label") });

  // Expandir para el resto de comprobaciones (contenido, rueda y arrastre sobre el panel).
  const beforeFirstExpand = imgPos();
  await clickEl(".viewer__toggle");
  const firstExpandImg = imgPos();
  ok("08b_expand", toggle().getAttribute("aria-expanded") === "true" && toggle().getAttribute("aria-label") === "Contraer panel"
    && Math.abs(pr().left) <= 1 && !panel().inert,
    { left: pr().left, label: toggle().getAttribute("aria-label") });

  const gameName = $(".viewer__game-name"), title = $(".viewer__title");
  ok("05_panel_content", $(".viewer__back")?.textContent === "← Mapas" && gameName?.textContent === "Juego portada" && title.textContent === "Mapa A" && isPixel(gameName) && isPixel(title)
    && panel().contains($(".viewer__back")) && panel().contains(gameName) && panel().contains(title),
    { back: $(".viewer__back")?.textContent, game: gameName?.textContent, map: title.textContent, fonts: [css(gameName).fontFamily, css(title).fontFamily] });

  // 14. Ajuste inicial a la ventana completa (con el panel encima)
  const fit = ir();
  const touches = Math.abs(fit.width - innerWidth) <= 2 || Math.abs(fit.height - innerHeight) <= 2;
  const inside = fit.left >= -2 && fit.top >= -2 && fit.right <= innerWidth + 2 && fit.bottom <= innerHeight + 2;
  ok("14_fit_full_window", touches && inside, { img: [fit.left, fit.top, fit.width, fit.height] });

  // 13. Duración de la transición
  const durations = [css(panel()).transitionDuration];
  await reducedMotion(true);
  durations.push(css(panel()).transitionDuration);
  await reducedMotion(false);
  ok("13_transition_200ms", durations[0] === "0.2s" && durations[1] === "0s", durations);

  // 15. Rueda sobre el panel no cambia el zoom; sobre el mapa sí
  let before = imgPos();
  await wheelAt(160, 200);
  const afterPanelWheel = imgPos();
  const t0 = tr(); await wheelAt(t0.left + t0.width / 2, t0.top + t0.height / 2);
  const afterToggleWheel = imgPos();
  // 16. Arrastre que empieza sobre el panel no mueve el mapa
  await drag(160, 200, 700, 350);
  const afterPanelDrag = imgPos();
  ok("16_drag_on_panel_ignored", same(before, afterPanelDrag), { before, after: afterPanelDrag });
  await wheelAt(800, 500);
  const afterMapWheel = imgPos();
  ok("15_wheel_on_panel_ignored", same(before, afterPanelWheel) && same(before, afterToggleWheel) && afterMapWheel[2] > before[2] + 10,
    { before, panel: afterPanelWheel, toggle: afterToggleWheel, map: afterMapWheel });

  // 09. Contraer
  before = imgPos();
  await clickEl(".viewer__toggle");
  const collapsedImg = imgPos();
  const t1 = tr();
  const hitToggle = document.elementFromPoint(t1.left + t1.width / 2, t1.top + t1.height / 2) === toggle();
  ok("09_collapse", toggle().getAttribute("aria-expanded") === "false" && toggle().getAttribute("aria-label") === "Expandir panel"
    && pr().right <= 0 && Math.abs(t1.left) <= 1 && t1.width > 0 && hitToggle && panel().inert,
    { panelRight: pr().right, toggleLeft: t1.left, hitToggle, label: toggle().getAttribute("aria-label") });

  // 10. Contraído, Tab no lleva a "← Mapas"
  document.activeElement.blur();
  const focused = [];
  for (let i = 0; i < 10; i++) { await tab(); focused.push(document.activeElement); }
  ok("10_collapsed_no_focus", !focused.some((e) => e.closest(".viewer__panel")) && focused.includes(toggle()),
    focused.map((e) => e.className || e.tagName));

  // 11. Segundo clic: como al abrir
  await clickEl(".viewer__toggle");
  const reopenedImg = imgPos();
  ok("11_expand_again", toggle().getAttribute("aria-expanded") === "true" && toggle().getAttribute("aria-label") === "Contraer panel"
    && Math.abs(pr().left) <= 1 && Math.abs(pr().width - 260) <= 1 && !panel().inert,
    { left: pr().left, label: toggle().getAttribute("aria-label") });

  ok("12_toggle_keeps_view", same(before, collapsedImg) && same(before, reopenedImg) && same(beforeFirstExpand, firstExpandImg),
    { before, collapsed: collapsedImg, reopened: reopenedImg, firstExpand: [beforeFirstExpand, firstExpandImg] });

  // 19. + / − en la esquina inferior derecha
  const zc = $(".leaflet-control-zoom").getBoundingClientRect();
  ok("19_zoom_bottom_right", innerWidth - zc.right <= 20 && innerHeight - zc.bottom <= 20 && zc.left > innerWidth / 2 && zc.top > innerHeight / 2,
    { right: innerWidth - zc.right, bottom: innerHeight - zc.bottom });

  // 07. "← Mapas" vuelve al juego
  await clickEl(".viewer__back", 600);
  ok("07_back_to_game", window.location.hash === "#/game/" + withCover.id, window.location.hash);
  await sleep(300);
  const leftAlive = viewerUrls.filter((u) => liveUrls.has(u));

  // 17. Otro mapa: panel contraído y sin object URLs del visor anterior vivas
  await openViewer(mapB);
  await clickEl(".viewer__toggle"); // expandido en B
  await openViewer(mapA); // se monta un visor nuevo: tiene que empezar contraído
  const freshCollapsed = toggle().getAttribute("aria-expanded") === "false" && pr().right <= 0;
  window.location.hash = "#/game/" + withCover.id; await sleep(500);
  ok("17_reopen_collapsed_and_revoked", viewerUrls.length === 1 && leftAlive.length === 0 && freshCollapsed,
    { viewerUrls: viewerUrls.length, leftAlive: leftAlive.length, freshCollapsed });

  // 06. Portada (mapa A) e inicial (mapa C, juego sin portada)
  await openViewer(mapC);
  await waitFor(() => !!$(".viewer__game"));
  // La portada ya no se muestra en el panel (SPEC 07): solo el nombre del juego
  ok("06_no_cover_in_panel", !$(".viewer__game img") && !$(".viewer__game .game-placeholder") && !$(".viewer__game-cover") && $(".viewer__game-name")?.textContent === "sin portada",
    { name: $(".viewer__game-name")?.textContent });

  // 18. Si gameService.get falla, el mapa se abre igual
  window.location.hash = "#/"; await sleep(400);
  const originalGet = gs.get;
  gs.get = () => Promise.reject(new Error("fallo simulado (spec-05 criterio 18)"));
  await openViewer(mapA); await sleep(300);
  gs.get = originalGet;
  ok("18_game_failure_still_opens", !!$(".leaflet-image-layer") && !!$(".viewer__back") && $(".viewer__title").textContent === "Mapa A" && !$(".viewer__game"),
    { map: !!$(".leaflet-image-layer"), title: $(".viewer__title").textContent, gameBlock: !!$(".viewer__game") });

  window.location.hash = "#/";
  return { criteria: Object.fromEntries(Object.entries(C).sort()) };
})()
