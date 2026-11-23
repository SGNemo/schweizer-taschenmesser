// @vitest-environment jsdom
/**
 * Launch review 2026-11, package 8: H4 (the pairing window closes by itself after its lifetime),
 * H5 (an unpairing that could not be saved is said, with a way to try again), H6 (the page hands
 * the PC no code: Rust asks in a native question).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeLanHubParts } from '@/core/platform/fakeLanHub';
import { useSyncStatus } from '@/core/sync/status';
import { tLanSync } from '@/strings.lanSync';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeLanHubParts>,
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'desktop',
    isNative: true,
    lanHub: fake.parts.hub,
    lanClient: undefined,
    desktop: { supported: false },
    app: { openUrl: vi.fn() },
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

const l = tLanSync.get();
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const poll = () => act(async () => new Promise((r) => setTimeout(r, 1100)));

beforeEach(() => {
  fake.parts = createFakeLanHubParts();
  useSyncStatus.getState().set({ phase: 'off', via: undefined, encrypted: false, pending: 0 });
});

describe('LanHubSection: package 8', () => {
  it('H6: "Koppeln" hands the PC only the attempt, never the code', async () => {
    const confirm = vi.spyOn(fake.parts.hub, 'pairConfirm');
    render(<LanHubSection />);
    fireEvent.click(screen.getByTestId('lan-pair'));
    await flush();
    fake.parts.hooks.knock('Pixel 7', '482913');
    await poll();
    fireEvent.click(screen.getByTestId('lan-pair-confirm'));
    await flush();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]).toHaveLength(1);
  });

  it('H6: "Abbrechen" in the native question leaves the request open and shows no error', async () => {
    render(<LanHubSection />);
    fireEvent.click(screen.getByTestId('lan-pair'));
    await flush();
    fake.parts.hooks.knock('Pixel 7', '482913');
    await poll();
    fake.parts.hub.pairConfirm = vi.fn(async () => {
      throw new Error('cancelled');
    });
    fireEvent.click(screen.getByTestId('lan-pair-confirm'));
    await flush();
    expect(screen.getByTestId('lan-pair-ask')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('H4: a window that closed by itself says so and offers a new code', async () => {
    render(<LanHubSection />);
    fireEvent.click(screen.getByTestId('lan-pair'));
    await flush();
    await fake.parts.hub.pairCancel(); // what the hub does after the lifetime
    await poll();
    const dialog = screen.getByTestId('lan-pair-dialog');
    expect(dialog.textContent).toContain(l.pairClosed);
    fireEvent.click(within(dialog).getByRole('button', { name: l.pairNewCode }));
    await poll();
    expect(screen.getByTestId('lan-pair-qr')).toBeTruthy();
  });

  it('H5: an unpairing that could not be saved says so and can be tried again', async () => {
    useSyncStatus.getState().set({ phase: 'idle', via: 'lanHub', encrypted: true });
    await fake.parts.hub.start();
    await fake.parts.hub.pairOpen();
    fake.parts.hooks.knock('Pixel 7', '482913');
    await fake.parts.hub.pairConfirm((await fake.parts.hub.status()).pending!.attempt);
    const revoke = fake.parts.hub.revoke;
    let fail = true;
    fake.parts.hub.revoke = vi.fn(async (id: string) => {
      if (fail) throw new Error('failed');
      return revoke(id);
    });
    render(<LanHubSection />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: l.unpair }));
    fireEvent.click(screen.getByRole('button', { name: l.unpairConfirm }));
    await flush();
    expect(screen.getByTestId('lan-note').textContent).toBe(l.unpairFailed('Pixel 7'));
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: l.unpairRetry }));
    await flush();
    expect(fake.parts.hub.revoke).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('lan-note').textContent).toBe(l.unpaired('Pixel 7'));
  });
});
