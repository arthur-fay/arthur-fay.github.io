/**
 * The professional record and the claims around it, read from the committed
 * pages: the privacy guard (no phone number, e-mail address, mailto:/tel: link
 * or LinkedIn URL is committed without the owner's decision), the two degrees
 * from the latest résumé with the bachelor's degree marked as in progress
 * everywhere it appears, both job titles and dates, the hero title block
 * agreeing with the record, the résumé headline carried by the metadata, the
 * skill groups, the sheet numbering agreeing with the navigation, every ATLAS
 * figure sitting next to its qualification, and the contrast of the record's
 * status colours in both themes.
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
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const block = (id) => {
  const match = index.match(new RegExp(`<[a-z]+[^>]*id="${id}"[\\s\\S]*?</section>`));
  assert.ok(match, `index.html has #${id}`);
  return match[0];
};
const heroTitleBlock = () => text(index.match(/<dl class="hero-titleblock">[\s\S]*?<\/dl>/)[0]);

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
  it('publishes no résumé file and no employer volumes', () => {
    assert.doesNotMatch(index, /\.pdf|\.docx|résumé download|download (my|the) résumé/i, 'no résumé file is linked');
    const employment = block('experience').split('record-entry-independent')[0];
    assert.doesNotMatch(text(employment), /\b\d[\d,]*\+?\s+(daily|transactions|incidents|products|stores)/i, 'no operational volumes or product counts from employers');
  });
});

describe('the professional record', () => {
  it('lists both degrees with their dates and marks the bachelor\'s degree as in progress wherever it appears', () => {
    const education = block('education');
    const entries = [...education.matchAll(/<li class="edu-entry">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
    assert.equal(entries.length, 2, 'the latest résumé lists the B.S. and the A.S.');
    assert.match(entries[0], /^In progress · expected Jan 2027 B\.S\. Computer Science Capella University · bachelor's degree in progress, expected January 2027$/);
    assert.doesNotMatch(entries[0], /Completed|graduated|earned/i);
    assert.match(entries[1], /^Completed · Aug 2024 A\.S\. Computer Science Borough of Manhattan Community College ?, City University of New York \(CUNY\) · August 2024$/);
    const chips = [...education.matchAll(/<span class="edu-status ([a-z-]+)">/g)].map((m) => m[1]);
    assert.deepEqual(chips, ['edu-status-progress', 'edu-status-done'], 'hatched chip for in progress, solid chip for completed');
    const hero = heroTitleBlock();
    assert.match(hero, /Education B\.S\. Computer Science, in progress Capella University · expected January 2027 · A\.S\. Computer Science, BMCC \(CUNY\), August 2024/);
    const about = text(block('about'));
    assert.match(about, /pursuing a B\.S\. in Computer Science at Capella University \(expected January 2027\), after an A\.S\. in Computer Science from Borough of Manhattan Community College \(CUNY, August 2024\)/);
    for (const where of [entries[0], hero, about]) assert.doesNotMatch(where, /B\.S\.[^.]*\b(completed|graduated|earned|holds)\b/i, 'the bachelor\'s degree is never presented as completed');
  });

  it('states both job titles, employers and dates as on the latest résumé', () => {
    const record = block('experience');
    const titles = [...record.matchAll(/<h3 id="record-[a-z]+">([^<]+)<small>/g)].map((m) => m[1].trim());
    assert.deepEqual(titles, ['Backend Software Engineer I', 'Data Analyst', 'Software & analytics projects'].map((t) => t.replace('&', '&amp;')));
    const dates = [...record.matchAll(/<span class="record-dates">([^<]+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(dates, ['Mar 2026 — Present', 'Mar 2020 — Dec 2025', 'Jul 2026 — Present']);
    const t = text(record);
    assert.match(t, /Backend Software Engineer I Blue Sky Trading · New York, NY/);
    assert.match(t, /Data Analyst 21st Ave Pharmacy & Medical Supply · New York, NY/);
    assert.doesNotMatch(index, /Pharmacy Technician/, 'the former public title is superseded');
    for (const competency of ['Python REST APIs and PostgreSQL schemas', 'operational event and incident data model', 'ranks failure types by their downtime impact', 'Python and Java', 'inventory management', 'ERP system through its APIs', 'automated tests and CI on every change']) {
      assert.ok(t.includes(competency), `the engineering role states: ${competency}`);
    }
    for (const competency of ['detection rules', 'inventory shortages, delayed orders and unresolved exceptions', 'ranked them by severity', 'HIPAA', 'audit-ready']) {
      assert.ok(t.includes(competency), `the analyst role states: ${competency}`);
    }
  });

  it('keeps the hero title block consistent with the record and the résumé headline', () => {
    const hero = heroTitleBlock();
    const record = text(block('experience'));
    for (const fact of ['Backend Software Engineer I', 'Blue Sky Trading', 'New York, NY', 'Capella University', 'August 2024', 'January 2027']) {
      assert.ok(hero.includes(fact) && record.includes(fact), `${fact} appears in the hero and the record`);
    }
    assert.match(hero, /since March 2026/);
    assert.match(record, /Mar 2026 — Present/);
    assert.match(hero, /Stack Python · TypeScript\/React · FastAPI · PostgreSQL REST APIs · SQL · pytest & Playwright · GitHub Actions CI\/CD/);
    assert.match(hero, /Verify github\.com\/arthur-fay/);
  });

  it('carries the résumé headline in the metadata, the hero, the about section and the contact block, and keeps the job title for the record', () => {
    const head = index.slice(0, index.indexOf('</head>'));
    assert.ok(head.includes('<title>Arthur Fay — Software Engineer · The Architect Lab · Python, TypeScript/React, FastAPI &amp; PostgreSQL</title>'));
    for (const property of ['property="og:title"', 'name="twitter:title"']) assert.ok(head.includes(`${property} content="Arthur Fay — Software Engineer · The Architect Lab"`), property);
    assert.match(head, /name="description" content="Arthur Fay is a software engineer in New York working in Python, TypeScript\/React, FastAPI, PostgreSQL, REST APIs and CI\/CD\./);
    for (const property of ['og:description', 'twitter:description']) assert.ok(head.includes(`${property}" content="Software engineer (Python, TypeScript/React, FastAPI, PostgreSQL, REST APIs, CI/CD).`), property);
    assert.doesNotMatch(head, /Backend Software Engineer/, 'the job title is not used as the public headline');
    const heroRole = text(index.match(/<p class="hero-roleline">[\s\S]*?<\/p>/)[0]);
    assert.match(heroRole, /Software Engineer \/ Python · TypeScript\/React · FastAPI · PostgreSQL/);
    const hero = index.match(/<div class="hero-copy">([\s\S]*?)<\/div>\s*<figure class="hero-figure/)[1];
    assert.ok(hero.indexOf('class="hero-roleline"') < hero.indexOf('id="hero-title"'), 'role is immediately visible before the editorial headline');
    const heroCopy = text(index.match(/<p class="hero-description">[\s\S]*?<\/p>/)[0]);
    assert.match(heroCopy, /^At Blue Sky Trading, I build Python REST APIs, PostgreSQL schemas and ERP-integrated internal applications\s*\./);
    assert.match(heroCopy, /ATLAS/);
    assert.match(heroCopy, /source code, evidence and limits/);
    assert.ok(heroCopy.split(/\s+/).length <= 65, 'the desktop summary is concise enough to scan');
    const about = text(block('about'));
    assert.match(about, /A software engineer, building to be inspected\./);
    assert.match(about, /a software engineer in New York\. At Blue Sky Trading, as a Backend Software Engineer I,/);
    assert.match(about, /more than five years as a data analyst working with HIPAA-regulated pharmacy data/);
    const fields = [...block('about').matchAll(/<li><span class="field-index"[^>]*>\d\d<\/span>([^<]+)<\/li>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    assert.deepEqual(fields, ['Backend services & REST APIs', 'Database engineering & SQL', 'Frontend development & accessible interfaces', 'Automated testing & CI/CD', 'Forecasting research & analytics', 'Interactive engineering labs']);
    const roles = block('contact').match(/<ul class="contact-roles"[^>]*>([\s\S]*?)<\/ul>/)[1];
    assert.deepEqual([...roles.matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1].replace(/&amp;/g, '&')), ['Software Engineer', 'Backend Software Engineer', 'Full-Stack Engineer · Python & React', 'API / Database Engineer']);
    assert.match(text(block('contact')), /open to software engineering roles/);
    assert.match(text(index.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0]), /Portfolio of a software engineer/);
  });

  it('groups the skills as the résumé does and says where each technology was used', () => {
    const stack = index.match(/<section class="record-card" aria-labelledby="stack-title">[\s\S]*?<\/section>/)[0];
    const groups = [...stack.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    assert.deepEqual(groups, ['Programming', 'Backend & data', 'Frontend', 'Testing & quality', 'Infrastructure & CI/CD', 'Practices']);
    const chips = [...stack.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    const expected = {
      programming: ['Python', 'TypeScript', 'JavaScript', 'SQL', 'HTML · CSS', 'Bash', 'Java', 'C++'],
      backend: ['FastAPI', 'REST API design', 'OpenAPI 3.1', 'Pydantic', 'PostgreSQL', 'API-key authentication', 'Rate limiting', 'pandas', 'NumPy', 'SciPy'],
      frontend: ['React 19', 'TypeScript (strict)', 'Vite', 'openapi-typescript', 'Zod', 'D3 · SVG charts', 'Accessible UI · WCAG 2.2 AA'],
      testing: ['pytest', 'Hypothesis', 'Vitest', 'Playwright', 'mypy --strict', 'Ruff', 'ESLint', 'axe-core', 'Dependency audits'],
      infrastructure: ['Git · pull requests', 'GitHub Actions', 'Docker (CI)', 'Linux', 'systemd', 'nginx · TLS', 'Automatic rollback (tested)'],
    };
    assert.deepEqual(chips, Object.values(expected).flat());
    const practices = text(stack.match(/<dt>Practices<\/dt><dd>([\s\S]*?)<\/dd>/)[1]);
    assert.equal(practices, 'Technical documentation (architecture, runbooks), reproducible software, code review, automated testing, and AI-assisted development gated by human review, tests and CI.');
    assert.match(text(stack), /no years of experience per technology are claimed/);
    assert.doesNotMatch(stack, /Excel|Google Sheets|Tableau|Power Query/, 'tools the latest résumé no longer lists stay off the stack card');
    assert.doesNotMatch(index, /\bAI\b(?!-assisted development)/, 'the only mention of AI on the page is the résumé\'s development practice');
  });

  it('separates employment from independent work and references no employer system', () => {
    const record = block('experience');
    const kinds = [...record.matchAll(/<span class="record-kind[^"]*">([^<]+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(kinds, ['Employment', 'Employment', 'Independent work']);
    const employment = record.split('record-entry-independent')[0];
    assert.doesNotMatch(employment, /<a /, 'employment entries link to nothing');
    assert.doesNotMatch(text(employment), /\b\d[\d,]*\+?\s+(daily|transactions|incidents|products)/i, 'no operational volumes from employers');
    assert.doesNotMatch(employment, /endpoint\b|\/api\/|schema name|patient name|customer record/i, 'no internal API, schema or record detail');
    assert.match(text(record), /The four plates above are independent work, built outside these roles/);
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
    assert.match(cut, /API-key authentication for simulations, request-body and in-flight limits/);
    assert.match(cut, /worker processes that are replaced when they pass their deadline/);
    assert.match(cut, /p95 of at most 11 ms in the project's own local benchmark/);
    assert.match(cut, /keyboard-operable SVG charts/);
    assert.match(cut, /Chromium, Firefox and WebKit/);
    assert.match(cut, /axe-core checks against the WCAG 2\.2 AA rules/);
    assert.match(cut, /initial JavaScript bundle of 85 KB held under a CI size budget/);
    assert.match(cut, /822 historical origins/);
    assert.match(cut, /1 to 30 days/);
    assert.match(cut, /WAPE 9\.2%/);
    assert.match(cut, /Holm-adjusted p 0\.054/);
    assert.match(cut, /92\.1%/);
    assert.match(cut, /2023-01-01 to 2026-06-30 \(1,277 days, 12\.3M requests\)/);
    assert.match(cut, /not published/);
    const plate = text(block('plate-atlas'));
    assert.match(plate, /immutable releases, a hardened systemd unit with watchdog and sandboxing, an nginx TLS proxy, automatic rollback\) is tested end to end in a disposable Ubuntu container, not deployed/);
    assert.match(plate, /1,780\+ pytest tests under a 90% coverage gate \(96% recorded in the release gate's run\)/);
    assert.doesNotMatch(plate, /PostgreSQL/, 'ATLAS does not use PostgreSQL and the plate must not imply it');
    const detail = text(block('atlas-detail'));
    assert.match(detail, /crash, rollback and reboot paths are exercised end to end in a disposable container/);
    assert.doesNotMatch(index, /\b57 (cross-browser )?Playwright|live production|production deployment|in production\b/i, 'no unverified count and no production claim');
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
