/**
 * The Tauri updater manifest (`latest.json`) attached to every release. Erasable TypeScript, used by
 * `../latest-json.mjs` and its unit test.
 */

export interface UpdaterFile {
  /** Asset name inside the release, e.g. `Taschenmesser-Setup.exe`. */
  fileName: string;
  /** Content of the matching `.sig` file (minisign signature made with the updater key). */
  signature: string;
}

export interface LatestJsonInput {
  /** SemVer without the leading "v". */
  version: string;
  notes: string;
  /** RFC 3339 timestamp. */
  pubDate: string;
  /** `owner/name` of the GitHub repository. */
  repo: string;
  /** Release tag, e.g. `v1.2.0`. */
  tag: string;
  nsis?: UpdaterFile;
  msi?: UpdaterFile;
}

export interface PlatformEntry {
  signature: string;
  url: string;
}

export interface LatestJson {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, PlatformEntry>;
}

/**
 * URLs point at the *versioned* download path of this release (`/releases/download/<tag>/…`), which
 * never changes, not at `/releases/latest/…`, which moves on with the next release.
 *
 * The updater looks for `<os>-<arch>-<installer>` first and falls back to `<os>-<arch>`; an app
 * installed with the NSIS setup keeps updating through NSIS, an MSI install through the MSI.
 */
export function buildLatestJson(input: LatestJsonInput): LatestJson {
  const base = `https://github.com/${input.repo}/releases/download/${input.tag}`;
  const entry = (file: UpdaterFile): PlatformEntry => ({
    signature: file.signature.trim(),
    url: `${base}/${encodeURIComponent(file.fileName)}`,
  });
  const platforms: Record<string, PlatformEntry> = {};
  const primary = input.nsis ?? input.msi;
  if (!primary)
    throw new Error('latest.json needs at least one Windows installer with a signature');
  platforms['windows-x86_64'] = entry(primary);
  if (input.nsis) platforms['windows-x86_64-nsis'] = entry(input.nsis);
  if (input.msi) platforms['windows-x86_64-msi'] = entry(input.msi);
  for (const [name, p] of Object.entries(platforms)) {
    if (!p.signature) throw new Error(`Empty signature for ${name}`);
  }
  return {
    version: input.version,
    notes: input.notes.trim(),
    pub_date: input.pubDate,
    platforms,
  };
}
