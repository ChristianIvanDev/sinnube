// Genera las capturas del README (modo claro y oscuro) con Chrome sin interfaz.
// Habla con Chrome por el protocolo DevTools usando el WebSocket nativo de Node: no instala nada.
// Los archivos de ejemplo se crean dentro de la página, así que no hace falta tener ninguno.
//
// Uso:
//   npm run dev                      # en otra terminal
//   npm run screenshots              # o: node scripts/screenshots.mjs http://localhost:5173/
//   CHROME="/ruta/a/chrome" npm run screenshots

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../docs/', import.meta.url));
const PORT = 9335;
mkdirSync(OUT, { recursive: true });

const chromePath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
  .filter(Boolean)
  .find((p) => existsSync(p));
if (!chromePath) throw new Error('No encontré Chrome. Indica la ruta con la variable CHROME.');

// Funciones que se ejecutan dentro de la página para preparar cada captura.
const HELPERS = `
  window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__drop = (files) => {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    const input = document.querySelector('input[type=file]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__photo = (w, h, hue, name) => new Promise((res) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'hsl(' + hue + ',60%,72%)');
    sky.addColorStop(1, 'hsl(' + (hue + 30) + ',55%,88%)');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'hsl(' + (hue + 180) + ',35%,32%)';
    g.beginPath(); g.moveTo(0, h * 0.75);
    for (let x = 0; x <= w; x += w / 12) g.lineTo(x, h * (0.5 + 0.2 * Math.sin(x / w * 7 + hue)));
    g.lineTo(w, h); g.lineTo(0, h); g.fill();
    g.fillStyle = 'hsl(45,95%,70%)'; g.beginPath(); g.arc(w * 0.75, h * 0.25, h * 0.08, 0, 7); g.fill();
    c.toBlob((b) => res(new File([b], name, { type: 'image/jpeg' })), 'image/jpeg', 0.95);
  });
`;

const SHOTS = [
  {
    name: 'comprimir',
    hash: '#/comprimir',
    prepare: `(async () => {
      __drop([await __photo(4032, 3024, 200, 'IMG_2041.jpg'), await __photo(3024, 4032, 20, 'IMG_2042.jpg'), await __photo(4032, 3024, 140, 'IMG_2043.jpg')]);
      await __wait(2500);
      document.querySelector('.thumb').click();
      await __wait(500);
    })()`,
  },
  {
    name: 'metadatos',
    hash: '#/metadatos',
    prepare: `(async () => {
      const { sampleTiff } = await import('/src/lib/testing/fixtures.ts');
      const jpg = new Uint8Array(await (await __photo(1600, 1200, 200, 'x.jpg')).arrayBuffer());
      const tiff = sampleTiff(true, 1);
      const seg = new Uint8Array(10 + tiff.length);
      seg.set([0xff, 0xe1, (tiff.length + 8) >> 8, (tiff.length + 8) & 255, 69, 120, 105, 102, 0, 0]);
      seg.set(tiff, 10);
      const out = new Uint8Array(jpg.length + seg.length);
      out.set(jpg.subarray(0, 2)); out.set(seg, 2); out.set(jpg.subarray(2), 2 + seg.length);
      __drop([new File([out], 'IMG_2041.jpg', { type: 'image/jpeg' })]);
      await __wait(800);
    })()`,
  },
  {
    name: 'dividir',
    hash: '#/dividir',
    prepare: `(async () => {
      const { PDFDocument, StandardFonts, rgb } = await import('/@id/pdf-lib');
      const doc = await PDFDocument.create();
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      for (let i = 1; i <= 8; i++) {
        const p = doc.addPage([595, 842]);
        p.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: rgb(0.06, 0.62, 0.43) });
        p.drawText(i === 1 ? 'Informe anual' : 'Capítulo ' + (i - 1), { x: 50, y: 780, size: 34, font: bold, color: rgb(1, 1, 1) });
        for (let l = 0; l < 22; l++) p.drawRectangle({ x: 50, y: 680 - l * 26, width: 400 + ((l * 37 + i * 11) % 95), height: 8, color: rgb(0.82, 0.82, 0.8) });
        p.drawText(String(i), { x: 290, y: 40, size: 14, font });
      }
      __drop([new File([await doc.save()], 'informe-anual.pdf', { type: 'application/pdf' })]);
      await __wait(900);
      const box = document.querySelector('.split input.mono');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, '1, 3-5, 8');
      box.dispatchEvent(new Event('input', { bubbles: true }));
      await __wait(1800);
    })()`,
  },
];

const profile = mkdtempSync(join(tmpdir(), 'sinnube-shots-'));
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* Chrome todavía está arrancando */
    }
    await sleep(200);
  }
  throw new Error('Chrome no respondió en el puerto de depuración.');
}

const ws = new WebSocket(await connect());
if (ws.readyState !== WebSocket.OPEN) await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
};

try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false });
  for (const scheme of ['claro', 'oscuro']) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme === 'oscuro' ? 'dark' : 'light' }] });
    for (const shot of SHOTS) {
      await send('Page.navigate', { url: 'about:blank' });
      await send('Page.navigate', { url: `${BASE}${shot.hash}` });
      await sleep(1500);
      await evaluate('document.fonts.ready');
      await evaluate(HELPERS);
      await evaluate(shot.prepare);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(OUT, `${shot.name}-${scheme}.png`), Buffer.from(data, 'base64'));
      console.log(`✓ docs/${shot.name}-${scheme}.png`);
    }
  }
} finally {
  await send('Browser.close').catch(() => {});
  ws.close();
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
