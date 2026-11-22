// @vitest-environment jsdom
/**
 * X2: when the channel is taken at app start, the settings dialog says so in its status line
 * (not only in a toast that disappears), and a successful start clears it.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform, type VaultBridgeService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setBridgeEnabled } from '@/core/vaultbridge/config';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { enableBridge, resumeBridge, useBridgeStartError } from '../bridge/control';
import { BridgeDialog } from '../components/BridgeDialog';

function fakeBridge(start: VaultBridgeService['start']) {
  const reg = { browsers: [], upToDate: true, manifest: 'm.json' };
  setPlatform({
    ...createWebPlatform(),
    vaultBridge: {
      supported: true,
      start,
      stop: vi.fn(async () => undefined),
      register: vi.fn(async () => reg),
      unregister: vi.fn(async () => undefined),
      status: vi.fn(async () => reg),
    },
  });
}

beforeEach(async () => {
  await db.table('_meta').clear();
  useUiStore.setState({ toasts: [] });
  useBridgeStartError.setState({ error: null });
});
afterEach(() => setPlatform(undefined));

describe('bridge start error at app start', () => {
  it('a taken channel at start shows in the dialog status, not "ready"', async () => {
    fakeBridge(vi.fn(async () => 'channel-taken' as const));
    await setBridgeEnabled(true);
    await resumeBridge();
    expect(useBridgeStartError.getState().error).toBe('channel-taken');
    render(<BridgeDialog open onClose={() => {}} />);
    expect(
      await screen.findByText(t.accounts.bridge.startErrors['channel-taken'], { exact: false }),
    ).toBeTruthy();
    expect(screen.queryByText(t.accounts.bridge.statusOn, { exact: false })).toBeNull();
  });

  it('a successful start clears the remembered error', async () => {
    useBridgeStartError.setState({ error: 'channel-taken' });
    fakeBridge(vi.fn(async () => null));
    expect(await enableBridge()).toBe('ok');
    expect(useBridgeStartError.getState().error).toBeNull();
  });
});
