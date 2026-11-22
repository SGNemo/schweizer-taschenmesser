// @vitest-environment jsdom
/**
 * DL10: the torrent switch, DHT, UPnP and the default folder live on this device only. A synced
 * settings row (another device, a merged backup, the sync server) cannot turn them on.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPlatform, setPlatform } from '@/core/platform';
import { createFakeTorrent } from '@/core/platform/fakeTorrent';
import { t } from '@/strings';
import {
  DEVICE_DEFAULTS,
  readDevicePrefs,
  resetDevicePrefsCache,
  setDevicePrefs,
} from '../devicePrefs';
import { settings, type DownloadsPrefs } from '../settings';
import { TorrentSection } from '../routes/TorrentSection';

beforeEach(() => {
  localStorage.clear();
  resetDevicePrefsCache();
});
afterEach(() => setPlatform(undefined));

describe('downloads device prefs (DL10)', () => {
  it('the synced settings carry no switch, DHT, UPnP or folder', () => {
    const synced = settings.schema.parse({
      ...settings.defaults,
      torrent: true,
      torrentDht: true,
      torrentUpnp: true,
      folder:
        'C:\\\\Users\\\\x\\\\AppData\\\\Roaming\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\Startup',
    }) as Record<string, unknown>;
    for (const key of ['torrent', 'torrentDht', 'torrentUpnp', 'folder']) {
      expect(synced).not.toHaveProperty(key);
      expect(settings.fields.map((f) => f.key)).not.toContain(key);
    }
  });

  it('device prefs default to off and are kept under a tm- key (cleared by the reset)', () => {
    expect(readDevicePrefs()).toEqual(DEVICE_DEFAULTS);
    setDevicePrefs({ torrent: true, upnp: true, folder: '/home/x/Filme' });
    resetDevicePrefsCache();
    expect(readDevicePrefs()).toEqual({
      torrent: true,
      dht: true,
      upnp: true,
      folder: '/home/x/Filme',
    });
    expect(Object.keys(localStorage).every((k) => k.startsWith('tm-'))).toBe(true);
  });

  it('a broken stored value falls back to the safe defaults', () => {
    localStorage.setItem('tm-downloads-device', '{"torrent":"yes","upnp":1');
    resetDevicePrefsCache();
    expect(readDevicePrefs()).toEqual(DEVICE_DEFAULTS);
  });

  it('the torrent part stays off on this device whatever the synced row says', () => {
    setPlatform({ ...getPlatform(), torrent: { ...createFakeTorrent(), supported: true } });
    render(
      <TorrentSection
        prefs={
          { ...settings.defaults, torrent: true, torrentUpnp: true } as unknown as DownloadsPrefs
        }
        incoming={null}
        onIncomingHandled={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: t.downloads.torrent.off.title })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.downloads.torrent.off.turnOn })).toBeTruthy();
  });
});
