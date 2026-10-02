import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseBackup } from '@/core/backup/backup';
import { restoreBackup } from '@/core/backup/restore';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { connect, syncNow, type SyncServiceDeps } from '@/core/sync/service';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { ideaSchema } from '@/modules/gifts/schema';
import { giftSchema } from '@/modules/people/schema';
import { createTestDb } from '@/test-utils';
import { runAppMigrations } from './appMigrations';
import { personIdFor } from './appMigrationSteps';

/**
 * Package 4 against a backup in the 0.3.1 format (invented data): contracts become documents,
 * birthdays become people and gift ideas attach to the person with the same name.
 */
const FIXTURE = resolve(process.cwd(), 'src/core/backup/fixtures/backup-0.3.1-people.json');
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

describe('0.3.1 backup → Unterlagen and Personen', () => {
  it('copies contracts to documents with the same id (kind → category), tombstones included', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const docs = await db.table('vault_document').toArray();
    const rows = docs
      .filter((d) => d.id.startsWith('fx-con'))
      .map((d) => [
        d.id,
        d.title,
        d.category,
        d.provider,
        d.endDate,
        d.noticeDays,
        d.deletedAt === null,
      ])
      .sort();
    expect(rows).toEqual([
      ['fx-con-1', 'Handyvertrag', 'contract', 'Funkwelle Mobil GmbH', '2026-12-31', 90, true],
      ['fx-con-2', 'Waschmaschine Garantie', 'warranty', undefined, '2027-03-01', undefined, true],
      [
        'fx-con-3',
        'Hausratversicherung',
        'insurance',
        'Sicherhaus Versicherung AG',
        '2026-11-30',
        30,
        true,
      ],
      ['fx-con-4', 'Altes Abo', 'contract', undefined, undefined, undefined, false],
    ]);
    // The existing document is untouched (still carries the old field until its module migration).
    expect(docs.find((d) => d.id === 'fx-doc-1')).toMatchObject({
      title: 'Reisepass',
      expiresOn: '2027-05-01',
    });
  });

  it('copies birthdays to people (same id, birthday object, empty tags)', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const people = (await live(db, 'people_person')).filter((p) => p.id.startsWith('fx-bday'));
    expect(people.map((p) => [p.id, p.name, p.birthday, p.note, p.tags]).sort()).toEqual([
      ['fx-bday-1', 'Anna Beispiel', { month: 3, day: 15, year: 1985 }, undefined, []],
      ['fx-bday-2', 'Oma Hilde', { month: 12, day: 24 }, 'Kuchen mitbringen', []],
      ['fx-bday-3', 'Max Muster', { month: 11, day: 2, year: 1990 }, undefined, []],
    ]);
    const source = (await db.table('birthdays_birthday').get('fx-bday-1'))!;
    const copy = (await db.table('people_person').get('fx-bday-1'))!;
    expect(copy._f.name).toBe(source._f.name);
  });

  it('attaches gifts to the person with the same name, otherwise to a made-up person', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const gifts = (await live(db, 'people_gift')).sort((a, b) => a.id.localeCompare(b.id));
    expect(gifts.map((g) => [g.id, g.title, g.personId, g.status])).toEqual([
      ['fx-gift-1', 'Kochbuch', 'fx-bday-1', 'idea'],
      ['fx-gift-2', 'Schal', 'fx-bday-1', 'bought'], // spelling differs in spaces and case
      ['fx-gift-3', 'Kerzen', 'person-tante-greta', 'idea'],
      ['fx-gift-4', 'Tee', 'person-tante-greta', 'given'], // same person, other case
      ['fx-gift-5', 'Fotokalender', 'fx-bday-2', 'idea'],
      ['fx-gift-7', 'Rucksack', 'person-jorg-apfel', 'bought'],
    ]);
    expect(gifts[2]).toMatchObject({
      priceCents: 1800,
      url: 'https://shop.example.org/kerzen',
      occasion: 'Weihnachten',
      date: '2026-12-24',
    });
    const madeUp = (await live(db, 'people_person')).filter((p) => p.id.startsWith('person-'));
    expect(madeUp.map((p) => [p.id, p.name]).sort()).toEqual([
      ['person-jorg-apfel', 'Jörg Äpfel'],
      ['person-tante-greta', 'Tante Greta'], // first spelling by creation time
    ]);
    // A deleted gift is copied as a tombstone and does not make up a person.
    expect((await db.table('people_gift').get('fx-gift-6'))?.deletedAt).not.toBeNull();
    expect(await db.table('people_person').get(personIdFor('svenja köhler'))).toBeUndefined();
  });

  it('derives person ids deterministically', () => {
    expect(personIdFor('tante greta')).toBe('person-tante-greta');
    expect(personIdFor('jörg äpfel')).toBe('person-jorg-apfel');
    expect(personIdFor('straße 1')).toBe('person-strasse-1');
    expect(personIdFor('!!!')).toBe('person-unbekannt');
  });

  it('is idempotent, never touches the old tables and queues the copies for sync', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const before = {
      docs: await db.table('vault_document').toArray(),
      people: await db.table('people_person').toArray(),
      gifts: await db.table('people_gift').toArray(),
      outbox: await db.table('_outbox').toArray(),
    };
    const reports = await runAppMigrations(db);
    expect(reports.every((r) => r.copied === 0)).toBe(true);
    expect(await db.table('vault_document').toArray()).toEqual(before.docs);
    expect(await db.table('people_person').toArray()).toEqual(before.people);
    expect(await db.table('people_gift').toArray()).toEqual(before.gifts);
    expect(await db.table('_outbox').toArray()).toEqual(before.outbox);
    expect(await db.table('contracts_contract').count()).toBe(4);
    expect(await db.table('birthdays_birthday').count()).toBe(4);
    expect(await db.table('gifts_idea').count()).toBe(7);
    expect((await db.table('_outbox').toArray()).map((o) => o.collection)).toEqual(
      expect.arrayContaining(['vault_document', 'people_person', 'people_gift']),
    );
  });

  it('also works when the backup replaces the data of a device that already migrated', async () => {
    const db = fresh();
    await restore(db, 'merge');
    await restore(db, 'replace');
    expect((await live(db, 'people_gift')).map((g) => g.id).sort()).toEqual(
      ['fx-gift-1', 'fx-gift-2', 'fx-gift-3', 'fx-gift-4', 'fx-gift-5', 'fx-gift-7'].sort(),
    );
    expect((await live(db, 'people_person')).length).toBe(5);
  });

  it('edits made after the migration are never overwritten by the old rows', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const gifts = createRepo(tableName('people', 'gift'), giftSchema, db);
    await gifts.update('fx-gift-1', { title: 'Backbuch' });
    await restore(db, 'merge');
    await runAppMigrations(db);
    expect((await gifts.get('fx-gift-1'))?.title).toBe('Backbuch');
  });
});

describe('an older device keeps writing the old tables', () => {
  const params = { url: 'https://sync.example', token: 'right-token', encrypt: false };

  it('a gift idea written by the old device lands on the person with that name', async () => {
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
    const ideas = createRepo(tableName('gifts', 'idea'), ideaSchema, oldDb);
    const a = await ideas.create({ title: 'Buch', forWhom: 'Anna', status: 'idea' });
    await runSync({ storage: oldDeps.storage, adapter: server.adapter() });

    await connect(params, newDeps);
    await syncNow(newDeps);
    expect(await newDb.table('people_gift').get(a.id)).toMatchObject({
      personId: 'person-anna',
      title: 'Buch',
      status: 'idea',
    });
    expect(await newDb.table('people_person').get('person-anna')).toMatchObject({ name: 'Anna' });

    await ideas.update(a.id, { status: 'bought' });
    await runSync({ storage: oldDeps.storage, adapter: server.adapter() });
    await syncNow(newDeps);
    expect((await newDb.table('people_gift').get(a.id))?.status).toBe('bought');
  });
});
