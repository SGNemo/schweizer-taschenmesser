// @vitest-environment jsdom
/**
 * Measured duration (planner hub 2, package 8; hand-off 08 „Tests“): the key (source id before title, `pastePlan`'s
 * normalisation), cap and median, pruning inside the recording action (one undo), a proposal for a **new** thing only –
 * nothing that exists changes its minutes – and `planner_measure` in no share file, diagnosis, data API, copy text or
 * assistant path.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { apiCollections } from '@/core/dataapi/scope';
import { buildDiagnostics } from '@/core/diagnostics/export';
import { enableModule } from '@/core/modules/activation';
import { collectPlannable } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { setSettings } from '@/core/settings/settings';
import { shareableTables } from '@/core/share/share';
import { setNow } from '@/core/time/now';
import { resetUndoJournal, undoable, undoDepth, undoLast } from '@/core/undo';
import { startSession, pause } from '@/core/focus/session';
import { addFromField, markDone, setEstimate } from '../actions';
import manifest from '../manifest';
import {
  measureKey,
  proposalOf,
  proposedMinutes,
  recordMeasure,
  recordsOf,
  titleKey,
  workedMinutes,
} from '../measure';
import { itemRepo, measureRepo } from '../repo';
import { runsSettled, setManifestsForTests } from '../services';
import { PLANNER_SCOPE } from '../settings';

const DAY = '2026-11-14';
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');
const WASH = titleKey('Wäsche anstellen')!;

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 14, 10, 0).getTime());
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'planner_measure',
    'todos_task',
    'todos_list',
    '_settings',
    '_meta',
    '_modules',
  ])
    await db.table(t).clear();
  resetUndoJournal();
  setManifestsForTests(async () => [todos]);
  await createCollectionRepo(todos, 'list').create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
  await db.table('_modules').put(
    {
      id: 'todos',
      enabled: true,
      dataPolicy: null,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    },
    20_000,
  );
  await enableModule(manifest);
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
});

const entries = () => collectPlannable({ today: DAY, until: '2026-11-20' }, [todos]);
const record = (key: string, minutes: number) => undoable('rec', () => recordMeasure(key, minutes));

describe('the key and the arithmetic', () => {
  it('a title as „Plan einfügen“ compares it; a source id that comes back first', () => {
    expect(titleKey('  „Wäsche   anstellen“ !')).toBe(WASH);
    expect(titleKey('Wäsche anstellen 2')).not.toBe(WASH);
    expect(measureKey({ moduleId: 'routines', title: 'Bad', entityId: 'r1' })).toBe(
      'id:routines:r1',
    );
    expect(measureKey({ moduleId: 'todos', title: 'Wäsche anstellen' })).toBe(WASH);
  });

  it('median of the last five, rounded to 5, at least 5; none below two records', () => {
    expect(proposalOf([])).toBeUndefined();
    expect(proposalOf([20])).toBeUndefined();
    expect(proposalOf([8, 12])).toBe(10);
    expect(proposalOf([20, 25, 15])).toBe(20);
    expect(proposalOf([2, 3])).toBe(5);
    // Only the last five count (newest first).
    expect(proposalOf([20, 20, 20, 90, 90, 90, 90])).toBe(20);
  });

  it("a round's worked minutes: pauses out, overtime in", () => {
    const t0 = 1_000_000;
    const s = startSession({ id: 'u', title: 'x' }, 25, t0);
    expect(workedMinutes(s, t0 + 12 * 60_000)).toBe(12);
    const paused = pause(s, t0 + 10 * 60_000);
    expect(workedMinutes(paused, t0 + 60 * 60_000)).toBe(10);
    expect(workedMinutes(s, t0 + 31 * 60_000)).toBe(31);
  });
});

describe('recording', () => {
  it('keeps five per key, pruned inside the action: one undo takes the new one back and the pruned one with it', async () => {
    for (const [i, m] of [10, 11, 12, 13, 14].entries()) {
      setNow(() => new Date(2026, 10, 14, 10, i).getTime());
      await record(WASH, m);
    }
    setNow(() => new Date(2026, 10, 14, 11, 0).getTime());
    resetUndoJournal();
    await record(WASH, 15);
    expect((await recordsOf(WASH)).map((r) => r.minutes)).toEqual([15, 14, 13, 12, 11]);
    expect(undoDepth()).toBe(1);
    await undoLast();
    expect((await recordsOf(WASH)).map((r) => r.minutes)).toEqual([14, 13, 12, 11, 10]);
  });

  it('nothing under a minute, over eight hours, or while the switch is off', async () => {
    await record(WASH, 0.4);
    await record(WASH, 481);
    await setSettings(PLANNER_SCOPE, { measurePropose: false });
    await record(WASH, 20);
    expect(await measureRepo.active().count()).toBe(0);
  });

  it('„Erledigt“ of a focus round records in its own act: one undo brings back the ToDo and drops the record', async () => {
    await taskRepo.create({
      listId: 'inbox',
      done: false,
      priority: 0,
      order: 0,
      title: 'Wäsche anstellen',
    });
    const [e] = await entries();
    expect(await markDone(e!, {}, 12)).toBe(true);
    await runsSettled();
    expect((await recordsOf(WASH)).map((r) => r.minutes)).toEqual([12]);
    expect(undoDepth()).toBe(1);
    await undoLast();
    expect(await measureRepo.active().count()).toBe(0);
    expect((await taskRepo.get(e!.id))?.done).toBe(false);
  });
});

describe('the proposal', () => {
  it('a new thing without minutes starts with the median (Z1 marked); its ToDo estimate stays untouched', async () => {
    await record(WASH, 8);
    await record(WASH, 12);
    expect(await proposedMinutes('Wäsche anstellen')).toBe(10);
    expect(await addFromField('Wäsche anstellen', {})).toBe(true);
    await runsSettled();
    const [task] = (await taskRepo.active().toArray()) as unknown as {
      id: string;
      estimateMin?: number;
    }[];
    expect(task!.estimateMin).toBeUndefined();
    expect(await itemRepo.get(`todos:${task!.id}`)).toMatchObject({
      durationMin: 10,
      measured: true,
    });
  });

  it('one record, minutes in the line, or the switch off: no proposal', async () => {
    await record(WASH, 8);
    expect(await proposedMinutes('Wäsche anstellen')).toBeUndefined();
    await record(WASH, 12);
    expect(await addFromField('Wäsche anstellen 15 Min', {})).toBe(true);
    await runsSettled();
    expect((await itemRepo.active().toArray()).some((r) => r.measured)).toBe(false);
    await setSettings(PLANNER_SCOPE, { measurePropose: false });
    expect(await proposedMinutes('Wäsche anstellen')).toBeUndefined();
  });

  it('nothing that exists changes its minutes; „Dauer …“ clears the mark', async () => {
    await taskRepo.create({
      listId: 'inbox',
      done: false,
      priority: 0,
      order: 0,
      title: 'Wäsche anstellen',
    });
    const before = JSON.stringify(await itemRepo.active().toArray());
    await record(WASH, 8);
    await record(WASH, 12);
    expect(JSON.stringify(await itemRepo.active().toArray())).toBe(before);

    expect(await addFromField('Bad wischen', {})).toBe(true);
    const bath = titleKey('Bad wischen')!;
    await record(bath, 20);
    await record(bath, 20);
    expect(await addFromField('Bad wischen', {})).toBe(true);
    await runsSettled();
    const fresh = (await entries()).filter((e) => e.title === 'Bad wischen').at(-1)!;
    expect(await itemRepo.get(`todos:${fresh.id}`)).toMatchObject({ measured: true });
    expect(await setEstimate(fresh, 30, {})).toBe(true);
    await runsSettled();
    const row = await itemRepo.get(`todos:${fresh.id}`);
    expect(row?.measured).toBeUndefined();
    expect(row?.durationMin).toBeUndefined();
  });
});

describe('planner_measure stays his own', () => {
  const table = 'planner_measure';
  it('no share file, no data API, no assistant schema; the module has no data API', () => {
    expect(shareableTables()).not.toContain(table);
    expect(shareableTables()).toContain('planner_item');
    expect(apiCollections(manifest)).not.toContain('measure');
    expect(manifest.dataApi).toBe(false);
    expect(manifest.aiSchema).toBeUndefined();
    expect(manifest.dataSchema.collections.measure).toMatchObject({ personal: true });
  });

  it('a diagnosis does not count it', async () => {
    const without = (await buildDiagnostics()).counts.planner;
    await record(WASH, 12);
    await record(WASH, 14);
    expect(await measureRepo.active().count()).toBe(2);
    expect((await buildDiagnostics()).counts.planner).toBe(without);
  });

  it("the copy text and the planner's assistant paths never read it", () => {
    const src = (f: string) => readFileSync(resolve(__dirname, '..', f), 'utf8');
    for (const f of ['copyPlan.ts', 'say.ts', 'automation.ts'])
      expect(src(f)).not.toMatch(/measure/i);
  });
});
