// @vitest-environment jsdom
/**
 * Budgets over their frame in „Finanzen checken“ (planner hub 2, package 2, COPY P14): a read-only count and a fixed
 * route; the lines are this module's own compact panel – at most five, then X19 – with the amount through
 * `SensitiveValue`; any id other than `over` draws nothing.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BudgetPlanPanel from '../components/PlanPanel';
import source, { OVER_PANEL, OVER_ROUTE } from '../pile';

const over = vi.hoisted(() => ({
  list: Array.from({ length: 7 }, (_, i) => ({
    id: `b${i}`,
    name: `Kategorie ${i}`,
    overMinor: 4000,
    currency: 'EUR',
  })),
}));
vi.mock('../over', () => ({ overBudgets: async () => over.list }));

describe('the budgets part', () => {
  it('a read-only count, its own panel id and a fixed route – no name, no amount', async () => {
    const [part] = await source({ today: '2026-11-30', until: '2026-12-13' });
    expect(part).toMatchObject({ area: 'money', count: 7, readOnly: true, panel: OVER_PANEL });
    expect(part?.to).toBe(OVER_ROUTE);
    expect(part?.members).toBeUndefined();
    expect(JSON.stringify(part)).not.toMatch(/Kategorie|40/);
  });

  it('five lines „{Name} · {Betrag} über dem Rahmen“, then X19 shows more; the amount is a sensitive value', async () => {
    render(<BudgetPlanPanel id={OVER_PANEL} compact />);
    expect(await screen.findAllByRole('listitem')).toHaveLength(5);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(
      /^Kategorie 0 · \S+ über dem Rahmen$/,
    );
    expect(screen.getAllByTestId('sensitive-value').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '2 weitere' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });

  it('another id draws nothing', async () => {
    const { container } = render(<BudgetPlanPanel id="b1" compact />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe('');
  });
});
