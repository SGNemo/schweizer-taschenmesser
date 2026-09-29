import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { validateManifest } from '@/core/modules/registry';
import { toEpoch } from '@/core/time/dates';
import { setNow } from '@/core/time/now';
import { setSettings } from '@/core/settings/settings';
import {
  ageOn,
  birthdaysInRange,
  dateInYear,
  daysUntil,
  nextBirthday,
  sortByNext,
  titleFor,
} from '../logic';
import manifest from '../manifest';
import { birthdayRepo } from '../repo';
import { birthdaySchema } from '../schema';

beforeEach(async () => {
  await db.table('birthdays_birthday').clear();
  await db.table('_settings').clear();
});
afterEach(() => setNow());

const b = (over: Record<string, unknown> = {}) =>
  birthdaySchema.parse({ name: 'Anna', month: 10, day: 3, year: 1990, ...over });

describe('birthday logic', () => {
  it('validates the date', () => {
    expect(birthdaySchema.safeParse({ name: 'x', month: 2, day: 30 }).success).toBe(false);
    expect(birthdaySchema.safeParse({ name: 'x', month: 2, day: 29 }).success).toBe(true);
    expect(birthdaySchema.safeParse({ name: 'x', month: 4, day: 31 }).success).toBe(false);
    expect(birthdaySchema.safeParse({ name: '', month: 4, day: 1 }).success).toBe(false);
  });

  it('finds the next birthday, including today and the year change', () => {
    expect(nextBirthday(b(), '2026-09-29')).toBe('2026-10-03');
    expect(nextBirthday(b(), '2026-10-03')).toBe('2026-10-03');
    expect(nextBirthday(b(), '2026-10-04')).toBe('2027-10-03');
    expect(daysUntil(b(), '2026-09-29')).toBe(4);
    expect(daysUntil(b({ month: 1, day: 1 }), '2026-12-31')).toBe(1);
  });

  it('moves 29 February to the 28th in common years', () => {
    const leap = b({ month: 2, day: 29, year: 2000 });
    expect(dateInYear(leap, 2027)).toBe('2027-02-28');
    expect(dateInYear(leap, 2028)).toBe('2028-02-29');
    expect(nextBirthday(leap, '2027-01-01')).toBe('2027-02-28');
  });

  it('computes the age only when the year is known', () => {
    expect(ageOn(b(), '2026-10-03')).toBe(36);
    expect(ageOn(b({ year: undefined }), '2026-10-03')).toBeUndefined();
    expect(titleFor({ ...b(), name: 'Anna' }, '2026-10-03')).toBe('Anna wird 36');
    expect(titleFor({ ...b({ year: undefined }), name: 'Anna' }, '2026-10-03')).toBe(
      'Geburtstag: Anna',
    );
  });

  it('lists occurrences in a range and never before the birth year', () => {
    expect(birthdaysInRange(b(), '2026-01-01', '2028-12-31')).toEqual([
      '2026-10-03',
      '2027-10-03',
      '2028-10-03',
    ]);
    expect(birthdaysInRange(b({ year: 2027 }), '2026-01-01', '2028-12-31')).toEqual([
      '2027-10-03',
      '2028-10-03',
    ]);
    expect(birthdaysInRange(b(), '2026-10-04', '2027-10-02')).toEqual([]);
  });

  it('sorts by the next occurrence', () => {
    const list = [
      { ...b({ name: 'Spät', month: 12 }) },
      { ...b({ name: 'Bald', month: 10, day: 1 }) },
    ];
    expect(sortByNext(list, '2026-09-29').map((x) => x.name)).toEqual(['Bald', 'Spät']);
  });
});

describe('birthdays module', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('shows up on the calendar every year', async () => {
    await birthdayRepo.create(b());
    const items = await collectCalendarItems({ from: '2026-10-01', to: '2027-10-31' }, [manifest]);
    expect(items.map((i) => [i.date, i.title, i.allDay])).toEqual([
      ['2026-10-03', 'Anna wird 36', true],
      ['2027-10-03', 'Anna wird 37', true],
    ]);
  });

  it('notifies at the configured time and lead', async () => {
    setNow(() => new Date(2026, 9, 1, 8, 0).getTime());
    await birthdayRepo.create(b());
    await setSettings('module.birthdays', { remindDaysBefore: 1, remindTime: '08:30' });
    const from = toEpoch('2026-10-02', '00:00');
    const to = toEpoch('2026-10-03', '00:00');
    const found = await collectNotifications({ from, to }, [manifest]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ at: toEpoch('2026-10-02', '08:30'), title: 'Anna wird 36' });
    expect(
      await collectNotifications(
        { from: toEpoch('2026-10-03', '00:00'), to: toEpoch('2026-10-04', '00:00') },
        [manifest],
      ),
    ).toEqual([]);
  });
});
