import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { validateManifest } from '@/core/modules/registry';
import { getSettings, setSettings } from '@/core/settings/settings';
import { toEpoch } from '@/core/time/dates';
import { setNow } from '@/core/time/now';
import {
  ageOn,
  birthdaysInRange,
  birthdayTitle,
  dateInYear,
  daysUntil,
  nextBirthday,
  safeUrl,
  sortByNext,
  sortGifts,
  totals,
} from '../logic';
import manifest from '../manifest';
import { carryOverSettings } from '../services';
import { settings, settingsSchema } from '../settings';
import { deletePerson, giftRepo, giftsOf, personRepo } from '../repo';
import { birthdaySchema, giftSchema, personSchema, type Birthday, type Gift } from '../schema';

beforeEach(async () => {
  await db.table('people_person').clear();
  await db.table('people_gift').clear();
  await db.table('_settings').clear();
});
afterEach(() => setNow());

const bd = (over: Partial<Birthday> = {}): Birthday =>
  birthdaySchema.parse({ month: 10, day: 3, year: 1990, ...over });
const person = (over: Record<string, unknown> = {}) =>
  personSchema.parse({ name: 'Anna', birthday: bd(), ...over });
const gift = (o: Partial<Gift> = {}): Gift =>
  giftSchema.parse({ personId: 'p1', title: 'Buch', ...o });

describe('birthday logic', () => {
  it('validates the date', () => {
    expect(birthdaySchema.safeParse({ month: 2, day: 30 }).success).toBe(false);
    expect(birthdaySchema.safeParse({ month: 2, day: 29 }).success).toBe(true);
    expect(birthdaySchema.safeParse({ month: 4, day: 31 }).success).toBe(false);
    expect(personSchema.safeParse({ name: '', birthday: { month: 4, day: 1 } }).success).toBe(
      false,
    );
    expect(personSchema.parse({ name: 'x' })).toEqual({ name: 'x', tags: [] });
  });

  it('finds the next birthday, including today and the year change', () => {
    expect(nextBirthday(bd(), '2026-09-29')).toBe('2026-10-03');
    expect(nextBirthday(bd(), '2026-10-03')).toBe('2026-10-03');
    expect(nextBirthday(bd(), '2026-10-04')).toBe('2027-10-03');
    expect(daysUntil(bd(), '2026-09-29')).toBe(4);
    expect(daysUntil(bd({ month: 1, day: 1 }), '2026-12-31')).toBe(1);
  });

  it('moves 29 February to the 28th in common years', () => {
    const leap = bd({ month: 2, day: 29, year: 2000 });
    expect(dateInYear(leap, 2027)).toBe('2027-02-28');
    expect(dateInYear(leap, 2028)).toBe('2028-02-29');
    expect(nextBirthday(leap, '2027-01-01')).toBe('2027-02-28');
  });

  it('computes the age only when the year is known', () => {
    expect(ageOn(bd(), '2026-10-03')).toBe(36);
    expect(ageOn(bd({ year: undefined }), '2026-10-03')).toBeUndefined();
    expect(birthdayTitle('Anna', bd(), '2026-10-03')).toBe('Anna wird 36');
    expect(birthdayTitle('Anna', bd({ year: undefined }), '2026-10-03')).toBe('Geburtstag: Anna');
  });

  it('lists occurrences in a range and never before the birth year', () => {
    expect(birthdaysInRange(bd(), '2026-01-01', '2028-12-31')).toEqual([
      '2026-10-03',
      '2027-10-03',
      '2028-10-03',
    ]);
    expect(birthdaysInRange(bd({ year: 2027 }), '2026-01-01', '2028-12-31')).toEqual([
      '2027-10-03',
      '2028-10-03',
    ]);
    expect(birthdaysInRange(bd(), '2026-10-04', '2027-10-02')).toEqual([]);
  });

  it('sorts by the next occurrence, people without a birthday last', () => {
    const list = [
      person({ name: 'Ohne', birthday: undefined }),
      person({ name: 'Spät', birthday: bd({ month: 12 }) }),
      person({ name: 'Bald', birthday: bd({ month: 10, day: 1 }) }),
    ];
    expect(sortByNext(list, '2026-09-29').map((x) => x.name)).toEqual(['Bald', 'Spät', 'Ohne']);
  });
});

describe('gift logic', () => {
  it('validates gifts', () => {
    expect(giftSchema.safeParse({ personId: '', title: 'x' }).success).toBe(false);
    expect(giftSchema.safeParse({ personId: 'p', title: '' }).success).toBe(false);
    expect(giftSchema.safeParse({ personId: 'p', title: 'x', priceCents: -1 }).success).toBe(false);
    expect(giftSchema.safeParse({ personId: 'p', title: 'x', priceCents: 12.5 }).success).toBe(
      false,
    );
    expect(giftSchema.safeParse({ personId: 'p', title: 'x', date: '24.12.2026' }).success).toBe(
      false,
    );
    expect(gift().status).toBe('idea');
  });

  it('keeps web links only', () => {
    expect(safeUrl('example.org/buch')).toBe('https://example.org/buch');
    expect(safeUrl(' http://example.org ')).toBe('http://example.org/');
    expect(safeUrl('')).toBeUndefined();
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,x')).toBeUndefined();
    expect(safeUrl('mailto:a@b.de')).toBeUndefined();
    expect(safeUrl('http://')).toBeUndefined();
  });

  const list = [
    gift({ title: 'Z', status: 'given', priceCents: 1000 }),
    gift({ title: 'B', date: '2026-12-24' }),
    gift({ title: 'A', date: '2026-12-01' }),
    gift({ title: 'C', status: 'bought', priceCents: 2550 }),
    gift({ title: 'Ö' }),
  ];
  it('puts open ideas first, then bought and given, by date then title', () => {
    expect(sortGifts(list).map((g) => g.title)).toEqual(['A', 'B', 'Ö', 'C', 'Z']);
  });
  it('counts and sums what was bought or given', () => {
    expect(totals(list)).toEqual({ open: 3, bought: 1, given: 1, spentCents: 3550 });
    expect(totals([])).toEqual({ open: 0, bought: 0, given: 0, spentCents: 0 });
  });
});

describe('people module', () => {
  it('has a valid manifest, is off by default and offers the assistant persons only', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
    expect(Object.keys(manifest.aiSchema!.collections)).toEqual(['person']);
  });

  it('shows birthdays every year and gift occasions until the gift is given', async () => {
    const anna = await personRepo.create(person());
    await giftRepo.create(gift({ personId: anna.id, title: 'Buch', date: '2026-12-24' }));
    await giftRepo.create(
      gift({ personId: anna.id, title: 'Schal', date: '2026-12-25', status: 'given' }),
    );
    await giftRepo.create(gift({ personId: anna.id, title: 'Ohne Datum' }));
    const items = await collectCalendarItems({ from: '2026-10-01', to: '2027-10-31' }, [manifest]);
    expect(items.map((i) => [i.date, i.title, i.kind]).sort()).toEqual([
      ['2026-10-03', 'Anna wird 36', 'birthday'],
      ['2026-12-24', 'Geschenk für Anna: Buch', 'gift'],
      ['2027-10-03', 'Anna wird 37', 'birthday'],
    ]);
  });

  it('notifies at the configured time and lead', async () => {
    setNow(() => new Date(2026, 9, 1, 8, 0).getTime());
    const anna = await personRepo.create(person());
    await personRepo.create(person({ name: 'Ohne', birthday: undefined }));
    await setSettings('module.people', { remindDaysBefore: 1, remindTime: '08:30' });
    const from = toEpoch('2026-10-02', '00:00');
    const to = toEpoch('2026-10-03', '00:00');
    const found = await collectNotifications({ from, to }, [manifest]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      at: toEpoch('2026-10-02', '08:30'),
      title: 'Anna wird 36',
      key: `birthday:${anna.id}:2026-10-03`,
    });
    expect(
      await collectNotifications(
        { from: toEpoch('2026-10-03', '00:00'), to: toEpoch('2026-10-04', '00:00') },
        [manifest],
      ),
    ).toEqual([]);
  });

  it('carries the reminder settings of the retired birthdays module over once', async () => {
    await setSettings('module.birthdays', { remindDaysBefore: 3, remindTime: '07:15' });
    await carryOverSettings();
    expect(await getSettings('module.people', settingsSchema, settings.defaults as never)).toEqual({
      remindDaysBefore: 3,
      remindTime: '07:15',
    });
    await setSettings('module.people', { remindDaysBefore: 1 });
    await carryOverSettings();
    expect(
      (await getSettings('module.people', settingsSchema, settings.defaults as never))
        .remindDaysBefore,
    ).toBe(1);
  });

  it('deleting a person removes their gifts too', async () => {
    const anna = await personRepo.create(person());
    const bernd = await personRepo.create(person({ name: 'Bernd' }));
    await giftRepo.create(gift({ personId: anna.id }));
    await giftRepo.create(gift({ personId: bernd.id }));
    await deletePerson(anna.id);
    expect(await personRepo.get(anna.id)).toBeUndefined();
    expect(await giftsOf(anna.id)).toEqual([]);
    expect(await giftsOf(bernd.id)).toHaveLength(1);
  });
});
