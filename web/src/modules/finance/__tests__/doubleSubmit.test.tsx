// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { AccountEditor } from '../components/Editors';
import { accountRepo } from '../repo';

beforeEach(async () => {
  await db.table('finance_account').clear();
});
afterEach(cleanup);

// QA round 4, X13: editors with their own <form> submitted twice on a double click.
it('a double click on "Speichern" creates the account once', async () => {
  let open = true;
  render(<AccountEditor target={{ draft: true, order: 0 }} onClose={() => (open = false)} />);
  await userEvent.type(screen.getByLabelText('Kontoname'), 'Bargeld');
  const save = screen.getByRole('button', { name: 'Speichern' });
  fireEvent.click(save);
  fireEvent.click(save);
  await waitFor(() => expect(open).toBe(false));
  await new Promise((r) => setTimeout(r, 100));
  expect((await accountRepo.active().toArray()).map((a) => a.name)).toEqual(['Bargeld']);
});
