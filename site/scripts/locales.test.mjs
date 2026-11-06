// Spanish, French and Brazilian Portuguese are frozen (docs/i18n/FROZEN.md): the site builds German
// and English only, and every old URL of a frozen language reaches the English page without a script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(path.join(root, ...p), 'utf8');
const FROZEN = ['/es', '/fr', '/pt-br'];

test('the site offers German and English only', () => {
  const index = read('src', 'i18n', 'index.ts');
  assert.match(index, /export const LOCALES = \['de', 'en'\] as const;/);
  for (const p of FROZEN) assert.ok(!existsSync(path.join(root, 'src', 'pages', p.slice(1))), `${p} page still built`);
});

test('frozen languages keep their texts in the repo', () => {
  for (const f of ['es.ts', 'fr.ts', 'pt.ts']) assert.ok(existsSync(path.join(root, 'src', 'i18n', f)), f);
});

test('old URLs of frozen languages redirect to English (Cloudflare 301 and static page)', () => {
  const redirects = read('public', '_redirects');
  const config = read('astro.config.mjs');
  const index = read('src', 'i18n', 'index.ts');
  for (const p of FROZEN) {
    assert.match(redirects, new RegExp(`^${p} /en 301$`, 'm'), `${p} in _redirects`);
    assert.match(redirects, new RegExp(`^${p}/\\* /en 301$`, 'm'), `${p}/* in _redirects`);
    assert.ok(config.includes(`'${p}': '/en'`), `${p} in astro.config.mjs`);
    assert.ok(index.includes(`'${p}': '/en'`), `${p} in FROZEN_REDIRECTS`);
  }
});
