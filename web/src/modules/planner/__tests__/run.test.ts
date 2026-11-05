import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsOf } from '@/core/automation/ingest';
import { db } from '@/core/db/db';
import { getMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { setWriteListener, type WriteSignal } from '@/core/db/writeHook';
import { bus } from '@/core/events';
import { disableModule, enableModule, loadModuleStates } from '@/core/modules/activation';
import { plannableSource, type PlannableEntry } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';
import { DexieStorageAdapter, PULL_COMPLETE_KEY } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { syncSettled } from '@/core/sync/service';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { undoEntry } from '@/core/undo';
import { createTestDb } from '@/test-utils';
import { setAvailable } from '../actions';
import manifest from '../manifest';
import { assignmentRepo, dayRepo, itemRepo, plannerRepos, putRow } from '../repo';
import { LAST_RUN_KEY, restoreSources, runPlanner, type LastRun, type RunDeps } from '../run';
import start, { runBackground, runsSettled, runUser, setManifestsForTests } from '../services';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

const TODAY = '2026-11-09'; // Monday
const NOW = new Date(2026, 10, 9, 10, 0).getTime();
const todos = getManifest('todos')!;
const calendar = getManifest('calendar')!;
const taskRepo = createCollectionRepo(todos, 'task');
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
const H = { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' as const };

const deps = (over: Partial<RunDeps> = {}): RunDeps => ({
  today: TODAY,
  manifests: [todos],
  settings: H,
  planLimit: 3,
  settled: true,
  ...over,
});
const task = (title: string, over: Record<string, unknown> = {}) =>
  taskRepo.create({ ...base, title, ...over });
const stored = (id: string) => taskRepo.get(id);
const rows = async () =>
  (await assignmentRepo.active().toArray())
    .map((a) => [a.id, a.date, a.minutes, a.order, a.reason] as const)
    .sort();
const modulesRow = (id: string, enabled: boolean) =>
  db.table('_modules').put({
    id,
    enabled,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    'todos_list',
    'calendar_event',
    '_settings',
    '_meta',
    '_modules',
    '_secrets',
    '_outbox',
  ])
    await db.table(t).clear();
  await createCollectionRepo(todos, 'list').create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
  bus.clear();
  setManifestsForTests(async () => [todos]);
});
afterEach(() => {
  setNow();
  setWriteListener(undefined);
  setManifestsForTests(undefined);
  bus.clear();
});

describe('a run', () => {
  it('plans the ToDos, stores deterministic rows and writes the first day back with a mark', async () => {
    const a = await task('Steuer', { estimateMin: 120, priority: 2 });
    const b = await task('Kurz', { estimateMin: 10 });
    const r = await runPlanner(deps());
    expect(r.ran).toBe(true);
    expect(await rows()).toEqual(
      [
        [`todos:${a.id}#0`, TODAY, 60, 0, 'new'],
        [`todos:${a.id}#1`, '2026-11-10', 60, 0, 'new'],
        [`todos:${b.id}#0`, TODAY, 10, 1, 'new'],
      ].sort(),
    );
    expect(await stored(a.id)).toMatchObject({
      plannedFor: TODAY,
      planMark: { date: TODAY, order: 0 },
    });
    expect(await stored(b.id)).toMatchObject({
      plannedFor: TODAY,
      planMark: { date: TODAY, order: 1 },
    });
    expect((await getMeta<LastRun>(LAST_RUN_KEY))?.titles).toEqual({
      [`todos:${a.id}`]: 'Steuer',
      [`todos:${b.id}`]: 'Kurz',
    });
  });

  it('one run → zero follow-up writes; the same input is a fixpoint', async () => {
    await task('A', { estimateMin: 45 });
    await task('B', { estimateMin: 200 });
    const first = await runPlanner(deps());
    expect(first.rowWrites).toBeGreaterThan(0);
    const before = await rows();
    // Unchanged input: a background run does not even plan.
    expect((await runPlanner(deps())).ran).toBe(false);
    // Forced (a user action): plans again, writes nothing.
    const again = await runPlanner(deps(), { force: true });
    expect(again.ran).toBe(true);
    expect(again.rowWrites).toBe(0);
    expect(again.writeBacks).toBe(0);
    expect(await rows()).toEqual(before);
  });

  it('a done thing frees its rows (tombstones) and a reopened one gets them back – visible again', async () => {
    const a = await task('A', { estimateMin: 45 });
    await runPlanner(deps());
    const source = (await plannableSource(todos))!;
    await source.onDone!(a.id);
    const r = await runPlanner(deps());
    expect(r.ran).toBe(true);
    expect(await rows()).toEqual([]);
    expect((await assignmentRepo.table.get(`todos:${a.id}#0`))?.deletedAt).not.toBeNull();
    await taskRepo.update(a.id, { done: false, completedAt: undefined });
    await runPlanner(deps());
    expect(await rows()).toEqual([[`todos:${a.id}#0`, TODAY, 45, 0, 'new']]);
    expect((await assignmentRepo.table.get(`todos:${a.id}#0`))?.deletedAt).toBeNull();
  });

  it('a run produces no automation event (only plannedFor/planMark change on the ToDo)', async () => {
    await task('A', { estimateMin: 45 });
    await task('B', { estimateMin: 20 });
    const seen: WriteSignal[] = [];
    setWriteListener((s) => seen.push(s));
    await runPlanner(deps());
    setWriteListener(undefined);
    const todoWrites = seen.filter((s) => s.table === 'todos_task');
    expect(todoWrites.length).toBeGreaterThan(0);
    const automation = (await todos.automation!()).default;
    const watched = (m: string, c: string) =>
      m === 'todos' ? automation.watch?.[c as 'task'] : undefined;
    const events = todoWrites.flatMap((s) => eventsOf(s, 1, automation.derive, watched));
    expect(events).toEqual([]);
  });

  it('no sync configured → the user’s date is copied to the item’s earliest and into prior; a cleared date removes it', async () => {
    const a = await task('Später Do', { estimateMin: 30, plannedFor: '2026-11-12' });
    expect(await syncSettled()).toBe(true);
    await runPlanner(deps({ settled: await syncSettled() }));
    expect(await itemRepo.get(`todos:${a.id}`)).toMatchObject({ earliest: '2026-11-12' });
    expect(await stored(a.id)).toMatchObject({
      plannedFor: '2026-11-12',
      planMark: { date: '2026-11-12', prior: '2026-11-12' },
    });
    // The user clears the date on the ToDo page: the copy goes too (an unlisted writer would leave a stale mark; here the helper's shape).
    await taskRepo.update(a.id, { plannedFor: undefined, planMark: undefined });
    await runPlanner(deps());
    expect((await itemRepo.get(`todos:${a.id}`))?.earliest).toBeUndefined();
    // Nothing is pulled forward by itself (rule 6): the thing keeps Thursday, now without a prior.
    expect(await stored(a.id)).toMatchObject({
      plannedFor: '2026-11-12',
      planMark: { date: '2026-11-12' },
    });
    expect(((await stored(a.id))!.planMark as { prior?: string }).prior).toBeUndefined();
  });

  it('gate closed → the user’s date is neither copied nor overwritten, but used as the lower bound', async () => {
    const a = await task('Später Do', { estimateMin: 30, plannedFor: '2026-11-12' });
    const r = await runPlanner(deps({ settled: false }));
    expect(r.result!.assignments[0]).toMatchObject({ date: '2026-11-12' });
    expect(await itemRepo.get(`todos:${a.id}`)).toBeUndefined();
    const t = (await stored(a.id))!;
    expect(t.plannedFor).toBe('2026-11-12');
    expect(t.planMark).toBeUndefined();
  });

  it('ops of plannedFor/planMark split across two pull pages → the gate is closed and no earliest is copied', async () => {
    // Device B carries a planner-own task; this device pulls it one op per page and stops half way.
    const server = new MemoryServer();
    const other = createTestDb();
    const otherTasks = createCollectionRepo(todos, 'task', other);
    const t = await otherTasks.create({
      ...base,
      title: 'Von B',
      estimateMin: 30,
      plannedFor: '2026-11-12',
      planMark: { date: '2026-11-12', order: 0 },
    });
    await runSync({ storage: new DexieStorageAdapter(other), adapter: server.adapter() });
    const planMarkOp = server.dump().findIndex((op) => op.id === t.id && op.field === 'planMark');
    expect(planMarkOp).toBeGreaterThan(
      server.dump().findIndex((op) => op.id === t.id && op.field === 'plannedFor'),
    );
    await db.table('_secrets').put({
      key: 'syncConfig',
      value: { kind: 'selfHosted', url: 'https://sync.example', token: 'right-token' },
    });
    server.failPullAt = server.requests.pull + planMarkOp + 1; // the page with the mark never arrives
    await expect(
      runSync({ storage: new DexieStorageAdapter(db), adapter: server.adapter(), pullLimit: 1 }),
    ).rejects.toBeDefined();
    const half = (await taskRepo.table.get(t.id))!;
    expect(half.plannedFor).toBe('2026-11-12');
    expect(half.planMark).toBeUndefined(); // reads as the user's date – exactly the case the gate is for
    expect((await db.table('_meta').get(PULL_COMPLETE_KEY))?.value).toBe(false);
    expect(await syncSettled()).toBe(false);
    await runPlanner(deps({ settled: await syncSettled() }));
    expect(await itemRepo.get(`todos:${t.id}`)).toBeUndefined();
    expect((await taskRepo.table.get(t.id))!.plannedFor).toBe('2026-11-12');
    other.close();
    await other.delete();
  });

  it('two devices converge: the same input gives the same rows, and after a sync neither writes again', async () => {
    const entries: PlannableEntry[] = [
      {
        moduleId: 'todos',
        id: 'a',
        kind: 'task',
        title: 'A',
        to: '/todos?open=a',
        durationMin: 120,
        priority: 2,
        createdAt: 1,
      },
      {
        moduleId: 'todos',
        id: 'b',
        kind: 'task',
        title: 'B',
        to: '/todos?open=b',
        durationMin: 20,
        priority: 1,
        createdAt: 2,
      },
    ];
    const writer = { onAssign: vi.fn(async () => undefined) };
    const server = new MemoryServer();
    const devices = [createTestDb(), createTestDb()];
    for (const database of devices) {
      const r = await runPlanner(deps({ database, entries, writer, calendar: [] }));
      expect(r.rowWrites).toBe(3);
    }
    const shape = async (database: (typeof devices)[number]) =>
      (await plannerRepos(database).assignment.active().toArray())
        .map((a) => [a.id, a.date, a.minutes, a.order])
        .sort();
    expect(await shape(devices[0]!)).toEqual(await shape(devices[1]!));
    for (const database of devices)
      await runSync({ storage: new DexieStorageAdapter(database), adapter: server.adapter() });
    for (const database of devices)
      await runSync({ storage: new DexieStorageAdapter(database), adapter: server.adapter() });
    for (const database of devices) {
      const r = await runPlanner(deps({ database, entries, writer, calendar: [] }), {
        force: true,
      });
      expect(r.rowWrites).toBe(0);
    }
    for (const database of devices) {
      database.close();
      await database.delete();
    }
  });

  it('a sync-applied change of the rows triggers a background recompute that writes only the differing rows', async () => {
    const a = await task('A', { estimateMin: 45 });
    await runPlanner(deps());
    // Another device placed the thing on Wednesday: the shared row is the plan (rule 6, nothing is pulled forward)…
    await assignmentRepo.update(`todos:${a.id}#0`, { date: '2026-11-11' });
    const kept = await runPlanner(deps());
    expect(kept.ran).toBe(true);
    expect(kept.rowWrites).toBe(0);
    expect(await rows()).toEqual([[`todos:${a.id}#0`, '2026-11-11', 45, 0, 'new']]);
    // … but a field the engine derives (the minutes) is corrected, and only that row is written.
    await assignmentRepo.update(`todos:${a.id}#0`, { minutes: 10 });
    const fixed = await runPlanner(deps());
    expect(fixed.ran).toBe(true);
    expect(fixed.rowWrites).toBe(1);
    expect(await rows()).toEqual([[`todos:${a.id}#0`, '2026-11-11', 45, 0, 'new']]);
  });
});

describe('the service', () => {
  it('a user action with its run is one undoable; undo stays undone (the next background run writes nothing)', async () => {
    const a = await task('Alt', { estimateMin: 45 });
    await runBackground();
    const before = await rows();
    const { entry } = await runUser('Neu', async () => {
      await task('Neu', { estimateMin: 60, priority: 3 });
    });
    expect(await rows()).not.toEqual(before);
    expect(entry).toBeDefined();
    expect(await undoEntry(entry!.id)).toBe(true);
    expect(await rows()).toEqual(before);
    expect(await stored(a.id)).toMatchObject({
      plannedFor: TODAY,
      planMark: { date: TODAY, order: 0 },
    });
    const r = await runBackground();
    expect(r?.ran ?? false).toBe(true);
    expect(r!.rowWrites).toBe(0);
    expect(r!.writeBacks).toBe(0);
  });

  it('a new appointment replans by itself (live query, not the write hook)', async () => {
    await modulesRow('todos', true);
    await modulesRow('calendar', true);
    await modulesRow('planner', true);
    await dayRepo.upsert(TODAY, { date: TODAY, availableMin: 60, blockers: [] });
    await task('A', { estimateMin: 45 });
    setManifestsForTests(undefined);
    const stop = start();
    await vi.waitFor(
      async () =>
        expect(await rows()).toEqual([[expect.stringMatching(/#0$/), TODAY, 45, 0, 'new']]),
      { timeout: 4000 },
    );
    // A timed appointment of 50 minutes today: 60 − 50 = 10 raw, nothing fits → the thing moves to tomorrow.
    await createCollectionRepo(calendar, 'event').create({
      title: 'Zahnarzt',
      startDate: TODAY,
      allDay: false,
      startTime: '10:00',
      endTime: '10:50',
    });
    await vi.waitFor(async () => expect((await rows())[0]?.[1]).toBe('2026-11-10'), {
      timeout: 4000,
    });
    stop();
    await runsSettled();
  });

  it('Später Do → assigned Sa, Do never undercut → disabling (keep and delete) hands Do back, no active mark', async () => {
    for (const policy of ['keep', 'delete'] as const) {
      for (const t of [
        'planner_day',
        'planner_item',
        'planner_assignment',
        'todos_task',
        '_modules',
        '_meta',
      ])
        await db.table(t).clear();
      await modulesRow('todos', true);
      await enableModule(manifest);
      // Thursday and Friday are off: the thing cannot land before Saturday.
      await dayRepo.upsert('2026-11-12', { date: '2026-11-12', availableMin: 0, blockers: [] });
      await dayRepo.upsert('2026-11-13', { date: '2026-11-13', availableMin: 0, blockers: [] });
      const a = await task('Später', { estimateMin: 30, plannedFor: '2026-11-12' });
      const r = await runPlanner(deps());
      expect(r.result!.assignments[0]!.date).toBe('2026-11-14');
      expect(await stored(a.id)).toMatchObject({
        plannedFor: '2026-11-14',
        planMark: { date: '2026-11-14', prior: '2026-11-12' },
      });
      const stop = start();
      await disableModule(manifest, policy);
      stop();
      const t = (await stored(a.id))!;
      expect(t.plannedFor).toBe('2026-11-12');
      expect(t.planMark).toBeUndefined();
      expect((await loadModuleStates([manifest])).planner).toBe(false);
      if (policy === 'delete') expect(await assignmentRepo.active().count()).toBe(0);
    }
  });

  it('… → the user clears the date → disabling leaves plannedFor empty', async () => {
    await modulesRow('todos', true);
    await enableModule(manifest);
    const a = await task('Später', { estimateMin: 30, plannedFor: '2026-11-12' });
    await runPlanner(deps());
    await taskRepo.update(a.id, { plannedFor: undefined, planMark: undefined });
    await runPlanner(deps());
    expect(await stored(a.id)).toMatchObject({
      plannedFor: '2026-11-12',
      planMark: { date: '2026-11-12' },
    });
    expect(((await stored(a.id))!.planMark as { prior?: string }).prior).toBeUndefined();
    const stop = start();
    await disableModule(manifest, 'keep');
    stop();
    expect((await stored(a.id))!.plannedFor).toBeUndefined();
  });

  it('a throwing disabling listener: state and wipe proceed; the ToDos clean the marks on their next start', async () => {
    await modulesRow('todos', true);
    await enableModule(manifest);
    const a = await task('A', { estimateMin: 30, plannedFor: '2026-11-11' });
    await runPlanner(deps());
    expect(await stored(a.id)).toMatchObject({ planMark: { prior: '2026-11-11' } });
    // The planner's own handler is not running; another listener throws.
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bus.on('module.disabling', () => {
      throw new Error('bug');
    });
    await disableModule(manifest, 'delete');
    err.mockRestore();
    expect(await assignmentRepo.active().count()).toBe(0);
    expect((await stored(a.id))!.planMark).toBeDefined();
    // The ToDos' service start (stored "off" + no sync) hands the date back.
    const todosStart = (await todos.contributions!.services!()).default;
    const stopTodos = todosStart();
    await vi.waitFor(async () => expect((await stored(a.id))!.planMark).toBeUndefined());
    expect((await stored(a.id))!.plannedFor).toBe('2026-11-11');
    stopTodos?.();
  });

  it('a late write-back after the planner was switched off is cleaned on the next start; a date never in prior is gone', async () => {
    await modulesRow('todos', true);
    await modulesRow('planner', false);
    const a = await task('Spät', { estimateMin: 30 });
    // The other device's run reaches us after the switch-off (no prior: the user never had a date).
    await (await plannableSource(todos))!.onAssign!(a.id, '2026-11-12', 0);
    expect(await stored(a.id)).toMatchObject({ plannedFor: '2026-11-12' });
    const stopTodos = (await todos.contributions!.services!()).default();
    await vi.waitFor(async () => expect((await stored(a.id))!.planMark).toBeUndefined());
    expect((await stored(a.id))!.plannedFor).toBeUndefined();
    stopTodos?.();
  });

  it('restoreSources touches only things with a mark', async () => {
    const writer = { onAssign: vi.fn(async () => undefined) };
    await restoreSources({
      today: TODAY,
      manifests: [] as ModuleManifest[],
      writer,
      entries: [
        {
          moduleId: 'todos',
          id: 'a',
          kind: 'task',
          title: 'A',
          to: '/a',
          plannedFor: '2026-11-10',
          planMark: { date: '2026-11-10', order: 0 },
        },
        {
          moduleId: 'todos',
          id: 'b',
          kind: 'task',
          title: 'B',
          to: '/b',
          plannedFor: '2026-11-10',
        },
      ],
    });
    expect(writer.onAssign).toHaveBeenCalledTimes(1);
    expect(writer.onAssign).toHaveBeenCalledWith('todos', 'a', undefined);
  });
});

describe('rows through putRow', () => {
  it('disable (delete) → enable → „Tag frei“ on that date is visible again', async () => {
    await modulesRow('todos', true);
    await enableModule(manifest);
    await putRow(dayRepo, '2026-11-12', { date: '2026-11-12', availableMin: 0, blockers: [] });
    await disableModule(manifest, 'delete');
    expect(await dayRepo.get('2026-11-12')).toBeUndefined();
    await enableModule(manifest);
    await setAvailable('2026-11-12', 0, {});
    await runsSettled();
    expect(await dayRepo.get('2026-11-12')).toMatchObject({ availableMin: 0 });
    // An identical write is no write.
    expect(
      await putRow(dayRepo, '2026-11-12', { date: '2026-11-12', availableMin: 0, blockers: [] }),
    ).toBe(false);
  });
});

describe('council round 1', () => {
  it('switching off hands a past user date back too (onRelease), while a run keeps it off today’s card', async () => {
    await modulesRow('todos', true);
    await enableModule(manifest);
    // Today is Monday 2026-11-09; the user's own date was last Friday.
    const a = await task('Alt', { estimateMin: 30, plannedFor: '2026-11-06' });
    await runPlanner(deps());
    expect(await stored(a.id)).toMatchObject({
      plannedFor: TODAY,
      planMark: { date: TODAY, prior: '2026-11-06' },
    });
    // Excluded by the user: the run lets go, a past prior stays away (it would land on today's card by itself).
    await putRow(itemRepo, `todos:${a.id}`, {
      source: { module: 'todos', id: a.id },
      excluded: true,
      order: 0,
    });
    await runPlanner(deps());
    expect((await stored(a.id))!.plannedFor).toBeUndefined();
    expect((await stored(a.id))!.planMark).toBeUndefined();
    // Switching the module off: the same past date comes back (the ToDo side's own clean-up rule).
    await putRow(itemRepo, `todos:${a.id}`, { source: { module: 'todos', id: a.id }, order: 0 });
    await taskRepo.update(a.id, { plannedFor: '2026-11-06' });
    await runPlanner(deps());
    expect(await stored(a.id)).toMatchObject({
      plannedFor: TODAY,
      planMark: { prior: '2026-11-06' },
    });
    const stop = start();
    await disableModule(manifest, 'keep');
    stop();
    expect((await stored(a.id))!.plannedFor).toBe('2026-11-06');
    expect((await stored(a.id))!.planMark).toBeUndefined();
  });

  it('a run queued after the planner was stored as off writes nothing (second tab, late run)', async () => {
    await modulesRow('todos', true);
    await task('A', { estimateMin: 30 });
    await modulesRow('planner', false);
    expect(await runBackground()).toBeUndefined();
    await expect(runUser('x', async () => undefined)).rejects.toThrow();
    expect(await assignmentRepo.active().count()).toBe(0);
  });

  it('the gate closes, then opens: the user date is overwritten without another write', async () => {
    await modulesRow('todos', true);
    await modulesRow('planner', true);
    await db
      .table('_secrets')
      .put({
        key: 'syncConfig',
        value: { kind: 'selfHosted', url: 'https://sync.example', token: 't' },
      });
    await db.table('_meta').put({ key: PULL_COMPLETE_KEY, value: false });
    const a = await task('Später Do', { estimateMin: 30, plannedFor: '2026-11-12' });
    setManifestsForTests(undefined);
    const stop = start();
    await vi.waitFor(async () => expect(await rows()).toHaveLength(1), { timeout: 4000 });
    // Gated: no copy, no mark.
    expect((await stored(a.id))!.planMark).toBeUndefined();
    expect(await itemRepo.get(`todos:${a.id}`)).toBeUndefined();
    // The round ends: the flag turns true and the service runs again by itself.
    await db.table('_meta').put({ key: PULL_COMPLETE_KEY, value: true });
    await db.table('_meta').put({ key: 'sync.lastSyncAt', value: NOW });
    await vi.waitFor(
      async () =>
        expect((await stored(a.id))!.planMark).toMatchObject({
          date: '2026-11-12',
          prior: '2026-11-12',
        }),
      { timeout: 4000 },
    );
    expect(await itemRepo.get(`todos:${a.id}`)).toMatchObject({ earliest: '2026-11-12' });
    stop();
    await runsSettled();
  });

  it('msUntilNextDay points just past the next local midnight', async () => {
    const { msUntilNextDay } = await import('../services');
    const at = new Date(2026, 10, 9, 23, 59, 0).getTime();
    expect(msUntilNextDay(at)).toBe(61_000);
    expect(msUntilNextDay(new Date(2026, 10, 9, 0, 0, 0, 500).getTime())).toBe(24 * 3600_000 + 500);
  });
});
