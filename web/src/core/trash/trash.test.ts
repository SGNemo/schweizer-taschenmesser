import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { putBlob, getBlob } from '@/core/blobs';
import { db } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { TRASH_GRACE_MS, TRASH_RETENTION_MS } from '@/core/db/trash';
import { setTrashKeep, trashRetentionMs } from './settings';
import { flushPurgeQueue, listTrash, purgeEntry, restoreEntry } from './trash';

const docs = createRepo('vault_document', z.looseObject({}));
const subs = createRepo('subscriptions_subscription', z.looseObject({}));
const events = createRepo('calendar_event', z.looseObject({}));
const tasks = createRepo('todos_task', z.looseObject({}));
const notes = createRepo('notes_note', z.looseObject({}));
const people = createRepo('people_person', z.looseObject({}));

beforeEach(async () => {
  await Promise.all(
    [
      'vault_document',
      'subscriptions_subscription',
      'calendar_event',
      'todos_task',
      'notes_note',
      'people_person',
      '_outbox',
      '_blobs',
      '_meta',
      '_secrets',
      '_settings',
    ].map((t) => db.table(t).clear()),
  );
});

describe('recently deleted', () => {
  it('lists deleted records of the allow-list, newest first, with a kind and days left', async () => {
    const d = await docs.create({ title: 'Mietvertrag' });
    const s = await subs.create({ name: 'Streaming' });
    const r = await events.create({ title: 'Tabletten', kind: 'reminder' });
    await events.create({ title: 'bleibt' });
    await docs.remove(d.id);
    await subs.remove(s.id);
    await events.remove(r.id);
    const list = await listTrash();
    expect(list.map((e) => e.title).sort()).toEqual(['Mietvertrag', 'Streaming', 'Tabletten']);
    expect(list.find((e) => e.title === 'Tabletten')?.kind).toBe('reminder');
    expect(list.find((e) => e.title === 'Mietvertrag')?.kind).toBe('document');
    expect(list.every((e) => e.daysLeft >= 29 && e.daysLeft <= 30)).toBe(true);
  });

  it('lists ToDos, notes (title or first line of the body) and people too', async () => {
    const t = await tasks.create({ title: 'Steuer machen' });
    const n1 = await notes.create({ title: 'Idee', body: 'x' });
    const n2 = await notes.create({ title: '', body: '\n  Einkaufszettel Samstag\nMilch' });
    const p = await people.create({ name: 'Anna' });
    for (const [repo, r] of [
      [tasks, t],
      [notes, n1],
      [notes, n2],
      [people, p],
    ] as const) {
      await repo.remove(r.id);
    }
    const list = await listTrash();
    expect(list.map((e) => `${e.kind}:${e.title}`).sort()).toEqual([
      'note:Einkaufszettel Samstag',
      'note:Idee',
      'person:Anna',
      'todo:Steuer machen',
    ]);
  });

  it('hides records older than the window', async () => {
    const d = await docs.create({ title: 'alt' });
    await docs.remove(d.id);
    const later = Date.now() + TRASH_RETENTION_MS + 1000;
    expect(await listTrash(db, later, TRASH_RETENTION_MS)).toEqual([]);
  });

  it('restoring brings the record back as a normal write', async () => {
    const d = await docs.create({ title: 'Mietvertrag' });
    await docs.remove(d.id);
    const [entry] = await listTrash();
    await restoreEntry(entry!);
    expect((await docs.get(d.id))?.title).toBe('Mietvertrag');
    expect(await listTrash()).toEqual([]);
  });

  it('refuses collections outside the allow-list (the password vault never takes part)', async () => {
    await expect(restoreEntry({ table: 'accounts_entry', id: 'x' })).rejects.toThrow();
    await expect(purgeEntry({ table: 'accounts_entry', id: 'x' })).rejects.toThrow();
  });

  it('removes for good right away when no sync server is set up, files included', async () => {
    const d = await docs.create({ title: 'Mietvertrag' });
    await putBlob(d.id, new Blob(['x']));
    await docs.remove(d.id);
    expect(await purgeEntry({ table: 'vault_document', id: d.id })).toBe(true);
    expect(await db.table('vault_document').get(d.id)).toBeUndefined();
    expect(await db.table('_outbox').get(['vault_document', d.id])).toBeUndefined();
    expect(await getBlob(d.id)).toBeUndefined();
  });

  it('waits for the sync server when the deletion has not reached it yet', async () => {
    await db
      .table('_secrets')
      .put({ key: 'syncConfig', value: { url: 'https://example.invalid' } });
    const d = await docs.create({ title: 'Mietvertrag' });
    await docs.remove(d.id); // queued in the outbox
    expect(await purgeEntry({ table: 'vault_document', id: d.id })).toBe(false);
    // hidden from the list, but the row stays so other devices still learn of the deletion
    expect(await listTrash()).toEqual([]);
    expect(await db.table('vault_document').get(d.id)).toBeDefined();
    expect(await flushPurgeQueue()).toBe(1);

    await db.table('_outbox').clear(); // the sync pushed it
    expect(await flushPurgeQueue()).toBe(0);
    expect(await db.table('vault_document').get(d.id)).toBeUndefined();
  });

  it('the switch shortens the window to a grace period', async () => {
    expect(await trashRetentionMs()).toBe(TRASH_RETENTION_MS);
    await setTrashKeep(false);
    expect(await trashRetentionMs()).toBe(TRASH_GRACE_MS);
  });
});
