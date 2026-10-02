// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import {
  setPlatform,
  type VaultBridgeRegistration,
  type VaultBridgeService,
} from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { loadBridgeConfig, setBridgeEnabled } from '@/core/vaultbridge/config';
import { useUiStore } from '@/stores/ui';
import { disableBridge, enableBridge, needsReregistration, resumeBridge } from '../bridge/control';

const fresh: VaultBridgeRegistration = {
  browsers: [{ browser: 'Brave', registered: true }],
  upToDate: true,
  manifest: 'm.json',
};

function fakeBridge(over: Partial<VaultBridgeService> = {}) {
  const service: VaultBridgeService = {
    supported: true,
    start: vi.fn(async () => null),
    stop: vi.fn(async () => undefined),
    register: vi.fn(async () => fresh),
    unregister: vi.fn(async () => undefined),
    status: vi.fn(async () => fresh),
    ...over,
  };
  setPlatform({ ...createWebPlatform(), vaultBridge: service });
  return service;
}

beforeEach(async () => {
  await db.table('_meta').clear();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => setPlatform(undefined));

describe('switching the bridge on and off', () => {
  it('registers with the browsers, listens, and remembers the choice', async () => {
    const s = fakeBridge();
    expect(await enableBridge()).toBe('ok');
    expect(s.register).toHaveBeenCalled();
    expect(s.start).toHaveBeenCalled();
    expect((await loadBridgeConfig()).enabled).toBe(true);
  });

  it('stays off when the registration fails', async () => {
    const s = fakeBridge({ register: vi.fn(async () => Promise.reject(new Error('denied'))) });
    expect(await enableBridge()).toBe('register-failed');
    expect(s.start).not.toHaveBeenCalled();
    expect((await loadBridgeConfig()).enabled).toBe(false);
  });

  it('stays off when another instance owns the channel', async () => {
    fakeBridge({ start: vi.fn(async () => 'channel-taken' as const) });
    expect(await enableBridge()).toBe('channel-taken');
    expect((await loadBridgeConfig()).enabled).toBe(false);
  });

  it('turning it off stops listening and removes the registration', async () => {
    const s = fakeBridge();
    await enableBridge();
    await disableBridge();
    expect(s.stop).toHaveBeenCalled();
    expect(s.unregister).toHaveBeenCalled();
    expect((await loadBridgeConfig()).enabled).toBe(false);
  });
});

describe('resume at startup', () => {
  it('does nothing while the bridge is off', async () => {
    const s = fakeBridge();
    await resumeBridge();
    expect(s.start).not.toHaveBeenCalled();
    expect(s.register).not.toHaveBeenCalled();
  });

  it('listens again and leaves a current registration alone', async () => {
    const s = fakeBridge();
    await setBridgeEnabled(true);
    await resumeBridge();
    expect(s.start).toHaveBeenCalled();
    expect(s.register).not.toHaveBeenCalled();
  });

  it('repairs a registration that points at an old path (portable folder moved)', async () => {
    const stale = { ...fresh, upToDate: false };
    const s = fakeBridge({ status: vi.fn(async () => stale) });
    await setBridgeEnabled(true);
    await resumeBridge();
    expect(s.register).toHaveBeenCalledTimes(1);
  });

  it('tells the user when the channel is taken', async () => {
    fakeBridge({ start: vi.fn(async () => 'channel-taken' as const) });
    await setBridgeEnabled(true);
    await resumeBridge();
    expect(useUiStore.getState().toasts[0]?.message).toContain('belegt');
  });

  it('is inert outside the desktop app', async () => {
    setPlatform(createWebPlatform());
    await setBridgeEnabled(true);
    await expect(resumeBridge()).resolves.toBeUndefined();
  });
});

describe('needsReregistration', () => {
  it('flags a stale path or a missing browser entry, not a healthy state', () => {
    expect(needsReregistration(null)).toBe(false);
    expect(needsReregistration(fresh)).toBe(false);
    expect(needsReregistration({ ...fresh, upToDate: false })).toBe(true);
    expect(
      needsReregistration({ ...fresh, browsers: [{ browser: 'Brave', registered: false }] }),
    ).toBe(true);
  });
});
