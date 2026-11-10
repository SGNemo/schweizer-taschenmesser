// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeLanHubParts } from '@/core/platform/fakeLanHub';
import { useSyncStatus } from '@/core/sync/status';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeLanHubParts>,
  openUrl: vi.fn(async () => undefined),
  client: undefined as undefined | { supported: boolean },
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'desktop',
    isNative: true,
    lanHub: fake.parts.hub,
    lanClient: fake.client,
    desktop: { supported: false },
    app: { openUrl: fake.openUrl },
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
  pairWithPc: vi.fn(),
  cancelPairing: vi.fn(),
}));

import { LanHubSection } from './LanHubSection';

beforeEach(() => {
  fake.parts = createFakeLanHubParts();
  fake.client = undefined;
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

  it('a public network shows the way out instead of a missing QR, and the QR follows by itself', async () => {
    useSyncStatus.getState().set({ phase: 'idle', via: 'lanHub', encrypted: true });
    await fake.parts.hub.start();
    const real = fake.parts.hub.status.bind(fake.parts.hub);
    let isPublic = true;
    fake.parts.hub.status = async () =>
      isPublic
        ? { ...(await real()), state: 'off', reason: 'public-network', blocked: true, qr: null }
        : real();
    render(<LanHubSection />);
    await flush();
    fireEvent.click(screen.getByTestId('lan-pair'));
    await flush();
    expect(screen.getByTestId('lan-pair-blocked').textContent).toContain('„Privat“');
    expect(screen.queryByTestId('lan-pair-qr')).toBeNull();
    fireEvent.click(screen.getByText('Windows-Einstellungen öffnen'));
    expect(fake.openUrl).toHaveBeenCalledWith('ms-settings:network-status');

    // the user switched the network to "Privat": the next status shows the QR
    isPublic = false;
    fake.parts.hub.status = real;
    await act(async () => new Promise((r) => setTimeout(r, 1600)));
    expect(screen.queryByTestId('lan-pair-blocked')).toBeNull();
    expect(screen.getByTestId('lan-pair-qr')).toBeTruthy();
  });

  it('offers "Mit einem anderen PC koppeln" only where this PC can pair as a client', () => {
    const { unmount } = render(<LanHubSection />);
    expect(screen.queryByTestId('lan-pair-other-pc')).toBeNull();
    unmount();
    fake.client = { supported: true };
    render(<LanHubSection />);
    expect(screen.getByTestId('lan-pair-other-pc').textContent).toBe(
      'Mit einem anderen PC koppeln',
    );
  });

  it('a PC without a webcam gets a calm line and the way to the own server', async () => {
    fake.client = { supported: true };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException('no device', 'NotFoundError');
        }),
      },
    });
    render(<LanHubSection />);
    fireEvent.click(screen.getByTestId('lan-pair-other-pc'));
    await flush();
    await flush();
    const line = screen.getByTestId('lan-pair-failure');
    expect(line.textContent).toContain(
      'Ohne Kamera geht das Koppeln mit einem anderen PC noch nicht.',
    );
    expect(line.textContent).toContain('„Eigener Server (erweitert)“');
    expect(line.getAttribute('role')).toBe('status');
    // nothing was turned on: still the hub's start screen
    expect(screen.getByTestId('lan-hub-intro')).toBeTruthy();
  });
});
