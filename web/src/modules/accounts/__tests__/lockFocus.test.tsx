// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@/core/platform';
import { t } from '@/strings';
import { LockScreen } from '../components/LockScreen';

afterEach(() => setPlatform(undefined));

/** "Back" in the browser: resolves once its `popstate` arrived. */
async function back() {
  await act(async () => {
    const popped = new Promise((done) => window.addEventListener('popstate', done, { once: true }));
    window.history.back();
    await popped;
  });
}

describe('lock screen: focus', () => {
  it('the master password field has the focus when the screen appears, marked with data-autofocus', () => {
    // The lock screen is a page, not a Dialog: nobody else reads the marker, so it focuses the field itself.
    render(<LockScreen />);
    const field = screen.getByLabelText(t.accounts.lock.password);
    expect(field).toHaveAttribute('data-autofocus');
    expect(field).not.toHaveAttribute('autofocus');
    expect(field).toHaveFocus();
  });

  it('takes the focus back when "Back" returns to it before the next page rendered', async () => {
    // The navigation away never rendered (a transition on a busy device): the screen stayed mounted
    // and the focus sits on what started it, e.g. "Mehr".
    window.history.replaceState(null, '', '/accounts');
    render(<LockScreen />);
    window.history.pushState(null, '', '/library');
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    try {
      elsewhere.focus();
      await back();
      expect(window.location.pathname).toBe('/accounts');
      expect(screen.getByLabelText(t.accounts.lock.password)).toHaveFocus();
    } finally {
      elsewhere.remove();
    }
  });

  it('leaves the focus alone when "Back" leads somewhere else', async () => {
    window.history.replaceState(null, '', '/accounts');
    render(<LockScreen />);
    window.history.replaceState(null, '', '/library');
    window.history.pushState(null, '', '/accounts');
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    try {
      elsewhere.focus();
      await back();
      expect(window.location.pathname).toBe('/library');
      expect(elsewhere).toHaveFocus();
    } finally {
      elsewhere.remove();
    }
  });
});
