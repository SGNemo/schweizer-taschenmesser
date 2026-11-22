import { describe, expect, it } from 'vitest';
import { openLineText } from '../openLine';

describe('the line on today (package 3)', () => {
  it('names up to three days by their short name, never a count', () => {
    expect(
      openLineText([{ date: '2026-11-16' }, { date: '2026-11-16' }, { date: '2026-11-17' }]),
    ).toBe('Von Mo, Di ist noch etwas offen.');
  });
  it('from four days on says since when', () => {
    const rows = ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17'].map((date) => ({ date }));
    expect(openLineText(rows)).toBe('Seit Do, 12. ist noch etwas offen.');
  });
});
