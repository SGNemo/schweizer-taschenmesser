import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import manifest from '../manifest';
import source, { GIFT_MINUTES } from '../plannable';
import { giftRepo, personRepo } from '../repo';

/** Gifts as a planner source (planner hub S5, CONCEPT-SOURCES §3.2 row 8). */
const ctx = { today: '2026-11-15', until: '2026-11-29' };
const SECRET = 'Kopfhörer Sony WH-1000';

beforeEach(async () => {
  for (const t of ['people_person', 'people_gift', '_settings']) await db.table(t).clear();
});

const person = (name = 'Oma Ilse') => personRepo.create({ name, tags: [] });
const gift = (personId: string, over: Record<string, unknown> = {}) =>
  giftRepo.create({
    personId,
    title: SECRET,
    occasion: 'Geburtstag',
    date: '2026-11-20',
    status: 'idea',
    note: 'heimlich bestellen',
    url: 'https://example.org/kopfhoerer',
    ...over,
  } as never);

describe('gifts in the plan', () => {
  it('an open gift with a day becomes „Geschenk für <Name>“, 20 Min, hard due, „Zur Person“', async () => {
    const p = await person();
    const g = await gift(p.id);
    const items = await source.list(ctx);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: g.id,
      kind: 'gift',
      title: 'Geschenk für Oma Ilse',
      to: `/people?open=${p.id}`,
      durationMin: GIFT_MINUTES,
      due: { date: '2026-11-20', hard: true },
      action: { label: 'Zur Person', to: `/people?open=${p.id}` },
    });
    expect(GIFT_MINUTES).toBe(20);
  });

  it('never names the gift: nothing of it travels into the plan item', async () => {
    const p = await person();
    await gift(p.id);
    await gift(p.id, { status: 'bought', title: 'Buch „Die Mitte der Welt“' });
    const items = await source.list(ctx);
    expect(items).toHaveLength(2);
    const text = JSON.stringify(items);
    for (const secret of [SECRET, 'Die Mitte', 'heimlich', 'example.org', 'Geburtstag'])
      expect(text).not.toContain(secret);
  });

  it('leaves out given gifts, gifts without a day, outside the days, of a removed person', async () => {
    const p = await person();
    await gift(p.id, { status: 'given' });
    await gift(p.id, { date: undefined });
    await gift(p.id, { date: '2026-12-24' });
    await gift(p.id, { date: '2026-11-10' }); // the occasion has passed: no row about a missed day
    const gone = await person('Weg');
    await gift(gone.id);
    await personRepo.remove(gone.id);
    expect(await source.list(ctx)).toEqual([]);
  });

  it('`showInPlan` is on by default and switches the source off', async () => {
    const p = await person();
    await gift(p.id);
    expect(manifest.settings?.defaults).toMatchObject({ showInPlan: true });
    await setSettings('module.people', { showInPlan: false });
    expect(await source.list(ctx)).toEqual([]);
  });

  it('is a lazy plannable contribution; birthdays stay calendar items', () => {
    expect(manifest.contributions?.plannable).toBeTypeOf('function');
    expect(manifest.contributions?.calendarItems).toBeTypeOf('function');
  });
});
