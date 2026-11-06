/**
 * Package 5: time windows in the module – settings → days → run → stored times → calendar blocks,
 * the day's own window, and the week templates. Minutes stay the truth throughout.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import type { CalendarItem } from '@/core/modules/types';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { clearWindow, confirmWeek, setWindow } from '../actions';
import { planChips } from '../calendar';
import { planDays } from '../days';
import manifest from '../manifest';
import { migrations } from '../migrations';
import { assignmentRepo, dayRepo } from '../repo';
import { runPlanner, type RunDeps } from '../run';
import { runsSettled, setManifestsForTests } from '../services';
import {
  DEFAULT_PLANNER_SETTINGS,
  defaultWindow,
  PLANNER_SCOPE,
  plannerSettingsSchema,
} from '../settings';

const TODAY = '2026-11-09'; // Monday
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
const H = { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' as const };
const WIN = { ...H, windowWeekday: '09:00–17:00' };

const deps = (over: Partial<RunDeps> = {}): RunDeps => ({
  today: TODAY,
  manifests: [todos],
  settings: H,
  planLimit: 3,
  settled: true,
  calendar: [],
  ...over,
});
const task = (title: string, over: Record<string, unknown> = {}) =>
  taskRepo.create({ ...base, title, ...over });
const times = async () =>
  (await assignmentRepo.active().toArray())
    .map((a) => [a.date, a.minutes, a.from, a.to] as const)
    .sort();
const appointment = (over: Partial<CalendarItem> = {}): CalendarItem => ({
  id: 'e1',
  source: 'calendar',
  kind: 'event',
  title: 'Zahnarzt',
  date: TODAY,
  allDay: false,
  time: '09:30',
  endTime: '10:30',
  ...over,
});

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 9, 10, 0).getTime());
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
  setManifestsForTests(async () => [todos]);
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
});

describe('window settings', () => {
  it('read leniently, written back in one form; an unreadable text is no window and fails nothing', () => {
    const v = plannerSettingsSchema.parse({
      ...DEFAULT_PLANNER_SETTINGS,
      windowWeekday: '9-17',
      windowSaturday: 'vormittags',
      availableWeekday: 180,
    });
    expect(v.windowWeekday).toBe('09:00–17:00');
    expect(v.availableWeekday).toBe(180);
    expect(defaultWindow(v, 1)).toEqual({ from: '09:00', to: '17:00' });
    expect(defaultWindow(v, 6)).toBeUndefined();
    expect(defaultWindow(v, 7)).toBeUndefined();
    // Defaults: no windows, the plan stays as before.
    expect(defaultWindow(DEFAULT_PLANNER_SETTINGS, 1)).toBeUndefined();
  });

  it('the shape step to v2 is recorded and keeps old rows as they are', () => {
    expect(manifest.version).toBe(2);
    expect(Object.keys(migrations ?? {})).toEqual(['2']);
  });
});

describe('days with windows', () => {
  it('the day’s own window beats the weekday’s; blockers keep their times, a calendar item gets its own', () => {
    const days = planDays({
      today: TODAY,
      span: 7,
      settings: WIN,
      dayRows: [
        {
          date: '2026-11-10',
          blockers: [{ id: 'b', label: 'Werkstatt', min: 120, from: '14:00', to: '16:00' }],
          from: '07:00',
          to: '12:00',
        },
      ],
      calendar: [appointment()],
    });
    expect(days[0]).toMatchObject({ window: { from: '09:00', to: '17:00' } });
    expect(days[0]!.ownWindow).toBeUndefined();
    expect(days[0]!.blockers).toEqual([
      expect.objectContaining({ min: 60, from: '09:30', to: '10:30', calendar: true }),
    ]);
    expect(days[1]).toMatchObject({ window: { from: '07:00', to: '12:00' }, ownWindow: true });
    expect(days[1]!.blockers[0]).toMatchObject({ from: '14:00', to: '16:00', min: 120 });
    // Saturday and Sunday have no window in the settings.
    expect(days[5]!.window).toBeUndefined();
  });
});

describe('a run with windows', () => {
  it('without a window: rows as before, no times', async () => {
    await task('Steuer', { estimateMin: 120, priority: 2 });
    await runPlanner(deps());
    expect((await times()).every(([, , from]) => from === undefined)).toBe(true);
  });

  it('stores times around a timed appointment; minutes unchanged; a forced rerun writes nothing', async () => {
    await task('Steuer', { estimateMin: 120, priority: 2 });
    await task('Kurz', { estimateMin: 10 });
    await runPlanner(deps());
    const minutesBefore = (await times()).map(([d, m]) => [d, m]);
    await runPlanner(deps({ settings: WIN, calendar: [appointment()] }));
    // The appointment 09:30–10:30 leaves 09:00–09:30 too short for the first hour of „Steuer“:
    // it starts after the appointment, „Kurz“ follows after a short pause. Only the times are new.
    const rows = await times();
    expect(rows).toEqual([
      [TODAY, 10, '11:45', '11:55'],
      [TODAY, 60, '10:30', '11:30'],
      ['2026-11-10', 60, '09:00', '10:00'],
    ]);
    expect(rows.map(([d, m]) => [d, m])).toEqual(minutesBefore);
    const again = await runPlanner(deps({ settings: WIN, calendar: [appointment()] }), {
      force: true,
    });
    expect(again.rowWrites).toBe(0);
  });

  it('the window going away removes the times again', async () => {
    await task('Steuer', { estimateMin: 45 });
    await runPlanner(deps({ settings: WIN }));
    expect((await times())[0]).toEqual([TODAY, 45, '09:00', '09:45']);
    await runPlanner(deps());
    expect((await times())[0]).toEqual([TODAY, 45, undefined, undefined]);
  });
});

describe('calendar blocks', () => {
  it('a timed session is a block of its own; the rest of the day stays one chip', () => {
    const items = planChips(
      [
        { date: TODAY, itemKey: 'todos:a', minutes: 60, k: 0, of: 2, from: '09:00', to: '10:00' },
        { date: TODAY, itemKey: 'todos:b', minutes: 30 },
        { date: '2026-11-10', itemKey: 'todos:a', minutes: 60, k: 1, of: 2 },
      ],
      { 'todos:a': 'Steuer' },
    );
    expect(
      items.map((i) => [i.date, i.title, i.allDay, i.time ?? null, i.endTime ?? null]),
    ).toEqual([
      [TODAY, 'Plan · 30 Min · 1 Ding', true, null, null],
      [TODAY, 'Steuer · Teil 1/2', false, '09:00', '10:00'],
      ['2026-11-10', 'Plan · 1 h · 1 Ding', true, null, null],
    ]);
    expect(items.every((i) => i.kind === 'plan' && i.to?.startsWith('/planner?day='))).toBe(true);
  });

  it('a block without a known title says „Im Plan“', () => {
    const [block] = planChips([
      { date: TODAY, itemKey: 'todos:x', minutes: 30, k: 0, of: 1, from: '09:00', to: '09:30' },
    ]);
    expect(block?.title).toBe('Im Plan');
  });
});

describe('actions', () => {
  const on = async () => {
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
  };

  it('setWindow stores the day’s window, clearWindow drops it; minutes untouched', async () => {
    await on();
    await setWindow(TODAY, { from: '08:00', to: '12:00' }, {});
    await runsSettled();
    expect(await dayRepo.get(TODAY)).toMatchObject({ from: '08:00', to: '12:00' });
    expect((await dayRepo.get(TODAY))!.availableMin).toBeUndefined();
    expect(useUiStore.getState().toasts.at(-1)?.message).toContain('Zeitfenster 08:00–12:00');
    await clearWindow(TODAY, {});
    await runsSettled();
    expect((await dayRepo.get(TODAY))!.from).toBeUndefined();
  });

  it('„Krank“: today on 0 minutes, one calm sentence; „Arbeitswoche“ hands the minutes back to the settings', async () => {
    await on();
    await setSettings(PLANNER_SCOPE, { windowWeekday: '09:00–17:00' });
    await dayRepo.upsert('2026-11-10', {
      date: '2026-11-10',
      availableMin: 60,
      blockers: [],
      from: '07:00',
      to: '08:00',
    });
    const week = [
      { date: TODAY, availableMin: 0, current: 240, defaultMin: 240 },
      { date: '2026-11-10', availableMin: 60, current: 60, defaultMin: 240 },
    ];
    await confirmWeek(week, {}, 'sick');
    await runsSettled();
    expect(await dayRepo.get(TODAY)).toMatchObject({ availableMin: 0 });
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe(
      'Ruh dich aus – der Plan rückt ruhig weiter.',
    );
    await confirmWeek(
      [
        { date: TODAY, availableMin: 240, current: 0, defaultMin: 240 },
        { date: '2026-11-10', availableMin: 240, current: 60, defaultMin: 240 },
      ],
      {},
      'work',
    );
    await runsSettled();
    const [mon, tue] = [await dayRepo.get(TODAY), await dayRepo.get('2026-11-10')];
    expect(mon?.availableMin).toBeUndefined();
    expect(tue?.availableMin).toBeUndefined();
    // The day's own window is not on the sheet: the template leaves it alone.
    expect(tue).toMatchObject({ from: '07:00', to: '08:00' });
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe(
      'Arbeitswoche eingetragen – die übliche Zeit je Tag.',
    );
  });
});
