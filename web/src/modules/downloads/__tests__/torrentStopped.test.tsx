// @vitest-environment jsdom
/**
 * DL2: an engine stopped outside the page (tray, closing into the tray when idle) is not started
 * again by itself: the page says so and waits for a click.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    // the stop survives leaving the page: nothing starts by itself
    expect(useTorrents.getState().stopped).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t.downloads.torrent.restart }));
    expect(screen.queryByText(t.downloads.torrent.stopped)).toBeNull();
    expect(useTorrents.getState().stopped).toBe(false);
  });
});
