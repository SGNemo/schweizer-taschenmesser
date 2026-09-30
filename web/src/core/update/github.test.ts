import { describe, expect, it, vi } from 'vitest';
import {
  assetUrl,
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
