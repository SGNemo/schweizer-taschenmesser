// Constants that exist twice on purpose (app and site) must stay equal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { KOFI_URL, ASSETS } from '../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, '..', '..', 'web');

test('Ko-fi URL equals SUPPORT_PAGE_URL in the app', () => {
  const src = readFileSync(path.join(web, 'src', 'pages', 'settings', 'supporterLinks.ts'), 'utf8');
  const m = src.match(/SUPPORT_PAGE_URL\s*=\s*'([^']+)'/);
  assert.ok(m, 'SUPPORT_PAGE_URL not found');
  assert.equal(KOFI_URL, m[1]);
});

test('download asset names exist in the release asset list', () => {
  const src = readFileSync(path.join(web, 'scripts', 'lib', 'releaseAssets.ts'), 'utf8');
  for (const name of Object.values(ASSETS)) assert.ok(src.includes(`'${name}'`), `${name} not in releaseAssets.ts`);
});
