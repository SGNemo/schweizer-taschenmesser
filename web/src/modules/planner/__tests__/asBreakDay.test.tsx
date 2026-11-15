// @vitest-environment jsdom
/**
 * W24 (use case „Wochenende retten“, ANALYSIS §7): „Als Pause …“ on a thing the plan put on another day. The
 * break stays on the row's day unless the person taps „Heute“ in the small sheet; a waiting thing (no day on the
 * board) takes today, named. One tap on the length acts, as before.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PlannableEntry } from '@/core/modules/contributions';
import { setNow } from '@/core/time/now';

const asBreak = vi.fn(async () => true);
vi.mock('../actions', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  asBreak: (...args: unknown[]) => asBreak(...(args as [])),
}));
const { RowChoice } = await import('../components/RowChoice');

const SAT = '2026-11-14';
const MON = '2026-11-16';
const zocken = { moduleId: 'todos', id: 'z', title: 'Zocken' } as PlannableEntry;

beforeEach(() => {
  setNow(() => new Date(2026, 10, 14, 10, 0).getTime());
  asBreak.mockClear();
});
afterEach(() => setNow());

it('a row on Monday: the break is Monday’s unless „Heute“ is tapped; the hint names the chosen day', () => {
  const { unmount } = render(
    <RowChoice
      choice={{ kind: 'break', entry: zocken, date: MON }}
      titles={{}}
      onClose={() => undefined}
    />,
  );
  expect(screen.getByText(/Wird am Mo zur Pause/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Heute' }));
  expect(screen.getByText(/Wird am Sa zur Pause/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '2 h' }));
  expect(asBreak).toHaveBeenLastCalledWith(zocken, SAT, 120, {});
  unmount();

  render(
    <RowChoice
      choice={{ kind: 'break', entry: zocken, date: MON }}
      titles={{}}
      onClose={() => undefined}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '1 h' }));
  expect(asBreak).toHaveBeenLastCalledWith(zocken, MON, 60, {});
});

it('a row of today or a waiting thing (today): no day choice, the break is today’s', () => {
  render(
    <RowChoice
      choice={{ kind: 'break', entry: zocken, date: SAT }}
      titles={{}}
      onClose={() => undefined}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Heute' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '2 h' }));
  expect(asBreak).toHaveBeenLastCalledWith(zocken, SAT, 120, {});
});
