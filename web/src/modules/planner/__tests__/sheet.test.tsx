// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardDay, BoardRow } from '../board';
import { DayPage } from '../components/DayPage';

const row = (key: string): BoardRow =>
  ({ unitId: `${key}#0`, itemKey: key, title: key, minutes: 30, k: 0, of: 1 }) as BoardRow;

const DAY: BoardDay = {
  date: '2026-11-16',
  isToday: false,
  availableMin: 240,
  raw: 240,
  usable: 192,
  planned: 60,
  free: 132,
  over: 0,
  off: false,
  defaultMin: 240,
  blockers: [],
  rows: [row('a'), row('b')],
};

const draw = (onSwipe?: (dir: 1 | -1) => void, day: BoardDay = DAY) => {
  render(
    <DayPage
      day={day}
      tomorrow
      renderRow={(r) => <li key={r.unitId}>{r.title}</li>}
      onEditDay={() => undefined}
      thenOpen
      onThenToggle={() => undefined}
      empty={<p>leer</p>}
      onSetup={() => undefined}
      onSwipe={onSwipe}
    />,
  );
  return screen.getByTestId('day-2026-11-16');
};

const swipe = (from: Element, to: Element, x0: number, x1: number, y0 = 100, y1 = 100) => {
  fireEvent.touchStart(from, { touches: [{ clientX: x0, clientY: y0 }] });
  fireEvent.touchEnd(to, { changedTouches: [{ clientX: x1, clientY: y1 }] });
};

describe('day sheet: the phone’s swipe changes the day', () => {
  it('a sideways swipe of 60 px or more on the sheet picks the next or the previous day', () => {
    const onSwipe = vi.fn();
    const sheet = draw(onSwipe);
    const title = screen.getByRole('heading', { level: 2 });
    swipe(title, sheet, 200, 120); // to the left: the next day
    expect(onSwipe).toHaveBeenLastCalledWith(1);
    swipe(title, sheet, 120, 200); // to the right: the day before
    expect(onSwipe).toHaveBeenLastCalledWith(-1);
    expect(onSwipe).toHaveBeenCalledTimes(2);
  });

  it('a short swipe, a mostly vertical one and one that starts on a row or a control do nothing', () => {
    const onSwipe = vi.fn();
    const sheet = draw(onSwipe);
    const title = screen.getByRole('heading', { level: 2 });
    swipe(title, sheet, 200, 150); // 50 px
    swipe(title, sheet, 200, 120, 100, 180); // scrolling down while drifting
    swipe(screen.getByText('a'), sheet, 200, 100); // a row swipes by itself (done / later)
    swipe(screen.getByRole('button', { name: /Zeit für Montag ändern/ }), sheet, 200, 100);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('without `onSwipe` (desktop) the sheet does not listen; „n weitere“ is a plain button', () => {
    const many = { ...DAY, rows: Array.from({ length: 12 }, (_, i) => row(`r${i}`)) };
    const sheet = draw(undefined, many);
    swipe(screen.getByRole('heading', { level: 2 }), sheet, 200, 50);
    const more = screen.getByRole('button', { name: '4 weitere' });
    expect(more).not.toHaveAttribute('aria-expanded');
    expect(more).not.toHaveAttribute('aria-controls');
    // „Rest verteilen“ is offered where it has something to act on (today): not here.
    expect(screen.queryByRole('button', { name: 'Rest verteilen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tage einteilen' })).toBeInTheDocument();
  });
});
