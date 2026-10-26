/**
 * Dependency-free Chromium DevTools Protocol screenshot capture.
 * CI-only: uses the Google Chrome binary already installed on Ubuntu.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../tests/browser/helpers/server.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const out = process.env.VISUAL_REVIEW_DIR || join(tmpdir(), 'architect-lab-native-review');
const profile = await mkdtemp(join(tmpdir(), 'architect-lab-cdp-'));
const server = await startServer();
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--disable-background-networking', '--no-first-run',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let errorOutput = '';
chrome.stderr.on('data', chunk => { errorOutput = (errorOutput + chunk).slice(-4000); });
await mkdir(out, { recursive: true });
let ws;
let count = 0;
const tasks = new Map();
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++count;
  tasks.set(id, { resolve, reject });
  const message = { id, method, params };
  if (sessionId) message.sessionId = sessionId;
  ws.send(JSON.stringify(message));
});
const evaluate = async (session, expression) => {
  const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (data.exceptionDetails) throw new Error(data.exceptionDetails.text);
  return data.result.value;
};
const shots = [];
const specs = [
  [1280, 900, 'dark'], [1440, 900, 'dark'], [1440, 900, 'light'],
  [1920, 1080, 'dark'], [1920, 1080, 'light'], [375, 812, 'dark'],
];
try {
  let port;
  for (let i = 0; i < 75; i++) {
    try {
      const raw = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
      port = Number(raw.split('\n')[0]);
      if (port) break;
    } catch {}
    if (chrome.exitCode !== null) throw new Error('Chrome exited early: ' + errorOutput);
    await sleep(200);
  }
  if (!port) throw new Error('Chrome DevTools did not open: ' + errorOutput);
  const info = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json();
  ws = new WebSocket(info.webSocketDebuggerUrl);
  ws.addEventListener('message', event => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    const task = tasks.get(data.id);
    if (!task) return;
    tasks.delete(data.id);
    if (data.error) task.reject(new Error(data.error.message));
    else task.resolve(data.result);
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);

  for (const [width, height, theme] of specs) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ] }, sessionId);
    await send('Page.navigate', { url: server.baseUrl + '/' }, sessionId);
    await sleep(700);
    const expr = '(async()=>{await document.fonts.ready;document.documentElement.setAttribute("data-theme",'+JSON.stringify(theme)+');document.documentElement.classList.remove("js");for(const el of document.querySelectorAll("[data-reveal]"))el.classList.add("is-visible");const rect=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}};return{docHeight:document.documentElement.scrollHeight,docWidth:document.documentElement.scrollWidth,hero:rect(".hero"),experience:rect("#experience"),employment:rect(".record-main"),skills:rect(".record-aside")}})()';
    const metrics = await evaluate(sessionId, expr);
    for (const section of ['hero', 'experience']) {
      const r = metrics[section];
      if (!r || r.height < 40) throw new Error('Missing section: ' + section);
      const top = section === 'hero' ? 0 : Math.max(0, r.y - 28);
      const bottom = Math.min(metrics.docHeight, r.y + r.height + 30);
      const snap = await send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: true,
        clip: { x: 0, y: top, width, height: bottom - top, scale: 1 },
      }, sessionId);
      const name = section + '-' + width + '-' + theme + '.png';
      await writeFile(join(out, name), Buffer.from(snap.data, 'base64'));
      shots.push({ name, width, theme, section, metrics });
      console.log('Captured ' + name);
    }
    if (metrics.docWidth > width + 1) throw new Error('Horizontal overflow at ' + width + 'px: ' + metrics.docWidth);
  }
  await writeFile(join(out, 'layout-report.json'), JSON.stringify({ sha: process.env.GITHUB_SHA || null, shots }, null, 2) + '\n');
  console.log('Captured ' + shots.length + ' screenshots.');
} finally {
  if (ws) ws.close();
  chrome.kill('SIGTERM');
  await server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
