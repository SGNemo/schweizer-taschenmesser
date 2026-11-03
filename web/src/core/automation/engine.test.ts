import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, ctxFor, seed, useFixedClock } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { collectDue } from '@/core/notifications/collect';
import { getFocusSession } from '@/core/focus/state';
import { setNow } from '@/core/time/now';
import { taskRepo } from '@/modules/todos/repo';
import { processEvent, runRuleNow, undoRun, type EngineDeps } from './engine';
import { startWriteEvents } from './ingest';
import { listLog } from './log';
import { automationDue, listNotices } from './notices';
import { resetGuardCache } from './state';
import type { AutomationEvent, Rule } from './types';

const { manifests, known } = ctxFor();

let settings = { enabled: true, dryRun: false, globalPerHour: 0 };
let rules: Rule[] = [];
const deps: EngineDeps = {
  rules: async () => rules,
  settings: async () => settings,
  manifests: () => manifests,
  known: () => known,
  database: db,
};

const todoRule = (over: Partial<Rule> = {}): Rule => ({
  id: 'r-todo',
  title: 'Invoice due → to-do',
  trigger: { kind: 'event', type: 'invoice.dueSoon' },
  conditions: [{ field: 'daysLeft', op: 'lte', value: 3 }],
  actions: [
    {
      kind: 'entry',
      module: 'todos',
      action: 'create',
      data: { title: 'Pay {payee}', dueDate: '{due}' },
    },
  ],
  limitPerHour: 5,
  ...over,
});

const due = (key: string, data: Record<string, unknown> = {}): AutomationEvent => ({
  type: 'invoice.dueSoon',
  moduleId: 'invoices',
  key,
  at: 0,
  data: { payee: 'Stadtwerke', due: '2026-10-02', daysLeft: 3, ...data },
  title: 'Stadtwerke',
});

const todos = async () =>
  (await taskRepo.active().toArray()).filter((t) => String(t.title).startsWith('Pay '));

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  for (const t of ['_imports', '_meta', '_automationLog']) await db.table(t).clear();
  resetGuardCache();
  await seed();
  settings = { enabled: true, dryRun: false, globalPerHour: 0 };
  rules = [todoRule()];
});
afterAll(() => setNow());

describe('running a rule', () => {
  it('creates the entry through the module contract and logs the run', async () => {
    const [r] = await processEvent(due('inv1'), deps);
    expect(r).toMatchObject({ result: 'done', ruleId: 'r-todo' });
    const list = await todos();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: 'Pay Stadtwerke', dueDate: '2026-10-02' });
    expect(list[0]!.id).toMatch(/^auto-/);
    const [log] = await listLog(10, db);
    expect(log).toMatchObject({
      ruleId: 'r-todo',
      result: 'done',
      trigger: 'invoice.dueSoon',
      eventTitle: 'Stadtwerke',
    });
    expect(log!.groupId).toBe(r!.groupId);
  });

  it('does nothing when the conditions do not hold, or the master switch is off', async () => {
    expect(await processEvent(due('a', { daysLeft: 9 }), deps)).toEqual([]);
    settings = { ...settings, enabled: false };
    expect(await processEvent(due('b'), deps)).toEqual([]);
    expect(await todos()).toHaveLength(0);
    expect(await listLog(10, db)).toHaveLength(0);
  });

  it('runs once per occurrence', async () => {
    await processEvent(due('inv1'), deps);
    expect(await processEvent(due('inv1'), deps)).toEqual([]);
    expect(await todos()).toHaveLength(1);
  });

  it('writes nothing twice when another device runs the same occurrence (fixed ids)', async () => {
    await processEvent(due('inv1'), deps);
    await db.table('_meta').clear(); // the other device has its own books
    resetGuardCache();
    const [r] = await processEvent(due('inv1'), deps);
    expect(r!.actions[0]).toMatchObject({ ok: true, written: 0, note: 'exists' });
    expect(await todos()).toHaveLength(1);
  });

  it('dry run: logs what it would do, writes nothing, and does not use up the real occurrence', async () => {
    settings = { ...settings, dryRun: true };
    const [r] = await processEvent(due('inv1'), deps);
    expect(r).toMatchObject({ result: 'dry' });
    expect(r!.groupId).toBeUndefined();
    expect(await todos()).toHaveLength(0);
    expect((await listLog(1, db))[0]).toMatchObject({ dryRun: true, result: 'dry' });
    settings = { ...settings, dryRun: false };
    await processEvent(due('inv1'), deps);
    expect(await todos()).toHaveLength(1);
  });

  it('"Regel ausführen" runs one rule now', async () => {
    rules = [];
    const r = await runRuleNow(
      todoRule({
        actions: [{ kind: 'entry', module: 'todos', action: 'create', data: { title: 'Pay now' } }],
      }),
      deps,
    );
    expect(r.result).toBe('done');
    expect((await taskRepo.active().toArray()).some((t) => t.title === 'Pay now')).toBe(true);
  });
});

describe('undo', () => {
  it('takes the whole run back: entry, hint and focus round', async () => {
    rules = [
      todoRule({
        actions: [
          { kind: 'entry', module: 'todos', action: 'create', data: { title: 'Pay {payee}' } },
          { kind: 'notice', title: 'Rechnung {payee}' },
          { kind: 'focus', title: 'Pay', minutes: 25 },
        ],
      }),
    ];
    const [r] = await processEvent(due('inv1'), deps);
    expect(await todos()).toHaveLength(1);
    expect(await listNotices(db)).toHaveLength(1);
    expect(await getFocusSession()).toBeDefined();

    const res = await undoRun(r!.groupId!, deps);
    expect(res.removed).toBe(1);
    expect(await todos()).toHaveLength(0);
    expect(await listNotices(db)).toHaveLength(0);
    expect(await getFocusSession()).toBeUndefined();
    expect((await listLog(1, db))[0]!.undone).toBe(true);
  });

  it('keeps an entry the user edited in the meantime', async () => {
    const [r] = await processEvent(due('inv1'), deps);
    const [t] = await todos();
    setNow(() => new Date(2026, 8, 29, 10, 5).getTime());
    await taskRepo.update(t!.id, { title: 'Pay Stadtwerke (edited)' });
    const res = await undoRun(r!.groupId!, deps);
    expect(res).toMatchObject({ removed: 0, kept: 1 });
    expect(await todos()).toHaveLength(1);
  });
});

describe('what a rule can never do', () => {
  it('ignores events from the vault', async () => {
    rules = [todoRule({ trigger: { kind: 'event', type: 'accounts.entry.created' } })];
    const ev: AutomationEvent = {
      type: 'accounts.entry.created',
      moduleId: 'accounts',
      key: 'k',
      at: 0,
      data: { daysLeft: 1 },
    };
    expect(await processEvent(ev, deps)).toEqual([]);
  });

  it('cannot target the vault or a module that is not enabled', async () => {
    rules = [
      todoRule({
        actions: [
          { kind: 'entry', module: 'accounts', action: 'create', data: { title: 'x' } },
          { kind: 'entry', module: 'budgets', action: 'create', data: { title: 'x' } },
        ],
      }),
    ];
    const [r] = await processEvent(due('a'), deps);
    expect(r!.result).toBe('error');
    expect(r!.actions.map((a) => a.note)).toEqual(['not-allowed', 'module-unavailable']);
  });

  it('refuses delete actions and the type has no delete / send / pay kind', async () => {
    const ev = due('del');
    rules = [
      todoRule({
        actions: [
          { kind: 'entry', module: 'todos', action: 'delete', target: { title: 'Milch kaufen' } },
        ],
      }),
    ];
    const [r] = await processEvent(ev, deps);
    expect(r!.actions[0]).toMatchObject({ ok: false, note: 'not-allowed' });
    expect((await taskRepo.active().toArray()).some((t) => t.title === 'Milch kaufen')).toBe(true);
    const { ACTION_KINDS } = await import('./types');
    expect([...ACTION_KINDS].sort()).toEqual([
      'entry',
      'focus',
      'notice',
      'profile',
      'reminder',
      'suggest',
    ]);
  });

  it('an incomplete entry is not written', async () => {
    rules = [
      todoRule({
        actions: [{ kind: 'entry', module: 'todos', action: 'create', data: { dueDate: '{due}' } }],
      }),
    ];
    const [r] = await processEvent(due('a'), deps);
    expect(r!.actions[0]).toMatchObject({ ok: false, note: 'incomplete' });
  });
});

describe('limits and loops', () => {
  it('limits runs per rule and hour, and says so once', async () => {
    rules = [todoRule({ limitPerHour: 2 })];
    for (const k of ['1', '2', '3', '4', '5']) await processEvent(due(k), deps);
    expect(await todos()).toHaveLength(2);
    const skipped = (await listLog(20, db)).filter((l) => l.result === 'skipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.reason).toBe('limit');
  });

  it('limits all rules together', async () => {
    settings = { ...settings, globalPerHour: 1 };
    rules = [todoRule({ id: 'a' }), todoRule({ id: 'b' })];
    await processEvent(due('1'), deps);
    expect(await todos()).toHaveLength(1);
  });

  it('a rule that triggers itself runs once, not forever', async () => {
    rules = [
      todoRule({
        id: 'self',
        trigger: { kind: 'event', type: 'todos.task.created' },
        conditions: [],
        actions: [
          { kind: 'entry', module: 'todos', action: 'create', data: { title: 'Pay again' } },
        ],
      }),
    ];
    const stop = startWriteEvents(deps);
    try {
      await taskRepo.create({ listId: 'inbox', title: 'seed task' } as never);
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      stop();
    }
    expect((await taskRepo.active().toArray()).filter((t) => t.title === 'Pay again')).toHaveLength(
      1,
    );
    const reasons = (await listLog(20, db))
      .filter((l) => l.result === 'skipped')
      .map((l) => l.reason);
    expect(reasons).toContain('loop');
  });

  it('two rules that trigger each other stop after one round', async () => {
    rules = [
      todoRule({
        id: 'a',
        trigger: { kind: 'event', type: 'todos.task.created' },
        conditions: [{ field: 'title', op: 'eq', value: 'ping' }],
        actions: [{ kind: 'entry', module: 'todos', action: 'create', data: { title: 'pong' } }],
      }),
      todoRule({
        id: 'b',
        trigger: { kind: 'event', type: 'todos.task.created' },
        conditions: [{ field: 'title', op: 'eq', value: 'pong' }],
        actions: [{ kind: 'entry', module: 'todos', action: 'create', data: { title: 'ping' } }],
      }),
    ];
    const stop = startWriteEvents(deps);
    try {
      await taskRepo.create({ listId: 'inbox', title: 'ping' } as never);
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      stop();
    }
    const all = await taskRepo.active().toArray();
    expect(all.filter((t) => t.title === 'pong')).toHaveLength(1);
    expect(all.filter((t) => t.title === 'ping')).toHaveLength(2); // the user's, and b's reply (a does not answer again)
  });
});

describe('notices respect the calm policy', () => {
  const at = (h: number) => new Date(2026, 8, 29, h, 0).getTime();

  it('a hint is soft and stays on the device', async () => {
    rules = [todoRule({ actions: [{ kind: 'notice', title: 'Rechnung {payee}' }] })];
    await processEvent(due('x'), deps);
    const items = await automationDue({ from: at(9), to: at(11) }, db);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Rechnung Stadtwerke', soft: true, local: true });
  });

  it('a reminder comes later, and quiet hours move it to their end', async () => {
    rules = [todoRule({ actions: [{ kind: 'reminder', title: 'Pay', inMinutes: 13 * 60 }] })]; // 23:00
    await processEvent(due('x'), deps);
    const evening = await collectDue({ from: at(22), to: at(23) + 30 * 60_000 }, []);
    expect(evening).toHaveLength(0);
    const morning = await collectDue({ from: at(22), to: at(31) + 30 * 60_000 }, []);
    expect(morning.map((n) => n.title)).toEqual(['Pay']);
  });
});
