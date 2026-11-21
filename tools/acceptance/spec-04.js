// Prueba de aceptación de SPEC 04 (zoom fluido y alejamiento ampliado en el visor).
//
// Uso (necesita un perfil vacío: borra la carpeta antes de cada ejecución):
//   $env:WP_PROFILE = "$env:TEMP\wp-acc"; Remove-Item -Recurse -Force $env:WP_PROFILE -ErrorAction SilentlyContinue
//   node tools/cdp-eval.mjs tools/acceptance/spec-04.js
//
// Devuelve { criteria: { "<nº>_<nombre>": { pass, detail } } }, numerados como en la spec.
// Fuera de este script:
//   01  sin errores en consola ni peticiones externas → secciones CONSOLE y EXTERNAL REQUESTS de cdp-eval.
//   19  grep "indexedDB" js/ui (sin usos).
//   20  grep de colores literales fuera de css/tokens.css (ver spec-02.js).
//   21  spec-01.js, spec-02.js, spec-03.js y este script pasan con un WP_PROFILE vacío.
//   22  grep "SPEC 04" en README.md, specs/01-*, specs/02-*, specs/03-* y js/ sin menciones a marcadores.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50); } return false; };
  const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
  const C = {};
  const ok = (n, pass, detail) => { C[n] = { pass: !!pass, detail }; };
  const $ = (s) => document.querySelector(s);
  const input = async (ev, wait = 0) => { await window.cdpInput(JSON.stringify(ev)); if (wait) await sleep(wait); };
  const viewport = (w, h) => input([["Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }]], 600);
  const reducedMotion = (on) => input([["Emulation.setEmulatedMedia", { features: on ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [] }]], 200);

  const W = 3000, H = 2000;
  const make = async () => {
    const c = new OffscreenCanvas(W, H); const g = c.getContext("2d");
    g.fillStyle = "hsl(200,40%,30%)"; g.fillRect(0, 0, W, H);
    return new File([await c.convertToBlob({ type: "image/jpeg", quality: 0.9 })], "Zoom.jpg", { type: "image/jpeg" });
  };
  const game = await Waypoint.services.gameService.create("Juego zoom", null);
  const report = await Waypoint.services.mapService.importFiles(game.id, [await make()]);
  const mapId = report.imported[0].id;
  const openViewer = async () => { window.location.hash = "#/map/" + mapId; await waitFor(() => !!$(".leaflet-image-layer")); await sleep(400); };

  // Medidas: el zoom se deduce del ancho de la imagen en pantalla (escala = 2^zoom).
  const ir = () => $(".leaflet-image-layer").getBoundingClientRect();
  const stage = () => $(".viewer__stage").getBoundingClientRect();
  const zoomOf = () => Math.log2(ir().width / W);
  const fitWidth = () => { const s = stage(); return Math.min(s.width / W, s.height / H) * W; };
  const imgPt = (x, y) => { const r = ir(); return [((x - r.left) / r.width) * W, ((y - r.top) / r.height) * H]; };
  const inside = (r, s) => r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1;
  // px de imagen dentro de la vista, por eje
  const visible = (r, s) => [Math.min(r.right, s.right) - Math.max(r.left, s.left), Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top)];
  const MIN_VISIBLE = 100;
  const center = () => { const s = stage(); return [s.left + s.width / 2, s.top + s.height / 2]; };
  const wheelAt = (x, y, dy, modifiers = 0) => ["Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy, modifiers }];
  // Arrastra (dx, dy) px en tramos desde el centro y espera `wait` ms al final.
  //   - Chrome descarta los eventos de ratón fuera de la ventana: un solo tramo de 4000 px no llegaría entero.
  //   - Cada tramo se queda quieto 80 ms antes de soltar: Leaflet solo aplica inercia con movimiento en los
  //     últimos 50 ms, y la velocidad de los eventos sintéticos daría una inercia de varios segundos.
  const dragBy = async (dx, dy, wait) => {
    const [cx, cy] = center(); const s = stage();
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx) / (s.width / 2 - 40), Math.abs(dy) / (s.height / 2 - 40))));
    const sx = dx / n, sy = dy / n;
    for (let k = 0; k < n; k++) {
      await input([
        ["Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy }],
        ["Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 }],
        ...Array.from({ length: 5 }, (_, i) => ["Input.dispatchMouseEvent", { type: "mouseMoved", x: cx + (sx * (i + 1)) / 5, y: cy + (sy * (i + 1)) / 5, button: "left", buttons: 1 }]),
      ], 80);
      await input([["Input.dispatchMouseEvent", { type: "mouseReleased", x: cx + sx, y: cy + sy, button: "left", clickCount: 1 }]]);
    }
    await sleep(wait);
  };
  const r3 = (v) => +v.toFixed(3);
  const STEP = 1 / 3; // un clic de rueda (deltaY 100 px) = 1/3 de nivel

  // Marca de tiempo del último evento wheel recibido por la página.
  let lastWheel = 0, wheelCount = 0;
  window.addEventListener("wheel", () => { lastWheel = performance.now(); wheelCount++; }, { capture: true, passive: true });

  // Envía un evento de rueda y muestrea el zoom y el punto bajo el cursor en cada fotograma hasta `ms` después.
  const wheelAndSample = async (x, y, dy, ms = 700) => {
    const n0 = wheelCount; const z0 = zoomOf(); const p0 = imgPt(x, y);
    await input([wheelAt(x, y, dy)]);
    await waitFor(() => wheelCount > n0, 2000);
    const zooms = []; let drift = 0;
    while (performance.now() - lastWheel < ms) {
      await nextFrame();
      zooms.push(zoomOf());
      const p = imgPt(x, y);
      drift = Math.max(drift, (Math.hypot(p[0] - p0[0], p[1] - p0[1]) * ir().width) / W);
    }
    return { z0, zooms, drift };
  };

  await viewport(1280, 800);
  await openViewer();

  // 2. Vista inicial: ajuste, centrada
  {
    const r = ir(), s = stage();
    const touches = Math.abs(r.width - s.width) < 2 || Math.abs(r.height - s.height) < 2;
    const centered = Math.abs(r.left + r.width / 2 - (s.left + s.width / 2)) < 2 && Math.abs(r.top + r.height / 2 - (s.top + s.height / 2)) < 2;
    ok("02_initial_fit_centered", inside(r, s) && touches && centered, { img: [Math.round(r.width), Math.round(r.height)], stage: [s.width, s.height] });
  }
  const fitZoom = zoomOf();

  // 3/4/5. Un clic de rueda: +1/3 de nivel, con valores intermedios, quieto a los 400 ms
  {
    const [cx, cy] = center();
    const { z0, zooms } = await wheelAndSample(cx, cy, -100, 400);
    const at400 = zoomOf(); await sleep(300); const later = zoomOf();
    const end = zooms[zooms.length - 1];
    const distinct = [...new Set(zooms.map((z) => z.toFixed(4)))].filter((z) => z !== z0.toFixed(4) && z !== end.toFixed(4));
    ok("03_wheel_one_third_level", Math.abs(later - z0 - STEP) <= 0.02, { delta: r3(later - z0) });
    ok("04_intermediate_values", distinct.length >= 3, { intermediate: distinct.length });
    ok("05_settled_at_400ms", Math.abs(later - at400) < 1e-6, { at400: r3(at400), later: r3(later) });
  }

  // 6. Ancla: el punto bajo el cursor no se mueve (imagen ya mayor que la vista: sin límites cerca)
  {
    const [cx, cy] = center();
    const { drift } = await wheelAndSample(cx + 120, cy + 80, -100);
    ok("06_anchor_under_cursor", drift <= 2, { driftPx: r3(drift) });
  }

  // 7. Alejar del todo: 1/4 del ancho de ajuste
  {
    const [cx, cy] = center();
    for (let i = 0; i < 12; i++) { await input([wheelAt(cx, cy, 300)]); await sleep(60); }
    await sleep(700);
    const ratio = ir().width / fitWidth();
    ok("07_min_quarter_of_fit", Math.abs(ratio - 0.25) <= 0.0025, { ratio: +ratio.toFixed(4) });
  }

  // 8. Acercar del todo: 4× el tamaño real
  {
    const [cx, cy] = center();
    for (let i = 0; i < 12; i++) { await input([wheelAt(cx, cy, -300)]); await sleep(60); }
    await sleep(700);
    const scale = ir().width / W;
    ok("08_max_4x", Math.abs(scale - 4) <= 0.04, { scale: +scale.toFixed(4) });
  }

  // Volver al ajuste para los siguientes criterios.
  window.location.hash = "#/game/" + game.id; await waitFor(() => !!$(".map-card")); await openViewer();

  // 9. Pellizco (ctrlKey): zoom del mapa, no de la página
  {
    const [cx, cy] = center(); const z0 = zoomOf();
    await input([wheelAt(cx, cy, -50, 2)], 700);
    ok("09_ctrl_wheel_zooms_map", zoomOf() - z0 > 0.1 && window.visualViewport.scale === 1, { delta: r3(zoomOf() - z0), pageScale: window.visualViewport.scale });
  }

  // 10. deltaMode 1 (líneas) con deltaY −3: zoom hacia dentro
  {
    const [cx, cy] = center(); const z0 = zoomOf();
    $(".leaflet-container").dispatchEvent(new WheelEvent("wheel", { deltaY: -3, deltaMode: 1, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
    await sleep(700);
    ok("10_line_delta_mode_zooms_in", zoomOf() > z0 + 0.1, { delta: r3(zoomOf() - z0) });
  }

  // 11. prefers-reduced-motion: el destino en el primer fotograma, sin intermedios
  {
    await reducedMotion(true);
    const [cx, cy] = center(); const z0 = zoomOf();
    $(".leaflet-container").dispatchEvent(new WheelEvent("wheel", { deltaY: 100, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
    const frames = [];
    for (let i = 0; i < 10; i++) { await nextFrame(); frames.push(zoomOf()); }
    const distinct = [...new Set(frames.map((z) => z.toFixed(4)))];
    ok("11_reduced_motion_jumps", distinct.length === 1 && Math.abs(frames[0] - z0 + STEP) <= 0.02, { first: r3(frames[0] - z0), distinct: distinct.length });
    await reducedMotion(false);
  }

  // 12. Botones + / −: 1 nivel; ninguno baja del mínimo
  {
    window.location.hash = "#/game/" + game.id; await waitFor(() => !!$(".map-card")); await openViewer();
    const z0 = zoomOf();
    $(".leaflet-control-zoom-in").click(); await sleep(500); const zin = zoomOf();
    $(".leaflet-control-zoom-out").click(); await sleep(500); const zout = zoomOf();
    for (let i = 0; i < 5; i++) { $(".leaflet-control-zoom-out").click(); await sleep(400); }
    const ratio = ir().width / fitWidth();
    ok("12_buttons_one_level", Math.abs(zin - z0 - 1) <= 0.02 && Math.abs(zout - z0) <= 0.02 && Math.abs(ratio - 0.25) <= 0.0025, { plus: r3(zin - z0), minus: r3(zout - zin), minRatio: +ratio.toFixed(4) });
  }

  // 14. Al mínimo: arrastrar saca la imagen por ese borde y deja 100 px dentro en cada eje desplazado
  {
    const results = [];
    for (const [dx, dy] of [[4000, 0], [-4000, 0], [0, 4000], [0, -4000], [4000, 4000], [-4000, -4000], [4000, -4000], [-4000, 4000]]) {
      await dragBy(dx, dy, 400);
      const v = visible(ir(), stage());
      const pass = (dx === 0 || Math.abs(v[0] - MIN_VISIBLE) <= 1) && (dy === 0 || Math.abs(v[1] - MIN_VISIBLE) <= 1);
      results.push({ d: [dx, dy], visible: v.map(Math.round), pass });
    }
    ok("14_min_drag_goes_out_keeps_100px", results.every((r) => r.pass), results.filter((r) => !r.pass));
  }

  // 16. Ventana más pequeña con la imagen al mínimo
  {
    await viewport(700, 500);
    const ratio = ir().width / fitWidth();
    const v = visible(ir(), stage());
    ok("16_resize_keeps_min_and_100px", ratio >= 0.25 - 0.0025 && v.every((x) => x >= MIN_VISIBLE - 1), { ratio: +ratio.toFixed(4), visible: v.map(Math.round) });
    await viewport(1280, 800);
  }

  // 15. Acercado: arrastrar hasta el tope (10000 px) hacia cada esquina deja 100 px de imagen dentro en cada eje
  {
    for (let i = 0; i < 4; i++) { $(".leaflet-control-zoom-in").click(); await sleep(400); }
    const results = [];
    for (const [dx, dy] of [[10000, 10000], [-10000, -10000], [10000, -10000], [-10000, 10000]]) {
      await dragBy(dx, dy, 400);
      results.push(visible(ir(), stage()).map(Math.round));
    }
    ok("15_zoomed_drag_keeps_100px", zoomOf() > fitZoom + 0.5 && results.every((v) => v.every((x) => Math.abs(x - MIN_VISIBLE) <= 1)), { results });
  }

  // 13. Doble clic: +1 nivel
  {
    window.location.hash = "#/game/" + game.id; await waitFor(() => !!$(".map-card")); await openViewer();
    const [cx, cy] = center(); const z0 = zoomOf();
    await input([
      ["Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy }],
      ["Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 }],
      ["Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", clickCount: 1 }],
      ["Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 2 }],
      ["Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", clickCount: 2 }],
    ], 800);
    ok("13_double_click_one_level", Math.abs(zoomOf() - z0 - 1) <= 0.02, { delta: r3(zoomOf() - z0) });
  }

  // 17. Salir y volver a entrar varias veces: un evento = un solo paso
  {
    for (let i = 0; i < 3; i++) {
      window.location.hash = "#/game/" + game.id; await waitFor(() => !!$(".map-card")); await openViewer();
    }
    const [cx, cy] = center(); const z0 = zoomOf();
    await input([wheelAt(cx, cy, -100)], 700);
    ok("17_no_duplicate_listeners", Math.abs(zoomOf() - z0 - STEP) <= 0.02, { delta: r3(zoomOf() - z0) });
  }

  // 18. Fuera del visor la rueda hace scroll normal (ventana baja para que haya scroll)
  {
    await viewport(1280, 360);
    const scrolls = async (hash, ready) => {
      window.location.hash = hash; await waitFor(ready); await sleep(300);
      window.scrollTo(0, 0); await sleep(100);
      const scrollable = document.documentElement.scrollHeight > window.innerHeight;
      await input([wheelAt(640, 200, 200)], 600);
      return { scrollable, scrollY: Math.round(window.scrollY) };
    };
    const home = await scrolls("#/", () => !!$(".game-card"));
    const lib = await scrolls("#/game/" + game.id, () => !!$(".map-card"));
    ok("18_wheel_scrolls_outside_viewer", home.scrollable && home.scrollY > 0 && lib.scrollable && lib.scrollY > 0, { home, lib });
    await viewport(1280, 800);
  }

  return { criteria: C };
})()
