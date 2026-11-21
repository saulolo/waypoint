// Prueba de aceptación de SPEC 02 (tema visual arcade retro).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-02.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } } }, numerados como en la spec.
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval.
//   22  tools/acceptance/spec-01.js pasa con un WP_PROFILE vacío.
//   23  este script pasa con un WP_PROFILE vacío.
//   24  sin colores literales fuera de css/tokens.css → grep (ver el final de este comentario).
//   25  grep "SPEC 02" en README.md, specs/01-biblioteca-de-mapas.md y js/ sin menciones a marcadores.
//
//   grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(" css/*.css js -r | grep -v "^css/tokens.css"
//   → solo los fill de js/ui/silhouettes.js y el SVG del ruido en css/effects.css.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const C = {};
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const css = (el, pseudo) => getComputedStyle(el, pseudo || null);
  const cards = () => $$(".map-card");
  const clearNotices = () => $$(".notice").forEach((n) => n.remove());
  const input = async (ev, wait = 300) => { await window.cdpInput(JSON.stringify(ev)); await sleep(wait); };
  const mouseTo = (x, y) => input([["Input.dispatchMouseEvent", { type: "mouseMoved", x, y }]], 500);
  const reducedMotion = (on) => input([["Emulation.setEmulatedMedia", { features: on ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [] }]], 200);
  const isPixel = (el) => css(el).fontFamily.includes("Press Start 2P");
  const hasCyan = (s) => s.includes("0, 245, 255");

  const make = async (name, hue) => {
    const c = new OffscreenCanvas(800, 500); const g = c.getContext("2d");
    g.fillStyle = `hsl(${hue},45%,35%)`; g.fillRect(0, 0, 800, 500);
    return new File([await c.convertToBlob({ type: "image/png" })], name, { type: "image/png" });
  };
  const choose = (files) => {
    const el = $('.library input[type="file"]'); const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f)); el.files = dt.files; el.dispatchEvent(new Event("change"));
  };

  await document.fonts.ready;
  await waitFor(() => !!$(".library-hero__subtitle") && $(".library-hero__subtitle").textContent.length > 1);
  await sleep(300);

  // 2. Fuentes cargadas y servidas desde vendor/fonts/
  // Con file:// no se pueden leer los cssRules (SecurityError): se comprueba que css/fonts.css está
  // enlazado y que los archivos de vendor/fonts/ cargan. Que no haya red lo confirma cdp-eval.
  await Promise.all(['12px "Press Start 2P"', '12px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
  const vendorFonts = [
    "vendor/fonts/press-start-2p/PressStart2P-Regular.woff2",
    "vendor/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2",
    "vendor/fonts/jetbrains-mono/JetBrainsMono-Bold.woff2",
  ];
  const vendorStatus = [];
  for (const f of vendorFonts) {
    try { const ff = new FontFace("wp-probe", `url(${f})`); await ff.load(); vendorStatus.push(ff.status); }
    catch (e) { vendorStatus.push("error"); }
  }
  const fontsCss = [...document.styleSheets].some((s) => (s.href || "").endsWith("css/fonts.css"));
  ok(
    "02_fonts_from_vendor",
    document.fonts.check('12px "Press Start 2P"') && document.fonts.check('12px "JetBrains Mono"') &&
      fontsCss && vendorStatus.every((s) => s === "loaded"),
    { fontsCss, vendorStatus }
  );

  // 3. Fondo del body
  ok("03_body_background", css(document.body).backgroundColor === "rgb(10, 10, 15)", css(document.body).backgroundColor);

  // 4. Capas de fondo fijas y sin eventos de puntero
  const layers = [".app-bg", ".app-noise"].map((s) => $(s) && { s, pos: css($(s)).position, pe: css($(s)).pointerEvents });
  ok("04_bg_layers", layers.every((l) => l && l.pos === "fixed" && l.pe === "none"), layers);

  // 5. Grid animado
  const grid = css($(".app-bg"), "::before");
  ok("05_grid_animation", grid.animationName === "gridscroll" && grid.animationPlayState === "running", grid.animationName);

  // 6. Cabecera: marca diamante + WAYPOINT en pixel con neón
  const brand = $(".app-header__name");
  ok(
    "06_header_brand",
    !!$(".app-header__mark") && brand.innerText === "WAYPOINT" && isPixel(brand) && css(brand).textShadow !== "none",
    { text: brand.innerText, shadow: css(brand).textShadow }
  );

  // 9. Inicio sin juegos: subtítulo del hero
  ok("09_hero_empty_subtitle", $(".library-hero__subtitle").innerText === "CREA UN JUEGO PARA EMPEZAR _", $(".library-hero__subtitle").innerText);

  // 10. 8 siluetas, aria-hidden y sin eventos de puntero
  const sil = $(".library-hero .silhouettes");
  ok(
    "10_silhouettes",
    sil && sil.querySelectorAll("svg").length === 8 && sil.getAttribute("aria-hidden") === "true" && css(sil).pointerEvents === "none",
    sil && sil.querySelectorAll("svg").length
  );

  // 20. Movimiento reducido: grid, siluetas, flicker y cursor sin animación
  await reducedMotion(true);
  const rmAnims = {
    grid: css($(".app-bg"), "::before").animationName,
    silhouettes: [...sil.querySelectorAll("svg")].map((s) => css(s).animationName),
    flicker: css(brand).animationName,
    cursor: css($(".blink-cursor")).animationName,
  };
  await reducedMotion(false);
  ok(
    "20_reduced_motion_animations",
    rmAnims.grid === "none" && rmAnims.silhouettes.every((a) => a === "none") && rmAnims.flicker === "none" && rmAnims.cursor === "none",
    rmAnims
  );

  // 11. Soltar una imagen sobre una silueta (inicio): no crea mapas, no navega y avisa
  const s3 = sil.querySelector(".s3").getBoundingClientRect();
  const sx = s3.left + s3.width / 2, sy = s3.top + s3.height / 2;
  const target = document.elementFromPoint(sx, sy);
  const dt = new DataTransfer(); dt.items.add(await make("Silueta.png", 10));
  let prevented = false;
  ["dragenter", "dragover", "drop"].forEach((t) => {
    const ev = new DragEvent(t, { bubbles: true, cancelable: true, clientX: sx, clientY: sy, dataTransfer: dt });
    target.dispatchEvent(ev);
    if (t === "drop") prevented = ev.defaultPrevented;
  });
  await sleep(300);
  const dropNotices = $$(".notice__message").map((n) => n.textContent);
  ok(
    "11_drop_on_silhouette",
    !target.closest(".silhouettes") && prevented && ["", "#/"].includes(window.location.hash) && cards().length === 0 &&
      dropNotices.some((n) => n.includes("Entra en un juego")),
    { target: target.className, prevented, dropNotices }
  );
  clearNotices();

  // Desde SPEC 03 los mapas viven en un juego: se crea uno por servicio.
  const game = await Waypoint.services.gameService.create("Juego de prueba", null);
  const gameHash = "#/game/" + game.id;
  window.location.hash = gameHash;
  await waitFor(() => !!$(".game-head"));
  window.location.hash = "#/";
  await waitFor(() => $(".library-hero__subtitle")?.innerText === "MI MAPA MI 100% _");

  // 8. Con juegos: título y subtítulo del hero
  ok(
    "08_hero_with_games",
    $(".library-hero__title").innerText === "WAYPOINT" && $(".library-hero__subtitle").innerText === "MI MAPA MI 100% _",
    [$(".library-hero__title").innerText, $(".library-hero__subtitle").innerText]
  );

  // Hasta 12 mapas, dentro del juego
  window.location.hash = gameHash;
  await waitFor(() => !!$('.library input[type="file"]'));
  const more = [];
  for (let i = 1; i <= 12; i++) more.push(await make("Mapa " + i + ".png", i * 30));
  choose(more);
  await waitFor(() => cards().length === 12, 15000); await sleep(400);
  clearNotices();

  // 7. Cabecera visible tras scroll con 12 mapas (ventana baja para que haya scroll de verdad)
  await input([["Emulation.setDeviceMetricsOverride", { width: 1280, height: 500, deviceScaleFactor: 1, mobile: false }]]);
  window.scrollTo(0, document.documentElement.scrollHeight); await sleep(300);
  const scrolled = window.scrollY;
  const headerTop = $(".app-header").getBoundingClientRect().top;
  const headerHit = !!document.elementFromPoint(200, 20)?.closest(".app-header");
  window.scrollTo(0, 0);
  // clearDeviceMetricsOverride deja una ventana más baja en headless: se fija 1280×800 explícito.
  await input([["Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }]]);
  ok("07_header_sticky", cards().length === 12 && scrolled > 200 && headerTop === 0 && headerHit, { cards: cards().length, scrolled, headerTop });

  // 12. Acentos rotativos
  const accents = cards().slice(0, 4).map((c) => css(c).getPropertyValue("--card-accent").trim().toLowerCase());
  ok("12_card_accents", JSON.stringify(accents) === JSON.stringify(["#00f5ff", "#ff006e", "#f5ff00", "#00ff88"]), accents);

  // 13. Hover: transform y glow cian
  const c0 = cards()[0];
  c0.scrollIntoView({ block: "center" }); await sleep(200);
  const r0 = c0.getBoundingClientRect();
  await mouseTo(r0.left + 40, r0.top + 40);
  const hover = { transform: css(c0).transform, shadow: css(c0).boxShadow };
  ok("13_card_hover", hover.transform !== "none" && hasCyan(hover.shadow), hover);

  // 21. Movimiento reducido: hover sin transform
  await reducedMotion(true);
  await mouseTo(r0.left + 60, r0.top + 60);
  const rmHovered = c0.matches(":hover");
  const rmTransform = css(c0).transform;
  await reducedMotion(false);
  await mouseTo(5, 5);
  ok("21_reduced_motion_hover", rmHovered && rmTransform === "none", { hovered: rmHovered, transform: rmTransform });

  // 14a. Nombre de la tarjeta en pixel y mayúsculas
  const cardName = c0.querySelector(".map-card__name");
  const cardNameOk = isPixel(cardName) && css(cardName).textTransform === "uppercase";

  // 16a. .btn de la biblioteca con clip-path polygon
  const btnClip = (scope) => $$(scope + " .btn").map((b) => ({ t: b.textContent, clip: css(b).clipPath.startsWith("polygon(") }));
  const btns = btnClip(".library");

  // 15. Input de renombrar en JetBrains Mono (+ 16b botones del diálogo)
  c0.querySelector(".map-card__action--rename").click();
  await waitFor(() => !!$("dialog[open] input"));
  const renameFont = css($("dialog[open] input")).fontFamily;
  btns.push(...btnClip("dialog[open]"));
  window.cdpKey("Escape"); await sleep(400);
  ok("15_rename_input_font", renameFont.includes("JetBrains Mono") && !renameFont.includes("Press Start"), renameFont);

  // 17. Avisos con su neón
  clearNotices();
  const N = Waypoint.ui.notice;
  ["info", "success", "warning", "error"].forEach((type) => N.show("Aviso " + type, { type, duration: 0 }));
  await sleep(300);
  const noticeColors = Object.fromEntries($$(".notice").map((n) => [n.className.match(/notice--(\w+)/)[1], css(n).borderLeftColor]));
  clearNotices();
  ok(
    "17_notice_colors",
    noticeColors.info === "rgb(0, 245, 255)" && noticeColors.success === "rgb(0, 255, 136)" &&
      noticeColors.warning === "rgb(245, 255, 0)" && noticeColors.error === "rgb(255, 0, 110)",
    noticeColors
  );

  // Visor
  window.location.hash = c0.querySelector(".map-card__link").getAttribute("href");
  await waitFor(() => !!$(".leaflet-image-layer")); await sleep(600);

  // 14b. Nombre en el panel del visor
  const viewerTitle = $(".viewer__title");
  ok(
    "14_map_name_pixel",
    cardNameOk && isPixel(viewerTitle) && css(viewerTitle).textTransform === "uppercase",
    { card: css(cardName).fontFamily, viewer: css(viewerTitle).fontFamily }
  );

  // 16. Todo .btn con clip-path polygon (biblioteca, diálogo y visor)
  btns.push(...btnClip(".viewer"));
  ok("16_btn_clip_path", btns.length >= 4 && btns.every((b) => b.clip), btns);

  // 18. Centro del escenario: Leaflet, no una capa de efectos
  const st = $(".viewer__stage").getBoundingClientRect();
  const hit = document.elementFromPoint(st.left + st.width / 2, st.top + st.height / 2);
  ok("18_viewer_clean_stage", !!hit.closest(".leaflet-container") && !hit.closest(".app-bg, .app-noise"), String(hit.className.baseVal ?? hit.className));

  // 19. Zoom sin fondo blanco (en reposo, hover y foco tras clic)
  const zin = $(".leaflet-control-zoom-in"), zout = $(".leaflet-control-zoom-out");
  const zr = zin.getBoundingClientRect(); const zx = zr.left + zr.width / 2, zy = zr.top + zr.height / 2;
  const bgs = [css(zin).backgroundColor, css(zout).backgroundColor];
  await input([
    ["Input.dispatchMouseEvent", { type: "mouseMoved", x: zx, y: zy }],
    ["Input.dispatchMouseEvent", { type: "mousePressed", x: zx, y: zy, button: "left", clickCount: 1 }],
    ["Input.dispatchMouseEvent", { type: "mouseReleased", x: zx, y: zy, button: "left", clickCount: 1 }],
  ], 500);
  bgs.push(css(zin).backgroundColor);
  const white = (c) => /rgb\((2[3-5]\d), (2[3-5]\d), (2[3-5]\d)\)/.test(c);
  ok("19_zoom_not_white", bgs.every((c) => !white(c)), bgs);

  $(".viewer__back").click();
  await waitFor(() => cards().length === 12);

  return { criteria: C };
})()
