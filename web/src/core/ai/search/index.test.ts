import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { eventRepo } from '@/modules/calendar/repo';
import { taskRepo } from '@/modules/todos/repo';
import { taskSchema } from '@/modules/todos/schema';
import { aiModules } from '../scope';
import { clearAll, ctxFor, seed, useFixedClock } from '../testing';
import { searchEntries } from './fulltext';
import { docOf, newMiniSearch, resetSearchIndexes } from './index';

beforeEach(async () => {
  useFixedClock();
  resetSearchIndexes();
  await clearAll();
  await seed();
});
afterAll(() => {
  setNow();
  resetSearchIndexes();
});

const titles = async (q: string, ctx = ctxFor()) =>
  (await searchEntries(q, ctx)).map((h) => h.title);
const event = (title: string) =>
  eventRepo.create({ title, startDate: '2026-10-03', startTime: '10:00', allDay: false });

describe('search index: stays current without being rebuilt per query', () => {
  it('finds new, edited, deleted and restored entries and forgets purged ones', async () => {
    expect(await titles('Wurzelbehandlung')).toEqual([]);
    const created = await event('Wurzelbehandlung');
    expect(await titles('Wurzelbehandlung')).toEqual(['Wurzelbehandlung']);

    await eventRepo.update(created.id, { title: 'Kronenreinigung' });
    expect(await titles('Wurzelbehandlung')).toEqual([]);
    expect(await titles('Kronenreinigung')).toEqual(['Kronenreinigung']);

    await eventRepo.remove(created.id);
    expect(await titles('Kronenreinigung')).toEqual([]);
    await eventRepo.restore(created.id);
    expect(await titles('Kronenreinigung')).toEqual(['Kronenreinigung']);

    await db.table('calendar_event').delete(created.id); // a hard delete (cache purge, sync reset)
    expect(await titles('Kronenreinigung')).toEqual([]);
  });

  it('reads only the table that changed, and nothing while nothing changed', async () => {
    await titles('Netflix'); // builds the index
    const events = vi.spyOn(db.table('calendar_event'), 'toArray');
    const tasks = vi.spyOn(db.table('todos_task'), 'toArray');
    await titles('Netflix');
    await titles('Vodafone');
    expect(events).not.toHaveBeenCalled();
    expect(tasks).not.toHaveBeenCalled();

    await event('Fußpflege');
    expect(await titles('Fußpflege')).toEqual(['Fußpflege']);
    expect(events).toHaveBeenCalledTimes(1);
    expect(tasks).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does not re-add documents that did not change', async () => {
    await titles('Milch');
    const before = await titles('Milch');
    await taskRepo.create(taskSchema.parse({ listId: 'inbox', title: 'Brot kaufen' }));
    expect(await titles('Milch')).toEqual(before);
    expect(await titles('Brot')).toEqual(['Brot kaufen']);
  });

  it('only searches the modules it is given, with its own index per set of modules', async () => {
    expect(await titles('Vodafone', ctxFor(['invoices']))).toEqual(['Vodafone']);
    expect(await titles('Vodafone', ctxFor(['todos']))).toEqual([]);
    expect(await titles('Vodafone', ctxFor())).toEqual(['Vodafone']);
  });

  it('ranks like an index that was built fresh from the same documents', async () => {
    const ctx = ctxFor();
    await event('Zahnarzt Kontrolle');
    await event('Zahnarzt Nachsorge Dr. Weiß');
    await titles('Zahnarzt'); // index built
    await event('Hausarzt Zahnschiene');
    await eventRepo.update((await db.table('calendar_event').toArray())[0].id, {
      note: 'Zahnarzt',
    });

    const fresh = newMiniSearch();
    for (const manifest of aiModules(ctx.manifests))
      for (const [collection, schema] of Object.entries(manifest.aiSchema.collections)) {
        const fields = schema.searchable ?? [];
        if (!fields.length) continue;
        const part = { manifest, collection, titleField: schema.titleField, fields: [...fields] };
        const rows = await db.table(`${manifest.id}_${collection}`).toArray();
        for (const row of rows) if (row.deletedAt === null) fresh.add(docOf(part, row));
      }

    for (const q of ['zahnarzt', 'zahn', 'stadtwerke', 'miete ueberweisen']) {
      const mine = (await searchEntries(q, ctx)).map((h) => h.id);
      const expected = fresh
        .search(q, { combineWith: 'AND' })
        .map((h) => String(h.id).split('/').slice(2).join('/'));
      expect(new Set(mine)).toEqual(new Set(expected.slice(0, mine.length)));
      expect(mine.slice(0, 3)).toEqual(expected.slice(0, 3));
    }
  });
});
