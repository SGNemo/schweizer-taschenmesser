#!/usr/bin/env node
/**
 * `npm run check:tools`: every tool manifest carries category, identity (palette v3 hue, signature)
 * and keywords in all five catalogs; neighbours in the list differ in hue. Runs in CI with check:modules.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkToolKeywords,
  checkToolManifest,
  checkToolNeighbours,
  toolFacts,
} from './lib/checkTools.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = join(root, 'src', 'tools');
const catalogs = {
  de: join(root, 'src', 'strings.ts'),
  en: join(root, 'src', 'i18n', 'locales', 'en', 'tools.ts'),
  es: join(root, 'src', 'i18n', 'locales', 'es', 'tools.ts'),
  fr: join(root, 'src', 'i18n', 'locales', 'fr', 'tools.ts'),
  'pt-BR': join(root, 'src', 'i18n', 'locales', 'pt-BR', 'tools.ts'),
};
const texts = Object.fromEntries(
  Object.entries(catalogs).map(([lang, file]) => [lang, readFileSync(file, 'utf8')]),
);

const errors = [];
const facts = [];
for (const id of readdirSync(toolsDir).sort()) {
  const manifestPath = join(toolsDir, id, 'manifest.ts');
  if (!statSync(join(toolsDir, id)).isDirectory() || !existsSync(manifestPath)) continue;
  const src = readFileSync(manifestPath, 'utf8');
  facts.push(toolFacts(id, src));
  errors.push(...checkToolManifest(id, src));
  for (const [lang, text] of Object.entries(texts))
    errors.push(...checkToolKeywords(id, lang, text));
}
errors.push(...checkToolNeighbours(facts));

if (errors.length > 0) {
  console.error(`check:tools found ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`check:tools: ${facts.length} tools complete.`);
