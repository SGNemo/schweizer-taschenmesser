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
  it('orders the candidates: override, session folder, notes repo, legacy folder', () => {
    expect(candidateDirs('/repo', { NEMO_SCRIBBLE_DIR: '/x' })).toEqual([
      '/x',
      '/workspace/scribble',
      '/workspace/nemo-scribble',
      '/repo/scribble',
    ]);
    expect(candidateDirs('/repo', {})).toEqual([
      '/workspace/scribble',
      '/workspace/nemo-scribble',
      '/repo/scribble',
    ]);
  });

  it('reads board entries (only open ones) and notes in the board layout', () => {
    const dir = temp();
    write(dir, 'board/2026-11-08-docs-a.md', '- [ ] heads-up: touching policy.ts\n\nmore text\n');
    write(dir, 'board/2026-11-08-docs-b.md', '- [x] answered\n');
    write(dir, 'notes/devops-ci.md', 'for the next chat: cache key changed\nbody\n');
    write(dir, 'README.md', '# readme\n');
    const source = readScribble(dir)!;
    expect(source.layout).toBe('board');
    expect(source.open).toEqual([
      { file: 'board/2026-11-08-docs-a.md', text: '- [ ] heads-up: touching policy.ts' },
    ]);
    expect(source.notes).toEqual([
      { file: 'notes/devops-ci.md', text: 'for the next chat: cache key changed' },
    ]);
  });

  it('still reads the legacy BOARD.md format', () => {
    const dir = temp();
    write(dir, 'BOARD.md', '# Board\n- [ ] open one\n- [x] done\n- [ ] open two\n');
    write(dir, 'feat-x.md', 'note on feat-x\n');
    write(dir, 'README.md', '# readme\n');
    const source = readScribble(dir)!;
    expect(source.layout).toBe('legacy');
    expect(source.open.map((i) => i.text)).toEqual(['- [ ] open one', '- [ ] open two']);
    expect(source.notes).toEqual([{ file: 'feat-x.md', text: 'note on feat-x' }]);
  });

  it('skips an empty folder and falls through to the next candidate', () => {
    const root = temp();
    const empty = join(root, 'session');
    mkdirSync(empty);
    const repo = join(root, 'repo');
    write(repo, 'scribble/BOARD.md', '- [ ] legacy item\n');
    expect(readScribble(empty)).toBeUndefined();
    const source = findScribble(repo, { NEMO_SCRIBBLE_DIR: empty });
    expect(source?.dir).toBe(join(repo, 'scribble'));
  });

  it('prefers the override over everything else', () => {
    const override = temp();
    write(override, 'board/2026-11-08-x-y.md', '- [ ] from the override\n');
    const repo = temp();
    write(repo, 'scribble/BOARD.md', '- [ ] legacy\n');
    const source = findScribble(repo, { NEMO_SCRIBBLE_DIR: override });
    expect(source?.dir).toBe(override);
    expect(source?.open[0]?.text).toBe('- [ ] from the override');
  });

  it('finds nothing when no candidate holds notes', () => {
    const repo = temp();
    // The fixed /workspace folders are not touched: only assert on a repo without a scribble folder when the
    // session folders are absent in this environment.
    const source = findScribble(repo, {});
    if (source) expect(['/workspace/scribble', '/workspace/nemo-scribble']).toContain(source.dir);
    else expect(source).toBeUndefined();
  });
});
