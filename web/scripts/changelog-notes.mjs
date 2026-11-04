#!/usr/bin/env node
/**
 * GitHub release notes from the changelog files: German section above, English below.
 *
 *   node scripts/changelog-notes.mjs <x.y.z> [--out file]
 *
 * Fails when a section is missing: the release commit must contain `npm run changelog:release`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSection } from './lib/changelogRelease.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const version = argv.find((a) => !a.startsWith('--'))?.replace(/^v/, '');
if (!version) {
  console.error('Usage: changelog-notes.mjs <x.y.z> [--out file]');
  process.exit(2);
}
const section = (file) => extractSection(readFileSync(join(root, file), 'utf8'), version);
const de = section('CHANGELOG.de.md');
const en = section('CHANGELOG.md');
if (!de || !en) {
  console.error(
    `No "## [${version}]" section in ${!de ? 'CHANGELOG.de.md ' : ''}${!en ? 'CHANGELOG.md' : ''}. Run "npm run changelog:release -- ${version}" in web/ and commit the result before releasing (docs/howto/changelog.md).`,
  );
  process.exit(1);
}
const notes = `${de}\n\n---\n\n${en}\n`;
const out = argv.indexOf('--out');
if (out !== -1) writeFileSync(argv[out + 1], notes);
else process.stdout.write(notes);
