#!/usr/bin/env node
/**
 * `npm run check:legal`: lists legal placeholders that are still open (`[[NAME]]` in core/legal/identity.ts,
 * `[PLATZHALTER: …]` in the website's legal pages). Warns only (exit 0, GitHub `::warning::` annotation) so
 * development and previews are never blocked. `--strict` exits 1: meant for the release workflow, see
 * docs/legal/LAUNCH-LEGAL-CHECKLIST.md (proposal, not wired in there on purpose).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOpenPlaceholders } from './lib/legalPlaceholders.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = [
  'web/src/core/legal/identity.ts',
  'site/src/pages/impressum.astro',
  'site/src/pages/datenschutz.astro',
  'site/src/pages/en/imprint.astro',
  'site/src/pages/en/privacy.astro',
];
const hits = FILES.flatMap((f) => findOpenPlaceholders(f, readFileSync(join(root, f), 'utf8')));
const strict = process.argv.includes('--strict');
for (const h of hits) {
  console.log(
    `${process.env.GITHUB_ACTIONS ? '::warning file=' + h.file + ',line=' + h.line + '::' : ''}open legal placeholder ${h.text} (${h.file}:${h.line})`,
  );
}
console.log(`check:legal: ${hits.length} open placeholder(s)`);
if (strict && hits.length > 0) process.exit(1);
