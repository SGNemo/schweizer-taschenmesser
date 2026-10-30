// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { placeRepo, routeRepo } from '../repo';
import PlacesWidget from '../widgets/PlacesWidget';

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const view = () =>
  render(
    <MemoryRouter>
      <PlacesWidget />
      <Where />
    </MemoryRouter>,
  );
const end = { label: 'A', lat: 1, lon: 1 };

describe('maps widget', () => {
  beforeEach(async () => {
    await db.table('maps_place').clear();
    await db.table('maps_route').clear();
  });

  it('shows an empty state with an action and asks nothing of the network', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    view();
    expect(await screen.findByRole('link', { name: 'Ort speichern' })).toHaveAttribute(
      'href',
      '/maps?new=1',
    );
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('lists pinned places and routes first and opens one with a tap', async () => {
    await placeRepo.create({ name: 'Alt', lat: 1, lon: 1, category: 'other', pinned: false });
    const pinned = await routeRepo.create({
      name: 'Zur Arbeit',
      mode: 'bike',
      from: end,
      to: { ...end, label: 'B' },
      via: [],
      pinned: true,
    });
    view();
    const tiles = await screen.findAllByRole('button');
    expect(tiles.map((b) => b.textContent)).toEqual(['Zur Arbeit', 'Alt']);
    await userEvent.click(tiles[0]!);
    expect(screen.getByTestId('where')).toHaveTextContent(`/maps?open=${pinned.id}`);
  });
});
