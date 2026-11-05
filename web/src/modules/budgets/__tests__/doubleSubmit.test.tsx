// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { DepositDialog } from '../components/Editors';
import { depositRepo, goalRepo } from '../repo';

beforeEach(async () => {
  await db.table('budgets_goal').clear();
  await db.table('budgets_deposit').clear();
  setNow(() => new Date(2026, 10, 5, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
});

// QA round 4, X13: the second click of a double click submitted again while the first write was
// still running, so the deposit was booked twice.
it('a double click on "Speichern" books the deposit once', async () => {
  const goal = await goalRepo.create({ name: 'Urlaub', targetMinor: 100000 });
  let open = true;
  render(<DepositDialog goal={goal} onClose={() => (open = false)} />);
  await userEvent.type(screen.getByLabelText('Betrag'), '50');
  const save = screen.getByRole('button', { name: 'Speichern' });
  fireEvent.click(save);
  fireEvent.click(save);
  await waitFor(() => expect(open).toBe(false));
  await new Promise((r) => setTimeout(r, 100));
  expect((await depositRepo.active().toArray()).map((d) => d.amountMinor)).toEqual([5000]);
});
