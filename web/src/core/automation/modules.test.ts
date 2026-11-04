import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, useFixedClock } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { validateAutomation } from '@/core/modules/automation';
import { visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { entryId } from '@/modules/habits/repo';
import { entryRepo, goalRepo } from '@/modules/habits/repo';
import { goalSchema } from '@/modules/habits/schema';
import { invoiceRepo } from '@/modules/invoices/repo';
import { invoiceSchema } from '@/modules/invoices/schema';
import { reportInvoices } from '@/modules/mail/automationEvents';
import { itemRepo } from '@/modules/pantry/repo';
import { itemSchema } from '@/modules/pantry/schema';
import { subscriptionRepo } from '@/modules/subscriptions/repo';
import { subscriptionSchema } from '@/modules/subscriptions/schema';
import { eventsOf } from './ingest';
import { buildRegistry, isRunnable, type AutomationRegistry } from './registry';
import { ruleSchema, type AutomationEvent } from './types';
import { TEMPLATES, paramsOf } from './templates';
import type { WriteSignal } from '@/core/db/writeHook';

const TODAY = '2026-09-29';
let registry: AutomationRegistry;

beforeEach(async () => {
  useFixedClock(); // 2026-09-29 10:00
  await clearAll();
  for (const t of ['habits_goal', 'habits_entry']) await db.table(t).clear();
  registry = await buildRegistry(visibleManifests);
});
afterAll(() => setNow());

describe('module contracts', () => {
  it('every module with an automation file agrees with its manifest', async () => {
    const withAutomation = visibleManifests.filter((m) => m.automation);
    expect(withAutomation.map((m) => m.id).sort()).toEqual([
      'calendar',
      'habits',
      'invoices',
      'lists',
      'mail',
      'pantry',
      'subscriptions',
      'timetrack',
      'todos',
    ]);
    for (const m of withAutomation) {
      const a = (await m.automation!()).default;
      expect(
        validateAutomation(m.id, a, Object.keys(m.dataSchema.collections), m.aiSchema),
        m.id,
      ).toEqual([]);
    }
  });

  it('the vault, and every module without an aiSchema, can never be written to by a rule', () => {
    expect(visibleManifests.find((m) => m.id === 'accounts')?.automation).toBeUndefined();
    expect(registry.byModule.has('accounts')).toBe(false);
    for (const m of visibleManifests.filter((x) => !x.aiSchema)) {
      for (const action of ['create', 'update', 'delete', 'complete']) {
        expect(registry.allowed(m.id, action), `${m.id}.${action}`).toBe(false);
      }
    }
  });

  it('only creating actions are allowed; nothing deletes, updates or completes', () => {
    expect(registry.allowed('todos', 'create')).toBe(true);
    for (const [module, action] of [
      ['todos', 'delete'],
      ['todos', 'complete'],
      ['todos', 'update'],
      ['invoices', 'markPaid'],
      ['invoices', 'delete'],
      ['pantry', 'delete'],
      ['lists', 'delete'],
    ] as const) {
      expect(registry.allowed(module, action), `${module}.${action}`).toBe(false);
    }
    for (const a of registry.byModule.values()) {
      for (const id of a.actions ?? []) expect(id).toBe('create');
    }
  });

  it('validateAutomation finds mistakes', () => {
    const ai = visibleManifests.find((m) => m.id === 'todos')!.aiSchema;
    expect(
      validateAutomation(
        'todos',
        { watch: { nope: { fields: {} } }, actions: ['delete', 'ghost'] },
        ['task'],
        ai,
      ),
    ).toEqual([
      'automation.watch.nope: not a collection of todos',
      'automation.actions: "delete" deletes, which rules never do',
      'automation.actions: "ghost" is not in aiSchema.actions',
    ]);
    expect(validateAutomation('mail', { actions: ['create'] }, [], undefined)).toEqual([
      'automation.actions needs an aiSchema (rules write through its actions)',
    ]);
    expect(validateAutomation('x', { events: { Bad: { fields: {} } } }, [], undefined)[0]).toMatch(
      /not a valid event type/,
    );
  });
});

describe('templates', () => {
  it('there are twelve, all valid rules that the modules can run', () => {
    expect(TEMPLATES).toHaveLength(12);
    for (const tpl of TEMPLATES) {
      const rule = tpl.build(paramsOf(tpl, undefined));
      expect(ruleSchema.safeParse(rule).success, tpl.id).toBe(true);
      expect(isRunnable(rule, registry), tpl.id).toBe(true);
      expect(tpl.title.length).toBeGreaterThan(3);
      expect(tpl.description.length).toBeGreaterThan(10);
      expect(tpl.modules).not.toContain('accounts');
    }
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(12);
  });

  it('a rule listening to something that no module reports is not runnable', () => {
    const rule = TEMPLATES[0]!.build(paramsOf(TEMPLATES[0]!, undefined));
    expect(
      isRunnable({ ...rule, trigger: { kind: 'event', type: 'accounts.entry.created' } }, registry),
    ).toBe(false);
    expect(
      isRunnable(
        { ...rule, actions: [{ kind: 'entry', module: 'todos', action: 'delete' }] },
        registry,
      ),
    ).toBe(false);
    expect(
      isRunnable(
        { ...rule, actions: [{ kind: 'suggest', module: 'accounts', action: 'create', data: {} }] },
        registry,
      ),
    ).toBe(false);
  });
});

const detect = async (module: string, today = TODAY): Promise<AutomationEvent[]> => {
  const out: AutomationEvent[] = [];
  for (const d of registry.byModule.get(module)!.detectors ?? [])
    out.push(...(await d({ at: Date.now(), today })));
  return out;
};

describe('watched writes and derived events', () => {
  const signal = (s: Partial<WriteSignal> & Pick<WriteSignal, 'table' | 'kind'>): WriteSignal => ({
    id: 'a',
    ...s,
  });

  it('only watched collections become plain events', () => {
    const at = 1;
    const watched = registry.watched;
    expect(
      eventsOf(
        signal({ table: 'todos_task', kind: 'created', data: { title: 'x' } }),
        at,
        registry.derive,
        watched,
      ),
    ).toHaveLength(1);
    expect(
      eventsOf(
        signal({ table: 'todos_list', kind: 'created', data: { name: 'x' } }),
        at,
        registry.derive,
        watched,
      ),
    ).toHaveLength(0);
    expect(
      eventsOf(
        signal({ table: 'finance_transaction', kind: 'created' }),
        at,
        registry.derive,
        watched,
      ),
    ).toHaveLength(0);
    expect(
      eventsOf(signal({ table: 'accounts_entry', kind: 'created' }), at, registry.derive, watched),
    ).toHaveLength(0);
  });

  it('todos: completing a task reports todos.task.completed', () => {
    const out = eventsOf(
      signal({
        table: 'todos_task',
        kind: 'updated',
        data: { title: 'T', done: true, priority: 3 },
        before: { done: false },
      }),
      5,
      registry.derive,
      registry.watched,
    );
    expect(out.map((e) => e.type)).toEqual(['todos.task.updated', 'todos.task.completed']);
    expect(out[1]!.data).toMatchObject({ title: 'T', priority: 3 });
  });

  it('timetrack: a session without an end is "started"', () => {
    const run = (data: Record<string, unknown>) =>
      eventsOf(
        signal({ table: 'timetrack_session', kind: 'created', data }),
        5,
        registry.derive,
        registry.watched,
      ).map((e) => e.type);
    expect(run({ date: TODAY, startTime: '09:00' })).toContain('timetrack.started');
    expect(run({ date: TODAY, startTime: '09:00', endTime: '10:00' })).not.toContain(
      'timetrack.started',
    );
  });

  it('pantry: dropping under the minimum reports it right away, with the detector key', () => {
    const out = eventsOf(
      signal({
        table: 'pantry_item',
        kind: 'updated',
        id: 'milk',
        data: { name: 'Milch', count: 1, minCount: 2 },
        before: { count: 3 },
      }),
      5,
      registry.derive,
      registry.watched,
    ).filter((e) => e.type === 'pantry.belowMinimum');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'pantry.belowMinimum:milk:1',
      data: { name: 'Milch', count: 1 },
    });
    const still = eventsOf(
      signal({
        table: 'pantry_item',
        kind: 'updated',
        id: 'milk',
        data: { name: 'Milch', count: 0, minCount: 2 },
        before: { count: 1 },
      }),
      5,
      registry.derive,
      registry.watched,
    ).filter((e) => e.type === 'pantry.belowMinimum');
    expect(still).toHaveLength(0); // already below: not a new crossing
  });

  it('subscriptions: a longer price history reports the change', () => {
    const change = { date: TODAY, fromMinor: 1000, toMinor: 1300 };
    const out = eventsOf(
      signal({
        table: 'subscriptions_subscription',
        kind: 'updated',
        id: 's1',
        data: { name: 'Stream', currency: 'EUR', priceHistory: [change] },
        before: { priceHistory: [] },
      }),
      5,
      registry.derive,
      registry.watched,
    ).filter((e) => e.type === 'subscription.priceChanged');
    expect(out).toHaveLength(1);
    expect(out[0]!.data).toMatchObject({
      name: 'Stream',
      fromMinor: 1000,
      toMinor: 1300,
      percent: 30,
    });
  });
});

describe('detectors', () => {
  it('invoices: open invoices due within 30 days, once per invoice and due date', async () => {
    await invoiceRepo.create(
      invoiceSchema.parse({ payee: 'Stadtwerke', amountMinor: 4500, dueDate: '2026-10-01' }),
      { id: 'i1' },
    );
    await invoiceRepo.create(
      invoiceSchema.parse({
        payee: 'Paid',
        amountMinor: 100,
        dueDate: '2026-10-01',
        status: 'paid',
      }),
    );
    await invoiceRepo.create(
      invoiceSchema.parse({ payee: 'Late', amountMinor: 100, dueDate: '2026-09-01' }),
    );
    await invoiceRepo.create(
      invoiceSchema.parse({ payee: 'Far', amountMinor: 100, dueDate: '2027-03-01' }),
    );
    const out = await detect('invoices');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: 'invoice.dueSoon',
      key: 'invoice.dueSoon:i1:2026-10-01',
      data: { payee: 'Stadtwerke', amountMinor: 4500, daysLeft: 2 },
    });
  });

  it('pantry: below the minimum (only with a minimum) and expiring soon (only with stock)', async () => {
    await itemRepo.create(itemSchema.parse({ name: 'Milch', count: 1, minCount: 2 }), {
      id: 'milk',
    });
    await itemRepo.create(itemSchema.parse({ name: 'Reis', count: 0 }), { id: 'rice' }); // no minimum set
    await itemRepo.create(itemSchema.parse({ name: 'Joghurt', count: 2, expires: '2026-10-01' }), {
      id: 'yog',
    });
    await itemRepo.create(itemSchema.parse({ name: 'Leer', count: 0, expires: '2026-10-01' }));
    const out = await detect('pantry');
    expect(out.map((e) => e.key).sort()).toEqual([
      'pantry.belowMinimum:milk:1',
      'pantry.expiringSoon:yog:2026-10-01',
    ]);
    expect(out.find((e) => e.type === 'pantry.expiringSoon')!.data.daysLeft).toBe(2);
  });

  it('subscriptions: renews within two weeks, and a fresh price rise', async () => {
    await subscriptionRepo.create(
      subscriptionSchema.parse({
        name: 'Stream',
        amountMinor: 1300,
        recurrence: { freq: 'monthly', byMonthDay: 1 },
        startDate: '2026-01-01',
        priceHistory: [{ date: '2026-09-27', fromMinor: 1000, toMinor: 1300 }],
      }),
      { id: 's1' },
    );
    const out = await detect('subscriptions');
    expect(out.map((e) => e.key).sort()).toEqual([
      'subscription.priceChanged:s1:2026-09-27:1300',
      'subscription.renewsSoon:s1:2026-10-01',
    ]);
    expect(out.find((e) => e.type === 'subscription.renewsSoon')!.data.daysLeft).toBe(2);
  });

  it('habits: a daily goal that is open today, once per goal and day, never an archived or finished one', async () => {
    await goalRepo.create(goalSchema.parse({ name: 'Wasser' }), { id: 'g1' });
    await goalRepo.create(goalSchema.parse({ name: 'Lesen' }), { id: 'g2' });
    await goalRepo.create(goalSchema.parse({ name: 'Alt', archived: true }));
    await entryRepo.create({ goalId: 'g2', date: TODAY, count: 1 } as never, {
      id: entryId('g2', TODAY),
    });
    const out = await detect('habits');
    expect(out.map((e) => e.key)).toEqual([`habits.goal.open:g1:${TODAY}`]);
  });
});

describe('mail', () => {
  it('reports an invoice-looking mail with sender, subject, amount and due date, and no title', () => {
    const seen: unknown[] = [];
    const off = bus.on('automation.event', (e) => void seen.push(e));
    reportInvoices([
      {
        id: 't1',
        messageCount: 1,
        from: { name: 'Stadtwerke', email: 'rechnung@example.test' },
        subject: 'Ihre Rechnung 4711',
        snippet: 'Betrag 45,00 EUR, fällig bis 15.10.2026',
        date: new Date(2026, 8, 29).getTime(),
        unread: true,
        labelIds: ['INBOX'],
        hasAttachment: false,
      },
      {
        id: 't2',
        messageCount: 1,
        from: { email: 'friend@example.test' },
        subject: 'Kino morgen?',
        snippet: 'Hast du Zeit',
        date: new Date(2026, 8, 29).getTime(),
        unread: true,
        labelIds: ['INBOX'],
        hasAttachment: false,
      },
    ]);
    off();
    expect(seen).toHaveLength(1);
    const e = seen[0] as {
      type: string;
      key: string;
      title?: string;
      data: Record<string, unknown>;
    };
    expect(e).toMatchObject({ type: 'mail.invoiceReceived', key: 'mail.invoiceReceived:t1' });
    expect(e.title).toBeUndefined();
    expect(Object.keys(e.data).sort()).toEqual(['amountMinor', 'dueDate', 'payee', 'subject']);
  });
});
