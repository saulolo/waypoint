// Prueba de aceptación de SPEC 03 (carpetas de juegos con portada).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-03.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } }, gameId, renamed }, numerados como en la spec.
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval.
//   02  migración desde un perfil v1: abrir con una base v1 con mapas y cargar index.html (ver SPEC 03, paso 2).
//   32  F5: reejecutar cdp-eval con el mismo WP_PROFILE sobre "#/game/<gameId>" y comprobar `.game-head`.
//   33  persistencia: lo mismo tras cerrar el navegador (cdp-eval ya lo cierra entre ejecuciones).
//   34  grep "indexedDB" js/ui y grep "document" js/data (sin usos).
//   35  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   36  spec-01.js, spec-02.js y este script pasan con un WP_PROFILE vacío.
//   37  grep "SPEC 03" en README.md, specs/01-*, specs/02-* y js/ sin menciones a marcadores.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const C = {};
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const css = (el) => getComputedStyle(el);
  const notices = () => $$(".notice__message").map((n) => n.textContent);
  const clearNotices = () => $$(".notice").forEach((n) => n.remove());
  const dlg = () => $("dialog[open]");
  const dbtn = (t) => [...dlg().querySelectorAll("button")].find((b) => b.textContent === t);
  const typeInto = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
  const GS = Waypoint.services.gameService;
  const conn = await Waypoint.data.db.open();
  const all = (store) => new Promise((r) => { const q = conn.transaction(store).objectStore(store).getAll(); q.onsuccess = () => r(q.result); });
  const gameCards = () => $$(".game-card");
  const gameCard = (n) => gameCards().find((c) => c.querySelector(".game-card__name").textContent === n);
  const mapNames = () => $$(".map-card__name").map((n) => n.textContent);
  const go = async (hash, ready) => { window.location.hash = hash; await waitFor(ready); await sleep(250); };
  const goHome = async () => { if (window.location.hash === "#/" || window.location.hash === "") { window.location.hash = "#/x"; await sleep(150); } await go("#/", () => !!$(".games")); await waitFor(() => !!$(".games-empty, .game-grid")); };
  const key = async (k) => { window.cdpKey(k); await sleep(300); };

  const make = async (w, h, type, name, hue = 140) => {
    const c = new OffscreenCanvas(w, h); const g = c.getContext("2d");
    g.fillStyle = `hsl(${hue},40%,30%)`; g.fillRect(0, 0, w, h);
    return new File([await c.convertToBlob({ type })], name, { type });
  };
  const dtWith = (files) => { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); return dt; };
  const pasteInto = (dt) => document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  const dropOn = (el, files) => { const ev = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dtWith(files) }); el.dispatchEvent(ev); return ev; };
  const previewImg = () => dlg() && dlg().querySelector(".cover-zone__img");
  const openCreate = async () => {
    const b = $$("button").find((x) => x.textContent === "Crear juego" && !x.hidden && !x.closest("dialog"));
    b.click(); await waitFor(() => !!dlg()); await sleep(150);
  };
  const save = async (label = "Crear") => { dbtn(label).click(); await waitFor(() => !dlg()); await sleep(500); };
  const dims = async (blob) => { const b = await createImageBitmap(blob); const d = [b.width, b.height]; b.close(); return d; };

  // 2/3. Esquema v2 o posterior (SPEC 10 sube a v3; el caso "perfil v1 con mapas" se prueba aparte)
  const fresh = (await all("maps")).length + (await all("images")).length + (await all("markers")).length;
  ok("02_db_v2_games_store", conn.version >= 2 && conn.objectStoreNames.contains("games") && fresh === 0, { version: conn.version });
  const mapsStore = conn.transaction("maps").objectStore("maps");
  ok("03_maps_index_gameId", mapsStore.indexNames.contains("gameId") && !mapsStore.index("gameId").unique, [...mapsStore.indexNames]);

  // 4. Sin juegos
  await goHome();
  const createBtns = $$("button").filter((b) => b.textContent === "Crear juego" && !b.hidden);
  ok("04_home_empty", $(".library-hero__subtitle").innerText === "CREA UN JUEGO PARA EMPEZAR _" && createBtns.length === 1, $(".library-hero__subtitle").innerText);

  // 6. Sin "Cargar mapas" ni input de archivos en el inicio
  ok("06_home_no_load", !$('input[type="file"]') && !$$("button").some((b) => b.textContent === "Cargar mapas"));

  // 7. Soltar una imagen en el inicio
  clearNotices();
  const homeDrop = dropOn(document.body, [await make(400, 300, "image/png", "suelta.png")]);
  await sleep(300);
  ok("07_home_drop", homeDrop.defaultPrevented && (await all("maps")).length === 0 && ["", "#/"].includes(window.location.hash) && notices().some((n) => n.includes("Entra en un juego para cargar mapas")), notices());

  // 8. Nombre vacío o solo espacios
  await openCreate();
  const createBtn = () => dbtn("Crear");
  const emptyDisabled = createBtn().disabled;
  typeInto(dlg().querySelector(".dialog__input"), "    ");
  const spacesDisabled = createBtn().disabled;
  await key("Enter");
  ok("08_name_required", emptyDisabled && spacesDisabled && !!dlg() && (await GS.listSorted()).length === 0);

  // 12. Pegar solo texto
  clearNotices();
  const textClip = new DataTransfer(); textClip.setData("text/plain", "https://ejemplo.com/portada.png");
  pasteInto(textClip);
  await sleep(250);
  ok("12_paste_text", !previewImg() && notices().some((n) => n.includes("El portapapeles no tiene una imagen")), notices());

  // 14. Un .txt como portada
  clearNotices();
  dropOn(dlg(), [new File(["hola"], "notas.txt", { type: "text/plain" })]);
  await sleep(400);
  ok("14_txt_rejected", !previewImg() && notices().some((n) => n.includes("notas.txt")), notices());

  // 13. Soltar una imagen en la zona de portada
  dropOn(dlg().querySelector(".cover-zone"), [await make(300, 300, "image/png", "zona.png")]);
  await waitFor(() => !!previewImg());
  ok("13_drop_preview", !!previewImg());
  dbtn("Quitar").click();

  // 10. Elegir un PNG 2000×3000 como portada (selector de archivos del diálogo)
  const fileInput = dlg().querySelector('.cover-zone input[type="file"]');
  fileInput.files = dtWith([await make(2000, 3000, "image/png", "grande.png", 200)]).files;
  fileInput.dispatchEvent(new Event("change"));
  await waitFor(() => !!previewImg());
  typeInto(dlg().querySelector(".dialog__input"), "The Final Fantasy Legend");
  await save();
  const gA = (await GS.listSorted()).find((g) => g.name === "The Final Fantasy Legend");
  const dimsA = gA && gA.cover ? await dims(gA.cover) : null;
  ok("10_cover_webp_600", gA && gA.cover instanceof Blob && gA.cover.type === "image/webp" && Math.max(...dimsA) === 600, { type: gA?.cover?.type, dims: dimsA });

  // 9. Juego sin portada → placeholder con inicial
  await openCreate();
  typeInto(dlg().querySelector(".dialog__input"), "Sin portada");
  await save();
  const placeholder = gameCard("Sin portada")?.querySelector(".game-placeholder");
  ok("09_placeholder_initial", placeholder && placeholder.textContent === "S" && !gameCard("Sin portada").querySelector("img"), placeholder?.textContent);

  // 11. Pegar una imagen: vista previa y portada al guardar
  await openCreate();
  pasteInto(dtWith([await make(500, 700, "image/png", "image.png", 20)]));
  await waitFor(() => !!previewImg());
  const pastePreview = !!previewImg();
  typeInto(dlg().querySelector(".dialog__input"), "Pegado");
  await save();
  const gC = (await GS.listSorted()).find((g) => g.name === "Pegado");
  ok("11_paste_image", pastePreview && gC && gC.cover instanceof Blob && !!gameCard("Pegado").querySelector("img"), { pastePreview, cover: !!gC?.cover });

  // Cuarto juego para los acentos
  await openCreate();
  typeInto(dlg().querySelector(".dialog__input"), "Cuarto");
  await save();

  // 15. Esc cierra sin crear
  await openCreate();
  typeInto(dlg().querySelector(".dialog__input"), "No debe existir");
  await key("Escape");
  ok("15_esc_dialog", !dlg() && (await GS.listSorted()).length === 4 && !gameCard("No debe existir"));

  // 5. Con juegos: subtítulo
  ok("05_home_subtitle", $(".library-hero__subtitle").innerText === "MI MAPA MI 100% _", $(".library-hero__subtitle").innerText);

  // 16. Proporción 3:4 y object-fit: cover
  const cardsNow = gameCards();
  const ratios = cardsNow.map((c) => { const r = c.getBoundingClientRect(); return r.height / r.width; });
  const img = gameCard("The Final Fantasy Legend").querySelector("img");
  ok("16_card_ratio_cover", ratios.every((r) => Math.abs(r - 4 / 3) <= 0.02) && css(img).objectFit === "cover", { ratios, fit: css(img).objectFit });

  // 17. Nombre en pixel mayúsculas y "N MAPAS"
  const nameEl = gameCard("The Final Fantasy Legend").querySelector(".game-card__name");
  const metaEl = gameCard("The Final Fantasy Legend").querySelector(".game-card__meta");
  ok("17_card_name_meta", css(nameEl).fontFamily.includes("Press Start 2P") && css(nameEl).textTransform === "uppercase" && metaEl.innerText === "0 MAPAS", { meta: metaEl.innerText });

  // 18. Acentos rotativos en el orden de SPEC 02
  const accents = gameCards().slice(0, 4).map((c) => css(c).getPropertyValue("--card-accent").trim().toLowerCase());
  ok("18_card_accents", JSON.stringify(accents) === JSON.stringify(["#00f5ff", "#ff006e", "#f5ff00", "#00ff88"]), accents);

  // 19. Clic en tarjeta → #/game/<id>
  const idA = gA.id;
  gameCard("The Final Fantasy Legend").querySelector("a").click();
  await waitFor(() => !!$(".game-head")); await sleep(300);
  ok("19_card_opens_game", window.location.hash === "#/game/" + idA, window.location.hash);

  // 20. Vista de juego
  const head = $(".game-head");
  ok("20_game_view", head.querySelector(".game-head__back").textContent === "← Juegos" && !!head.querySelector("img, .game-placeholder") &&
    head.querySelector(".game-head__title").textContent === "The Final Fantasy Legend" && !!$$("button").find((b) => b.textContent === "Cargar mapas"));

  // 23. Juego sin mapas: zona de soltar de SPEC 01
  ok("23_empty_game_dropzone", !!$(".drop-zone") && mapNames().length === 0);

  // 21. Cargar 2 imágenes → 2 tarjetas con gameId
  const input = $('.library input[type="file"]');
  input.files = dtWith([await make(800, 600, "image/png", "Norte.png", 30), await make(900, 500, "image/jpeg", "Sur.jpg", 60)]).files;
  input.dispatchEvent(new Event("change"));
  await waitFor(() => mapNames().length === 2); await sleep(300);
  const mapsA = (await all("maps")).filter((m) => m.gameId === idA);
  ok("21_load_2_maps", mapNames().length === 2 && mapsA.length === 2, { cards: mapNames().length, records: mapsA.length });

  // 22. Los mapas de un juego no aparecen en otro
  const idB = (await GS.listSorted()).find((g) => g.name === "Sin portada").id;
  await go("#/game/" + idB, () => !!$(".drop-zone"));
  ok("22_maps_isolated", mapNames().length === 0 && !!$(".drop-zone"), mapNames());

  // 24. Abrir un mapa y "← Mapas" vuelve al juego
  await go("#/game/" + idA, () => mapNames().length === 2);
  $$(".map-card a").find((a) => a.textContent.includes("Norte")).click();
  await waitFor(() => !!$(".leaflet-image-layer")); await sleep(400);
  const backLabel = $(".viewer__back").textContent;
  $(".viewer__back").click();
  await waitFor(() => !!$(".game-head")); await sleep(300);
  ok("24_back_to_game", backLabel === "← Mapas" && window.location.hash === "#/game/" + idA, { backLabel, hash: window.location.hash });

  // 25. "← Juegos" y botón atrás vuelven a #/
  $(".game-head__back").click();
  await waitFor(() => !!$(".games")); await sleep(300);
  const viaLink = window.location.hash === "#/";
  gameCard("The Final Fantasy Legend").querySelector("a").click();
  await waitFor(() => !!$(".game-head")); await sleep(300);
  history.back();
  await waitFor(() => !!$(".games")); await sleep(300);
  ok("25_back_to_games", viaLink && window.location.hash === "#/", { viaLink, hash: window.location.hash });

  // 26. Abrir un mapa del último juego lo pone primero
  await go("#/game/" + idB, () => !!$(".drop-zone"));
  await go("#/game/" + idA, () => mapNames().length === 2);
  $$(".map-card a")[0].click();
  await waitFor(() => !!$(".leaflet-image-layer")); await sleep(300);
  await goHome();
  ok("26_last_used_first", gameCards()[0].querySelector(".game-card__name").textContent === "The Final Fantasy Legend", gameCards().map((c) => c.querySelector(".game-card__name").textContent));

  // 27. Renombrar
  gameCard("The Final Fantasy Legend").querySelector(".game-card__action--rename").click();
  await waitFor(() => !!dlg()); await sleep(150);
  typeInto(dlg().querySelector("input"), "FF Legend");
  await key("Enter"); await waitFor(() => !!gameCard("FF Legend")); await sleep(200);
  const renamedCard = !!gameCard("FF Legend");
  gameCard("FF Legend").querySelector("a").click();
  await waitFor(() => !!$(".game-head")); await sleep(300);
  ok("27_rename", renamedCard && $(".game-head__title").textContent === "FF Legend");
  await goHome();

  // 28. Cambiar portada y quitarla
  gameCard("Sin portada").querySelector(".game-card__action--cover").click();
  await waitFor(() => !!dlg()); await sleep(150);
  pasteInto(dtWith([await make(400, 600, "image/png", "image.png", 90)]));
  await waitFor(() => !!previewImg());
  await save("Guardar");
  const gotCover = !!gameCard("Sin portada").querySelector("img");
  gameCard("Sin portada").querySelector(".game-card__action--cover").click();
  await waitFor(() => !!dlg()); await sleep(150);
  dbtn("Quitar").click();
  await save("Guardar");
  const backToPlaceholder = !gameCard("Sin portada").querySelector("img") && !!gameCard("Sin portada").querySelector(".game-placeholder");
  ok("28_change_and_remove_cover", gotCover && backToPlaceholder, { gotCover, backToPlaceholder });

  // 29. Borrar pide confirmación con el nº de mapas; Cancelar no borra
  gameCard("FF Legend").querySelector(".game-card__action--remove").click();
  await waitFor(() => !!dlg()); await sleep(150);
  const msg = dlg().querySelector(".dialog__message").textContent;
  dbtn("Cancelar").click(); await sleep(400);
  ok("29_delete_confirm_cancel", msg.includes("2 mapas") && !!gameCard("FF Legend") && (await GS.listSorted()).length === 4, msg);

  // 30. Confirmar borra el juego y todos sus registros, sin tocar los de otros
  const idC = gC.id;
  await go("#/game/" + idC, () => !!$(".drop-zone"));
  const inputC = $('.library input[type="file"]');
  inputC.files = dtWith([await make(700, 500, "image/png", "Otro.png", 150)]).files;
  inputC.dispatchEvent(new Event("change"));
  await waitFor(() => mapNames().length === 1); await sleep(300);
  const mapOther = (await all("maps")).find((m) => m.gameId === idC);
  const mapsOfA = (await all("maps")).filter((m) => m.gameId === idA).map((m) => m.id);
  await new Promise((r) => { const tx = conn.transaction("markers", "readwrite"); const s = tx.objectStore("markers"); mapsOfA.forEach((id, i) => s.put({ id: "acc-a" + i, mapId: id, x: 0.1, y: 0.1 })); s.put({ id: "acc-c", mapId: mapOther.id, x: 0.5, y: 0.5 }); tx.oncomplete = r; });
  await goHome();
  gameCard("FF Legend").querySelector(".game-card__action--remove").click();
  await waitFor(() => !!dlg()); await sleep(150);
  dbtn("Borrar").click(); await waitFor(() => !gameCard("FF Legend")); await sleep(400);
  const left = {
    game: (await all("games")).some((g) => g.id === idA),
    maps: (await all("maps")).filter((m) => m.gameId === idA).length,
    images: (await all("images")).filter((i) => mapsOfA.includes(i.mapId)).length,
    markers: (await all("markers")).filter((m) => mapsOfA.includes(m.mapId)).length,
  };
  const otherKept = (await all("maps")).some((m) => m.id === mapOther.id) && (await all("images")).some((i) => i.mapId === mapOther.id) && (await all("markers")).some((m) => m.id === "acc-c");
  ok("30_delete_cascade", !left.game && !left.maps && !left.images && !left.markers && otherKept && !gameCard("FF Legend"), { left, otherKept });

  // 31. #/game/no-existe
  clearNotices();
  window.location.hash = "#/game/no-existe";
  await waitFor(() => window.location.hash === "#/" && !!$(".games")); await sleep(400);
  ok("31_missing_game", window.location.hash === "#/" && notices().some((n) => n.includes("Ese juego no existe")), notices());

  // Dejar un juego con un mapa para F5 / persistencia
  localStorage.setItem("acc-game", idC);
  return { criteria: C, gameId: idC };
})()
