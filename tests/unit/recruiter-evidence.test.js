/**
 * Recruiter evidence assertions: keep portfolio claims narrower than source
 * repositories, especially for tools/processes absent from the original BI README.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const unescape = s => s.replace(/&amp;/g, '&').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const region = (start, end) => {
  const i = html.indexOf(start);
  const j = html.indexOf(end, i + start.length);
  assert.ok(i >= 0 && j > i, 'region exists: ' + start);
  return html.slice(i, j);
};

describe('recruiter credibility and contact', () => {
  it('offers direct recruiting contact and describes GitHub as technical evidence', () => {
    const contact = unescape(region('id="contact"', '</section>'));
    assert.match(contact, /Email me about a role or connect on LinkedIn/i);
    assert.match(contact, /arthur\.fay74@gmail\.com/);
    assert.match(contact, /public GitHub links here for source repositories, available tests and technical evidence/i);
    assert.doesNotMatch(contact, /start a discussion on any repository|shared on request|résumé you received/i);
    assert.match(contact, /Software Engineer/);
    assert.match(contact, /Backend Software Engineer/);
    assert.match(contact, /Full-Stack Engineer/);
  });

  it('makes clear where professional history comes from and avoids claiming universal CI', () => {
    const hero = unescape(region('class="hero-titleblock-wrap"', '</dl>'));
    assert.match(hero, /Project repositories, available research evidence and tested browser labs/);
    assert.doesNotMatch(hero, /tests and continuous integration for every project/i);
    const about = unescape(region('id="about"', '</section>'));
    assert.match(about, /Employment and education are résumé-reported/);
    assert.match(about, /three interactive browser labs/);
  });

  it('does not invent Colab notebook implementation steps for the Power BI project', () => {
    const overview = unescape(region('id="cut-commerce"', 'id="cut-pathfinding"'));
    assert.match(overview, /public README does not specify the notebook language or individual transformation steps/);
    assert.doesNotMatch(overview, /Python notebooks in Google Colab/i);
    const plate = unescape(region('id="plate-commerce"', 'id="plate-pathfinding"'));
    assert.match(plate, /individual preparation steps are not published/);
    assert.doesNotMatch(plate, /SQL and Google Colab notebooks transform the transactional data/i);
    assert.match(plate, /hypothetical scenarios/i);
  });

  it('preserves existing evidence destinations and the four project entries', () => {
    for (const href of [
      'href="#plate-atlas"', 'href="#plate-commerce"',
      'href="#plate-pathfinding"', 'href="#plate-security"',
      'href="/lab/ecommerce/"', 'href="/lab/pathfinding/"', 'href="/lab/security-events/"',
      'demand-forecasting-model/blob/main/docs/API.md',
      'inventory-reservations-api#run-locally',
      'inventory-reservations-api/blob/main/tests/integration/test_concurrency.py',
    ]) assert.ok(html.includes(href), 'required verifiable route: ' + href);
    const guide = unescape(region('id="hiring"', '</section>'));
    assert.match(guide, /Run this synthetic demonstration locally with Docker Compose/);
  });
});
