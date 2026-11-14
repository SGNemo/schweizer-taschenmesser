// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryBars, niceTicks, TrendColumns } from '../components/Charts';
import type { CategoryTotal, MonthPoint } from '../logic';

const rows: CategoryTotal[] = [
  { categoryId: 'home', name: 'Wohnen', amountMinor: 91_500 },
  { categoryId: 'food', name: 'Lebensmittel', amountMinor: 10_530 },
  { name: 'Eine sehr lange Kategorie', amountMinor: 2_398 },
];
const points: MonthPoint[] = [
  { month: '2026-08', label: 'Aug.', income: 286_312, expense: 161_876, net: 124_436 },
  { month: '2026-09', label: 'Sep.', income: 0, expense: 22_000, net: -22_000 },
];
const plain = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');

describe('finance bar charts without a chart library (perf: FINANCE-MAIL-2026-11)', () => {
  it('axis steps are nice numbers from zero, like the former chart', () => {
    expect(niceTicks(299_400)).toEqual([0, 75_000, 150_000, 225_000, 300_000]);
    expect(niceTicks(286_312)).toEqual([0, 75_000, 150_000, 225_000, 300_000]);
    expect(niceTicks(1_000)).toEqual([0, 250, 500, 750, 1_000]);
    expect(niceTicks(0)).toEqual([0, 1, 2, 3, 4]);
  });

  it('category bars: one bar per row, sized against the largest, amount at the tip, long names cut', () => {
    render(<CategoryBars rows={rows} />);
    const chart = screen.getByTestId('chart-categories');
    const items = chart.querySelectorAll('li');
    expect(items).toHaveLength(3);
    const widths = [
      ...chart.querySelectorAll<HTMLElement>('li > span:last-child > span:first-child'),
    ].map((b) => b.style.width);
    expect(widths[0]).toBe('100%');
    expect(parseFloat(widths[1]!)).toBeCloseTo(11.508, 2);
    expect(plain(items[0]!.textContent)).toContain('915,00 €');
    expect(items[2]!.textContent).toContain('Eine sehr lange…');
  });

  it('the arrow keys pick a category and the tooltip names it in full; Escape and leaving close it', () => {
    render(<CategoryBars rows={rows} />);
    const chart = screen.getByTestId('chart-categories');
    expect(chart.tabIndex).toBe(0);
    fireEvent.keyDown(chart, { key: 'ArrowDown' });
    expect(plain(screen.getByTestId('chart-tooltip').textContent)).toContain('Wohnen915,00 €');
    fireEvent.keyDown(chart, { key: 'ArrowDown' });
    fireEvent.keyDown(chart, { key: 'ArrowDown' });
    fireEvent.keyDown(chart, { key: 'ArrowDown' });
    expect(screen.getByTestId('chart-tooltip').textContent).toContain('Eine sehr lange Kategorie');
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(screen.queryByTestId('chart-tooltip')).toBeNull();
    fireEvent.keyDown(chart, { key: 'ArrowUp' });
    expect(screen.getByTestId('chart-tooltip')).toBeTruthy();
    fireEvent.blur(chart);
    expect(screen.queryByTestId('chart-tooltip')).toBeNull();
  });

  it('trend columns: legend, axis steps, two columns per month and both values in the tooltip', () => {
    render(<TrendColumns points={points} />);
    const chart = screen.getByTestId('chart-trend');
    expect(plain(chart.querySelector('ul')?.textContent)).toBe('EinnahmenAusgaben');
    expect(plain(chart.textContent)).toContain('3.000');
    const plot = chart.querySelector<HTMLElement>('[tabindex="0"]')!;
    fireEvent.keyDown(plot, { key: 'ArrowRight' });
    const tip = plain(screen.getByTestId('chart-tooltip').textContent);
    expect(tip).toContain('Aug.');
    expect(tip).toContain('2.863,12 €Einnahmen');
    expect(tip).toContain('1.618,76 €Ausgaben');
  });
});
