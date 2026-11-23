// Prueba de aceptación de SPEC 09 (pines encontrados: botón ojo, opacidad, filtro de pines y mano "Por defecto").
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-09.js
//
// Devuelve { "<nº>_<nombre>": { pass, detail } }, numerados por orden en la spec.
// Notas:
//   - "Recargar" (06, 15) se hace remontando el visor (pasar por "#/" y volver): el script no
//     sobrevive a un F5, y el visor nuevo lee los datos de IndexedDB igual que tras recargar.
//   - El filtro del panel son dos botones (Pendientes / Encontrados) con aria-pressed.
//   - Un clic "en el mapa" para cerrar un popup cae lejos del pin: el popup sale encima de él.
//   - Enter sintético lleva text "\r"; si no, no activa el botón.
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval
//       (09 y 17 provocan a propósito errores "[pin-layer]" / "[viewer]" en consola).
//   23  grep "indexedDB" js/ui (sin usos).
//   24  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   25  spec-01.js a spec-08.js y este script pasan con un WP_PROFILE vacío.
(async () => {
  const C = {};
  try {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const W = Waypoint, $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const input = async (ev, w = 0) => { await window.cdpInput(JSON.stringify(ev)); if (w) await sleep(w); };
  const M = (type, x, y, e = {}) => ["Input.dispatchMouseEvent", Object.assign({ type, x, y }, e)];
  const clickAt = (x, y, w = 400) => input([M("mouseMoved", x, y), M("mousePressed", x, y, { button: "left", clickCount: 1 }), M("mouseReleased", x, y, { button: "left", clickCount: 1 })], w);
  const clickEl = (e, w) => { const r = e.getBoundingClientRect(); return clickAt(r.left + r.width / 2, r.top + r.height / 2, w); };
  const moveTo = (x, y, w = 300) => input([M("mouseMoved", x, y)], w);
  const drag = async (x0, y0, x1, y1) => {
    const ev = [M("mouseMoved", x0, y0), M("mousePressed", x0, y0, { button: "left", clickCount: 1 })];
    for (let i = 1; i <= 10; i++) ev.push(M("mouseMoved", x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * i) / 10, { buttons: 1 }));
    await input(ev, 120); await input([M("mouseMoved", x1, y1, { buttons: 1 })], 100); await input([M("mouseReleased", x1, y1, { button: "left", clickCount: 1 })], 500);
  };
  const key = (k, code, vk, text) => input([["Input.dispatchKeyEvent", Object.assign({ type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }, text ? { text } : {})], ["Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }]], 250);
  const esc = async () => { await window.cdpKey("Escape"); await sleep(300); };
  const png = async (n) => { const c = new OffscreenCanvas(1200, 800); const g = c.getContext("2d"); g.fillStyle = "#468"; g.fillRect(0, 0, 1200, 800); return new File([await c.convertToBlob({ type: "image/png" })], n, { type: "image/png" }); };
  let pageError = null; window.addEventListener("error", (e) => { pageError = e.message; });

  const gs = W.services.gameService, ms = W.services.mapService, mk = W.services.markerService;
  const db = await W.data.db.open();
  const getRec = (store, id) => new Promise((r) => { const q = db.transaction(store).objectStore(store).get(id); q.onsuccess = () => r(q.result); });
  const putRec = (store, rec) => new Promise((r, j) => { const tx = db.transaction(store, "readwrite"); tx.objectStore(store).put(rec); tx.oncomplete = r; tx.onerror = j; });
  const st = { icon: "exclamation", color: "gold", size: 32 };
  const g = await gs.create("Juego 09", null);
  const [mA, mB, mC] = (await ms.importFiles(g.id, [await png("A.png"), await png("B.png"), await png("C.png")])).imported.sort((a, b) => a.name.localeCompare(b.name));
  const pa = await mk.create(mA.id, { x: .25, y: .5, name: "pa", ...st });
  const pb = await mk.create(mA.id, { x: .75, y: .5, name: "pb", ...st });
  const legacy = { id: crypto.randomUUID(), mapId: mA.id, x: .5, y: .25, name: "legacy", note: "", icon: "exclamation", color: "gold", size: 32, createdAt: Date.now() - 5000 };
  await putRec("markers", legacy);
  const go = async (id) => { window.location.hash = "#/"; await sleep(400); window.location.hash = "#/map/" + id; await sleep(1500); };
  const pins = () => $$(".leaflet-marker-icon.pin:not(.pin--draft)");
  const pinOf = (name) => pins().find((p) => true && p.__name === name);
  let map = null; L.Map.addInitHook(function () { map = this; });
  const pinAt = (m) => { const p = map.latLngToContainerPoint(L.latLng(800 * (1 - m.y), 1200 * m.x)); const r = $(".viewer__stage").getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; };
  const glyphOp = (e) => getComputedStyle(e.querySelector(".pin-glyph")).opacity;
  const openPopup = async (m) => { const c = pinAt(m); await clickAt(c.x, c.y, 400); };
  const expandPanel = async () => { $(".viewer__toggle").click(); await sleep(400); };
  const btns = () => $$(".viewer__pin-filter-btn");
  const P = () => btns()[0], F = () => btns()[1];
  const stateStr = () => btns().map((b) => b.getAttribute("aria-pressed")).join(",");

  await go(mA.id);
  // 02
  await openPopup(pa);
  let b = $(".pin-popup__found");
  ok("02_boton_en_popup", b && b.getAttribute("aria-label") === "Encontrado" && b.getAttribute("aria-pressed") === "false" && b.textContent.trim() === "" && !!$(".pin-popup__delete"),
    { header: !!b?.closest(".pin-popup__header"), edit: !!$(".pin-popup__edit") });
  const visibleSvgs = () => $$(".pin-popup__found svg").filter((s) => s.getBoundingClientRect().width > 0).map((s) => s.querySelectorAll("path").length);
  const eyeBefore = visibleSvgs();
  // 03
  await clickEl(b);
  const el1 = pins().find((p) => p.classList.contains("pin--found"));
  ok("03_clic_marca", b.getAttribute("aria-pressed") === "true" && !!el1 && glyphOp(el1) === "0.4" && !!$(".leaflet-popup") && eyeBefore.join() === "1" && visibleSvgs().join() === "2",
    { op: el1 && glyphOp(el1), popup: !!$(".leaflet-popup"), eyes: [eyeBefore, visibleSvgs()] });
  // 10 hover/popup abierto
  await moveTo(10, 10); const opOpen = glyphOp(el1);
  const c = pinAt(pa); await moveTo(c.x, c.y); const opHover = glyphOp(el1);
  ok("10_opacidad_hover_popup", opOpen === "0.4" && opHover === "0.4", { opOpen, opHover });
  // 04
  await clickEl(b);
  ok("04_segundo_clic", b.getAttribute("aria-pressed") === "false" && visibleSvgs().join() === "1" && glyphOp(pins().find((p) => !p.classList.contains("pin--found")) || el1) === "1", { op: glyphOp(el1) });
  // 05 teclado
  b.focus(); await key("Enter", "Enter", 13, String.fromCharCode(13)); const e1 = b.getAttribute("aria-pressed");
  const outline = getComputedStyle(b).outlineStyle; await key(" ", "Space", 32, " "); const e2 = b.getAttribute("aria-pressed");
  ok("05_teclado_foco", e1 === "true" && e2 === "false" && outline === "solid" && !!$(".leaflet-popup"), { e1, e2, outline });
  // 06 persistencia
  if (b.getAttribute("aria-pressed") !== "true") await clickEl(b);
  await sleep(200);
  const recA = await getRec("markers", pa.id);
  await go(mA.id); await openPopup(pa);
  const b2 = $(".pin-popup__found");
  const foundPins = pins().filter((p) => p.classList.contains("pin--found"));
  ok("06_persistencia", recA.found === true && recA.createdAt === pa.createdAt && b2.getAttribute("aria-pressed") === "true" && foundPins.length === 1 && glyphOp(foundPins[0]) === "0.4", { found: recA.found, same: recA.createdAt === pa.createdAt });
  // 07 pines nuevos found:false (servicio y editor real)
  ok("07a_create_found_false", (await getRec("markers", pb.id)).found === false, {});
  // 08 legacy
  await esc(); await openPopup(legacy);
  const lp = pins().find((p) => Math.abs(p.getBoundingClientRect().left + p.getBoundingClientRect().width / 2 - pinAt(legacy).x) < 6 && Math.abs(p.getBoundingClientRect().top + p.getBoundingClientRect().height / 2 - pinAt(legacy).y) < 6);
  ok("08_sin_campo_found", lp && !lp.classList.contains("pin--found") && glyphOp(lp) === "1" && $(".pin-popup__found").getAttribute("aria-pressed") === "false", {});
  await esc();
  // 09 fallo de setFound
  const origSet = mk.setFound; mk.setFound = () => Promise.reject(new Error("x"));
  await openPopup(pb); const bb = $(".pin-popup__found"); await clickEl(bb); await sleep(300);
  const notes = $$(".notice__message").map((n) => n.textContent);
  const pbEl = pins().find((p) => Math.abs(p.getBoundingClientRect().left + p.getBoundingClientRect().width / 2 - pinAt(pb).x) < 6);
  ok("09_fallo_setFound", notes.includes("No se pudo marcar el pin.") && bb.getAttribute("aria-pressed") === "false" && !pbEl.classList.contains("pin--found"), { notes });
  mk.setFound = origSet; await esc();
  // 12 servicio
  const before = JSON.stringify(await getRec("markers", pb.id));
  let e12a = false, e12b = false;
  try { await mk.setFound(pb.id, "sí"); } catch (e) { e12a = e instanceof mk.InvalidMarkerError; }
  try { await mk.setFound("nope", true); } catch (e) { e12b = true; }
  ok("12_setFound_validacion", e12a && e12b && JSON.stringify(await getRec("markers", pb.id)) === before, { e12a, e12b });
  // 11 arrastrar y borrar encontrado
  await openPopup(pb); await clickEl($(".pin-popup__found")); await sleep(200); await esc();
  const cb = pinAt(pb); await drag(cb.x, cb.y, cb.x + 60, cb.y + 40); await sleep(300);
  const movedRec = await getRec("markers", pb.id);
  ok("11a_arrastrar_encontrado", movedRec.found === true && (Math.abs(movedRec.x - pb.x) > 0.01 || Math.abs(movedRec.y - pb.y) > 0.01), { x: movedRec.x, y: movedRec.y });
  await openPopup({ x: movedRec.x, y: movedRec.y }); await clickEl($(".pin-popup__delete"), 500);
  const confirmBtn = $$("dialog[open] button").find((x) => /borrar/i.test(x.textContent)); if (confirmBtn) await clickEl(confirmBtn, 600);
  ok("11b_borrar_encontrado", (await getRec("markers", pb.id)) === undefined, { pinsLeft: pins().length });
  // ahora en mapa A: pa (encontrado), legacy (pendiente). Recrear pb pendiente
  const pc = await mk.create(mA.id, { x: .75, y: .5, name: "pc", ...st });
  await go(mA.id); await expandPanel();
  // 13 filtro: panel
  const group = $(".viewer__pin-filter"); const game = $(".viewer__game");
  ok("13_panel_filtro", !!group && btns().length === 2 && stateStr() === "true,true" && !!game && (game.compareDocumentPosition(group) & 4) > 0 && btns().every((x) => !x.disabled), { labels: btns().map((x) => x.textContent), state: stateStr() });
  // 14 activar/desactivar
  const upd0 = (await getRec("maps", mA.id)).updatedAt;
  await clickEl(F());
  const afterHide = pins().map((p) => p.classList.contains("pin--found"));
  const rec14 = await getRec("maps", mA.id);
  await clickEl(F());
  const afterShow = pins().filter((p) => p.classList.contains("pin--found")).map(glyphOp);
  ok("14_ocultar_mostrar", afterHide.length === 2 && afterHide.every((x) => !x) && afterShow.length === 1 && afterShow[0] === "0.4", { afterHide, afterShow });
  // 15 persistencia, updatedAt
  await clickEl(F());
  const rec15 = await getRec("maps", mA.id);
  await go(mA.id);
  ok("15_hideFound_persistido", rec15.hideFound === true && rec15.updatedAt === upd0 && rec14.updatedAt === upd0 && pins().every((p) => !p.classList.contains("pin--found")) && pins().length === 2, { hideFound: rec15.hideFound, pins: pins().length });
  await expandPanel();
  ok("15b_boton_tras_recarga", F().getAttribute("aria-pressed") === "false", { state: stateStr() });
  // 21 panel contraído al abrir
  await go(mA.id);
  ok("21_panel_contraido", $(".viewer__panel").inert === true && pins().length === 2 && pins().every((p) => !p.classList.contains("pin--found")), { pins: pins().length });
  // 16 otro mapa
  await mk.create(mB.id, { x: .3, y: .5, name: "bf", ...st }).then((m) => mk.setFound(m.id, true));
  await go(mB.id); await expandPanel();
  ok("16_otro_mapa", stateStr() === "true,true" && pins().length === 1 && pins()[0].classList.contains("pin--found"), { state: stateStr(), pins: pins().length });
  // 17 fallo setHideFound
  await go(mA.id); await expandPanel();
  const origH = ms.setHideFound; ms.setHideFound = () => Promise.reject(new Error("x"));
  const stBefore = stateStr(); const nBefore = pins().length;
  await clickEl(F()); await sleep(300);
  ok("17_fallo_setHideFound", $$(".notice__message").some((n) => n.textContent === "No se pudo guardar el filtro.") && stateStr() === stBefore && pins().length === nBefore, { stBefore, now: stateStr() });
  ms.setHideFound = origH;
  // 18/19: con encontrados ocultos (hideFound activo en mapA ahora? asegurar)
  if (F().getAttribute("aria-pressed") === "true") await clickEl(F());
  const hidden = F().getAttribute("aria-pressed") === "false";
  const $pending = () => pins().filter((p) => !p.classList.contains("pin--found"));
  const target = { x: .5, y: .25 };
  const markCloseCase = async (how) => {
    await openPopup(target); const bt = $(".pin-popup__found"); if (!bt) throw new Error("sin popup en " + how + " pins=" + pins().length + " state=" + stateStr() + " target=" + JSON.stringify(pinAt(target)) + " rects=" + JSON.stringify(pins().map((p) => { const r = p.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; })));
    await clickEl(bt); await sleep(250);
    const mid = pins().some((p) => p.classList.contains("pin--found") && glyphOp(p) === "0.4") && !!$(".leaflet-popup");
    if (how === "x") await clickEl($(".leaflet-popup-close-button"), 400);
    else if (how === "esc") await esc();
    else { const r = $(".viewer__stage").getBoundingClientRect(); await clickAt(r.left + 1000, r.top + 650, 400); }
    await sleep(200);
    const gone = !pins().some((p) => Math.abs(p.getBoundingClientRect().left + p.getBoundingClientRect().width / 2 - pinAt(target).x) < 6 && Math.abs(p.getBoundingClientRect().top + p.getBoundingClientRect().height / 2 - pinAt(target).y) < 6);
    // dejarlo pendiente de nuevo para el siguiente caso: mostrar encontrados, desmarcar
    await clickEl(F()); await sleep(200);
    await openPopup(target); const b2x = $(".pin-popup__found");
    if (!b2x) throw new Error("reabrir " + how + " state=" + stateStr() + " pins=" + pins().length + " popupEl=" + !!$(".leaflet-popup") + " rects=" + JSON.stringify(pins().map((p) => { const r = p.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), p.classList.contains("pin--found")]; })) + " target=" + JSON.stringify(pinAt(target)));
    await clickEl(b2x); await sleep(250); await esc();
    await clickEl(F()); await sleep(200);
    return { mid, gone };
  };
  const rx = await markCloseCase("x"), re = await markCloseCase("esc"), rm = await markCloseCase("map");
  ok("18_marcar_con_filtro_cierra_popup", hidden && [rx, re, rm].every((r) => r.mid && r.gone), { rx, re, rm });
  // 19 marcar y desmarcar antes de cerrar
  await openPopup(target); const b19 = $(".pin-popup__found"); await clickEl(b19); await clickEl(b19); await esc(); await sleep(200);
  ok("19_marcar_desmarcar_se_queda", pins().length === 2 && $pending().length === 2, { pins: pins().length, pending: $pending().length });

  // 20 borrador cae en el centro con un encontrado oculto en el centro
  await go(mC.id);
  const cMap = () => { const r = $(".viewer__stage").getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
  await clickEl($('.view-controls__btn[aria-label="Añadir pin"]'), 900);
  const draftPos = () => { const d = $(".pin--draft"); if (!d) return null; const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  await waitFor(() => draftPos()); await sleep(900);
  const base = draftPos();
  await esc(); await sleep(400);
  // pin encontrado exactamente donde cae el borrador
  const rel = (() => { const r = $(".viewer__stage").getBoundingClientRect(); const ll = map.containerPointToLatLng(L.point(base.x - r.left, base.y - r.top)); return { x: ll.lng / 1200, y: 1 - ll.lat / 800 }; })();
  const fp = await mk.create(mC.id, { x: rel.x, y: rel.y, name: "centro", ...st }); await mk.setFound(fp.id, true);
  await ms.setHideFound(mC.id, true);
  await go(mC.id);
  await clickEl($('.view-controls__btn[aria-label="Añadir pin"]'), 900); await waitFor(() => draftPos()); await sleep(900);
  const withHidden = draftPos();
  ok("20_borrador_ignora_ocultos", withHidden && Math.abs(withHidden.x - base.x) <= 2 && Math.abs(withHidden.y - base.y) <= 2, { base, withHidden, pins: pins().length });
  await esc();
  // control: sin ocultar, el borrador se aparta
  await ms.setHideFound(mC.id, false); await go(mC.id);
  await clickEl($('.view-controls__btn[aria-label="Añadir pin"]'), 900); await waitFor(() => draftPos()); await sleep(900);
  const withVisible = draftPos();
  ok("20b_control_visible_desplaza", withVisible && (Math.abs(withVisible.x - base.x) > 2 || Math.abs(withVisible.y - base.y) > 2), { withVisible });
  await esc();
  // 07b guardar desde el editor real
  await go(mB.id);
  await clickEl($('.view-controls__btn[aria-label="Añadir pin"]'), 900); await waitFor(() => draftPos()); await sleep(900);
  const saveBtn = $$("aside.pin-editor button").find((x) => /guardar/i.test(x.textContent)); await clickEl(saveBtn, 700);
  const mBmarkers = await mk.listByMap(mB.id);
  ok("07b_editor_guarda_found_false", mBmarkers.length === 2 && mBmarkers.filter((m) => m.found === false).length === 1, { n: mBmarkers.length, found: mBmarkers.map((m) => m.found) });
  // 22 último usado
  const fresh = await mk.create(mA.id, { x: .4, y: .4, name: "reciente", icon: "star", color: "red", size: 40 }); await mk.setFound(fresh.id, true);
  const ls = await mk.lastStyle(g.id);
  ok("22_ultimo_usado", ls && ls.icon === "star" && ls.color === "red" && ls.size === 40, ls);
  // extra: hidePending y combinación "solo encontrados"
  await go(mA.id); await expandPanel();
  if (F().getAttribute("aria-pressed") !== "true") await clickEl(F());
  await clickEl(P());
  const onlyFound = pins().every((p) => p.classList.contains("pin--found")) && pins().length >= 1;
  const recP = await getRec("maps", mA.id);
  ok("23b_solo_encontrados", onlyFound && recP.hidePending === true, { n: pins().length, hidePending: recP.hidePending });
  // 26. Icono "Por defecto": primera categoría, con la mano
  const cat0 = W.ui.pinIcons.CATEGORIES[0];
  ok("26_icono_por_defecto", cat0.label === "Por defecto" && cat0.icons.length === 1 && cat0.icons[0].id === "pointer" && W.ui.pinIcons.label("pointer") === "Por defecto" && /pin-glyph__body/.test(W.ui.pinIcons.svg("pointer")), { cat: cat0.label });
  C["01b_sin_errores_de_pagina"] = { pass: !pageError, detail: pageError };
  } catch (e) { C.__exception = { pass: false, detail: String(e && e.stack || e).slice(0, 400) }; }
  return JSON.stringify(C);
})()
