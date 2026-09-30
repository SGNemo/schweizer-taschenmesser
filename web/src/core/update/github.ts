/** Reading GitHub releases (for the beta channel and for Android updates). */
import { z } from 'zod';
import { compareSemver, isNewer, isPrerelease, parseSemver } from './semver';
import type { UpdateChannel } from './types';

export const REPO = 'SGNemo/schweizer-taschenmesser';
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases?per_page=30`;

export const STABLE_MANIFEST_URL = `https://github.com/${REPO}/releases/latest/download/latest.json`;
export const APK_ASSET = 'Taschenmesser.apk';
export const APK_SHA256_ASSET = 'Taschenmesser.apk.sha256';
export const MANIFEST_ASSET = 'latest.json';

const releaseSchema = z.object({
  tag_name: z.string(),
  body: z.string().nullish(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  published_at: z.string().nullish(),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.string() })),
});
export type Release = z.output<typeof releaseSchema>;

/** Downloads may only come from release assets of this repository. */
export function isTrustedAssetUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      !url.username &&
      !url.port &&
      url.pathname.startsWith(`/${REPO}/releases/download/`) &&
      !url.pathname.split('/').some((s) => s === '..')
    );
  } catch {
    return false;
  }
}

/** Fetches the latest releases; entries that do not look like releases are skipped, not fatal. */
export async function fetchReleases(fetchFn: typeof fetch): Promise<Release[]> {
  const res = await fetchFn(RELEASES_API, {
    headers: { accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GitHub answered HTTP ${res.status}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new Error('Unexpected GitHub response');
  return body.flatMap((entry) => {
    const parsed = releaseSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export const versionOf = (release: Pick<Release, 'tag_name'>): string =>
  release.tag_name.replace(/^v/, '');

/**
 * The newest release on the channel that is newer than `current`. Stable users only see releases
 * without a pre-release suffix; beta users see everything (so a stable release that follows their
 * beta reaches them too). Drafts and tags that are not SemVer are ignored.
 */
export function pickUpdate(
  releases: readonly Release[],
  channel: UpdateChannel,
  current: string,
): Release | undefined {
  return releases
    .filter((r) => !r.draft && parseSemver(r.tag_name))
    .filter((r) => channel === 'beta' || (!r.prerelease && !isPrerelease(versionOf(r))))
    .filter((r) => isNewer(versionOf(r), current))
    .sort((a, b) => compareSemver(versionOf(b), versionOf(a)))[0];
}

export function assetUrl(release: Release, name: string): string | undefined {
  const url = release.assets.find((a) => a.name === name)?.browser_download_url;
  return url && isTrustedAssetUrl(url) ? url : undefined;
}

/** `sha256sum` output ("<64 hex>  file") or a bare hash. */
export function parseSha256(text: string): string | undefined {
  return /^\s*([0-9a-fA-F]{64})(?:\s|$)/.exec(text)?.[1]?.toLowerCase();
}
