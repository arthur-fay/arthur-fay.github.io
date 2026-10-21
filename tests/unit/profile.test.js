/**
 * The professional record and the claims around it, read from the committed
 * pages: the privacy guard (no phone number, e-mail address, mailto:/tel: link
 * or LinkedIn URL is committed without the owner's decision), the bachelor's
 * degree marked as in progress everywhere it appears, the hero title block
 * agreeing with the record, the sheet numbering agreeing with the navigation,
 * every ATLAS figure sitting next to its qualification, and the contrast of
 * the record's status colours in both themes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokensFromBlock, contrast, opaque } from './helpers/css-colour.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const index = read('index.html');
const css = read('styles.css');
const PAGES = ['index.html', '404.html', 'lab/ecommerce/index.html', 'lab/pathfinding/index.html', 'lab/security-events/index.html'];
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const block = (id) => {
  const match = index.match(new RegExp(`<[a-z]+[^>]*id="${id}"[\\s\\S]*?</section>`));
  assert.ok(match, `index.html has #${id}`);
  return match[0];
};

describe('privacy guard', () => {
  for (const page of PAGES) {
    it(`${page} carries no personal contact details`, () => {
      const html = read(page);
      assert.doesNotMatch(html, /mailto:|\btel:/i);
      assert.doesNotMatch(text(html), /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, 'no e-mail address');
      assert.doesNotMatch(text(html), /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, 'no phone number');
      assert.doesNotMatch(html, /linkedin\.com/i, 'no LinkedIn URL until the owner publishes one');
      for (const [, href] of html.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"/g)) assert.equal(new URL(href).host, 'github.com', `outbound link stays on GitHub: ${href}`);
    });
  }
});

describe('the professional record', () => {
  it('marks the bachelor\'s degree as in progress wherever a degree is mentioned', () => {
    const education = block('education');
    const entries = [...education.matchAll(/<li class="edu-entry">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
    assert.equal(entries.length, 2);
    assert.match(entries[0], /In progress · expected 2027/);
    assert.match(entries[0], /B\.S\. Computer Science/);
    assert.match(entries[0], /Capella University/);
    assert.doesNotMatch(entries[0], /Completed|graduated|earned/i);
    assert.match(entries[1], /Completed · August 2024/);
    assert.match(entries[1], /A\.S\. Computer Science/);
    assert.match(entries[1], /Borough of Manhattan Community College/);
    const hero = text(index.match(/<dl class="hero-titleblock">[\s\S]*?<\/dl>/)[0]);
    assert.match(hero, /B\.S\. Computer Science, in progress/);
    assert.match(hero, /expected 2027/);
    const about = text(block('about'));
    assert.match(about, /completing a B\.S\. in Computer Science at Capella University \(expected 2027\)/);
  });

  it('keeps the hero title block consistent with the record', () => {
    const hero = text(index.match(/<dl class="hero-titleblock">[\s\S]*?<\/dl>/)[0]);
    const record = text(block('experience'));
    for (const fact of ['Backend Software Engineer I', 'Blue Sky Trading', 'New York, NY', 'Capella University', 'expected 2027']) {
      assert.ok(hero.includes(fact) && record.includes(fact), `${fact} appears in the hero and the record`);
    }
    assert.match(hero, /since March 2026/);
    assert.match(record, /Mar 2026 — Present/);
  });

  it('separates employment from independent work and references no employer system', () => {
    const record = block('experience');
    const kinds = [...record.matchAll(/<span class="record-kind[^"]*">([^<]+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(kinds, ['Employment', 'Employment', 'Independent work']);
    const employment = record.split('record-entry-independent')[0];
    assert.doesNotMatch(employment, /<a /, 'employment entries link to nothing');
    assert.doesNotMatch(text(employment), /\b\d{2,}\+?\s+(daily|transactions|incidents)/i, 'no operational volumes from employers');
  });

  it('numbers the sheets in the order of the navigation and the footer index', () => {
    const nav = [...index.matchAll(/<nav class="desktop-nav"[\s\S]*?<\/nav>/g)][0][0];
    const navItems = [...nav.matchAll(/<a href="#([a-z-]+)"><span class="nav-index" aria-hidden="true">(\d\d)<\/span>([A-Za-z]+)<\/a>/g)].map((m) => [m[2], m[1], m[3]]);
    assert.deepEqual(navItems, [['01', 'systems', 'Systems'], ['02', 'work', 'Work'], ['03', 'experience', 'Experience'], ['04', 'approach', 'Method'], ['05', 'about', 'About'], ['06', 'contact', 'Contact']]);
    const mobile = index.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)[0];
    for (const [, id] of navItems) assert.ok(mobile.includes(`href="#${id}"`), `mobile navigation lists #${id}`);
    const footer = index.match(/<dd class="footer-index">([\s\S]*?)<\/dd>/)[1];
    assert.deepEqual([...footer.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1]), ['top', 'systems', 'work', 'experience', 'approach', 'about', 'contact']);
    const sheet = (id, selector) => { const section = block(id); const m = section.match(selector); assert.ok(m, `#${id} carries a sheet number`); return m[1]; };
    assert.equal(sheet('systems', /<p class="section-index">(\d\d) \//), '01');
    assert.equal(sheet('work', /<p class="section-index">(\d\d) \//), '02');
    assert.equal(sheet('experience', /<p class="section-index">(\d\d) \//), '03');
    assert.equal(sheet('approach', /<p class="section-index">(\d\d) \//), '04');
    assert.equal(sheet('about', /<p class="section-index">(\d\d) \//), '05');
    assert.equal(sheet('contact', /<span class="section-index">(\d\d) \//), '06');
  });
});

describe('ATLAS figures carry their qualifications', () => {
  for (const id of ['cut-atlas', 'plate-atlas', 'atlas-detail']) {
    it(`#${id} states the improvement only with the statistical and calibration findings`, () => {
      const t = text(block(id)).toLowerCase();
      if (id !== 'plate-atlas') assert.ok(t.includes('28%') && t.includes('11%'), 'the measured improvement is stated');
      assert.ok(t.includes('not statistically established') || t.includes('not established'), 'and qualified');
      assert.ok(t.includes('failed calibration'), 'with the calibration finding');
      assert.ok(t.includes('hypothetical'), 'and the optimization boundary');
    });
  }
  it('describes the verified API, data and deployment facts exactly as the repository documents them', () => {
    const cut = text(block('cut-atlas'));
    assert.match(cut, /14 versioned endpoints/);
    assert.match(cut, /OpenAPI 3\.1/);
    assert.match(cut, /822 historical origins/);
    assert.match(cut, /1 to 30 days/);
    assert.match(cut, /WAPE 9\.2%/);
    assert.match(cut, /Holm-adjusted p 0\.054/);
    assert.match(cut, /92\.1%/);
    assert.match(cut, /2023-01-01 to 2026-06-30 \(1,277 days, 12\.3M requests\)/);
    assert.match(cut, /not published/);
    const plate = text(block('plate-atlas'));
    assert.match(plate, /tested end to end in a disposable Ubuntu container, not deployed/);
    assert.match(plate, /1,780\+ pytest tests under a 90% coverage gate/);
    assert.doesNotMatch(plate, /PostgreSQL/, 'ATLAS does not use PostgreSQL and the plate must not imply it');
  });
});

for (const theme of ['dark', 'light']) {
  describe(`${theme} theme: record colours`, () => {
    const t = { ...tokensFromBlock(css, ':root') };
    if (theme === 'light') Object.assign(t, tokensFromBlock(css, 'html[data-theme="light"]'));
    const bg = opaque('var(--bg)', t);
    const surface = opaque('var(--surface)', t, bg);
    const sheet = opaque('color-mix(in srgb,var(--surface) 92%,transparent)', t, bg); // .hero-titleblock cells
    const expect = (label, fg, over, minimum) => {
      const ratio = contrast(opaque(fg, t, over), over);
      assert.ok(ratio >= minimum, `${theme}: ${label} contrast ${ratio.toFixed(2)} < ${minimum}`);
    };
    it('status chips, labels and notes meet AA on the record cards and the hero title block', () => {
      expect('in-progress chip (cyan) on a card', 'var(--cyan)', surface, 4.5);
      expect('completed chip (accent) on a card', 'var(--accent)', surface, 4.5);
      expect('independent-work label (cyan) on a card', 'var(--cyan)', surface, 4.5);
      expect('card labels (fine) on a card', 'var(--fine)', surface, 4.5);
      expect('muted copy on a card', 'var(--muted)', surface, 4.5);
      expect('title block labels (fine)', 'var(--fine)', sheet, 4.5);
      expect('title block values (text)', 'var(--text)', sheet, 4.5);
      expect('title block notes (muted)', 'var(--muted)', sheet, 4.5);
      expect('title block link arrow (accent)', 'var(--accent)', sheet, 4.5);
    });
    it('the contact card keeps its copy, role chips and outline button readable on the accent', () => {
      const accent = opaque('var(--accent)', t, bg);
      expect('contact copy', 'color-mix(in srgb,var(--on-accent) 85%,transparent)', accent, 4.5);
      expect('role chips and outline button text', 'var(--on-accent)', accent, 4.5);
      expect('outline button border', 'color-mix(in srgb,var(--on-accent) 55%,transparent)', accent, 3);
    });
  });
}
