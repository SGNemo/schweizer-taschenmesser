import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Windows and macOS resolve paths case-insensitively. Two files in one folder whose names differ only in case
 * once the extension is dropped (`planMark.ts` next to `PlanMark.tsx`) make an import without extension land on
 * the wrong one there, while Linux CI stays green: the Windows build of 2026-11-25 failed that way.
 */
describe('file names', () => {
  it('no two tracked files in one folder differ only in case (extension dropped)', () => {
    const files = execFileSync(
      'git',
      ['ls-files', '-z', '--', 'src', 'e2e', 'scripts', 'src-tauri/src'],
      {
        encoding: 'utf8',
      },
    )
      .split('\0')
      .filter(Boolean);
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const file of files) {
      // `Name.module.css` and `Name.test.tsx` keep their inner dots: only the last extension is dropped.
      const key = file.replace(/\.[^./]+$/, '').toLowerCase();
      const stem = file.replace(/\.[^./]+$/, '');
      const other = seen.get(key);
      if (other !== undefined && other !== stem) clashes.push(`${other} ↔ ${stem}`);
      else seen.set(key, stem);
    }
    expect(clashes).toEqual([]);
  });
});
