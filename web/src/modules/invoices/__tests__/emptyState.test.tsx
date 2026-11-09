// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setNow } from '@/core/time/now';
import InvoicesPage from '../routes/InvoicesPage';

beforeEach(async () => {
  bus.clear();
  await db.table('invoices_invoice').clear();
  setNow(() => new Date(2026, 10, 5, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
});

// UI round 6, U26: an empty page says one sentence and offers one step; the head button steps back meanwhile.
it('the empty page holds the one filled step "Rechnung hinzufügen"', async () => {
  render(
    <MemoryRouter initialEntries={['/invoices']}>
      <InvoicesPage />
    </MemoryRouter>,
  );
  const empty = await screen.findByTestId('invoices-empty');
  expect(empty).toHaveTextContent('Keine offenen Rechnungen.');
  const step = within(empty).getByRole('button', { name: 'Rechnung hinzufügen' });
  expect(step.className).toMatch(/primary/);
  const filled = screen.getAllByRole('button').filter((b) => /primary/.test(b.className));
  expect(filled).toEqual([step]);
  await userEvent.click(step);
  expect(await screen.findByRole('dialog')).toBeVisible();
});
