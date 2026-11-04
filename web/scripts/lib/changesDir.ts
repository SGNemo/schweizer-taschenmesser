/** Reads `.changes/` (shared by the release script, the check, the build and the tests). */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseChangeFile, type ChangeEntry } from './changes.ts';

/** Files that live in `.changes/` but are not notes. */
export const IGNORED = new Set(['README.md', '.gitkeep']);

export interface LoadedChanges {
  entries: ChangeEntry[];
  files: string[];
  errors: string[];
}

export function loadChanges(dir: string): LoadedChanges {
  const result: LoadedChanges = { entries: [], files: [], errors: [] };
  if (!existsSync(dir)) return result;
  for (const name of readdirSync(dir).sort()) {
    if (IGNORED.has(name) || !name.endsWith('.md')) continue;
    const parsed = parseChangeFile(readFileSync(join(dir, name), 'utf8'), name);
    result.files.push(name);
    result.entries.push(...parsed.entries);
    result.errors.push(...parsed.errors);
  }
  return result;
}
