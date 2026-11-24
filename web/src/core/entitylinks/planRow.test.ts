import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import type { EventMap } from '@/core/events/events';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { addLink, plannedDay } from './index';
import { planMarkName, planMarkOf, planMarkPath, planMarks, planMarkText } from './planMark';
import { planFacts, planRowAction, planRowEntries, planRowState, requestIntoPlan } from './planRow';

const planner = getManifest('planner')!;
const assignments = createCollectionRepo(planner, 'assignment');
const items = createCollectionRepo(planner, 'item');
const LIST = { module: 'lists', id: 'shopping-default' };
const target = { ref: LIST, title: 'Einkauf' };
const labels = {
  add: 'In den Plan',
  placed: (day: string) => `Im Plan · ${day}`,
  waits: 'Im Plan · noch ohne Tag',
  remove: 'Nicht mehr planen',
};
const askIn = (excluded?: boolean) =>
  items.create(
    { source: LIST, order: 0, ...(excluded ? { excluded } : {}) },
    { id: 'lists:shopping-default' },
  );

const plannerOn = (enabled: boolean) =>
  db.table('_modules').put({
    id: 'planner',
    enabled,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
const assign = (date: string) =>
  assignments.create(
    { itemKey: 'lists:shopping-default', k: 0, of: 1, date, minutes: 45, order: 0, reason: 'new' },
    { id: `lists:shopping-default#0` },
  );

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 16, 10, 0).getTime()); // Monday
  for (const t of ['planner_assignment', 'planner_item', '_modules', '_links'])
    await db.table(t).clear();
  bus.clear();
});
afterEach(() => {
  setNow();
  bus.clear();
});

describe('planRowState', () => {
  it('is off while the planner is off (its default), whatever is stored', async () => {
    await assign('2026-11-17');
    expect(await planRowState(LIST)).toEqual({ on: false });
    await plannerOn(false);
    expect(await planRowState(LIST)).toEqual({ on: false });
  });

  it('is on without a day until the thing is placed, then carries its day', async () => {
    await plannerOn(true);
    expect(await planRowState(LIST)).toEqual({ on: true });
    await assign('2026-11-17');
    expect(await planRowState(LIST)).toEqual({ on: true, day: '2026-11-17' });
  });

  it("is requested while the planner's item row is live and not excluded", async () => {
    await plannerOn(true);
    await askIn();
    expect(await planRowState(LIST)).toEqual({ on: true, requested: true });
    await items.update('lists:shopping-default', { excluded: true });
    expect(await planRowState(LIST)).toEqual({ on: true });
  });

  it('never for the vault', async () => {
    await plannerOn(true);
    expect(await planRowState({ module: 'accounts', id: 'a1' })).toEqual({ on: false });
  });
});

describe('planRowAction', () => {
  it('nothing while loading or while the planner is off', () => {
    expect(planRowAction(target, undefined, labels, vi.fn())).toBeUndefined();
    expect(planRowAction(target, { on: false }, labels, vi.fn())).toBeUndefined();
  });

  it('„In den Plan“ emits `plan.requested` with the ref and no link; nothing is opened', async () => {
    const seen: EventMap['plan.requested'][] = [];
    bus.on('plan.requested', (req) => void seen.push(req));
    const open = vi.fn();
    const entry = planRowAction({ ...target, due: '2026-11-19' }, { on: true }, labels, open)!;
    expect(entry.label).toBe('In den Plan');
    entry.onSelect();
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({
      title: 'Einkauf',
      ref: LIST,
      due: { date: '2026-11-19', hard: true },
    });
    expect(open).not.toHaveBeenCalled();
  });

  it('a request without a due carries none', async () => {
    const seen: EventMap['plan.requested'][] = [];
    bus.on('plan.requested', (req) => void seen.push(req));
    await requestIntoPlan(target);
    expect(seen).toEqual([{ title: 'Einkauf', ref: LIST }]);
  });

  it('once placed it reads „Im Plan · Di“ and opens the planner on that day, without a new request', () => {
    const seen: unknown[] = [];
    bus.on('plan.requested', (req) => void seen.push(req));
    const open = vi.fn();
    const entry = planRowAction(target, { on: true, day: '2026-11-17' }, labels, open)!;
    expect(entry.label).toBe('Im Plan · Di');
    entry.onSelect();
    expect(open).toHaveBeenCalledWith('/planner?day=2026-11-17');
    expect(seen).toEqual([]);
  });
});

describe('planRowEntries („Nicht mehr planen“)', () => {
  it('only the request entry while the thing is not asked in', () => {
    expect(planRowEntries(target, { on: true }, labels, vi.fn()).map((e) => e.id)).toEqual([
      'to-plan',
    ]);
    expect(planRowEntries(target, { on: false }, labels, vi.fn())).toEqual([]);
  });

  it('asked in without a day: „Im Plan · noch ohne Tag“ plus „Nicht mehr planen“, which emits `plan.unrequested`', async () => {
    const seen: EventMap['plan.unrequested'][] = [];
    bus.on('plan.unrequested', (req) => void seen.push(req));
    const open = vi.fn();
    const entries = planRowEntries(target, { on: true, requested: true }, labels, open);
    expect(entries.map((e) => e.label)).toEqual(['Im Plan · noch ohne Tag', 'Nicht mehr planen']);
    entries[0]!.onSelect();
    expect(open).toHaveBeenCalledWith('/planner');
    entries[1]!.onSelect();
    await vi.waitFor(() => expect(seen).toEqual([{ title: 'Einkauf', ref: LIST }]));
  });

  it('placed: „Im Plan · Di“ plus „Nicht mehr planen“', () => {
    const entries = planRowEntries(
      target,
      { on: true, day: '2026-11-17', requested: true },
      labels,
      vi.fn(),
    );
    expect(entries.map((e) => e.label)).toEqual(['Im Plan · Di', 'Nicht mehr planen']);
  });
});

/** A placement row of any plan item key (the planner writes `<itemKey>#<k>`). */
const place = (itemKey: string, date: string, extra: { locked?: boolean; k?: number } = {}) =>
  assignments.create(
    {
      itemKey,
      k: extra.k ?? 0,
      of: 1,
      date,
      minutes: 30,
      order: 0,
      reason: 'new',
      ...(extra.locked ? { locked: true } : {}),
    },
    { id: `${itemKey}#${extra.k ?? 0}` },
  );
const todos = getManifest('todos')!;
const tasks = createCollectionRepo(todos, 'task');
const carrier = (
  taskId: string,
  to: { module: string; id: string },
  rel: 'origin' | 'about' | 'before' | 'after',
) => addLink({ from: { module: 'todos', id: taskId }, to, rel, label: 'x' });

describe('the plan mark (package 10b)', () => {
  beforeEach(async () => {
    await db.table('todos_task').clear();
    await plannerOn(true);
  });

  it('nothing while the planner is off; nothing for the vault', async () => {
    await plannerOn(false);
    await place('invoices:i1', '2026-11-18');
    expect(await planMarkOf('invoices', { id: 'i1' })).toBeUndefined();
    await plannerOn(true);
    expect(await planMarkOf('accounts', { id: 'a1' })).toBeUndefined();
  });

  it('M1 / M2: the earliest day from today on, its lock, and the row it matched', async () => {
    await place('invoices:i1', '2026-11-20', { k: 1 });
    await place('invoices:i1', '2026-11-18', { locked: true });
    const mark = await planMarkOf('invoices', { id: 'i1' });
    expect(mark).toEqual({ kind: 'day', date: '2026-11-18', locked: true, rowKey: 'invoices:i1' });
    expect(planMarkText(mark!)).toBe('Im Plan · Mi · fest');
    expect(planMarkName(mark!)).toBe(
      'Im Plan · Mi · fest – Mittwoch, 18. November. Im Planer zeigen',
    );
    expect(planMarkPath(mark!)).toBe('/planner?day=2026-11-18&item=invoices%3Ai1');
  });

  it('a subscription placed from the planner (an occurrence key) shows M1 and lands on its occurrence row', async () => {
    await place('subscriptions:s1:2026-11-25', '2026-11-18');
    const mark = await planMarkOf('subscriptions', { id: 's1' });
    expect(mark).toMatchObject({
      kind: 'day',
      date: '2026-11-18',
      rowKey: 'subscriptions:s1:2026-11-25',
    });
    expect(planMarkPath(mark!)).toBe(
      '/planner?day=2026-11-18&item=subscriptions%3As1%3A2026-11-25',
    );
    expect(await plannedDay({ module: 'subscriptions', id: 's1' })).toBe('2026-11-18');
  });

  it('`todos:ab` never matches `todos:abc` (nor the other way round)', async () => {
    await place('todos:abc', '2026-11-18');
    expect(await planMarkOf('todos', { id: 'ab' })).toBeNull();
    await place('todos:ab:x', '2026-11-19');
    const marks = await planMarks('todos', [{ id: 'ab' }, { id: 'abc' }]);
    expect(marks!.get('ab')).toMatchObject({ date: '2026-11-19', rowKey: 'todos:ab:x' });
    expect(marks!.get('abc')).toMatchObject({ date: '2026-11-18', rowKey: 'todos:abc' });
  });

  it('a thing that is no plan row has the day of a ToDo linking to it with origin / about, and lands on that row', async () => {
    const note = { module: 'notes', id: 'n1' };
    await tasks.create(
      { listId: 'inbox', title: 'Regal', done: false, priority: 0, order: 0 },
      { id: 'nt' },
    );
    await carrier('nt', note, 'about');
    await place('todos:nt', '2026-11-19');
    const mark = await planMarkOf('notes', { id: 'n1' });
    expect(mark).toEqual({ kind: 'day', date: '2026-11-19', locked: false, rowKey: 'todos:nt' });
    expect(planMarkPath(mark!)).toBe('/planner?day=2026-11-19&item=todos%3Ant');
  });

  it("a preparation the day before (`before`) does not move the appointment's mark", async () => {
    const event = { module: 'calendar', id: 'e1' };
    await tasks.create(
      { listId: 'inbox', title: 'Unterlagen', done: false, priority: 0, order: 0 },
      { id: 'prep' },
    );
    await carrier('prep', event, 'before');
    await place('todos:prep', '2026-11-17');
    expect(await planMarkOf('calendar', { id: 'e1' })).toBeNull();
    await tasks.create(
      { listId: 'inbox', title: 'Termin', done: false, priority: 0, order: 0 },
      { id: 'it' },
    );
    await carrier('it', event, 'origin');
    await place('todos:it', '2026-11-18');
    expect(await planMarkOf('calendar', { id: 'e1' })).toMatchObject({
      date: '2026-11-18',
      rowKey: 'todos:it',
    });
    expect(await plannedDay(event)).toBe('2026-11-18');
  });

  it('M4: only a passed day – the latest one before today, to „Noch offen“; a done thing has no mark', async () => {
    await place('invoices:i1', '2026-11-10', { k: 1 });
    await place('invoices:i1', '2026-11-13');
    const mark = await planMarkOf('invoices', { id: 'i1' });
    expect(mark).toEqual({ kind: 'passed', date: '2026-11-13', rowKey: 'invoices:i1' });
    expect(planMarkText(mark!)).toBe('Im Plan · war Fr');
    expect(planMarkPath(mark!)).toBe('/planner?tab=open&item=invoices%3Ai1');
    expect(await planMarkOf('invoices', { id: 'i1', done: true })).toBeNull();
    // A day from today on wins over a passed one.
    await place('invoices:i1', '2026-11-16', { k: 2 });
    expect(await planMarkOf('invoices', { id: 'i1' })).toMatchObject({
      kind: 'day',
      date: '2026-11-16',
    });
    expect(planMarkText((await planMarkOf('invoices', { id: 'i1' }))!)).toBe('Im Plan · heute');
  });

  it('a passed occurrence is gone (its next one is a new key): no M4 from it', async () => {
    await place('subscriptions:s1:2026-10-25', '2026-10-20');
    expect(await planMarkOf('subscriptions', { id: 's1' })).toBeNull();
  });

  it("M3: asked in without a day, or the module's own field as fallback while the planner has no row", async () => {
    await askIn();
    const mark = await planMarkOf('lists', { id: 'shopping-default' });
    expect(mark).toEqual({ kind: 'noDay', rowKey: 'lists:shopping-default' });
    expect(planMarkText(mark!)).toBe('Im Plan · noch ohne Tag');
    expect(planMarkName(mark!)).toBe('Im Plan · noch ohne Tag. Im Planer zeigen');
    expect(planMarkPath(mark!)).toBe('/planner?item=lists%3Ashopping-default');
    expect(await planMarkOf('bookmarks', { id: 'bm1' })).toBeNull();
    expect(await planMarkOf('bookmarks', { id: 'bm1', fallback: true })).toEqual({
      kind: 'noDay',
      rowKey: 'bookmarks:bm1',
    });
    // A fallback with an open carrier ToDo (a mail thread planned as a ToDo) leads to that ToDo's row.
    await tasks.create(
      { listId: 'inbox', title: 'Antworten', done: false, priority: 0, order: 0 },
      { id: 'mt' },
    );
    await carrier('mt', { module: 'mail', id: 'th1' }, 'origin');
    expect(await planMarkOf('mail', { id: 'th1', fallback: true })).toEqual({
      kind: 'noDay',
      rowKey: 'todos:mt',
    });
    // The planner's row wins over the fallback once it has one.
    await place('bookmarks:bm1', '2026-11-18');
    expect(await planMarkOf('bookmarks', { id: 'bm1', fallback: true })).toMatchObject({
      kind: 'day',
    });
    // „Nicht planen“: no mark.
    await items.update('lists:shopping-default', { excluded: true });
    expect(await planMarkOf('lists', { id: 'shopping-default' })).toBeNull();
  });

  it('`planFacts` reads „fest“ with the same prefix and carrier read', async () => {
    await place('subscriptions:s1:2026-11-25', '2026-11-18', { locked: true });
    await place('subscriptions:s10', '2026-11-18', { locked: true });
    expect((await planFacts('subscriptions', ['s1'])).get('s1')).toEqual({ locked: true });
    await tasks.create(
      { listId: 'inbox', title: 'Notiz', done: false, priority: 0, order: 0 },
      { id: 'nt' },
    );
    await carrier('nt', { module: 'notes', id: 'n1' }, 'origin');
    await place('todos:nt', '2026-11-19', { locked: true });
    expect((await planFacts('notes', ['n1', 'n2'])).get('n1')).toEqual({ locked: true });
    expect((await planFacts('notes', ['n2'])).size).toBe(0);
  });

  it('reading marks writes nothing', async () => {
    await place('invoices:i1', '2026-11-18');
    await askIn();
    const writes: string[] = [];
    const off = db.tables.map((table) => {
      const note = () => void writes.push(table.name);
      table.hook('creating', note);
      table.hook('updating', note);
      table.hook('deleting', note);
      return () => {
        table.hook('creating').unsubscribe(note);
        table.hook('updating').unsubscribe(note);
        table.hook('deleting').unsubscribe(note);
      };
    });
    try {
      await planMarks('invoices', [{ id: 'i1' }, { id: 'i2', fallback: true }]);
      await planMarkOf('lists', { id: 'shopping-default' });
      await planFacts('invoices', ['i1']);
    } finally {
      off.forEach((f) => f());
    }
    expect(writes).toEqual([]);
  });
});
