import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { candidateDirs, clean, findScribble, readScribble } from './scribbleSources.ts';

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

  describe('hostile content', () => {
    it('does not follow a symlink to a file (a note must not print another file)', () => {
      const dir = temp();
      const secret = join(temp(), 'secret.txt');
      writeFileSync(secret, '- [ ] SECRET FIRST LINE\n');
      mkdirSync(join(dir, 'board'));
      mkdirSync(join(dir, 'notes'));
      symlinkSync(secret, join(dir, 'board/2026-11-08-evil-a.md'));
      symlinkSync(secret, join(dir, 'notes/evil.md'));
      write(dir, 'notes/good.md', 'fine\n');
      const source = readScribble(dir)!;
      expect(source.open).toEqual([]);
      expect(source.notes.map((n) => n.file)).toEqual(['notes/good.md']);
    });

    it('does not follow a symlink to a directory', () => {
      const dir = temp();
      const target = temp();
      write(target, 'x.md', '- [ ] from the target\n');
      symlinkSync(target, join(dir, 'board'));
      expect(readScribble(dir)).toBeUndefined();
      const inner = temp();
      mkdirSync(join(inner, 'notes'));
      symlinkSync(target, join(inner, 'board'));
      expect(readScribble(inner)?.open).toEqual([]);
    });

    it('skips devices and FIFOs without hanging', () => {
      const dir = temp();
      mkdirSync(join(dir, 'notes'));
      symlinkSync('/dev/zero', join(dir, 'notes/zero.md'));
      execFileSync('mkfifo', [join(dir, 'notes/pipe.md')]);
      write(dir, 'notes/real.md', 'real\n');
      expect(readScribble(dir)!.notes.map((n) => n.file)).toEqual(['notes/real.md']);
    });

    it('reads only the head of a huge file and caps the printed length', () => {
      const dir = temp();
      write(dir, 'board/2026-11-08-big-a.md', `- [ ] ${'x'.repeat(50 * 1024 * 1024)}`);
      write(dir, 'notes/big.md', 'y'.repeat(50 * 1024 * 1024));
      const source = readScribble(dir)!;
      expect(source.open[0]!.text.length).toBeLessThanOrEqual(201);
      expect(source.open[0]!.text.endsWith('…')).toBe(true);
      expect(source.notes[0]!.text.length).toBeLessThanOrEqual(101);
    });

    it('replaces control characters in notes and file names', () => {
      const dir = temp();
      write(dir, 'board/2026-11-08-a-b.md', '- [ ] hi\x1b]0;pwned\x07\x1b[2K\rspoof \u202e\n');
      write(dir, 'notes/e\x1b[31mvil.md', 'a\x9b2J b\n');
      const source = readScribble(dir)!;
      const printed = [source.open[0]!.text, source.notes[0]!.file, source.notes[0]!.text].join(
        '|',
      );
      // eslint-disable-next-line no-control-regex
      expect(printed).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u202e]/);
      expect(clean('a\nb\tc')).toBe('a b c');
    });
  });
});
