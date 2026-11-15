// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setHideValues } from '@/core/focus/hideValues';
import {
  CategoryDonut,
  DayBalanceChart,
  IncomeExpenseChart,
  monthLabel,
  MonthTable,
  NetWorthChart,
} from '../components/MoneyCharts';
import { CurrencyContext } from '../currency';
import type { CategoryTotal, MonthPoint } from '../logic';

const plain = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');
const rows: CategoryTotal[] = [
  { categoryId: 'home', name: 'Wohnen', amountMinor: 91_500 },
  { categoryId: 'bills', name: 'Rechnungen', amountMinor: 39_817 },
  { categoryId: 'fun', name: 'Freizeit', amountMinor: 11_511 },
  { categoryId: 'food', name: 'Lebensmittel', amountMinor: 10_530 },
  { categoryId: 'go', name: 'Mobilität', amountMinor: 6_120 },
  { categoryId: 'subs', name: 'Abos', amountMinor: 2_398 },
  { categoryId: 'health', name: 'Gesundheit', amountMinor: 1_500 },
  { categoryId: 'misc', name: 'Haushalt', amountMinor: 900 },
];
const months: MonthPoint[] = [
  { month: '2026-08', label: 'Aug.', income: 285_000, expense: 115_514, net: 169_486 },
  { month: '2026-09', label: 'Sep.', income: 286_312, expense: 161_876, net: 124_436 },
  { month: '2026-10', label: 'Okt.', income: 0, expense: 0, net: 0 },
];

describe('finance charts on the shared blocks (polish p2)', () => {
  beforeEach(async () => {
    await db.table('_meta').clear();
  });

  it('categories: one donut, every category named with its amount, the small ones folded once', async () => {
    render(<CategoryDonut rows={rows} title="Wohin das Geld ging" />);
    const chart = await screen.findByTestId('chart-categories');
    const legendText = () => plain(chart.querySelector('ol')?.textContent);
    await waitFor(() => expect(legendText()).toMatch(/Wohnen915,00 €/));
    const legend = legendText();
    // Six named slices and one rest of the two smallest (2 400 = 15,00 + 9,00 €).
    expect(chart.querySelectorAll('ol li')).toHaveLength(7);
    expect(legend).toContain('Sonstiges24,00 €');
    expect(legend).not.toContain('Haushalt');
  });

  it('categories: an empty month says so in words', async () => {
    render(<CategoryDonut rows={[]} title="Wohin das Geld ging" />);
    expect((await screen.findByTestId('chart-categories')).textContent).toContain(
      'Keine Ausgaben in diesem Monat.',
    );
  });

  it('income and expenses: two series, months after `upTo` have no value (no drop to zero)', async () => {
    render(<IncomeExpenseChart points={months} title="Monate" upTo="2026-09" />);
    const chart = await screen.findByTestId('chart-trend');
    const lastRow = [...chart.querySelectorAll('tbody tr')].at(-1)!;
    await waitFor(() => expect(plain(lastRow.textContent)).toBe('Okt.––'));
    expect(plain(chart.querySelector('thead')?.textContent)).toContain('EinnahmenAusgaben');
  });

  it('balance by day: a line with one value per day', async () => {
    render(
      <DayBalanceChart
        points={[
          { date: '2026-09-01', balanceMinor: 1_137_197 },
          { date: '2026-09-02', balanceMinor: 1_423_509 },
        ]}
        title="Verlauf im Monat"
        testId="month-curve"
      />,
    );
    const chart = await screen.findByTestId('month-curve');
    await waitFor(() => expect(plain(chart.textContent)).toContain('14.235,09 €'));
    expect(chart.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('net worth: the change since the first month as a sentence, masked with "Werte ausblenden"', async () => {
    const points = [
      { month: '2026-02', valueMinor: 107_024 },
      { month: '2026-09', valueMinor: 1_261_633 },
    ];
    const { unmount } = render(<NetWorthChart points={points} title="Vermögen am Monatsende" />);
    await waitFor(() =>
      expect(plain(screen.getByTestId('net-worth-chart-change').textContent)).toBe(
        '+11.546,09 € seit Februar 2026',
      ),
    );
    unmount();
    await setHideValues(true);
    render(<NetWorthChart points={points} title="Vermögen am Monatsende" />);
    const chart = await screen.findByTestId('net-worth-chart');
    await waitFor(() => expect(plain(chart.textContent)).not.toMatch(/\d,\d\d/));
    expect(plain(screen.getByTestId('net-worth-chart-change').textContent)).not.toMatch(/\d,\d\d/);
  });

  it('month labels name the year only where it starts or turns ("Feb. 26" read as a day)', () => {
    expect(['2025-11', '2025-12', '2026-01', '2026-02'].map(monthLabel)).toEqual([
      'Nov. 2025',
      'Dez.',
      'Jan. 2026',
      'Feb.',
    ]);
  });

  it('the month table follows "Werte ausblenden" like its chart', async () => {
    await setHideValues(true);
    render(<MonthTable points={months} />);
    const table = await screen.findByTestId('table-trend');
    await waitFor(() => expect(plain(table.textContent)).not.toMatch(/\d,\d\d/));
    expect(plain(table.textContent)).toContain('Aug.');
    // Text, not a reveal button per cell: nine masked amounts, no extra tab stops.
    expect(table.querySelectorAll('.sr-only')).toHaveLength(9);
    expect(table.querySelectorAll('button')).toHaveLength(0);
  });

  it('a masked cell hides sign and currency too, in any currency', async () => {
    await setHideValues(true);
    render(
      <CurrencyContext.Provider value="SEK">
        <MonthTable
          points={[{ month: '2026-09', label: 'Sep.', income: 0, expense: 50_000, net: -50_000 }]}
        />
      </CurrencyContext.Provider>,
    );
    const table = await screen.findByTestId('table-trend');
    await waitFor(() => expect(table.querySelectorAll('.sr-only')).toHaveLength(3));
    const body = plain(table.querySelector('tbody')?.textContent);
    expect(body).not.toMatch(/\d|SEK|−/);
  });
});
