import { describe, expect, it } from 'vitest';
import { groupNames, normalizeFlags, runRegex, toSegments, MAX_MATCHES } from './logic';

const ok = (r: ReturnType<typeof runRegex>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('normalizeFlags', () => {
  it('orders, dedupes and drops unknown letters', () => {
    expect(normalizeFlags(['u', 'g', 'g', 'x', 'i'])).toBe('giu');
  });
});

describe('groupNames', () => {
  it('numbers capture groups and finds the named ones', () => {
    expect(groupNames('(a)(?<year>\\d+)(?:x)(?=y)(b)')).toEqual([undefined, 'year', undefined]);
  });
  it('ignores brackets in classes and escaped ones', () => {
    expect(groupNames('[(]\\((a)')).toEqual([undefined]);
  });
});

describe('runRegex', () => {
  it('finds all matches with positions when g is set', () => {
    const r = ok(runRegex({ pattern: '\\d+', flags: 'g', text: 'a1 b22 c333' }));
    expect(r.hits.map((h) => [h.text, h.index, h.end])).toEqual([
      ['1', 1, 2],
      ['22', 4, 6],
      ['333', 8, 11],
    ]);
  });

  it('finds only the first match without g', () => {
    const r = ok(runRegex({ pattern: '\\d+', flags: '', text: '1 2 3' }));
    expect(r.hits).toHaveLength(1);
  });

  it('reports numbered and named groups, and groups that did not take part', () => {
    const r = ok(runRegex({ pattern: '(?<y>\\d{4})-(\\d\\d)(x)?', flags: '', text: '2026-10' }));
    expect(r.hits[0]!.groups).toEqual([
      { num: 1, name: 'y', value: '2026' },
      { num: 2, value: '10' },
      { num: 3, value: undefined },
    ]);
  });

  it('honours i, m and s', () => {
    expect(ok(runRegex({ pattern: 'abc', flags: 'i', text: 'ABC' })).hits).toHaveLength(1);
    expect(ok(runRegex({ pattern: '^b$', flags: 'gm', text: 'a\nb\nc' })).hits).toHaveLength(1);
    expect(ok(runRegex({ pattern: 'a.b', flags: 's', text: 'a\nb' })).hits).toHaveLength(1);
    expect(ok(runRegex({ pattern: 'a.b', flags: '', text: 'a\nb' })).hits).toHaveLength(0);
  });

  it('terminates on empty matches', () => {
    const r = ok(runRegex({ pattern: 'x*', flags: 'g', text: 'ab' }));
    expect(r.hits).toHaveLength(3);
  });

  it('caps the number of matches', () => {
    const r = ok(runRegex({ pattern: 'a', flags: 'g', text: 'a'.repeat(MAX_MATCHES + 50) }));
    expect(r.hits).toHaveLength(MAX_MATCHES);
    expect(r.capped).toBe(true);
  });

  it('returns the engine message for an invalid pattern or flag combination', () => {
    const r = runRegex({ pattern: '(', flags: '', text: 'x' });
    expect(r.ok).toBe(false);
    expect(runRegex({ pattern: '\\p{L}', flags: 'u', text: 'é' }).ok).toBe(true);
  });

  it('previews the replacement with group references', () => {
    const r = ok(
      runRegex({
        pattern: '(\\w+)@(?<host>\\w+)',
        flags: 'g',
        text: 'a@b c@d',
        replacement: '$<host>:$1',
      }),
    );
    expect(r.replaced).toBe('b:a d:c');
    expect(ok(runRegex({ pattern: 'a', flags: '', text: 'aa', replacement: 'b' })).replaced).toBe(
      'ba',
    );
    expect(ok(runRegex({ pattern: 'a', flags: 'g', text: 'aa' })).replaced).toBeUndefined();
  });
});

describe('toSegments', () => {
  it('cuts the text into plain and matched pieces', () => {
    const text = 'a1 b22';
    const r = ok(runRegex({ pattern: '\\d+', flags: 'g', text }));
    expect(toSegments(text, r.hits)).toEqual([
      { text: 'a' },
      { text: '1', hit: 1 },
      { text: ' b' },
      { text: '22', hit: 2 },
    ]);
  });
  it('skips empty matches and keeps the whole text', () => {
    const r = ok(runRegex({ pattern: 'x*', flags: 'g', text: 'ab' }));
    expect(toSegments('ab', r.hits)).toEqual([{ text: 'ab' }]);
    expect(toSegments('', [])).toEqual([]);
  });
});
