// Prueba de aceptación de SPEC 01 (biblioteca de mapas y visor).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-01.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } } }, numerados como en la spec.
// Fuera de este script: F5 y persistencia (reejecutar cdp-eval con el mismo WP_PROFILE sobre
// "#/map/<inazumaId>" y "#/game/<gameId>"; ambos ids salen en el resultado), y las reglas de capas (grep). El reinicio del PC es manual.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const R = Waypoint.data.mapsRepository;
  const C = {};
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const names = () => $$(".map-card__name").map((n) => n.textContent);
  const notices = () => $$(".notice__message").map((n) => n.textContent);
  const clearNotices = () => $$(".notice").forEach((n) => n.remove());
  const dlg = () => $("dialog.dialog");
  const key = async (k) => { window.cdpKey(k); await sleep(300); };
  const input = async (ev, wait = 600) => { window.cdpInput(JSON.stringify(ev)); await sleep(wait); };
  const typeInto = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
  const conn = await Waypoint.data.db.open();
  const all = (store) => new Promise((r) => { const q = conn.transaction(store).objectStore(store).getAll(); q.onsuccess = () => r(q.result); });

  const make = async (w, h, type, name, hue = 140) => {
    const c = new OffscreenCanvas(w, h); const g = c.getContext("2d");
    g.fillStyle = `hsl(${hue},40%,30%)`; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 200) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    return new File([await c.convertToBlob({ type, quality: 0.9 })], name, { type });
  };
  const choose = (files) => {
    const el = $('.library input[type="file"]'); const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f)); el.files = dt.files; el.dispatchEvent(new Event("change"));
  };
  const drop = (files) => {
    const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f));
    const fire = (t) => document.body.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
    fire("dragenter"); fire("dragover"); fire("drop");
  };
  const card = (n) => $$(".map-card").find((c) => c.querySelector(".map-card__name").textContent === n);

  // Desde SPEC 03 todo mapa vive en un juego: se crea uno por servicio y se trabaja en su vista.
  const game = await Waypoint.services.gameService.create("Juego de prueba", null);
  const gameHash = "#/game/" + game.id;
  window.location.hash = gameHash;
  await waitFor(() => !!$(".drop-zone"));

  // 2. Estado vacío
  ok("02_empty_state", $(".drop-zone") && names().length === 0, $(".drop-zone__title")?.textContent);

  // 3. Selector con JPG, PNG y WebP
  choose([await make(3000, 2000, "image/jpeg", "Lapis.jpg", 120), await make(1600, 1600, "image/png", "Mondstadt.png", 200), await make(1200, 2000, "image/webp", "Inazuma.webp", 280)]);
  await waitFor(() => names().length === 3); await sleep(300);
  const thumbsOk = $$(".map-card img").every((i) => i.complete && i.naturalWidth > 0);
  ok("03_selector_3_cards", names().length === 3 && thumbsOk && ["Lapis", "Mondstadt", "Inazuma"].every((n) => names().includes(n)), names());

  // 4. Soltar 2
  clearNotices();
  drop([await make(800, 600, "image/png", "Norte.png", 30), await make(800, 600, "image/jpeg", "Sur.jpg", 60)]);
  await waitFor(() => names().length === 5); await sleep(300);
  ok("04_drop_2_cards", names().length === 5 && names().includes("Norte") && names().includes("Sur"), names());

  // 5. Soltar .txt
  clearNotices();
  drop([new File(["hola"], "notas.txt", { type: "text/plain" })]);
  await waitFor(() => notices().length > 0); await sleep(300);
  ok("05_drop_txt", names().length === 5 && notices().some((n) => n.includes("notas.txt")), notices());

  // 6. Imagen grande: Cancelar / Continuar (+ Esc del criterio 11)
  const big = await make(16385, 4, "image/png", "Gigante.png");
  choose([big]); await waitFor(() => !!dlg());
  const bigMsg = dlg().querySelector(".dialog__message").textContent;
  dlg().querySelector('button[value="cancel"]').click();
  await sleep(800);
  const afterCancel = (await R.list()).length;
  choose([big]); await waitFor(() => !!dlg());
  await key("Escape"); await sleep(600);
  const afterEsc = (await R.list()).length;
  choose([big]); await waitFor(() => !!dlg());
  dlg().querySelector('button[value="confirm"]').click();
  await waitFor(() => names().includes("Gigante")); await sleep(200);
  ok("06_large_warning", bigMsg.includes("16385") && afterCancel === 5 && names().length === 6, { bigMsg, afterCancel });
  const escLarge = afterEsc === 5;

  // 7. Registros maps + images con dimensiones originales
  const maps = await all("maps"); const images = await all("images");
  const expected = { Lapis: [3000, 2000], Mondstadt: [1600, 1600], Inazuma: [1200, 2000], Norte: [800, 600], Sur: [800, 600], Gigante: [16385, 4] };
  const dimsOk = maps.every((m) => expected[m.name] && m.width === expected[m.name][0] && m.height === expected[m.name][1]);
  const imgOk = maps.every((m) => images.some((i) => i.mapId === m.id && i.blob instanceof Blob && i.blob.size === m.fileSize));
  ok("07_records_maps_images", maps.length === 6 && images.length === 6 && dimsOk && imgOk, { maps: maps.length, images: images.length });

  // 10. Renombrar no admite vacío / espacios
  card("Lapis").querySelector(".map-card__action--rename").click(); await sleep(150);
  const rin = dlg().querySelector("input");
  typeInto(rin, ""); const d1 = dlg().querySelector('button[value="confirm"]').disabled;
  typeInto(rin, "    "); const d2 = dlg().querySelector('button[value="confirm"]').disabled;
  await key("Enter"); const stillOpen = !!dlg();
  ok("10_rename_no_blank", d1 && d2 && stillOpen && (await R.list()).find((m) => m.id === maps.find((x) => x.name === "Lapis").id).name === "Lapis");

  // 11. Esc en renombrar
  await key("Escape"); await sleep(200);
  const escRename = !dlg() && names().includes("Lapis");

  // 9a. Renombrar cambia la tarjeta
  card("Lapis").querySelector(".map-card__action--rename").click(); await sleep(150);
  typeInto(dlg().querySelector("input"), "Lapis Renombrado"); await key("Enter");
  await waitFor(() => names().includes("Lapis Renombrado"));
  const renamedCard = names().includes("Lapis Renombrado");

  // 12. Borrar pide confirmación; Cancelar y Esc no borran
  card("Sur").querySelector(".map-card__action--remove").click(); await sleep(150);
  const confirmShown = !!dlg() && dlg().querySelector(".dialog__title").textContent.includes("Sur");
  dlg().querySelector('button[value="cancel"]').click(); await sleep(300);
  const keptCancel = names().includes("Sur") && (await R.list()).length === 6;
  card("Sur").querySelector(".map-card__action--remove").click(); await sleep(150);
  await key("Escape"); await sleep(200);
  const escDelete = !dlg() && names().includes("Sur");
  ok("12_delete_confirm_cancel", confirmShown && keptCancel);
  ok("11_esc_closes_dialogs", escRename && escDelete && escLarge, { escRename, escDelete, escLarge });

  // 13. Confirmar borrado elimina maps, images y markers
  const surId = maps.find((m) => m.name === "Sur").id;
  await new Promise((r) => { const tx = conn.transaction("markers", "readwrite"); tx.objectStore("markers").put({ id: "acc-m1", mapId: surId, x: 0.1, y: 0.1 }); tx.objectStore("markers").put({ id: "acc-m2", mapId: surId, x: 0.2, y: 0.2 }); tx.oncomplete = r; });
  card("Sur").querySelector(".map-card__action--remove").click(); await sleep(150);
  dlg().querySelector('button[value="confirm"]').click();
  await waitFor(() => !names().includes("Sur")); await sleep(200);
  const leftMarkers = (await all("markers")).filter((m) => m.mapId === surId).length;
  ok("13_delete_removes_all", !names().includes("Sur") && !(await R.get(surId)) && !(await R.getImage(surId)) && leftMarkers === 0);

  // 14. Clic en tarjeta → visor ajustado
  card("Lapis Renombrado").querySelector("a").click();
  await waitFor(() => $(".leaflet-image-layer")?.complete); await sleep(500);
  const stage = $(".viewer__stage").getBoundingClientRect();
  const img = $(".leaflet-image-layer");
  const ir = () => img.getBoundingClientRect();
  const fit = ir();
  const inside = fit.left >= stage.left - 1 && fit.right <= stage.right + 1 && fit.top >= stage.top - 1 && fit.bottom <= stage.bottom + 1;
  const touches = Math.abs(fit.width - stage.width) < 2 || Math.abs(fit.height - stage.height) < 2;
  const lapisId = maps.find((m) => m.name === "Lapis").id;
  ok("14_click_opens_fitted", window.location.hash === "#/map/" + lapisId && inside && touches, { img: [Math.round(fit.width), Math.round(fit.height)], stage: [stage.width, stage.height] });

  // 9b. Nombre en la barra del visor
  ok("09_rename_card_and_viewer", renamedCard && $(".viewer__title").textContent === "Lapis Renombrado");

  // 15/16/17. Zoom, arrastre, límites
  const cx = stage.left + stage.width / 2, cy = stage.top + stage.height / 2;
  const wheel = (dy) => ["Input.dispatchMouseEvent", { type: "mouseWheel", x: cx, y: cy, deltaX: 0, deltaY: dy }];
  const drag = (dx, dy) => [
    ["Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy }],
    ["Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 }],
    ...Array.from({ length: 10 }, (_, i) => ["Input.dispatchMouseEvent", { type: "mouseMoved", x: cx + (dx * (i + 1)) / 10, y: cy + (dy * (i + 1)) / 10, button: "left", buttons: 1 }]),
    ["Input.dispatchMouseEvent", { type: "mouseReleased", x: cx + dx, y: cy + dy, button: "left", clickCount: 1 }],
  ];
  // Desde SPEC 04 el mínimo es 1/4 del ancho de ajuste (fitZoom − 2).
  await input([wheel(1000)]);
  const minHeld = Math.abs(ir().width - fit.width / 4) < fit.width * 0.01;
  await input([wheel(-900)], 800);
  const zoomedIn = ir().width > fit.width + 10;
  const b = ir(); await input(drag(-200, -120), 800); const a = ir();
  const dragged = Math.abs(a.left - b.left) > 20 || Math.abs(a.top - b.top) > 20;
  ok("15_wheel_zoom_and_drag", zoomedIn && dragged);
  // Desde SPEC 04 la imagen puede salir de la vista, pero quedan siempre 100 px de ella dentro por eje.
  const visible = (r) => [Math.min(r.right, stage.right) - Math.max(r.left, stage.left), Math.min(r.bottom, stage.bottom) - Math.max(r.top, stage.top)];
  const keeps100 = (r) => visible(r).every((v) => Math.abs(v - 100) <= 1);
  await input(drag(4000, 4000), 1000);
  const f1 = ir();
  await input(drag(-4000, -4000), 1000);
  const f2 = ir();
  ok("17_cannot_lose_image", keeps100(f1) && keeps100(f2), { visibleTL: visible(f1).map(Math.round), visibleBR: visible(f2).map(Math.round) });
  for (let i = 0; i < 14; i++) await input([wheel(-600)], 220);
  await sleep(700);
  const maxScale = ir().width / 3000;
  ok("16_zoom_limits", minHeld && Math.abs(maxScale - 4) < 0.01, { maxScale: +maxScale.toFixed(3), minHeld });

  // 18. ← Mapas (vuelve al juego) y botón atrás
  $(".viewer__back").click();
  await waitFor(() => names().length === 5); await sleep(300);
  const backBtn = window.location.hash === gameHash && !$(".leaflet-container");
  // 8. El abierto pasa primero
  ok("08_opened_goes_first", names()[0] === "Lapis Renombrado", names());
  card("Mondstadt").querySelector("a").click();
  await waitFor(() => !!$(".leaflet-image-layer")); await sleep(300);
  history.back();
  await waitFor(() => names().length === 5); await sleep(300);
  ok("18_back_and_browser_back", backBtn && window.location.hash === gameHash && names()[0] === "Mondstadt");

  // 20. #/map/no-existe (vuelve al inicio de juegos)
  clearNotices();
  window.location.hash = "#/map/no-existe";
  await waitFor(() => window.location.hash === "#/" && !!$(".games")); await sleep(300);
  ok("20_missing_map_redirects", window.location.hash === "#/" && notices().some((n) => n.includes("no existe")), notices());

  // Dejar Inazuma para F5.
  const inazumaId = maps.find((m) => m.name === "Inazuma").id;
  localStorage.setItem("acc-inazuma", inazumaId);
  localStorage.setItem("acc-names", JSON.stringify(names()));
  return { criteria: C, inazumaId, gameId: game.id };
})()
