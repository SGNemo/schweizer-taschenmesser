import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addLinkIfAbsent, linksOf } from '@/core/entitylinks';
import { plannableSource } from '@/core/modules/contributions';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { loadCatalog } from '@/core/i18n/catalogs';
import { setLang } from '@/core/i18n/lang';
import manifest from '../manifest';
import target from '../linkTarget';
import source, { PACK_MINUTES, SHOP_MINUTES } from '../plannable';
import { itemRepo, itemsOf, listRepo } from '../repo';
import { SHOPPING_LIST_ID } from '../schema';
import { addRequested } from '../services';

const TODAY = '2026-11-16'; // Monday
const UNTIL = '2026-11-22';
const ctx = (requested?: string[]) => ({
  today: TODAY,
  until: UNTIL,
  ...(requested ? { requested } : {}),
});

async function list(id: string, kind: 'shopping' | 'packing' | 'checklist', extra = {}) {
  await listRepo.create({ name: `Liste ${id}`, kind, order: 0, ...extra }, { id });
}
async function entries(listId: string, open: number, done = 0) {
  for (let i = 0; i < open + done; i++)
    await itemRepo.create({ listId, name: `${listId}-${i}`, done: i >= open, order: i });
}

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 16, 10, 0).getTime());
  for (const t of ['lists_list', 'lists_item', 'pantry_item', '_links', '_settings', '_modules'])
    await db.table(t).clear();
});
afterEach(() => {
  setNow();
  setLang('de');
});

describe('lists as a plan source', () => {
  it('is a manifest contribution, without a tick or a write-back', async () => {
    const s = await plannableSource(manifest);
    expect(s).toBe(source);
    expect(s?.onDone).toBeUndefined();
    expect(s?.onAssign).toBeUndefined();
    expect(s?.onEstimate).toBeUndefined();
  });

  it('a packing list with a trip date in the horizon is ONE row, due the day before', async () => {
    await list('trip', 'packing', { name: 'Ostsee', tripDate: '2026-11-20' });
    await entries('trip', 4, 2);
    expect(await source.list(ctx())).toEqual([
      {
        id: 'trip',
        kind: 'packing',
        title: 'Packen: Ostsee',
        to: '/lists?open=trip',
        action: { label: 'Zur Liste', to: '/lists?open=trip' },
        durationMin: PACK_MINUTES,
        due: { date: '2026-11-19', hard: true },
        // Its entries as steps (package 5a; their content: the test „steps“ below).
        steps: expect.any(Array),
        createdAt: expect.any(Number),
      },
    ]);
  });

  it('trip dates: today packs today; the day after the horizon still counts; later or past ones do not', async () => {
    await list('today', 'packing', { tripDate: TODAY });
    await list('edge', 'packing', { tripDate: '2026-11-23' });
    await list('far', 'packing', { tripDate: '2026-11-24' });
    await list('past', 'packing', { tripDate: '2026-11-15' });
    await list('undated', 'packing');
    for (const id of ['today', 'edge', 'far', 'past', 'undated']) await entries(id, 1);
    const rows = await source.list(ctx());
    expect(rows.map((r) => [r.id, r.due?.date]).sort()).toEqual([
      ['edge', UNTIL],
      ['today', TODAY],
    ]);
  });

  it('a shopping list never enters by itself – only when asked, as one row with the count', async () => {
    await list(SHOPPING_LIST_ID, 'shopping');
    await entries(SHOPPING_LIST_ID, 7, 3);
    expect(await source.list(ctx())).toEqual([]);
    expect(await source.list(ctx(['something-else']))).toEqual([]);
    const rows = await source.list(ctx([SHOPPING_LIST_ID]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: SHOPPING_LIST_ID,
      kind: 'shopping',
      title: 'Einkaufen · 7 Dinge',
      durationMin: SHOP_MINUTES,
      action: { label: 'Zur Liste', to: `/lists?open=${SHOPPING_LIST_ID}` },
    });
    expect(rows[0]!.due).toBeUndefined();
    expect(rows[0]!.detail).toBeUndefined();
  });

  it('count wording: singular, plural, English; a second shopping list names itself in the detail', async () => {
    await list('markt', 'shopping', { name: 'Wochenmarkt' });
    await entries('markt', 1);
    expect((await source.list(ctx(['markt'])))[0]).toMatchObject({
      title: 'Einkaufen · 1 Ding',
      detail: 'Wochenmarkt',
    });
    await entries('markt', 1);
    await loadCatalog('en');
    setLang('en');
    expect((await source.list(ctx(['markt'])))[0]!.title).toBe('Shopping · 2 items');
    await itemRepo.update((await itemsOf('markt'))[0]!.id, { done: true });
    expect((await source.list(ctx(['markt'])))[0]!.title).toBe('Shopping · 1 item');
  });

  it('leaves the plan when nothing is open; removed entries do not count', async () => {
    await list(SHOPPING_LIST_ID, 'shopping');
    await list('trip', 'packing', { tripDate: '2026-11-20' });
    await entries(SHOPPING_LIST_ID, 2);
    await entries('trip', 0, 3);
    const [a, b] = await itemsOf(SHOPPING_LIST_ID);
    await itemRepo.update(a!.id, { done: true });
    await itemRepo.remove(b!.id);
    expect(await source.list(ctx([SHOPPING_LIST_ID, 'trip']))).toEqual([]);
  });

  it('a packing list without a date can be asked in; a checklist or a deleted list never is', async () => {
    await list('bag', 'packing', { name: 'Sporttasche' });
    await list('chores', 'checklist');
    await list('old', 'shopping');
    for (const id of ['bag', 'chores', 'old']) await entries(id, 2);
    await listRepo.remove('old');
    const rows = await source.list(ctx(['bag', 'chores', 'old']));
    expect(rows.map((r) => [r.id, r.title, r.due])).toEqual([
      ['bag', 'Packen: Sporttasche', undefined],
    ]);
  });

  it('`showInPlan` off: nothing, asked or dated', async () => {
    await list(SHOPPING_LIST_ID, 'shopping');
    await list('trip', 'packing', { tripDate: '2026-11-20' });
    await entries(SHOPPING_LIST_ID, 2);
    await entries('trip', 2);
    expect(await source.list(ctx([SHOPPING_LIST_ID]))).toHaveLength(2);
    await setSettings('module.lists', { showInPlan: false });
    expect(await source.list(ctx([SHOPPING_LIST_ID]))).toEqual([]);
  });
});

describe('lists as a link target', () => {
  it('resolves a list and an entry (with its own tick); anything else is gone', async () => {
    await list('trip', 'packing', { name: 'Ostsee' });
    await entries('trip', 1, 1);
    const [open, done] = await itemsOf('trip');
    expect(await target.resolve('trip')).toEqual({
      state: 'alive',
      title: 'Ostsee',
      to: '/lists?open=trip',
    });
    expect(await target.resolve(open!.id)).toMatchObject({ state: 'alive', done: false });
    expect(await target.resolve(done!.id)).toMatchObject({ state: 'alive', done: true });
    await itemRepo.remove(open!.id);
    expect(await target.resolve(open!.id)).toEqual({ state: 'gone' });
    expect(await target.resolve('nope')).toEqual({ state: 'gone' });
  });
});

describe('pantry → shopping list keeps the way back', () => {
  const pantry = { module: 'pantry', id: 'p-milk' };
  const moduleOn = (id: string) =>
    db.table('_modules').put({
      id,
      enabled: true,
      dataPolicy: null,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });
  const pantryRow = () =>
    db.table('pantry_item').put({
      id: 'p-milk',
      name: 'Milch',
      place: 'fridge',
      count: 0,
      minCount: 1,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });

  beforeEach(async () => {
    await moduleOn('lists');
    await moduleOn('pantry');
    await pantryRow();
  });

  it('`shopping.requested` with `ref`: one entry, one link entry → pantry, read from both ends', async () => {
    await addRequested({ name: 'Milch', quantity: '2', ref: pantry });
    await addRequested({ name: 'Milch', ref: pantry }); // asked again: neither a second entry nor a second link
    const items = await itemsOf(SHOPPING_LIST_ID);
    expect(items.map((i) => [i.name, i.quantity])).toEqual([['Milch', '2']]);
    expect(await db.table('_links').count()).toBe(1);
    const fromPantry = await linksOf(pantry);
    expect(fromPantry).toHaveLength(1);
    expect(fromPantry[0]).toMatchObject({
      direction: 'in',
      other: { module: 'lists', id: items[0]!.id },
      link: { rel: 'origin', label: 'Milch' },
      state: { state: 'alive', title: 'Milch', to: `/lists?open=${items[0]!.id}`, done: false },
    });
    const fromEntry = await linksOf({ module: 'lists', id: items[0]!.id });
    expect(fromEntry[0]).toMatchObject({
      direction: 'out',
      state: { state: 'alive', title: 'Milch', to: '/pantry?open=p-milk' },
    });
  });

  it('an entry that was open before gets the link too; a bought one reads done', async () => {
    await addRequested({ name: 'Milch' });
    await addRequested({ name: 'milch', ref: pantry });
    const [entry] = await itemsOf(SHOPPING_LIST_ID);
    expect((await linksOf(pantry))[0]?.other.id).toBe(entry!.id);
    await itemRepo.update(entry!.id, { done: true });
    expect((await linksOf(pantry))[0]?.state).toMatchObject({ state: 'alive', done: true });
  });

  it('without `ref`, or with one that must not be linked, the entry is added and nothing is linked', async () => {
    await addRequested({ name: 'Butter' });
    await addRequested({ name: 'Passwort', ref: { module: 'accounts', id: 'a1' } });
    await addRequested({ name: 'Brot', ref: { module: 'nope', id: 'x' } });
    expect((await itemsOf(SHOPPING_LIST_ID)).map((i) => i.name)).toEqual([
      'Butter',
      'Passwort',
      'Brot',
    ]);
    expect(await db.table('_links').count()).toBe(0);
    // the guard is core's: the same link is refused there
    await expect(
      addLinkIfAbsent({
        from: { module: 'lists', id: 'x' },
        to: { module: 'accounts', id: 'a1' },
        rel: 'origin',
        label: 'x',
      }),
    ).rejects.toThrow();
  });
});

describe('steps (planner hub 2, package 5a)', () => {
  it('a list hands over its entries in order as steps, ticked ones in place; a tick from the plan writes that entry only', async () => {
    await list('trip', 'packing', { name: 'Ostsee', tripDate: '2026-11-20' });
    await entries('trip', 2, 1);
    const [row] = await source.list(ctx());
    expect(row?.steps?.map((s) => [s.title, s.done])).toEqual([
      ['trip-0', false],
      ['trip-1', false],
      ['trip-2', true],
    ]);
    await source.onStepDone!('trip', row!.steps![0]!.id, true);
    const [after] = await source.list(ctx());
    expect(after?.steps?.map((s) => s.done)).toEqual([true, false, true]);
    // An entry of another list is never touched through this one.
    await list('other', 'packing', { name: 'Berge', tripDate: '2026-11-20' });
    await entries('other', 1);
    const foreign = (await source.list(ctx())).find((r) => r.id === 'other');
    await source.onStepDone!('trip', foreign!.steps![0]!.id, true);
    expect((await itemRepo.get(foreign!.steps![0]!.id))?.done).toBe(false);
  });
});
