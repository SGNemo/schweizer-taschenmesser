// @vitest-environment jsdom
/**
 * Use case „Wochenende retten“, package 4b: „Tagesabschnitt …“ and the field („Duschen nachmittags“, „Bude
 * abends“) set the planner-own `part`; a thing with „Abend“ stands after the things without a part on its
 * day, never on another day; one undo takes the part back. The shape step v3 keeps old rows as they are.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { addFromField, setPart } from '../actions';
import { extractPart, readFieldWithPart } from '../dueWords';
import manifest from '../manifest';
import { migrations } from '../migrations';
import { assignmentRepo, itemRepo } from '../repo';
import { itemSchema } from '../schema';
import { runsSettled, setManifestsForTests } from '../services';

const SAT = '2026-11-14';
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 14, 10, 0).getTime());
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    'todos_list',
    '_settings',
    '_meta',
    '_modules',
  ])
    await db.table(t).clear();
  setManifestsForTests(async () => [todos]);
  await createCollectionRepo(todos, 'list').create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
  await db.table('_modules').put({
    id: 'todos',
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
  await enableModule(manifest);
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
});

const entries = () => collectPlannable({ today: SAT, until: '2026-11-20' }, [todos]);
const lastToast = () => useUiStore.getState().toasts.at(-1)!;
/** Titles of a day in the plan's order, with the day. */
async function board() {
  const titles = new Map((await entries()).map((e) => [`todos:${e.id}`, e.title]));
  const rows = await assignmentRepo.active().toArray();
  return rows
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
    .map((r) => [r.date, titles.get(r.itemKey)]);
}

it('the shape step to v3 is recorded and lossless: an old row parses as it was, a part is optional', async () => {
  expect(manifest.version).toBe(3);
  expect(Object.keys(migrations ?? {})).toEqual(['2', '3']);
  const old = { source: { module: 'todos', id: 'a' }, pinned: SAT, order: 0 };
  expect(itemSchema.parse(old)).toEqual(old);
  expect(itemSchema.parse({ ...old, part: 'evening' }).part).toBe('evening');
  expect(() => itemSchema.parse({ ...old, part: 'night' })).toThrow();
  // The step rewrites nothing.
  await itemRepo.upsert('todos:a', old);
  await migrations![3]!({} as never);
  expect(await itemRepo.get('todos:a')).toMatchObject(old);
});

it('the field words: only the adverb forms, never a lone word, never a break', () => {
  expect(extractPart('Duschen nachmittags')).toEqual({ text: 'Duschen', part: 'afternoon' });
  expect(extractPart('Bude abends')).toEqual({ text: 'Bude', part: 'evening' });
  expect(extractPart('am Vormittag Steuer')).toEqual({ text: 'Steuer', part: 'morning' });
  expect(extractPart('Abend mit Lisa')).toEqual({ text: 'Abend mit Lisa' });
  expect(extractPart('Spieleabend planen')).toEqual({ text: 'Spieleabend planen' });
  expect(extractPart('abends')).toEqual({ text: 'abends' });
  const at = new Date(2026, 10, 14, 10, 0);
  // „abends“ alone would read as 18:00 today: as a part it sets no day.
  const r = readFieldWithPart('Bude abends', at, SAT, true);
  expect(r).toMatchObject({ part: 'evening', fields: { title: 'Bude' } });
  expect(r.fields.date).toBeUndefined();
  expect(readFieldWithPart('Pause 2 Std abends Zocken', at, SAT, true).part).toBeUndefined();
  expect(readFieldWithPart('Bude abends', at, SAT, false).part).toBeUndefined();
});

it('„Bude abends“ from the field stands after the things without a part, on the same day; „Tagesabschnitt …“ sets and clears with one undo', async () => {
  // Typed one after another (a minute apart): the typed order is the order of the day.
  for (const [i, line] of ['Bude abends', 'Steuer 30 Min', 'Duschen 15 Min'].entries()) {
    setNow(() => new Date(2026, 10, 14, 10, i).getTime());
    expect(await addFromField(line, {})).toBe(true);
    // The part word read from the line is named in the toast.
    if (i === 0) expect(lastToast().message).toMatch(/^Bude: abends/);
  }
  await runsSettled();
  const tasks = await taskRepo.active().toArray();
  expect(tasks.map((x) => x.title).sort()).toEqual(['Bude', 'Duschen', 'Steuer']);
  expect((await itemRepo.active().toArray()).map((r) => r.part)).toEqual(['evening']);
  expect(await board()).toEqual([
    [SAT, 'Steuer'],
    [SAT, 'Duschen'],
    [SAT, 'Bude'],
  ]);

  const duschen = (await entries()).find((e) => e.title === 'Duschen')!;
  expect(await setPart(duschen, 'afternoon', {})).toBe(true);
  await runsSettled();
  expect(lastToast().message).toBe('Duschen: nachmittags');
  expect(await board()).toEqual([
    [SAT, 'Steuer'],
    [SAT, 'Duschen'],
    [SAT, 'Bude'],
  ]);
  const steuer = (await entries()).find((e) => e.title === 'Steuer')!;
  const before = await board();
  expect(await setPart(steuer, 'evening', {})).toBe(true);
  await runsSettled();
  // Abend after Nachmittag, same day; inside „Abend“ the typed order (Bude first).
  expect(await board()).toEqual([
    [SAT, 'Duschen'],
    [SAT, 'Bude'],
    [SAT, 'Steuer'],
  ]);
  lastToast().action!.run();
  await expect.poll(async () => board(), { timeout: 3000 }).toEqual(before);
  expect((await itemRepo.get(`todos:${steuer.id}`))?.part).toBeUndefined();

  expect(await setPart(duschen, undefined, {})).toBe(true);
  await runsSettled();
  expect(lastToast().message).toBe('Duschen: ohne Tagesabschnitt');
  expect((await itemRepo.get(`todos:${duschen.id}`))?.part).toBeUndefined();
});
