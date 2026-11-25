// @vitest-environment jsdom
/**
 * Collective rows in the planner (planner hub 2, package 2; hand-off 02 „Tests“): the board folds the members and keeps
 * a pile with nothing to do out of „Noch ohne Tag“ and „Noch offen“; no proposal takes a folded member one by one; the
 * planner's own source hands over nothing that changes with a count, so a count that changes – also to 0 – writes
 * nothing; a pile's ⋯ has no „Nicht planen“ but P11; the offer's „Rückgängig“ sets the switch back; a folded member's
 * mark reads M5 / M3 and leads to the pile's row.
 */
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { planMarks } from '@/core/entitylinks/planMarkRead';
import type { PlannableEntry } from '@/core/modules/contributions';
import type { PileEntry } from '@/core/modules/pile';
import { getSettings, setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { buildBoard, type BoardInput } from '../board';
import { useRowMenu } from '../components/rowMenu';
import { copyInput } from '../copyPlan';
import { acceptPileOffer } from '../pileSwitch';
import type * as Piles from '../piles';
import { foldPlan } from '../piles';
import { looseAll, looseOf } from '../run';
import type { AssignmentRow } from '../schema';
import { DEFAULT_PLANNER_SETTINGS, PLANNER_SCOPE, plannerSettingsSchema } from '../settings';

const parts = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('../piles', async (actual) => {
  const real = await actual<typeof Piles>();
  return { ...real, loadPileParts: async () => parts.list };
});

const TODAY = '2026-11-30';
const MON = TODAY;
const entry = (
  moduleId: string,
  id: string,
  over: Partial<PlannableEntry> = {},
): PlannableEntry => ({
  moduleId,
  id,
  kind: moduleId === 'planner' ? 'pile' : 'invoice',
  title: id,
  to: `/${moduleId}`,
  durationMin: 10,
  ...over,
});
const pileRow = entry('planner', 'pile-money', { title: 'Finanzen checken', durationMin: 20 });
const i1 = entry('invoices', 'i1', { due: { date: '2026-12-04', hard: true } });
const i2 = entry('invoices', 'i2', { due: { date: '2026-11-20', hard: true } }); // late money
const part = (members: string[], over: Partial<PileEntry> = {}): PileEntry => ({
  moduleId: 'invoices',
  area: 'money',
  id: 'open',
  count: 0,
  label: (n) => `${n} Rechnungen`,
  head: 'Rechnungen offen',
  to: '/invoices?view=open',
  members,
  ...over,
});
const unit = (key: string, reason = 'no-day' as const) => ({
  id: `${key}#0`,
  itemKey: key,
  k: 0,
  of: 1,
  minutes: 10,
  reason,
});
const laid = (key: string, date: string): AssignmentRow & { id: string } => ({
  id: `${key}#0`,
  itemKey: key,
  k: 0,
  of: 1,
  date,
  minutes: 20,
  order: 0,
  reason: 'new',
});
const input = (over: Partial<BoardInput> = {}): BoardInput => ({
  today: TODAY,
  span: 7,
  settings: DEFAULT_PLANNER_SETTINGS,
  dayRows: [],
  itemRows: [],
  assignments: [],
  entries: [pileRow, i1, i2],
  calendar: [],
  unplaced: [unit('planner:pile-money'), unit('invoices:i1')],
  ...over,
});
const keysOf = (rows: readonly { itemKey: string }[]) => rows.map((r) => r.itemKey);

describe('the board with a pile', () => {
  it('folded members leave „Noch ohne Tag“ and „Frist vorbei“; the pile waits there', () => {
    const fold = foldPlan(
      [part(['invoices:i1', 'invoices:i2'])],
      [pileRow, i1, i2],
      new Set(['money']),
      [],
    );
    const board = buildBoard(
      input({ piles: { folded: new Set(fold.folded.keys()), idle: new Set() } }),
    );
    expect(keysOf(board.waiting)).toEqual(['planner:pile-money']);
    expect(board.late).toEqual([]);
    // Without the switch both stand where they always stood.
    const off = buildBoard(input());
    expect(keysOf(off.waiting)).toEqual(['planner:pile-money', 'invoices:i1']);
    expect(keysOf(off.late)).toEqual(['invoices:i2']);
  });

  it('nothing to do: an unplaced pile is no row; a placed one stays on its day and never goes to „Noch offen“', () => {
    const idle = { folded: new Set<string>(), idle: new Set(['planner:pile-money']) };
    expect(keysOf(buildBoard(input({ piles: idle })).waiting)).toEqual(['invoices:i1']);
    const placed = buildBoard(
      input({ piles: idle, assignments: [laid('planner:pile-money', '2026-12-01')], unplaced: [] }),
    );
    expect(placed.days.find((d) => d.date === '2026-12-01')?.rows.map((r) => r.itemKey)).toEqual([
      'planner:pile-money',
    ]);
    const passed = buildBoard(
      input({ piles: idle, assignments: [laid('planner:pile-money', '2026-11-27')], unplaced: [] }),
    );
    expect(passed.open).toEqual([]);
  });

  it('a member with a placement row of its own stays a single row and is not counted', () => {
    const fold = foldPlan([part(['invoices:i1'])], [pileRow, i1], new Set(['money']), [
      'invoices:i1',
    ]);
    expect(fold.folded.size).toBe(0);
    expect(fold.groups.get('money')?.alive).toBe(false);
  });
});

describe('„Plan als Text kopieren“', () => {
  it('holds the pile row by its own title, never its members', () => {
    const named = entry('invoices', 'i1', {
      title: 'Stadtwerke bezahlen',
      due: { date: '2026-12-04', hard: true },
    });
    const fold = foldPlan([part(['invoices:i1'])], [pileRow, named], new Set(['money']), []);
    const board = buildBoard(
      input({
        entries: [pileRow, named],
        piles: { folded: new Set(fold.folded.keys()), idle: new Set() },
      }),
    );
    const copied = JSON.stringify(
      copyInput(board.days, board.waiting, [], { from: TODAY, to: '2026-12-06' }),
    );
    expect(copied).not.toContain('Stadtwerke');
  });
});

describe('proposals never take a folded member one by one', () => {
  const inputs = {
    items: [{ key: 'planner:pile-money' }, { key: 'invoices:i1' }] as never,
    lockedKeys: new Set<string>(),
    prevRows: new Map(),
    foldedKeys: new Set(['invoices:i1']),
  };
  it('„alles neu mischen“ and „Woche vorschlagen“ see the pile, not its members', () => {
    expect(looseAll(inputs)).toEqual(['planner:pile-money']);
    expect(looseOf(inputs, [{ op: 'replan', reshuffle: false }])).toEqual(['planner:pile-money']);
  });
  it('a move the person names herself still takes the member', () => {
    expect(looseOf(inputs, [{ op: 'pin', key: 'invoices:i1', date: MON } as never])).toContain(
      'invoices:i1',
    );
  });
});

describe("the planner's own source", () => {
  beforeEach(async () => {
    await db.table('_settings').clear();
  });
  it('lists a pile only while its switch is on and a part exists; a count that changes hands over the same thing', async () => {
    const { default: source } = await import('../plannable');
    parts.list = [part(['invoices:i1'])];
    expect(await source.list({ today: TODAY, until: '2026-12-13' })).toEqual([]);
    await setSettings(PLANNER_SCOPE, { pileMoney: true }, DEFAULT_PLANNER_SETTINGS);
    const before = await source.list({ today: TODAY, until: '2026-12-13' });
    expect(before.map((i) => i.id)).toEqual(['pile-money']);
    // No due date, no detail: nothing the run's hash reads changes with the count.
    expect(before[0]).not.toHaveProperty('due');
    expect(before[0]).not.toHaveProperty('detail');
    parts.list = [
      part([]),
      part([], { moduleId: 'budgets', id: 'over', count: 3, readOnly: true }),
    ];
    expect(await source.list({ today: TODAY, until: '2026-12-13' })).toEqual(before);
    parts.list = [];
    expect(await source.list({ today: TODAY, until: '2026-12-13' })).toEqual([]);
  });
});

describe("a pile's ⋯ and the switches", () => {
  beforeEach(async () => {
    await db.table('_settings').clear();
  });
  it('Verschieben …, Dauer …, Fest, „Wieder einzeln zeigen“ – no „Nicht planen“, no „Erledigt“', () => {
    const { result } = renderHook(
      () =>
        useRowMenu({
          today: TODAY,
          titles: {},
          abilities: {
            canDone: () => true,
            canAssign: () => true,
            canEstimate: () => true,
            canSplit: () => true,
          } as never,
          why: undefined,
          setWhy: () => undefined,
          setChoice: () => undefined,
        }),
      { wrapper: MemoryRouter },
    );
    const items = result.current(
      {
        ...laid('planner:pile-money', '2026-12-01'),
        unitId: 'planner:pile-money#0',
        title: 'Finanzen checken',
        pinned: false,
        entry: pileRow,
      } as never,
      '2026-12-01',
    );
    expect(items.map((i) => i.label)).toEqual([
      'Verschieben …',
      'Dauer …',
      'Fest an diesem Tag',
      'Wieder einzeln zeigen',
    ]);
  });

  it('the offer sets the switch; its toast „Rückgängig“ sets it back to never asked', async () => {
    const read = async () =>
      (await getSettings(PLANNER_SCOPE, plannerSettingsSchema, DEFAULT_PLANNER_SETTINGS)).pileMoney;
    expect(await read()).toBeUndefined();
    await acceptPileOffer('money');
    expect(await read()).toBe(true);
    const toast = useUiStore.getState().toasts.at(-1);
    expect(toast?.message).toBe('Finanzen ist jetzt eine Zeile.');
    toast?.action?.run();
    await vi.waitFor(async () => expect(await read()).toBeUndefined());
  });
});

describe("a folded member's mark", () => {
  const stamp = { createdAt: 1, updatedAt: 1, deviceId: 't', deletedAt: null, _f: {} };
  beforeEach(async () => {
    setNow(() => new Date(2026, 10, 30, 10, 0).getTime());
    for (const t of [
      '_settings',
      '_modules',
      'planner_assignment',
      'planner_item',
      'invoices_invoice',
    ])
      await db.table(t).clear();
    await db
      .table('_modules')
      .bulkPut(
        ['planner', 'invoices'].map((id) => ({ id, enabled: true, dataPolicy: null, ...stamp })),
      );
    await db.table('invoices_invoice').put({
      id: 'i1',
      payee: 'Stadtwerke Beispiel',
      amountMinor: 8000,
      dueDate: '2026-12-04',
      status: 'open',
      ...stamp,
    });
    await setSettings(PLANNER_SCOPE, { pileMoney: true }, DEFAULT_PLANNER_SETTINGS);
  });
  afterEach(() => setNow());

  it('M3 on an unplaced pile, M5 with the pile title on a placed one – both lead to the pile row', async () => {
    const unplaced = await planMarks('invoices', [{ id: 'i1' }]);
    expect(unplaced?.get('i1')).toEqual({ kind: 'noDay', rowKey: 'planner:pile-money' });
    await db
      .table('planner_assignment')
      .put({ ...laid('planner:pile-money', '2026-12-02'), ...stamp });
    const placed = await planMarks('invoices', [{ id: 'i1' }]);
    expect(placed?.get('i1')).toEqual({
      kind: 'day',
      date: '2026-12-02',
      locked: false,
      rowKey: 'planner:pile-money',
      pile: 'Finanzen checken',
    });
  });

  it('switch off: the member reads as before', async () => {
    await setSettings(PLANNER_SCOPE, { pileMoney: false }, DEFAULT_PLANNER_SETTINGS);
    expect((await planMarks('invoices', [{ id: 'i1' }]))?.get('i1')).toBeUndefined();
  });
});
