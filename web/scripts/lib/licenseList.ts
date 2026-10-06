/** Builds the licence list of everything Nemo ships; see `scripts/gen-licenses.mjs`. */
import { checkLicense, EXCEPTIONS } from './licensePolicy.ts';

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  url?: string;
}

export type LicenseGroupId = 'npm' | 'cargo' | 'gradle' | 'assets' | 'models';
export type LicenseData = { schema: 1 } & Record<LicenseGroupId, LicenseEntry[]>;

const byName = (a: LicenseEntry, b: LicenseEntry) =>
  a.name.localeCompare(b.name) || a.version.localeCompare(b.version);

/** Lock file v3 shape (only what is read). */
export interface NpmLock {
  packages: Record<
    string,
    { version?: string; license?: string; dev?: boolean; devOptional?: boolean; link?: boolean }
  >;
}

/** Every package that ends up in the production bundle: all non-dev entries of the lock file, transitive too. */
export function npmFromLock(lock: NpmLock): LicenseEntry[] {
  const out = new Map<string, LicenseEntry>();
  for (const [path, p] of Object.entries(lock.packages)) {
    if (!path || p.dev || p.link) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    out.set(`${name}@${p.version}`, {
      name,
      version: p.version ?? '',
      license: p.license ?? 'UNKNOWN',
      url: `https://www.npmjs.com/package/${name}/v/${p.version}`,
    });
  }
  return [...out.values()].sort(byName);
}

/** `cargo metadata --format-version 1` (shape: only what is read). */
export interface CargoMetadata {
  packages: {
    name: string;
    version: string;
    source: string | null;
    license: string | null;
    repository: string | null;
    homepage?: string | null;
  }[];
}

/** Registry crates only: the project's own crates (no `source`) are covered by the app licence. */
export function cratesFromMetadata(meta: CargoMetadata): LicenseEntry[] {
  return meta.packages
    .filter((p) => p.source)
    .map((p) => ({
      name: p.name,
      version: p.version,
      license: p.license ?? 'UNKNOWN',
      url: `https://crates.io/crates/${p.name}/${p.version}`,
    }))
    .sort(byName);
}

/** `name@version` of every registry crate in a `Cargo.lock` (cheap freshness check without cargo). */
export function lockedCrates(cargoLock: string): Set<string> {
  const out = new Set<string>();
  for (const block of cargoLock.split(/\n\s*\n/)) {
    const name = /^name = "([^"]+)"/m.exec(block)?.[1];
    const version = /^version = "([^"]+)"/m.exec(block)?.[1];
    if (name && version && /^source = /m.test(block)) out.add(`${name}@${version}`);
  }
  return out;
}

/** Model catalogue (`core/ai/local/catalogue.json`): downloaded on demand, never shipped with the app. */
export function modelsFromCatalogue(cat: {
  models: { label: string; repo: string; baseModel: string; license: { name: string } }[];
}): LicenseEntry[] {
  return cat.models
    .map((m) => ({
      name: m.label,
      version: '',
      license: m.license.name,
      url: `https://huggingface.co/${m.repo}`,
    }))
    .sort(byName);
}

/** Hand-kept groups (Gradle libraries of the Android shell, fonts, icons): `scripts/licenses.manual.json`. */
export type ManualLicenses = Pick<LicenseData, 'gradle' | 'assets'>;

/** Names that cannot be audited by a tool still go through the same allowlist; returns one message per problem. */
export function policyProblems(data: LicenseData): string[] {
  const problems: string[] = [];
  for (const group of ['npm', 'cargo', 'gradle', 'assets'] as const) {
    for (const e of data[group]) {
      if (EXCEPTIONS[e.name] || EXCEPTIONS[`${e.name}@${e.version}`]) continue;
      const v = checkLicense(e.license);
      if (!v.ok) {
        problems.push(
          `${group}: ${e.name}@${e.version} has licence "${e.license}" (not allowed: ${v.rejected.join(', ')})`,
        );
      }
    }
  }
  return problems;
}
