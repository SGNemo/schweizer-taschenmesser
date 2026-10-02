import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseBackup } from '@/core/backup/backup';
import { restoreBackup } from '@/core/backup/restore';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { collectNotifications } from '@/core/modules/contributions';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { connect, syncNow, type SyncServiceDeps } from '@/core/sync/service';
import { MemoryServer } from '@/core/sync/testing';
import { toEpoch } from '@/core/time/dates';
import { setNow } from '@/core/time/now';
import calendar from '@/modules/calendar/manifest';
import { eventSchema } from '@/modules/calendar/schema';
import { reminderSchema } from '@/modules/reminders/schema';
import { createTestDb } from '@/test-utils';
import { runAppMigrations } from './appMigrations';
import { APP_MIGRATIONS } from './appMigrationSteps';

/** Package 5 against a backup in the 0.3.1 format (invented data): reminders become calendar events. */
const FIXTURE = resolve(process.cwd(), 'src/core/backup/fixtures/backup-0.3.1-reminders.json');
const load = () => {
  const parsed = parseBackup(readFileSync(FIXTURE, 'utf8'));
  if (!parsed.ok) throw new Error('fixture does not parse');
  return parsed.backup;
};

const dbs: TaschenmesserDB[] = [];
let clock = 1_800_000_000_000;
let server: MemoryServer;
beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
  server = new MemoryServer();
});
afterEach(async () => {
  setNow();
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});
const fresh = () => {
  const d = createTestDb();
  dbs.push(d);
  return d;
};
const live = async (db: TaschenmesserDB, table: string) =>
  (await db.table(table).toArray()).filter((r) => r.deletedAt === null);
const restore = (db: TaschenmesserDB, mode: 'merge' | 'replace') =>
  restoreBackup(load(), mode, { database: db, safety: async () => 'safety' });

describe('0.3.1 backup → reminders as calendar events', () => {
  it('copies reminders with the same id as events of the kind "reminder"', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const events = (await db.table('calendar_event').toArray()).filter((e) =>
      e.id.startsWith('fx-rem'),
    );
    expect(
      events
        .map((e) => [
          e.id,
          e.title,
          e.kind,
          e.allDay,
          e.startDate,
          e.startTime,
          e.notify,
          e.deletedAt === null,
        ])
        .sort(),
    ).toEqual([
      [
        'fx-rem-1',
        'Miete überweisen',
        'reminder',
        false,
        '2026-11-01',
        '08:00',
        { minutesBefore: 0, enabled: true },
        true,
      ],
      [
        'fx-rem-2',
        'Paket abholen',
        'reminder',
        false,
        '2026-10-20',
        '17:30',
        { minutesBefore: 0, enabled: true },
        true,
      ],
      [
        'fx-rem-3',
        'Pflanzen gießen',
        'reminder',
        false,
        '2026-10-04',
        '19:00',
        { minutesBefore: 0, enabled: false },
        true,
      ],
      [
        'fx-rem-4',
        'Altes Abo kündigen',
        'reminder',
        false,
        '2026-09-01',
        '09:00',
        { minutesBefore: 0, enabled: true },
        false,
      ],
    ]);
    const rent = events.find((e) => e.id === 'fx-rem-1')!;
    expect(rent.recurrence).toEqual({ freq: 'monthly', interval: 1, byMonthDay: 1 });
    expect(events.find((e) => e.id === 'fx-rem-2')!.note).toBe('Abholschein im Flur');
    // The existing event is untouched.
    expect((await db.table('calendar_event').get('fx-ev-1'))?.title).toBe('Zahnarzt');
    // 1:1 fields keep the stamp of the source field.
    const source = (await db.table('reminders_reminder').get('fx-rem-1'))!;
    expect(rent._f.title).toBe(source._f.title);
    expect(rent._f.startTime).toBe(source._f.time);
    expect(rent._f.notify).toBe(source._f.active);
  });

  it('a migrated reminder notifies once, at the old time of day', async () => {
    const db = fresh();
    await restore(db, 'merge');
    // The notification source reads the default database; copy the migrated events into it.
    const { db: appDb } = await import('@/core/db/db');
    await appDb.table('calendar_event').clear();
    await appDb.table('calendar_event').bulkPut(await db.table('calendar_event').toArray());
    const at = toEpoch('2026-10-20', '17:30');
    const found = await collectNotifications({ from: at - 1000, to: at + 1000 }, [calendar]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ at, title: 'Paket abholen' });
    // The paused reminder is silent.
    const paused = toEpoch('2026-10-04', '19:00');
    expect(
      await collectNotifications({ from: paused - 1000, to: paused + 1000 }, [calendar]),
    ).toEqual([]);
    await appDb.table('calendar_event').clear();
  });

  it('is idempotent, never touches the old table and queues the copies for sync', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const before = {
      events: await db.table('calendar_event').toArray(),
      outbox: await db.table('_outbox').toArray(),
    };
    const reports = await runAppMigrations(db);
    expect(reports.every((r) => r.copied === 0)).toBe(true);
    expect(await db.table('calendar_event').toArray()).toEqual(before.events);
    expect(await db.table('_outbox').toArray()).toEqual(before.outbox);
    expect(await db.table('reminders_reminder').count()).toBe(4);
    expect((await db.table('_outbox').toArray()).map((o) => o.collection)).toContain(
      'calendar_event',
    );
    expect(APP_MIGRATIONS.map((s) => s.id)).toContain('0.7.0-reminder');
  });

  it('also works when the backup replaces the data of a device that already migrated', async () => {
    const db = fresh();
    await restore(db, 'merge');
    await restore(db, 'replace');
    expect((await live(db, 'calendar_event')).map((e) => e.id).sort()).toEqual(
      ['fx-ev-1', 'fx-rem-1', 'fx-rem-2', 'fx-rem-3'].sort(),
    );
  });

  it('edits made after the migration are never overwritten by the old rows', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const events = createRepo(tableName('calendar', 'event'), eventSchema, db);
    await events.update('fx-rem-2', { title: 'Paket bei Nachbarn abholen' });
    await restore(db, 'merge');
    await runAppMigrations(db);
    expect((await events.get('fx-rem-2'))?.title).toBe('Paket bei Nachbarn abholen');
  });
});

describe('an older device keeps writing the old table', () => {
  const params = { url: 'https://sync.example', token: 'right-token', encrypt: false };

  it('a reminder written by the old device lands in the calendar, pausing follows', async () => {
    const oldDb = fresh();
    const newDb = fresh();
    const oldDeps: SyncServiceDeps = {
      database: oldDb,
      storage: new DexieStorageAdapter(oldDb),
      remote: (_u, t) => server.remote(t),
      kdf: { m: 8, t: 1, p: 1 },
    };
    const newDeps: SyncServiceDeps = {
      ...oldDeps,
      database: newDb,
      storage: new DexieStorageAdapter(newDb),
    };
    const reminders = createRepo(tableName('reminders', 'reminder'), reminderSchema, oldDb);
    const r = await reminders.create({
      title: 'Anruf',
      startDate: '2026-10-20',
      time: '12:15',
      active: true,
    });
    await runSync({ storage: oldDeps.storage, adapter: server.adapter() });

    await connect(params, newDeps);
    await syncNow(newDeps);
    expect(await newDb.table('calendar_event').get(r.id)).toMatchObject({
      kind: 'reminder',
      title: 'Anruf',
      startTime: '12:15',
      notify: { minutesBefore: 0, enabled: true },
    });

    await reminders.update(r.id, { active: false });
    await runSync({ storage: oldDeps.storage, adapter: server.adapter() });
    await syncNow(newDeps);
    expect((await newDb.table('calendar_event').get(r.id))?.notify).toEqual({
      minutesBefore: 0,
      enabled: false,
    });
  });
});
