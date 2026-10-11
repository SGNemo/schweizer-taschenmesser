import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { ageDays, ageIndex, ageShares, disjointBytes, oldBytes, sumBytes } from '../logic/age';

const NOW_MS = 1_749_945_600_000;
const NOW = NOW_MS / 1000;
const ago = (days: number) => NOW - days * 86_400;

describe('age of entries', () => {
  it('counts whole days and never makes unknown or future times look old', () => {
    expect(ageDays(ago(10), NOW_MS)).toBe(10);
    expect(ageDays(ago(0.5), NOW_MS)).toBe(0);
    expect(ageDays(0, NOW_MS)).toBe(0);
    expect(ageDays(NOW + 3600, NOW_MS)).toBe(0);
  });

  it('uses the same buckets as the native scan', () => {
    expect([0, 29, 30, 181, 182, 364, 365, 729, 730, 1094, 1095, 9000].map(ageIndex)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
    expect(t.disk.age.buckets).toHaveLength(6);
  });

  it('breaks a folder down by age, oldest first, and sums what is a year or older', () => {
    const node = { ageBytes: [100, 0, 50, 0, 200, 650] };
    expect(ageShares(node).map((a) => [a.index, a.bytes, a.fraction])).toEqual([
      [5, 650, 0.65],
      [4, 200, 0.2],
      [2, 50, 0.05],
      [0, 100, 0.1],
    ]);
    expect(oldBytes(node)).toBe(850);
    expect(sumBytes([{ bytes: 5 }, { bytes: 7 }])).toBe(12);
  });

  it('says how long ago in plain German', () => {
    expect(t.disk.age.ago(0)).toBe('heute');
    expect(t.disk.age.ago(1)).toBe('gestern');
    expect(t.disk.age.ago(9)).toBe('vor 9 Tagen');
    expect(t.disk.age.ago(21)).toBe('vor 3 Wochen');
    expect(t.disk.age.ago(400)).toBe('vor 13 Monaten');
    expect(t.disk.age.ago(1100)).toBe('vor 3 Jahren');
    expect(t.disk.age.short(800)).toBe('2 J.');
  });

  it('sums query results without counting an entry inside a listed folder twice', () => {
    const n = (name: string, relPath: string, bytes: number, kind: 'dir' | 'file' = 'dir') => ({
      name,
      relPath,
      bytes,
      kind,
    });
    expect(
      disjointBytes([
        n('Spiele', '', 100),
        n('Alt', 'Spiele', 60),
        n('alt.pak', 'Spiele\\Alt', 40, 'file'),
        n('Spielestand', '', 7),
        n('alt.iso', 'Downloads', 5, 'file'),
      ]),
    ).toBe(100 + 7 + 5);
  });
});
