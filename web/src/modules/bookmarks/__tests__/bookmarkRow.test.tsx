// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { Stored } from '@/core/db/types';
import { ItemList } from '@/ui';
import { BookmarkRow, bookmarkMenu } from '../components/BookmarkRow';
import { itemRepo } from '../repo';
import { itemSchema, type BookmarkItem } from '../schema';

beforeEach(async () => {
  await db.table('bookmarks_item').clear();
});

const stored = (over: Record<string, unknown>) =>
  ({
    ...itemSchema.parse({ title: 'x', ...over }),
    id: 'i1',
    createdAt: 1,
    updatedAt: 1,
    deviceId: 'd',
    _f: {},
  }) as unknown as Stored<BookmarkItem>;

function setup(item: Stored<BookmarkItem>) {
  const onEdit = vi.fn();
  const onFilterTag = vi.fn();
  render(
    <ItemList label="Merkliste">
      <BookmarkRow item={item} onEdit={onEdit} onFilterTag={onFilterTag} />
    </ItemList>,
  );
  return { onEdit, onFilterTag, row: screen.getByRole('listitem') };
}

const openMenu = async (row: HTMLElement) => {
  await userEvent.setup().click(within(row).getByRole('button', { name: 'Weitere Aktionen' }));
  return screen.getByRole('menu');
};

describe('BookmarkRow', () => {
  it('has exactly one link, named by the title, opening in a new tab safely', () => {
    const { row } = setup(
      stored({ title: 'Pasta Rezept', url: 'https://www.koch.de/pasta', tags: ['Kochen'] }),
    );
    const links = within(row).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(/^Pasta Rezept/);
    expect(links[0]).toHaveAttribute('href', 'https://www.koch.de/pasta');
    expect(links[0]).toHaveAttribute('rel', 'noreferrer noopener');
    expect(within(row).getByText(/koch\.de.*#Kochen/)).toBeVisible(); // domain and tags as text
  });

  it('an item without an address has no link: the title opens the editor', async () => {
    const { row, onEdit } = setup(stored({ title: 'Dune', kind: 'watch' }));
    expect(within(row).queryByRole('link')).toBeNull();
    await userEvent.setup().click(within(row).getByRole('button', { name: /^Dune/ }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('the menu holds edit, copy link, one entry per tag, duplicate and delete', async () => {
    const { row, onEdit, onFilterTag } = setup(
      stored({ title: 'Pasta', url: 'https://koch.de/', tags: ['Kochen', 'Rezept'] }),
    );
    const menu = await openMenu(row);
    const names = within(menu)
      .getAllByRole('menuitem')
      .map((e) => e.textContent);
    expect(names).toEqual([
      'Bearbeiten',
      'Link kopieren',
      'Kochen',
      'Rezept',
      'Duplizieren',
      'Löschen',
    ]);
    const user = userEvent.setup();
    await user.click(within(menu).getByRole('menuitem', { name: 'Rezept' }));
    expect(onFilterTag).toHaveBeenCalledWith('Rezept');
    await user.click(within(await openMenu(row)).getByRole('menuitem', { name: 'Bearbeiten' }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('without an address there is no "Link kopieren"', async () => {
    const { row } = setup(stored({ title: 'Dune' }));
    const menu = await openMenu(row);
    expect(within(menu).queryByRole('menuitem', { name: 'Link kopieren' })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Löschen' })).toBeVisible();
  });

  it('"Duplizieren" stores an open copy', async () => {
    const created = await itemRepo.create(
      itemSchema.parse({ title: 'Pasta', url: 'https://koch.de/', done: true }),
    );
    const { row } = setup({ ...stored({}), ...created });
    await userEvent
      .setup()
      .click(within(await openMenu(row)).getByRole('menuitem', { name: 'Duplizieren' }));
    const all = await itemRepo.active().toArray();
    expect(all).toHaveLength(2);
    expect(all.filter((i) => !i.done)).toHaveLength(1);
  });

  it('the menu of a tile (no tag filter on that view) has no tag entries', () => {
    const ids = bookmarkMenu(
      stored({ title: 'Bahn', url: 'https://bahn.example/', tags: ['Reisen'] }),
      {
        edit: vi.fn(),
      },
    ).map((m) => m.id);
    expect(ids).toEqual(['edit', 'copy-link', 'duplicate', 'delete']);
  });
});
