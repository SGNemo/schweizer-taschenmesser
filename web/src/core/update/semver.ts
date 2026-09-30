/**
 * Minimal SemVer 2.0 helpers (parse, compare, Android version code). Written with erasable
 * TypeScript syntax only, so the release scripts can import this file straight from Node.
 */

export interface Semver {
  major: number;
  minor: number;
  patch: number;
  /** Dot separated identifiers after the hyphen; numeric ones are numbers. Empty for releases. */
  prerelease: (string | number)[];
}

const SEMVER_RE =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** "v1.2.3-beta.1+build" → parts; undefined when it is not valid SemVer. Build metadata is ignored. */
export function parseSemver(input: string): Semver | undefined {
  const m = SEMVER_RE.exec(input.trim());
  if (!m) return undefined;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [],
  };
}

export const isPrerelease = (v: string | Semver): boolean =>
  (typeof v === 'string' ? mustParse(v) : v).prerelease.length > 0;

function mustParse(v: string): Semver {
  const parsed = parseSemver(v);
  if (!parsed) throw new Error(`Not a valid SemVer version: "${v}"`);
  return parsed;
}

function compareIdentifiers(a: string | number, b: string | number): number {
  const an = typeof a === 'number';
  const bn = typeof b === 'number';
  if (an && bn) return a === b ? 0 : (a as number) < (b as number) ? -1 : 1;
  if (an) return -1; // numeric identifiers sort before alphanumeric ones
  if (bn) return 1;
  return a === b ? 0 : (a as string) < (b as string) ? -1 : 1;
}

/** SemVer precedence (§11): -1 if a < b, 0 if equal, 1 if a > b. */
export function compareSemver(a: string | Semver, b: string | Semver): -1 | 0 | 1 {
  const x = typeof a === 'string' ? mustParse(a) : a;
  const y = typeof b === 'string' ? mustParse(b) : b;
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
  }
  if (x.prerelease.length === 0 && y.prerelease.length === 0) return 0;
  if (x.prerelease.length === 0) return 1; // a release is newer than its pre-releases
  if (y.prerelease.length === 0) return -1;
  const n = Math.max(x.prerelease.length, y.prerelease.length);
  for (let i = 0; i < n; i++) {
    const p = x.prerelease[i];
    const q = y.prerelease[i];
    if (p === undefined) return -1; // fewer identifiers = lower precedence
    if (q === undefined) return 1;
    const c = compareIdentifiers(p, q);
    if (c !== 0) return c < 0 ? -1 : 1;
  }
  return 0;
}

/** Is `candidate` a newer version than `current`? */
export const isNewer = (candidate: string, current: string): boolean =>
  compareSemver(candidate, current) === 1;

const PRE_BASE: Record<string, number> = { alpha: 0, beta: 30, rc: 60 };
const PRE_SPAN = 29;
const STABLE_RANK = 99;

/**
 * Android `versionCode`: `((major*1000 + minor)*1000 + patch)*100 + rank`, where a release has rank
 * 99 and pre-releases rank below it (`alpha.N` 0–29, `beta.N` 30–59, `rc.N` 60–89). The order of
 * the codes equals SemVer precedence, so Android accepts `beta.2` over `beta.1` and the release
 * over both. Only those three labels are supported; anything else fails loudly instead of being
 * mis-ordered. Codes stay below Android's limit of 2 100 000 000 (major ≤ 20).
 */
export function androidVersionCode(version: string): number {
  const v = mustParse(version);
  if (v.major > 20 || v.minor > 999 || v.patch > 999) {
    throw new Error(`Version ${version} exceeds the Android versionCode range`);
  }
  let rank = STABLE_RANK;
  if (v.prerelease.length > 0) {
    const [label, num = 0, ...rest] = v.prerelease;
    if (
      typeof label !== 'string' ||
      !(label in PRE_BASE) ||
      typeof num !== 'number' ||
      rest.length > 0
    ) {
      throw new Error(
        `Pre-release "${v.prerelease.join('.')}" is not supported; use alpha.N, beta.N or rc.N`,
      );
    }
    rank = PRE_BASE[label]! + Math.min(num, PRE_SPAN);
  }
  return ((v.major * 1000 + v.minor) * 1000 + v.patch) * 100 + rank;
}
