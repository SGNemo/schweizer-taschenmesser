import { describe, expect, it } from 'vitest';
import { resolveRange, resolveRelative } from './range';
import type { RelativeRange } from './schema';

const TUESDAY = '2026-09-29';

describe('resolveRelative', () => {
  const cases: [RelativeRange, string, { from?: string; to?: string }][] = [
    ['today', TUESDAY, { from: '2026-09-29', to: '2026-09-29' }],
    ['tomorrow', TUESDAY, { from: '2026-09-30', to: '2026-09-30' }],
    ['yesterday', TUESDAY, { from: '2026-09-28', to: '2026-09-28' }],
    ['this_week', TUESDAY, { from: '2026-09-28', to: '2026-10-04' }],
    ['this_week', '2026-09-27', { from: '2026-09-21', to: '2026-09-27' }], // Sunday belongs to the week before
    ['next_week', TUESDAY, { from: '2026-10-05', to: '2026-10-11' }],
    ['next_7_days', TUESDAY, { from: '2026-09-29', to: '2026-10-05' }],
    ['this_month', TUESDAY, { from: '2026-09-01', to: '2026-09-30' }],
    ['this_month', '2028-02-10', { from: '2028-02-01', to: '2028-02-29' }], // leap year
    ['next_month', TUESDAY, { from: '2026-10-01', to: '2026-10-31' }],
    ['next_month', '2026-12-15', { from: '2027-01-01', to: '2027-01-31' }],
    ['next_month', '2026-01-31', { from: '2026-02-01', to: '2026-02-28' }],
    ['last_month', TUESDAY, { from: '2026-08-01', to: '2026-08-31' }],
    ['last_month', '2026-01-10', { from: '2025-12-01', to: '2025-12-31' }],
    ['overdue', TUESDAY, { to: '2026-09-28' }],
  ];
  it.each(cases)('%s on %s', (relative, today, expected) => {
    expect(resolveRelative(relative, today)).toEqual(expected);
  });

  it('explicit bounds win over relative', () => {
    expect(resolveRange({ relative: 'this_month', to: '2026-09-15' }, TUESDAY)).toEqual({
      from: '2026-09-01',
      to: '2026-09-15',
    });
    expect(resolveRange({ from: '2026-01-01', to: '2026-01-31' }, TUESDAY)).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });
});
