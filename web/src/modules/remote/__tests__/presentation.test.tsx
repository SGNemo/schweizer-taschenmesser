// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import { useSyncStatus } from '@/core/sync/status';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeRemoteParts>,
  prefs: undefined as undefined | Record<string, unknown>,
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'android',
    isNative: true,
    remote: { ...fake.parts.remote, supported: true },
    display: { setKeepAwake: async () => undefined },
  }),
}));
vi.mock('@/core/sync/service', () => ({ syncNow: vi.fn(async () => undefined) }));
vi.mock('@/core/settings/settings', () => ({ useSettings: () => [fake.prefs, vi.fn()] }));

import RemotePage from '../routes/RemotePage';
import { remoteSession } from '../session';

const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
async function until(ready: () => boolean) {
  for (let i = 0; i < 600 && !ready(); i++) await wait(10);
  await wait(0);
}
async function showPage() {
  render(
    <MemoryRouter>
      <RemotePage />
    </MemoryRouter>,
  );
  await until(() => fake.parts.hooks.opens() > 0);
  await wait(0);
}
const tab = () => screen.queryByRole('button', { name: 'Präsentation' });
const state = () => screen.getByTestId('remote-state').textContent;

beforeEach(async () => {
  await remoteSession.close();
  fake.parts = createFakeRemoteParts();
  fake.prefs = { haptics: false, keepAwake: false, volumeKeys: false, padLegendSeen: true };
  useSyncStatus.getState().set({ phase: 'idle', via: 'lanClient', error: undefined });
});

describe('page Präsentation', () => {
  it('Weiter and Zurück in the thumb zone, Start · Schwarz · Ende above them', async () => {
    fake.parts.hooks.setGrant('full');
    await showPage();
    await until(() => tab() !== null);
    fireEvent.click(tab()!);
    await until(() => fake.parts.hooks.level() === 'full');
    expect(screen.getByTestId('remote-present-hint').textContent).toBe(
      'Das Präsentationsfenster muss am PC vorne sein. Geht nur im Heimnetz.',
    );
    const group = screen.getByRole('group', { name: 'Folien' });
    const names = [...group.querySelectorAll('button')].map(
      (b) => b.getAttribute('aria-label') ?? b.textContent,
    );
    expect(names).toEqual([
      'Start der Präsentation',
      'Schwarz schalten oder wieder zeigen',
      'Ende der Präsentation',
      'Zurück',
      'Weiter',
    ]);
    fireEvent.click(screen.getByTestId('remote-key-f5'));
    fireEvent.click(screen.getByTestId('remote-slide-next'));
    fireEvent.click(screen.getByTestId('remote-slide-next'));
    fireEvent.click(screen.getByTestId('remote-slide-previous'));
    fireEvent.click(screen.getByTestId('remote-key-b'));
    fireEvent.click(screen.getByTestId('remote-key-escape'));
    await until(() => fake.parts.hooks.sent().length === 6);
    expect(fake.parts.hooks.sent()).toEqual([
      'key-f5',
      'key-right',
      'key-right',
      'key-left',
      'key-b',
      'key-escape',
    ]);
  });

  it('says what Tastatur says when the PC grants media only', async () => {
    await showPage();
    await until(() => tab() !== null);
    fireEvent.click(tab()!);
    await until(() => (state() ?? '').includes('Maus und Tastatur sind am PC'));
    expect(state()).toContain('Maus und Tastatur sind am PC für dieses Handy aus.');
    expect(screen.getByTestId('remote-slide-next')).toHaveProperty('disabled', true);
    expect(fake.parts.hooks.sent()).toEqual([]);
  });

  it('is absent for a PC that does not take the presentation keys', async () => {
    fake.parts.hooks.setPresent(false);
    await showPage();
    await until(() => screen.queryByRole('button', { name: 'Tastatur' }) !== null);
    await wait(50);
    expect(remoteSession.present()).toBe(false);
    expect(tab()).toBeNull();
    expect(screen.queryByTestId('remote-slides')).toBeNull();
  });
});
