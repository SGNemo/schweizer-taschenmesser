// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pushBack, releaseBack, resetBackStack } from '@/core/shell/backStack';
import { setPlatform } from '@/core/platform';
import { t } from '@/strings';
import { LockScreen } from '../components/LockScreen';

let elsewhere: HTMLButtonElement;
beforeEach(() => {
  resetBackStack();
  window.history.replaceState(null, '', '/accounts');
  elsewhere = document.createElement('button');
  document.body.append(elsewhere);
});
afterEach(() => {
  elsewhere.remove();
  resetBackStack();
  window.history.replaceState(null, '', '/');
  setPlatform(undefined);
});

function renderLock() {
  return render(
    <MemoryRouter initialEntries={['/accounts']}>
      <LockScreen />
    </MemoryRouter>,
  );
}

/** Resolves once the next `popstate` arrived. */
async function popstate(go: () => void) {
  await act(async () => {
    const popped = new Promise((done) => window.addEventListener('popstate', done, { once: true }));
    go();
    await popped;
  });
}

const field = () => screen.getByLabelText(t.accounts.lock.password);

describe('lock screen: focus', () => {
  it('the master password field has the focus when the screen appears, marked with data-autofocus', () => {
    // The lock screen is a page, not a Dialog: nobody else reads the marker, so it focuses the field itself.
    renderLock();
    expect(field()).toHaveAttribute('data-autofocus');
    expect(field()).not.toHaveAttribute('autofocus');
    expect(field()).toHaveFocus();
  });

  it('takes the focus back when Back returns to it before the next page rendered', async () => {
    // The navigation away never rendered (a router transition on a busy device): the screen stayed
    // mounted and the focus sits on the button that started it.
    renderLock();
    window.history.pushState({ idx: 1 }, '', '/library');
    elsewhere.focus();
    await popstate(() => window.history.back());
    expect(window.location.pathname).toBe('/accounts');
    expect(field()).toHaveFocus();
  });

  it('leaves the focus with the opener when a sheet over it closes by button', async () => {
    renderLock();
    pushBack('sheet', () => undefined);
    elsewhere.focus(); // the dialog handed the focus back to its opener
    await popstate(() => releaseBack('sheet')); // our own history.back()
    expect(elsewhere).toHaveFocus();
  });

  it('leaves the focus alone when Back leads somewhere else, or after the screen is gone', async () => {
    window.history.replaceState(null, '', '/library');
    window.history.pushState({ idx: 1 }, '', '/accounts');
    const { unmount } = renderLock();
    elsewhere.focus();
    await popstate(() => window.history.back());
    expect(window.location.pathname).toBe('/library');
    expect(elsewhere).toHaveFocus();

    window.history.pushState({ idx: 1 }, '', '/accounts');
    window.history.pushState({ idx: 2 }, '', '/library');
    unmount();
    await popstate(() => window.history.back());
    expect(window.location.pathname).toBe('/accounts');
    expect(elsewhere).toHaveFocus();
  });
});
