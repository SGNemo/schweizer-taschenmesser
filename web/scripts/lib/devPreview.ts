/**
 * Dev-Preview builds: version string, Android version code and asset names of the rolling
 * `dev-preview` pre-release. Erasable TypeScript, used by `../dev-preview.mjs` and its unit test.
 *
 * The version is only computed at build time (package.json is never written):
 * `<next version>-dev.<commit count>`. With 0.3.1 as the last stable release, `0.3.2-dev.57` is greater
 * than `0.3.1` and every earlier preview and smaller than `0.3.2` (SemVer pre-release rule). The
 * identifier `dev` sorts after `beta` and before `rc`, which does not matter: the Dev-Preview app
 * only ever follows the Dev channel.
 */
import { compareSemver, parseSemver } from '../../src/core/update/semver.ts';

/** Tag of the rolling pre-release. Never matches `v*.*.*`, so the release workflow ignores it. */
export const DEV_TAG = 'dev-preview';

/** Everything a Dev-Preview carries (always the latest state only). */
export const DEV_ASSETS = [
  'Nemo-Portable-dev.exe',
  'Nemo-Portable-dev.exe.sig',
  'Nemo-dev.apk',
  'Nemo-dev.apk.sha256',
  'dev-latest.json',
] as const;

/** The portable exe `dev-latest.json` points at. */
export const DEV_PORTABLE_ASSET = 'Nemo-Portable-dev.exe';

/** Android versionCode ceiling (Android allows up to 2 100 000 000). */
const MAX_CODE = 2_100_000_000;

/** The version the next stable release will have: package.json, or one patch higher if `vX.Y.Z` exists. */
export function nextBaseVersion(pkgVersion: string, tags: readonly string[]): string {
  const v = parseSemver(pkgVersion);
  if (!v) throw new Error(`Not a valid SemVer version: "${pkgVersion}"`);
  const { major, minor } = v;
  let { patch } = v;
  const stable = new Set(tags.map((t) => t.trim()));
  // A pre-release in package.json (0.4.0-beta.1) is already "before" 0.4.0, no bump needed.
  if (v.prerelease.length === 0) {
    while (stable.has(`v${major}.${minor}.${patch}`)) patch++;
  }
  return `${major}.${minor}.${patch}`;
}

/** `X.Y.Z-dev.N` – the version baked into the Tauri config and the update manifest. */
export function devVersion(base: string, build: number): string {
  if (!Number.isInteger(build) || build < 1) throw new Error(`Invalid build number: ${build}`);
  const version = `${base}-dev.${build}`;
  if (!parseSemver(version)) throw new Error(`Not a valid SemVer version: "${version}"`);
  return version;
}

/** Version for display and release notes, with the short commit id as build metadata. */
export function devVersionFull(version: string, sha: string): string {
  const short = sha.trim().slice(0, 7);
  if (!/^[0-9a-f]{7}$/i.test(short)) throw new Error(`Invalid commit id: "${sha}"`);
  return `${version}+${short}`;
}

/**
 * Android `versionCode` of the Dev-Preview app: minutes since the epoch. The dev app has its own
 * package id, so it needs no relation to the stable codes, only to be strictly increasing over
 * time (a rebuild of the same commit later is still installable over the earlier one).
 */
export function devVersionCode(nowMs: number): number {
  const code = Math.floor(nowMs / 60_000);
  if (!Number.isFinite(code) || code < 1 || code > MAX_CODE) {
    throw new Error(`Dev versionCode out of range: ${code}`);
  }
  return code;
}

/** Is `candidate` a valid dev version that sorts after `previous`? Helper for tests and sanity checks. */
export const isDevNewer = (candidate: string, previous: string): boolean =>
  compareSemver(candidate, previous) === 1;

export const devAssetUrls = (repo: string, tag: string = DEV_TAG): string[] =>
  DEV_ASSETS.map((n) => `https://github.com/${repo}/releases/download/${tag}/${n}`);
