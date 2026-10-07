// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup } from '@/core/backup/backup';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { setNow } from '@/core/time/now';
import {
  applySeed,
  autoFillIfEmpty,
  isSeedSyncOn,
  readSeedState,
  removeSeed,
  setSeedSync,
} from './dev';

const TODAY = '2026-09-29';
const manifest = (id: string) => allManifests.find((m) => m.id === id)!;
const notes = () => createCollectionRepo(manifest('notes'), 'note', db);

beforeEach(async () => {
  setNow(() => new Date(`${TODAY}T10:00:00`).getTime());
  localStorage.clear();
  await Promise.all(db.tables.map((t) => t.clear()));
});

const opts = { scale: 'small', today: TODAY, afterSeed: false } as const;

describe('seed runner', () => {
  it('removes only seed rows – real data stays', async () => {
    const real = await notes().create({ title: 'Meine echte Notiz', body: '', pinned: false });
    await applySeed(opts);
    expect((await notes().active().count()) > 1).toBe(true);
    await removeSeed();
    const left = await notes().active().toArray();
    expect(left.map((n) => n.id)).toEqual([real.id]);
    expect(await readSeedState()).toBeUndefined();
  });

  it('keeps seed rows out of the sync outbox and out of "upload everything"', async () => {
    await applySeed(opts);
    const storage = new DexieStorageAdapter(db);
    await notes().create({ title: 'Echt', body: '', pinned: false });
    await storage.markAllDirty();
    const batch = await storage.readOutbox(10_000);
    const ids = batch.entries.map((e) => e.id);
    expect(ids.some((id) => id.startsWith('seed-'))).toBe(false);
    expect(batch.entries.some((e) => e.collection === 'notes_note')).toBe(true);
  });

  it('seed sync is off by default and queues the rows once when switched on', async () => {
    await applySeed(opts);
    expect(await isSeedSyncOn(db)).toBe(false);
    await setSeedSync(true, db);
    const storage = new DexieStorageAdapter(db);
    const batch = await storage.readOutbox(100_000);
    expect(batch.entries.some((e) => e.id.startsWith('seed-notes-note'))).toBe(true);
    // Switched on once → removal now writes tombstones so the server forgets them too.
    await removeSeed();
    const row = await db.table('notes_note').get('seed-notes-note-0');
    expect(row?.deletedAt).not.toBeNull();
  });

  it('keeps seed rows out of backups', async () => {
    await applySeed(opts);
    await notes().create({ title: 'Echt', body: '', pinned: false });
    const backup = await createBackup(db);
    const rows = backup.tables['notes_note']!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'Echt' });
  });
});

describe('auto fill', () => {
  it('fills a really empty database once and sets the banner', async () => {
    expect(await autoFillIfEmpty(db)).toBe(true);
    expect((await readSeedState())?.scale).toBe('medium');
    expect(await db.table('_meta').get('seed.banner')).toBeTruthy();
    // Second start: marker set, nothing happens even after removal.
    await removeSeed();
    expect(await autoFillIfEmpty(db)).toBe(false);
    expect(await notes().active().count()).toBe(0);
  }, 60_000);

  it('never touches an app that already has data', async () => {
    await notes().create({ title: 'Echt', body: '', pinned: false });
    expect(await autoFillIfEmpty(db)).toBe(false);
    expect(await notes().active().count()).toBe(1);
    expect(await readSeedState()).toBeUndefined();
  });

  it('creates the demo vault only when there is none', async () => {
    const spy = vi.fn();
    void spy;
    await autoFillIfEmpty(db);
    expect(await db.table('accounts_vault').count()).toBe(1);
  }, 60_000);
});
