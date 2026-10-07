// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({ kind: 'desktop', isNative: true }),
}));
vi.mock('@/core/sync/service', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  refreshServerStatus: vi.fn(),
  resetServer: vi.fn(),
  signOutThisDevice: vi.fn(),
  syncNow: vi.fn(),
}));
vi.mock('./SyncConflicts', () => ({ SyncConflicts: () => null }));
vi.mock('./SyncDevices', () => ({ SyncDevices: () => null }));

import { ENCRYPT_BY_DEFAULT, SyncSection } from './SyncSection';

describe('SyncSection before the first connect', () => {
  it('proposes end-to-end encryption and shows no plaintext warning', () => {
    expect(ENCRYPT_BY_DEFAULT).toBe(true);
    render(<SyncSection />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByTestId('sync-plain-warning')).toBeNull();
  });
});
