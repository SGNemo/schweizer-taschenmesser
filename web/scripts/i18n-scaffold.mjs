#!/usr/bin/env node
/**
 * `npm run i18n:scaffold -- <lang>`: lays out a catalog for <lang> in `src/i18n/locales/<lang>/`.
 *
 * The German source (`src/strings.ts`, object `de`) is split by its top-level keys: one file per
 * area (`settings.ts`, `todos.ts`, …) plus an `index.ts` that assembles them. A part file that
 * already exists is never touched, so the script is also how a catalog picks up a whole new area
 * that someone added to `strings.ts`: run it, then translate the new file (it starts as German).
 * Single new keys inside an existing area are added by hand; `npm run check:i18n` names them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Helpers from core/i18n/format that catalog functions may call. */
const HELPERS = ['formatNumber', 'plural'];
const LANGS = { en: 'en', es: 'es', fr: 'fr', 'pt-BR': 'ptBR', 'en-XA': 'enXA' };

const lang = process.argv[2];
if (!lang || !(lang in LANGS)) {
  console.error(`usage: npm run i18n:scaffold -- <${Object.keys(LANGS).join('|')}>`);
  process.exit(1);
}

/** Top-level entries of the `de` object as [key, source text of the value]. */
export function splitSource(src) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.startsWith('export const de = {'));
  const end = lines.findIndex((l, i) => i > start && l.startsWith('} as const;'));
  if (start < 0 || end < 0)
    throw new Error('src/strings.ts: `export const de = {` … `} as const;` not found');
  const entries = [];
  for (let i = start + 1; i < end; i++) {
    // Doc comments between top-level areas belong to the source only.
    if (/^ {2}(\/\*\*.*\*\/|\/\/.*)$/.test(lines[i])) continue;
    const m = /^ {2}(['"]?[\w-]+['"]?): (.*)$/.exec(lines[i]);
    if (!m) {
      if (entries.length) entries.at(-1).lines.push(lines[i]);
      continue;
    }
    entries.push({ key: m[1].replace(/['"]/g, ''), lines: [m[2]] });
  }
  return entries.map(({ key, lines: body }) => {
    const text = body
      .map((l, idx) => (idx === 0 ? l : l.replace(/^ {2}/, '')))
      .join('\n')
      .replace(/,\s*$/, '');
    return [key, text];
  });
}

const src = readFileSync(join(root, 'src', 'strings.ts'), 'utf8');
const entries = splitSource(src);
const dir = join(root, 'src', 'i18n', 'locales', lang);
mkdirSync(dir, { recursive: true });

const isObject = (text) => text.startsWith('{');
const ident = (key) => (/^[a-zA-Z_$][\w$]*$/.test(key) ? key : null);

let created = 0;
const fields = [];
const imports = [];
for (const [key, text] of entries) {
  const name = ident(key);
  if (!name || !isObject(text)) {
    // Single values (e.g. `appName`) stay inline in index.ts; keep a translated value if present.
    const indexPath = join(dir, 'index.ts');
    const previous = existsSync(indexPath)
      ? new RegExp(`^ {2}${key}: (.*),$`, 'm').exec(readFileSync(indexPath, 'utf8'))?.[1]
      : undefined;
    fields.push(`  ${name ?? `'${key}'`}: ${previous ?? text},`);
    continue;
  }
  imports.push(`import { ${name} } from './${name}';`);
  fields.push(`  ${name},`);
  const file = join(dir, `${name}.ts`);
  if (existsSync(file)) continue;
  // Formatting helpers the source uses inside text functions come along.
  const helpers = HELPERS.filter((h) => new RegExp(`\\b${h}\\(`).test(text));
  const helperImport = helpers.length
    ? `import { ${helpers.join(', ')} } from '@/core/i18n/format';\n`
    : '';
  writeFileSync(
    file,
    `${helperImport}import type { Strings } from '@/strings';\n\nexport const ${name}: Strings['${key}'] = ${text};\n`,
  );
  created++;
}

writeFileSync(
  join(dir, 'index.ts'),
  `/* Assembled by \`npm run i18n:scaffold -- ${lang}\`; the texts live in the part files. */\n` +
    `import type { Strings } from '@/strings';\n${imports.join('\n')}\n\n` +
    `export const ${LANGS[lang]}: Strings = {\n${fields.join('\n')}\n};\n`,
);
console.log(
  `i18n:scaffold ${lang}: ${entries.length} areas, ${created} new part file(s) in src/i18n/locales/${lang}/`,
);
