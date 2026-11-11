// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import { HOLD_STEPS_PER_SECOND, KEYS_LINGER_MS } from '@/core/remote/session';
import { useSyncStatus } from '@/core/sync/status';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeRemoteParts>,
  prefs: undefined as undefined | Record<string, unknown>,
  /** What the shell was last told: the keys are with the app, or not. */
  held: [] as boolean[],
  key: undefined as undefined | ((key: 'up' | 'down', repeat: boolean) => void),
  withKeys: true,
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'android',
    isNative: true,
    remote: { ...fake.parts.remote, supported: true },
    display: {
      setKeepAwake: async () => undefined,
      volumeKeys: fake.withKeys
        ? {
            hold: async (on: boolean) => {
              fake.held.push(on);
            },
            onKey: (callback: (key: 'up' | 'down', repeat: boolean) => void) => {
              fake.key = callback;
              return () => {
                fake.key = undefined;
              };
            },
          }
        : undefined,
    },
  }),
}));
vi.mock('@/core/sync/service', () => ({ syncNow: vi.fn(async () => undefined) }));
vi.mock('@/core/settings/settings', () => ({ useSettings: () => [fake.prefs, vi.fn()] }));

import RemotePage from '../routes/RemotePage';
import { remoteSession } from '../session';
import { RENEW_MS } from '../volumeKeys';

const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
async function until(ready: () => boolean) {
  for (let i = 0; i < 600 && !ready(); i++) await wait(10);
  await wait(0);
}
const show = async () => {
  const view = render(
    <MemoryRouter>
      <RemotePage />
    </MemoryRouter>,
  );
  await until(() => fake.parts.hooks.opens() > 0);
  return view;
};
const lastHeld = () => fake.held.at(-1);
const PREFS = { haptics: false, keepAwake: false, volumeKeys: true, padLegendSeen: true };

beforeEach(async () => {
  await remoteSession.close();
  fake.parts = createFakeRemoteParts();
  fake.prefs = { ...PREFS };
  fake.held = [];
  fake.key = undefined;
  fake.withKeys = true;
  useSyncStatus.getState().set({ phase: 'idle', via: 'lanClient', error: undefined });
});

describe('the phone’s volume keys', () => {
  it('change the PC’s volume while a session is open, and the page says so', async () => {
    await show();
    expect(lastHeld()).toBe(true);
    expect(screen.getByTestId('remote-volume-keys').textContent).toBe(
      'Lautstärketasten steuern den PC',
    );
    await act(async () => fake.key?.('up', false));
    await act(async () => fake.key?.('down', false));
    expect(fake.parts.hooks.sent()).toEqual(['volume-up', 'volume-down']);
    // always Medien: a key never asks for more than a media session
    expect(fake.parts.hooks.level()).toBe('media');
  });

  it('a held key steps at most a few times a second', async () => {
    await show();
    await act(async () => fake.key?.('up', false));
    for (let i = 0; i < 30; i++) await act(async () => fake.key?.('up', true));
    expect(fake.parts.hooks.sent().length).toBe(1);
    await wait(1000 / HOLD_STEPS_PER_SECOND + 20);
    await act(async () => fake.key?.('up', true));
    expect(fake.parts.hooks.sent().length).toBe(2);
  });

  it('are asked for again and again (a lease), and given back when the page leaves', async () => {
    const view = await show();
    const before = fake.held.length;
    await wait(RENEW_MS + 100);
    expect(fake.held.length).toBeGreaterThan(before);
    expect(lastHeld()).toBe(true);
    view.unmount();
    expect(lastHeld()).toBe(false);
    expect(fake.key).toBeUndefined();
  });

  it('the shell hears of changes and renewals, not of every state the PC reports', async () => {
    await show();
    const before = fake.held.length;
    for (let i = 0; i < 20; i++) await act(async () => fake.parts.hooks.setState({ volume: i }));
    expect(fake.held.length).toBe(before);
  });

  it('go back to the phone a few seconds after a connection was lost for good', async () => {
    await show();
    fake.parts.hooks.failOpen('network', 99);
    await act(async () => fake.parts.hooks.close());
    expect(lastHeld()).toBe(true);
    await until(() => lastHeld() === false);
    expect(screen.queryByTestId('remote-volume-keys')).toBeNull();
    // given back once, not again and again
    const after = fake.held.length;
    await wait(RENEW_MS + 100);
    expect(fake.held.length).toBe(after);
  }, 20_000);

  it('stay the phone’s own once the PC ended the session', async () => {
    await show();
    await act(async () => fake.parts.hooks.close('ended'));
    expect(lastHeld()).toBe(false);
    expect(screen.queryByTestId('remote-volume-keys')).toBeNull();
    // a key that still arrives is not sent
    await act(async () => fake.key?.('up', false));
    expect(fake.parts.hooks.sent()).toEqual([]);
  });

  it('a lost connection keeps them for a moment, so a press reconnects', async () => {
    await show();
    await act(async () => fake.parts.hooks.close());
    expect(lastHeld()).toBe(true);
    await act(async () => fake.key?.('up', false));
    await until(() => fake.parts.hooks.sent().length === 1);
    expect(fake.parts.hooks.sent()).toEqual(['volume-up']);
    expect(KEYS_LINGER_MS).toBeGreaterThan(RENEW_MS);
  });

  it('switched off in the settings, or without such keys, nothing is taken', async () => {
    fake.prefs = { ...PREFS, volumeKeys: false };
    const view = await show();
    expect(fake.held).toEqual([]);
    expect(fake.key).toBeUndefined();
    expect(screen.queryByTestId('remote-volume-keys')).toBeNull();
    view.unmount();

    await remoteSession.close();
    fake.parts = createFakeRemoteParts();
    fake.prefs = { ...PREFS };
    fake.withKeys = false;
    await show();
    expect(fake.held).toEqual([]);
    expect(screen.queryByTestId('remote-volume-keys')).toBeNull();
  });
});
