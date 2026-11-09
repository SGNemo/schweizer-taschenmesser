import { describe, expect, it } from 'vitest';
import { cancelTone, WARN_DAYS } from '../logic';

/** Round 6, U18: a near cancellation deadline is a warning, never red; red stays for a missed one. */
describe('cancellation deadline tone', () => {
  const day = '2026-09-29';

  it('a deadline within the warning window is "soon" (warning colour, clock, "in n Tagen")', () => {
    expect(cancelTone('2026-10-04', day)).toEqual({ tone: 'soon', days: 5 });
    expect(cancelTone(day, day)).toEqual({ tone: 'soon', days: 0 });
  });

  it('a later deadline is plain text', () => {
    expect(cancelTone('2026-12-31', day).tone).toBe('plain');
    expect(cancelTone('2026-10-13', day).tone).toBe('soon');
    expect(WARN_DAYS).toBe(14);
  });

  it('no upcoming deadline is ever "danger"', () => {
    for (const d of ['2026-09-29', '2026-10-01', '2026-10-13', '2027-01-01'])
      expect(cancelTone(d, day).tone).not.toBe('danger');
  });
});
