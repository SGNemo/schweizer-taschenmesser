#!/usr/bin/env node
/**
 * Release step: builds the changelog from `.changes/`.
 *
 *   node scripts/changelog-release.mjs <x.y.z> [--date YYYY-MM-DD] [--dry]
 *
 * Writes the section into CHANGELOG.md (English) and CHANGELOG.de.md, adds the version to
 * src/generated/changelog.json, deletes the processed notes. Pre-releases (-beta.N) change nothing:
 * the notes stay for the final version. Prints the GitHub release notes with `--notes`.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPrerelease, parseSemver } from '../src/core/update/semver.ts';
import { loadChanges } from './lib/changesDir.ts';
import { insertSection, renderSection, upsertVersion } from './lib/changelogRelease.ts';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(web, '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => argv[argv.indexOf(`--${n}`) + 1];
const version = argv.find((a) => !a.startsWith('--') && a !== opt('date'))?.replace(/^v/, '');

if (flag('unreleased')) {
  // Dev-Preview release text: the open notes, German above, English below. Deletes nothing.
  const open = loadChanges(join(root, '.changes'));
  if (open.errors.length) {
    console.error(open.errors.join('\n'));
    process.exit(1);
  }
  const head = (lang) =>
    renderSection({ version: 'Unreleased', date: '', entries: open.entries }, lang).replace(
      /^## \[Unreleased\] – \n/,
      '## Unreleased\n',
    );
  process.stdout.write(
    open.entries.length ? `${head('de')}\n---\n\n${head('en')}` : 'No open change notes.\n',
  );
  process.exit(0);
}
if (!version || !parseSemver(version)) {
  console.error('Usage: changelog-release.mjs <x.y.z> [--date YYYY-MM-DD] [--dry] [--notes]');
  process.exit(2);
}
const date = opt('date') ?? new Date().toISOString().slice(0, 10);
const dir = join(root, '.changes');
const jsonPath = join(web, 'src/generated/changelog.json');
const loaded = loadChanges(dir);
if (loaded.errors.length) {
  console.error(loaded.errors.join('\n'));
  process.exit(1);
}
if (isPrerelease(version)) {
  console.log(
    `${version} is a pre-release: .changes/ stays untouched (${loaded.files.length} notes).`,
  );
  process.exit(0);
}
if (loaded.entries.length === 0) {
  console.error(
    '.changes/ has no notes: nothing to release. Add notes or write the section by hand.',
  );
  process.exit(1);
}
const v = { version, date, entries: loaded.entries };
const read = (p, fallback) => (existsSync(p) ? readFileSync(p, 'utf8') : fallback);

if (flag('notes')) {
  // GitHub release notes: German first, English below.
  process.stdout.write(`${renderSection(v, 'de')}\n---\n\n${renderSection(v, 'en')}`);
  process.exit(0);
}
const header = (lang) =>
  `# ${lang === 'de' ? 'Änderungsprotokoll' : 'Changelog'}\n\n${
    lang === 'de'
      ? 'Aus den Änderungsnotizen (`.changes/`) beim Release erzeugt; englische Fassung: [CHANGELOG.md](CHANGELOG.md).'
      : 'Generated from the change notes (`.changes/`) at release time; German version: [CHANGELOG.de.md](CHANGELOG.de.md).'
  }\n`;
const out = [
  [join(root, 'CHANGELOG.md'), 'en'],
  [join(root, 'CHANGELOG.de.md'), 'de'],
].map(([path, lang]) => [
  path,
  insertSection(read(path, header(lang)), renderSection(v, lang), version),
]);
const data = upsertVersion(JSON.parse(read(jsonPath, '{"areas":{},"versions":[]}')), v);

if (flag('dry')) {
  console.log(renderSection(v, 'en'));
  process.exit(0);
}
for (const [path, text] of out) writeFileSync(path, text);
writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
for (const f of loaded.files) rmSync(join(dir, f));
console.log(
  `Changelog ${version}: ${loaded.entries.length} entries from ${loaded.files.length} notes.`,
);
