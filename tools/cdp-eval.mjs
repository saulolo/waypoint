// Verifica Waypoint en Chrome headless vía DevTools Protocol (CDP).
//
// Uso:
//   node tools/cdp-eval.mjs [destino] [expresión | archivo.js]
//
//   destino     URL completa, o un hash ("#/", "#/map/<id>") que se aplica a index.html.
//               Opcional: por defecto index.html.
//   expresión   JS evaluado en la página tras cargar; si devuelve una promesa, se espera.
//               Si el argumento es la ruta de un archivo existente, se evalúa su contenido.
//
// Variables de entorno (opcionales):
//   WP_PROFILE  carpeta de perfil fija: reutilizarla entre ejecuciones prueba la persistencia
//               al cerrar y reabrir el navegador. Sin ella se usa un perfil temporal limpio.
//   SHOT        ruta .png donde guardar una captura de 1280×800 al terminar.
//   PRELOAD     JS que se ejecuta antes que los scripts de la página
//               (p. ej. "Object.defineProperty(window,'indexedDB',{value:undefined})").
//   CHROME      ruta del ejecutable de Chrome o Edge.
//
// Desde la página, el script evaluado puede generar entrada real (no sintética):
//   window.cdpKey("Escape" | "Enter")                          pulsación de teclado
//   window.cdpInput(JSON.stringify([[método, params], ...]))   eventos CDP en secuencia,
//                                                              p. ej. Input.dispatchMouseEvent
//                                                              para rueda y arrastre
//
// Salida: consola de la página, peticiones externas (debería estar vacío) y el resultado.
// Código de salida 1 si la expresión lanza una excepción.
//
// Por qué existe: Playwright MCP bloquea file:// y `chrome --dump-dom` congela IndexedDB.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexUrl = pathToFileURL(join(projectRoot, "index.html")).href;

// El destino es opcional: si el primer argumento no parece una URL ni un hash, es la expresión.
// (PowerShell 5.1 descarta los argumentos vacíos "", así que no se puede usar "" como hueco.)
const args = process.argv.slice(2);
const isTarget = (a) => /^(#|[a-z]+:\/\/|about:)/i.test(a || "");
const target = isTarget(args[0]) ? args.shift() : "";
const exprArg = args[0] || "document.title";
const url = target === "" ? indexUrl : target.startsWith("#") ? indexUrl + target : target;
const expression = existsSync(exprArg) ? readFileSync(exprArg, "utf8").replace(/^﻿/, "") : exprArg;

const chrome =
  process.env.CHROME ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].find(existsSync);
if (!chrome) {
  console.error("No se encontró Chrome/Edge. Define la variable CHROME.");
  process.exit(2);
}

const profile = process.env.WP_PROFILE || mkdtempSync(join(tmpdir(), "wp-cdp-"));
const port = 9300 + Math.floor(Math.random() * 500);
const viewport = { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false };

const proc = spawn(
  chrome,
  ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50 && !targets; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    await sleep(200);
  }
}
if (!targets) {
  console.error("Chrome no abrió el puerto de depuración.");
  proc.kill();
  process.exit(2);
}

const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));

let nextId = 0;
const pending = new Map();
const logs = [];
const requests = [];

const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++nextId;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });

const KEY_CODES = { Escape: 27, Enter: 13 };

function pressKey(key) {
  const base = { key, code: key, windowsVirtualKeyCode: KEY_CODES[key], nativeVirtualKeyCode: KEY_CODES[key] };
  // Enter necesita `text` para que el navegador envíe el formulario.
  const down = key === "Enter" ? { type: "keyDown", text: "\r", unmodifiedText: "\r", ...base } : { type: "rawKeyDown", ...base };
  return send("Input.dispatchKeyEvent", down).then(() => send("Input.dispatchKeyEvent", { type: "keyUp", ...base }));
}

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  switch (msg.method) {
    case "Runtime.consoleAPICalled":
      logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description).join(" "));
      break;
    case "Runtime.exceptionThrown":
      logs.push("[exception] " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      break;
    case "Log.entryAdded":
      logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
      break;
    case "Network.requestWillBeSent":
      requests.push(msg.params.request.url);
      break;
    case "Runtime.bindingCalled":
      if (msg.params.name === "cdpKey") {
        pressKey(msg.params.payload);
      } else if (msg.params.name === "cdpInput") {
        JSON.parse(msg.params.payload).reduce((p, [m, prm]) => p.then(() => send(m, prm)), Promise.resolve());
      }
      break;
  }
});

await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Page.enable");
await send("Runtime.addBinding", { name: "cdpKey" });
await send("Runtime.addBinding", { name: "cdpInput" });
await send("Emulation.setDeviceMetricsOverride", viewport);
if (process.env.PRELOAD) {
  await send("Page.addScriptToEvaluateOnNewDocument", { source: process.env.PRELOAD });
}

await send("Page.navigate", { url });
await sleep(1500);
const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
await sleep(300);

if (process.env.SHOT) {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(process.env.SHOT, Buffer.from(shot.result.data, "base64"));
}

const external = requests.filter((u) => !/^(file|data|blob):/.test(u));
const exception = res.result?.exceptionDetails;

console.log("=== CONSOLE");
logs.forEach((l) => console.log(l));
console.log("=== EXTERNAL REQUESTS");
external.forEach((u) => console.log(u));
console.log("=== RESULT");
console.log(
  JSON.stringify(
    exception ? { exception: exception.exception?.description || exception.text } : res.result?.result?.value ?? null,
    null,
    2
  )
);

ws.close();
proc.kill();
process.exit(exception ? 1 : 0);
