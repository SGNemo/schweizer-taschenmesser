// @vitest-environment jsdom
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
    expect(screen.getByText('add Groq', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('ai:')).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument(); // as text
    expect(screen.getByText(/Version 1\.2\.0-beta\.1/)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: t.update.updateNow })).toBeEnabled();
  });

  it('lists the changes per Dev-Preview build, newest first, and marks the installed build', async () => {
    const platform = fakeNative();
    platform.app.version = async () => '1.0.0-dev.685+abc1234';
    const notes = [
      '## Build 686',
      '### Neu',
      '- **Kalender:** Feiertage in der Jahresansicht.',
      '',
      '## Build 685',
      '### Behoben',
      '- **Todos:** Tags werden gespeichert.',
      '',
      '## Build 684',
      '### Neu',
      '- **App:** Neuer Import.',
      '',
      '---',
      '',
      '## Build 686',
      '### Added',
      '- **Calendar:** Holidays.',
    ].join('\n');
    useUpdateStore
      .getState()
      .set({ phase: 'available', info: { ...info, version: '1.0.0-dev.686', notes } });
    render(<UpdateBanner />);
    // The installed build is read asynchronously; once known, older builds disappear.
    await vi.waitFor(() => {
      const titles = screen.getAllByText(/^Build \d+/).map((el) => el.textContent?.trim());
      expect(titles.map((x) => x?.replace(/\s*installiert$/, ''))).toEqual([
        'Build 686',
        'Build 685',
      ]);
    });
    expect(
      screen.getByText('Feiertage in der Jahresansicht.', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Holidays/)).toBeNull(); // the German block in a German app
    await vi.waitFor(() => expect(screen.getByText(t.about.changes.installed)).toBeInTheDocument());
    expect(screen.getByText(/^Build 685/).textContent).toContain(t.about.changes.installed);
  });

  it('shows every build since the installed one (it ends the list), newest first, and nothing older', () => {
    const platform = fakeNative();
    platform.app.version = async () => '1.0.0-dev.700+abc1234';
    const notes = Array.from({ length: 60 }, (_, i) => 740 - i) // builds 740 … 681
      .map((n) =>
        n % 2 === 0 ? `## Build ${n}\n### Neu\n- **App:** Eintrag ${n}.` : `## Build ${n}`,
      )
      .join('\n\n');
    useUpdateStore
      .getState()
      .set({ phase: 'available', info: { ...info, version: '1.0.0-dev.740', notes } });
    render(<UpdateBanner />);
    return vi.waitFor(() => {
      const titles = screen
        .getAllByText(/^Build \d+/)
        .map((el) => Number(/\d+/.exec(el.textContent ?? '')![0]));
      // 700 … 740: no cap, nothing older than the installed 700, the newest first.
      expect(titles).toHaveLength(41);
      expect(titles[0]).toBe(740);
      expect(titles.at(-1)).toBe(700);
      expect(Math.min(...titles)).toBe(700);
      expect(screen.queryByText(t.about.changes.showMore, { exact: false })).toBeNull();
      // A build without a note is one quiet line, not a card.
      expect(screen.getAllByText(new RegExp(t.about.changes.noChanges)).length).toBeGreaterThan(0);
    });
  });

  it('without a known installed build only the newest 10 builds show, the rest on request', async () => {
    const notes = Array.from({ length: 25 }, (_, i) => 740 - i)
      .map((n) => `## Build ${n}\n### Neu\n- **App:** Eintrag ${n}.`)
      .join('\n\n');
    useUpdateStore
      .getState()
      .set({ phase: 'available', info: { ...info, version: '1.0.0-dev.740', notes } });
    render(<UpdateBanner />);
    expect(screen.getAllByText(/^Build \d+/)).toHaveLength(10);
    await userEvent.setup().click(screen.getByRole('button', { name: /anzeigen \(15\)/ }));
    expect(screen.getAllByText(/^Build \d+/)).toHaveLength(25);
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
