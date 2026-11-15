// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  it('unmounts the children while locked and brings them back after the right PIN', async () => {
    await setPin('2468', FAST_KDF);
    writePrefs({ enabled: true });
    render(
      <AppLockGate>
        <p>Geheime Notiz</p>
      </AppLockGate>,
    );
    expect(screen.getByText('Geheime Notiz')).toBeInTheDocument();

    act(() => lockApp());
    expect(screen.queryByText('Geheime Notiz')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Nemo ist gesperrt' })).toBeInTheDocument();

    const field = screen.getByLabelText('PIN');
    fireEvent.change(field, { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entsperren' }));
    expect(
      await screen.findByText('Die PIN passt nicht. Versuch es noch einmal.'),
    ).toBeInTheDocument();
    expect(useAppLock.getState().locked).toBe(true);
    expect(screen.queryByText('Geheime Notiz')).toBeNull();

    fireEvent.change(field, { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entsperren' }));
    expect(await screen.findByText('Geheime Notiz')).toBeInTheDocument();
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
