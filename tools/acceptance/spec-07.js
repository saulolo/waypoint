// Prueba de aceptación de SPEC 07 (selector de mapas en el panel del visor).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-07.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } } }, numerados como en la spec.
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval.
//   20  grep "indexedDB" js/ui (sin usos).
//   21  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   22  spec-01.js a spec-06.js y este script pasan con un WP_PROFILE vacío.
//   23  grep "SPEC 07" en README.md, CLAUDE.md, specs/01-* a specs/06-* y js/ sin menciones a marcadores.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const C = {};
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const css = (e) => getComputedStyle(e);
  const input = async (ev, wait = 0) => { await window.cdpInput(JSON.stringify(ev)); if (wait) await sleep(wait); };
  const M = (type, x, y, extra = {}) => ["Input.dispatchMouseEvent", Object.assign({ type, x, y }, extra)];
  const clickAt = (x, y, wait = 500) => input([M("mouseMoved", x, y), M("mousePressed", x, y, { button: "left", clickCount: 1 }), M("mouseReleased", x, y, { button: "left", clickCount: 1 })], wait);
  const clickEl = (e, wait) => { const r = e.getBoundingClientRect(); return clickAt(r.left + r.width / 2, r.top + r.height / 2, wait); };
  const tab = () => input([["Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }], ["Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }]], 80);

  // Mapa Leaflet, object URLs vivos y listeners de pointerdown en document (antes de montar el visor).
  let map = null;
  L.Map.addInitHook(function () { map = this; });
  const liveUrls = new Set();
  const realCreate = URL.createObjectURL.bind(URL), realRevoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (b) => { const u = realCreate(b); liveUrls.add(u); return u; };
  URL.revokeObjectURL = (u) => { liveUrls.delete(u); return realRevoke(u); };
  const pdListeners = new Set();
  const realAdd = document.addEventListener.bind(document), realRemove = document.removeEventListener.bind(document);
  document.addEventListener = (t, fn, o) => { if (t === "pointerdown") pdListeners.add(fn); return realAdd(t, fn, o); };
  document.removeEventListener = (t, fn, o) => { if (t === "pointerdown") pdListeners.delete(fn); return realRemove(t, fn, o); };
  let pageError = null;
  window.addEventListener("error", (e) => { pageError = e.message; });

  const W = 3000, H = 2000;
  const png = async (name, w, h, color) => {
    const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, w, h);
    return new File([await c.convertToBlob({ type: "image/png" })], name, { type: "image/png" });
  };
  const gs = Waypoint.services.gameService, ms = Waypoint.services.mapService;
  const game = await gs.create("Juego spec 07", null);
  const solo = await gs.create("Juego de un mapa", null);
  const many = await gs.create("Juego con muchos", null);
  const imported = (await ms.importFiles(game.id, [await png("beta.png", W, H, "hsl(120,40%,30%)"), await png("Alfa.png", W, H, "hsl(200,40%,30%)"), await png("Ñu.png", W, H, "hsl(300,40%,30%)")])).imported;
  const id = (name) => imported.find((m) => m.name === name).id;
  const soloId = (await ms.importFiles(solo.id, [await png("Unico.png", W, H, "hsl(60,40%,30%)")])).imported[0].id;
  const manyFiles = [];
  for (let i = 1; i <= 14; i++) manyFiles.push(await png("Mapa " + String(i).padStart(2, "0") + ".png", 400, 300, "hsl(" + i * 20 + ",40%,30%)"));
  const manyId = (await ms.importFiles(many.id, manyFiles)).imported[0].id;

  const openViewer = async (mapId) => {
    if (window.location.hash === "#/map/" + mapId) { window.location.hash = "#/"; await sleep(500); }
    window.location.hash = "#/map/" + mapId;
    await waitFor(() => !!$(".leaflet-image-layer")?.complete); await sleep(500);
    await expandPanel();
  };
  // Desde SPEC 08 el panel empieza contraído: el selector está dentro, así que se expande.
  const expandPanel = async () => {
    if ($(".viewer")?.classList.contains("viewer--panel-collapsed")) await clickEl($(".viewer__toggle"), 400);
  };
  const trigger = () => $(".viewer__map-trigger"), list = () => $(".viewer__map-list"), panel = () => $(".viewer__panel"), title = () => $(".viewer__title");
  const rect = (e) => e.getBoundingClientRect();
  const visible = (e) => !!e && !e.hidden && rect(e).height > 0;
  const rows = () => $$(".viewer__map-row");
  const rowNames = () => $$(".viewer__map-row-name").map((n) => n.textContent);
  const ir = () => rect($(".leaflet-image-layer"));

  // 02. Con 3 mapas: disparador con svg
  await openViewer(id("Alfa"));
  await waitFor(() => !!trigger());
  const t = trigger();
  ok("02_trigger", !!t && t.tagName === "BUTTON" && !!t.querySelector("svg") && t.getAttribute("aria-expanded") === "false" && t.getAttribute("aria-haspopup") === "true"
    && t.getAttribute("aria-controls") === "viewer-map-list" && title().textContent === "Alfa",
    { expanded: t?.getAttribute("aria-expanded"), text: title().textContent });

  // 04. Lista cerrada al abrir
  ok("04_list_closed_on_open", !list() || !visible(list()), { exists: !!list() });

  // 05. Clic en el disparador: lista visible bajo el título, dentro del panel
  await clickEl(trigger(), 400);
  ok("05_open_list", trigger().getAttribute("aria-expanded") === "true" && visible(list()) && panel().contains(list()) && rect(list()).top >= rect(title()).bottom - 1,
    { expanded: trigger().getAttribute("aria-expanded"), listTop: rect(list())?.top, titleBottom: rect(title()).bottom });

  // 06. Una fila por mapa, en orden alfabético
  ok("06_alphabetical_rows", rows().length === 3 && rowNames().join("|") === "Alfa|beta|Ñu", rowNames());

  // 07. Miniatura 48×32 con cover y nombre en pixel
  const thumbs = $$(".viewer__map-thumb-img");
  ok("07_thumb_and_font", thumbs.length === 3 && thumbs.every((i) => Math.abs(rect(i).width - 48) <= 1 && Math.abs(rect(i).height - 32) <= 1 && css(i).objectFit === "cover" && i.complete && i.naturalWidth > 0)
    && $$(".viewer__map-row-name").every((n) => css(n).fontFamily.includes("Press Start 2P")),
    { sizes: thumbs.map((i) => [Math.round(rect(i).width), Math.round(rect(i).height)]) });

  // 08. Fila actual: aria-current, sin botón, sin ✓; las otras, botones
  const current = $('.viewer__map-row[aria-current="page"]');
  const others = rows().filter((r) => r !== current);
  ok("08_current_row", !!current && current.querySelector(".viewer__map-row-name").textContent === "Alfa" && current.tagName !== "BUTTON" && !current.querySelector("button") && !current.textContent.includes("✓")
    && others.length === 2 && others.every((r) => r.tagName === "BUTTON"), { current: current?.tagName, others: others.map((r) => r.tagName) });

  // 11. Segundo clic cierra
  await clickEl(trigger(), 300);
  ok("11_second_click_closes", trigger().getAttribute("aria-expanded") === "false" && !visible(list()));

  // 12. Esc cierra y devuelve el foco al disparador
  await clickEl(trigger(), 300);
  const openedForEsc = visible(list());
  rows().find((r) => r.tagName === "BUTTON").focus();
  await window.cdpKey("Escape"); await sleep(300);
  ok("12_esc_closes_and_focuses", openedForEsc && !visible(list()) && trigger().getAttribute("aria-expanded") === "false" && document.activeElement === trigger(), { active: document.activeElement?.className });

  // 13. Clic sobre el mapa cierra y no cambia de ruta
  await clickEl(trigger(), 300);
  const hashBefore = window.location.hash;
  await clickAt(window.innerWidth - 200, window.innerHeight - 100, 400);
  ok("13_click_outside_closes", !visible(list()) && trigger().getAttribute("aria-expanded") === "false" && window.location.hash === hashBefore, { hash: window.location.hash });

  // 14. Contraer el panel cierra la lista
  await clickEl(trigger(), 300);
  const openedForToggle = visible(list());
  await clickEl($(".viewer__toggle"), 500);
  const closedByToggle = !visible(list()) && trigger().getAttribute("aria-expanded") === "false";
  await clickEl($(".viewer__toggle"), 500); // volver a expandir
  ok("14_collapse_closes", openedForToggle && closedByToggle);

  // 17. Rueda sobre la lista no cambia el zoom
  await clickEl(trigger(), 300);
  const zoom0 = map.getZoom();
  const lr = rect(list());
  await input([M("mouseWheel", lr.left + lr.width / 2, lr.top + lr.height / 2, { deltaX: 0, deltaY: -300 })], 800);
  ok("17_wheel_on_list_no_zoom", Math.abs(map.getZoom() - zoom0) < 1e-6, { zoom0, zoom: map.getZoom() });

  // 15. Tab recorre solo las filas que no son el actual; Enter abre
  trigger().focus();
  const visited = [];
  for (let i = 0; i < 3; i++) { await tab(); visited.push(document.activeElement); }
  const tabOk = visited[0]?.classList.contains("viewer__map-row") && visited[1]?.classList.contains("viewer__map-row") && visited[0] !== visited[1]
    && !visited.slice(0, 2).some((r) => r.getAttribute("aria-current")) && !visited[2]?.classList.contains("viewer__map-row");
  const firstTabbed = visited[0];
  const targetName = firstTabbed?.querySelector(".viewer__map-row-name")?.textContent;
  const targetId = firstTabbed?.dataset.mapId;
  firstTabbed.focus(); // el tercer Tab cayó en la pestaña del panel: Enter va a la primera fila
  await window.cdpKey("Enter");
  await waitFor(() => window.location.hash === "#/map/" + targetId); await waitFor(() => !!$(".leaflet-image-layer")?.complete); await sleep(600);
  ok("15_tab_and_enter", tabOk && window.location.hash === "#/map/" + targetId && title().textContent === targetName, { hash: window.location.hash, targetId, targetName, title: title().textContent, tabOk });

  // 09. Saltar con clic: visor remontado con vista ajustada, panel contraído (SPEC 08) y lista cerrada
  await waitFor(() => !!trigger());
  await expandPanel();
  await clickEl(trigger(), 400);
  const fromId = window.location.hash.replace("#/map/", "");
  const jumpRow = rows().find((r) => r.tagName === "BUTTON" && r.dataset.mapId !== fromId);
  const jumpName = jumpRow.querySelector(".viewer__map-row-name").textContent, jumpId = jumpRow.dataset.mapId;
  await clickEl(jumpRow, 300);
  await waitFor(() => window.location.hash === "#/map/" + jumpId); await waitFor(() => !!$(".leaflet-image-layer")?.complete); await sleep(700);
  const fit = ir();
  const fitOk = (Math.abs(fit.width - window.innerWidth) <= 2 || Math.abs(fit.height - window.innerHeight) <= 2) && fit.width <= window.innerWidth + 2 && fit.height <= window.innerHeight + 2;
  ok("09_jump_remounts", window.location.hash === "#/map/" + jumpId && title().textContent === jumpName && fitOk && $(".viewer").classList.contains("viewer--panel-collapsed")
    && !visible(list()) && (!trigger() || trigger().getAttribute("aria-expanded") === "false"), { hash: window.location.hash, jumpId, jumpName, title: title().textContent, fit: [fit.width, fit.height], win: [window.innerWidth, window.innerHeight], collapsed: $(".viewer").classList.contains("viewer--panel-collapsed"), listVisible: visible(list()) });

  // 10. Atrás vuelve al mapa anterior
  history.back();
  await waitFor(() => window.location.hash === "#/map/" + fromId); await sleep(700);
  ok("10_history_back", window.location.hash === "#/map/" + fromId, window.location.hash);

  // 18. Si listByName falla, el mapa se abre y el título es texto
  window.location.hash = "#/"; await sleep(500);
  const realList = ms.listByName;
  ms.listByName = () => Promise.reject(new Error("fallo simulado (spec-07 criterio 18)"));
  await openViewer(id("Alfa")); await sleep(300);
  ms.listByName = realList;
  ok("18_list_failure_still_opens", !!$(".leaflet-image-layer") && title().textContent === "Alfa" && !title().querySelector("button") && !trigger(), { text: title().textContent });

  // 03. Con 1 mapa, sin botón ni svg
  window.location.hash = "#/"; await sleep(500);
  await openViewer(soloId); await sleep(300);
  ok("03_single_map_no_trigger", title().textContent === "Unico" && !title().querySelector("button") && !title().querySelector("svg") && !trigger(), { text: title().textContent });

  // 16. Muchos mapas: el panel hace scroll y su alto no cambia
  window.location.hash = "#/"; await sleep(500);
  await openViewer(manyId); await waitFor(() => !!trigger());
  const hBefore = rect(panel()).height;
  await clickEl(trigger(), 400);
  const hAfter = rect(panel()).height;
  ok("16_scroll_fixed_height", rows().length === 14 && panel().scrollHeight > panel().clientHeight + 1 && Math.abs(hAfter - hBefore) <= 1 && Math.abs(hAfter - window.innerHeight / 2) <= 1 && ["auto", "scroll"].includes(css(panel()).overflowY),
    { rows: rows().length, scrollH: panel().scrollHeight, clientH: panel().clientHeight, hBefore, hAfter });

  // 19. Sin object URLs de miniaturas ni listeners de pointerdown tras saltar varias veces y salir
  window.location.hash = "#/game/" + game.id; await sleep(900);
  const urlsBase = liveUrls.size; // miniaturas de la biblioteca del juego
  for (const name of ["Alfa", "beta", "Ñu"]) {
    await openViewer(id(name)); await waitFor(() => !!trigger());
    await clickEl(trigger(), 300);
  }
  const duringUrls = liveUrls.size;
  window.location.hash = "#/game/" + game.id; await sleep(700);
  pageError = null;
  await clickAt(300, 400, 300);
  ok("19_no_leaks_after_exit", duringUrls > urlsBase && liveUrls.size === urlsBase && pdListeners.size === 0 && !pageError, { urlsBase, duringUrls, after: liveUrls.size, listeners: pdListeners.size, pageError });

  // 20b. Foco visible en disparador y filas (contorno hacia dentro)
  await openViewer(id("Alfa")); await waitFor(() => !!trigger());
  await clickEl(trigger(), 300);
  const focusInfo = [];
  document.activeElement?.blur();
  $(".viewer__back").focus();
  for (let i = 0; i < 6 && focusInfo.length < 3; i++) {
    await tab();
    const a = document.activeElement;
    if (a === trigger() || (a.classList.contains("viewer__map-row"))) focusInfo.push({ visible: a.matches(":focus-visible"), style: css(a).outlineStyle, width: css(a).outlineWidth, offset: parseFloat(css(a).outlineOffset) });
  }
  ok("20_focus_visible", focusInfo.length === 3 && focusInfo.every((f) => f.visible && f.style !== "none" && parseFloat(f.width) >= 2 && f.offset < 0), focusInfo);

  window.location.hash = "#/";
  return { criteria: Object.fromEntries(Object.entries(C).sort()) };
})()
