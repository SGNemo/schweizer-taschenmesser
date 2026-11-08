import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { candidateDirs, findScribble, readScribble } from './scribbleSources.ts';

const made: string[] = [];
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scribble-'));
  made.push(dir);
  return dir;
}
function write(dir: string, rel: string, text: string): void {
  const file = join(dir, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text);
}
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('scribble sources', () => {
  it('orders the candidates: override, session folder, notes repo', () => {
    expect(candidateDirs({ NEMO_SCRIBBLE_DIR: '/x' })).toEqual([
      '/x',
      '/workspace/scribble',
      '/workspace/nemo-scribble',
    ]);
    expect(candidateDirs({})).toEqual(['/workspace/scribble', '/workspace/nemo-scribble']);
  });

  it('reads board entries (only open ones) and notes', () => {
    const dir = temp();
    write(dir, 'board/2026-11-08-docs-a.md', '- [ ] heads-up: touching policy.ts\n\nmore text\n');
    write(dir, 'board/2026-11-08-docs-b.md', '- [x] answered\n');
    write(dir, 'notes/devops-ci.md', 'for the next chat: cache key changed\nbody\n');
    write(dir, 'README.md', '# readme\n');
    const source = readScribble(dir)!;
    expect(source.open).toEqual([
      { file: 'board/2026-11-08-docs-a.md', text: '- [ ] heads-up: touching policy.ts' },
    ]);
    expect(source.notes).toEqual([
      { file: 'notes/devops-ci.md', text: 'for the next chat: cache key changed' },
    ]);
  });

  it('skips an empty folder and falls through to the next candidate', () => {
    const empty = temp();
    expect(readScribble(empty)).toBeUndefined();
    const override = temp();
    write(override, 'board/2026-11-08-x-y.md', '- [ ] from the override\n');
    expect(findScribble({ NEMO_SCRIBBLE_DIR: empty })?.dir).not.toBe(empty);
    expect(findScribble({ NEMO_SCRIBBLE_DIR: override })?.dir).toBe(override);
  });
});
