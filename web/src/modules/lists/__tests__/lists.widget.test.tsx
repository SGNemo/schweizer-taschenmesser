// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { itemRepo, listRepo } from '../repo';
import OpenListsWidget from '../widgets/OpenListsWidget';
import PackingWidget from '../widgets/PackingWidget';

const view = (widget = <OpenListsWidget />) => render(<MemoryRouter>{widget}</MemoryRouter>);

describe('lists widget', () => {
  beforeEach(async () => {
    await db.table('lists_list').clear();
    await db.table('lists_item').clear();
  });

  it('shows an empty state with an action when there is no data', async () => {
    view();
    expect(await screen.findByRole('link', { name: /anlegen/ })).toHaveAttribute(
      'href',
      '/lists?new=1',
    );
  });

  it('shows the open shopping entries, ticked off in place', async () => {
    await listRepo.create(
      { name: 'Einkauf', kind: 'shopping', order: 0 },
      { id: 'shopping-default' },
    );
    await itemRepo.create({
      listId: 'shopping-default',
      name: 'Milch',
      quantity: '2',
      done: false,
      order: 0,
    });
    await itemRepo.create({ listId: 'shopping-default', name: 'Brot', done: true, order: 1 });
    view();
    expect(await screen.findByText('Milch (2)')).toBeInTheDocument();
    expect(screen.queryByText('Brot')).toBeNull();
    expect(screen.getByText('1 Artikel offen')).toBeInTheDocument();
  });

  it('shows the progress of packing lists under way', async () => {
    await listRepo.create({ name: 'Camping', kind: 'packing', order: 1 }, { id: 'camp' });
    await itemRepo.create({ listId: 'camp', name: 'Zelt', done: true, order: 0 });
    await itemRepo.create({ listId: 'camp', name: 'Kocher', done: false, order: 1 });
    view(<PackingWidget />);
    expect(await screen.findByText('Camping')).toBeInTheDocument();
    expect(screen.getByText('1 von 2 gepackt')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });
});
