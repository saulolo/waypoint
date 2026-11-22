// Prueba de aceptación de SPEC 08 (pines en el mapa: crear, ver, mover y borrar).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-08.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } } }, numerados por orden en la spec.
// Notas:
//   - "Recargar" (31, 35) se hace remontando el visor (pasar por "#/" y volver): el script no
//     sobrevive a un F5, y el visor nuevo lee los pines de IndexedDB igual que tras recargar.
//   - Los arrastres se quedan quietos ~100 ms en el punto final antes de soltar: con entrada
//     sintética, Chrome headless puede perder el último mouseMoved si se suelta en seguida.
//   - Pantalla completa (46) se simula como en spec-06.js (headless la rechaza).
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval
//       (28, 30 y 36 provocan a propósito errores "[pin-editor]" / "[pin-layer]" en consola).
//       01b comprueba además que no hay errores de página sin capturar.
//   49  grep "indexedDB" js/ui (sin usos).
//   50  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   51  spec-01.js a spec-07.js y este script pasan con un WP_PROFILE vacío.
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
  const clickEl = (e, wait) => { e.scrollIntoView({ block: "nearest" }); const c = ctr(e); return clickAt(c.x, c.y, wait); };
  const moveTo = (x, y, wait = 300) => input([M("mouseMoved", x, y)], wait);
  const drag = async (x0, y0, x1, y1, steps = 10) => {
    const ev = [M("mouseMoved", x0, y0), M("mousePressed", x0, y0, { button: "left", clickCount: 1 })];
    for (let i = 1; i <= steps; i++) ev.push(M("mouseMoved", x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, { buttons: 1 }));
    await input(ev, 120);
    await input([M("mouseMoved", x1, y1, { buttons: 1 })], 100);
    await input([M("mouseReleased", x1, y1, { button: "left", clickCount: 1 })], 500);
  };
  const wheelAt = (x, y, dy = -300) => input([M("mouseWheel", x, y, { deltaX: 0, deltaY: dy })], 900);
  const key = (k, code, vk) => input([["Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }], ["Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }]], 60);
  const tab = () => key("Tab", "Tab", 9);
  const esc = async () => { await window.cdpKey("Escape"); await sleep(300); };
  const typeText = (text) => input([["Input.insertText", { text }]], 150);
  const reducedMotion = (on) => input([["Emulation.setEmulatedMedia", { features: on ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [] }]], 200);
  const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
  // ¿El pin pinta el glifo del icono? (se normaliza el SVG pasándolo por el DOM)
  const glyphIs = (el, id) => { const d = document.createElement("div"); d.innerHTML = Waypoint.ui.pinIcons.svg(id); return el.querySelector(".pin-glyph")?.innerHTML === d.querySelector(".pin-glyph").innerHTML; };
  const notices = () => $$(".notice__message").map((n) => n.textContent);
  const clearNotices = () => $$(".notice").forEach((n) => n.remove());
  // Color calculado de un token (para comparar con el del glifo).
  const tokenColor = (name) => { const s = document.createElement("span"); s.style.color = "var(" + name + ")"; document.body.appendChild(s); const c = css(s).color; s.remove(); return c; };

  let map = null;
  L.Map.addInitHook(function () { map = this; });
  let pageError = null;
  window.addEventListener("error", (e) => { pageError = e.message; });
  // Listeners de keydown en document (criterio 27).
  const keyListeners = new Set();
  const realAdd = document.addEventListener.bind(document), realRemove = document.removeEventListener.bind(document);
  document.addEventListener = (t, fn, o) => { if (t === "keydown") keyListeners.add(fn); return realAdd(t, fn, o); };
  document.removeEventListener = (t, fn, o) => { if (t === "keydown") keyListeners.delete(fn); return realRemove(t, fn, o); };

  const png = async (name, w, h, color) => {
    const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.fillStyle = color; g.fillRect(0, 0, w, h);
    return new File([await c.convertToBlob({ type: "image/png" })], name, { type: "image/png" });
  };
  const gs = Waypoint.services.gameService, ms = Waypoint.services.mapService, mk = Waypoint.services.markerService;
  const icons = Waypoint.ui.pinIcons;
  const conn = await Waypoint.data.db.open();
  const allMarkers = () => new Promise((r) => { const q = conn.transaction("markers").objectStore("markers").getAll(); q.onsuccess = () => r(q.result); });

  const g1 = await gs.create("Juego pines", null);
  const [mapA, mapB] = (await ms.importFiles(g1.id, [await png("Mapa A.png", 1200, 800, "hsl(120,30%,40%)"), await png("Mapa B.png", 1200, 800, "hsl(30,30%,45%)")])).imported.sort((a, b) => a.name.localeCompare(b.name));
  const g2 = await gs.create("Otro juego", null);
  const [mapD] = (await ms.importFiles(g2.id, [await png("Mapa D.png", 1200, 800, "hsl(200,30%,40%)")])).imported;

  const openViewer = async (id) => {
    if (window.location.hash === "#/map/" + id) { window.location.hash = "#/"; await sleep(400); }
    window.location.hash = "#/map/" + id;
    await waitFor(() => !!$(".leaflet-image-layer")?.complete && !!$(".view-controls__btn")); await sleep(500);
  };
  const addBtn = () => $('.view-controls__btn[aria-label="Añadir pin"]');
  const editor = () => $(".pin-editor"), picker = () => $(".pin-picker");
  const draftEl = () => $(".leaflet-marker-icon.pin--draft");
  const draftMarker = () => { let m = null; map.eachLayer((l) => { if (l instanceof L.Marker && l.getElement()?.classList.contains("pin--draft")) m = l; }); return m; };
  const savedEls = () => $$(".leaflet-marker-icon.pin:not(.pin--draft)");
  const savedEl = (color) => $(".leaflet-marker-icon.pin.pin--" + color + ":not(.pin--draft)");
  const nameInput = () => $(".pin-editor__name"), noteInput = () => $(".pin-editor__note");
  const colorRadio = (c) => $('.pin-editor__color[value="' + c + '"]');
  const iconBtn = () => $(".pin-editor__icon-btn"), lastBtn = () => $(".pin-editor__last");
  const cancelBtn = () => $$(".pin-editor__actions .btn").find((b) => b.textContent === "Cancelar");
  const saveBtn = () => $$(".pin-editor__actions .btn").find((b) => b.textContent === "Guardar");
  const range = () => $(".pin-picker__range");
  const setRange = async (v) => { range().value = String(v); range().dispatchEvent(new Event("input", { bubbles: true })); await sleep(100); };
  const toggleOf = (label) => $$(".pin-picker__toggle").find((t) => t.textContent === label);
  const chooseIcon = async (id) => {
    const radio = $('.pin-picker__radio[value="' + id + '"]');
    const grid = radio.closest(".pin-picker__grid");
    if (grid.hidden) { await clickEl(grid.parentElement.querySelector(".pin-picker__toggle"), 200); }
    await clickEl(radio, 250);
  };
  const openEditor = async () => {
    await clickEl(addBtn(), 300);
    await waitFor(() => !!editor() && !!draftEl()); await sleep(500);
  };
  const imageRect = () => $(".leaflet-image-layer").getBoundingClientRect();
  const stageRect = () => $(".viewer__stage").getBoundingClientRect();
  const zoneCenter = () => {
    const panel = $(".viewer__panel");
    const left = $(".viewer").classList.contains("viewer--panel-collapsed") ? 0 : panel.offsetWidth;
    return { x: (left + editor().getBoundingClientRect().left) / 2, y: stageRect().height / 2 };
  };
  const viewState = () => ({ z: map.getZoom(), c: map.getCenter() });
  const sameView = (a, b) => Math.abs(a.z - b.z) < 1e-6 && a.c.equals(b.c, 1e-6);
  const firstFrame = () => new Promise((resolve) => {
    const obs = new MutationObserver(() => {
      const el = draftEl(); if (!el) return;
      obs.disconnect();
      requestAnimationFrame(() => resolve(css(el.querySelector(".pin-glyph")).transform));
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
  const translateY = (t) => { if (!t || t === "none") return 0; const m = t.match(/matrix\(([^)]+)\)/); return m ? +m[1].split(",")[5] : NaN; };

  // ================= S1: abrir el panel en un juego sin pines =================
  await openViewer(mapA.id);
  const frameNormal = firstFrame();
  await openEditor();
  const tyNormal = translateY(await frameNormal);

  const labels = $$(".pin-editor .dialog__label").map((l) => l.textContent.trim());
  const title = $(".pin-editor__title");
  const btnTexts = $$(".pin-editor__actions .btn").map((b) => b.textContent);
  ok("02_editor_structure", !!editor() && editor().getBoundingClientRect().right >= innerWidth - 20 && title.textContent.toUpperCase() === "AÑADIR PIN" && css(title).textTransform === "uppercase"
    && ["Último usado", "Nombre", "Nota", "Color", "Icono"].every((l) => labels.includes(l)) && $$(".pin-editor__color").length === 8
    && btnTexts.join("|") === "Cancelar|Guardar" && document.activeElement === nameInput(),
    { labels, colors: $$(".pin-editor__color").length, btnTexts, active: document.activeElement?.className });

  const hiddenControls = () => [...$$(".view-controls__btn"), $(".leaflet-control-zoom")].every((e) => e.getBoundingClientRect().width === 0);
  const adding03 = $(".viewer").classList.contains("viewer--adding-pin") && hiddenControls();

  const z1 = zoneCenter(), d1 = ctr(draftEl());
  ok("05a_draft_center_collapsed", near(d1.x, z1.x) && near(d1.y, z1.y), { draft: d1, zone: z1 });

  ok("09_gold_color", css(draftEl()).color === "rgb(212, 175, 55)", css(draftEl()).color);

  ok("41_last_used_none", lastBtn().disabled && lastBtn().textContent.includes("Ninguno todavía") && $(".pin-editor__icon-text").textContent === icons.label("exclamation")
    && draftEl().classList.contains("pin--gold") && near(draftEl().getBoundingClientRect().width, 32, 1),
    { disabled: lastBtn().disabled, text: lastBtn().textContent, icon: $(".pin-editor__icon-text").textContent, width: draftEl().getBoundingClientRect().width });

  ok("11_max_lengths", nameInput().maxLength === 60 && noteInput().maxLength === 500, [nameInput().maxLength, noteInput().maxLength]);

  // Nombre → tooltip; vacío → etiqueta
  nameInput().focus(); await typeText("Hola");
  const tipTyped = draftMarker().getTooltip().getContent().textContent;
  nameInput().select(); await key("Backspace", "Backspace", 8); await sleep(100);
  const tipEmpty = draftMarker().getTooltip().getContent().textContent;
  ok("10_name_tooltip", tipTyped === "Hola" && tipEmpty === "Aviso" && nameInput().placeholder === "Aviso", { tipTyped, tipEmpty, placeholder: nameInput().placeholder });

  // Color del texto de la nota = el del nombre
  noteInput().focus(); await typeText("nota");
  ok("12_note_text_color", css(noteInput()).color === css(nameInput()).color && css(noteInput()).color !== "rgb(0, 0, 0)", [css(noteInput()).color, css(nameInput()).color]);

  // 15-20. Selector de iconos
  await clickEl(iconBtn(), 300);
  const pr = picker().getBoundingClientRect(), er = editor().getBoundingClientRect();
  const cats = $$(".pin-picker__category").map((c) => ({ label: c.querySelector(".pin-picker__toggle").textContent, n: c.querySelectorAll(".pin-picker__radio").length }));
  const allLabels = $$(".pin-picker__label").map((l) => l.textContent.trim());
  ok("13_picker_layout", !picker().hidden && pr.right <= er.left && cats.map((c) => c.label).join("|") === "Localizaciones|Enemigos|Tesoros|Equipo|Misiones|Información|Viaje"
    && cats.map((c) => c.n).join(",") === "9,8,7,6,6,8,9" && allLabels.length === 53 && allLabels.every(Boolean),
    { gap: er.left - pr.right, cats });
  const ids = icons.CATEGORIES.flatMap((c) => c.icons.map((i) => i.id));
  ok("14_icon_names", icons.label("shop") === "Compras" && icons.label("quest") === "Misión principal"
    && ["side-quest", "check", "cancel", "easter-egg", "search", "motorcycle", "medicine", "armor", "minigame"].every((i) => ids.includes(i)),
    { shop: icons.label("shop"), quest: icons.label("quest") });

  const state = () => $$(".pin-picker__toggle").filter((t) => t.getAttribute("aria-expanded") === "true").map((t) => t.textContent);
  const visibleRadios = () => $$(".pin-picker__radio").filter((r) => r.offsetParent !== null).length;
  const initialState = state(), initialVisible = visibleRadios();
  await clickEl(toggleOf("Tesoros"), 200);
  const tesorosOpen = toggleOf("Tesoros").getAttribute("aria-expanded") === "true" && visibleRadios() === 15;
  await clickEl(toggleOf("Tesoros"), 200);
  const tesorosClosed = toggleOf("Tesoros").getAttribute("aria-expanded") === "false" && visibleRadios() === 8;
  toggleOf("Viaje").focus(); await window.cdpKey("Enter"); await sleep(250);
  const viajeEnter = toggleOf("Viaje").getAttribute("aria-expanded") === "true";
  // Elegir un icono
  await clickEl($('.pin-picker__radio[value="boat"]'), 250);
  const viajeStill = toggleOf("Viaje").getAttribute("aria-expanded") === "true";
  ok("15_collapsible_categories", initialState.join() === "Información" && initialVisible === 8 && tesorosOpen && tesorosClosed && viajeEnter && viajeStill,
    { initialState, initialVisible, tesorosOpen, tesorosClosed, viajeEnter, viajeStill });
  ok("17_choose_icon", glyphIs(draftEl(), "boat") && $(".pin-editor__icon-text").textContent === "Barco" && !picker().hidden,
    { btn: $(".pin-editor__icon-text").textContent, pickerOpen: !picker().hidden });

  // Tab no entra en categorías contraídas
  toggleOf("Localizaciones").focus();
  const seen = [];
  for (let i = 0; i < 20; i++) { await tab(); const e = document.activeElement; if (!picker().contains(e)) break; seen.push(e); }
  const tabRadios = seen.filter((e) => e.classList.contains("pin-picker__radio"));
  ok("16_tab_skips_collapsed", tabRadios.length > 0 && tabRadios.every((r) => !r.closest(".pin-picker__grid").hidden), seen.map((e) => e.value || e.textContent));

  // Barra de tamaño
  const r = range();
  await setRange(48);
  const dr = draftEl().getBoundingClientRect();
  ok("18_size_range", r.min === "20" && r.max === "64" && r.step === "4" && near(dr.width, 48, 1) && near(dr.height, 48, 1) && $(".pin-picker__size-value").textContent === "48 px",
    { min: r.min, max: r.max, step: r.step, size: [dr.width, dr.height], out: $(".pin-picker__size-value").textContent });

  // Esc: primero el selector, luego cancela
  const countBefore = (await allMarkers()).length;
  await esc();
  const escPicker = picker().hidden && !!editor() && document.activeElement === iconBtn();
  await esc();
  ok("23_escape_order", escPicker && !editor() && !$(".pin-picker") && !draftEl() && (await allMarkers()).length === countBefore, { escPicker, editor: !!editor() });

  // 03 (cierre): los controles vuelven
  ok("03_adding_class_and_controls", adding03 && !$(".viewer").classList.contains("viewer--adding-pin") && !hiddenControls(), { adding03 });

  // ================= S2: mapa usable con el panel abierto; Cancelar =================
  await openEditor();
  const v0 = viewState();
  await wheelAt(300, 600);
  const v1 = viewState();
  await drag(300, 650, 420, 700);
  const v2 = viewState();
  ok("04_map_usable_while_adding", v1.z > v0.z + 0.1 && !v2.c.equals(v1.c), { z0: v0.z, z1: v1.z, moved: !v2.c.equals(v1.c) });
  await clickEl(cancelBtn(), 300);
  ok("24_cancel_button", !editor() && !$(".pin-picker") && !draftEl() && (await allMarkers()).length === countBefore && document.activeElement === addBtn(),
    { active: document.activeElement?.getAttribute("aria-label") });

  // ================= S3: zona libre con el panel expandido; aislamiento; colores =================
  await openViewer(mapA.id);
  await clickEl($(".viewer__toggle"), 500);
  await openEditor();
  const z2 = zoneCenter(), d2 = ctr(draftEl());
  ok("05b_draft_center_expanded", near(d2.x, z2.x) && near(d2.y, z2.y) && z2.x > z1.x, { draft: d2, zone: z2 });

  // Eventos sobre los paneles no llegan al mapa
  await clickEl(iconBtn(), 300);
  const v3 = viewState(), dPos = draftMarker().getLatLng();
  for (const panelEl of [editor(), picker()]) {
    const c = ctr(panelEl);
    await wheelAt(c.x, c.y);
    await drag(c.x, c.y + 40, c.x - 250, c.y + 60);
    await clickAt(c.x, panelEl.getBoundingClientRect().top + 12, 200);
  }
  ok("45_panels_isolated", sameView(v3, viewState()) && draftMarker().getLatLng().equals(dPos), { before: v3, after: viewState() });
  await esc(); // cierra el selector

  // Colores
  await clickEl(colorRadio("red"), 200);
  const redOk = css(draftEl()).color === tokenColor("--color-pin-red");
  await clickEl(colorRadio("black"), 200);
  const body = draftEl().querySelector(".pin-glyph__body");
  const blackOk = css(body).stroke === tokenColor("--color-pin-outline-light");
  ok("08_colors", redOk && blackOk, { red: redOk, stroke: css(body).stroke, outlineLight: tokenColor("--color-pin-outline-light") });
  await clickEl(cancelBtn(), 300);
  await clickEl($(".viewer__toggle"), 500); // contraer otra vez

  // Movimiento reducido: sin caída en el primer fotograma
  await reducedMotion(true);
  const frameReduced = firstFrame();
  await clickEl(addBtn(), 300);
  const tyReduced = translateY(await frameReduced);
  await waitFor(() => !!editor()); await sleep(300);
  await clickEl(cancelBtn(), 300);
  await reducedMotion(false);
  ok("07_reduced_motion", tyNormal < -10 && near(tyReduced, 0, 0.5), { tyNormal, tyReduced });

  // ================= S5: mover el borrador; errores al guardar; guardar sin nombre =================
  await openViewer(mapA.id);
  await openEditor();
  let c0 = ctr(draftEl()); const center0 = map.getCenter();
  await drag(c0.x, c0.y, c0.x + 100, c0.y);
  let c1 = ctr(draftEl());
  ok("20_drag_draft", near(c1.x - c0.x, 100) && near(c1.y, c0.y) && map.getCenter().equals(center0), { dx: c1.x - c0.x, dy: c1.y - c0.y });

  await clickAt(300, 300);
  c1 = ctr(draftEl());
  ok("21_click_places_draft", near(c1.x, 300) && near(c1.y, 300), c1);

  const img = imageRect();
  await clickAt(img.left - 20, 500); // fuera de la imagen, a la izquierda
  const relClick = Waypoint.ui.pinLayer.toRelative({ width: 1200, height: 800 }, draftMarker().getLatLng());
  c0 = ctr(draftEl());
  await drag(c0.x, c0.y, c0.x, 3); // arrastre fuera por arriba (la imagen llega al borde superior)
  await drag(ctr(draftEl()).x, ctr(draftEl()).y, img.left - 30, ctr(draftEl()).y);
  const relDrag = Waypoint.ui.pinLayer.toRelative({ width: 1200, height: 800 }, draftMarker().getLatLng());
  const in01 = (p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  ok("22_outside_image_clamped", in01(relClick) && near(relClick.x, 0, 1e-6) && in01(relDrag) && near(relDrag.x, 0, 1e-6), { relClick, relDrag });

  // Errores al guardar
  const zc = zoneCenter();
  await clickAt(zc.x, zc.y); // el pin dorado queda en el centro de la zona libre (criterio 06)
  const realCreate = mk.create;
  clearNotices();
  mk.create = () => Promise.reject(new DOMException("lleno", "QuotaExceededError"));
  await clickEl(saveBtn(), 500);
  const quotaMsg = notices().includes("No queda espacio para guardar el pin.");
  const stays1 = !!editor() && !!draftEl();
  clearNotices();
  mk.create = () => Promise.reject(new Error("fallo simulado (spec-08 criterio 30)"));
  await clickEl(saveBtn(), 500);
  const otherMsg = notices().includes("No se pudo guardar el pin.");
  const stays2 = !!editor() && !!draftEl();
  mk.create = realCreate;
  ok("28_save_errors", quotaMsg && otherMsg && stays1 && stays2, { quotaMsg, otherMsg, stays1, stays2 });

  // Guardar sin nombre → etiqueta del icono
  const goldSpot = ctr(draftEl());
  await clickEl(saveBtn(), 600);
  const afterEmpty = await allMarkers();
  ok("27_empty_name_uses_label", afterEmpty.length === 1 && afterEmpty[0].name === "Aviso" && !editor(), afterEmpty.map((m) => m.name));

  // ================= S6: el borrador no cae encima; guardar con todos los campos =================
  await openEditor();
  const zc6 = zoneCenter(), db6 = draftEl().getBoundingClientRect(), gb6 = savedEl("gold").getBoundingClientRect(), ir6 = imageRect();
  const dc6 = ctr(draftEl());
  const overlaps6 = db6.left < gb6.right && gb6.left < db6.right && db6.top < gb6.bottom && gb6.top < db6.bottom;
  const goldAtCenter = near(ctr(savedEl("gold")).x, zc6.x) && near(ctr(savedEl("gold")).y, zc6.y);
  ok("06_draft_avoids_saved_pin", goldAtCenter && !overlaps6 && dc6.x >= ir6.left && dc6.x <= ir6.right && dc6.y >= ir6.top && dc6.y <= ir6.bottom && Math.hypot(dc6.x - zc6.x, dc6.y - zc6.y) < 400,
    { goldAtCenter, overlaps: overlaps6, dist: Math.hypot(dc6.x - zc6.x, dc6.y - zc6.y) });
  nameInput().focus(); await typeText("Cofre del norte");
  noteInput().value = "Línea uno\nLínea dos"; noteInput().dispatchEvent(new Event("input", { bubbles: true }));
  await clickEl(colorRadio("red"), 200);
  await clickEl(iconBtn(), 300);
  await chooseIcon("chest");
  await setRange(40);
  await esc();
  await clickAt(350, 250);
  const redSpot = ctr(draftEl());
  await clickEl(saveBtn(), 700);
  const recs = await allMarkers();
  const red = recs.find((m) => m.name === "Cofre del norte");
  const redPin = savedEl("red");
  ok("26_save_full", !!red && red.note === "Línea uno\nLínea dos" && red.color === "red" && red.icon === "chest" && red.size === 40 && red.mapId === mapA.id
    && in01(red) && typeof red.createdAt === "number" && !editor() && !$(".pin-picker") && !!redPin && near(ctr(redPin).x, redSpot.x) && near(ctr(redPin).y, redSpot.y),
    { red, pin: redPin && ctr(redPin), spot: redSpot });

  // ================= cambiar de ruta con el panel abierto =================
  window.location.hash = "#/game/" + g1.id; await sleep(600);
  const baseKeys = keyListeners.size;
  await openViewer(mapA.id);
  await openEditor();
  await clickEl(iconBtn(), 300);
  window.location.hash = "#/game/" + g1.id; await sleep(600);
  pageError = null;
  await esc();
  ok("25_route_change_cleans", !editor() && !$(".pin-picker") && !draftEl() && keyListeners.size === baseKeys && !pageError, { keys: keyListeners.size, baseKeys, pageError });

  // ================= los pines siguen al volver (recarga) =================
  await openViewer(mapA.id);
  await waitFor(() => savedEls().length === 2);
  const toPoint = (m) => map.latLngToContainerPoint(Waypoint.ui.pinLayer.toLatLng({ width: 1200, height: 800 }, m.x, m.y));
  const placed = recs.map((m) => {
    const e = savedEl(m.color); const p = toPoint(m); const c = ctr(e);
    return { name: m.name, ok: near(c.x, p.x) && near(c.y, p.y) && near(e.getBoundingClientRect().width, m.size, 1) && glyphIs(e, m.icon), d: [c.x - p.x, c.y - p.y, e.getBoundingClientRect().width, glyphIs(e, m.icon)] };
  });
  await openViewer(mapB.id);
  const otherMapPins = savedEls().length;
  ok("29_persisted_per_map", placed.every((p) => p.ok) && otherMapPins === 0, { placed, otherMapPins });

  // Fallo al cargar los pines
  window.location.hash = "#/"; await sleep(400);
  clearNotices();
  const realList = mk.listByMap;
  mk.listByMap = () => Promise.reject(new Error("fallo simulado (spec-08 criterio 32)"));
  await openViewer(mapA.id); await sleep(300);
  mk.listByMap = realList;
  ok("30_load_failure", !!$(".leaflet-image-layer") && notices().includes("No se pudieron cargar los pines."), notices());

  // ================= tooltip y popup =================
  await openViewer(mapA.id);
  await waitFor(() => savedEls().length === 2);
  let rc = ctr(savedEl("red"));
  await moveTo(rc.x, rc.y, 400);
  const tipText = $(".leaflet-tooltip.pin-tooltip")?.textContent;
  await clickAt(rc.x, rc.y, 500);
  const popup = $(".pin-popup");
  const wrapper = popup && popup.querySelector(".leaflet-popup-content-wrapper");
  const pname = popup && popup.querySelector(".pin-popup__name"), pnote = popup && popup.querySelector(".pin-popup__note");
  ok("31_tooltip_and_popup", tipText === "Cofre del norte" && !!popup && css(wrapper).backgroundColor !== "rgb(255, 255, 255)" && css(pname).fontFamily.includes("Press Start 2P")
    && pnote?.textContent === "Línea uno\nLínea dos" && css(pnote).whiteSpace === "pre-wrap" && !!popup.querySelector(".pin-popup__delete")?.textContent.includes("Borrar"),
    { tipText, bg: wrapper && css(wrapper).backgroundColor, note: pnote?.textContent });
  ok("35_click_opens_popup", !!popup);
  await esc();
  const gc = ctr(savedEl("gold"));
  await clickAt(gc.x, gc.y, 500);
  ok("32_no_note_paragraph", !!$(".pin-popup") && !$(".pin-popup .pin-popup__note"), { popup: !!$(".pin-popup") });
  await esc();

  // Tamaño fijo al hacer zoom
  const w0 = savedEl("red").getBoundingClientRect().width;
  await wheelAt(700, 600);
  const w1 = savedEl("red").getBoundingClientRect().width;
  ok("19_fixed_size_on_zoom", near(w0, w1, 1) && near(w0, 40, 1), { w0, w1 });

  // ================= mover pines guardados =================
  await openViewer(mapA.id);
  await waitFor(() => savedEls().length === 2);
  rc = ctr(savedEl("red")); const mc = map.getCenter();
  await drag(rc.x, rc.y, rc.x + 100, rc.y);
  const rc1 = ctr(savedEl("red"));
  const redMoved = (await allMarkers()).find((m) => m.id === red.id);
  const dragOk = near(rc1.x - rc.x, 100) && near(rc1.y, rc.y) && map.getCenter().equals(mc) && redMoved.x > red.x && redMoved.createdAt === red.createdAt;
  await openViewer(mapA.id);
  await waitFor(() => savedEls().length === 2);
  const rc2 = ctr(savedEl("red"));
  ok("33_move_saved_pin", dragOk && near(rc2.x, rc1.x) && near(rc2.y, rc1.y), { dx: rc1.x - rc.x, x: [red.x, redMoved.x], reload: rc2 });

  await drag(rc2.x, rc2.y, imageRect().left - 30, rc2.y);
  const redEdge = (await allMarkers()).find((m) => m.id === red.id);
  ok("34_move_outside_clamped", in01(redEdge) && near(redEdge.x, 0, 1e-6), { x: redEdge.x, y: redEdge.y });

  clearNotices();
  const realMove = mk.move;
  mk.move = () => Promise.reject(new Error("fallo simulado (spec-08 criterio 38)"));
  const g0 = ctr(savedEl("gold"));
  await drag(g0.x, g0.y, g0.x + 60, g0.y + 50);
  const g1c = ctr(savedEl("gold"));
  mk.move = realMove;
  ok("36_move_failure_reverts", notices().includes("No se pudo mover el pin.") && near(g1c.x, g0.x) && near(g1c.y, g0.y), { before: g0, after: g1c });

  // move fuera de 0–1
  let moveErr = null;
  try { await mk.move(red.id, 1.2, 0.5); } catch (e) { moveErr = e; }
  const redAfterBad = (await allMarkers()).find((m) => m.id === red.id);
  ok("38_move_validation", moveErr instanceof mk.InvalidMarkerError && redAfterBad.x === redEdge.x, { error: moveErr?.name });

  // ================= pines guardados en modo "añadir pin" =================
  await openEditor();
  const goldBefore = (await allMarkers()).find((m) => m.color === "gold");
  const dd0 = ctr(draftEl());
  let gp = ctr(savedEl("gold"));
  await drag(gp.x, gp.y, gp.x + 80, gp.y + 60);
  const gp1 = ctr(savedEl("gold")), dd1 = ctr(draftEl());
  const goldAfter = (await allMarkers()).find((m) => m.color === "gold");
  const dragInAdding = near(gp1.x - gp.x, 80) && near(gp1.y - gp.y, 60) && goldAfter.x !== goldBefore.x && near(dd0.x, dd1.x, 0.5) && near(dd0.y, dd1.y, 0.5) && !$(".pin-popup");
  await clickAt(gp1.x + 3, gp1.y + 3, 400);
  const dd2 = ctr(draftEl());
  const clickInAdding = near(dd2.x, gp1.x + 3) && near(dd2.y, gp1.y + 3) && !$(".pin-popup");
  ok("37_move_saved_while_adding", dragInAdding && clickInAdding, { dragged: [gp1.x - gp.x, gp1.y - gp.y], draftStill: [dd0, dd1], clickTo: dd2 });
  ok("39_click_saved_while_adding", clickInAdding, { draft: dd2, target: { x: gp1.x + 3, y: gp1.y + 3 } });
  await clickEl(cancelBtn(), 300);

  // ================= Último usado =================
  await openViewer(mapB.id);
  await openEditor();
  const lastText = lastBtn().textContent.trim();
  const openStyle = { icon: $(".pin-editor__icon-text").textContent, red: draftEl().classList.contains("pin--red"), w: draftEl().getBoundingClientRect().width };
  await clickEl(iconBtn(), 300);
  const bar0 = range().value;
  await clickEl(colorRadio("cyan"), 200);
  await setRange(48);
  await clickEl(lastBtn(), 300);
  const after = { icon: $(".pin-editor__icon-text").textContent, red: draftEl().classList.contains("pin--red"), w: draftEl().getBoundingClientRect().width, bar: range().value, out: $(".pin-picker__size-value").textContent };
  ok("42_last_used", lastText === "Cofre" && openStyle.icon === "Cofre" && openStyle.red && near(openStyle.w, 32, 1) && bar0 === "32"
    && after.icon === "Cofre" && after.red && near(after.w, 32, 1) && after.bar === "32" && after.out === "32 px",
    { lastText, openStyle, bar0, after });
  await esc(); await esc();
  await openViewer(mapD.id);
  await openEditor();
  ok("43_last_used_per_game", lastBtn().disabled && lastBtn().textContent.includes("Ninguno todavía"), lastBtn().textContent);
  await clickEl(cancelBtn(), 300);

  // ================= pantalla completa simulada =================
  await openViewer(mapA.id);
  let fsEl = null;
  Object.defineProperty(document, "fullscreenElement", { get: () => fsEl, configurable: true });
  const fire = () => document.dispatchEvent(new Event("fullscreenchange"));
  const realReq = Element.prototype.requestFullscreen, realExit = document.exitFullscreen;
  Element.prototype.requestFullscreen = function () { fsEl = this; setTimeout(fire, 0); return Promise.resolve(); };
  document.exitFullscreen = function () { fsEl = null; setTimeout(fire, 0); return Promise.resolve(); };
  await clickEl($('.view-controls__btn[aria-label="Pantalla completa"]'), 500);
  await openEditor();
  const edVisible = editor().getBoundingClientRect().width > 0;
  const panelHidden = $(".viewer__panel").getBoundingClientRect().width === 0;
  ok("44_fullscreen_editor", $(".viewer").classList.contains("viewer--fullscreen") && edVisible && panelHidden, { edVisible, panelHidden });
  await clickEl(cancelBtn(), 300);
  window.location.hash = "#/"; await sleep(500);
  Element.prototype.requestFullscreen = realReq; document.exitFullscreen = realExit;
  delete document.fullscreenElement; // vuelve el getter de Document.prototype

  // ================= foco visible =================
  await openViewer(mapA.id);
  await waitFor(() => savedEls().length === 2);
  await openEditor();
  await clickEl(iconBtn(), 300);
  iconBtn().focus();
  const focusedInfo = [];
  const visibleOutline = (e) => css(e).outlineStyle !== "none" && parseFloat(css(e).outlineWidth) > 0;
  nameInput().focus();
  for (let i = 0; i < 16; i++) {
    await tab();
    const e = document.activeElement;
    if (editor().contains(e) || picker().contains(e)) focusedInfo.push({ el: e.className.split(" ").pop() || e.tagName, ok: visibleOutline(e) });
  }
  // También dentro del selector
  toggleOf("Información").focus(); await tab(); await tab();
  for (const e of [document.activeElement]) focusedInfo.push({ el: e.className.split(" ").pop(), ok: visibleOutline(e) });
  await esc(); await esc();
  const rd = ctr(savedEl("red"));
  await clickAt(rd.x, rd.y, 500);
  await tab();
  $(".pin-popup__delete").focus(); await sleep(50);
  const delOutline = visibleOutline($(".pin-popup__delete"));
  ok("46_focus_visible", focusedInfo.length >= 8 && focusedInfo.every((f) => f.ok) && delOutline, { focusedInfo, delOutline });

  // ================= borrar con confirmación =================
  await clickEl($(".pin-popup__delete"), 400);
  const dlg = $("dialog[open]");
  const dlgTitle = dlg?.querySelector(".dialog__title")?.textContent;
  await clickEl([...dlg.querySelectorAll("button")].find((b) => !b.classList.contains("btn--danger")), 400);
  const keptOnCancel = !!savedEl("red") && (await allMarkers()).some((m) => m.id === red.id);
  if (!$(".pin-popup")) { const rr = ctr(savedEl("red")); await clickAt(rr.x, rr.y, 500); }
  await clickEl($(".pin-popup__delete"), 400);
  await clickEl($("dialog[open] .btn--danger"), 600);
  const removed = !savedEl("red") && !(await allMarkers()).some((m) => m.id === red.id);
  ok("40_delete_with_confirm", dlgTitle === "¿Borrar pin?" && keptOnCancel && removed, { dlgTitle, keptOnCancel, removed });

  // ================= validación de create =================
  const before49 = (await allMarkers()).length;
  const base = { x: 0.5, y: 0.5, name: "v", note: "", icon: "chest", color: "red", size: 32 };
  const bad = [{ size: 30 }, { color: "pink" }, { x: 1.2 }, { note: "x".repeat(501) }];
  const results49 = [];
  for (const b of bad) { try { await mk.create(mapA.id, Object.assign({}, base, b)); results49.push("NO THROW"); } catch (e) { results49.push(e instanceof mk.InvalidMarkerError ? "ok" : e.name); } }
  ok("47_create_validation", results49.every((x) => x === "ok") && (await allMarkers()).length === before49, results49);

  // ================= borrado en cascada =================
  window.location.hash = "#/"; await sleep(400);
  const g3 = await gs.create("Cascada mapa", null);
  const [mapE] = (await ms.importFiles(g3.id, [await png("E.png", 200, 100, "hsl(0,0%,50%)")])).imported;
  const mE = await mk.create(mapE.id, base);
  await ms.remove(mapE.id);
  const goneByMap = !(await allMarkers()).some((m) => m.id === mE.id);
  const g4 = await gs.create("Cascada juego", null);
  const [mapF] = (await ms.importFiles(g4.id, [await png("F.png", 200, 100, "hsl(0,0%,50%)")])).imported;
  const mF = await mk.create(mapF.id, base);
  await gs.remove(g4.id);
  const goneByGame = !(await allMarkers()).some((m) => m.id === mF.id);
  ok("48_cascade_delete", goneByMap && goneByGame, { goneByMap, goneByGame });

  ok("01b_no_page_errors", !pageError, pageError);
  window.location.hash = "#/";
  return { criteria: Object.fromEntries(Object.entries(C).sort()) };
})();
