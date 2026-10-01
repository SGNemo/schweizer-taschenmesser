// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getVersion: vi.fn(async () => '1.2.3'),
  writeText: vi.fn(async (_t: string) => undefined),
  readText: vi.fn(async () => 'clip'),
  clear: vi.fn(async () => undefined),
  save: vi.fn(async (_o: unknown): Promise<string | null> => '/tmp/out.json'),
  writeFile: vi.fn(async (_p: string, _d: Uint8Array, _o?: unknown) => undefined),
  mkdir: vi.fn(async (_p: string, _o?: unknown) => undefined),
  readDir: vi.fn(async (_p: string, _o?: unknown) => [] as { name: string; isFile: boolean }[]),
  remove: vi.fn(async (_p: string, _o?: unknown) => undefined),
  nativeFetch: vi.fn(async (_i: unknown, _init?: unknown) => new Response('native')),
  isPermissionGranted: vi.fn(async () => false),
  requestPermission: vi.fn(async () => 'granted' as string),
  sendNotification: vi.fn(),
  pending: vi.fn(async () => [] as { id: number }[]),
  cancel: vi.fn(async (_ids: number[]) => undefined),
  openUrl: vi.fn(async (_u: string) => undefined),
}));

vi.mock('@tauri-apps/api/app', () => ({ getVersion: mocks.getVersion }));
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: mocks.writeText,
  readText: mocks.readText,
  clear: mocks.clear,
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocks.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 14 },
  writeFile: mocks.writeFile,
  mkdir: mocks.mkdir,
  readDir: mocks.readDir,
  remove: mocks.remove,
}));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: mocks.nativeFetch }));
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: mocks.isPermissionGranted,
  requestPermission: mocks.requestPermission,
  sendNotification: mocks.sendNotification,
  pending: mocks.pending,
  cancel: mocks.cancel,
  Schedule: {
    at: (date: Date, repeating: boolean, allowWhileIdle: boolean) => ({
      at: { date, repeating, allowWhileIdle },
    }),
  },
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }));

import { createTauriPlatform, notificationId } from './index';

beforeEach(() => {
  vi.restoreAllMocks(); // spies such as the faked user agent
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

  it('only the Android app schedules notifications with the OS', async () => {
    expect((await createTauriPlatform()).notifications.scheduleUpcoming).toBeUndefined();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14)');
    expect((await createTauriPlatform()).notifications.scheduleUpcoming).toBeTypeOf('function');
  });

  it('replaces the pending OS notifications: cancels stale ones, (re)schedules the wanted', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14)');
    const keep = notificationId('rem:1');
    mocks.pending.mockResolvedValue([{ id: keep }, { id: 111 }, { id: 222 }]);
    const p = await createTauriPlatform();
    await p.notifications.scheduleUpcoming!([
      { key: 'rem:1', at: 1_800_000_000_000, title: 'Miete', body: 'heute', url: '/reminders' },
      { key: 'inv:2', at: 1_800_000_100_000, title: 'Rechnung' },
    ]);
    expect(mocks.cancel).toHaveBeenCalledWith([111, 222]);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    expect(mocks.sendNotification).toHaveBeenCalledWith({
      id: keep,
      title: 'Miete',
      body: 'heute',
      schedule: {
        at: { date: new Date(1_800_000_000_000), repeating: false, allowWhileIdle: true },
      },
      extra: { url: '/reminders' },
      icon: 'ic_notification',
      iconColor: '#E0550F',
    });
  });

  it('Android notifications carry the monochrome status-bar icon, desktop ones do not', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14)');
    const p = await createTauriPlatform();
    await p.notifications.show({ title: 'Miete', body: 'heute', tag: 'k' });
    expect(mocks.sendNotification).toHaveBeenCalledWith({
      title: 'Miete',
      body: 'heute',
      icon: 'ic_notification',
      iconColor: '#E0550F',
    });
  });

  it('derives stable, distinct 31-bit ids', () => {
    expect(notificationId('a')).toBe(notificationId('a'));
    expect(notificationId('a')).not.toBe(notificationId('b'));
    for (const k of ['x', 'reminders:1234:2026-10-01', 'ü']) {
      const id = notificationId(k);
      expect(Number.isInteger(id) && id >= 0 && id <= 0x7fffffff).toBe(true);
    }
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

  it('keeps app files in the private data folder (creating the folder, listing only files)', async () => {
    const p = await createTauriPlatform();
    await p.files.write('backups/a.json', 'x');
    expect(mocks.mkdir).toHaveBeenCalledWith('backups', { baseDir: 14, recursive: true });
    expect(mocks.writeFile).toHaveBeenCalledWith('backups/a.json', expect.anything(), {
      baseDir: 14,
    });

    mocks.readDir.mockResolvedValue([
      { name: 'a.json', isFile: true },
      { name: 'sub', isFile: false },
    ]);
    expect(await p.files.list('backups')).toEqual(['a.json']);
    mocks.readDir.mockRejectedValue(new Error('missing'));
    expect(await p.files.list('backups')).toEqual([]);

    await p.files.remove('backups/a.json');
    expect(mocks.remove).toHaveBeenCalledWith('backups/a.json', { baseDir: 14 });
  });

  it('is wired to the desktop or Android updater', async () => {
    expect((await createTauriPlatform()).updater.supported).toBe(true);
  });

  it('reports the app version and opens links via the opener plugin', async () => {
    const p = await createTauriPlatform();
    expect(await p.app.version()).toBe('1.2.3');
    await p.app.openUrl('https://example.com');
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com');
  });
});
