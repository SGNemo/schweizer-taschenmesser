import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { formatCrackTime, measureStrength, scoreOfSeconds } from '../strength';

describe('strength: label and crack time agree', () => {
  it('maps the shown offline crack time to the level', () => {
    expect(scoreOfSeconds(0.2)).toBe(0);
    expect(scoreOfSeconds(600)).toBe(1);
    expect(scoreOfSeconds(7 * 86400)).toBe(2);
    expect(scoreOfSeconds(5 * 365 * 86400)).toBe(3);
    expect(scoreOfSeconds(500 * 365 * 86400)).toBe(4);
  });

  it('writes the time in words from the catalog at both ends', () => {
    expect(formatCrackTime(0.5)).toBe(t.accounts.strength.lessThanSecond);
    expect(formatCrackTime(1000 * 365 * 86400)).toBe(t.accounts.strength.centuries);
    expect(formatCrackTime(3 * 3600)).toMatch(/3/);
  });

  it('never labels a password stronger than its shown crack time supports', async () => {
    const r = await measureStrength('password1');
    expect(r.score).toBeLessThanOrEqual(scoreOfSeconds(r.crackSeconds));
  });

  it('reports the warning as a key whose text is in the catalog (no German from the library)', async () => {
    const r = await measureStrength('qwertyuiop');
    expect(r.warning).not.toBe('');
    expect(t.accounts.strength.warnings[r.warning]).toBeTruthy();
  });
});
