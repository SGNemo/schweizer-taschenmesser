// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncStatus } from '@/core/sync/status';

const mocks = vi.hoisted(() => ({
  pairWithPc: vi.fn(),
  scan: vi.fn(async () => 'NEMO1:qr'),
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'android',
    isNative: true,
    lanClient: { supported: true, scan: mocks.scan },
  }),
}));
vi.mock('@/core/sync/service', () => ({
  pairWithPc: mocks.pairWithPc,
  cancelPairing: vi.fn(),
  syncNow: vi.fn(),
  unpairFromPc: vi.fn(),
}));

import { LanClientSection } from './LanClientSection';

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  mocks.pairWithPc.mockReset();
  useSyncStatus
    .getState()
    .set({ phase: 'off', via: undefined, error: undefined, pending: 0, wifi: undefined });
});

describe('LanClientSection (phone)', () => {
  it('"Jetzt abgleichen" waits for Wi-Fi and says why', async () => {
    useSyncStatus.getState().set({ phase: 'idle', via: 'lanClient', encrypted: true, wifi: false });
    render(<LanClientSection />);
    const button = screen.getByTestId('lan-sync-now');
    expect(button).toHaveProperty('disabled', true);
    const reason = screen.getByTestId('lan-wifi-only');
    expect(reason.textContent).toBe('Nur im WLAN');
    expect(button.getAttribute('aria-describedby')).toBe(reason.id);
    await act(async () => useSyncStatus.getState().set({ wifi: true }));
    expect(screen.getByTestId('lan-sync-now')).toHaveProperty('disabled', false);
    expect(screen.queryByTestId('lan-wifi-only')).toBeNull();
    // unknown Wi-Fi (nobody watches it) never blocks the button
    await act(async () => useSyncStatus.getState().set({ wifi: undefined }));
    expect(screen.getByTestId('lan-sync-now')).toHaveProperty('disabled', false);
  });

  it('scans, shows the code to confirm on the PC, then the paired state', async () => {
    let finish: (v: { ok: true }) => void = () => undefined;
    mocks.pairWithPc.mockImplementation(
      (_qr: string, _name: string, onCode: (c: string) => void) =>
        new Promise((resolve) => {
          onCode('482913');
          finish = resolve;
        }),
    );
    render(<LanClientSection />);
    expect(screen.getByTestId('lan-client-intro').textContent).toContain(
      'Gleiche im Heimnetz mit deinem PC ab.',
    );
    fireEvent.click(screen.getByTestId('lan-pair-pc'));
    await flush();
    expect(screen.getByTestId('lan-confirm-on-pc').textContent).toBe(
      'Am PC bestätigen · Code 482 913',
    );
    await act(async () => {
      useSyncStatus
        .getState()
        .set({ phase: 'idle', via: 'lanClient', encrypted: true, lastSyncAt: Date.now() });
      finish({ ok: true });
    });
    expect(screen.getByTestId('lan-client-state').textContent).toBe('Abgeglichen');
  });

  it('says why pairing failed in plain words', async () => {
    mocks.pairWithPc.mockResolvedValue({ ok: false, reason: 'pairing-not-possible' });
    render(<LanClientSection />);
    fireEvent.click(screen.getByTestId('lan-pair-pc'));
    await flush();
    expect(screen.getByTestId('lan-pair-failure').textContent).toBe(
      'Kopplung nicht möglich – am PC neu zeigen.',
    );
    // the next step names itself
    expect(screen.getByTestId('lan-pair-pc').textContent).toBe('Neu scannen');
  });

  it('a PC out of reach is a calm line, an authenticated refusal offers "Neu koppeln"', () => {
    useSyncStatus.getState().set({ phase: 'error', via: 'lanClient', error: 'network' });
    const { unmount } = render(<LanClientSection />);
    expect(screen.getByTestId('lan-client-state').textContent).toBe(
      'Gleicht ab, sobald dein PC im selben WLAN erreichbar ist',
    );
    expect(screen.queryByTestId('lan-pair-pc')).toBeNull();
    unmount();
    useSyncStatus.getState().set({ phase: 'error', via: 'lanClient', error: 'revoked' });
    render(<LanClientSection />);
    expect(screen.getByTestId('lan-client-state').textContent).toBe('Diese Kopplung wurde gelöst.');
    expect(screen.getByTestId('lan-pair-pc').textContent).toBe('Neu koppeln');
  });

  it('"Jetzt abgleichen" that does not reach the PC says so, not just the same line', () => {
    useSyncStatus.getState().set({ phase: 'error', via: 'lanClient', error: 'network' });
    render(<LanClientSection />);
    expect(screen.queryByTestId('lan-tried')).toBeNull();
    fireEvent.click(screen.getByText('Jetzt abgleichen'));
    expect(screen.getByTestId('lan-tried').textContent).toContain('der PC hat nicht geantwortet');
  });

  it('after 7 days without the PC one calm line says what to do; before that it does not', () => {
    const day = 24 * 60 * 60 * 1000;
    useSyncStatus.getState().set({
      phase: 'error',
      via: 'lanClient',
      error: 'network',
      lastSyncAt: Date.now() - 2 * day,
    });
    const { unmount } = render(<LanClientSection />);
    expect(screen.queryByTestId('lan-long-no-pc')).toBeNull();
    unmount();
    useSyncStatus.getState().set({ lastSyncAt: Date.now() - 8 * day });
    render(<LanClientSection />);
    expect(screen.getByTestId('lan-long-no-pc').textContent).toContain('Lange keinen PC gefunden');
  });

  it('a phone on an own server offers the switch to the home network', () => {
    useSyncStatus.getState().set({ phase: 'idle', via: 'server', error: undefined });
    render(<LanClientSection />);
    expect(screen.getByTestId('lan-switch-open').textContent).toBe(
      'Vom Server auf das Heimnetz umstellen',
    );
  });
});
