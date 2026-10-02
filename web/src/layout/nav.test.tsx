// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import type { NavTree } from '@/core/modules/areas';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { AreaFrame } from './AreaFrame';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

const tree: NavTree = {
  favourites: [{ to: '/todos', label: 'ToDos', icon: 'checklist', moduleId: 'todos' }],
  areas: [
    {
      id: 'plan',
      label: 'Planen',
      icon: 'calendar',
      to: '/planen',
      items: [
        { to: '/calendar', label: 'Kalender', icon: 'calendar', moduleId: 'calendar' },
        { to: '/todos', label: 'ToDos', icon: 'checklist', moduleId: 'todos' },
      ],
    },
    {
      id: 'money',
      label: 'Geld',
      icon: 'wallet',
      to: '/geld',
      items: [{ to: '/finance', label: 'Finanzen', icon: 'wallet', moduleId: 'finance' }],
    },
  ],
};

beforeEach(async () => {
  await db.table('_settings').clear();
  useUiStore.setState({ closedAreas: [], sidebar: 'wide' });
});

describe('sidebar', () => {
  it('shows favourites, then the areas with their modules; the star marks favourites', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Sidebar tree={tree} rail={false} canExpand />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: t.nav.main });
    expect(within(nav).getByRole('heading', { name: t.nav.favourites })).toBeVisible();
    // A favourite is listed twice (favourites and its area); both stars say so.
    const stars = within(nav).getAllByRole('button', { name: t.nav.removeFavourite('ToDos') });
    expect(stars).toHaveLength(2);
    for (const star of stars) expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(nav).getByRole('button', { name: t.nav.addFavourite('Kalender') }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(within(nav).getAllByRole('link', { name: 'Kalender' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('folds an area and remembers it', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Sidebar tree={tree} rail={false} canExpand />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: t.nav.toggleArea('Geld') }));
    expect(screen.queryByRole('link', { name: 'Finanzen' })).toBeNull();
    expect(useUiStore.getState().closedAreas).toEqual(['money']);
  });

  it('the rail links the areas by name and can expand', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/finance']}>
        <Sidebar tree={tree} rail canExpand />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Geld' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Planen' })).toHaveAttribute('href', '/planen');
    await user.click(screen.getByRole('button', { name: t.nav.expandSidebar }));
    expect(useUiStore.getState().sidebar).toBe('wide');
  });

  it('a rail forced by the viewport offers no expand button', () => {
    render(
      <MemoryRouter>
        <Sidebar tree={tree} rail canExpand={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: t.nav.expandSidebar })).toBeNull();
  });
});

describe('bottom navigation', () => {
  it('has Heute, the first three areas and Mehr', () => {
    render(
      <MemoryRouter initialEntries={['/finance']}>
        <BottomNav tree={tree} onMore={() => undefined} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: t.nav.main });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([t.nav.home, 'Planen', 'Geld']);
    expect(within(nav).getByRole('button', { name: t.nav.more })).toBeVisible();
    expect(within(nav).getByRole('link', { name: 'Geld' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('area frame', () => {
  it('shows the area name and its modules as tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/invoices']}>
        <AreaFrame>
          <h1>Rechnungen</h1>
        </AreaFrame>
      </MemoryRouter>,
    );
    const tabs = await screen.findByRole('navigation', { name: t.nav.areaTabs('Geld') });
    expect(within(tabs).getAllByRole('link').length).toBeGreaterThan(1);
    expect(within(tabs).getByRole('link', { name: 'Rechnungen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('Geld')).toBeVisible();
  });

  it('leaves pages outside the areas untouched', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AreaFrame>
          <h1>Einstellungen</h1>
        </AreaFrame>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
