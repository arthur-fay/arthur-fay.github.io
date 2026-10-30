/** The three reading inks must remain strong on all four plain reading surfaces. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tokensFromBlock, opaque, contrast } from './helpers/css-colour.js';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
for (const theme of ['dark', 'light']) {
  describe(`${theme}: reading contrast`, () => {
    const tokens = tokensFromBlock(css, ':root');
    if (theme === 'light') Object.assign(tokens, tokensFromBlock(css, 'html[data-theme="light"]'));
    for (const ink of ['--text', '--muted', '--fine']) {
      it(`${ink} exceeds 7:1 on the page, inset and panel backgrounds`, () => {
        for (const surface of ['--bg', '--bg2', '--surface', '--surface2']) {
          const ratio = contrast(opaque(`var(${ink})`, tokens), opaque(`var(${surface})`, tokens));
          assert.ok(ratio >= 7, `${ink} on ${surface}: ${ratio.toFixed(2)} < 7`);
        }
      });
    }
  });
}

describe('coloured feature panels', () => {
  const root = tokensFromBlock(css, ':root');
  for (const theme of ['dark', 'light']) {
    it(`${theme}: keeps the system panel reading inks above 7:1 and accent labels above 4.5:1`, () => {
      const tokens = { ...root, ...tokensFromBlock(css, '.hero .system-figure'), ...(theme === 'light' ? tokensFromBlock(css, 'html[data-theme="light"] .hero .system-figure') : {}) };
      for (const surface of ['--bg', '--bg2', '--surface', '--surface2']) {
        const background = opaque(`var(${surface})`, tokens);
        for (const ink of ['--text', '--muted', '--fine', '--accent', '--cyan', '--violet', '--warm']) {
          const minimum = ['--text', '--muted', '--fine'].includes(ink) ? 7 : 4.5;
          const ratio = contrast(opaque(`var(${ink})`, tokens), background);
          assert.ok(ratio >= minimum, `${ink} on ${surface}: ${ratio.toFixed(2)} < ${minimum}`);
        }
      }
    });
  }
  it('keeps contact text and its primary action readable across every gradient stop', () => {
    const tokens = { ...root, ...tokensFromBlock(css, '.contact-section .contact-card') };
    for (const stop of ['--contact-start', '--contact-middle', '--contact-end']) {
      assert.ok(contrast(opaque('var(--on-accent)', tokens), opaque(`var(${stop})`, tokens)) >= 7);
    }
    assert.ok(contrast(opaque('var(--contact-button-text)', tokens), opaque('var(--contact-button)', tokens)) >= 7);
  });
  for (const theme of ['dark', 'light']) {
    it(`${theme}: all four project inks stay readable on the strongest shared header tint`, () => {
      const tokens = { ...root, ...(theme === 'light' ? tokensFromBlock(css, 'html[data-theme="light"]') : {}) };
      for (const accent of ['--accent', '--cyan', '--violet', '--warm']) {
        const project = { ...tokens, '--accent': tokens[accent] };
        const background = opaque('color-mix(in srgb,var(--accent) 12%,var(--surface))', project);
        for (const ink of ['--text', '--muted', '--fine', '--accent']) {
          const ratio = contrast(opaque(`var(${ink})`, project), background);
          assert.ok(ratio >= 4.5, `${theme}: ${ink} in ${accent} header: ${ratio.toFixed(2)} < 4.5`);
        }
      }
    });
  }
});
