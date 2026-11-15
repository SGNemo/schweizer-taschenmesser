// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import { pickWidgetList } from '../logic';
import { itemRepo, listRepo } from '../repo';
import OpenListsWidget from '../widgets/OpenListsWidget';

beforeEach(async () => {
  for (const name of ['lists_list', 'lists_item', '_settings']) await db.table(name).clear();
});

it('picks the chosen list while it is in use, else the shopping list, else the first', () => {
  const l = (id: string, order: number, extra = {}) => ({
    id,
    createdAt: order,
    name: id,
    kind: 'checklist' as const,
    order,
    ...extra,
  });
  const lists = [l('todo', 0), l('shop', 1, { kind: 'shopping' }), l('old', 2, { archived: true })];
  expect(pickWidgetList(lists, 'todo')?.id).toBe('todo');
  expect(pickWidgetList(lists, '')?.id).toBe('shop');
  expect(pickWidgetList(lists, 'old')?.id).toBe('shop');
  expect(pickWidgetList([lists[0]!], 'gone')?.id).toBe('todo');
});

it('the widget shows the chosen list with its name', async () => {
  await listRepo.create({ name: 'Einkauf', kind: 'shopping', order: 0 }, { id: 'shop' });
  await listRepo.create({ name: 'Baumarkt', kind: 'checklist', order: 1 }, { id: 'diy' });
  await itemRepo.create({ listId: 'shop', name: 'Milch', done: false, order: 0 });
  await itemRepo.create({ listId: 'diy', name: 'Schrauben', done: false, order: 0 });
  await setSettings('module.lists', { widgetList: 'diy' });
  render(
    <MemoryRouter>
      <OpenListsWidget />
    </MemoryRouter>,
  );
  expect(await screen.findByText('Schrauben')).toBeInTheDocument();
  expect(screen.getByText('Baumarkt: 1 offen')).toBeInTheDocument();
  expect(screen.queryByText('Milch')).toBeNull();
});
