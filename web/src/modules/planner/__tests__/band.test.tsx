// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardDay, BoardRow } from '../board';
import { tileName, WeekBand } from '../components/WeekBand';

const row = (key: string): BoardRow =>
  ({ unitId: `${key}#0`, itemKey: key, title: key, minutes: 30, k: 0, of: 1 }) as BoardRow;

/** Sunday 2026-11-15 (off) and the six days after it; Monday holds things, Wednesday is overbooked. */
const DAYS: BoardDay[] = Array.from({ length: 7 }, (_, i) => {
  const date = `2026-11-${15 + i}`;
  const base = {
    date,
    isToday: i === 0,
    availableMin: i === 0 ? 0 : 240,
    raw: 240,
    usable: i === 0 ? 0 : 192,
    planned: 0,
    free: i === 0 ? 0 : 192,
    over: 0,
    off: i === 0,
    defaultMin: 240,
    blockers: [],
    rows: [] as BoardRow[],
  };
  if (i === 1) return { ...base, planned: 155, free: 37, rows: [row('a'), row('b'), row('a')] };
  if (i === 3) return { ...base, planned: 232, free: 0, over: 40, rows: [row('c')] };
  return base;
});

const draw = (picked: string, onPick = vi.fn()) => {
  render(<WeekBand days={DAYS} picked={picked} onPick={onPick} />);
  return {
    onPick,
    tiles: within(screen.getByRole('group', { name: 'Woche' })).getAllByRole('button'),
  };
};

describe('week band', () => {
  it('names every tile in full: the day in words, its capacity, its things (a thing in parts counts once)', () => {
    const { tiles } = draw('2026-11-16');
    expect(tiles.map((b) => b.querySelector('.sr-only')!.textContent)).toEqual([
      'Heute, Sonntag, 15. November: frei',
      'Morgen, Montag, 16. November: 37 Min frei von 3 h 12 · 2 Dinge',
      'Dienstag, 17. November: 3 h 12 frei von 3 h 12',
      'Mittwoch, 18. November: 40 Min mehr als planbar · 1 Ding',
      'Donnerstag, 19. November: 3 h 12 frei von 3 h 12',
      'Freitag, 20. November: 3 h 12 frei von 3 h 12',
      'Samstag, 21. November: 3 h 12 frei von 3 h 12',
    ]);
    expect(tiles[1]).toHaveAccessibleName(tileName(DAYS[1]!, true));
  });

  it('marks today with aria-current and the picked day with aria-pressed; an overrun is hatched and said in words', () => {
    const { tiles } = draw('2026-11-16');
    expect(tiles[0]).toHaveAttribute('aria-current', 'date');
    expect(tiles.filter((b) => b.hasAttribute('aria-current'))).toHaveLength(1);
    expect(tiles.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
    // Direction A: the day and one fact – the free time or one state word, never a count, never a dash.
    expect(tiles.map((b) => b.querySelector('span[aria-hidden]')!.textContent)).toEqual([
      'So 15frei',
      'Mo 1637 Min',
      'Di 173 h 12',
      'Mi 18+ 40 Min mehr',
      'Do 193 h 12',
      'Fr 203 h 12',
      'Sa 213 h 12',
    ]);
    // The bar lies over the button, not in it (a bar is a `div`): valid HTML, the whole tile still answers.
    expect(tiles.every((b) => b.querySelector('div') === null)).toBe(true);
    const bars = tiles.map((b) => b.parentElement!.querySelector('[role="progressbar"]')!);
    expect(bars[3]!.firstElementChild!.className).toMatch(/progressHatch/);
    expect(bars[1]!.firstElementChild!.className).not.toMatch(/progressHatch|progressOver/);
    expect(bars[3]).toHaveAttribute('aria-valuetext', '40 Min mehr als planbar');
  });

  it('is one tab stop; ←/→/Home/End move the focus without picking, a click picks', () => {
    const { tiles, onPick } = draw('2026-11-16');
    expect(tiles.map((b) => b.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1, -1]);
    tiles[1]!.focus();
    fireEvent.keyDown(tiles[1]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tiles[2]);
    fireEvent.keyDown(tiles[2]!, { key: 'End' });
    expect(document.activeElement).toBe(tiles[6]);
    fireEvent.keyDown(tiles[6]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tiles[6]);
    fireEvent.keyDown(tiles[6]!, { key: 'Home' });
    expect(document.activeElement).toBe(tiles[0]);
    fireEvent.keyDown(tiles[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tiles[0]);
    expect(onPick).not.toHaveBeenCalled();
    // Enter and Space are the button's own click.
    fireEvent.click(tiles[3]!);
    expect(onPick).toHaveBeenCalledWith('2026-11-18');
  });
});
