// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CalendarItem } from '@/core/modules/types';
import { MonthView } from '../components/Views';

/** A wide window (every width condition holds) with a primary pointer and maybe a touch screen besides it. */
function windowWith(primary: 'fine' | 'coarse', anyCoarse: boolean) {
  const holds = (part: string) => {
    if (part.includes('not (any-pointer: coarse)')) return !anyCoarse;
    if (part.includes('any-pointer: coarse')) return anyCoarse;
    if (part.includes('pointer: fine')) return primary === 'fine';
    if (part.includes('pointer: coarse')) return primary === 'coarse';
    return true;
  };
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.split(/\s+and\s+(?![^(]*\))/).every(holds),
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
    windowWith('fine', false);
    draw();
    expect(screen.getByRole('button', { name: /Zahnarzt/ })).toBeTruthy();
  });

  it('shows the phone marks on a touch screen (coarse pointer), whatever its width', () => {
    windowWith('coarse', true);
    draw();
    expect(screen.queryByRole('button', { name: /Zahnarzt/ })).toBeNull();
  });

  it('shows the phone marks on a touch desktop (mouse first, touch screen besides)', () => {
    windowWith('fine', true);
    draw();
    expect(screen.queryByRole('button', { name: /Zahnarzt/ })).toBeNull();
  });
});
