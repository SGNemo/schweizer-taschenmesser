#!/usr/bin/env node
/**
 * Module generator: `npm run gen:module -- <id> "<Name>"`
 * Copies templates/module → src/modules/<id>, fills placeholders, adds the module's texts to
 * src/strings.ts and every catalog (src/i18n/locales) and refreshes the DB schema snapshot.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [id, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();

if (!id || !name || !/^[a-z][a-z0-9]*$/.test(id)) {
  console.error('Usage: npm run gen:module -- <id> "<Display Name>"');
  console.error('  <id> must be lowercase alphanumeric (e.g. "todos", "notes").');
  process.exit(1);
}

const target = join(root, 'src', 'modules', id);
if (existsSync(target)) {
  console.error(`Module "${id}" already exists at ${target}`);
  process.exit(1);
}

const replacements = [
  ['__ID__', id],
  ['__NAME__', name],
];
const fill = (s) => replacements.reduce((acc, [from, to]) => acc.split(from).join(to), s);

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dst = join(to, fill(entry));
    if (statSync(src).isDirectory()) copyDir(src, dst);
    else writeFileSync(dst, fill(readFileSync(src, 'utf8')));
  }
}

copyDir(join(root, 'templates', 'module'), target);
console.log(`Created src/modules/${id}`);

// UI texts: a German block in strings.ts (before the end of `de`) and a part file per catalog.
const stringsPath = join(root, 'src', 'strings.ts');
const strings = readFileSync(stringsPath, 'utf8');
const end = strings.indexOf('\n} as const;');
if (end < 0) {
  console.error('src/strings.ts: end of the `de` object not found; add the texts by hand.');
  process.exit(1);
}
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const block = `
  ${id}: {
    meta: {
      name: ${q(name)},
      description: ${q(`TODO: Ein Satz, was ${name} macht.`)},
      quickAdd: ${q(`${name}: neuer Eintrag`)},
      showDone: 'Erledigte anzeigen',
    },
    empty: 'Noch keine Einträge.',
    add: 'Eintrag anlegen',
    addPlaceholder: 'Neuer Eintrag …',
  },`;
writeFileSync(stringsPath, strings.slice(0, end) + block + strings.slice(end));
for (const lang of ['en', 'es', 'fr', 'pt-BR']) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'i18n-scaffold.mjs'), lang], {
    stdio: 'inherit',
    cwd: root,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log(`Added the "${id}" texts to src/strings.ts and src/i18n/locales/*/${id}.ts`);

// Refresh the schema snapshot (new tables need a Dexie version bump).
const bump = spawnSync(process.execPath, [join(root, 'scripts', 'db-bump.mjs')], {
  stdio: 'inherit',
  cwd: root,
});
if (bump.status !== 0) process.exit(bump.status ?? 1);

console.log(`
Next steps:
  1. Edit src/modules/${id}/schema.ts (data), ai.ts (AI schema), routes/, widgets/
     (the home-screen widget is mandatory: keep it in manifest.ts, with its empty state + test)
  2. Adjust the texts in src/strings.ts (block "${id}"), then translate src/i18n/locales/*/${id}.ts
     (they start as German copies; npm run check:i18n lists what is left) and the icon in manifest.ts
  3. Enable the module in the Module Library (defaultEnabled: false by default)
  4. npm run check:modules && npm run lint && npm run typecheck && npm test
`);
