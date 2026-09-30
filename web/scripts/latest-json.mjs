#!/usr/bin/env node
/**
 * Writes the Tauri updater manifest for a release from the signed Windows assets.
 *
 *   node scripts/latest-json.mjs --dir <assets> --version 1.2.0 --tag v1.2.0 \
 *        --repo owner/name --notes <RELEASE_NOTES.md> --out <latest.json>
 *
 * Expects (inside --dir) Taschenmesser-Portable.exe and its signature Taschenmesser-Portable.exe.sig.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildLatestJson } from './lib/latestJson.ts';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc),
      [],
    ),
);
for (const required of ['dir', 'version', 'tag', 'repo', 'out']) {
  if (!args[required]) {
    console.error(`Missing --${required}`);
    process.exit(2);
  }
}

function signed(fileName) {
  const sigPath = join(args.dir, `${fileName}.sig`);
  if (!existsSync(join(args.dir, fileName))) return undefined;
  if (!existsSync(sigPath)) throw new Error(`${fileName} has no signature file (${fileName}.sig)`);
  return { fileName, signature: readFileSync(sigPath, 'utf8') };
}

try {
  const json = buildLatestJson({
    version: args.version,
    tag: args.tag,
    repo: args.repo,
    notes: args.notes && existsSync(args.notes) ? readFileSync(args.notes, 'utf8') : '',
    pubDate: new Date().toISOString(),
    portable: signed('Taschenmesser-Portable.exe'),
  });
  writeFileSync(args.out, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`✓ ${args.out}: ${Object.keys(json.platforms).join(', ')}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
