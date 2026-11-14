// @vitest-environment jsdom
/**
 * „Tage einteilen“ (use case „Wochenende retten“, package 2): the dump's lines, the preview items, the chips,
 * the draft, and „Übernehmen“ as one undoable action that writes only the shown days' rows and the ToDos.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { applyDaySetup } from '../actions';
import {
  clearSetupDraft,
  gainsTime,
  previewItems,
  readSetupDraft,
  SETUP_CHIPS,
  setupLines,
  setupThings,
  writeSetupDraft,
} from '../daySetup';
import manifest from '../manifest';
import { getPlannerSettings } from '../prefs';
import { dayRepo, itemRepo } from '../repo';
import { previewUser, runsSettled, setManifestsForTests } from '../services';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

const SAT = '2026-11-14';
const SUN = '2026-11-15';
const MON = '2026-11-16';
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 14, 8, 30).getTime());
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
  clearSetupDraft();
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
});

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

describe('the dump', () => {
  it('one line = one thing; blanks and list markers go', () => {
    expect(setupLines('- Duschen\n\n  2. Bude aufräumen \n• Pfand\n')).toEqual([
      'Duschen',
      'Bude aufräumen',
      'Pfand',
    ]);
  });

  it('reads each line like the planner field: „bis So“ is a hard deadline on Sunday', () => {
    const things = setupThings('Team-Sachen lesen bis So 18:00\nDuschen', SAT, true);
    expect(things).toHaveLength(2);
    expect(things[0]).toMatchObject({ hardDue: SUN, fields: { date: SUN } });
    expect(things[0]!.fields.title).toMatch(/^Team-Sachen lesen/);
    expect(things[1]).toMatchObject({ key: 'new:1', fields: { title: 'Duschen' } });
    expect(things[1]!.hardDue).toBeUndefined();
  });

  it('becomes preview items the way the ToDos source will report them', () => {
    const [team, shower] = previewItems(setupThings('Team bis So\nDuschen', SAT, true), 1000);
    expect(team).toMatchObject({ key: 'new:0', due: { date: SUN, hard: true }, createdAt: 1000 });
    expect(shower).toMatchObject({ key: 'new:1', priority: 0, splittable: true, createdAt: 1001 });
    expect(shower!.due).toBeUndefined();
  });

  it('distributes anew only when a day gains time (W10: a Sunday given 4 h takes things)', () => {
    const days = [
      { date: SAT, availableMin: 120 },
      { date: SUN, availableMin: 0 },
    ];
    expect(gainsTime(days, {})).toBe(false);
    expect(gainsTime(days, { [SAT]: 0 })).toBe(false);
    expect(gainsTime(days, { [SUN]: 240 })).toBe(true);
  });

  it('the chips are „keine Zeit · 2 h · 4 h · 6 h · ganzer Tag“ in minutes', () => {
    expect(SETUP_CHIPS).toEqual([0, 120, 240, 360, 720]);
  });

  it('keeps a draft on this device until it is cleared; blank text keeps none', () => {
    writeSetupDraft('Duschen');
    expect(readSetupDraft()).toBe('Duschen');
    writeSetupDraft('  ');
    expect(readSetupDraft()).toBe('');
    writeSetupDraft('Pfand');
    setNow(() => new Date(2026, 10, 15, 9, 0).getTime());
    expect(readSetupDraft()).toBe(''); // a day later the draft is gone
  });
});

describe('preview and „Übernehmen“', () => {
  it('the preview plans the new things on the days with time and stores nothing', async () => {
    await on();
    const things = setupThings('Duschen\nBude aufräumen', SAT, true);
    const out = await previewUser(
      [
        { op: 'available', date: SAT, min: 0 },
        { op: 'available', date: SUN, min: 240 },
      ],
      previewItems(things, 1),
    );
    const added = out.result.diff.added.map((a) => [a.id.split('#')[0], a.to]);
    expect(added).toEqual([
      ['new:0', SUN],
      ['new:1', SUN],
    ]);
    expect(await taskRepo.active().count()).toBe(0);
    expect(await dayRepo.active().count()).toBe(0);
  });

  it('writes the chosen days and the ToDos as one action; Sunday with time takes things; one undo takes all back', async () => {
    await on();
    const things = setupThings('Duschen\nTeam-Sachen bis So', SAT, true);
    const ok = await applyDaySetup(
      [
        { date: SAT, min: 0 },
        { date: SUN, min: 240 },
      ],
      things,
      [SAT, SUN, MON],
      {},
    );
    await runsSettled();
    expect(ok).toBe(true);
    expect((await dayRepo.get(SAT))?.availableMin).toBe(0);
    expect((await dayRepo.get(SUN))?.availableMin).toBe(240);
    expect(await dayRepo.get(MON)).toBeUndefined(); // untouched day: nothing written
    const tasks = await taskRepo.active().toArray();
    expect(tasks.map((x) => x.title).sort()).toEqual(['Duschen', 'Team-Sachen']);
    const team = tasks.find((x) => x.title === 'Team-Sachen')!;
    expect((await itemRepo.get(`todos:${team.id}`))?.due).toEqual({ date: SUN, hard: true });
    // The weekday defaults stay as they are.
    expect(await getPlannerSettings()).toEqual(DEFAULT_PLANNER_SETTINGS);
    const toast = useUiStore.getState().toasts.at(-1)!;
    expect(toast.message).toBe('Eingeplant: Sa, So, Mo');
    expect(toast.action?.label).toBe('Rückgängig');
    toast.action!.run();
    await expect.poll(async () => taskRepo.active().count()).toBe(0);
    await expect.poll(async () => (await dayRepo.get(SUN))?.availableMin).toBeUndefined();
  });
});
