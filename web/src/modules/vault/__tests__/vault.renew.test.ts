import { describe, expect, it } from 'vitest';
import { countByCategory, RENEWABLE, renewedEnd } from '../logic';

describe('renewal and folder tabs', () => {
  it('moves the end date by one year, also from the legacy field, and keeps 29 February valid', () => {
    expect(renewedEnd({ endDate: '2026-12-31' })).toBe('2027-12-31');
    expect(renewedEnd({ expiresOn: '2026-06-01' })).toBe('2027-06-01');
    expect(renewedEnd({})).toBeUndefined();
    expect(renewedEnd({ endDate: '2028-02-29' })).toBe('2029-02-28');
  });

  it('renews contracts and insurances only', () => {
    expect(RENEWABLE).toEqual(['contract', 'insurance']);
  });

  it('counts documents per category', () => {
    expect(
      countByCategory([{ category: 'contract' }, { category: 'contract' }, { category: 'health' }]),
    ).toEqual({ contract: 2, health: 1 });
  });
});
