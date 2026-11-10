// The module catalogue (src/catalog/modules.json, written by `npm run gen:modules` in web/) names what the site
// draws for a module: icon, hue, area and state. Every value must have a counterpart here, or a module would render
// grey, without a dot or outside every row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { slots } from '../src/slots.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (...p) => readFileSync(path.join(here, '..', 'src', ...p), 'utf8');
const catalog = JSON.parse(src('catalog', 'modules.json'));
const icon = src('components', 'Icon.astro');
const identity = src('styles', 'identity.css');
const entry = (text, key) => new RegExp(`^  ${key}: '`, 'm').test(text);
const areaIds = catalog.areas.map((a) => a.id);

test('the catalogue carries identity, area and state for every module', () => {
  assert.ok(catalog.modules.length > 10);
  for (const m of catalog.modules) {
    for (const k of ['icon', 'hue', 'area', 'status']) assert.equal(typeof m[k], 'string', `${m.id}: ${k}`);
    assert.ok(areaIds.includes(m.area), `${m.id}: area "${m.area}" is not in the catalogue's areas`);
    assert.ok(['default', 'optional', 'preview'].includes(m.status), `${m.id}: status "${m.status}"`);
  }
});

test('every module icon is drawn by Icon.astro', () => {
  for (const m of catalog.modules) assert.ok(entry(icon, m.icon), `${m.id}: icon "${m.icon}" missing in Icon.astro`);
});

test('every hue of the catalogue maps to --module-color (identity.css)', () => {
  for (const m of catalog.modules) assert.ok(identity.includes(`[data-hue='${m.hue}']`), `${m.id}: hue "${m.hue}"`);
});

// The site's texts must cover what the catalogue may bring, in both languages the site builds (es/fr/pt are frozen,
// docs/i18n/FROZEN.md). Node strips the types of the locale files (plain `as const` objects without imports).
const LOCALES = ['de', 'en'];
const strings = async (l) => Object.values(await import(`../src/i18n/${l}.ts`))[0];

test('every catalogue area has a subtitle and every platform limit a label in German and English', async () => {
  for (const l of LOCALES) {
    const s = await strings(l);
    for (const a of catalog.areas) assert.equal(typeof s.modules.areas[a.id], 'string', `${l}: area "${a.id}"`);
    for (const m of catalog.modules) if (m.platforms) assert.equal(typeof s.modules.only[m.platforms], 'string', `${l}: platforms "${m.platforms}"`);
  }
});

// Picture slots (src/slots.js, docs/design/site/SLOTS.md): every slot has a ratio the stylesheet knows, capture sizes
// of that ratio, and either no picture at all or all four (desk and phone, light and dark).
test('every picture slot has a known ratio, matching capture sizes and none or all of its pictures', () => {
  const css = src('styles', 'global.css');
  const ratio = (r) => r.split('x').map(Number).reduce((w, h) => w / h);
  for (const [name, def] of Object.entries(slots)) {
    assert.ok(css.includes(`.ratio-${def.ratio} .slot-art`), `${name}: ratio ${def.ratio} has no rule in global.css`);
    assert.ok(css.includes(`.ratio-sm-${def.ratioPhone} .slot-art`), `${name}: phone ratio ${def.ratioPhone} has no rule in global.css`);
    assert.ok(Math.abs(def.desk[0] / def.desk[1] - ratio(def.ratio)) < 0.01, `${name}: desk capture is not ${def.ratio}`);
    assert.ok(Math.abs(def.phone[0] / def.phone[1] - ratio(def.ratioPhone)) < 0.01, `${name}: phone capture is not ${def.ratioPhone}`);
    assert.match(def.app.path, /^\//, `${name}: app path`);
    const files = ['desk', 'phone'].flatMap((k) => ['light', 'dark'].map((t) => path.join(here, '..', 'src', 'assets', 'slots', `${name}-${k}-${t}.png`)));
    const found = files.filter((f) => existsSync(f)).length;
    assert.ok(found === 0 || found === 4, `${name}: ${found} of 4 pictures in src/assets/slots`);
  }
});

// The module lists say nothing about modules that are not finished: the components read the catalogue only through
// shipped.ts, which drops preview modules. (Texts in i18n are not scanned; they are reviewed by hand.)
test('module lists read the catalogue through shipped.ts, which drops preview modules', () => {
  const shipped = src('catalog', 'shipped.ts');
  assert.match(shipped, /status !== 'preview'/, 'shipped.ts filters preview modules');
  for (const file of ['Home.astro', 'ModulesPage.astro']) assert.ok(!/from '\.\.\/catalog\/modules\.json'/.test(src('components', file)), `${file} reads the catalogue through shipped.ts`);
});
