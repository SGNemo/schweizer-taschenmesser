// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setPin } from '@/core/applock/pin';
import { reloadPrefs, writePrefs } from '@/core/applock/prefs';
import { lockApp, unlockApp, useAppLock } from '@/core/applock/state';
import { FAST_KDF, memorySecrets } from '@/core/applock/__tests__/helpers';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { AppLockGate } from './AppLockGate';

beforeEach(() => {
  localStorage.clear();
  reloadPrefs();
  unlockApp();
  setPlatform({ ...createWebPlatform(), secrets: memorySecrets() });
});
afterEach(() => setPlatform(undefined));

describe('AppLockGate', () => {
  it('hides the app while locked (kept mounted, inert, no key reaches it) and shows it after the right PIN', async () => {
    await setPin('2468', FAST_KDF);
    writePrefs({ enabled: true });
    unlockApp(); // the app was opened before
    function Draft() {
      const [text, setText] = useState('');
      return <input aria-label="Entwurf" value={text} onChange={(e) => setText(e.target.value)} />;
    }
    const keys: string[] = [];
    window.addEventListener('keydown', (e) => keys.push(e.key));
    render(
      <AppLockGate>
        <p>Geheime Notiz</p>
        <Draft />
      </AppLockGate>,
    );
    fireEvent.change(screen.getByLabelText('Entwurf'), { target: { value: 'halb getippt' } });

    act(() => lockApp());
    // Not visible and not in the accessibility tree; nothing focusable inside.
    expect(screen.getByText('Geheime Notiz')).not.toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Entwurf' })).toBeNull();
    const content = screen.getByTestId('app-lock-content');
    expect(content).toHaveAttribute('hidden');
    expect(content).toHaveAttribute('inert');
    expect(screen.getByRole('heading', { name: 'Nemo ist gesperrt' })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(keys).toEqual([]);

    const field = screen.getByLabelText('PIN');
    fireEvent.change(field, { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entsperren' }));
    expect(
      await screen.findByText('Die PIN passt nicht. Versuch es noch einmal.'),
    ).toBeInTheDocument();
    expect(useAppLock.getState().locked).toBe(true);

    fireEvent.change(field, { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entsperren' }));
    await waitFor(() => expect(screen.getByText('Geheime Notiz')).toBeVisible());
    // The half-typed draft survived the lock (FOCUS-GUIDELINES 5).
    expect(screen.getByLabelText('Entwurf')).toHaveValue('halb getippt');
  });

  it('locked at start: the app is not mounted at all until the PIN', async () => {
    await setPin('2468', FAST_KDF);
    writePrefs({ enabled: true });
    act(() => lockApp());
    render(
      <AppLockGate>
        <p>Geheime Notiz</p>
      </AppLockGate>,
    );
    expect(screen.queryByTestId('app-lock-content')).toBeNull();
    expect(document.body.textContent).not.toContain('Geheime Notiz');
  });

  it('"Jetzt sperren" does nothing while the lock is off', () => {
    render(
      <AppLockGate>
        <p>Inhalt</p>
      </AppLockGate>,
    );
    act(() => lockApp());
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });
});
