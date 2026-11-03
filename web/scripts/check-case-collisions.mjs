#!/usr/bin/env node
/**
 * `npm run check:case`: fails when two tracked paths differ only in letter case (they would collide on
 * Windows and macOS, see PR #369). Reads `git ls-files`; exit 1 with the colliding spellings.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCaseCollisions } from './lib/caseCollisions.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const files = execFileSync('git', ['-C', root, 'ls-files', '-z'], { maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const groups = findCaseCollisions(files);
if (groups.length > 0) {
  for (const g of groups) console.error(`Paths that differ only in case: ${g.join('  <->  ')}`);
  process.exit(1);
}
console.log(`check:case: ${files.length} tracked paths, no case-only collisions.`);
