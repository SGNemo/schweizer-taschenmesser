// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { useUiStore } from '@/stores/ui';
import { setHideValues } from '@/core/focus/hideValues';
import { DeadlinesCard, PricesCard, UnusedCard } from '../components/ActionCards';
import { planDeadline } from '../planDeadline';
import { subscriptionRepo } from '../repo';
import { subscriptionSchema } from '../schema';

const DAY = '2026-11-15';
let n = 0;
const sub = (over: Record<string, unknown> = {}) => ({
  id: `s${++n}`,
  ...subscriptionSchema.parse({
    name: 'Zeitung',
    amountMinor: 1200,
    startDate: '2026-01-25',
    recurrence: { freq: 'monthly' },
    ...over,
  }),
});

beforeEach(async () => {
  await setHideValues(false);
  await db.table('subscriptions_subscription').clear();
});

describe('notice periods card', () => {
  it('offers „In den Plan“ per deadline while the planner is on; a planned one shows the plan mark', async () => {
    const onPlan = vi.fn();
    const a = sub({ name: 'Zeitung', cancelNoticeDays: 7 });
    const b = sub({
      name: 'Musik',
      startDate: '2026-01-30',
      cancelNoticeDays: 7,
      plannedDeadline: '2026-11-23',
    });
    render(
      <MemoryRouter>
        <DeadlinesCard
          subs={[a, b]}
          day={DAY}
          onOpen={() => {}}
          onPlan={onPlan}
          marks={new Map([[b.id, { kind: 'noDay', rowKey: `subscriptions:${b.id}` } as const]])}
        />
      </MemoryRouter>,
    );
    const card = screen.getByTestId('subscriptions-deadlines');
    // 18 Nov is three days away: marked like in the list, never red.
    expect(
      within(card)
        .getByText(/Kündigen bis 18\. Nov\./)
        .closest('[data-tone]'),
    ).toHaveProperty('dataset.tone', 'soon');
    await waitFor(() => expect(card.textContent).toMatch(/sonst 12,00\s€ am 25\. Nov\./));
    fireEvent.click(within(card).getByRole('button', { name: 'Zeitung kündigen: in den Plan' }));
    expect(onPlan).toHaveBeenCalledWith(a, '2026-11-18');
    expect(within(card).getAllByRole('button', { name: /in den Plan/ })).toHaveLength(1);
    const mark = within(card).getByRole('link', { name: /^Im Plan · noch ohne Tag/ });
    expect(mark).toHaveAttribute('href', `/planner?item=subscriptions%3A${b.id}`);
  });

  it('shows the next 30 days and folds later deadlines (up to 90) behind one line', () => {
    const near = sub({ name: 'Zeitung', cancelNoticeDays: 7 });
    const later = sub({
      name: 'Versicherung',
      startDate: '2025-02-20',
      recurrence: { freq: 'yearly' },
      cancelNoticeDays: 30,
    });
    render(<DeadlinesCard subs={[near, later]} day={DAY} onOpen={() => {}} />);
    const card = screen.getByTestId('subscriptions-deadlines');
    const folded = within(card).getByText('Eine weitere Frist bis 90 Tage').closest('details')!;
    expect(folded.open).toBe(false);
    expect(within(folded).getByText('Versicherung')).toBeTruthy();
    expect(folded.textContent).not.toContain('Zeitung');
  });

  it('has no plan button while the planner is off and is absent without any notice period', () => {
    const { unmount } = render(
      <DeadlinesCard subs={[sub({ cancelNoticeDays: 7 })]} day={DAY} onOpen={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /in den Plan/ })).toBeNull();
    unmount();
    render(<DeadlinesCard subs={[sub()]} day={DAY} onOpen={() => {}} />);
    expect(screen.queryByTestId('subscriptions-deadlines')).toBeNull();
  });

  it('„In den Plan“ marks the deadline (undoable); the planner source lists it from then on', async () => {
    const s = await subscriptionRepo.create(
      subscriptionSchema.parse({
        name: 'Zeitung',
        amountMinor: 1200,
        startDate: '2026-01-25',
        recurrence: { freq: 'monthly' },
        cancelNoticeDays: 7,
      }),
    );
    await planDeadline(s, '2026-11-18');
    expect((await subscriptionRepo.get(s.id))?.plannedDeadline).toBe('2026-11-18');
    await useUiStore.getState().toasts.at(-1)?.action?.run();
    await waitFor(async () =>
      expect((await subscriptionRepo.get(s.id))?.plannedDeadline).toBeUndefined(),
    );
  });
});

describe('price changes and hardly used', () => {
  it('shows before → after with what it means per year', async () => {
    const s = sub({
      name: 'Video',
      amountMinor: 1499,
      priceHistory: [{ date: '2026-10-01', fromMinor: 1299, toMinor: 1499 }],
    });
    render(<PricesCard subs={[s, sub()]} day={DAY} onOpen={() => {}} />);
    const card = screen.getByTestId('subscriptions-prices');
    await waitFor(() => expect(card.textContent).toMatch(/12,99\s€ → 14,99\s€ \(\+15 %\)/));
    expect(card.textContent).toMatch(/24,00\s€ mehr im Jahr/);
    expect(card.textContent).not.toContain('Zeitung');
  });

  it('is absent without a price change', () => {
    render(<PricesCard subs={[sub()]} day={DAY} onOpen={() => {}} />);
    expect(screen.queryByTestId('subscriptions-prices')).toBeNull();
  });

  it('lists hardly used ones with their yearly cost and opens them', async () => {
    const onOpen = vi.fn();
    const s = sub({ name: 'Box', amountMinor: 500, unusedSince: '2026-11-01' });
    const t2 = sub({ name: 'Kurs', amountMinor: 1000, unusedSince: '2026-10-01' });
    render(<UnusedCard subs={[s, t2, sub()]} day={DAY} onOpen={onOpen} />);
    const card = screen.getByTestId('subscriptions-unused');
    await waitFor(() => expect(card.textContent).toMatch(/2 Abos, zusammen 180,00\s€ im Jahr/));
    expect(card.textContent).not.toContain('Zeitung');
    fireEvent.click(within(card).getByRole('button', { name: /Box/ }));
    expect(onOpen).toHaveBeenCalledWith(s);
  });

  it('masks amounts with „Werte ausblenden“', async () => {
    await setHideValues(true);
    const s = sub({ name: 'Box', amountMinor: 500, unusedSince: '2026-11-01' });
    render(<UnusedCard subs={[s]} day={DAY} onOpen={() => {}} />);
    const card = screen.getByTestId('subscriptions-unused');
    await waitFor(() => expect(within(card).getByText('Box')).toBeTruthy());
    expect(card.textContent).not.toMatch(/60,00/);
  });
});
