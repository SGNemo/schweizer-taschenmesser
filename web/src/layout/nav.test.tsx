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
  useUiStore.setState({ closedAreas: [], openAreas: [], sidebar: 'wide' });
});

describe('sidebar', () => {
  it('shows the favourites as a bar of icon chips, then the areas with their modules; the pin marks favourites', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Sidebar tree={tree} rail={false} canExpand />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: t.nav.main });
    expect(within(nav).getByRole('heading', { name: t.nav.favourites })).toBeVisible();
    // A favourite is an icon chip (name and tooltip only) and a row in its area; the pin sits on the row.
    const chip = within(nav).getAllByRole('link', { name: 'ToDos' })[0]!;
    expect(chip).toHaveAttribute('title', 'ToDos');
    expect(chip).toHaveTextContent('');
    const pins = within(nav).getAllByRole('button', { name: t.nav.removeFavourite('ToDos') });
    expect(pins).toHaveLength(1);
    expect(pins[0]).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(nav).getByRole('button', { name: t.nav.addFavourite('Kalender') }),
    ).toHaveAttribute('aria-pressed', 'false');
    // No stars any more.
    expect(nav.querySelector('[data-icon="star"], svg.star')).toBeNull();
    expect(within(nav).getAllByRole('link', { name: 'Kalender' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('the navigation list scrolls in an overlay area, the footer stays below it', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Sidebar tree={tree} rail={false} canExpand />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: t.nav.main });
    expect(within(nav).getByTestId('overlay-scroll')).toBeVisible();
    // Bibliothek, Einstellungen and Einklappen are outside the scrolled area.
    expect(within(nav).queryByRole('link', { name: t.nav.settings })).toBeNull();
    expect(screen.getByRole('link', { name: t.nav.settings })).toBeVisible();
    expect(screen.getByRole('button', { name: t.nav.collapseSidebar })).toBeVisible();
  });

  it('folds an area and remembers it', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/finance']}>
        <Sidebar tree={tree} rail={false} canExpand />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: t.nav.toggleArea('Geld') }));
    expect(screen.queryByRole('link', { name: 'Finanzen' })).toBeNull();
    expect(useUiStore.getState().closedAreas).toEqual(['money']);
  });

  it('F06: only the area of the open page is unfolded by default; a hand-opened area stays open', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Sidebar tree={tree} rail={false} canExpand />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link', { name: 'Kalender' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Finanzen' })).toBeNull();
    const geld = screen.getByRole('button', { name: t.nav.toggleArea('Geld') });
    expect(geld).toHaveAttribute('aria-expanded', 'false');
    await user.click(geld);
    expect(screen.getByRole('link', { name: 'Finanzen' })).toBeVisible();
    expect(useUiStore.getState().openAreas).toEqual(['money']);
    expect(JSON.parse(localStorage.getItem('tm-nav-open')!)).toEqual(['money']);
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
    // Collapsed: icons only. The name is the accessible name, and the tooltip is drawn from it in CSS (also on keyboard
    // focus), so there is no `title` that would show a second, native tooltip; no visible label takes width.
    for (const name of ['Planen', 'Geld', t.nav.home, t.nav.library, t.nav.settings]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('aria-label', name);
      expect(link).not.toHaveAttribute('title');
      expect(link).toHaveTextContent('');
    }
    // The brand is the app icon tile, a square that scales with the root font size.
    const tile = screen.getByRole('link', { name: t.nav.homeAria }).querySelector('svg')!;
    expect(tile).toHaveAttribute('viewBox', '0 0 512 512');
    expect(tile).toHaveAttribute('width', '2.5rem');
    expect(tile).toHaveAttribute('height', '2.5rem');
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
