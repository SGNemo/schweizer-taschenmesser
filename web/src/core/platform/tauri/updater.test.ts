import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class FakeChannel {
    onmessage: ((m: unknown) => void) | undefined;
  }
  return {
    invoke: vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => null),
    Channel: FakeChannel,
  };
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, Channel: mocks.Channel }));

import { createAndroidUpdater, createDesktopUpdater } from './updater';

const asset = (name: string, tag: string) => ({
  name,
  browser_download_url: `https://github.com/SGNemo/schweizer-taschenmesser/releases/download/${tag}/${name}`,
});
const release = (tag: string, assets: string[]) => ({
  tag_name: tag,
  body: `notes ${tag}`,
  draft: false,
  prerelease: tag.includes('-'),
  published_at: '2026-10-01T00:00:00Z',
  assets: assets.map((a) => asset(a, tag)),
});
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const HASH = 'cd'.repeat(32);

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.invoke.mockResolvedValue(null);
});

describe('desktop updater', () => {
  const noFetch = (async () => {
    throw new Error('no network expected');
  }) as unknown as typeof fetch;

  it('stable: asks the Rust side about the stable manifest', async () => {
    mocks.invoke.mockResolvedValue({ version: '1.1.0', notes: 'new stuff', date: '2026-10-01' });
    const info = await createDesktopUpdater(noFetch).check('stable', '1.0.0');
    expect(mocks.invoke).toHaveBeenCalledWith('check_update', {
      endpoint:
        'https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json',
    });
    expect(info).toEqual({
      version: '1.1.0',
      notes: 'new stuff',
      prerelease: false,
      publishedAt: '2026-10-01',
    });
  });

  it('beta: resolves the manifest of the newest release through the GitHub API', async () => {
    mocks.invoke.mockResolvedValue({ version: '1.1.0-beta.2' });
    const fetchMock = vi.fn(async () =>
      json([release('v1.1.0-beta.2', ['latest.json']), release('v1.0.0', ['latest.json'])]),
    );
    const info = await createDesktopUpdater(fetchMock as unknown as typeof fetch).check(
      'beta',
      '1.0.0',
    );
    expect(mocks.invoke).toHaveBeenCalledWith('check_update', {
      endpoint:
        'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1.1.0-beta.2/latest.json',
    });
    expect(info).toMatchObject({ version: '1.1.0-beta.2', prerelease: true });
  });

  it('reports no update when up to date, when nothing newer exists, or the plugin returns an older version', async () => {
    expect(await createDesktopUpdater(noFetch).check('stable', '1.0.0')).toBeUndefined(); // null
    mocks.invoke.mockResolvedValue({ version: '0.9.0' });
    expect(await createDesktopUpdater(noFetch).check('stable', '1.0.0')).toBeUndefined();
    mocks.invoke.mockClear();
    const empty = vi.fn(async () => json([release('v1.0.0', ['latest.json'])]));
    expect(
      await createDesktopUpdater(empty as unknown as typeof fetch).check('beta', '1.0.0'),
    ).toBeUndefined();
    expect(mocks.invoke).not.toHaveBeenCalledWith('check_update', expect.anything());
  });

  it('installs through the Rust command and reports download progress', async () => {
    let channel: InstanceType<typeof mocks.Channel> | undefined;
    mocks.invoke.mockImplementation(async (_cmd, args) => {
      channel = (args as { onEvent: InstanceType<typeof mocks.Channel> }).onEvent;
      channel.onmessage?.({ event: 'started', data: { contentLength: 100 } });
      channel.onmessage?.({ event: 'progress', data: { chunkLength: 40 } });
      channel.onmessage?.({ event: 'progress', data: { chunkLength: 60 } });
      channel.onmessage?.({ event: 'finished' });
      return null;
    });
    const seen: { downloaded: number; total: number }[] = [];
    const outcome = await createDesktopUpdater(noFetch).install(
      { version: '1.1.0', notes: '', prerelease: false },
      (p) => seen.push(p),
    );
    expect(outcome).toBe('restarting');
    expect(mocks.invoke).toHaveBeenCalledWith(
      'install_update',
      expect.objectContaining({ onEvent: expect.anything() as unknown }),
    );
    expect(seen.at(-1)).toEqual({ downloaded: 100, total: 100 });
  });
});

describe('android updater', () => {
  const list = (...rels: ReturnType<typeof release>[]) =>
    vi.fn(async () => json(rels)) as unknown as typeof fetch;

  it('offers releases that carry the APK and its checksum', async () => {
    const fetchFn = list(release('v1.1.0', ['Taschenmesser.apk', 'Taschenmesser.apk.sha256']));
    const info = await createAndroidUpdater(fetchFn).check('stable', '1.0.0');
    expect(info).toMatchObject({ version: '1.1.0', notes: 'notes v1.1.0', prerelease: false });
    expect(info?.payload).toEqual({
      apkUrl:
        'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1.1.0/Taschenmesser.apk',
      sha256Url:
        'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1.1.0/Taschenmesser.apk.sha256',
    });
  });

  it('does not offer a release without APK or checksum', async () => {
    expect(
      await createAndroidUpdater(list(release('v1.1.0', ['Taschenmesser-Setup.exe']))).check(
        'stable',
        '1.0.0',
      ),
    ).toBeUndefined();
    expect(
      await createAndroidUpdater(list(release('v1.1.0', ['Taschenmesser.apk']))).check(
        'stable',
        '1.0.0',
      ),
    ).toBeUndefined();
  });

  it('downloads with the expected checksum, then opens the installer', async () => {
    const fetchFn = vi.fn(
      async () => new Response(`${HASH}  Taschenmesser.apk\n`),
    ) as unknown as typeof fetch;
    mocks.invoke.mockImplementation(async (cmd) => {
      if (cmd === 'plugin:apk-installer|download')
        return { path: '/cache/updates/Taschenmesser-update.apk', sha256: HASH, size: 10 };
      if (cmd === 'plugin:apk-installer|install') return { status: 'started' };
      return { downloaded: 0, total: 0 };
    });
    const info = {
      version: '1.1.0',
      notes: '',
      prerelease: false,
      payload: { apkUrl: 'https://github.com/x/a.apk', sha256Url: 'https://github.com/x/a.sha256' },
    };
    expect(await createAndroidUpdater(fetchFn).install(info)).toBe('installer-opened');
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:apk-installer|download', {
      request: { url: 'https://github.com/x/a.apk', sha256: HASH },
    });
    expect(mocks.invoke).toHaveBeenCalledWith('plugin:apk-installer|install', {
      request: { path: '/cache/updates/Taschenmesser-update.apk' },
    });
  });

  it('asks for the install permission when Android requires it', async () => {
    const fetchFn = vi.fn(async () => new Response(HASH)) as unknown as typeof fetch;
    mocks.invoke.mockImplementation(async (cmd) =>
      cmd.endsWith('|download') ? { path: '/p' } : { status: 'needs-permission' },
    );
    const info = {
      version: '1.1.0',
      notes: '',
      prerelease: false,
      payload: { apkUrl: 'https://github.com/x/a.apk', sha256Url: 'https://github.com/x/a.sha256' },
    };
    expect(await createAndroidUpdater(fetchFn).install(info)).toBe('needs-permission');
  });

  it('refuses to download without a valid checksum', async () => {
    const info = {
      version: '1.1.0',
      notes: '',
      prerelease: false,
      payload: { apkUrl: 'https://github.com/x/a.apk', sha256Url: 'https://github.com/x/a.sha256' },
    };
    const bad = vi.fn(async () => new Response('not a hash')) as unknown as typeof fetch;
    await expect(createAndroidUpdater(bad).install(info)).rejects.toThrow(/checksum/);
    const missing = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(createAndroidUpdater(missing).install(info)).rejects.toThrow(/checksum/);
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      'plugin:apk-installer|download',
      expect.anything(),
    );
    await expect(
      createAndroidUpdater(bad).install({ ...info, payload: undefined }),
    ).rejects.toThrow(/download information/);
  });
});
