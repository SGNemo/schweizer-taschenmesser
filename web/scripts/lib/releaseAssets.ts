/**
 * The files every release carries. Single list for the release workflow, the post-release link check
 * (`../check-links.mjs`) and the test that keeps README links and this list in step. Erasable TypeScript.
 */
export const RELEASE_ASSETS = [
  'Taschenmesser-Portable.exe',
  'Taschenmesser-Portable.exe.sig',
  'Taschenmesser.apk',
  'Taschenmesser.apk.sha256',
  'latest.json',
] as const;

/** Names in `…/releases/latest/download/<name>` and `…/releases/download/<tag>/<name>` links of a text. */
export function releaseAssetNames(text: string): string[] {
  const names = new Set<string>();
  const re = /\/releases\/(?:latest\/download|download\/[^/\s)"']+)\/([^\s)"'?#]+)/g;
  for (const match of text.matchAll(re)) names.add(decodeURIComponent(match[1]!));
  return [...names];
}

/** Release download links in `text` that point to a file no release carries. */
export function unknownAssetLinks(text: string): string[] {
  const known = new Set<string>(RELEASE_ASSETS);
  return releaseAssetNames(text).filter((name) => !known.has(name));
}

/** URLs a finished release must serve; `latest` ones only exist for stable releases. */
export function assetUrls(repo: string, tag: string, opts: { stable: boolean }): string[] {
  const base = `https://github.com/${repo}/releases`;
  const versioned = RELEASE_ASSETS.map((name) => `${base}/download/${tag}/${encodeURIComponent(name)}`);
  const latest = opts.stable
    ? RELEASE_ASSETS.map((name) => `${base}/latest/download/${encodeURIComponent(name)}`)
    : [];
  return [...versioned, ...latest];
}
