/**
 * The Tauri updater manifest (`latest.json`) attached to every release. Erasable TypeScript, used by
 * `../latest-json.mjs` and its unit test.
 */

/**
 * The Windows asset `latest.json` points at. Clients since 0.3.0 accept this name (`update.rs`);
 * installations up to 0.2.x only knew the former `Taschenmesser-Portable.exe` and cannot self-update
 * to releases that no longer carry it (docs/DECISIONS.md).
 */
export const UPDATER_PORTABLE_ASSET = 'Nemo-Portable.exe';

export interface UpdaterFile {
  /** Asset name inside the release, e.g. `Nemo-Portable.exe`. */
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
  /** The portable Windows executable (the only Windows asset). */
  portable?: UpdaterFile;
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
 * The desktop app asks for the target `windows-x86_64-portable` explicitly. There is deliberately **no**
 * generic `windows-x86_64` entry: an app that is still installed with the old NSIS/MSI setup would
 * otherwise download the raw executable and try to run it as an installer.
 */
export function buildLatestJson(input: LatestJsonInput): LatestJson {
  const base = `https://github.com/${input.repo}/releases/download/${input.tag}`;
  if (!input.portable) throw new Error('latest.json needs the signed portable Windows executable');
  const signature = input.portable.signature.trim();
  if (!signature) throw new Error('Empty signature for windows-x86_64-portable');
  return {
    version: input.version,
    notes: input.notes.trim(),
    pub_date: input.pubDate,
    platforms: {
      'windows-x86_64-portable': {
        signature,
        url: `${base}/${encodeURIComponent(input.portable.fileName)}`,
      },
    },
  };
}
