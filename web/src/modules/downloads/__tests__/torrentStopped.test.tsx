// @vitest-environment jsdom
/**
 * DL2: an engine stopped outside the page (tray, closing into the tray when idle) is not started
 * again by itself: the page says so and waits for a click.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatform, setPlatform } from '@/core/platform';
import { createFakeTorrent } from '@/core/platform/fakeTorrent';
import { t } from '@/strings';
import { resetDevicePrefsCache, setDevicePrefs } from '../devicePrefs';
import { clearStopped, useTorrents } from '../torrentStore';
import { settings, type DownloadsPrefs } from '../settings';
import { TorrentSection } from '../routes/TorrentSection';

beforeEach(() => {
  localStorage.clear();
  resetDevicePrefsCache();
  clearStopped();
});
afterEach(() => setPlatform(undefined));

describe('torrent stopped outside the page', () => {
  it('shows "angehalten" and starts again only on a click', async () => {
    let stopped: (() => void) | undefined;
    const fake = createFakeTorrent();
    setPlatform({
      ...getPlatform(),
      torrent: {
        ...fake,
        supported: true,
        onStopped: (cb) => {
          stopped = cb;
          return () => undefined;
        },
      },
    });
    setDevicePrefs({ torrent: true });
    render(
      <TorrentSection
        prefs={settings.defaults as DownloadsPrefs}
        incoming={null}
        onIncomingHandled={() => {}}
      />,
    );
    expect(stopped).toBeDefined();
    act(() => stopped!());
    expect(screen.getByText(t.downloads.torrent.stopped)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: t.downloads.torrent.add.button }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // the stop survives leaving the page: nothing starts by itself
    expect(useTorrents.getState().stopped).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t.downloads.torrent.restart }));
    expect(screen.queryByText(t.downloads.torrent.stopped)).toBeNull();
    expect(useTorrents.getState().stopped).toBe(false);
  });

  it('a stop made while the page was away holds: the engine answers "stopped"', async () => {
    const configure = vi.fn(async () => {
      throw new Error('stopped');
    });
    setPlatform({
      ...getPlatform(),
      torrent: { ...createFakeTorrent(), supported: true, configure },
    });
    setDevicePrefs({ torrent: true });
    render(
      <TorrentSection
        prefs={settings.defaults as DownloadsPrefs}
        incoming={null}
        onIncomingHandled={() => {}}
      />,
    );
    await vi.waitFor(() => expect(configure).toHaveBeenCalledOnce());
    expect((configure.mock.calls[0] as unknown as [{ resume?: boolean }])[0].resume).toBe(false);
    // the page shows the stop and waits for a click
    expect(await screen.findByText(t.downloads.torrent.stopped)).toBeTruthy();
    // a click asks Rust to end the hold
    fireEvent.click(screen.getByRole('button', { name: t.downloads.torrent.restart }));
    await vi.waitFor(() => expect(configure).toHaveBeenCalledTimes(2));
    expect((configure.mock.calls[1] as unknown as [{ resume?: boolean }])[0].resume).toBe(true);
  });
});
