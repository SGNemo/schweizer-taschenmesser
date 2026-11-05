// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { InvoiceEditor } from '../components/InvoiceEditor';
import { invoiceRepo } from '../repo';

beforeEach(async () => {
  await db.table('invoices_invoice').clear();
});
afterEach(cleanup);

// QA round 4, X34: a payee of only spaces passed the browser's `required`, then the schema threw
// and "Speichern" did nothing, without a word.
it('a payee of only spaces says "Bitte ausfüllen" and saves nothing', async () => {
  render(
    <MemoryRouter>
      <InvoiceEditor target={{ draft: true }} onClose={() => {}} />
    </MemoryRouter>,
  );
  await userEvent.type(screen.getByLabelText('Empfänger'), '   ');
  await userEvent.type(screen.getByLabelText('Betrag'), '49,90');
  await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Bitte ausfüllen');
  expect(await invoiceRepo.active().count()).toBe(0);
});
