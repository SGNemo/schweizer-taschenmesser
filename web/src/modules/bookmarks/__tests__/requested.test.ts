import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus, type EventMap } from '@/core/events';
import { KINDS } from '../schema';
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

  it('takes a known kind and tags from the request, and ignores an unknown kind', async () => {
    await addRequested({
      title: 'Ein Film',
      url: 'https://film.example.test/a',
      kind: 'watch',
      tags: [' Abend ', 'Abend', ''],
    });
    await addRequested({ title: 'Was', url: 'https://film.example.test/b', kind: 'bogus' });
    const items = await itemRepo.active().toArray();
    expect(items.find((i) => i.title === 'Ein Film')).toMatchObject({
      kind: 'watch',
      tags: ['Abend'],
    });
    expect(items.find((i) => i.title === 'Was')?.kind).toBe('read');
  });

  it('the event accepts every kind the module knows (buy, try included)', async () => {
    // Type-level: fails `typecheck` when the event's kind union lags behind KINDS.
    const kinds: NonNullable<EventMap['bookmark.requested']['kind']>[] = [...KINDS];
    await addRequested({ title: 'Kaufen', url: 'https://shop.example.test/a', kind: 'buy' });
    await addRequested({ title: 'Probieren', url: 'https://shop.example.test/b', kind: 'try' });
    const items = await itemRepo.active().toArray();
    expect(kinds).toContain('try');
    expect(items.find((i) => i.title === 'Kaufen')?.kind).toBe('buy');
    expect(items.find((i) => i.title === 'Probieren')?.kind).toBe('try');
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

describe('bookmark.requested and tracking parameters', () => {
  it('the same page with a tracking parameter is not stored twice', async () => {
    await addRequested({ title: 'Artikel', url: 'https://news.example.test/b' });
    await addRequested({ title: 'Artikel', url: 'http://www.news.example.test/b/?utm_source=x' });
    expect(await itemRepo.active().toArray()).toHaveLength(1);
  });
});
