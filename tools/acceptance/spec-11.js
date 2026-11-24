// Prueba de aceptación de SPEC 11 (editar pines y textos).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-11.js
//
// Devuelve { "<nº>_<nombre>": { pass, detail } }, numerados por orden en la spec.
// Notas:
//   - "Recargar" (19) se hace remontando el visor (pasar por "#/" y volver), como en spec-08.js.
//   - Pantalla completa (21) se simula como en spec-06.js (headless la rechaza).
//   - Las posiciones de los textos se leen de la posición Leaflet del icono (tamaño 0, anclado en el punto).
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval
//       (18 provoca a propósito errores "[pin-editor]" / "[label-editor]" en consola).
//       01b comprueba además que no hay errores de página sin capturar.
//   25  grep "indexedDB" js/ui (sin usos).
//   26  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   27  spec-01.js a spec-10.js y este script pasan con un WP_PROFILE vacío.
(async () => {
  // Desde SPEC 12 los filtros están en el panel de progreso, plegado al montar: se despliega antes.
  const progressFilterBtns = () => { const t = document.querySelector(".viewer__progress-toggle"); if (t && t.getAttribute("aria-expanded") === "false") t.click(); return [...document.querySelectorAll(".viewer__progress-filter-btn")]; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const C = {};
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
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
  const esc = async () => { await window.cdpKey("Escape"); await sleep(300); };
  const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
  const notices = () => $$(".notice__message").map((n) => n.textContent);
  const clearNotices = () => $$(".notice").forEach((n) => n.remove());

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
  const getRec = (store, id) => new Promise((r) => { const q = conn.transaction(store).objectStore(store).get(id); q.onsuccess = () => r(q.result); });
  const snap = async (store, id) => JSON.stringify(await getRec(store, id));

  const g1 = await gs.create("Juego edición", null);
  const [mapA] = (await ms.importFiles(g1.id, [await png("Mapa A.png", 1200, 800, "hsl(120,30%,40%)")])).imported;

  const openViewer = async (id) => {
    if (window.location.hash === "#/map/" + id) { window.location.hash = "#/"; await sleep(400); }
    window.location.hash = "#/map/" + id;
    await waitFor(() => !!$(".leaflet-image-layer")?.complete); await sleep(800);
  };
  const stage = () => $(".viewer__stage").getBoundingClientRect();
  // Punto en px de la ventana de una posición relativa de la imagen.
  const pagePoint = (x, y) => { const p = map.latLngToContainerPoint(L.latLng(800 * (1 - y), 1200 * x)); const s = stage(); return { x: p.x + s.left, y: p.y + s.top }; };
  // Punto en px de la ventana de un icono Leaflet (su anclaje).
  const anchor = (e) => { const p = map.latLngToContainerPoint(map.layerPointToLatLng(L.DomUtil.getPosition(e))); const s = stage(); return { x: p.x + s.left, y: p.y + s.top }; };
  const pinEls = () => $$(".leaflet-marker-icon.pin:not(.pin--draft)");
  const pinByColor = (k) => pinEls().find((e) => e.classList.contains("pin--" + k));
  const labelEls = () => $$(".leaflet-marker-icon.label:not(.label--draft)");
  const labelByText = (t) => labelEls().find((e) => e.textContent === t);
  const pinDraft = () => $(".pin--draft"), labelDraft = () => $(".label--draft");
  const pinEditor = () => $(".pin-editor"), labelEditor = () => $(".label-editor");
  const setVal = (sel, v) => { const e = $(sel); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
  const openPinEdit = async (color) => {
    await clickEl(pinByColor(color), 500);
    await clickEl($(".pin-popup__edit"), 50);
    await waitFor(() => !!pinDraft());
  };
  const openLabelEdit = async (text) => {
    await clickEl(labelByText(text).querySelector(".label-text"), 500);
    await clickEl($(".label-popup__edit"), 50);
    await waitFor(() => !!labelDraft());
  };
  const pinSave = () => clickEl($(".pin-editor .btn--primary"), 600);
  const labelSaveBtn = () => $(".label-editor .btn--primary");

  try {
  // ================= 20. validación de update =================
  const pv = await mk.create(mapA.id, { x: 0.5, y: 0.5, name: "V", note: "", icon: "star", color: "gold", size: 32 });
  const lv = await ls.create(mapA.id, { x: 0.5, y: 0.5, text: "V", note: "", color: "white", size: 12 });
  const pvBefore = await snap("markers", pv.id), lvBefore = await snap("labels", lv.id);
  const throwsAs = async (fn, E) => { try { await fn(); return false; } catch (e) { return e instanceof E; } };
  const pb = { x: 0.5, y: 0.5, name: "Z", note: "", icon: "star", color: "gold", size: 32 };
  const lb = { x: 0.5, y: 0.5, text: "Z", note: "", color: "white", size: 12 };
  const mThrows = [
    await throwsAs(() => mk.update(pv.id, { ...pb, size: 13 }), mk.InvalidMarkerError),
    await throwsAs(() => mk.update(pv.id, { ...pb, color: "pink" }), mk.InvalidMarkerError),
    await throwsAs(() => mk.update(pv.id, { ...pb, x: 1.2 }), mk.InvalidMarkerError),
    await throwsAs(() => mk.update("no-existe", pb), mk.InvalidMarkerError),
  ];
  const lThrows = [
    await throwsAs(() => ls.update(lv.id, { ...lb, size: 13 }), ls.InvalidLabelError),
    await throwsAs(() => ls.update(lv.id, { ...lb, text: "" }), ls.InvalidLabelError),
    await throwsAs(() => ls.update(lv.id, { ...lb, text: "x".repeat(41) }), ls.InvalidLabelError),
    await throwsAs(() => ls.update("no-existe", lb), ls.InvalidLabelError),
  ];
  const noWrites = (await snap("markers", pv.id)) === pvBefore && (await snap("labels", lv.id)) === lvBefore;
  ok("20_validacion_update", mThrows.every(Boolean) && lThrows.every(Boolean) && noWrites, { mThrows, lThrows, noWrites });
  await mk.remove(pv.id); await ls.remove(lv.id);

  // ================= Datos para el visor =================
  const p = await mk.create(mapA.id, { x: 0.4, y: 0.5, name: "Cofre", note: "nota del cofre", icon: "star", color: "red", size: 40 });
  await mk.setFound(p.id, true);
  await sleep(5);
  const pOther = await mk.create(mapA.id, { x: 0.6, y: 0.3, name: "Otro", note: "", icon: "pointer", color: "gold", size: 32 });
  const lab = await ls.create(mapA.id, { x: 0.3, y: 0.7, text: "Ciudad", note: "nota del texto", color: "orange", size: 16 });
  const labOther = await ls.create(mapA.id, { x: 0.7, y: 0.7, text: "Puerto", note: "", color: "white", size: 12 });
  const lastBefore = JSON.stringify(await mk.lastStyle(g1.id));
  const pBefore = await snap("markers", p.id), labBefore = await snap("labels", lab.id);

  await openViewer(mapA.id);

  // ================= 02. botones "Editar" =================
  await clickEl(labelByText("Ciudad").querySelector(".label-text"), 500);
  const lEdit = $(".label-popup__edit"), lDel = $(".label-popup__delete");
  const labelBtnsOk = !!lEdit && lEdit.classList.contains("btn") && lEdit.classList.contains("btn--edit") && lEdit.textContent === "Editar" && lEdit.getBoundingClientRect().right <= lDel.getBoundingClientRect().left;
  map.closePopup(); await sleep(200);
  await clickEl(pinByColor("red"), 500);
  const pEdit = $(".pin-popup__edit"), pDel = $(".pin-popup__delete");
  const pinBtnsOk = !!pEdit && pEdit.classList.contains("btn--edit") && pEdit.getBoundingClientRect().right <= pDel.getBoundingClientRect().left;
  map.closePopup(); await sleep(200);
  ok("02_botones_editar", labelBtnsOk && pinBtnsOk, { labelBtnsOk, pinBtnsOk });

  // ================= 03, 05, 06. editar pin: panel, posición, encontrado =================
  await openPinEdit("red");
  const d0 = pinDraft(), dc0 = ctr(d0), want0 = pagePoint(0.4, 0.5);
  const firstFrame = { dx: dc0.x - want0.x, dy: dc0.y - want0.y, dropping: d0.classList.contains("pin--dropping") };
  const savedGone = !pinByColor("red");
  await sleep(400);
  const pe = pinEditor();
  const pinFields = {
    title: pe.querySelector(".pin-editor__title").textContent,
    name: $(".pin-editor__name").value,
    note: $(".pin-editor__note").value,
    color: pe.querySelector(".pin-editor__color:checked")?.value,
    icon: pe.querySelector(".pin-editor__icon-text").textContent,
    popupClosed: !$(".pin-popup"),
    root: $(".viewer").classList.contains("viewer--adding-pin"),
  };
  await clickEl(pe.querySelector(".pin-editor__icon-btn"), 300);
  pinFields.size = $(".pin-picker__range").value;
  pinFields.iconChecked = $(".pin-picker__radio:checked")?.value;
  ok("03_editar_pin_abre", pinFields.title === "Editar pin" && pinFields.name === "Cofre" && pinFields.note === "nota del cofre" && pinFields.color === "red" && pinFields.icon === W.ui.pinIcons.label("star") && pinFields.size === "40" && pinFields.iconChecked === "star" && pinFields.popupClosed && pinFields.root, pinFields);

  // ================= 17. Esc con el selector abierto =================
  await esc();
  ok("17_esc_selector", $(".pin-picker").hidden && !!pinEditor() && !!pinDraft(), null);

  // ================= 07. mover el borrador =================
  const c0 = ctr(pinDraft()), center0 = map.getCenter();
  await drag(c0.x, c0.y, c0.x + 100, c0.y);
  const c1 = ctr(pinDraft());
  const dragOk = near(c1.x - c0.x, 100) && near(c1.y, c0.y) && map.getCenter().equals(center0) && (await snap("markers", p.id)) === pBefore;
  const target = pagePoint(0.2, 0.3);
  await clickAt(target.x, target.y, 400);
  const c2 = ctr(pinDraft());
  const clickOk = near(c2.x, target.x) && near(c2.y, target.y);
  ok("07_mover_borrador", dragOk && clickOk, { dragDx: c1.x - c0.x, clickOk });

  // ================= 08. modo colocar sobre otros pines y textos =================
  const otherPin = ctr(pinByColor("gold"));
  await clickAt(otherPin.x, otherPin.y, 400);
  const toPin = ctr(pinDraft());
  const pinPlace = !$(".pin-popup") && near(toPin.x, otherPin.x) && near(toPin.y, otherPin.y);
  const otherLabel = anchor(labelByText("Puerto"));
  await clickAt(otherLabel.x, otherLabel.y, 400);
  const toLabel = ctr(pinDraft());
  const labelPlace = !$(".label-popup") && near(toLabel.x, otherLabel.x) && near(toLabel.y, otherLabel.y);

  // ================= 16a. Cancelar (botón) tras cambios =================
  setVal(".pin-editor__name", "Cambiado");
  await clickEl($('.pin-editor__color[value="cyan"]'), 150);
  await clickEl($(".pin-editor .btn--cancel"), 400);
  const backPin = pinByColor("red");
  const backPos = backPin && ctr(backPin), wantBack = pagePoint(0.4, 0.5);
  const cancelBtnOk = !pinEditor() && !pinDraft() && !!backPin && near(backPos.x, wantBack.x) && near(backPos.y, wantBack.y) && backPin.classList.contains("pin--found") && !pinByColor("cyan") && document.activeElement === backPin && (await snap("markers", p.id)) === pBefore;

  // ================= 04, 08 (texto). editar texto: panel, posición =================
  await openLabelEdit("Ciudad");
  const ld0 = labelDraft(), la0 = anchor(ld0), lw0 = pagePoint(0.3, 0.7);
  const labelFirst = { dx: la0.x - lw0.x, dy: la0.y - lw0.y, dropping: ld0.classList.contains("label--dropping") };
  const labelGone = !labelByText("Ciudad");
  await sleep(400);
  const labelFields = {
    title: $(".label-editor__title").textContent,
    text: $(".label-editor__text").value,
    note: $(".label-editor__note").value,
    color: $(".label-editor .pin-editor__color:checked")?.value,
    size: $(".label-editor__range").value,
    popupClosed: !$(".label-popup"),
    root: $(".viewer").classList.contains("viewer--adding-label"),
  };
  ok("04_editar_texto_abre", labelFields.title === "Editar texto" && labelFields.text === "Ciudad" && labelFields.note === "nota del texto" && labelFields.color === "orange" && labelFields.size === "16" && labelFields.popupClosed && labelFields.root, labelFields);
  ok("05_sin_caida_en_su_sitio",
    near(firstFrame.dx, 0) && near(firstFrame.dy, 0) && !firstFrame.dropping && savedGone &&
    near(labelFirst.dx, 0) && near(labelFirst.dy, 0) && !labelFirst.dropping && labelGone,
    { pin: firstFrame, label: labelFirst });
  ok("06_borrador_encontrado", d0.classList.contains("pin--found"), null);

  // 12. Guardar deshabilitado con texto vacío
  setVal(".label-editor__text", ""); const dis1 = labelSaveBtn().disabled;
  setVal(".label-editor__text", "   "); const dis2 = labelSaveBtn().disabled;
  setVal(".label-editor__text", "Ciudad"); const en = !labelSaveBtn().disabled;
  ok("12_guardar_texto_deshabilitado", dis1 && dis2 && en, { dis1, dis2, en });

  // 08 con texto: clic en otro texto y en un pin
  const ol = anchor(labelByText("Puerto"));
  await clickAt(ol.x, ol.y, 400);
  const lt1 = anchor(labelDraft());
  const opn = ctr(pinByColor("gold"));
  await clickAt(opn.x, opn.y, 400);
  const lt2 = anchor(labelDraft());
  const labelModePlace = !$(".label-popup") && !$(".pin-popup") && near(lt1.x, ol.x) && near(lt1.y, ol.y) && near(lt2.x, opn.x) && near(lt2.y, opn.y);
  ok("08_modo_colocar", pinPlace && labelPlace && labelModePlace, { pinPlace, labelPlace, labelModePlace });

  // ================= 16b. Esc (texto) tras cambios =================
  setVal(".label-editor__text", "ZZZ");
  await clickEl($('.label-editor .pin-editor__color[value="cyan"]'), 150);
  await esc();
  const backLabel = labelByText("Ciudad");
  const bl = backLabel && anchor(backLabel), wl = pagePoint(0.3, 0.7);
  const escLabelOk = !labelEditor() && !labelDraft() && !!backLabel && near(bl.x, wl.x) && near(bl.y, wl.y) && backLabel.classList.contains("label--orange") && document.activeElement === backLabel && (await snap("labels", lab.id)) === labBefore;

  // 16c. Esc (pin)
  await openPinEdit("red"); await sleep(300);
  setVal(".pin-editor__name", "Otro nombre");
  await clickAt(target.x, target.y, 400);
  await esc();
  const backPin2 = pinByColor("red");
  const escPinOk = !pinEditor() && !!backPin2 && document.activeElement === backPin2 && (await snap("markers", p.id)) === pBefore;

  // 16d. Cambio de ruta (pin y texto)
  await openPinEdit("red"); await sleep(300);
  setVal(".pin-editor__name", "Ruta"); await clickAt(target.x, target.y, 400);
  window.location.hash = "#/"; await sleep(500);
  const routePinDb = (await snap("markers", p.id)) === pBefore;
  await openViewer(mapA.id);
  await openLabelEdit("Ciudad"); await sleep(300);
  setVal(".label-editor__text", "Ruta"); await clickAt(target.x, target.y, 400);
  window.location.hash = "#/"; await sleep(500);
  const routeLabelDb = (await snap("labels", lab.id)) === labBefore;
  await openViewer(mapA.id);
  const routeBack = !!pinByColor("red") && !!labelByText("Ciudad");
  ok("16_cancelar", cancelBtnOk && escLabelOk && escPinOk && routePinDb && routeLabelDb && routeBack,
    { cancelBtnOk, escLabelOk, escPinOk, routePinDb, routeLabelDb, routeBack });

  // ================= 18. errores al guardar =================
  const origMk = mk.update, origLs = ls.update;
  await openPinEdit("red"); await sleep(300);
  setVal(".pin-editor__name", "Fallo");
  clearNotices();
  mk.update = () => Promise.reject(new DOMException("q", "QuotaExceededError"));
  await pinSave();
  const pq = notices().includes("No queda espacio para guardar el pin.");
  clearNotices();
  mk.update = () => Promise.reject(new Error("x"));
  await pinSave();
  const po = notices().includes("No se pudo guardar el pin.");
  mk.update = origMk;
  const pinStill = !!pinEditor() && !!pinDraft() && (await snap("markers", p.id)) === pBefore;
  await clickEl($(".pin-editor .btn--cancel"), 400);
  clearNotices();
  await openLabelEdit("Ciudad"); await sleep(300);
  ls.update = () => Promise.reject(new DOMException("q", "QuotaExceededError"));
  await clickEl(labelSaveBtn(), 400);
  const lq = notices().includes("No queda espacio para guardar el texto.");
  clearNotices();
  ls.update = () => Promise.reject(new Error("x"));
  await clickEl(labelSaveBtn(), 400);
  const lo = notices().includes("No se pudo guardar el texto.");
  ls.update = origLs;
  const labelStill = !!labelEditor() && !!labelDraft() && (await snap("labels", lab.id)) === labBefore;
  await clickEl($(".label-editor .btn--cancel"), 400);
  clearNotices();
  ok("18_errores_guardar", pq && po && pinStill && lq && lo && labelStill, { pq, po, pinStill, lq, lo, labelStill });

  // ================= 09. guardar pin con cambios =================
  await openPinEdit("red"); await sleep(300);
  setVal(".pin-editor__name", "Tesoro");
  setVal(".pin-editor__note", "bajo el puente");
  await clickEl($('.pin-editor__color[value="cyan"]'), 150);
  await clickEl($(".pin-editor__icon-btn"), 300);
  $('.pin-picker__radio[value="pointer"]').click();
  setVal(".pin-picker__range", "48");
  await clickEl($(".pin-picker .btn--primary"), 200);
  const newPos = pagePoint(0.25, 0.25);
  await clickAt(newPos.x, newPos.y, 400);
  await pinSave();
  const rec = await getRec("markers", p.id);
  const savedEl = pinByColor("cyan");
  const sc = savedEl && ctr(savedEl), sw = pagePoint(0.25, 0.25);
  const pinSaved = {
    values: rec.name === "Tesoro" && rec.note === "bajo el puente" && rec.icon === "pointer" && rec.color === "cyan" && rec.size === 48 && near(rec.x, 0.25, 0.01) && near(rec.y, 0.25, 0.01),
    same: rec.id === p.id && rec.mapId === p.mapId && rec.found === true && rec.createdAt === p.createdAt,
    closed: !pinEditor() && !pinDraft() && !$(".pin-popup"),
    painted: !!savedEl && near(sc.x, sw.x) && near(sc.y, sw.y) && near(savedEl.getBoundingClientRect().width, 48) && savedEl.classList.contains("pin--found"),
    focus: document.activeElement === savedEl,
    controls: !$(".viewer").classList.contains("viewer--adding-pin"),
  };
  ok("09_guardar_pin", Object.values(pinSaved).every(Boolean), pinSaved);

  // ================= 14. "Último usado" no cambia =================
  const lastAfter = JSON.stringify(await mk.lastStyle(g1.id));
  ok("14_ultimo_usado_igual", lastAfter === lastBefore, { lastBefore, lastAfter });

  // ================= 10. nombre vacío =================
  await openPinEdit("cyan"); await sleep(300);
  setVal(".pin-editor__name", "   ");
  await pinSave();
  const recEmpty = await getRec("markers", p.id);
  ok("10_nombre_vacio", recEmpty.name === W.ui.pinIcons.label(recEmpty.icon), { name: recEmpty.name });

  // ================= 13. guardar sin cambios =================
  const noChangePin = await snap("markers", p.id);
  await openPinEdit("cyan"); await sleep(300);
  await pinSave();
  const pinSame = (await snap("markers", p.id)) === noChangePin && !pinEditor();
  const noChangeLabel = await snap("labels", lab.id);
  await openLabelEdit("Ciudad"); await sleep(300);
  await clickEl(labelSaveBtn(), 600);
  const labelSame = (await snap("labels", lab.id)) === noChangeLabel && !labelEditor();
  ok("13_guardar_sin_cambios", pinSame && labelSame, { pinSame, labelSame });

  // ================= 11. guardar texto con cambios =================
  await openLabelEdit("Ciudad"); await sleep(300);
  setVal(".label-editor__text", "Pueblo");
  setVal(".label-editor__note", "nota nueva");
  await clickEl($('.label-editor .pin-editor__color[value="cyan"]'), 150);
  setVal(".label-editor__range", "24");
  const lNew = pagePoint(0.2, 0.8);
  await clickAt(lNew.x, lNew.y, 400);
  await clickEl(labelSaveBtn(), 600);
  const lrec = await getRec("labels", lab.id);
  const lEl = labelByText("Pueblo");
  const la = lEl && anchor(lEl), lw = pagePoint(0.2, 0.8);
  const labelSaved = {
    values: lrec.text === "Pueblo" && lrec.note === "nota nueva" && lrec.color === "cyan" && lrec.size === 24 && near(lrec.x, 0.2, 0.01) && near(lrec.y, 0.8, 0.01),
    same: lrec.id === lab.id && lrec.mapId === lab.mapId && lrec.createdAt === lab.createdAt,
    closed: !labelEditor() && !labelDraft() && !$(".label-popup"),
    painted: !!lEl && near(la.x, lw.x) && near(la.y, lw.y) && lEl.classList.contains("label--cyan") && getComputedStyle(lEl.querySelector(".label-text")).fontSize === "24px",
    focus: document.activeElement === lEl,
  };
  ok("11_guardar_texto", Object.values(labelSaved).every(Boolean), labelSaved);

  // ================= 15. encontrado con "Encontrados" apagado =================
  if ($(".viewer__toggle").getAttribute("aria-expanded") !== "true") await clickEl($(".viewer__toggle"), 400);
  await waitFor(() => progressFilterBtns().every((x) => !x.disabled));
  const foundFilter = progressFilterBtns()[1];
  await clickEl($(".viewer__toggle"), 400); // contraer: el panel no tapa el pin
  await openPinEdit("cyan"); await sleep(300);
  foundFilter.click(); await sleep(200); // "Encontrados" apagado mientras se edita
  setVal(".pin-editor__name", "Oculto");
  await pinSave();
  const filtered = { painted: !!pinByColor("cyan"), focusMap: document.activeElement === map.getContainer(), saved: (await getRec("markers", p.id)).name === "Oculto", pressed: foundFilter.getAttribute("aria-pressed") };
  foundFilter.click(); await sleep(200);
  ok("15_filtro_encontrados", !filtered.painted && filtered.focusMap && filtered.saved, filtered);

  // ================= 19. recargar =================
  await openViewer(mapA.id);
  const rp = pinByColor("cyan"), rl = labelByText("Pueblo");
  const rpc = rp && ctr(rp), rpw = pagePoint(0.25, 0.25);
  ok("19_recargar", !!rp && rp.classList.contains("pin--found") && near(rpc.x, rpw.x) && near(rpc.y, rpw.y) && !!rl && rl.classList.contains("label--cyan"), null);

  // ================= 22–24. tooltip con la nota del texto =================
  const hover = async (e) => { const c = ctr(e); await input([M("mouseMoved", c.x, c.y)], 300); };
  const away = () => input([M("mouseMoved", 5, 5)], 200);
  const tipVisible = () => { const t = $(".label-tooltip"); return !!t && getComputedStyle(t).display !== "none"; };
  await hover(labelByText("Pueblo").querySelector(".label-text"));
  const tipText = $(".label-tooltip")?.textContent;
  const tipBox = $(".label-tooltip")?.getBoundingClientRect();
  // En una línea: más ancho que alto (sin width: max-content salía un carácter por línea).
  const withNote = tipVisible() && tipText === "nota nueva" && tipBox.width > tipBox.height * 2;
  await away();
  await hover(labelByText("Puerto").querySelector(".label-text"));
  const noNote = !$(".label-tooltip");
  await away();
  ok("22_tooltip_nota", withNote && noNote, { tipText, noNote });

  await clickEl(labelByText("Pueblo").querySelector(".label-text"), 500);
  await hover(labelByText("Pueblo").querySelector(".label-text"));
  const hiddenPopup = !!$(".label-popup") && !tipVisible();
  map.closePopup(); await away();
  await clickEl($('.view-controls__btn[aria-label="Añadir pin"]'), 700);
  await hover(labelByText("Pueblo").querySelector(".label-text"));
  const hiddenAdding = !!pinEditor() && !tipVisible();
  await clickEl($(".pin-editor .btn--cancel"), 300); await away();
  ok("23_tooltip_oculto", hiddenPopup && hiddenAdding, { hiddenPopup, hiddenAdding });

  await openLabelEdit("Pueblo"); await sleep(300);
  setVal(".label-editor__note", "otra nota");
  await clickEl(labelSaveBtn(), 600); await away();
  await hover(labelByText("Pueblo").querySelector(".label-text"));
  const updated = $(".label-tooltip")?.textContent === "otra nota";
  await away();
  await openLabelEdit("Pueblo"); await sleep(300);
  setVal(".label-editor__note", "");
  await clickEl(labelSaveBtn(), 600); await away();
  await hover(labelByText("Pueblo").querySelector(".label-text"));
  const removed = !$(".label-tooltip");
  await away();
  ok("24_tooltip_tras_editar", updated && removed, { updated, removed });

  // ================= 21. pantalla completa simulada =================
  let fsEl = null;
  Object.defineProperty(document, "fullscreenElement", { get: () => fsEl, configurable: true });
  const fire = () => document.dispatchEvent(new Event("fullscreenchange"));
  const realReq = Element.prototype.requestFullscreen, realExit = document.exitFullscreen;
  Element.prototype.requestFullscreen = function () { fsEl = this; setTimeout(fire, 0); return Promise.resolve(); };
  document.exitFullscreen = function () { fsEl = null; setTimeout(fire, 0); return Promise.resolve(); };
  await clickEl($('.view-controls__btn[aria-label="Pantalla completa"]'), 500);
  await openPinEdit("cyan"); await sleep(300);
  const fsPin = $(".viewer").classList.contains("viewer--fullscreen") && pinEditor().getBoundingClientRect().width > 0;
  await clickEl($(".pin-editor .btn--cancel"), 300);
  await openLabelEdit("Pueblo"); await sleep(300);
  const fsLabel = $(".viewer").classList.contains("viewer--fullscreen") && labelEditor().getBoundingClientRect().width > 0;
  await clickEl($(".label-editor .btn--cancel"), 300);
  window.location.hash = "#/"; await sleep(500);
  Element.prototype.requestFullscreen = realReq; document.exitFullscreen = realExit;
  delete document.fullscreenElement;
  ok("21_pantalla_completa", fsPin && fsLabel, { fsPin, fsLabel });

  C["01b_sin_errores_de_pagina"] = { pass: !pageError, detail: pageError };
  } catch (e) { C.__exception = { pass: false, detail: String(e && e.stack || e).slice(0, 400) }; }
  return JSON.stringify(C);
})()
