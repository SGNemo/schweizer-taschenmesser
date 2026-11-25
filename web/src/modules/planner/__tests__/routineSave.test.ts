// @vitest-environment jsdom
/**
 * „Als Routine speichern“ (planner hub 2, package 5a; hand-off 05 „Tests“): offered only while routines is on and only for
 * a plain-task ToDo (a mail ToDo with a legacy `links[]` entry, also one without a `_links` row, never); a name that
 * exists → B25, nothing sent or written; the handler fails → X7; success → B16 and one undo entry that takes it back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import type { PlannableEntry } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { resetUndoJournal, undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { canSaveAsRoutine, saveAsRoutine } from '../routineSave';
import { setManifestsForTests } from '../services';

const stamp = { createdAt: 1, updatedAt: 1, deviceId: 't', deletedAt: null, _f: {} };
const mod = (id: string, enabled = true) => ({ id, enabled, dataPolicy: null, ...stamp });
const routines = () => createCollectionRepo(getManifest('routines')!, 'routine');
const entry = (over: Partial<PlannableEntry> = {}): PlannableEntry => ({
  moduleId: 'todos',
  id: 't1',
  kind: 'task',
  title: 'Haushalt',
  to: '/todos?open=t1',
  steps: [
    { id: 'c1', title: 'Wäsche anstellen', done: false },
    { id: 'c2', title: 'Bad wischen', done: true },
  ],
  ...over,
});
/** What the routines module's own service does on `routine.requested` (written here through the generic repo). */
const addRoutine = (req: { name: string; steps: string[] }) =>
  routines().create({
    name: req.name,
    repeat: { freq: 'weekly', interval: 1 },
    startDate: '2026-11-30',
    dueDate: '2026-11-30',
    people: [],
    turn: 0,
    steps: req.steps.map((text, i) => ({ id: `s${i}`, text })),
  });
const toasts = () => useUiStore.getState().toasts.map((x) => x.message);
const open = vi.fn();

let off: (() => void) | undefined;
beforeEach(async () => {
  setNow(() => new Date(2026, 10, 30, 10, 0).getTime());
  for (const t of [
    'routines_routine',
    '_links',
    '_modules',
    'planner_item',
    'planner_assignment',
    '_meta',
  ])
    await db.table(t).clear();
  await db.table('_modules').bulkPut([mod('planner'), mod('todos'), mod('routines')]);
  setManifestsForTests(async () => [getManifest('todos')!]);
  useUiStore.setState({ toasts: [] });
  resetUndoJournal();
  bus.clear();
  // The routines module's service, as it runs while the module is on (awaitable since package 5a).
  off = bus.on('routine.requested', (req) => addRoutine(req).then(() => undefined));
});
afterEach(() => {
  off?.();
  setNow();
});

describe('„Als Routine speichern“', () => {
  it('only while routines is on, only for a plain-task ToDo', async () => {
    expect(await canSaveAsRoutine(entry())).toBe(true);
    // A mail ToDo: a legacy `links[]` entry, no `_links` row – never.
    expect(
      await canSaveAsRoutine(entry({ link: { kind: 'mail', id: 'th1', label: 'Mail' } })),
    ).toBe(false);
    // A list or a routine is not offered here (its own page has it, or it is one).
    expect(await canSaveAsRoutine(entry({ moduleId: 'lists', kind: 'shopping' }))).toBe(false);
    await db.table('_modules').put(mod('routines', false));
    expect(await canSaveAsRoutine(entry())).toBe(false);
  });

  it('success: the routine with the steps, B16 with „Ansehen“, one undo entry that takes it back', async () => {
    expect(await saveAsRoutine(entry(), {}, open)).toBe(true);
    const rows = (await routines().active().toArray()) as unknown as {
      name: string;
      steps: { text: string }[];
    }[];
    expect(rows.map((r) => [r.name, r.steps.map((s) => s.text)])).toEqual([
      ['Haushalt', ['Wäsche anstellen', 'Bad wischen']],
    ]);
    expect(toasts()).toContain('Routine „Haushalt“ angelegt.');
    const toast = useUiStore.getState().toasts.at(-1);
    toast?.lead?.run();
    expect(open).toHaveBeenCalledWith('/routines');
    expect(undoDepth()).toBe(1);
    await undoLast();
    expect(await routines().active().count()).toBe(0);
  });

  it('a routine of that name exists: B25, nothing sent, nothing written', async () => {
    await addRoutine({ name: 'haushalt', steps: ['x'] });
    const emit = vi.spyOn(bus, 'emit');
    expect(await saveAsRoutine(entry(), {}, open)).toBe(false);
    expect(emit).not.toHaveBeenCalled();
    expect(await routines().active().count()).toBe(1);
    expect(toasts()).toEqual(['Die Routine „Haushalt“ gibt es schon.']);
    expect(undoDepth()).toBe(0);
  });

  it('the handler fails: X7, nothing kept', async () => {
    off?.();
    off = bus.on('routine.requested', async () => {
      throw new Error('boom');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await saveAsRoutine(entry(), {}, open)).toBe(false);
    expect(await routines().active().count()).toBe(0);
    expect(toasts()).toEqual(['Das hat nicht geklappt. Es ist nichts verändert.']);
  });
});
