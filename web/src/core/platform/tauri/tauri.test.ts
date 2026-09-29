import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getVersion: vi.fn(async () => '1.2.3'),
  writeText: vi.fn(async (_t: string) => undefined),
  readText: vi.fn(async () => 'clip'),
  clear: vi.fn(async () => undefined),
  save: vi.fn(async (_o: unknown): Promise<string | null> => '/tmp/out.json'),
  writeFile: vi.fn(async (_p: string, _d: Uint8Array) => undefined),
  nativeFetch: vi.fn(async (_i: unknown, _init?: unknown) => new Response('native')),
  isPermissionGranted: vi.fn(async () => false),
  requestPermission: vi.fn(async () => 'granted' as string),
  sendNotification: vi.fn(),
  openUrl: vi.fn(async (_u: string) => undefined),
}));

vi.mock('@tauri-apps/api/app', () => ({ getVersion: mocks.getVersion }));
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: mocks.writeText,
  readText: mocks.readText,
  clear: mocks.clear,
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocks.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: mocks.writeFile }));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: mocks.nativeFetch }));
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: mocks.isPermissionGranted,
  requestPermission: mocks.requestPermission,
  sendNotification: mocks.sendNotification,
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }));

import { createTauriPlatform } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isPermissionGranted.mockResolvedValue(false);
  mocks.requestPermission.mockResolvedValue('granted');
  mocks.save.mockResolvedValue('/tmp/out.json');
});

describe('tauri platform', () => {
  it('identifies as native desktop (Android from the user agent)', async () => {
    expect(await createTauriPlatform()).toMatchObject({ kind: 'desktop', isNative: true });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel 7)',
    );
    expect((await createTauriPlatform()).kind).toBe('android');
  });

  it('uses the native HTTP client (no CORS) for fetch', async () => {
    const p = await createTauriPlatform();
    const res = await p.fetch('https://api.example.com/x', { method: 'POST' });
    expect(await res.text()).toBe('native');
    expect(mocks.nativeFetch).toHaveBeenCalledWith('https://api.example.com/x', { method: 'POST' });
  });

  it('saves through the save dialog and writes bytes; cancelling writes nothing', async () => {
    const p = await createTauriPlatform();
    expect(
      await p.saveFile({ fileName: 'backup.json', data: '{"a":"ü"}', mime: 'application/json' }),
    ).toBe('saved');
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: 'backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    const [path, bytes] = mocks.writeFile.mock.calls[0] as [string, Uint8Array];
    expect(path).toBe('/tmp/out.json');
    expect(new TextDecoder().decode(bytes)).toBe('{"a":"ü"}');

    mocks.writeFile.mockClear();
    mocks.save.mockResolvedValue(null);
    expect(await p.saveFile({ fileName: 'x.bin', data: new Uint8Array([1]), mime: 'x' })).toBe(
      'cancelled',
    );
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it('writes Blobs as bytes and shows unknown extensions as their own filter', async () => {
    const p = await createTauriPlatform();
    await p.saveFile({
      fileName: 'scan.pdf',
      data: new Blob([new Uint8Array([9, 8, 7])]),
      mime: 'application/pdf',
    });
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: 'scan.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    expect([...(mocks.writeFile.mock.calls[0] as [string, Uint8Array])[1]]).toEqual([9, 8, 7]);
  });

  it('keeps a synchronous permission state that follows the plugin', async () => {
    const p = await createTauriPlatform();
    expect(p.notifications.permission()).toBe('default');
    expect(await p.notifications.requestPermission()).toBe('granted');
    expect(p.notifications.permission()).toBe('granted');
    mocks.requestPermission.mockResolvedValue('denied');
    expect(await p.notifications.requestPermission()).toBe('denied');

    mocks.isPermissionGranted.mockResolvedValue(true);
    expect((await createTauriPlatform()).notifications.permission()).toBe('granted');
  });

  it('shows notifications through the plugin', async () => {
    const p = await createTauriPlatform();
    await p.notifications.show({ title: 'Miete', body: 'heute', tag: 'k' });
    expect(mocks.sendNotification).toHaveBeenCalledWith({ title: 'Miete', body: 'heute' });
  });

  it('clears the clipboard through the plugin after the delay when unchanged', async () => {
    vi.useFakeTimers();
    try {
      const p = await createTauriPlatform();
      mocks.readText.mockResolvedValue('secret');
      await p.clipboard.writeSensitive('secret', 30_000);
      expect(mocks.writeText).toHaveBeenCalledWith('secret');
      await vi.advanceTimersByTimeAsync(30_001);
      expect(mocks.clear).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports the app version and opens links via the opener plugin', async () => {
    const p = await createTauriPlatform();
    expect(await p.app.version()).toBe('1.2.3');
    await p.app.openUrl('https://example.com');
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com');
  });
});
