import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadCatalog } from '@/core/i18n/catalogs';
import { setFormatPref } from '@/core/i18n/format';
import { setLang } from '@/core/i18n/lang';
import {
  addDaysStr,
  addMonthsInSeries,
  endOfMonthStr,
  formatDateTime,
  formatDay,
  humanDateHint,
  isCalendarDate,
  parseDate,
  relativeDayLabel,
  startOfWeekStr,
  toDateString,
  toEpoch,
} from './dates';

describe('formatDateTime', () => {
  it('takes day and time from the same local clock (no UTC day around midnight)', () => {
    // 31 Jan 23:30 local: an implementation reading the day from toISOString() would show
    // 1 Feb in any time zone east of UTC.
    const at = new Date(2026, 0, 31, 23, 30).getTime();
    expect(formatDateTime(at)).toBe('31. Jan. 23:30');
    expect(formatDateTime(new Date(2026, 6, 4, 0, 5).getTime())).toBe('4. Juli 00:05');
  });
});

describe('date string helpers', () => {
  it('toEpoch and formatDateTime agree', () => {
    expect(formatDateTime(toEpoch('2026-12-24', '18:00'))).toBe('24. Dez. 18:00');
  });
  it('week start honours Monday and Sunday weeks', () => {
    expect(startOfWeekStr('2026-09-30')).toBe('2026-09-28'); // Wednesday → Monday
    expect(startOfWeekStr('2026-09-27', 7)).toBe('2026-09-27'); // Sunday stays
    expect(startOfWeekStr('2026-09-30', 7)).toBe('2026-09-27');
  });
  it('relative labels', () => {
    expect(relativeDayLabel('2026-09-30', '2026-09-30')).toBe('Heute');
    expect(relativeDayLabel('2026-10-01', '2026-09-30')).toBe('Morgen');
    expect(relativeDayLabel('2026-09-29', '2026-09-30')).toBe('Gestern');
    expect(relativeDayLabel('2026-10-05', '2026-09-30')).toBe('Mo., 5. Okt.');
  });
});

describe('humanDateHint', () => {
  const ref = '2026-09-29'; // Tuesday
  it('says what a date means in words', () => {
    expect(humanDateHint('2026-09-29', ref)).toBe('Heute');
    expect(humanDateHint('2026-09-30', ref)).toBe('Mittwoch, morgen');
    expect(humanDateHint('2026-09-28', ref)).toBe('Montag, gestern');
    expect(humanDateHint('2026-10-05', ref)).toBe('Montag, in 6 Tagen');
    expect(humanDateHint('2026-09-27', ref)).toBe('Sonntag, vor 2 Tagen');
  });
});

describe('addMonthsInSeries', () => {
  it('a series from the 31st comes back to the 31st after a short month', () => {
    const anchor = '2026-01-31';
    const chain = [anchor];
    for (let i = 0; i < 4; i++) chain.push(addMonthsInSeries(chain[chain.length - 1]!, 1, anchor));
    expect(chain).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });
  it('the 30th stays the 30th; yearly from 29 Feb returns in leap years', () => {
    expect(addMonthsInSeries('2026-02-28', 1, '2026-01-30')).toBe('2026-03-30');
    expect(addMonthsInSeries('2029-02-28', 12, '2028-02-29')).toBe('2030-02-28');
    expect(addMonthsInSeries('2031-02-28', 12, '2028-02-29')).toBe('2032-02-29');
    expect(addMonthsInSeries('2026-11-30', 3, '2026-08-31')).toBe('2027-02-28');
    expect(addMonthsInSeries('2027-02-28', 3, '2026-08-31')).toBe('2027-05-31');
  });
  it('a date moved off the month end keeps its own day', () => {
    expect(addMonthsInSeries('2026-05-01', 1, '2026-01-31')).toBe('2026-06-01');
    expect(addMonthsInSeries('2026-10-05', 1, '2026-10-05')).toBe('2026-11-05');
  });
});

describe('years before 1000', () => {
  it('stay the year they are (no 19xx), written with four digits', () => {
    expect(parseDate('0099-12-31').getFullYear()).toBe(99);
    expect(parseDate('0001-01-01').getFullYear()).toBe(1);
    expect(addDaysStr('0001-01-01', 1)).toBe('0001-01-02');
    expect(addDaysStr('0999-12-31', 1)).toBe('1000-01-01');
    expect(endOfMonthStr('0050-02-10')).toBe('0050-02-28');
    const d = parseDate('2026-01-01');
    d.setFullYear(5, 6, 7);
    expect(toDateString(d)).toBe('0005-07-07');
  });
});

describe('isCalendarDate (X19)', () => {
  it('accepts real calendar dates only', () => {
    for (const ok of ['2026-02-28', '2028-02-29', '2000-02-29', '2026-12-31', '0999-01-01'])
      expect(isCalendarDate(ok), ok).toBe(true);
    for (const bad of [
      '2026-02-30',
      '2026-11-31',
      '2026-02-29',
      '1900-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-01-00',
      '2026-1-5',
      '5.1.2026',
      '',
    ])
      expect(isCalendarDate(bad), bad).toBe(false);
  });
});

describe('formatDay in English (H13)', () => {
  afterEach(() => {
    setFormatPref('auto');
    setLang('de');
  });
  const english = async (region: 'auto' | 'en-US') => {
    await loadCatalog('en');
    setLang('en');
    setFormatPref(region);
  };

  it('writes a day with the full month name without the German day dot', async () => {
    expect(formatDay('2026-11-30', 'd. MMMM')).toBe('30. November');
    await english('auto');
    expect(formatDay('2026-11-30', 'd. MMMM')).toBe('30 November');
    expect(formatDay('2026-11-30', 'EEEE, d. MMM')).toBe('Monday 30 Nov');
    await english('en-US');
    expect(formatDay('2026-11-30', 'd. MMMM')).toBe('November 30');
    expect(formatDay('2026-11-30', 'EEEE, d. MMM')).toBe('Monday, Nov 30');
  });

  /** Every German-style pattern the app passes to `formatDay` has an English equivalent. */
  it('no pattern in the source shows a German day dot in English', async () => {
    const src = join(__dirname, '../..');
    const patterns = new Set<string>();
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
          const text = readFileSync(p, 'utf8');
          for (const call of text.matchAll(/formatDay\(([^;]*?)\)/g))
            for (const lit of call[1]!.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g))
              patterns.add((lit[1] ?? lit[2])!);
        }
      }
    };
    walk(src);
    expect(patterns.has('EEEE, d. MMMM')).toBe(true); // the scan finds the calls
    for (const region of ['auto', 'en-US'] as const) {
      await english(region);
      for (const p of patterns)
        expect(formatDay('2026-11-30', p), `${p} (${region})`).not.toMatch(/\d\.(\s|$)/);
    }
  });
});
