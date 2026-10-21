/**
 * Renders social-card.png (1200 × 630, the Open Graph / Twitter preview) from the
 * site's own design tokens, type stacks and the hero drawing, so the preview says
 * exactly what the page says. Playwright is used only as a renderer and is not a
 * site dependency; install it outside the repository as for the browser tests:
 *
 *   NODE_PATH=/path/to/node_modules node scripts/social-card.js
 *
 * The screenshot is written to social-card.png. The committed file is then
 * palette-reduced to 256 colours with Pillow, which roughly halves its size:
 *   python3 -c "from PIL import Image; Image.open('social-card.png').convert('RGB').quantize(256).save('social-card.png', optimize=True)"
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHeroSection } from './hero-section.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const section = (start, end) => css.slice(css.indexOf(start), css.indexOf(end, css.indexOf(start)) + end.length);

const FIELDS = ['Software engineering', 'Data science', 'Engineering research', 'Technical systems'];

export function renderCardHtml() {
  const tokens = section(':root{', '}');
  const drawing = section('.iso{width:100%', '@keyframes iso-flow{to{stroke-dashoffset:-18}}');
  return `<!DOCTYPE html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><title>Social card</title><style>
${tokens}
*{box-sizing:border-box}html,body{margin:0}
body{width:1200px;height:630px;overflow:hidden;background:var(--bg);color:var(--text);font-family:var(--font-body);position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:56px 56px;background-position:16px 16px}
.frame{position:absolute;inset:16px;border:1px solid var(--line)}
.mark{position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:16px}
.mark svg{width:54px;height:54px;color:var(--text)}
.mark .box{stroke:var(--line2)}.mark .pen{stroke:var(--accent)}
.mark-name{font-family:var(--font-display);font-size:27px;letter-spacing:-.01em;line-height:1}
.mark-sub{display:block;margin-top:7px;font-family:var(--font-mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}
h1{position:absolute;left:64px;top:158px;margin:0;font-family:var(--font-display);font-weight:400;font-size:88px;line-height:.98;letter-spacing:-.035em;color:var(--text)}
h1 .outline{color:transparent;-webkit-text-stroke:1.6px var(--text)}
h1 em{font-style:italic;color:var(--accent)}
h1 .period{font-style:normal;color:var(--text)}
p.lead{position:absolute;left:64px;top:364px;margin:0;width:430px;font-size:22px;line-height:1.5;color:var(--muted)}
.art{position:absolute;left:706px;top:110px;width:450px;height:420px}
.art .iso{margin:0;width:100%;height:100%}
.rule{position:absolute;left:16px;right:16px;top:544px;border-top:1px solid var(--line)}
.foot{position:absolute;left:64px;right:64px;top:560px;display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--fine)}
.foot b{color:var(--accent);margin-right:14px}
.foot span+span::before{content:"·";margin:0 10px}
${drawing}
.iso .iso-draw,.iso .iso-fade,.iso .iso-flow{animation:none;stroke-dashoffset:0;opacity:1}
.iso text,.iso .iso-leader,.iso .iso-dims,.iso .iso-marks{display:none}
</style></head><body>
<div class="grid"></div><div class="frame"></div>
<div class="mark"><svg viewBox="0 0 42 42" aria-hidden="true"><rect class="box" x=".5" y=".5" width="41" height="41" fill="none" stroke-width="1"/><path d="M10.5 31.5 21 10.5l10.5 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path class="pen" d="M15 24.5h20.5M33 21v7" fill="none" stroke-width="2"/></svg><span class="mark-name">Arthur Fay<span class="mark-sub">The Architect Lab</span></span></div>
<h1><span class="outline">Systems</span> that<br>show their <em>work<span class="period">.</span></em></h1>
<p class="lead">Software, data and research systems, published with their source code, their evidence and their limits.</p>
<div class="art">${renderHeroSection()}</div>
<div class="rule"></div>
<div class="foot"><div><b>Fields</b>${FIELDS.map((f) => `<span>${f}</span>`).join('')}</div><div>arthur-fay.github.io</div></div>
</body></html>`;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (error) {
    throw new Error(`Playwright is not resolvable (${error.message}); set NODE_PATH as for the browser tests.`);
  }
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.setContent(renderCardHtml(), { waitUntil: 'load' });
  const png = await page.screenshot({ type: 'png' });
  await browser.close();
  writeFileSync(path.join(ROOT, 'social-card.png'), png);
  console.log(`social-card.png written (${png.length} bytes); palette-reduce it with Pillow before committing (see the header comment).`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
