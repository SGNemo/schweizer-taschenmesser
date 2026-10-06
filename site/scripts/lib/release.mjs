/**
 * Turns the GitHub "latest release" API answer into the small JSON the site renders
 * (src/release/latest.json). Pure, so it can be unit-tested with a fixture.
 */
export const ASSET_NAMES = { windows: 'Nemo-Portable.exe', android: 'Nemo.apk' };

/** @param {any} release GitHub release object @returns {ReleaseInfo} */
export function toReleaseInfo(release, fetchedAt = new Date()) {
  if (!release || typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) {
    throw new Error('unexpected release shape');
  }
  const assets = {};
  for (const [key, name] of Object.entries(ASSET_NAMES)) {
    const a = release.assets.find((x) => x && x.name === name && x.state === 'uploaded');
    if (!a || typeof a.size !== 'number') throw new Error(`asset ${name} missing in ${release.tag_name}`);
    const digest = typeof a.digest === 'string' && a.digest.startsWith('sha256:') ? a.digest.slice(7) : null;
    assets[key] = { name, size: a.size, sha256: digest && /^[0-9a-f]{64}$/.test(digest) ? digest : null };
  }
  return {
    version: release.tag_name.replace(/^v/, ''),
    tag: release.tag_name,
    publishedAt: String(release.published_at || release.created_at || '').slice(0, 10),
    fetchedAt: fetchedAt.toISOString(),
    assets,
  };
}

/** Minimal shape check for the committed fallback file. */
export function isReleaseInfo(x) {
  return (
    !!x &&
    typeof x.version === 'string' &&
    typeof x.tag === 'string' &&
    !!x.assets &&
    ['windows', 'android'].every(
      (k) => x.assets[k] && typeof x.assets[k].name === 'string' && typeof x.assets[k].size === 'number',
    )
  );
}

/**
 * @typedef {{ version: string, tag: string, publishedAt: string, fetchedAt: string,
 *   assets: Record<'windows'|'android', { name: string, size: number, sha256: string | null }> }} ReleaseInfo
 */
