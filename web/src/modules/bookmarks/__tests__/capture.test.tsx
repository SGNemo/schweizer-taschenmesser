// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { Stored } from '@/core/db/types';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { bookmarkMenu } from '../components/BookmarkRow';
import { ItemEditor } from '../components/ItemEditor';
import { itemRepo } from '../repo';
import type { BookmarkItem } from '../schema';

const html =
  '<title>x</title><meta property="og:site_name" content="Beispiel"><meta property="og:description" content="Kurz">';
const fetched = vi.fn();

beforeEach(async () => {
  await db.table('bookmarks_item').clear();
  await db.table('_blobs').clear();
  await db.table('_settings').clear();
  fetched.mockClear();
  setPlatform({
    ...createWebPlatform(),
    kind: 'desktop',
    isNative: true,
    fetch: vi.fn(async (input: RequestInfo | URL) => {
      fetched(String(input));
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    }) as typeof fetch,
  });
});

const create = (over: Partial<BookmarkItem>) =>
  itemRepo.create({ title: 'x', kind: 'link', tags: [], done: false, started: false, ...over });

describe('duplicate hint in the editor', () => {
  it('names the saved item for the same page, offers to open it and still saves', async () => {
    const old = await create({
      title: 'Pasta',
      url: 'https://www.koch.example/pasta/',
      done: true,
    });
    const onOpenExisting = vi.fn();
    const onClose = vi.fn();
    render(
      <ItemEditor
        target={{ draft: true, title: 'Nudeln', url: 'http://koch.example/pasta?utm_source=x' }}
        onClose={onClose}
        onOpenExisting={onOpenExisting}
      />,
    );
    const hint = await screen.findByTestId('bookmark-duplicate');
    expect(hint).toHaveTextContent(
      'Schon gemerkt: „Pasta“ (Erledigt). Du kannst trotzdem speichern.',
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Vorhandenen öffnen' }));
    expect(onOpenExisting).toHaveBeenCalledWith(expect.objectContaining({ id: old.id }));
    await user.click(screen.getByRole('button', { name: 'Merkzettel eintragen' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await itemRepo.active().count()).toBe(2);
  });

  it('says nothing for another page, and an item is not its own duplicate', async () => {
    const old = await create({ title: 'Pasta', url: 'https://koch.example/pasta' });
    const { unmount } = render(
      <ItemEditor target={{ draft: true, url: 'https://koch.example/pizza' }} onClose={() => {}} />,
    );
    await screen.findByLabelText('Adresse (Link)');
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('bookmark-duplicate')).toBeNull();
    unmount();
    render(<ItemEditor target={old as Stored<BookmarkItem>} onClose={() => {}} />);
    await screen.findByLabelText('Adresse (Link)');
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('bookmark-duplicate')).toBeNull();
  });
});

describe('preview only on a click or for a shared link (setting off)', () => {
  it('a typed link fetches nothing on saving', async () => {
    const onClose = vi.fn();
    render(
      <ItemEditor
        target={{ draft: true, title: 'T', url: 'https://a.example/x' }}
        onClose={onClose}
      />,
    );
    expect(screen.queryByRole('checkbox', { name: /Vorschau von der Seite holen/ })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Merkzettel eintragen' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(fetched).not.toHaveBeenCalled();
  });

  it('a shared link fetches its preview once on saving; without the tick it fetches nothing', async () => {
    const user = userEvent.setup();
    const first = render(
      <ItemEditor
        target={{ draft: true, title: 'T', url: 'https://a.example/x', shared: true }}
        onClose={() => {}}
      />,
    );
    expect(
      await screen.findByRole('checkbox', { name: /Vorschau von der Seite holen/ }),
    ).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Merkzettel eintragen' }));
    await waitFor(async () => {
      const [item] = await itemRepo.active().toArray();
      expect(item?.preview?.site).toBe('Beispiel');
    });
    expect(fetched).toHaveBeenCalledTimes(1);
    first.unmount();

    fetched.mockClear();
    const onClose = vi.fn();
    render(
      <ItemEditor
        target={{ draft: true, title: 'U', url: 'https://b.example/y', shared: true }}
        onClose={onClose}
      />,
    );
    await user.click(await screen.findByRole('checkbox', { name: /Vorschau von der Seite holen/ }));
    await user.click(screen.getByRole('button', { name: 'Merkzettel eintragen' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(fetched).not.toHaveBeenCalled();
  });

  it('the row menu fetches the preview of one item; an item with a preview does not offer it', async () => {
    const item = (await create({ title: 'T', url: 'https://a.example/x' })) as Stored<BookmarkItem>;
    const entry = bookmarkMenu(item, { edit: () => {}, preview: true }).find(
      (m) => m.id === 'preview',
    )!;
    expect(entry.label).toBe('Vorschau von der Seite holen');
    entry.onSelect!();
    await waitFor(async () =>
      expect((await itemRepo.get(item.id))?.preview?.description).toBe('Kurz'),
    );
    const again = (await itemRepo.get(item.id)) as Stored<BookmarkItem>;
    expect(
      bookmarkMenu(again, { edit: () => {}, preview: true }).some((m) => m.id === 'preview'),
    ).toBe(false);
    const plain = (await create({ title: 'Ohne Adresse' })) as Stored<BookmarkItem>;
    expect(
      bookmarkMenu(plain, { edit: () => {}, preview: true }).some((m) => m.id === 'preview'),
    ).toBe(false);
  });
});

describe('the browser app without a sync server cannot ask a page', () => {
  beforeEach(() => {
    setPlatform({ ...createWebPlatform(), fetch: vi.fn() as never });
  });

  it('the row action says so instead of blaming the page', async () => {
    const { fetchPreviewNow, previewAvailable } = await import('../preview');
    const item = await create({ title: 'T', url: 'https://a.example/x' });
    expect(await previewAvailable()).toBe(false);
    expect(await fetchPreviewNow(item.id, 'https://a.example/x')).toBe('unavailable');
    expect((await itemRepo.get(item.id))?.preview).toBeUndefined();
  });

  it('a shared link shows no preview tick there', async () => {
    render(
      <ItemEditor
        target={{ draft: true, title: 'T', url: 'https://a.example/x', shared: true }}
        onClose={() => {}}
      />,
    );
    await screen.findByLabelText('Adresse (Link)');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('checkbox', { name: /Vorschau von der Seite holen/ })).toBeNull();
  });
});
