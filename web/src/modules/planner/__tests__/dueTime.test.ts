// @vitest-environment jsdom
/**
 * Use case „Wochenende retten“, package 5b: „bis So 18:00“ gives the deadline its hour – the ToDo's `dueTime`
 * and the planner row's `due.time`, never a note line; the row says „Frist So 18:00“ and, once the hour has
 * passed, „Frist war So 18:00“. The plan still places by day: the hour never changes an assignment. The shape
 * step v4 keeps old rows as they are.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { toEpoch } from '@/core/time/dates';
import { setNow } from '@/core/time/now';
import { addFromField, markDue } from '../actions';
import { dueWas } from '../board';
import { readField } from '../dueWords';
import manifest from '../manifest';
import { migrations } from '../migrations';
import { assignmentRepo, itemRepo } from '../repo';
import { itemSchema } from '../schema';
import { runsSettled, setManifestsForTests } from '../services';

const SAT = '2026-11-14';
const SUN = '2026-11-15';
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

async function reset() {
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
}

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 14, 10, 0).getTime());
  setManifestsForTests(async () => [todos]);
  await reset();
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
});

const entries = () => collectPlannable({ today: SAT, until: '2026-11-20' }, [todos]);

it('the shape step to v4 is recorded and lossless: an old due parses as it was, its hour is optional', async () => {
  expect(manifest.version).toBe(4);
  expect(Object.keys(migrations ?? {})).toEqual(['2', '3', '4']);
  const old = { source: { module: 'todos', id: 'a' }, due: { date: SUN, hard: true }, order: 0 };
  expect(itemSchema.parse(old)).toEqual(old);
  expect(itemSchema.parse({ ...old, due: { ...old.due, time: '18:00' } }).due?.time).toBe('18:00');
  expect(() => itemSchema.parse({ ...old, due: { ...old.due, time: '18 Uhr' } })).toThrow();
  await itemRepo.upsert('todos:a', old);
  await migrations![4]!({} as never);
  expect(await itemRepo.get('todos:a')).toMatchObject(old);
});

it('the field reads the hour of a deadline, and only of a deadline', () => {
  const at = new Date(2026, 10, 14, 10, 0);
  const r = readField('Team-Sachen lesen bis So 18:00', at, SAT, true);
  expect(r).toMatchObject({ hardDue: SUN, hardDueTime: '18:00' });
  expect(r.fields).toMatchObject({ title: 'Team-Sachen lesen', date: SUN, deadline: true });
  expect(readField('spätestens So 18:00 Bericht schicken', at, SAT, true)).toMatchObject({
    hardDue: SUN,
    hardDueTime: '18:00',
    fields: { title: 'Bericht schicken' },
  });
  // Without an hour: a deadline of the day, as before.
  expect(readField('Team-Sachen lesen bis So', at, SAT, true).hardDueTime).toBeUndefined();
  // A time without a deadline word is no deadline.
  const plain = readField('Mama anrufen 18:00', at, SAT, true);
  expect(plain.hardDue).toBeUndefined();
  expect(plain.fields.deadline).toBeUndefined();
});

it('„Team-Sachen lesen bis So 18:00“: dueTime on the ToDo, the hour on the plan row, no note line', async () => {
  expect(await addFromField('Team-Sachen lesen bis So 18:00', {})).toBe(true);
  await runsSettled();
  const [task] = await taskRepo.active().toArray();
  expect(task).toMatchObject({ title: 'Team-Sachen lesen', dueDate: SUN, dueTime: '18:00' });
  expect(task!.note).toBeUndefined();
  const row = await itemRepo.get(`todos:${task!.id}`);
  expect(row?.due).toEqual({ date: SUN, hard: true, time: '18:00' });
  // The source reports the hour too (contract `due.time`).
  expect((await entries())[0]!.due).toEqual({ date: SUN, hard: false, time: '18:00' });
  // A plain time without a deadline stays a note line (the counter line keeps its shape).
  expect(await addFromField('Mama anrufen 18:00', {})).toBe(true);
  const mama = (await taskRepo.active().toArray()).find((x) => x.title === 'Mama anrufen')!;
  expect(mama.dueTime).toBeUndefined();
  expect(mama.note).toBe('Uhrzeit: 18:00');
});

it('the plan places by day: the hour never changes an assignment', async () => {
  const shape = async () =>
    (await assignmentRepo.active().toArray()).map((a) => [a.date, a.minutes, a.reason, a.order]);
  expect(await addFromField('Team-Sachen lesen 30 Min bis So 18:00', {})).toBe(true);
  await runsSettled();
  const timed = await shape();
  await reset();
  expect(await addFromField('Team-Sachen lesen 30 Min bis So', {})).toBe(true);
  await runsSettled();
  expect(await shape()).toEqual(timed);
  expect(timed).toHaveLength(1);
});

it('„Als Frist markieren“ keeps the source hour of the same day only', async () => {
  await taskRepo.create(
    {
      listId: 'inbox',
      title: 'Bericht',
      done: false,
      priority: 0,
      order: 0,
      dueDate: SUN,
      dueTime: '18:00',
    },
    { id: 'b' },
  );
  const e = (await entries())[0]!;
  expect(await markDue(e, SUN, {})).toBe(true);
  expect((await itemRepo.get('todos:b'))?.due).toEqual({ date: SUN, hard: true, time: '18:00' });
  expect(await markDue(e, SAT, {})).toBe(true);
  expect((await itemRepo.get('todos:b'))?.due).toEqual({ date: SAT, hard: true });
});

it('„Frist war …“ once the deadline has passed or the session lies after it', () => {
  const row = { hardDue: SUN, hardDueTime: '18:00' };
  expect(dueWas(row, toEpoch(SUN, '17:59'))).toBe(false);
  expect(dueWas(row, toEpoch(SUN, '18:00'))).toBe(true);
  expect(dueWas({ hardDue: SUN }, toEpoch(SUN, '23:30'))).toBe(false);
  expect(dueWas({ hardDue: SUN }, toEpoch('2026-11-16', '00:00'))).toBe(true);
  expect(dueWas({ ...row, late: true }, toEpoch(SAT, '10:00'))).toBe(true);
  expect(dueWas({}, toEpoch(SUN, '20:00'))).toBe(false);
});
