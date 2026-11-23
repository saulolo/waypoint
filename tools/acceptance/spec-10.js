// Prueba de aceptación de SPEC 10 (textos en el mapa; botones por grupo; confirmaciones compactas).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-10.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } } }, numerados por orden en la spec.
// Notas:
//   - "Recargar" (17) se hace remontando el visor (pasar por "#/" y volver), como en spec-08.js.
//   - Pantalla completa (25) se simula como en spec-06.js (headless la rechaza).
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval
//       (16, 18 y 20 provocan a propósito errores "[label-editor]" / "[label-layer]" en consola).
//       01b comprueba además que no hay errores de página sin capturar.
//   02  base v2 → v3: abrir con este código un perfil creado con el de SPEC 09 (ver paso 1 de la spec).
//   31  grep "indexedDB" js/ui (sin usos).
//   32  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   33  spec-01.js a spec-09.js y este script pasan con un WP_PROFILE vacío.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const C = {};
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const css = (e) => getComputedStyle(e);
  const input = async (ev, wait = 0) => { await window.cdpInput(JSON.stringify(ev)); if (wait) await sleep(wait); };
  const M = (type, x, y, extra = {}) => ["Input.dispatchMouseEvent", Object.assign({ type, x, y }, extra)];
  const clickAt = (x, y, wait = 400) => input([M("mouseMoved", x, y), M("mousePressed", x, y, { button: "left", clickCount: 1 }), M("mouseReleased", x, y, { button: "left", clickCount: 1 })], wait);
  const ctr = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const clickEl = (e, wait) => { const c = ctr(e); return clickAt(c.x, c.y, wait); };
  const drag = async (x0, y0, x1, y1, steps = 10) => {
    const ev = [M("mouseMoved", x0, y0), M("mousePressed", x0, y0, { button: "left", clickCount: 1 })];
    for (let i = 1; i <= steps; i++) ev.push(M("mouseMoved", x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, { buttons: 1 }));
    await input(ev, 120);
    await input([M("mouseMoved", x1, y1, { buttons: 1 })], 100);
    await input([M("mouseReleased", x1, y1, { button: "left", clickCount: 1 })], 500);
  };
  const wheelAt = (x, y, dy = -300) => input([M("mouseWheel", x, y, { deltaX: 0, deltaY: dy })], 900);
  const tab = (shift) => input([["Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 }], ["Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 }]], 120);
  const esc = async () => { await window.cdpKey("Escape"); await sleep(300); };
  const typeText = (text) => input([["Input.insertText", { text }]], 150);
  const reducedMotion = (on) => input([["Emulation.setEmulatedMedia", { features: on ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [] }]], 200);
  const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
  const notices = () => $$(".notice__message").map((n) => n.textContent);
  const clearNotices = () => $$(".notice").forEach((n) => n.remove());
  const tokenColor = (name) => { const s = document.createElement("span"); s.style.color = "var(" + name + ")"; document.body.appendChild(s); const c = css(s).color; s.remove(); return c; };

  let map = null;
  L.Map.addInitHook(function () { map = this; });
  let pageError = null;
  window.addEventListener("error", (e) => { pageError = e.message; });

  const png = async (name, w, h, color) => {
    const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, w, h);
    return new File([await c.convertToBlob({ type: "image/png" })], name, { type: "image/png" });
  };
  const W = Waypoint;
  const gs = W.services.gameService, ms = W.services.mapService, mk = W.services.markerService, ls = W.services.labelService;
  const conn = await W.data.db.open();
  const allLabels = () => new Promise((r) => { const q = conn.transaction("labels").objectStore("labels").getAll(); q.onsuccess = () => r(q.result); });

  const g1 = await gs.create("Juego textos", null);
  const [mapA, mapB] = (await ms.importFiles(g1.id, [await png("Mapa A.png", 1200, 800, "hsl(120,30%,40%)"), await png("Mapa B.png", 1200, 800, "hsl(30,30%,45%)")])).imported.sort((a, b) => a.name.localeCompare(b.name));

  const openViewer = async (id) => {
    if (window.location.hash === "#/map/" + id) { window.location.hash = "#/"; await sleep(400); }
    window.location.hash = "#/map/" + id;
    await waitFor(() => !!$(".leaflet-image-layer")?.complete); await sleep(600);
  };
  const btns = () => $$(".view-controls__btn");
  const addLabelBtn = () => btns()[0], addPinBtn = () => btns()[1];
  const editor = () => $(".label-editor");
  const textInput = () => $(".label-editor__text"), noteInput = () => $(".label-editor__note");
  const range = () => $(".label-editor input[type=range]");
  const actionBtns = () => [...editor().querySelectorAll(".dialog__actions .btn")];
  const cancelBtn = () => actionBtns()[0], saveBtn = () => actionBtns()[1];
  const draftText = () => $(".label--draft .label-text");
  const savedTexts = () => $$(".leaflet-marker-icon.label:not(.label--draft) .label-text");
  const savedByText = (t) => savedTexts().find((e) => e.textContent === t);
  const stageRect = () => $(".viewer__stage").getBoundingClientRect();
  const openEditor = async () => { await clickEl(addLabelBtn(), 700); await waitFor(() => !!editor()); };
  const setRange = (v) => { range().value = String(v); range().dispatchEvent(new Event("input", { bubbles: true })); };
  const pickColor = (key) => clickEl($('.label-editor .pin-editor__color[value="' + key + '"]'), 150);
  const containerPoint = (x, y) => map.latLngToContainerPoint(L.latLng(800 * (1 - y), 1200 * x));

  try {
  // ================= 27. validación del servicio =================
  const base = { x: 0.5, y: 0.5, text: "Ok", note: "", color: "white", size: 12 };
  const bad = [{ size: 13 }, { size: 34 }, { color: "pink" }, { x: 1.2 }, { text: "" }, { text: "x".repeat(41) }];
  const throws = [];
  for (const p of bad) { try { await ls.create(mapA.id, Object.assign({}, base, p)); throws.push(false); } catch (e) { throws.push(e instanceof ls.InvalidLabelError); } }
  ok("27_validacion_servicio", throws.every(Boolean) && (await allLabels()).length === 0, { throws, n: (await allLabels()).length });

  // ================= panel y borrador =================
  await openViewer(mapA.id);
  const b = btns(), rects = b.map((e) => e.getBoundingClientRect());
  const blocks = b.map((e) => e.closest(".leaflet-bar"));
  const separate = blocks.every((bx, i) => bx && blocks.indexOf(bx) === i);
  ok("03_cuatro_botones", b.length === 4 && separate && b[0].tagName === "BUTTON" && b[0].getAttribute("aria-label") === "Añadir texto" && b[1].getAttribute("aria-label") === "Añadir pin" && rects[0].bottom < rects[1].top,
    b.map((e) => e.getAttribute("aria-label")));
  // foco visible en "Añadir texto" con Tab real
  document.activeElement.blur();
  let focusInfo = null;
  for (let i = 0; i < 12 && !focusInfo; i++) { await tab(); if (document.activeElement === addLabelBtn()) focusInfo = { fv: addLabelBtn().matches(":focus-visible"), style: css(addLabelBtn()).outlineStyle, offset: parseFloat(css(addLabelBtn()).outlineOffset) }; }
  C["03b_foco_anadir_texto"] = { pass: !!focusInfo && focusInfo.fv && focusInfo.style !== "none" && focusInfo.offset < 0, detail: focusInfo };

  await openEditor();
  const ed = editor();
  const labels = [...ed.querySelectorAll(".dialog__label")].map((e) => e.textContent);
  ok("04_panel", ed.tagName === "ASIDE" && ed.parentElement.classList.contains("viewer") && ed.querySelector(".label-editor__title").textContent === "Añadir texto" && css(ed.querySelector(".label-editor__title")).textTransform === "uppercase"
    && JSON.stringify(labels) === JSON.stringify(["Texto", "Nota", "Color", "Tamaño"]) && ed.querySelectorAll(".pin-editor__color").length === 8
    && cancelBtn().textContent === "Cancelar" && saveBtn().textContent === "Guardar" && document.activeElement === textInput() && ed.getBoundingClientRect().right > innerWidth - 40,
    { labels, focus: document.activeElement === textInput() });
  ok("05_controles_ocultos", $(".viewer").classList.contains("viewer--adding-label") && css($(".leaflet-bottom.leaflet-right")).display === "none", null);
  const sr = stageRect(), er = ed.getBoundingClientRect(), dc = ctr(draftText());
  ok("06_centro_zona_libre", near(dc.x, sr.left + (er.left - sr.left) / 2) && near(dc.y, sr.top + sr.height / 2), { dc, expected: [sr.left + (er.left - sr.left) / 2, sr.top + sr.height / 2] });
  ok("23_sin_ultimo_usado_por_defecto", !ed.querySelector(".pin-editor__last") && !/Último usado/.test(ed.textContent) && css(draftText()).color === tokenColor("--color-pin-white") && css(draftText()).fontSize === "12px" && range().value === "12", null);

  const emptyOk = saveBtn().disabled && draftText().textContent === "Texto" && parseFloat(css(draftText()).opacity) < 1;
  await typeText("   ");
  const spacesOk = saveBtn().disabled && draftText().textContent === "Texto";
  textInput().value = ""; textInput().dispatchEvent(new Event("input"));
  await typeText("Ciudad Ceniza");
  ok("08_guardar_deshabilitado", emptyOk && spacesOk && !saveBtn().disabled && draftText().textContent === "Ciudad Ceniza" && css(draftText()).opacity === "1", { emptyOk, spacesOk });
  ok("09_limites", textInput().maxLength === 40 && noteInput().maxLength === 500, { text: textInput().maxLength, note: noteInput().maxLength });

  await pickColor("red");
  const redOk = css(draftText()).color === tokenColor("--color-pin-red");
  await pickColor("black");
  const blackOutline = css(draftText()).webkitTextStrokeColor === tokenColor("--color-pin-outline-light");
  ok("10_color_y_contorno", redOk && blackOutline, { redOk, blackOutline });
  setRange(20); await sleep(100);
  ok("11_tamano", range().min === "8" && range().max === "32" && range().step === "2" && css(draftText()).fontSize === "20px" && $(".label-editor__size-value").textContent === "20 px", { fs: css(draftText()).fontSize });

  // 26. clic, arrastre y rueda sobre el panel
  const z0 = map.getZoom(), c0 = map.getCenter(), d0 = ctr(draftText());
  // Sobre el título: fuera de los controles, para no cambiar el texto, el color ni el tamaño.
  const tr = ed.querySelector(".label-editor__title").getBoundingClientRect();
  await clickAt(tr.right + 10, tr.top + tr.height / 2, 300);
  await drag(tr.right + 10, tr.top + tr.height / 2, er.left - 200, er.top + 300);
  await wheelAt(tr.right + 10, tr.top + tr.height / 2);
  const d1 = ctr(draftText());
  ok("26_panel_aislado", Math.abs(map.getZoom() - z0) < 0.001 && map.getCenter().equals(c0) && near(d1.x, d0.x) && near(d1.y, d0.y), { z0, z1: map.getZoom() });

  // 13. mover el borrador
  let p0 = ctr(draftText());
  await drag(p0.x, p0.y, p0.x + 100, p0.y);
  let p1 = ctr(draftText());
  const dragOk = near(p1.x - p0.x, 100) && near(p1.y, p0.y) && map.getCenter().equals(c0);
  await clickAt(300, 600, 400);
  p1 = ctr(draftText());
  const clickOk = near(p1.x, 300) && near(p1.y, 600);
  p0 = ctr(draftText());
  await drag(p0.x, p0.y, 5, p0.y, 15);
  const edgeLng = map.containerPointToLatLng(L.point(ctr(draftText()).x - stageRect().left, ctr(draftText()).y - stageRect().top)).lng;
  ok("13_mover_borrador", dragOk && clickOk && near(edgeLng, 0, 0.5), { dragOk, clickOk, edgeLng });

  // 16. errores al guardar
  await clickAt(640, 300, 300);
  await pickColor("red");
  noteInput().focus(); await typeText("línea 1\nlínea 2");
  const realCreate = ls.create;
  ls.create = () => Promise.reject(new DOMException("q", "QuotaExceededError"));
  await clickEl(saveBtn(), 400);
  const quota = notices().includes("No queda espacio para guardar el texto.") && !!editor() && !!draftText();
  clearNotices();
  ls.create = () => Promise.reject(new Error("boom"));
  await clickEl(saveBtn(), 400);
  const other = notices().includes("No se pudo guardar el texto.") && !!editor() && !!draftText();
  clearNotices();
  ls.create = realCreate;
  ok("16_errores_guardar", quota && other && (await allLabels()).length === 0, { quota, other });

  // 15. guardar
  const before = ctr(draftText());
  await clickEl(saveBtn(), 700);
  const recs = await allLabels();
  const rec = recs[0];
  const savedEl = savedByText("Ciudad Ceniza");
  const after = savedEl ? ctr(savedEl) : { x: -1, y: -1 };
  ok("15_guardar", recs.length === 1 && rec.text === "Ciudad Ceniza" && rec.note === "línea 1\nlínea 2" && rec.color === "red" && rec.size === 20 && rec.mapId === mapA.id
    && rec.x >= 0 && rec.x <= 1 && rec.y >= 0 && rec.y <= 1 && typeof rec.createdAt === "number" && !editor() && !$(".viewer").classList.contains("viewer--adding-label")
    && document.activeElement === addLabelBtn() && near(after.x, before.x) && near(after.y, before.y), { rec, before, after });

  // 12. fuente, una línea y tamaño fijo con zoom
  const h0 = savedEl.getBoundingClientRect().height;
  await wheelAt(after.x, after.y, -300);
  const h1 = savedByText("Ciudad Ceniza").getBoundingClientRect().height;
  ok("12_fuente_y_tamano_fijo", /Press Start 2P/.test(css(savedEl).fontFamily) && css(savedEl).whiteSpace === "nowrap" && near(h0, h1, 1), { h0, h1 });

  // 23 (cont.). Tras guardar, el siguiente vuelve a Blanco y 12 px
  await openEditor();
  const defAgain = css(draftText()).color === tokenColor("--color-pin-white") && css(draftText()).fontSize === "12px";
  // 14. Esc, Cancelar y cambio de ruta
  await esc();
  const escOk = !editor() && !draftText() && document.activeElement === addLabelBtn() && css($(".leaflet-bottom.leaflet-right")).display !== "none";
  await openEditor(); await clickEl(cancelBtn(), 300);
  const cancelOk = !editor() && !draftText() && document.activeElement === addLabelBtn();
  await openEditor();
  window.location.hash = "#/"; await sleep(500);
  const routeOk = !editor() && !$(".label--draft");
  ok("14_cancelar", escOk && cancelOk && routeOk && (await allLabels()).length === 1, { escOk, cancelOk, routeOk });
  C["23_sin_ultimo_usado_por_defecto"].pass = C["23_sin_ultimo_usado_por_defecto"].pass && defAgain;

  // 07. movimiento reducido
  await openViewer(mapA.id);
  await reducedMotion(true);
  addLabelBtn().click();
  await new Promise((r) => requestAnimationFrame(r));
  const yFirst = ctr(draftText()).y; await sleep(500);
  const yEnd = ctr(draftText()).y;
  await esc();
  await reducedMotion(false);
  ok("07_movimiento_reducido", near(yFirst, yEnd), { yFirst, yEnd });

  // 17. tras recargar, en su sitio; los de otro mapa no
  await ls.create(mapB.id, { x: 0.5, y: 0.5, text: "Otro mapa", note: "", color: "white", size: 12 });
  await openViewer(mapA.id);
  const reloaded = savedByText("Ciudad Ceniza");
  const exp = containerPoint(rec.x, rec.y), got = ctr(reloaded), sr2 = stageRect();
  ok("17_recargar", savedTexts().length === 1 && near(got.x - sr2.left, exp.x) && near(got.y - sr2.top, exp.y) && css(reloaded).color === tokenColor("--color-pin-red") && css(reloaded).fontSize === "20px", { n: savedTexts().length });

  // 19. popup
  await clickEl(reloaded, 500);
  const pop = $(".label-popup");
  const popOk = !!pop && css(pop.querySelector(".leaflet-popup-content-wrapper")).backgroundColor === tokenColor("--color-surface")
    && /Press Start 2P/.test(css(pop.querySelector(".label-popup__text")).fontFamily) && pop.querySelector(".pin-popup__note")?.textContent === "línea 1\nlínea 2"
    && css(pop.querySelector(".pin-popup__note")).whiteSpace === "pre-wrap" && pop.querySelector(".label-popup__delete")?.textContent === "Borrar";
  await esc();
  const noNoteId = (await ls.create(mapA.id, { x: 0.2, y: 0.2, text: "Sin nota", note: "", color: "white", size: 12 })).id;
  await openViewer(mapA.id);
  await clickEl(savedByText("Sin nota"), 500);
  const noNote = !!$(".label-popup") && !$(".label-popup .pin-popup__note");
  await esc();
  ok("19_popup", popOk && noNote && !$(".label-popup"), { popOk, noNote });

  // 20. arrastrar un guardado
  let s0 = ctr(savedByText("Ciudad Ceniza")); const cBefore = map.getCenter();
  await drag(s0.x, s0.y, s0.x + 100, s0.y);
  let s1 = ctr(savedByText("Ciudad Ceniza"));
  const moved = (await allLabels()).find((l) => l.id === rec.id);
  const moveOk = near(s1.x - s0.x, 100) && near(s1.y, s0.y) && map.getCenter().equals(cBefore) && moved.x > rec.x && moved.createdAt === rec.createdAt && !$(".label-popup");
  const realMove = ls.move;
  ls.move = () => Promise.reject(new Error("x"));
  s0 = ctr(savedByText("Ciudad Ceniza"));
  await drag(s0.x, s0.y, s0.x - 100, s0.y); await sleep(200);
  s1 = ctr(savedByText("Ciudad Ceniza"));
  const revertOk = notices().includes("No se pudo mover el texto.") && near(s1.x, s0.x) && near(s1.y, s0.y);
  ls.move = realMove; clearNotices();
  ok("20_arrastrar_guardado", moveOk && revertOk, { moveOk, revertOk });

  // 21. modo colocar con los dos editores
  const target = () => ctr(savedByText("Sin nota"));
  await openEditor();
  let t = target(); await clickAt(t.x, t.y, 500);
  let dd = ctr(draftText());
  const inLabel = !$(".label-popup") && near(dd.x, t.x) && near(dd.y, t.y);
  await esc();
  await clickEl(addPinBtn(), 700);
  t = target(); await clickAt(t.x, t.y, 500);
  dd = ctr($(".pin--draft"));
  const inPin = !$(".label-popup") && near(dd.x, t.x) && near(dd.y, t.y);
  await esc();
  t = target(); await clickAt(t.x, t.y, 500);
  const popupBack = !!$(".label-popup");
  await esc();
  ok("21_modo_colocar", inLabel && inPin && popupBack, { inLabel, inPin, popupBack });

  // 22. borrar con confirmación (también comprueba que es compacta)
  await clickEl(savedByText("Sin nota"), 500);
  $(".label-popup__delete").click(); await sleep(400);
  const dlg = $("dialog[open]");
  const dlgOk = !!dlg && dlg.querySelector(".dialog__title").textContent === "¿Borrar texto?";
  const compactW = dlg ? Math.round(dlg.getBoundingClientRect().width) : 0;
  const compactCls = !!dlg && dlg.classList.contains("dialog--compact");
  await clickEl([...dlg.querySelectorAll(".btn")].find((x) => x.textContent === "Cancelar"), 400);
  const kept = !!savedByText("Sin nota") && (await allLabels()).some((l) => l.id === noNoteId);
  if (!$(".label-popup")) await clickEl(savedByText("Sin nota"), 500);
  $(".label-popup__delete").click(); await sleep(400);
  await clickEl($("dialog[open] .btn--danger"), 600);
  const gone = !savedByText("Sin nota") && !(await allLabels()).some((l) => l.id === noNoteId);
  ok("22_borrar", dlgOk && kept && gone, { dlgOk, kept, gone });

  // 18. fallo al cargar
  const realList = ls.listByMap;
  ls.listByMap = () => Promise.reject(new Error("x"));
  await openViewer(mapA.id);
  const loadFail = notices().includes("No se pudieron cargar los textos.") && !!$(".leaflet-image-layer") && savedTexts().length === 0;
  ls.listByMap = realList; clearNotices();
  ok("18_fallo_carga", loadFail, null);

  // 24. filtros de pines no afectan
  await mk.create(mapA.id, { x: 0.7, y: 0.7, name: "P", note: "", icon: "pointer", color: "gold", size: 32 });
  await openViewer(mapA.id);
  if ($(".viewer__toggle").getAttribute("aria-expanded") !== "true") await clickEl($(".viewer__toggle"), 400);
  await waitFor(() => $$(".viewer__pin-filter-btn").every((x) => !x.disabled));
  for (const fb of $$(".viewer__pin-filter-btn")) if (fb.getAttribute("aria-pressed") === "true") await clickEl(fb, 300);
  const filtersOff = $$(".viewer__pin-filter-btn").every((x) => x.getAttribute("aria-pressed") === "false");
  ok("24_filtros_no_afectan", filtersOff && $$(".leaflet-marker-icon.pin").length === 0 && savedTexts().length === 1, { pins: $$(".leaflet-marker-icon.pin").length, texts: savedTexts().length });
  for (const fb of $$(".viewer__pin-filter-btn")) await clickEl(fb, 300);
  await clickEl($(".viewer__toggle"), 400);

  // 25. pantalla completa simulada
  let fsEl = null;
  Object.defineProperty(document, "fullscreenElement", { get: () => fsEl, configurable: true });
  const fire = () => document.dispatchEvent(new Event("fullscreenchange"));
  const realReq = Element.prototype.requestFullscreen, realExit = document.exitFullscreen;
  Element.prototype.requestFullscreen = function () { fsEl = this; setTimeout(fire, 0); return Promise.resolve(); };
  document.exitFullscreen = function () { fsEl = null; setTimeout(fire, 0); return Promise.resolve(); };
  await clickEl($('.view-controls__btn[aria-label="Pantalla completa"]'), 500);
  await openEditor();
  const fsOk = $(".viewer").classList.contains("viewer--fullscreen") && editor().getBoundingClientRect().width > 0;
  await clickEl(cancelBtn(), 300);
  window.location.hash = "#/"; await sleep(500);
  Element.prototype.requestFullscreen = realReq; document.exitFullscreen = realExit;
  delete document.fullscreenElement;
  ok("25_pantalla_completa", fsOk, null);

  // 29 (botones por grupo) y 30 (confirmaciones compactas)
  const P = tokenColor("--color-neon-purple"), G = tokenColor("--color-neon-gold"), Cy = tokenColor("--color-neon-cyan"), Mg = tokenColor("--color-neon-magenta");
  const border = (e) => css(e).borderTopColor;
  const cancels = [];
  let pr = W.ui.dialog.confirm({ title: "x", message: "y", confirmLabel: "Borrar", danger: true }); await sleep(300);
  let d = $("dialog[open]");
  cancels.push(border(d.querySelector(".btn--cancel")));
  const confirmDanger = border(d.querySelector(".btn--danger")) === Mg;
  const confirmW = Math.round(d.getBoundingClientRect().width), confirmCompact = d.classList.contains("dialog--compact");
  await tab(); await tab(true);
  const cf = document.activeElement;
  const cancelFocus = cf.classList.contains("btn--cancel") && cf.matches(":focus-visible") && css(cf).outlineColor === P && parseFloat(css(cf).outlineOffset) < 0;
  await esc(); await pr;
  pr = W.ui.dialog.rename({ title: "Renombrar", value: "a" }); await sleep(300);
  d = $("dialog[open]"); cancels.push(border(d.querySelector(".btn--cancel")));
  const renameSave = border(d.querySelector(".btn--primary")) === Cy;
  const renameW = Math.round(d.getBoundingClientRect().width), renameCompact = d.classList.contains("dialog--compact");
  await esc(); await pr;
  pr = W.ui.gameDialog.open({}); await sleep(300);
  d = $("dialog[open]"); cancels.push(border(d.querySelector(".btn--cancel")));
  const gameW = Math.round(d.getBoundingClientRect().width);
  await esc(); await pr;
  const cancelColors = cancels.map((x) => x === P);
  await openViewer(mapA.id);
  await openEditor(); const labelCancel = cancelBtn().classList.contains("btn--cancel") && border(cancelBtn()) === P && border(saveBtn()) === Cy; await esc();
  await clickEl(addPinBtn(), 700); const pc = $(".pin-editor .btn--cancel"); const pinCancel = !!pc && border(pc) === P; await esc();
  await clickEl($(".leaflet-marker-icon.pin"), 500);
  const edit = $(".pin-popup__edit");
  const editOk = !!edit && edit.classList.contains("btn--edit") && border(edit) === G && border($(".pin-popup__delete")) === Mg;
  await esc();
  ok("29_botones_por_grupo", cancelColors.every(Boolean) && labelCancel && pinCancel && editOk && confirmDanger && renameSave && cancelFocus, { cancelColors, labelCancel, pinCancel, editOk, confirmDanger, renameSave, cancelFocus });
  ok("30_confirmacion_compacta", compactCls && compactW === 320 && confirmCompact && confirmW === 320 && !renameCompact && renameW === 440 && gameW === 440, { compactW, confirmW, renameW, gameW });

  // 28. borrar el mapa o el juego borra sus textos
  const gDel = await gs.create("Juego a borrar", null);
  const [mX, mY] = (await ms.importFiles(gDel.id, [await png("X.png", 200, 100, "hsl(0,0%,50%)"), await png("Y.png", 200, 100, "hsl(0,0%,40%)")])).imported;
  await ls.create(mX.id, base); await ls.create(mY.id, base);
  await ms.remove(mX.id);
  const afterMap = (await allLabels()).filter((l) => l.mapId === mX.id).length === 0 && (await allLabels()).some((l) => l.mapId === mY.id);
  await gs.remove(gDel.id);
  const afterGame = (await allLabels()).filter((l) => l.mapId === mY.id).length === 0;
  ok("28_cascada", afterMap && afterGame, { afterMap, afterGame });

  C["01b_sin_errores_de_pagina"] = { pass: !pageError, detail: pageError };
  } catch (e) { C.__exception = { pass: false, detail: String(e && e.stack || e).slice(0, 400) }; }
  return JSON.stringify(C);
})()
