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
