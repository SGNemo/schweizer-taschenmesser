#!/usr/bin/env node
/**
 * `npm run check:modules`: every module manifest must be complete (widget, layout, platforms, a valid
 * settings category).
 * A missing widget is an error, not a warning. Runs in CI before the tests.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  checkDeleteSource,
  checkMaturity,
  checkRowSource,
  checkAutomationSource,
  checkModule,
  checkSettingsFieldMeta,
  checkSettingsSource,
  checkWidgetSource,
} from './lib/checkModules.ts';
import { checkIdentity, checkSignatureUse, identityFacts } from './lib/checkIdentity.ts';
import { validateAiActions } from '../src/core/modules/aiActions.ts';
import {
  MODULE_FIELD_GROUPS,
  SETTINGS_CATEGORY_IDS,
  SETTINGS_LEVELS,
} from '../src/core/settings/registry/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = join(root, 'src', 'modules');
const toolsDir = join(root, 'src', 'tools');
const errors = [];
const warnings = [];
const identities = [];
let count = 0;
let toolCount = 0;

for (const id of readdirSync(modulesDir).sort()) {
  const dir = join(modulesDir, id);
  const manifestPath = join(dir, 'manifest.ts');
  if (!statSync(dir).isDirectory() || !existsSync(manifestPath)) continue;
  count++;
  const manifest = readFileSync(manifestPath, 'utf8');
  const fileExists = (rel) => existsSync(join(dir, rel));
  errors.push(...checkModule({ id, manifest, fileExists }));
  identities.push(identityFacts(id, manifest));
  // A module that says `signature: 'none'` but fills its head itself most likely forgot to name it (warning).
  const pageSources = ['routes', 'components']
    .map((sub) => join(dir, sub))
    .filter(existsSync)
    .flatMap((d) =>
      readdirSync(d)
        .filter((n) => /\.tsx$/.test(n) && !/\.test\./.test(n))
        .map((n) => readFileSync(join(d, n), 'utf8')),
    );
  warnings.push(...checkSignatureUse(id, manifest, pageSources));
  const settingsPath = join(dir, 'settings.ts');
  const settingsSource = existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : manifest;
  errors.push(...checkSettingsSource(id, settingsSource, SETTINGS_CATEGORY_IDS));
  errors.push(...checkSettingsFieldMeta(id, settingsSource, MODULE_FIELD_GROUPS, SETTINGS_LEVELS));
  // `aiSchema.actions` is optional; when a module has them they must be complete.
  const aiPath = join(dir, 'ai.ts');
  if (existsSync(aiPath) && /\bactions:\s*\{/.test(readFileSync(aiPath, 'utf8'))) {
    const { aiSchema } = await import(pathToFileURL(aiPath).href);
    errors.push(...validateAiActions(aiSchema).map((e) => `${id}: ${e}`));
  }
  // `automation` (rules): the file exists and its `actions` agree with `ai.ts` (the full check runs in
  // `core/automation/modules.test.ts`, because the file imports repos that plain node cannot load).
  if (/\bautomation:\s*\(\)\s*=>\s*import\(/.test(manifest)) {
    const autoPath = join(dir, 'automation.ts');
    if (!existsSync(autoPath))
      errors.push(`${id}: manifest.automation points to a missing automation.ts`);
    else
      errors.push(
        ...checkAutomationSource(
          id,
          readFileSync(autoPath, 'utf8'),
          existsSync(aiPath) ? readFileSync(aiPath, 'utf8') : undefined,
        ),
      );
  }
  for (const m of manifest.matchAll(/import\(\s*['"]\.\/(widgets\/[^'"]+)['"]\s*\)/g)) {
    const file = ['.tsx', '.ts'].map((e) => join(dir, m[1] + e)).find(existsSync);
    if (file) errors.push(...checkWidgetSource(id, m[1], readFileSync(file, 'utf8')));
  }
}

// Identity v3.1: one hue per module and area, neighbours differ in head variant, no app-wide hue + head + widget twins.
errors.push(...checkIdentity(identities));

// Tools: every manifest names its maturity (docs/howto/new-extension.md).
for (const id of readdirSync(toolsDir).sort()) {
  const manifestPath = join(toolsDir, id, 'manifest.ts');
  if (!statSync(join(toolsDir, id)).isDirectory() || !existsSync(manifestPath)) continue;
  toolCount++;
  errors.push(...checkMaturity(`tool ${id}`, readFileSync(manifestPath, 'utf8')));
}

// Comfort contract (docs/product/comfort): deletes in module screens are undoable, list rows use ItemRow.
for (const id of readdirSync(modulesDir).sort()) {
  if (id === 'disk' || id === 'example') continue; // disk has its own, stricter delete flow
  for (const sub of ['components', 'routes']) {
    const dir = join(modulesDir, id, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n) && !/\.test\./.test(n))) {
      const src = readFileSync(join(dir, f), 'utf8');
      errors.push(...checkDeleteSource(id, `${sub}/${f}`, src));
      if (sub === 'routes') errors.push(...checkRowSource(id, `${sub}/${f}`, src));
    }
  }
}

if (warnings.length > 0)
  console.warn(`check:modules: ${warnings.length} warning(s):\n- ${warnings.join('\n- ')}`);
if (errors.length > 0) {
  console.error(`check:modules found ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`check:modules: ${count} modules and ${toolCount} tools complete.`);
