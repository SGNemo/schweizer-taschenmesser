// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeLanHubParts } from '@/core/platform/fakeLanHub';
import { useSyncStatus } from '@/core/sync/status';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeLanHubParts>,
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'desktop',
    isNative: true,
    lanHub: fake.parts.hub,
    desktop: { supported: false },
  }),
}));
vi.mock('@/core/sync/service', () => ({
  enableLanHub: vi.fn(async () => {
    await fake.parts.hub.start();
    useSyncStatus.getState().set({ phase: 'idle', via: 'lanHub', encrypted: true });
    return { ok: true };
  }),
  disableLanHub: vi.fn(),
  renewLanHubKey: vi.fn(async () => true),
  syncNow: vi.fn(),
}));

import { LanHubSection } from './LanHubSection';

beforeEach(() => {
  fake.parts = createFakeLanHubParts();
  useSyncStatus.getState().set({ phase: 'off', via: undefined, encrypted: false, pending: 0 });
});

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

describe('LanHubSection (desktop)', () => {
  it('offers "Gerät koppeln" first, then shows the QR, the code to compare and the paired device', async () => {
    render(<LanHubSection />);
    expect(screen.getByTestId('lan-hub-intro').textContent).toContain(
      'Gleiche dein Handy im Heimnetz mit diesem PC ab.',
    );
    fireEvent.click(screen.getByTestId('lan-pair'));
    await flush();
    expect(screen.getByTestId('lan-pair-qr')).toBeTruthy();

    // a phone scanned the QR and knocks: the PC shows its name and the 6-digit code
    fake.parts.hooks.knock('Pixel 7', '482913');
    await act(async () => new Promise((r) => setTimeout(r, 1100)));
    expect(screen.getByTestId('lan-pair-ask').textContent).toBe('Pixel 7 koppeln? Code 482 913');

    fireEvent.click(screen.getByTestId('lan-pair-confirm'));
    await flush();
    expect(screen.getByTestId('lan-paired').textContent).toBe('Pixel 7 ist gekoppelt.');
    expect((await fake.parts.hub.devices()).map((d) => d.name)).toEqual(['Pixel 7']);
  });

  it('never shows red: a blocked network is an attention banner with words', async () => {
    useSyncStatus.getState().set({ phase: 'idle', via: 'lanHub', encrypted: true });
    await fake.parts.hub.start();
    fake.parts.hub.status = async () => ({
      running: true,
      state: 'off',
      reason: 'public-network',
      blocked: true,
      pairingOpen: false,
      devices: 1,
    });
    render(<LanHubSection />);
    await flush();
    expect(screen.getByTestId('lan-hub-state').textContent).toBe('Windows blockiert den Abgleich.');
  });
});
