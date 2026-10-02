#!/usr/bin/env node
/**
 * `npm run check:modules`: every module manifest must be complete (widget, layout, platforms, a valid
 * settings category).
 * A missing widget is an error, not a warning. Runs in CI before the tests.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkModule, checkSettingsSource, checkWidgetSource } from './lib/checkModules.ts';
import { SETTINGS_CATEGORY_IDS } from '../src/core/settings/registry/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = join(root, 'src', 'modules');
const errors = [];
let count = 0;

for (const id of readdirSync(modulesDir).sort()) {
  const dir = join(modulesDir, id);
  const manifestPath = join(dir, 'manifest.ts');
  if (!statSync(dir).isDirectory() || !existsSync(manifestPath)) continue;
  count++;
  const manifest = readFileSync(manifestPath, 'utf8');
  const fileExists = (rel) => existsSync(join(dir, rel));
  errors.push(...checkModule({ id, manifest, fileExists }));
  const settingsPath = join(dir, 'settings.ts');
  const settingsSource = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : manifest;
  errors.push(...checkSettingsSource(id, settingsSource, SETTINGS_CATEGORY_IDS));
  for (const m of manifest.matchAll(/import\(\s*['"]\.\/(widgets\/[^'"]+)['"]\s*\)/g)) {
    const file = ['.tsx', '.ts'].map((e) => join(dir, m[1] + e)).find(existsSync);
    if (file) errors.push(...checkWidgetSource(id, m[1], readFileSync(file, 'utf8')));
  }
}

if (errors.length > 0) {
  console.error(`check:modules found ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`check:modules: ${count} modules complete.`);
