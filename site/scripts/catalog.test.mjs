// The module catalogue (src/catalog/modules.json, written by `npm run gen:modules` in web/) names what the site
// draws for a module: icon, hue, area and state. Every value must have a counterpart here, or a module would render
// grey, without a dot or outside every row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { scenes } from '../src/catalog/scenes.js';

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
    for (const a of catalog.areas) assert.equal(typeof s.features.areas[a.id], 'string', `${l}: area "${a.id}"`);
    for (const m of catalog.modules) if (m.platforms) assert.equal(typeof s.features.modules.only[m.platforms], 'string', `${l}: platforms "${m.platforms}"`);
  }
});

test('every scene names catalogue areas and a visible module, and has its text and its pictures', async () => {
  assert.ok(scenes.length >= 3);
  for (const sc of scenes) {
    for (const id of sc.areas) assert.ok(areaIds.includes(id), `scene ${sc.shot}: area "${id}"`);
    const mod = catalog.modules.find((m) => m.id === sc.module);
    assert.ok(mod, `scene ${sc.shot}: module "${sc.module}" is not in the catalogue`);
    assert.notEqual(mod.status, 'preview', `scene ${sc.shot}: a preview module is hidden in the app`);
    for (const l of LOCALES) {
      const text = (await strings(l)).features.scenes[sc.areas[0]];
      assert.equal(typeof text?.text, 'string', `${l}: scene text "${sc.areas[0]}"`);
      assert.equal(typeof text?.alt, 'string', `${l}: scene alt "${sc.areas[0]}"`);
    }
    for (const name of [sc.shot, `${sc.shot}-phone`]) {
      for (const scheme of ['dark', 'light']) assert.ok(existsSync(path.join(here, '..', 'src', 'assets', 'screens', `${name}-${scheme}.png`)), `${name}-${scheme}.png missing (npm run app:screenshots)`);
    }
  }
});
