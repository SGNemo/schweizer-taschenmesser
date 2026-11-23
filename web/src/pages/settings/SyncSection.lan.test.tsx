// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/ui';

// Desktop with the LAN hub: the own server sits in a folded group below the home-network block.
vi.mock('@/core/platform', () => ({
  getPlatform: () => ({ kind: 'desktop', isNative: true, lanHub: { supported: true } }),
}));
vi.mock('@/core/sync/service', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  refreshServerStatus: vi.fn(),
  resetServer: vi.fn(),
  signOutThisDevice: vi.fn(async () => 'ok'),
  syncNow: vi.fn(),
}));
vi.mock('./SyncConflicts', () => ({ SyncConflicts: () => null }));
vi.mock('./SyncDevices', () => ({ SyncDevices: () => null }));
// The home-network block's own main action (its real section needs the native hub).
vi.mock('./LanHubSection', () => ({
  LanHubSection: () => <Button variant="primary">Gerät koppeln</Button>,
}));

import { SyncSection } from './SyncSection';

describe('SyncSection on a desktop with the LAN hub', () => {
  it('the opened own-server form adds no second primary next to the home network', async () => {
    const { container } = render(<SyncSection />);
    await screen.findByText('Gerät koppeln');
    const group = screen.getByTestId('sync-group-server') as HTMLDetailsElement;
    group.open = true;
    const primaries = Array.from(
      container.querySelectorAll<HTMLElement>('[data-variant="primary"]'),
    ).map((el) => el.textContent);
    expect(primaries).toEqual(['Gerät koppeln']);
    // The connect button is still there, as a plain one.
    expect(group.querySelector('button[type="submit"]')).toHaveAttribute(
      'data-variant',
      'secondary',
    );
  });
});
