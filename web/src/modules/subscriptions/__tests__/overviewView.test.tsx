// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setHideValues } from '@/core/focus/hideValues';
import { OverviewView, RANKING_BARS } from '../components/OverviewView';
import { subscriptionSchema } from '../schema';

const DAY = '2026-11-15';
let n = 0;
const sub = (over: Record<string, unknown> = {}) => ({
  id: `s${++n}`,
  ...subscriptionSchema.parse({
    name: 'Streaming',
    amountMinor: 1200,
    startDate: '2026-01-20',
    recurrence: { freq: 'monthly' },
    ...over,
  }),
});

describe('subscriptions overview', () => {
  beforeEach(() => setHideValues(false));

  const subs = [
    sub({ name: 'Video', category: 'streaming', amountMinor: 1200 }),
    sub({ name: 'Film', category: 'streaming', amountMinor: 600, startDate: '2026-01-15' }),
    sub({ name: 'Musik', category: 'music', amountMinor: 1000 }),
    sub({ name: 'Alt', amountMinor: 999, active: false }),
    sub({ name: 'Dollar', amountMinor: 500, currency: 'USD' }),
  ];

  it('splits the month by kind and by subscription, names other currencies, never mixes them', async () => {
    render(<OverviewView subs={subs} day={DAY} onOpen={() => {}} />);
    const donut = screen.getByRole('figure', { name: 'Kosten pro Monat nach Art' });
    const table = within(donut).getByRole('table', { hidden: true });
    expect(within(table).getByText('Streaming')).toBeTruthy();
    expect(within(table).getByText('Musik')).toBeTruthy();
    expect(await within(table).findByText(/18,00/)).toBeTruthy();
    screen.getByText('1 Abo in einer anderen Währung ist nicht mitgerechnet.');

    fireEvent.click(screen.getByRole('button', { name: 'Abo' }));
    const byProvider = screen.getByRole('figure', { name: 'Kosten pro Monat nach Abo' });
    const rows = within(byProvider).getByRole('table', { hidden: true });
    expect(within(rows).getByText('Video')).toBeTruthy();
    expect(within(rows).getByText('Film')).toBeTruthy();
    expect(within(rows).queryByText('Alt')).toBeNull();
    expect(within(rows).queryByText('Dollar')).toBeNull();
  });

  it('lists the next 30 days with their sum per currency and opens a subscription from a row', async () => {
    const onOpen = vi.fn();
    render(<OverviewView subs={subs} day={DAY} onOpen={onOpen} />);
    const card = screen.getByTestId('subscriptions-upcoming');
    // Film today (15th), Video and Musik on the 20th, Dollar too; the paused one never.
    expect(within(card).getByText('Heute')).toBeTruthy();
    expect(within(card).queryByText('Alt')).toBeNull();
    await waitFor(() =>
      expect(within(card).getByTestId('upcoming-sum').textContent).toMatch(/28,00\s€.*5,00\s\$/),
    );
    fireEvent.click(within(card).getByRole('button', { name: /Film/ }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: 'Film' }));
  });

  it('masks every amount of the timeline with „Werte ausblenden“, names and dates stay', async () => {
    await setHideValues(true);
    render(<OverviewView subs={subs} day={DAY} onOpen={() => {}} />);
    const card = screen.getByTestId('subscriptions-upcoming');
    await waitFor(() => expect(within(card).getByText('Film')).toBeTruthy());
    expect(card.textContent).not.toMatch(/\d,\d\d/);
  });

  it('ranks the year and folds the rest into one sentence', async () => {
    const many = Array.from({ length: RANKING_BARS + 2 }, (_, i) =>
      sub({ name: `Abo ${i + 1}`, amountMinor: 100 * (i + 1) }),
    );
    render(<OverviewView subs={many} day={DAY} onOpen={() => {}} />);
    const bars = screen.getByRole('figure', { name: 'Was kostet mich das im Jahr' });
    expect(within(bars).getAllByRole('row', { hidden: true })).toHaveLength(RANKING_BARS + 1);
    // The two cheapest: 1,00 € and 2,00 € a month = 36,00 € a year.
    await screen.findByText(/Dazu 2 weitere Abos: zusammen 36,00\s€/);
  });

  it('hides the sum of the folded rest with „Werte ausblenden“', async () => {
    await setHideValues(true);
    const many = Array.from({ length: RANKING_BARS + 2 }, (_, i) =>
      sub({ name: `Abo ${i + 1}`, amountMinor: 100 * (i + 1) }),
    );
    render(<OverviewView subs={many} day={DAY} onOpen={() => {}} />);
    await screen.findByText('Dazu 2 weitere Abos: zusammen ••••');
  });

  it('says so when nothing runs', () => {
    render(<OverviewView subs={[sub({ active: false })]} day={DAY} onOpen={() => {}} />);
    expect(screen.getAllByText('Gerade läuft kein Abo.').length).toBeGreaterThan(0);
    screen.getByText('In den nächsten 30 Tagen wird nichts abgebucht.');
  });
});
