/**
 * Covers come from the media service's own image hosts only; anything else is never fetched. Shared by the connector (which only
 * hands out matching URLs) and the cover loader of the music module (which checks again before fetching).
 *
 * Spotify serves pictures from three places, each with one known path shape (always `https`, no port, no query, no fragment):
 * - `i.scdn.co/image/<id>`: albums, tracks, artists, shows, episodes, and playlists made by Spotify;
 * - `image-cdn-<two letters>.spotifycdn.com/image/<id>`: a playlist picture its owner uploaded. Known today, and the two the
 *   connection catalogue lists: https://image-cdn-ak.spotifycdn.com and https://image-cdn-fa.spotifycdn.com;
 * - https://mosaic.scdn.co `/<60|300|640>/<ids>`: the four-album mosaic of a playlist without a picture of its own.
 */
const COVER_PATTERNS: readonly RegExp[] = [
  /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]{1,80}$/,
  /^https:\/\/image-cdn-[a-z]{2}\.spotifycdn\.com\/image\/[A-Za-z0-9]{1,80}$/,
  /^https:\/\/mosaic\.scdn\.co\/(?:60|300|640)\/[A-Za-z0-9]{1,200}$/,
];
const MOSAIC_WIDTH = /^https:\/\/mosaic\.scdn\.co\/(\d+)\//;
const MAX_URL = 300;
/** A service lists three sizes per picture; more than this is not a cover list. */
const MAX_CANDIDATES = 6;

export function isCoverUrl(url: unknown): url is string {
  return (
    typeof url === 'string' && url.length <= MAX_URL && COVER_PATTERNS.some((p) => p.test(url))
  );
}

/** One size of a picture. `width` is absent when the service does not say (uploaded playlist pictures). */
export interface CoverImage {
  url: string;
  width?: number;
}

/** The sizes of one picture that pass the host rule, in the service's order; a mosaic's width is read from its path. */
export function coverCandidates(
  images: readonly { url: string; width?: number | null }[] | null | undefined,
): CoverImage[] | undefined {
  const out: CoverImage[] = [];
  for (const image of images ?? []) {
    if (out.length >= MAX_CANDIDATES) break;
    if (!isCoverUrl(image.url)) continue;
    const mosaic = MOSAIC_WIDTH.exec(image.url)?.[1];
    const width = image.width ?? (mosaic ? Number(mosaic) : undefined);
    out.push(width && width > 0 ? { url: image.url, width } : { url: image.url });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * The picture for a surface that is `minWidth` device pixels wide: the smallest one that is at least that wide, else the one of
 * unknown size (the service lists it alone), else the largest. Never a URL that fails the host rule.
 */
export function pickCover(
  images: readonly { url: string; width?: number | null }[] | null | undefined,
  minWidth = 64,
): string | undefined {
  const ok = coverCandidates(images) ?? [];
  const known = ok
    .filter((i): i is Required<CoverImage> => i.width !== undefined)
    .sort((a, b) => a.width - b.width);
  const fits = known.find((i) => i.width >= minWidth);
  return (fits ?? ok.find((i) => i.width === undefined) ?? known[known.length - 1])?.url;
}

/** Above two device pixels per CSS pixel a cover gains nothing visible, only bytes. */
const MAX_DENSITY = 2;

/** Device pixels a surface of `cssPx` needs on this screen. */
export function coverNeed(cssPx: number): number {
  const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.ceil(cssPx * Math.min(MAX_DENSITY, Math.max(1, ratio)));
}
