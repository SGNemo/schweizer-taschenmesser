import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import type { EventMap } from '@/core/events/events';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { planRowAction, planRowEntries, planRowState, requestIntoPlan } from './planRow';

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
