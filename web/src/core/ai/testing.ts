/** Shared fixtures for the assistant tests (not part of the app bundle). */
import { db } from '@/core/db/db';
import { visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { eventRepo } from '@/modules/calendar/repo';
import { accountRepo, transactionRepo } from '@/modules/finance/repo';
import { invoiceRepo } from '@/modules/invoices/repo';
import { reminderRepo } from '@/modules/reminders/repo';
import { subscriptionRepo } from '@/modules/subscriptions/repo';
import { listRepo, taskRepo } from '@/modules/todos/repo';
import { taskSchema } from '@/modules/todos/schema';
import type { ExecContext } from './query/types';

/** Tuesday. */
export const TODAY = '2026-09-29';

export const CORE_IDS = ['calendar', 'todos', 'reminders', 'finance', 'invoices', 'subscriptions'];

export function ctxFor(enabled: string[] = CORE_IDS, today = TODAY): ExecContext {
  return {
    manifests: visibleManifests.filter((m) => enabled.includes(m.id)),
    known: visibleManifests,
    database: db,
    today,
  };
}

export async function clearAll(): Promise<void> {
  for (const m of visibleManifests) {
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  }
  await db.table('_settings').clear();
  await db.table('_outbox').clear();
  await db.table('_aiCache').clear();
  await db.table('_aiUsage').clear();
}

export function useFixedClock(): void {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
}

/** A small, recognisable data set. The strings are used to prove they never reach the model. */
export async function seed(): Promise<void> {
  await listRepo.create({ name: 'Privat', order: 0 }, { id: 'inbox' });
  await taskRepo.create(
    taskSchema.parse({
      listId: 'inbox',
      title: 'Steuererklärung Geheimfirma',
      dueDate: '2026-10-05',
      priority: 2,
    }),
  );
  await taskRepo.create(
    taskSchema.parse({ listId: 'inbox', title: 'Milch kaufen', dueDate: TODAY }),
  );
  await taskRepo.create(
    taskSchema.parse({
      listId: 'inbox',
      title: 'Altes erledigt',
      done: true,
      dueDate: '2026-09-01',
    }),
  );
  await eventRepo.create({
    title: 'Zahnarzt Dr. Sonnenschein',
    startDate: '2026-09-30',
    startTime: '10:00',
    allDay: false,
  });
  await eventRepo.create({
    title: 'Yoga',
    startDate: '2026-09-01',
    startTime: '18:00',
    allDay: false,
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [2] },
  });
  await reminderRepo.create({
    title: 'Miete überweisen',
    startDate: '2026-10-01',
    time: '09:00',
    active: true,
    recurrence: { freq: 'monthly', interval: 1, byMonthDay: 1 },
  });
  await invoiceRepo.create({
    payee: 'Stadtwerke Musterstadt',
    amountMinor: 8990,
    dueDate: '2026-10-05',
    status: 'open',
  });
  await invoiceRepo.create({
    payee: 'Vodafone',
    amountMinor: 3999,
    dueDate: '2026-09-25',
    status: 'open',
  });
  await invoiceRepo.create({
    payee: 'Telekom',
    amountMinor: 2500,
    dueDate: '2026-09-10',
    status: 'paid',
    paidAt: '2026-09-11',
  });
  await subscriptionRepo.create({
    name: 'Netflix',
    amountMinor: 1299,
    startDate: '2026-09-15',
    recurrence: { freq: 'monthly', interval: 1 },
    active: true,
  });
  await accountRepo.create(
    { name: 'Girokonto', openingBalanceMinor: 100000, order: 0 },
    { id: 'acc-main' },
  );
  await transactionRepo.create({
    accountId: 'acc-main',
    kind: 'income',
    amountMinor: 250000,
    date: '2026-09-01',
    payee: 'Arbeitgeber GmbH',
  });
  await transactionRepo.create({
    accountId: 'acc-main',
    kind: 'expense',
    amountMinor: 4500,
    date: '2026-09-20',
    payee: 'Supermarkt',
  });
}
