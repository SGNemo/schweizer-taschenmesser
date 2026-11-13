// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSyncStatus } from '@/core/sync/status';
import { SyncBadge } from './SyncBadge';

const renderBadge = () =>
  render(
    <MemoryRouter>
      <SyncBadge />
    </MemoryRouter>,
  );

beforeEach(() => useSyncStatus.getState().set({ phase: 'off', via: undefined, error: undefined }));

describe('SyncBadge', () => {
  it('stays calm while a paired phone waits for its PC (the normal state away from home)', () => {
    useSyncStatus.getState().set({ phase: 'error', via: 'lanClient', error: 'network' });
    renderBadge();
    const badge = screen.getByTestId('sync-badge');
    expect(badge.getAttribute('aria-label')).toBe('Synchronisation: wartet auf deinen PC');
    expect(badge.className).not.toMatch(/syncError/);
  });

  it('still says "Fehler" for a real problem and for an own server out of reach', () => {
    useSyncStatus.getState().set({ phase: 'error', via: 'lanClient', error: 'revoked' });
    const { unmount } = renderBadge();
    expect(screen.getByTestId('sync-badge').className).toMatch(/syncError/);
    unmount();
    useSyncStatus.getState().set({ phase: 'error', via: 'server', error: 'network' });
    renderBadge();
    expect(screen.getByTestId('sync-badge').className).toMatch(/syncError/);
  });
});

describe('SyncBadge motion (DESIGN-SPEC § 9: no endless spin)', () => {
  it('stands still while syncing and pulses once when the sync ends well', () => {
    useSyncStatus.getState().set({ phase: 'idle', via: 'server', error: undefined });
    renderBadge();
    const icon = () => screen.getByTestId('sync-badge').firstElementChild as HTMLElement;
    expect(icon().dataset.pulses).toBe('0');
    act(() => useSyncStatus.getState().set({ phase: 'syncing' }));
    expect(icon().className).not.toMatch(/spin|pulse/);
    act(() => useSyncStatus.getState().set({ phase: 'idle' }));
    expect(icon().dataset.pulses).toBe('1');
    expect(icon().className).toMatch(/pulse/);
  });

  it('does not pulse when the sync ends with an error', () => {
    useSyncStatus.getState().set({ phase: 'syncing', via: 'server', error: undefined });
    renderBadge();
    act(() => useSyncStatus.getState().set({ phase: 'error', error: 'network' }));
    const icon = screen.getByTestId('sync-badge').firstElementChild as HTMLElement;
    expect(icon.dataset.pulses).toBe('0');
  });
});
