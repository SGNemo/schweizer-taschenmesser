// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarItem } from '@/core/modules/types';
import { MonthView } from '../components/Views';

/** A wide window (every width condition holds); `coarse` says whether its primary pointer is a finger. */
function windowWith(coarse: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: !query
      .split(/\s+and\s+/)
      .some((part) => part.includes(coarse ? 'pointer: fine' : 'pointer: coarse')),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const items = [
  {
    source: 'calendar',
    id: 'e1',
    kind: 'event',
    title: 'Zahnarzt',
    date: '2026-11-16',
    time: '09:00',
  },
] as unknown as CalendarItem[];
const draw = () =>
  render(<MonthView date="2026-11-16" items={items} onPickDay={() => {}} onOpenItem={() => {}} />);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('calendar month view: lines or marks (H14)', () => {
  it('names entries as lines in a wide window with a mouse', () => {
    windowWith(false);
    draw();
    expect(screen.getByRole('button', { name: /Zahnarzt/ })).toBeTruthy();
  });

  it('shows the phone marks on a touch screen (coarse pointer), whatever its width', () => {
    windowWith(true);
    draw();
    expect(screen.queryByRole('button', { name: /Zahnarzt/ })).toBeNull();
  });
});
