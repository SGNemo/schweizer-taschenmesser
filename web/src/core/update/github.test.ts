import { describe, expect, it, vi } from 'vitest';
import {
  DEV_APK_PAIR,
  DEV_MANIFEST_URL,
  assetUrl,
  fetchDevManifest,
  fetchReleases,
  isTrustedAssetUrl,
  parseSha256,
  pickUpdate,
  type Release,
} from './github';

const asset = (name: string, tag: string) => ({
  name,
  browser_download_url: `https://github.com/SGNemo/schweizer-taschenmesser/releases/download/${tag}/${name}`,
});
const rel = (tag: string, over: Partial<Release> = {}): Release => ({
  tag_name: tag,
  body: `notes of ${tag}`,
  draft: false,
  prerelease: tag.includes('-'),
  published_at: '2026-10-01T00:00:00Z',
  assets: [asset('Taschenmesser.apk', tag), asset('latest.json', tag)],
  ...over,
});

describe('fetchDevManifest', () => {
  const json = (body: unknown, status = 200) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('reads version and notes from the rolling release', async () => {
    const fetchFn = json({ version: '0.3.2-dev.57', notes: 'n', platforms: {} });
    await expect(fetchDevManifest(fetchFn)).resolves.toEqual({
      version: '0.3.2-dev.57',
      notes: 'n',
    });
    expect(vi.mocked(fetchFn).mock.calls[0]![0]).toBe(DEV_MANIFEST_URL);
    expect(DEV_MANIFEST_URL).toContain('/releases/download/dev-preview/dev-latest.json');
  });
  it('rejects bad versions and HTTP errors', async () => {
    await expect(fetchDevManifest(json({ version: 'nightly' }))).rejects.toThrow();
    await expect(fetchDevManifest(json({}, 404))).rejects.toThrow();
  });
  it('dev downloads pass the trusted-URL check', () => {
    expect(isTrustedAssetUrl(DEV_APK_PAIR.apk)).toBe(true);
    expect(isTrustedAssetUrl(DEV_APK_PAIR.sha256)).toBe(true);
  });
});

describe('pickUpdate', () => {
  const releases = [
    rel('v1.0.0'),
    rel('v1.1.0-beta.2'),
    rel('v1.1.0-beta.1'),
    rel('v0.9.0'),
    rel('v1.2.0', { draft: true }),
    rel('nightly'),
  ];

  it('offers stable users only newer stable releases', () => {
    expect(pickUpdate(releases, 'stable', '0.9.0')?.tag_name).toBe('v1.0.0');
    expect(pickUpdate(releases, 'stable', '1.0.0')).toBeUndefined(); // the pre-releases are not for them
  });

  it('offers beta users the newest version of any kind', () => {
    expect(pickUpdate(releases, 'beta', '1.0.0')?.tag_name).toBe('v1.1.0-beta.2');
    expect(pickUpdate(releases, 'beta', '1.1.0-beta.1')?.tag_name).toBe('v1.1.0-beta.2');
    expect(pickUpdate(releases, 'beta', '1.1.0-beta.2')).toBeUndefined();
  });

  it('lets a stable release reach beta users who are on its beta', () => {
    const list = [rel('v1.1.0'), rel('v1.1.0-beta.3')];
    expect(pickUpdate(list, 'beta', '1.1.0-beta.3')?.tag_name).toBe('v1.1.0');
  });

  it('ignores drafts and tags that are not SemVer, never downgrades', () => {
    expect(pickUpdate([rel('v1.2.0', { draft: true })], 'beta', '1.0.0')).toBeUndefined();
    expect(pickUpdate([rel('release-2026')], 'beta', '0.1.0')).toBeUndefined();
    expect(pickUpdate([rel('v0.5.0')], 'stable', '1.0.0')).toBeUndefined();
  });

  it('never offers the rolling dev-preview release, on any channel and whatever its flags', () => {
    const dev = [
      rel('dev-preview', { prerelease: true }),
      rel('dev-preview', { prerelease: false }),
      rel('dev-preview-test', { prerelease: true }),
    ];
    for (const channel of ['stable', 'beta'] as const) {
      expect(pickUpdate(dev, channel, '0.0.1')).toBeUndefined();
      expect(pickUpdate([...dev, rel('v1.0.0')], channel, '0.0.1')?.tag_name).toBe('v1.0.0');
    }
  });

  it('picks by SemVer precedence, not by list order or text', () => {
    const list = [rel('v1.9.0'), rel('v1.10.0'), rel('v1.2.0')];
    expect(pickUpdate(list, 'stable', '1.0.0')?.tag_name).toBe('v1.10.0');
  });
});

describe('assets', () => {
  it('trusts only release downloads of this repository over https', () => {
    const ok = 'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/v1/x.apk';
    expect(isTrustedAssetUrl(ok)).toBe(true);
    for (const bad of [
      ok.replace('https', 'http'),
      'https://evil.example/SGNemo/schweizer-taschenmesser/releases/download/v1/x.apk',
      'https://github.com/other/repo/releases/download/v1/x.apk',
      'https://github.com/SGNemo/schweizer-taschenmesser/archive/main.zip',
      'https://user@github.com/SGNemo/schweizer-taschenmesser/releases/download/v1/x.apk',
      'https://github.com/SGNemo/schweizer-taschenmesser/releases/download/../../evil/x.apk',
      'not a url',
    ]) {
      expect(isTrustedAssetUrl(bad), bad).toBe(false);
    }
  });

  it('finds an asset by name and rejects untrusted URLs', () => {
    const r = rel('v1.0.0');
    expect(assetUrl(r, 'Taschenmesser.apk')).toContain('/download/v1.0.0/Taschenmesser.apk');
    expect(assetUrl(r, 'missing')).toBeUndefined();
    const tampered = {
      ...r,
      assets: [{ name: 'Taschenmesser.apk', browser_download_url: 'https://evil.example/x.apk' }],
    };
    expect(assetUrl(tampered, 'Taschenmesser.apk')).toBeUndefined();
  });

  it('parses sha256sum output and bare hashes', () => {
    const hash = 'ab'.repeat(32);
    expect(parseSha256(`${hash}  Taschenmesser.apk\n`)).toBe(hash);
    expect(parseSha256(hash.toUpperCase())).toBe(hash);
    expect(parseSha256('nope')).toBeUndefined();
    expect(parseSha256('ab12  file')).toBeUndefined();
    expect(parseSha256('')).toBeUndefined();
  });
});

describe('fetchReleases', () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('validates releases and skips entries that are not releases', async () => {
    const fetchMock = vi.fn(async () => json([rel('v1.0.0'), { nonsense: true }, rel('v1.1.0')]));
    const list = await fetchReleases(fetchMock as unknown as typeof fetch);
    expect(list.map((r) => r.tag_name)).toEqual(['v1.0.0', 'v1.1.0']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('api.github.com/repos/SGNemo/schweizer-taschenmesser/releases');
    expect((init.headers as Record<string, string>).accept).toContain('github');
  });

  it('fails on HTTP errors and unexpected bodies', async () => {
    await expect(
      fetchReleases((async () => json({}, 403)) as unknown as typeof fetch),
    ).rejects.toThrow(/403/);
    await expect(
      fetchReleases((async () => json({ message: 'x' })) as unknown as typeof fetch),
    ).rejects.toThrow(/Unexpected/);
  });
});
