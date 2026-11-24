// Prueba de aceptación de SPEC 12 (panel de progreso de pines y enmiendas del panel lateral).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-12.js
//
// Devuelve { "<nº>_<nombre>": { pass, detail } }, numerados por orden en la spec.
// Notas:
//   - "Recargar" / "volver a abrir" se hace remontando el visor (pasar por "#/" y volver).
//   - El panel de progreso empieza plegado: `expandHud()` lo despliega antes de mirar el cuerpo.
//   - Pantalla completa simulada como en spec-06.js (headless rechaza requestFullscreen).
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval
//       (08, 13 y 22 provocan a propósito errores "[pin-layer]" / "[viewer]" en consola).
//   31  grep "indexedDB" js/ui (sin usos).
//   32  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   33  spec-05, 07, 09, 10, 11 y este script pasan con un WP_PROFILE vacío.
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
  const drag = async (x0, y0, x1, y1) => {
    const ev = [M("mouseMoved", x0, y0), M("mousePressed", x0, y0, { button: "left", clickCount: 1 })];
    for (let i = 1; i <= 10; i++) ev.push(M("mouseMoved", x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * i) / 10, { buttons: 1 }));
    await input(ev, 120); await input([M("mouseMoved", x1, y1, { buttons: 1 })], 100); await input([M("mouseReleased", x1, y1, { button: "left", clickCount: 1 })], 500);
  };
  const key = (k, code, vk, text) => input([["Input.dispatchKeyEvent", Object.assign({ type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }, text != null ? { text } : {})], ["Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }]], 250);
  const esc = async () => { await window.cdpKey("Escape"); await sleep(300); };
  const png = async (n) => { const c = new OffscreenCanvas(1200, 800); const g = c.getContext("2d"); g.fillStyle = "#468"; g.fillRect(0, 0, 1200, 800); return new File([await c.convertToBlob({ type: "image/png" })], n, { type: "image/png" }); };

  const gs = W.services.gameService, ms = W.services.mapService, mk = W.services.markerService, ls = W.services.labelService;
  const st = { icon: "exclamation", color: "gold", size: 32 };
  const g = await gs.create("Juego 12", null);
  const [mA, mB, mE] = (await ms.importFiles(g.id, [await png("A.png"), await png("B.png"), await png("C.png")])).imported.sort((a, b) => a.name.localeCompare(b.name));
  const ids = [];
  for (let i = 0; i < 40; i++) ids.push((await mk.create(mA.id, { x: .05 + (i % 10) * .09, y: .2 + Math.floor(i / 10) * .2, name: "p" + i, ...st })).id);
  for (let i = 0; i < 12; i++) await mk.setFound(ids[i], true);
  for (let i = 0; i < 3; i++) { const p = await mk.create(mB.id, { x: .2 + i * .2, y: .5, name: "b" + i, ...st }); if (i === 0) await mk.setFound(p.id, true); }
  await ls.create(mA.id, { x: .5, y: .08, text: "Zona", note: "", color: "white", size: 12 });

  let map = null; L.Map.addInitHook(function () { map = this; });
  const go = async (id) => { location.hash = "#/"; await sleep(400); location.hash = "#/map/" + id; await waitFor(() => !!$(".viewer__progress") && $(".viewer__progress-filter-btn") && !$(".viewer__progress-filter-btn").disabled); await sleep(800); };
  const hud = () => $(".viewer__progress"), tog = () => $(".viewer__progress-toggle"), body = () => $(".viewer__progress-body");
  const expandHud = async () => { if (tog().getAttribute("aria-expanded") === "false") { tog().click(); await sleep(150); } };
  const line = (k) => ({ count: $(`.viewer__progress-${k} .viewer__progress-count`).textContent, pct: $(`.viewer__progress-${k} .viewer__progress-pct`).textContent });
  const mapNums = () => line("map").count, gameNums = () => line("game").count;
  const nums = () => mapNums() + " | " + gameNums();
  const layerByName = (name) => { let f = null; map.eachLayer((l) => { if (l.getTooltip && l.getTooltip() && l.getTooltip().getContent().textContent === name) f = l; }); return f; };
  const openPopup = async (name) => { layerByName(name).openPopup(); await sleep(200); };
  const fbtn = (k) => $(`.viewer__progress-filter-btn[data-filter="${k}"]`);
  const visible = (e) => !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0;

  // 02 panel plegado al abrir
  await go(mA.id);
  const r0 = hud().getBoundingClientRect();
  const collapsed0 = tog().getAttribute("aria-expanded") === "false" && body().hidden && $(".viewer__progress-pill").textContent === "12/40";
  await expandHud();
  ok("02_panel_plegado", collapsed0 && hud().getAttribute("aria-label") === "Progreso" && hud().parentElement === $(".viewer__stage").parentElement
    && Math.abs(r0.right - (innerWidth - 16)) <= 1 && Math.abs(r0.top - 16) <= 1 && $(".viewer__progress-title").textContent.toUpperCase() === "PROGRESO" && visible($(".viewer__progress-title")),
    { collapsed0, right: r0.right, top: r0.top });

  // 03 cifras y bloques
  ok("03_cifras", mapNums() === "12 / 40" && line("map").pct === "30 %" && $$(".viewer__progress-map .viewer__progress-seg").length === 20 && $$(".viewer__progress-map .viewer__progress-seg.is-on").length === 6, line("map"));
  // 04 aria de la barra
  const bar = $(".viewer__progress-map .viewer__progress-bar");
  ok("04_aria", bar.getAttribute("role") === "progressbar" && bar.getAttribute("aria-valuenow") === "12" && bar.getAttribute("aria-valuemax") === "40" && bar.getAttribute("aria-valuetext") === "12 de 40 encontrados");

  // 07/12 marcar y desmarcar; juego = A + B
  const game0 = gameNums();
  await openPopup("p20"); $(".pin-popup__found").click(); await sleep(150);
  const afterMark = nums();
  $(".pin-popup__found").click(); await sleep(150);
  const afterUnmark = nums();
  ok("05_marcar_desmarcar", afterMark === "13 / 40 | 14 / 43" && afterUnmark === "12 / 40 | 13 / 43", { afterMark, afterUnmark });
  ok("10_juego_suma", game0 === "13 / 43", game0);

  // 06 fallo de setFound
  const realSet = mk.setFound; mk.setFound = () => sleep(300).then(() => { throw new Error("fallo provocado (spec-12)"); });
  $(".pin-popup__found").click(); await sleep(50);
  const optimistic = mapNums(); await sleep(500);
  ok("06_revert_setFound", optimistic === "13 / 40" && mapNums() === "12 / 40", { optimistic, after: mapNums() });
  mk.setFound = realSet; map.closePopup(); await sleep(200);

  // 07 crear y borrar
  // Crear por la UI (Añadir pin + Guardar), que pasa por pins.add.
  $('.view-controls__btn[aria-label="Añadir pin"]').click(); await sleep(1200);
  $(".pin-editor .btn--primary").click(); await sleep(600);
  const afterCreate = nums();
  await openPopup("p0"); $(".pin-popup__delete").click(); await sleep(300);
  const confirm = $$("dialog[open] button").find((x) => /borrar/i.test(x.textContent)); if (confirm) confirm.click(); await sleep(500);
  const afterDelete = nums();
  ok("07_crear_borrar", afterCreate === "12 / 41 | 13 / 44" && afterDelete === "11 / 40 | 12 / 43", { afterCreate, afterDelete });

  // 08 editar y mover no cambian
  const before8 = nums();
  await openPopup("p5"); $(".pin-popup__edit").click(); await sleep(400);
  const hiddenEditPin = !visible(hud());
  $(".pin-editor .btn--primary").click(); await sleep(600);
  const backAfterEdit = visible(hud());
  const ll = layerByName("p6").getLatLng(); const sp = map.latLngToContainerPoint(ll); const sr = $(".viewer__stage").getBoundingClientRect();
  await drag(sr.left + sp.x, sr.top + sp.y, sr.left + sp.x + 40, sr.top + sp.y + 30);
  ok("08_editar_mover", nums() === before8, { before8, after: nums() });

  // 09/16 filtros no cambian cifras; apagar Encontrados
  await expandHud();
  const pinsBefore = $$(".leaflet-marker-icon.pin").length;
  const fTexts = [fbtn("pending").textContent, fbtn("found").textContent];
  const pressed0 = [fbtn("pending").getAttribute("aria-pressed"), fbtn("found").getAttribute("aria-pressed")].join(",");
  await clickEl(fbtn("found"), 400);
  const pinsAfter = $$(".leaflet-marker-icon.pin").length;
  const rec = (await ms.open(mA.id)).map;
  ok("16_apagar_encontrados", fbtn("found").getAttribute("aria-pressed") === "false" && pinsAfter === pinsBefore - 11 && rec.hideFound === true, { pinsBefore, pinsAfter, hideFound: rec.hideFound });
  await clickEl(fbtn("pending"), 400);
  ok("09_filtros_no_cambian", nums() === before8 && $$(".leaflet-marker-icon.pin").length === 0, nums());
  await clickEl(fbtn("pending"), 400);
  // 13 botones con cifras y aria-pressed según el mapa (remontado: hideFound sigue true)
  await go(mA.id); await expandHud();
  ok("13_botones_filtro", /Pendientes\s*29/.test(fbtn("pending").textContent) && /Encontrados\s*11/.test(fbtn("found").textContent) && pressed0 === "true,true"
    && fbtn("pending").getAttribute("aria-pressed") === "true" && fbtn("found").getAttribute("aria-pressed") === "false", { fTexts, now: [fbtn("pending").textContent, fbtn("found").textContent] });
  // 17 fallo de setHideFound
  const realHide = ms.setHideFound; ms.setHideFound = () => Promise.reject(new Error("fallo provocado (spec-12)"));
  await clickEl(fbtn("found"), 500);
  ok("17_fallo_filtro", $(".notice") && /No se pudo guardar el filtro\./.test($(".notice").textContent) && fbtn("found").getAttribute("aria-pressed") === "false");
  ms.setHideFound = realHide;
  await clickEl(fbtn("found"), 400); // vuelve a mostrar encontrados

  // 14 panel lateral sin filtros
  ok("14_lateral_sin_filtros", !$(".viewer__pin-filter") && !$(".viewer__pin-filter-btn"));

  // 11 plegar / desplegar con clic, Enter y Espacio
  tog().click(); await sleep(150);
  const c1 = body().hidden && tog().getAttribute("aria-expanded") === "false" && $(".viewer__progress-pill").textContent === "11/40" && visible($(".viewer__progress-pill"));
  tog().click(); await sleep(150);
  const e1 = !body().hidden && tog().getAttribute("aria-expanded") === "true";
  tog().focus(); await window.cdpKey("Enter"); await sleep(200);
  const k1 = body().hidden;
  await key(" ", "Space", 32, " ");
  const k2 = !body().hidden;
  ok("11_plegar", c1 && e1 && k1 && k2, { c1, e1, k1, k2 });

  // 12 al volver a abrir, plegado
  await go(mA.id);
  ok("12_reabrir_plegado", tog().getAttribute("aria-expanded") === "false" && body().hidden);

  // 15 panel lateral tras el selector / lista abierta (lo cubre también spec-07.js)
  $(".viewer__toggle").click(); await sleep(400);
  const listOpen0 = $(".viewer__map-trigger")?.getAttribute("aria-expanded") === "true";
  const row = $$("button.viewer__map-row").find((r) => r.dataset.mapId === mB.id);
  await clickEl(row, 300);
  await waitFor(() => location.hash === "#/map/" + mB.id && !!$(".viewer__map-trigger")); await sleep(800);
  const keptOpen = !$(".viewer").classList.contains("viewer--panel-collapsed") && $(".viewer__map-trigger").getAttribute("aria-expanded") === "true";
  await go(mB.id);
  const fresh = $(".viewer").classList.contains("viewer--panel-collapsed");
  ok("15_panel_tras_selector", keptOpen && fresh, { keptOpen, fresh });
  $(".viewer__toggle").click(); await sleep(400);
  await clickAt(innerWidth - 300, innerHeight - 120, 300);
  const afterMapClick = $(".viewer__map-trigger").getAttribute("aria-expanded") === "true";
  $(".viewer__toggle").click(); await sleep(400); $(".viewer__toggle").click(); await sleep(400);
  const afterToggle = $(".viewer__map-trigger").getAttribute("aria-expanded") === "true";
  $(".viewer__map-trigger").click(); await sleep(200);
  const closedByTrigger = $(".viewer__map-trigger").getAttribute("aria-expanded") === "false";
  ok("15b_lista_abierta", listOpen0 && afterMapClick && afterToggle && closedByTrigger, { listOpen0, afterMapClick, afterToggle, closedByTrigger });

  // 18 mapa sin pines
  await go(mE.id); await expandHud();
  ok("18_sin_pines", mapNums() === "0 / 0" && line("map").pct === "Sin pines" && $$(".viewer__progress-map .is-on").length === 0 && parseFloat(getComputedStyle($(".viewer__progress-map")).opacity) < 1 && visible(hud()), line("map"));

  // 19/20 COMPLETADO
  await go(mB.id); await expandHud();
  await openPopup("b1"); $(".pin-popup__found").click(); await sleep(150); map.closePopup();
  await openPopup("b2"); $(".pin-popup__found").click(); await sleep(150);
  const pct = () => $(".viewer__progress-map .viewer__progress-pct");
  const live = { text: pct().textContent, neon: pct().classList.contains("neon-green"), flicker: pct().classList.contains("flicker") };
  $(".pin-popup__found").click(); await sleep(150);
  const unmarked = pct().textContent;
  $(".pin-popup__found").click(); await sleep(300); map.closePopup();
  await go(mB.id); await expandHud();
  const reopened = { text: pct().textContent, flicker: pct().classList.contains("flicker") };
  ok("19_completado", live.text === "COMPLETADO" && live.neon && live.flicker && reopened.text === "COMPLETADO" && !reopened.flicker, { live, reopened });
  ok("20_desmarcar_completo", unmarked === "66 %", unmarked);

  // 21 modos añadir / editar ocultan el panel
  await go(mA.id);
  const modes = {};
  $('.view-controls__btn[aria-label="Añadir pin"]').click(); await sleep(400); modes.addPin = !visible(hud()); await esc(); modes.back1 = visible(hud());
  $('.view-controls__btn[aria-label="Añadir texto"]').click(); await sleep(400); modes.addLabel = !visible(hud()); await esc(); modes.back2 = visible(hud());
  let labelLayer = null; map.eachLayer((l) => { if (l.getElement && l.getElement() && l.getElement().querySelector(".label-glyph")) labelLayer = l; });
  labelLayer.openPopup(); await sleep(200); $(".label-popup__edit").click(); await sleep(400); modes.editLabel = !visible(hud()); await esc(); modes.back3 = visible(hud());
  modes.editPin = hiddenEditPin; modes.back4 = backAfterEdit;
  ok("21_modos", Object.values(modes).every(Boolean), modes);

  // 22 pantalla completa simulada
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => document.documentElement });
  document.dispatchEvent(new Event("fullscreenchange")); await sleep(200);
  ok("22_pantalla_completa", $(".viewer").classList.contains("viewer--fullscreen") && visible(hud()));
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => null });
  document.dispatchEvent(new Event("fullscreenchange")); await sleep(200);

  // 23 rueda y arrastre sobre el panel
  await expandHud();
  const z0 = map.getZoom(), c0 = map.getCenter();
  const hr = hud().getBoundingClientRect();
  await input([M("mouseWheel", hr.left + 40, hr.top + 60, { deltaX: 0, deltaY: -300 })], 600);
  await drag(hr.left + 40, hr.top + 70, hr.left - 200, hr.top + 300);
  ok("23_rueda_arrastre", Math.abs(map.getZoom() - z0) < 1e-6 && map.getCenter().equals(c0), { z0, z: map.getZoom() });

  // 24 movimiento reducido
  await input([["Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }]], 300);
  pct().classList.add("flicker");
  ok("24_movimiento_reducido", getComputedStyle(pct()).animationName === "none" && parseFloat(getComputedStyle($(".viewer__progress-seg")).transitionDuration) === 0);
  pct().classList.remove("flicker");
  await input([["Emulation.setEmulatedMedia", { features: [] }]], 200);

  // 25 foco visible hacia dentro
  await key("Tab", "Tab", 9);
  const focusOf = (e) => { e.focus(); const s = getComputedStyle(e); return e.matches(":focus-visible") && s.outlineStyle !== "none" && parseFloat(s.outlineOffset) < 0; };
  ok("25_foco", focusOf(tog()) && focusOf(fbtn("pending")) && focusOf(fbtn("found")));

  // 13b fallo de progressByGame
  const realProg = mk.progressByGame; mk.progressByGame = () => Promise.reject(new Error("fallo provocado (spec-12)"));
  await go(mA.id); await expandHud();
  ok("26_fallo_juego", gameNums() === "—" && !$(".notice") && mapNums() === "11 / 40", { game: gameNums(), map: mapNums() });
  mk.progressByGame = realProg;
  location.hash = "#/";
  } catch (e) { C.__error = { pass: false, detail: String(e && e.stack || e) }; }
  return C;
})()
