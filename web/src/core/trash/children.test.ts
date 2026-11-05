import { beforeEach, expect, it } from 'vitest';
import { z } from 'zod';
import { db } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { listTrash, restoreEntry } from './trash';

// QA round 4, X06: an account (with all its bookings), a booking, a habit (with its history) and a
// time entry were gone for good once the "Rückgängig" toast had passed.
const accounts = createRepo('finance_account', z.looseObject({}));
const bookings = createRepo('finance_transaction', z.looseObject({}));
const goals = createRepo('habits_goal', z.looseObject({}));
const entries = createRepo('habits_entry', z.looseObject({}));
const sessions = createRepo('timetrack_session', z.looseObject({}));

beforeEach(async () => {
  for (const t of [
    'finance_account',
    'finance_transaction',
    'habits_goal',
    'habits_entry',
    'timetrack_session',
    '_outbox',
    '_meta',
    '_settings',
  ])
    await db.table(t).clear();
});

it('a deleted account is listed once and brings its bookings back', async () => {
  const cash = await accounts.create({ name: 'Bargeld' });
  const tx = await bookings.create({ accountId: cash.id, payee: 'Bäcker', amountMinor: 350 });
  await bookings.create({ accountId: cash.id, payee: 'Kiosk', amountMinor: 200 });
  await bookings.removeMany((await bookings.active().toArray()).map((b) => b.id));
  await accounts.remove(cash.id);

  const listed = await listTrash();
  expect(listed.map((e) => [e.title, e.kind])).toEqual([['Bargeld', 'account']]);
  await restoreEntry(listed[0]!);
  expect((await bookings.active().toArray()).map((b) => b.payee).sort()).toEqual([
    'Bäcker',
    'Kiosk',
  ]);
  expect(await bookings.get(tx.id)).toBeDefined();
});

it('lists a single deleted booking, but not imported ones', async () => {
  const main = await accounts.create({ name: 'Girokonto' });
  const own = await bookings.create({ accountId: main.id, payee: 'Miete', amountMinor: 90000 });
  await bookings.create(
    { accountId: main.id, payee: 'Bank', amountMinor: 100 },
    { id: 'imp-b1-0' },
  );
  await bookings.removeMany([own.id, 'imp-b1-0']);
  expect((await listTrash()).map((e) => [e.title, e.kind])).toEqual([['Miete', 'booking']]);
});

it('a deleted habit comes back with its history; a time entry is listed', async () => {
  const goal = await goals.create({ name: 'Wasser trinken' });
  const day = await entries.create({ goalId: goal.id, date: '2026-11-04', count: 3 });
  await entries.removeMany([day.id]);
  await goals.remove(goal.id);
  const s = await sessions.create({ date: '2026-11-05', startTime: '08:00', note: 'Doku' });
  await sessions.remove(s.id);

  const listed = await listTrash();
  expect(listed.map((e) => [e.title, e.kind]).sort()).toEqual([
    ['Doku', 'session'],
    ['Wasser trinken', 'habit'],
  ]);
  await restoreEntry(listed.find((e) => e.kind === 'habit')!);
  expect(await entries.get(day.id)).toBeDefined();
});

it('a deleted transfer is listed once and comes back as a pair', async () => {
  const a = await accounts.create({ name: 'Giro' });
  const b = await accounts.create({ name: 'Spar' });
  const out = await bookings.create({
    accountId: a.id,
    payee: 'Umbuchung',
    amountMinor: 5000,
    transferId: 't1',
  });
  const into = await bookings.create({
    accountId: b.id,
    payee: 'Umbuchung',
    amountMinor: 5000,
    transferId: 't1',
  });
  await bookings.removeMany([out.id, into.id]);

  const listed = await listTrash();
  expect(listed.map((e) => e.kind)).toEqual(['booking']);
  await restoreEntry(listed[0]!);
  expect((await bookings.active().toArray()).map((x) => x.id).sort()).toEqual(
    [out.id, into.id].sort(),
  );
});
