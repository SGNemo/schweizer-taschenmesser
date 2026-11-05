// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AccountEditor } from '../components/Editors';

afterEach(cleanup);

// QA round 4, X07: Esc, Back or the close button closed the editor and threw away what was typed
// (all three go through the dialog's `requestClose`; jsdom has no Esc on <dialog>).
it('closing after typing asks "Entwurf verwerfen?" first', async () => {
  const onClose = vi.fn();
  render(<AccountEditor target={{ draft: true, order: 0 }} onClose={onClose} />);
  await userEvent.type(await screen.findByLabelText('Kontoname'), 'Bargeld');
  await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
  expect(await screen.findByText('Entwurf verwerfen?')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});
