/** Build-time data for "Über Nemo": the changelog section of a version and the licence list. */

/**
 * The part of `CHANGELOG.md` for `version` (`## 0.3.1 (…)`), or the `## Unreleased` block when the
 * version has no section yet. Returns '' when neither exists. Capped at `maxLines` lines.
 */
export function extractChangelogSection(markdown: string, version: string, maxLines = 60): string {
  const lines = markdown.split(/\r?\n/);
  const heading = (l: string) => /^##\s+(?!#)/.test(l);
  const find = (match: (l: string) => boolean) => lines.findIndex((l) => heading(l) && match(l));
  let start = find(
    (l) => l.replace(/^##\s+/, '').startsWith(`${version} `) || l.trim() === `## ${version}`,
  );
  if (start === -1) start = find((l) => /^##\s+Unreleased/i.test(l));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => heading(l));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  const bodyLines = body.split('\n');
  return bodyLines.length > maxLines ? bodyLines.slice(0, maxLines).join('\n') + '\n…' : body;
}

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  url?: string;
}

interface PackageJson {
  version?: string;
  license?: string;
  licenses?: { type?: string }[];
  homepage?: string;
  repository?: string | { url?: string };
}

const repoUrl = (p: PackageJson): string | undefined => {
  const raw = typeof p.repository === 'string' ? p.repository : p.repository?.url;
  const url = raw
    ?.replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://');
  return p.homepage ?? (url?.startsWith('http') ? url : undefined);
};

/** Name, version, licence and link of each package, sorted by name. Unknown packages are skipped by the caller. */
export function collectLicenses(
  names: readonly string[],
  read: (name: string) => PackageJson | undefined,
): LicenseEntry[] {
  return [...names].sort().map((name) => {
    const pkg = read(name);
    if (!pkg) throw new Error(`package ${name} is not installed`);
    const license = pkg.license ?? pkg.licenses?.map((l) => l.type).join(' OR ') ?? 'UNKNOWN';
    const url = repoUrl(pkg);
    return { name, version: pkg.version ?? '', license, ...(url ? { url } : {}) };
  });
}
