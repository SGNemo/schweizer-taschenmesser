import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Section components must stay out of the start bundle (see docs/decisions/ui-shell.md, 2026-11-03). */
describe('settings section chunks', () => {
  it('the registry imports section components only through sectionChunks (Sync and Backup excepted)', () => {
    const src = readFileSync(new URL('./sections.tsx', import.meta.url), 'utf8');
    const direct = [...src.matchAll(/from '\.\/(\w+)'/g)]
      .map((m) => m[1])
      .filter((f): f is string => f !== undefined && f !== 'sectionChunks');
    expect(direct.sort()).toEqual(['BackupSection', 'SyncSection']);
  });
});
