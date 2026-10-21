/**
 * Provenance of the figures and definitions printed in lab/ecommerce/index.html:
 * every published KPI, DAX measure, formula, assumption, table fact, pipeline
 * stage, report-wiring row and source link in the markup must be exactly what
 * lab/ecommerce/model.js carries, so the page can never drift from the engine
 * (and therefore from the README it transcribes).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../../lab/ecommerce/model.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(path.join(ROOT, 'lab/ecommerce/index.html'), 'utf8');
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const has = (text, label) => assert.ok(html.includes(text), `${label || 'page'} missing: ${text.slice(0, 80)}`);
const count = (text) => html.split(text).length - 1;

describe('analytics lab page: KPI tiles', () => {
  it('prints the six published KPIs with the engine display, unit, definition and caveat', () => {
    for (const metric of M.METRICS) {
      has(`data-metric="${metric.id}">${escape(metric.display)}<small>${escape(metric.unit)}</small>`, `KPI ${metric.id} value`);
      has(escape(metric.definition), `KPI ${metric.id} definition`);
      has(escape(metric.caveat), `KPI ${metric.id} caveat`);
      has(`<p class="kpi-label">${escape(metric.title)}</p>`, `KPI ${metric.id} title`);
    }
    assert.equal(count('data-metric="'), M.METRICS.length, 'exactly six tiles');
  });

  it('quotes every published DAX measure verbatim, in its tile and in the lineage card', () => {
    for (const measure of M.DAX_MEASURES.filter((d) => d.published)) {
      const block = `<pre class="dax-block"><code>${escape(measure.dax)}</code></pre>`;
      assert.ok(count(block) >= 2, `${measure.name} appears in the KPI tile and the DAX card`);
      has(`<article class="dax-card" id="dax-${measure.id}"><h4>${escape(measure.name)}</h4>`, `DAX card ${measure.id}`);
    }
    for (const measure of M.DAX_MEASURES.filter((d) => !d.published)) {
      has(`<strong>${escape(measure.name)}</strong>: ${escape(measure.note)}`, `unpublished measure ${measure.id}`);
    }
    has('<code>Total Customers</code> drives the card in the report layout; its DAX is not published.', 'customers tile note');
  });
});

describe('analytics lab page: provenance ledger and sources', () => {
  it('counts what the page is built from', () => {
    has(`<div><dt>Published KPIs</dt><dd>0${M.METRICS.length}<small>README table</small></dd></div>`);
    has(`<div><dt>Leading categories</dt><dd>0${M.PUBLISHED.categories.length}<small>README insights</small></dd></div>`);
    has(`<div><dt>DAX measures quoted</dt><dd>0${M.DAX_MEASURES.filter((d) => d.published).length}<small>README, verbatim</small></dd></div>`);
    has(`<div><dt>Model tables</dt><dd>${M.MODEL_TABLES.length}<small>README data model</small></dd></div>`);
    has('<div><dt>Monthly values</dt><dd>00<small>none published, none drawn</small></dd></div>');
  });

  it('links every source file the engine records and names the checked commit and date', () => {
    for (const url of [M.SOURCE.readme, M.SOURCE.readmeKpis, M.SOURCE.readmeModel, M.SOURCE.readmeDax, M.SOURCE.readmeInsights, ...Object.values(M.SOURCE.files)]) {
      has(`href="${url}"`, `source link ${url}`);
    }
    has(`commit ${M.SOURCE.commit.slice(0, 7)}`);
    const checked = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${M.SOURCE.checked}T00:00:00Z`));
    has(`on ${checked}`, 'checked date');
  });

  it('quotes the README insight sentences for the two leading categories', () => {
    has(`<p>"${escape(M.PUBLISHED.insights[0])}"</p>`);
    has(`<p>"${escape(M.PUBLISHED.insights[1])}"</p>`);
    has(`("${escape(M.PUBLISHED.insights[2].charAt(0).toLowerCase() + M.PUBLISHED.insights[2].slice(1, -1))}")`, 'trend sentence');
  });
});

describe('analytics lab page: simulator', () => {
  it('declares slider and typed-input ranges equal to the engine limits and steps', () => {
    const ids = { volumePct: 'volume', basketPct: 'basket', deliveryPoints: 'delivery', onTimePoints: 'ontime' };
    for (const input of M.INPUTS) {
      const [min, max] = M.LIMITS[input.key];
      const id = ids[input.key];
      has(`<input type="range" id="${id}-range" min="${min}" max="${max}" step="${input.step}" value="0" aria-describedby="${id}-hint" />`, `${id} range`);
      has(`<input type="number" id="${id}-value" class="range-number" min="${min}" max="${max}" step="${input.step}" value="0" inputmode="decimal"`, `${id} number`);
      has(`${min === 0 ? '' : ''}${String(min).replace('-', '−')}${input.unit === '%' ? '%' : ''} to +${max}${input.unit === '%' ? '%' : ' points'}.`, `${id} hint range`);
    }
  });

  it('offers exactly the engine presets, baseline first and pressed', () => {
    for (const preset of M.PRESETS) has(`data-preset="${preset.id}" aria-pressed="${preset.id === 'baseline' ? 'true' : 'false'}">${escape(preset.name)}</button>`, `preset ${preset.id}`);
    assert.equal(count('class="preset-button"'), M.PRESETS.length);
  });

  it('documents the formulas and assumptions exactly as the engine states them', () => {
    for (const formula of M.FORMULAS) {
      has(`<div><dt>${escape(formula.label)}</dt><dd><code>${escape(formula.expression)}</code><span>${escape(formula.note)}</span></dd></div>`, `formula ${formula.id}`);
    }
    for (const assumption of M.ASSUMPTIONS) has(`<li>${escape(assumption)}</li>`, 'assumption');
    const [vMin, vMax] = M.LIMITS.volumePct;
    const [bMin, bMax] = M.LIMITS.basketPct;
    const [dMin, dMax] = M.LIMITS.deliveryPoints;
    const [oMin, oMax] = M.LIMITS.onTimePoints;
    has(`−${-vMin}% to +${vMax}% volume, −${-bMin}% to +${bMax}% basket, −${-dMin} to +${dMax} points of delivery, −${-oMin} to +${oMax} points of on-time performance.`, 'range note');
  });
});

describe('analytics lab page: model, pipeline and report wiring', () => {
  it('states the model facts, the pipeline stages and the report wiring from the engine', () => {
    for (const fact of M.MODEL_FACTS) has(`<li>${escape(fact)}</li>`, 'model fact');
    M.PIPELINE.forEach((stage, index) => {
      has(`<li><span class="pipeline-index">0${index + 1}</span><h4>${escape(stage.title)}</h4><p>${escape(stage.text)}</p></li>`, `pipeline ${stage.id}`);
    });
    for (const visual of M.DASHBOARD_VISUALS) {
      has(`<tr><td>${escape(visual.title)}</td><td>${escape(visual.type)}</td><td>${escape(visual.fields.join(' · '))}</td><td>${visual.filter ? escape(visual.filter) : '—'}</td></tr>`, `wiring ${visual.id}`);
    }
  });

  it('keeps the markup free of inline code, images and forms', () => {
    assert.ok(!/<img\b/.test(html) && !/<form\b/.test(html) && !/ style="/.test(html) && !/<script>/.test(html) && !/\son[a-z]+="/.test(html));
  });
});
