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
  useSyncStatus.getState().set({ phase: 'off', via: undefined, error: undefined, pending: 0 });
});

describe('LanClientSection (phone)', () => {
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
});
