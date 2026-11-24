import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBackup, importBackup, parseBackup, serializeBackup } from '@/core/backup/backup';
import { restoreBackup } from '@/core/backup/restore';
import type { TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests, getManifest } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { deriveKey, isEncrypted, newSalt } from '@/core/sync/crypto';
import { runSync } from '@/core/sync/engine';
import { MemoryServer } from '@/core/sync/testing';
import { purgeTombstones, TOMBSTONE_RETENTION_MS } from '@/core/sync/tombstones';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { addLink, addLinkIfAbsent, linkEntries, linkId, removeLink, removeLinkOf } from './index';
import { copyTodoLinks, todoLink } from './migrate';
import { LINKS_TABLE } from './store';
import type { EntityLink } from './types';

/**
 * Two replicas through a server: the link table travels like any synced table, and one row per link with a
 * deterministic id makes adds commute and a removal the tombstone of that one link (CONCEPT-LINKS §1.2).
 */
const LABEL = 'Rechnung Stadtwerke Oktober';
const THREAD = 'thr-18c2f0a9b7';
const link: EntityLink = {
  from: { module: 'todos', id: 'task-1' },
  to: { module: 'mail', id: THREAD },
  rel: 'origin',
  label: LABEL,
  on: '2026-11-03',
};
const ref = link.from;

let clock = 1_800_000_000_000;
let server: MemoryServer;
const dbs: TaschenmesserDB[] = [];

function device() {
  const db = createTestDb();
  dbs.push(db);
  const storage = new DexieStorageAdapter(db);
  return {
    db,
    sync: (key?: CryptoKey) => runSync({ storage, adapter: server.adapter(), key }),
    live: async () => (await linkEntries(ref, db)).map((e) => e.link.label),
    row: async (id?: string) => db.table(LINKS_TABLE).get(id ?? (await linkId(link))),
  };
}

const tasks = (db: TaschenmesserDB) => createCollectionRepo(getManifest('todos')!, 'task', db);
const newTask = (db: TaschenmesserDB) =>
  tasks(db).create({
    listId: 'inbox',
    title: 'Antworten',
    done: false,
    priority: 0,
    order: 0,
    links: [{ kind: 'mail', id: THREAD, label: LABEL }],
  });

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

describe('links between two devices', () => {
  it('a link added on A appears on B; removed on B it disappears on A', async () => {
    const a = device();
    const b = device();
    await addLink(link, a.db);
    await a.sync();
    await b.sync();
    expect(await b.live()).toEqual([LABEL]);
    expect(await b.row()).toMatchObject({ toKey: `mail:${THREAD}`, on: '2026-11-03' });
    // The reverse read works on the device that only received the row.
    expect(await linkEntries(link.to, b.db)).toHaveLength(1);

    await removeLink(await linkId(link), b.db);
    await b.sync();
    await a.sync();
    expect(await a.live()).toEqual([]);
    expect((await a.row()).deletedAt).not.toBeNull();
  });

  it('the same link made on both devices is one row everywhere', async () => {
    const a = device();
    const b = device();
    await addLink(link, a.db);
    await addLink({ ...link, label: 'Betreff, wie B ihn sah' }, b.db);
    await a.sync();
    await b.sync();
    await a.sync();
    expect(await a.db.table(LINKS_TABLE).count()).toBe(1);
    expect(await b.db.table(LINKS_TABLE).count()).toBe(1);
    expect(await a.live()).toEqual(await b.live());
  });

  it('add on A and remove on B at the same time: the removal wins', async () => {
    const a = device();
    const b = device();
    await addLink(link, a.db);
    await a.sync();
    await b.sync();

    // A adds what it already has (writes nothing) and a writer that is no tap tries too; B removes.
    await addLink(link, a.db);
    expect(await addLinkIfAbsent(link, a.db)).toBe(false);
    await removeLink(await linkId(link), b.db);
    await a.sync();
    await b.sync();
    await a.sync();
    expect(await a.live()).toEqual([]);
    expect(await b.live()).toEqual([]);

    // A stale re-add after the removal arrived – the copy of the ToDo links, any programmatic writer – stays out.
    expect(await addLinkIfAbsent(link, a.db)).toBe(false);
    await a.sync();
    await b.sync();
    expect(await b.live()).toEqual([]);
  });

  it('…unless the add on A was a tap after the removal: then the link is back on both', async () => {
    const a = device();
    const b = device();
    await addLink(link, a.db);
    await a.sync();
    await b.sync();
    await removeLink(await linkId(link), b.db);
    await b.sync();
    await a.sync();
    expect(await a.live()).toEqual([]);

    await addLink({ ...link, label: 'Wieder verknüpft' }, a.db);
    await a.sync();
    await b.sync();
    expect(await a.live()).toEqual(['Wieder verknüpft']);
    expect(await b.live()).toEqual(['Wieder verknüpft']);
    expect(await b.db.table(LINKS_TABLE).count()).toBe(1);
  });

  it('a tap on A that never saw the row and an earlier removal on B: the later stamp decides, on both alike', async () => {
    const a = device();
    const b = device();
    await addLink(link, b.db);
    await removeLink(await linkId(link), b.db);
    await addLink(link, a.db); // later than B's removal
    await b.sync();
    await a.sync();
    await b.sync();
    expect(await a.live()).toEqual([LABEL]);
    expect(await b.live()).toEqual([LABEL]);
  });

  it('two devices that both copy the ToDo links write the same rows', async () => {
    const a = device();
    const b = device();
    const t = await tasks(a.db).create({
      listId: 'inbox',
      title: 'Antworten',
      done: false,
      priority: 0,
      order: 0,
      links: [{ kind: 'mail', id: THREAD, label: LABEL }],
    });
    await a.sync();
    await b.sync();
    expect(await copyTodoLinks(a.db)).toBe(1);
    expect(await copyTodoLinks(b.db)).toBe(1);
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      expect(await d.db.table(LINKS_TABLE).count()).toBe(1);
      expect(await linkEntries({ module: 'todos', id: t.id }, d.db)).toHaveLength(1);
    }
  });

  it('the copy never brings back a link removed elsewhere: B copies and removes, A starts the new version later', async () => {
    const a = device();
    const b = device();
    const t = await newTask(a.db);
    await a.sync();
    await b.sync();
    const todo = { module: 'todos', id: t.id };
    const live = async (d: { db: TaschenmesserDB }) => (await linkEntries(todo, d.db)).length;

    // B runs the new version: copies, the person removes the link there (row and array entry), B pushes.
    await copyTodoLinks(b.db);
    const [entry] = await linkEntries(todo, b.db);
    await removeLink(entry!.id, b.db);
    expect((await tasks(b.db).get(t.id))!.links).toBeUndefined();
    await b.sync();

    // A was closed meanwhile and still holds the array. Worst case: it copies BEFORE its first pull.
    expect(await copyTodoLinks(a.db)).toBe(1);
    expect(await live(a)).toBe(1);
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      expect(await live(d)).toBe(0);
      expect((await tasks(d.db).get(t.id))!.links).toBeUndefined();
      expect(await copyTodoLinks(d.db)).toBe(0);
    }
  });

  it('a removal made while this device has no row yet still syncs: A (offline, not copied) removes, B holds the row', async () => {
    const a = device();
    const b = device();
    const t = await newTask(a.db);
    await a.sync();
    await b.sync();
    const todo = { module: 'todos', id: t.id };
    // B copied and pushed the row. A is offline and has only the array entry.
    await copyTodoLinks(b.db);
    await b.sync();
    expect(await a.db.table(LINKS_TABLE).count()).toBe(0);

    // The person removes the link in A's editor.
    await removeLinkOf(todoLink(t.id, { kind: 'mail', id: THREAD, label: LABEL }), a.db);
    expect((await tasks(a.db).get(t.id))!.links).toBeUndefined();
    expect(await a.db.table(LINKS_TABLE).count()).toBe(1); // the tombstone

    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      expect(await linkEntries(todo, d.db)).toEqual([]);
      expect((await tasks(d.db).get(t.id))!.links).toBeUndefined();
      expect(await copyTodoLinks(d.db)).toBe(0);
    }
  });

  it('A removes offline, B copies later: the removal wins on both', async () => {
    const a = device();
    const b = device();
    const t = await newTask(a.db);
    await a.sync();
    await b.sync();
    await copyTodoLinks(a.db);
    const [entry] = await linkEntries({ module: 'todos', id: t.id }, a.db);
    await removeLink(entry!.id, a.db); // offline: not pushed

    clock += 3_600_000; // B copies an hour later, by the clock long after the removal
    expect(await copyTodoLinks(b.db)).toBe(1);
    await b.sync();
    await a.sync();
    await b.sync();
    for (const d of [a, b]) {
      expect(await linkEntries({ module: 'todos', id: t.id }, d.db)).toEqual([]);
      expect((await tasks(d.db).get(t.id))!.links).toBeUndefined();
    }
  });

  it('with end-to-end encryption the server holds ciphertext only, under an id that names nothing', async () => {
    const key = await deriveKey('a long shared passphrase', newSalt(), 1000);
    const a = device();
    const b = device();
    await addLink(link, a.db);
    await a.sync(key);
    const stored = server.dump().filter((op) => op.collection === LINKS_TABLE);
    expect(stored.map((op) => op.field).sort()).toEqual(
      ['deletedAt', 'from', 'fromKey', 'label', 'on', 'rel', 'to', 'toKey'].sort(),
    );
    expect(stored.every((op) => isEncrypted(op.value))).toBe(true);
    const wire = JSON.stringify(stored);
    for (const secret of [LABEL, THREAD, 'task-1', 'todos:', 'mail:', '2026-11-03', 'origin'])
      expect(wire).not.toContain(secret);
    expect(stored[0]!.id).toMatch(/^[0-9a-f]{64}$/);
    await b.sync(key);
    expect(await b.live()).toEqual([LABEL]);
  });
});

describe('the new relations between two devices (planner hub 2, 10a)', () => {
  // „Vorbereiten“ (package 9): a new ToDo → an appointment. Both ends are linkable today.
  const before: EntityLink = {
    from: { module: 'todos', id: 'task-prep' },
    to: { module: 'calendar', id: 'evt-zahnarzt' },
    rel: 'before',
    label: 'Zahnarzt',
  };
  const count = async (db: TaschenmesserDB) =>
    (await linkEntries(before.to, db)).filter((e) => e.link.rel === 'before').length;

  it('both devices add the same `before` link: one row everywhere, read as `before`', async () => {
    const a = device();
    const b = device();
    await addLink(before, a.db);
    await addLink({ ...before, label: 'Zahnarzt (B)' }, b.db);
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      expect(await d.db.table(LINKS_TABLE).count()).toBe(1);
      expect(await count(d.db)).toBe(1);
      expect((await linkEntries(before.from, d.db))[0]!.link.rel).toBe('before');
    }
    // Not the same row as an `after` or `about` link between the same ends: the relation is part of the id.
    expect(await linkId(before)).not.toBe(await linkId({ ...before, rel: 'after' }));
    expect(await linkId(before)).not.toBe(await linkId({ ...before, rel: 'about' }));
  });

  it('a removal wins over a later silent re-add on the other device', async () => {
    const a = device();
    const b = device();
    await addLink(before, a.db);
    await a.sync();
    await b.sync();
    await removeLink(await linkId(before), b.db);
    await b.sync();
    clock += 3_600_000; // later by the clock
    // A has not pulled yet: a writer that is no tap adds the same link.
    expect(await addLinkIfAbsent(before, a.db)).toBe(false); // A still holds the live row: nothing written
    await a.sync();
    expect(await addLinkIfAbsent(before, a.db)).toBe(false); // the tombstone arrived: counts as present
    await a.sync();
    await b.sync();
    for (const d of [a, b]) expect(await count(d.db)).toBe(0);
  });
});

describe('the table goes where every synced table goes', () => {
  it('is a synced table: sync, backup, restore and the tombstone purge take it from that one list', () => {
    expect(syncedTableNames(allManifests)).toContain(LINKS_TABLE);
  });

  it('backup and restore carry links, tombstones included', async () => {
    const a = device();
    await addLink(link, a.db);
    await addLink({ ...link, to: { module: 'notes', id: 'n1' }, label: 'Notiz' }, a.db);
    await removeLink(await linkId({ ...link, to: { module: 'notes', id: 'n1' } }), a.db);

    const backup = await createBackup(a.db);
    expect(backup.tables[LINKS_TABLE]).toHaveLength(2);
    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const fresh = device();
    await importBackup(parsed.backup, 'merge', fresh.db);
    expect(await fresh.live()).toEqual([LABEL]);
    expect(await fresh.db.table(LINKS_TABLE).count()).toBe(2);
  });

  it('a „replace“ restore of a backup from before the link table brings the links of its ToDos back', async () => {
    const a = device();
    const t = await tasks(a.db).create({
      listId: 'inbox',
      title: 'Alt',
      done: false,
      priority: 0,
      order: 0,
      links: [{ kind: 'note', id: 'n1', label: 'Notiz' }],
    });
    const old = await createBackup(a.db);
    delete old.tables[LINKS_TABLE]; // a backup written by an app without the table
    await copyTodoLinks(a.db);
    await addLink(link, a.db); // made after the backup

    await restoreBackup(old, 'replace', { database: a.db, safety: async () => undefined as never });
    const after = await linkEntries({ module: 'todos', id: t.id }, a.db);
    expect(after.map((e) => e.other)).toEqual([{ module: 'notes', id: 'n1' }]);
  });

  it('the tombstone purge removes old link tombstones once they were pushed', async () => {
    const a = device();
    await addLink(link, a.db);
    await removeLink(await linkId(link), a.db);
    const later = clock + TOMBSTONE_RETENTION_MS + 1000;
    expect(await purgeTombstones(a.db, undefined, later)).toBe(0); // not pushed yet
    await a.sync();
    expect(await purgeTombstones(a.db, undefined, later)).toBe(1);
    expect(await a.db.table(LINKS_TABLE).count()).toBe(0);
  });
});
