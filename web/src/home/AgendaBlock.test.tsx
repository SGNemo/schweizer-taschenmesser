// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ContributionsModule from '@/core/modules/contributions';
import type { CalendarItem } from '@/core/modules/types';
import { setNow } from '@/core/time/now';

const calendar = vi.hoisted(() => ({ value: undefined as unknown[] | undefined }));
vi.mock('@/core/modules/contributions', async (original) => ({
  ...(await original<typeof ContributionsModule>()),
  useCalendarItems: () => calendar.value,
}));

import { AgendaBlock } from './AgendaBlock';

const item = (
  over: Partial<CalendarItem> & Pick<CalendarItem, 'id' | 'title' | 'date'>,
): CalendarItem => ({
  source: 'calendar',
  kind: 'event',
  allDay: false,
  ...over,
});
const draw = () =>
  render(
    <MemoryRouter>
      <AgendaBlock />
    </MemoryRouter>,
  );

describe('AgendaBlock (day cards on a time rail)', () => {
  beforeEach(() => setNow(() => new Date(2026, 8, 29, 9, 0).getTime()));
  afterEach(() => {
    cleanup();
    setNow();
  });

  it('renders nothing before the data is there', () => {
    calendar.value = undefined;
    expect(draw().container.firstChild).toBeNull();
  });

  it('shows one card per day that has entries, each with its date', () => {
    calendar.value = [
      item({ id: '1', title: 'Zahnarzt', date: '2026-09-29', time: '14:00' }),
      item({ id: '2', title: 'Elternabend', date: '2026-09-30', time: '19:30' }),
      item({ id: '3', title: 'Chor', date: '2026-10-02', time: '18:00' }),
    ];
    draw();
    const today = screen.getByTestId('agenda-today');
    expect(within(today).getByRole('heading', { level: 3 }).textContent).toContain('Heute');
    expect(today.textContent).toContain('29. Sep');
    expect(within(today).getByRole('link', { name: /14:00.*Zahnarzt/ })).toBeTruthy();
    expect(within(screen.getByTestId('agenda-tomorrow')).getByText('Elternabend')).toBeTruthy();
    const week = screen.getByTestId('agenda-week');
    expect(within(week).getByRole('link', { name: /Fr.*18:00.*Chor/ })).toBeTruthy();
  });

  it('leaves out days without entries and says nothing about them', () => {
    calendar.value = [item({ id: '2', title: 'Elternabend', date: '2026-09-30', time: '19:30' })];
    draw();
    expect(screen.queryByTestId('agenda-today')).toBeNull();
    expect(screen.queryByTestId('agenda-week')).toBeNull();
    expect(screen.getByTestId('agenda-tomorrow')).toBeTruthy();
  });

  it('colours the dot by the module that contributed the entry, as decoration only', () => {
    calendar.value = [
      item({ id: '1', title: 'Zahnarzt', date: '2026-09-29', time: '14:00' }),
      item({
        id: '4',
        title: 'Läuft ab: Joghurt',
        date: '2026-09-29',
        allDay: true,
        source: 'pantry',
        kind: 'expiry',
      }),
    ];
    const { container } = draw();
    const hues = [...container.querySelectorAll('li')].map((li) => li.getAttribute('data-hue'));
    expect(hues).toEqual(['sky', 'fern']);
    for (const dot of container.querySelectorAll('li > a > span[aria-hidden="true"]'))
      expect(dot.textContent).toBe('');
  });

  it('takes the colour of an outside calendar for its dot', () => {
    calendar.value = [
      item({ id: '5', title: 'Extern', date: '2026-09-29', time: '10:00', color: '#336699' }),
    ];
    const { container } = draw();
    const dot = container.querySelector<HTMLElement>('li > a > span[aria-hidden="true"]')!;
    expect(dot.style.getPropertyValue('--dot')).toBe('#336699');
  });

  it('says so in one line when the week is empty and names the next step', () => {
    calendar.value = [];
    draw();
    expect(screen.getByText(/steht nichts an/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Termin anlegen' }).getAttribute('href')).toBe(
      '/calendar?new=1',
    );
  });
});
