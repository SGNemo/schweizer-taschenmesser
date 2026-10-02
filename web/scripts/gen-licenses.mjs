#!/usr/bin/env node
/**
 * `npm run gen:licenses`: writes `src/core/about/licenses.json` (name, version, licence, link of every
 * production dependency of `web/package.json`) for the list in Settings → Über Nemo. Run it after
 * changing dependencies; `src/core/about/licenses.test.ts` fails while the file is out of date.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLicenses } from './lib/aboutData.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const read = (name) => {
  try {
    return JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
};
const entries = collectLicenses(Object.keys(pkg.dependencies ?? {}), read);
writeFileSync(
  join(root, 'src', 'core', 'about', 'licenses.json'),
  JSON.stringify(entries, null, 2) + '\n',
);
console.log(`gen:licenses: ${entries.length} packages`);
