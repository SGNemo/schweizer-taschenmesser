#!/usr/bin/env node
/**
 * Prepends download links, the two short install guides and the SHA-256 of every file to the Dev-Preview
 * release notes (publish job of .github/workflows/dev-preview.yml). Reads the files, writes only --out.
 *
 *   node web/scripts/dev-release-body.mjs --dir dl --repo owner/name --tag dev-preview \
 *     --notes dl/DEV_NOTES.md --out notes.md Nemo-Portable-dev.exe Nemo-dev.apk ...
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { devInstallBlock } from './lib/devReleaseBody.ts';

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  if (i < 0 || !args[i + 1]) throw new Error(`Missing --${k}`);
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
try {
  const dir = opt('dir');
  const repo = opt('repo');
  const tag = opt('tag');
  const notes = opt('notes');
  const out = opt('out');
  const files = args.map((name) => ({
    name,
    sha256: createHash('sha256')
      .update(readFileSync(join(dir, name)))
      .digest('hex'),
  }));
  writeFileSync(out, devInstallBlock(repo, tag, files) + readFileSync(notes, 'utf8'));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
