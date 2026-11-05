// The module catalogue (src/catalog/modules.json, written by `npm run gen:modules` in web/) names what the site
// draws for a module: icon, hue, head and widget variant. Every value must have a shape here, or a module would
// render grey and blank on the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (...p) => readFileSync(path.join(here, '..', 'src', ...p), 'utf8');
const catalog = JSON.parse(src('catalog', 'modules.json'));
const icon = src('components', 'Icon.astro');
const mini = src('components', 'IdentityMini.astro');
const [widgets, heads] = mini.split('const HEAD: Record');
const identity = src('styles', 'identity.css');
const entry = (text, key) => new RegExp(`^  ${key}: '`, 'm').test(text);

test('the catalogue carries identity for every module', () => {
  assert.ok(catalog.modules.length > 10);
  for (const m of catalog.modules) {
    for (const k of ['icon', 'hue', 'head', 'widget']) assert.equal(typeof m[k], 'string', `${m.id}: ${k}`);
  }
});

test('every module icon is drawn by Icon.astro', () => {
  for (const m of catalog.modules) assert.ok(entry(icon, m.icon), `${m.id}: icon "${m.icon}" missing in Icon.astro`);
});

test('every widget variant and head shape of the catalogue has a sketch in IdentityMini.astro', () => {
  for (const m of catalog.modules) {
    assert.ok(entry(widgets, m.widget), `${m.id}: widget "${m.widget}" has no miniature`);
    assert.ok(entry(heads, m.head), `${m.id}: head "${m.head}" has no silhouette`);
  }
});

test('every hue of the catalogue maps to --module-color (identity.css)', () => {
  for (const m of catalog.modules) {
    assert.ok(identity.includes(`[data-hue='${m.hue}']`), `${m.id}: hue "${m.hue}"`);
    if (m.hue2) assert.ok(identity.includes(`[data-hue2='${m.hue2}']`), `${m.id}: hue2 "${m.hue2}"`);
  }
});

// The site's texts must cover what the catalogue may bring: a subtitle per area and a name per head shape, in every
// language. Node strips the types of the locale files (plain `as const` objects without imports).
const LOCALES = ['de', 'en', 'es', 'fr', 'pt'];
test('every catalogue area has a subtitle and every head shape a name in all five languages', async () => {
  for (const l of LOCALES) {
    const mod = await import(`../src/i18n/${l}.ts`);
    const s = Object.values(mod)[0];
    for (const a of catalog.areas) assert.equal(typeof s.features.areas[a.id], 'string', `${l}: area "${a.id}"`);
    for (const m of catalog.modules) assert.equal(typeof s.heads.names[m.head], 'string', `${l}: head "${m.head}"`);
  }
});
