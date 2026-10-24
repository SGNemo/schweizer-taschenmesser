import { describe, expect, it } from 'vitest';
import { diffLines, isTooLong, MAX_CHARS, splitLines, toUnifiedDiff, wordParts } from './logic';

const kinds = (r: ReturnType<typeof diffLines>) => r.rows.map((x) => x.kind[0] + ':' + x.text);

describe('splitLines', () => {
  it('treats empty text as no lines and unifies line breaks', () => {
    expect(splitLines('')).toEqual([]);
    expect(splitLines('a\r\nb\rc')).toEqual(['a', 'b', 'c']);
  });
});

describe('diffLines', () => {
  it('reports identical texts as unchanged', () => {
    const r = diffLines('a\nb', 'a\nb');
    expect(r.changed).toBe(0);
    expect(r.rows.every((x) => x.kind === 'same')).toBe(true);
    expect(toUnifiedDiff(r.rows)).toBe('');
  });

  it('finds added and removed lines with their numbers', () => {
    const r = diffLines('a\nb\nc', 'a\nc\nd');
    expect(kinds(r)).toEqual(['s:a', 'd:b', 's:c', 'a:d']);
    expect(r.rows[1]).toMatchObject({ oldNo: 2 });
    expect(r.rows[3]).toMatchObject({ newNo: 3 });
    expect(r.changed).toBe(2);
  });

  it('counts a rewritten line once and marks the changed words', () => {
    const r = diffLines('the quick fox', 'the slow fox');
    expect(kinds(r)).toEqual(['d:the quick fox', 'a:the slow fox']);
    expect(r.changed).toBe(1);
    expect(r.rows[0]!.parts).toEqual([
      { text: 'the ', changed: false },
      { text: 'quick', changed: true },
      { text: ' fox', changed: false },
    ]);
    expect(r.rows[1]!.parts!.filter((p) => p.changed).map((p) => p.text)).toEqual(['slow']);
  });

  it('handles an empty side', () => {
    expect(kinds(diffLines('', 'x\ny'))).toEqual(['a:x', 'a:y']);
    expect(kinds(diffLines('x', ''))).toEqual(['d:x']);
    expect(diffLines('', '').rows).toEqual([]);
  });

  it('ignores whitespace on request and shows the new text', () => {
    const a = 'a  b\n  c';
    const b = 'a b\nc\nd';
    expect(diffLines(a, b).changed).toBe(3);
    const r = diffLines(a, b, { ignoreWhitespace: true });
    expect(kinds(r)).toEqual(['s:a b', 's:c', 'a:d']);
    expect(r.changed).toBe(1);
  });

  it('finds the least edits (LCS), not just a prefix/suffix cut', () => {
    const r = diffLines('1\n2\n3\n4\n5', '1\n3\n5\n6');
    expect(kinds(r)).toEqual(['s:1', 'd:2', 's:3', 'd:4', 's:5', 'a:6']);
  });

  it('falls back to remove + add, flagged rough, when the table would be huge', () => {
    const a = Array.from({ length: 2500 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 2500 }, (_, i) => `b${i}`).join('\n');
    const r = diffLines(a, b);
    expect(r.rough).toBe(true);
    expect(r.changed).toBe(2500);
    expect(r.rows).toHaveLength(5000);
  });

  it('copes with the largest allowed input without freezing', () => {
    const a = 'x\n'.repeat(MAX_CHARS / 2 - 1);
    const b = 'y\n'.repeat(MAX_CHARS / 2 - 1);
    const t0 = Date.now();
    diffLines(a, b);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe('wordParts', () => {
  it('marks whole line when words differ too much to compare cheaply', () => {
    const a = Array.from({ length: 400 }, (_, i) => `a${i}`).join(' ');
    const b = Array.from({ length: 400 }, (_, i) => `b${i}`).join(' ');
    expect(wordParts(a, b).old).toEqual([{ text: a, changed: true }]);
  });

  it('can ignore whitespace between words', () => {
    const w = wordParts('a  b', 'a b', true);
    expect(w.old.every((p) => !p.changed)).toBe(true);
  });
});

describe('toUnifiedDiff', () => {
  it('writes headers, hunks and context', () => {
    const r = diffLines('a\nb\nc\nd\ne\nf\ng\nh', 'a\nb\nc\nd\nE\nf\ng\nh');
    expect(toUnifiedDiff(r.rows, 1)).toBe(
      ['--- a', '+++ b', '@@ -4,3 +4,3 @@', ' d', '-e', '+E', ' f', ''].join('\n'),
    );
  });

  it('merges hunks that touch and splits distant ones', () => {
    const a = Array.from({ length: 20 }, (_, i) => `l${i}`);
    const b = [...a];
    b[1] = 'X';
    b[18] = 'Y';
    const d = toUnifiedDiff(diffLines(a.join('\n'), b.join('\n')).rows, 3);
    expect(d.match(/^@@/gm)).toHaveLength(2);
    expect(
      toUnifiedDiff(diffLines(a.join('\n'), b.join('\n')).rows, 20).match(/^@@/gm),
    ).toHaveLength(1);
  });

  it('numbers an all-new text from 0', () => {
    expect(toUnifiedDiff(diffLines('', 'x').rows)).toBe('--- a\n+++ b\n@@ -0,0 +1,1 @@\n+x\n');
  });
});

describe('isTooLong', () => {
  it('limits each side', () => {
    expect(isTooLong('a'.repeat(MAX_CHARS), '')).toBe(false);
    expect(isTooLong('', 'a'.repeat(MAX_CHARS + 1))).toBe(true);
  });
});
