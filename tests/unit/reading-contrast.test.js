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
