// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@/core/platform';
import { t } from '@/strings';
import { LockScreen } from '../components/LockScreen';

afterEach(() => setPlatform(undefined));

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/accounts', element: <LockScreen /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('lock screen: focus', () => {
  it('the master password field has the focus when the screen appears, marked with data-autofocus', () => {
    // The lock screen is a page, not a Dialog: nobody else reads the marker, so it focuses the field itself.
    renderAt('/accounts');
    const field = screen.getByLabelText(t.accounts.lock.password);
    expect(field).toHaveAttribute('data-autofocus');
    expect(field).not.toHaveAttribute('autofocus');
    expect(field).toHaveFocus();
  });

  it('takes the focus back when a navigation lands on it while it stayed mounted', async () => {
    // A navigation to a page whose code is still loading, abandoned with "Back" before it rendered:
    // the screen never unmounts, and the focus sits on what started the navigation.
    const router = renderAt('/accounts');
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();
    await act(() => router.navigate('/accounts'));
    expect(screen.getByLabelText(t.accounts.lock.password)).toHaveFocus();
    elsewhere.remove();
  });
});
