import type { Page } from '@playwright/test';
import { CORS } from './spotify-mock';

/** Invented picture ids in the shapes the Web API returns (40 hex characters; a mosaic strings four together). */
const hexId = (seed: string) =>
  Array.from({ length: 40 }, (_, i) =>
    ((seed.charCodeAt(i % seed.length) + i * 7) % 16).toString(16),
  ).join('');
export const COVER = {
  album: (seed: string, width: 640 | 300 | 64) =>
    `https://i.scdn.co/image/${hexId(`${seed}${width}`)}`,
  mosaic: (seed: string, width: 640 | 300 | 60) =>
    `https://mosaic.scdn.co/${width}/${[1, 2, 3, 4].map((n) => hexId(`${seed}${n}`)).join('')}`,
  uploaded: (seed: string, cdn: 'ak' | 'fa' = 'ak') =>
    `https://image-cdn-${cdn}.spotifycdn.com/image/${hexId(seed)}`,
  foreign: 'https://covers.evil.test/image/ab67616d0000b273',
};
export const albumImages = (seed: string) =>
  ([640, 300, 64] as const).map((width) => ({ url: COVER.album(seed, width), width }));
export const mosaicImages = (seed: string) =>
  ([640, 300, 60] as const).map((width) => ({ url: COVER.mosaic(seed, width), width }));

const COVER_HOSTS = [
  'i.scdn.co',
  'mosaic.scdn.co',
  'image-cdn-ak.spotifycdn.com',
  'image-cdn-fa.spotifycdn.com',
  'covers.evil.test',
];
function picture(url: string): string {
  let n = 0;
  for (const c of url) n = (n * 31 + c.charCodeAt(0)) % 360;
  const tile = (x: number, y: number, hue: number) =>
    `<rect x="${x}" y="${y}" width="50" height="50" fill="hsl(${hue} 45% 50%)"/>`;
  const body = url.includes('mosaic')
    ? tile(0, 0, n) + tile(50, 0, n + 80) + tile(0, 50, n + 160) + tile(50, 50, n + 240)
    : `<rect width="100" height="100" fill="hsl(${n} 45% 45%)"/><circle cx="50" cy="50" r="26" fill="hsl(${n + 40} 60% 70%)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
}

/**
 * Answers picture requests with an invented picture per URL (its colour follows the URL), for the hosts the app may ask and for one
 * it may not. Returns every picture request that left the app (full URL), whatever the host.
 */
export async function mockCovers(page: Page): Promise<string[]> {
  const images: string[] = [];
  for (const host of COVER_HOSTS)
    await page.route(`https://${host}/**`, (route) => {
      const url = route.request().url();
      images.push(url);
      return route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'image/svg+xml',
        body: picture(url),
      });
    });
  return images;
}
