import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { itemRepo } from '../repo';
import start, { addRequested } from '../services';

beforeEach(async () => {
  await db.table('bookmarks_item').clear();
});

describe('bookmark.requested', () => {
  it('stores a link once and normalises it', async () => {
    await addRequested({ title: 'Ein Artikel', url: 'https://news.example.test/a' });
    await addRequested({ title: 'Ein Artikel', url: 'https://news.example.test/a' });
    await addRequested({ title: 'x', url: 'javascript:alert(1)' });
    const items = await itemRepo.active().toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Ein Artikel',
      url: 'https://news.example.test/a',
      kind: 'read',
    });
  });

  it('is handled while the module service runs, and not after it stopped', async () => {
    const stop = start();
    await bus.emit('bookmark.requested', {
      title: 'Über den Bus',
      url: 'https://news.example.test/b',
    });
    expect((await itemRepo.active().toArray()).map((i) => i.title)).toEqual(['Über den Bus']);
    stop();
    await bus.emit('bookmark.requested', { title: 'Zu spät', url: 'https://news.example.test/c' });
    expect(await itemRepo.active().count()).toBe(1);
  });
});
