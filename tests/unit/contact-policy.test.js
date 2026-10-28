/** Regressions for the offline checker's narrowly approved recruiting contacts. */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
function accepted(html, label = 'index.html') {
  const result = spawnSync('python3', ['-B', '-c', `
import json, sys
from scripts.check_site import PageParser, check_contact_details
data = json.load(sys.stdin)
try:
    check_contact_details(data["html"], data["label"])
    page = PageParser()
    page.feed(data["html"])
    assert not page.errors, page.errors
except AssertionError:
    print("rejected")
else:
    print("accepted")
`], { cwd: root, input: JSON.stringify({ html, label }), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() === 'accepted';
}

const email = '<a href="mailto:arthur.fay74@gmail.com">arthur.fay74@gmail.com</a>';
const linkedin = '<a href="https://www.linkedin.com/in/arthur-fay/" target="_blank" rel="noopener noreferrer">LinkedIn</a>';

it('accepts the exact approved contacts on the homepage and ordinary GitHub evidence links', () => {
  assert.ok(accepted(email + linkedin));
  assert.ok(accepted('<a href="https://github.com/arthur-fay">Source</a>'));
});

it('rejects changed recipients, extra mail fields, other profiles and phone numbers', () => {
  for (const html of [
    email.replaceAll('arthur.fay74@gmail.com', 'other@gmail.com'),
    email.replaceAll('gmail.com', 'gmail.com.example.org'),
    email.replace('mailto:arthur.fay74@gmail.com', 'mailto:arthur.fay74@gmail.com,other@gmail.com'),
    email.replace('mailto:arthur.fay74@gmail.com', 'mailto:arthur.fay74@gmail.com?cc=other@gmail.com'),
    email.replace('mailto:arthur.fay74@gmail.com', 'mailto:arthur.fay74@gmail.com?subject=Recruiting'),
    '<a href="mailto:arthur.fay74%40gmail.com">Email</a>',
    linkedin.replace('/in/arthur-fay/', '/in/someone-else/'),
    linkedin.replace('/in/arthur-fay/', '/in/arthur-fay/?redirect=elsewhere'),
    linkedin.replace('www.linkedin.com', 'www.linkedin.com.example.org'),
    '<p>212-555-0199</p>',
    '<a href="tel:2125550199">Call</a>',
  ]) assert.equal(accepted(html), false, 'must reject: ' + html);
});

it('keeps the contact exception off lab and error pages', () => {
  for (const page of ['404.html', 'lab/ecommerce/index.html', 'lab/pathfinding/index.html', 'lab/security-events/index.html']) {
    assert.equal(accepted(email, page), false, page);
    assert.equal(accepted(linkedin, page), false, page);
  }
});
