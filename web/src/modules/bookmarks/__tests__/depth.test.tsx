// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { getBlob } from '@/core/blobs';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setSettings } from '@/core/settings/settings';
import { BookmarkCard } from '../components/BookmarkCard';
import { Pinboard } from '@/ui/identity';
import { filterItems, statusOf } from '../logic';
import { fetchPreviewFor, previewEnabled, previewKey } from '../preview';
import { itemRepo } from '../repo';
import { itemSchema, type BookmarkItem } from '../schema';
import { settings as moduleSettings, settingsSchema } from '../settings';
import { addRequested } from '../services';

const base = { createdAt: 1, tags: [], done: false, started: false } as const;
const make = (
  title: string,
  over: Partial<BookmarkItem> & { createdAt?: number } = {},
): BookmarkItem & { createdAt: number } => ({ ...base, tags: [], title, kind: 'link', ...over });

describe('status and sorting', () => {
  it('done beats started beats open', () => {
    expect(statusOf({ done: false, started: false })).toBe('open');
    expect(statusOf({ done: false, started: true })).toBe('started');
    expect(statusOf({ done: true, started: true })).toBe('done');
  });

  it('sorts by title, by type and by status', () => {
    const items = [
      make('Beta', { kind: 'idea', createdAt: 3 }),
      make('Alpha', { kind: 'book', started: true, createdAt: 2 }),
      make('Gamma', { kind: 'link', done: true, createdAt: 1 }),
    ];
    const f = { view: 'all', kind: 'all', query: '' } as const;
    expect(filterItems(items, f, 'title').map((i) => i.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(filterItems(items, f, 'kind').map((i) => i.title)).toEqual(['Gamma', 'Alpha', 'Beta']);
    expect(filterItems(items, f, 'status').map((i) => i.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(filterItems(items, f).map((i) => i.title)).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it('old records without the new fields still parse', () => {
    const parsed = itemSchema.parse({ title: 'Alt', kind: 'read' });
    expect(parsed.started).toBe(false);
    expect(parsed.preview).toBeUndefined();
    expect(itemSchema.safeParse({ title: 'Buch', kind: 'book' }).success).toBe(true);
  });
});

describe('signature and card', () => {
  it('the pinboard is the library block: decoration, hidden from assistive technology, no titles', () => {
    render(<Pinboard size="M" />);
    const board = document.querySelector('[data-signature="pinboard"]')!;
    expect(board).toHaveAttribute('aria-hidden', 'true');
    expect(board.querySelectorAll('i')).toHaveLength(3);
    expect(board.textContent).toBe('');
  });

  it('a card shows type, status and site as words, and a monogram without a picture', () => {
    render(
      <BookmarkCard
        item={
          {
            id: 'x',
            ...base,
            title: 'Ein Artikel',
            kind: 'read',
            started: true,
            url: 'https://www.example.org/a',
            tags: ['news'],
          } as never
        }
        onEdit={() => {}}
        onFilterTag={() => {}}
      />,
    );
    const card = screen.getByTestId('bookmark-card');
    expect(card).toHaveTextContent('Lesen · Angefangen · example.org');
    expect(card).toHaveTextContent('#news');
    expect(screen.getByRole('link', { name: /Ein Artikel/ })).toHaveAttribute(
      'href',
      'https://www.example.org/a',
    );
    expect(card.querySelector('img')).toBeNull();
  });
});

describe('link preview', () => {
  const html =
    '<title>x</title><meta property="og:title" content="Der Titel"><meta property="og:site_name" content="Beispiel"><meta property="og:description" content="Kurz"><meta property="og:image" content="https://img.example.org/c.png">';
  beforeEach(async () => {
    await db.table('bookmarks_item').clear();
    await db.table('_blobs').clear();
    await db.table('_settings').clear();
    const web = createWebPlatform();
    setPlatform({
      ...web,
      kind: 'desktop',
      isNative: true,
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('.png'))
          return new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'content-type': 'image/png' },
          });
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
      }) as typeof fetch,
    });
  });

  it('is off by default and does nothing then', async () => {
    expect(moduleSettings.defaults).toMatchObject({ linkPreview: false });
    expect(await previewEnabled()).toBe(false);
    await addRequested({ title: 'T', url: 'https://www.example.org/a' });
    await new Promise((r) => setTimeout(r, 50));
    const [item] = await itemRepo.active().toArray();
    expect(item!.preview).toBeUndefined();
    expect(setPlatform).toBeTypeOf('function');
  });

  it('stores plain data on the item and the picture on this device only', async () => {
    const item = await itemRepo.create({
      title: 'T',
      url: 'https://www.example.org/a',
      kind: 'link',
      tags: [],
      done: false,
      started: false,
    });
    await fetchPreviewFor(item.id, 'https://www.example.org/a');
    const stored = await itemRepo.get(item.id);
    expect(stored!.preview).toEqual({ site: 'Beispiel', description: 'Kurz', image: true });
    expect((await getBlob(previewKey(item.id)))?.type).toBe('image/png');
  });

  it('a failing page leaves no preview and no error', async () => {
    setPlatform({
      ...createWebPlatform(),
      kind: 'desktop',
      isNative: true,
      fetch: (async () => new Response('nope', { status: 500 })) as typeof fetch,
    });
    const item = await itemRepo.create({
      title: 'T',
      url: 'https://www.example.org/a',
      kind: 'link',
      tags: [],
      done: false,
      started: false,
    });
    await expect(fetchPreviewFor(item.id, 'https://www.example.org/a')).resolves.toBeUndefined();
    expect((await itemRepo.get(item.id))!.preview).toBeUndefined();
  });

  it('is switched on through the setting and then fetched after a request', async () => {
    await setSettings('module.bookmarks', { linkPreview: true });
    expect(
      settingsSchema.parse({ ...moduleSettings.defaults, linkPreview: true }).linkPreview,
    ).toBe(true);
    expect(await previewEnabled()).toBe(true);
    await addRequested({ title: 'T', url: 'https://www.example.org/b' });
    await vi.waitFor(async () => {
      const [item] = await itemRepo.active().toArray();
      expect(item!.preview?.site).toBe('Beispiel');
    });
  });
});
