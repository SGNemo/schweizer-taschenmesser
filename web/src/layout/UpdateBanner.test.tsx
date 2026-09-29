import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { useUpdateStore } from '@/core/update/controller';
import type { UpdateInfo } from '@/core/update/types';
import { t } from '@/strings';
import { UpdateBanner } from './UpdateBanner';

const info: UpdateInfo = {
  version: '1.2.0-beta.1',
  prerelease: true,
  notes:
    '## 1.2.0-beta.1 (2026-10-01)\n\n### Features\n\n- **ai:** add Groq\n- <img src=x onerror=alert(1)>',
};

afterEach(() => {
  useUpdateStore.getState().set({ phase: 'idle' });
  setPlatform(undefined);
});

function fakeNative(install = vi.fn(async () => 'restarting' as const)): PlatformService {
  const platform: PlatformService = {
    ...createWebPlatform(),
    app: { version: async () => '1.0.0', openUrl: async () => undefined },
    files: { write: async () => undefined, list: async () => [], remove: async () => undefined },
    updater: { supported: true, check: async () => undefined, install },
  };
  setPlatform(platform);
  return platform;
}

describe('UpdateBanner', () => {
  it('shows nothing without an update', () => {
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers the update with a plain-text changelog preview (no HTML is rendered)', async () => {
    useUpdateStore.getState().set({ phase: 'available', info });
    const { container } = render(<UpdateBanner />);
    expect(screen.getByText(/Update verfügbar \(v1\.2\.0-beta\.1\)/)).toBeInTheDocument();
    expect(screen.getByText(t.update.beta)).toBeInTheDocument();
    expect(screen.getByText('ai: add Groq')).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument(); // as text
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: t.update.updateNow })).toBeEnabled();
  });

  it('"Später" hides the offer without installing anything', async () => {
    const install = vi.fn(async () => 'restarting' as const);
    fakeNative(install);
    useUpdateStore.getState().set({ phase: 'available', info });
    render(<UpdateBanner />);
    await userEvent.setup().click(screen.getByRole('button', { name: t.update.later }));
    await vi.waitFor(() => expect(useUpdateStore.getState().state.phase).toBe('idle'));
    expect(install).not.toHaveBeenCalled();
  });

  it('shows the progress while installing and disables the buttons', () => {
    useUpdateStore.getState().set({
      phase: 'installing',
      info,
      step: 'download',
      progress: { downloaded: 50, total: 200 },
    });
    render(<UpdateBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('25 %');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByRole('button', { name: t.update.updateNow })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.update.later })).toBeDisabled();
  });

  it('explains the Android install permission and errors, and allows a retry', () => {
    useUpdateStore.getState().set({ phase: 'needs-permission', info });
    const { unmount } = render(<UpdateBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('Erlaubnis');
    unmount();

    useUpdateStore.getState().set({ phase: 'error', code: 'backup-failed', info });
    render(<UpdateBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('Sicherungskopie');
    expect(screen.getByRole('button', { name: t.update.retry })).toBeEnabled();
  });
});
