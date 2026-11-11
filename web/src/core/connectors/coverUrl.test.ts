import { describe, expect, it } from 'vitest';
import { coverCandidates, isCoverUrl, pickCover } from './coverUrl';

const ID = 'ab67616d00001e02ff9ca10b55ce82ae553c8228';
const MOSAIC_IDS = `${ID}${ID}${ID}${ID}`;

describe('cover host rule', () => {
  it.each([
    `https://i.scdn.co/image/${ID}`,
    'https://i.scdn.co/image/ab67706f00000002c782f5168b6e9face57c7266',
    'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da846a4e437aa6c2a667a6e7fd46',
    'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000da84a71574a2e9bd0e5dacd14eea',
    `https://mosaic.scdn.co/640/${MOSAIC_IDS}`,
    `https://mosaic.scdn.co/300/${MOSAIC_IDS}`,
    `https://mosaic.scdn.co/60/${MOSAIC_IDS}`,
  ])('accepts %s', (url) => {
    expect(isCoverUrl(url)).toBe(true);
  });

  it.each([
    // Other hosts, also Spotify's own that are not on the list.
    'https://evil.test/image/ab67616d',
    `https://pickasso.spotifycdn.com/image/${ID}`,
    `https://charts-images.scdn.co/image/${ID}`,
    `https://scdn.co/image/${ID}`,
    `https://spotifycdn.com/image/${ID}`,
    // Look-alike domains and sub-domain tricks.
    `https://i.scdn.co.evil.tld/image/${ID}`,
    `https://evil.tld/i.scdn.co/image/${ID}`,
    `https://xi.scdn.co/image/${ID}`,
    `https://i-scdn.co/image/${ID}`,
    `https://iXscdn.co/image/${ID}`,
    `https://a.i.scdn.co/image/${ID}`,
    `https://image-cdn-ak.spotifycdn.com.evil.tld/image/${ID}`,
    `https://image-cdn-akx.spotifycdn.com/image/${ID}`,
    `https://image-cdn-a.spotifycdn.com/image/${ID}`,
    `https://image-cdn-AK.spotifycdn.com/image/${ID}`,
    `https://image-cdn-a1.spotifycdn.com/image/${ID}`,
    `https://image-cdn-.spotifycdn.com/image/${ID}`,
    `https://x.image-cdn-ak.spotifycdn.com/image/${ID}`,
    `https://mosaic.scdn.co.evil.tld/640/${MOSAIC_IDS}`,
    // Scheme, user info, port.
    `http://i.scdn.co/image/${ID}`,
    `HTTPS://i.scdn.co/image/${ID}`,
    `//i.scdn.co/image/${ID}`,
    `https://user@i.scdn.co/image/${ID}`,
    `https://user:pw@i.scdn.co/image/${ID}`,
    `https://i.scdn.co@evil.tld/image/${ID}`,
    `https://evil.tld@i.scdn.co/image/${ID}`,
    `https://i.scdn.co:443/image/${ID}`,
    `https://i.scdn.co:8443/image/${ID}`,
    // Path tricks.
    `https://i.scdn.co/image/../${ID}`,
    `https://i.scdn.co/image/${ID}/..`,
    `https://i.scdn.co/image/${ID}/extra`,
    `https://i.scdn.co/image/%2e%2e/${ID}`,
    `https://i.scdn.co/image//${ID}`,
    `https://i.scdn.co/other/${ID}`,
    `https://i.scdn.co/image/`,
    `https://i.scdn.co/image/${ID}@evil.tld`,
    `https://i.scdn.co\\@evil.tld/image/${ID}`,
    `https://mosaic.scdn.co/1024/${MOSAIC_IDS}`,
    `https://mosaic.scdn.co/640/../${MOSAIC_IDS}`,
    `https://mosaic.scdn.co/image/${ID}`,
    `https://image-cdn-ak.spotifycdn.com/640/${ID}`,
    // Query, fragment, whitespace.
    `https://i.scdn.co/image/${ID}?x=1`,
    `https://i.scdn.co/image/${ID}?`,
    `https://i.scdn.co/image/${ID}#x`,
    `https://i.scdn.co/image/${ID}\n`,
    ` https://i.scdn.co/image/${ID}`,
    `https://i.scdn.co/image/${ID} `,
    `https://evil.tld/\nhttps://i.scdn.co/image/${ID}`,
    // Not a URL at all, or absurdly long.
    '',
    `https://i.scdn.co/image/${'a'.repeat(81)}`,
    `https://mosaic.scdn.co/640/${'a'.repeat(201)}`,
  ])('rejects %j', (url) => {
    expect(isCoverUrl(url)).toBe(false);
  });

  it('rejects anything that is not a string', () => {
    for (const value of [undefined, null, 5, {}, [`https://i.scdn.co/image/${ID}`]])
      expect(isCoverUrl(value)).toBe(false);
  });
});

describe('cover sizes', () => {
  const album = [
    { url: 'https://i.scdn.co/image/large640', width: 640 },
    { url: 'https://i.scdn.co/image/mid300', width: 300 },
    { url: 'https://i.scdn.co/image/small64', width: 64 },
  ];

  it('picks the smallest picture that still fills the surface, else the largest', () => {
    expect(pickCover(album)).toBe('https://i.scdn.co/image/small64');
    expect(pickCover(album, 64)).toBe('https://i.scdn.co/image/small64');
    expect(pickCover(album, 65)).toBe('https://i.scdn.co/image/mid300');
    expect(pickCover(album, 300)).toBe('https://i.scdn.co/image/mid300');
    expect(pickCover(album, 400)).toBe('https://i.scdn.co/image/large640');
    expect(pickCover(album, 2000)).toBe('https://i.scdn.co/image/large640');
  });

  it('a mosaic has fixed sizes: its width is read from the path when the service leaves it out', () => {
    const mosaic = [640, 300, 60].map((w) => ({
      url: `https://mosaic.scdn.co/${w}/${MOSAIC_IDS}`,
      width: null,
    }));
    expect(coverCandidates(mosaic)!.map((c) => c.width)).toEqual([640, 300, 60]);
    expect(pickCover(mosaic, 64)).toBe(`https://mosaic.scdn.co/300/${MOSAIC_IDS}`);
    expect(pickCover(mosaic, 400)).toBe(`https://mosaic.scdn.co/640/${MOSAIC_IDS}`);
  });

  it('an uploaded playlist picture comes alone and without a size: it is the one', () => {
    const own = [{ url: `https://image-cdn-ak.spotifycdn.com/image/${ID}`, width: null }];
    expect(pickCover(own, 64)).toBe(own[0]!.url);
    expect(pickCover(own, 640)).toBe(own[0]!.url);
    expect(coverCandidates(own)).toEqual([{ url: own[0]!.url }]);
  });

  it('drops every size that fails the host rule, and keeps at most six', () => {
    const mixed = [{ url: 'https://evil.test/image/x', width: 64 }, ...album];
    expect(pickCover(mixed, 64)).toBe('https://i.scdn.co/image/small64');
    expect(coverCandidates([{ url: 'https://evil.test/image/x', width: 64 }])).toBeUndefined();
    expect(pickCover([{ url: 'https://evil.test/image/x', width: 64 }])).toBeUndefined();
    expect(pickCover(undefined)).toBeUndefined();
    const many = Array.from({ length: 20 }, (_, i) => ({
      url: `https://i.scdn.co/image/n${i}`,
      width: 64,
    }));
    expect(coverCandidates(many)).toHaveLength(6);
  });
});
