import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getMeta, setMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import { getManifest } from '@/core/modules/registry';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { addRequested, setAvailable } from '../actions';
import { automation, overloadEvent } from '../automation';
import { buildBoard } from '../board';
import manifest from '../manifest';
import {
  isoWeekOf,
  OVERLOAD_WEEK_KEY,
  overloadLine,
  overloadText,
  shouldToastOverload,
} from '../overload';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import { LAST_RUN_KEY, runPlanner, type LastRun } from '../run';
import start, { runsSettled, setManifestsForTests } from '../services';
import { DEFAULT_PLANNER_SETTINGS, PLANNER_SCOPE } from '../settings';

const TODAY = '2026-11-09'; // Monday
const NOW = new Date(2026, 10, 9, 10, 0).getTime();
const todos = getManifest('todos')!;
const invoices = getManifest('invoices')!;
const taskRepo = createCollectionRepo(todos, 'task');
const invoiceRepo = createCollectionRepo(invoices, 'invoice');
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
const messages = () => useUiStore.getState().toasts.map((t) => t.message);

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    'todos_list',
    'invoices_invoice',
    'calendar_event',
    '_settings',
    '_meta',
    '_modules',
    '_outbox',
  ])
    await db.table(t).clear();
  await createCollectionRepo(todos, 'list').create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
  await modulesRow('todos', true);
  await modulesRow('planner', true);
  // 60 minutes on weekdays (48 plannable with the 20 % buffer), weekends off, one week: 240 minutes.
  await setSettings(PLANNER_SCOPE, {
    availableWeekday: 60,
    availableSaturday: 0,
    availableSunday: 0,
    horizonDays: '7',
  });
  bus.clear();
  useUiStore.setState({ toasts: [] });
  setManifestsForTests(async () => [todos, invoices]);
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
  bus.clear();
});

describe('plan.requested', () => {
  it('a note’s request → ToDo with the link back + planner item with the hard due, one toast with the day', async () => {
    expect(
      await addRequested({
        title: 'Vermieter antworten',
        durationMin: 30,
        priority: 3,
        due: { date: '2026-11-12', hard: true },
        link: { kind: 'note', id: 'n1', label: 'Vermieter antworten' },
      }),
    ).toBe(true);
    const [task] = await taskRepo.active().toArray();
    expect(task).toMatchObject({
      title: 'Vermieter antworten',
      estimateMin: 30,
      priority: 3,
      dueDate: '2026-11-12',
      links: [{ kind: 'note', id: 'n1', label: 'Vermieter antworten' }],
      plannedFor: TODAY,
    });
    expect(await itemRepo.get(`todos:${task!.id}`)).toMatchObject({
      due: { date: '2026-11-12', hard: true },
    });
    expect(messages()).toEqual(['Im Plan: Vermieter antworten · Mo']);
    expect(useUiStore.getState().toasts[0]?.action?.label).toBe('Rückgängig');
  });

  it('a soft due stays the ToDo’s own date; an empty title does nothing', async () => {
    await addRequested({ title: 'Lesen', due: { date: '2026-11-13', hard: false } });
    const [task] = await taskRepo.active().toArray();
    expect(task?.dueDate).toBe('2026-11-13');
    expect((await itemRepo.get(`todos:${task!.id}`))?.due).toBeUndefined();
    expect(await addRequested({ title: '  ' })).toBe(false);
  });

  it('the service listens while it runs, and stops listening when it stops', async () => {
    setManifestsForTests(undefined);
    const stop = start();
    await bus.emit('plan.requested', { title: 'Über den Bus', durationMin: 15 });
    await runsSettled();
    expect((await taskRepo.active().toArray()).map((t) => t.title)).toEqual(['Über den Bus']);
    stop();
    await bus.emit('plan.requested', { title: 'Nicht mehr', durationMin: 15 });
    expect(await taskRepo.active().count()).toBe(1);
  });
});

describe('overload figure', () => {
  it('0 → above 0 gives one toast line; a second add in the overloaded week gives none', async () => {
    await addRequested({ title: 'Klein', durationMin: 30 });
    expect(messages()).toEqual(['Im Plan: Klein · Mo']);
    useUiStore.setState({ toasts: [] });
    await addRequested({ title: 'Groß', durationMin: 300 });
    const over = (await getMeta<LastRun>(LAST_RUN_KEY))!.overflowMin;
    expect(over).toBe(90);
    // Too big for the week: it waits, and the second line of the same toast names the overload.
    expect(messages()).toEqual([`Im Plan: Groß · wartet\n${overloadText(90)}`]);
    // One toast: the undo stays.
    expect(useUiStore.getState().toasts[0]?.action?.label).toBe('Rückgängig');
    expect(await getMeta(OVERLOAD_WEEK_KEY)).toBe('2026-W46');
    useUiStore.setState({ toasts: [] });
    await addRequested({ title: 'Noch eins', durationMin: 30 });
    expect(messages()).toHaveLength(1);
    expect(messages()[0]).toMatch(/^Im Plan: Noch eins/);
    expect(messages()[0]).not.toMatch(/mehr zu tun/);
  });

  it('back to 0 and above 0 again in the same week: still quiet (once per ISO week)', async () => {
    await addRequested({ title: 'Groß', durationMin: 300 });
    expect(messages()[0]).toContain(overloadText(60));
    await setAvailable('2026-11-14', 240, {}); // Saturday gets time: overflow 0
    expect((await getMeta<LastRun>(LAST_RUN_KEY))!.overflowMin).toBe(0);
    useUiStore.setState({ toasts: [] });
    await addRequested({ title: 'Mehr', durationMin: 300 });
    expect((await getMeta<LastRun>(LAST_RUN_KEY))!.overflowMin).toBeGreaterThan(0);
    expect(messages().filter((m) => /mehr zu tun/.test(m))).toEqual([]);
  });

  it('switch `overloadToast` off → no line, the figure stays in the stored run', async () => {
    await setSettings(PLANNER_SCOPE, { overloadToast: false });
    await addRequested({ title: 'Groß', durationMin: 300 });
    expect(messages().filter((m) => /mehr zu tun/.test(m))).toEqual([]);
    expect((await getMeta<LastRun>(LAST_RUN_KEY))!.overflowMin).toBe(60);
  });

  it('pure rules: ISO weeks, the once-per-week gate', async () => {
    expect(isoWeekOf('2026-11-09')).toBe('2026-W46');
    expect(isoWeekOf('2027-01-01')).toBe('2026-W53');
    expect(isoWeekOf('2026-01-01')).toBe('2026-W01');
    const base = { enabled: true, prevMin: 0, nextMin: 30, week: '2026-W46', lastWeek: undefined };
    expect(shouldToastOverload(base)).toBe(true);
    expect(shouldToastOverload({ ...base, prevMin: 10 })).toBe(false);
    expect(shouldToastOverload({ ...base, nextMin: 0 })).toBe(false);
    expect(shouldToastOverload({ ...base, enabled: false })).toBe(false);
    expect(shouldToastOverload({ ...base, lastWeek: '2026-W46' })).toBe(false);
    expect(shouldToastOverload({ ...base, lastWeek: '2026-W45' })).toBe(true);
    await setMeta(OVERLOAD_WEEK_KEY, '2026-W45');
    expect(await overloadLine({ enabled: true, prevMin: 0, nextMin: 160, today: TODAY })).toBe(
      '2 h 40 mehr zu tun, als Zeit frei ist',
    );
    expect(
      await overloadLine({ enabled: true, prevMin: 0, nextMin: 160, today: TODAY }),
    ).toBeUndefined();
  });
});

describe('the automation event planner.overloaded', () => {
  it('reports the overflow of today’s run once per ISO week; no watch, no actions', async () => {
    expect(automation.watch).toBeUndefined();
    expect(automation.actions).toBeUndefined();
    expect(Object.keys(automation.events ?? {})).toEqual(['planner.overloaded']);
    expect(manifest.automation).toBeDefined();
    const last = { today: TODAY, overflowMin: 160 };
    expect(overloadEvent(last, TODAY, NOW)).toEqual({
      type: 'planner.overloaded',
      moduleId: 'planner',
      key: 'planner.overloaded:2026-W46',
      at: NOW,
      data: { overMin: 160, week: '2026-W46' },
    });
    expect(overloadEvent({ ...last, overflowMin: 0 }, TODAY, NOW)).toBeUndefined();
    expect(overloadEvent({ ...last, today: '2026-11-08' }, TODAY, NOW)).toBeUndefined();
    expect(overloadEvent(undefined, TODAY, NOW)).toBeUndefined();
    // The detector reads the stored run.
    await addRequested({ title: 'Groß', durationMin: 300 });
    const events = await automation.detectors![0]!({ at: NOW, today: TODAY });
    expect(events.map((e) => e.data)).toEqual([{ overMin: 60, week: '2026-W46' }]);
  });
});

describe('invoices in the plan', () => {
  it('an invoice due Thursday is planned before its deadline and shows it; paid → the item goes', async () => {
    const inv = await invoiceRepo.create({
      payee: 'Stadtwerke',
      amountMinor: 8990,
      dueDate: '2026-11-12',
      status: 'open',
    });
    const deps = {
      today: TODAY,
      manifests: [todos, invoices],
      settings: { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' as const },
      planLimit: 3,
      settled: true,
    };
    const r = await runPlanner(deps);
    const a = r.result!.assignments.find((x) => x.itemKey === `invoices:${inv.id}`)!;
    expect(a.date <= '2026-11-12').toBe(true);
    expect(a.minutes).toBe(10);
    const board = buildBoard({
      today: TODAY,
      span: 7,
      settings: deps.settings,
      dayRows: await dayRepo.active().toArray(),
      itemRows: await itemRepo.active().toArray(),
      assignments: await assignmentRepo.active().toArray(),
      entries: r.inputs.entries,
      calendar: [],
      unplaced: r.result!.unplaced,
      titles: r.inputs.titles,
    });
    const row = board.days.flatMap((d) => d.rows).find((x) => x.itemKey === `invoices:${inv.id}`);
    expect(row).toMatchObject({ title: 'Stadtwerke bezahlen', hardDue: '2026-11-12' });
    // Nothing was written back to the invoice.
    expect(await invoiceRepo.get(inv.id)).toMatchObject({ status: 'open' });
    await invoiceRepo.update(inv.id, { status: 'paid', paidAt: TODAY });
    await runPlanner(deps);
    expect(
      (await assignmentRepo.active().toArray()).filter((x) => x.itemKey === `invoices:${inv.id}`),
    ).toEqual([]);
  });
});
