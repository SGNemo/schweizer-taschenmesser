/**
 * Conventional Commits → release notes. Pure functions (the CLI in `../changelog.mjs` feeds them
 * `git log`); erasable TypeScript syntax only, so Node can run it directly.
 */

export interface RawCommit {
  hash: string;
  subject: string;
  body: string;
}

export interface ParsedCommit {
  hash: string;
  type: string;
  scope?: string;
  description: string;
  breaking: boolean;
  breakingNote?: string;
}

const HEADER_RE = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/;
const BREAKING_RE = /^BREAKING[ -]CHANGE:\s*(.+)$/m;

/** undefined for subjects that do not follow the convention. */
export function parseCommit(c: RawCommit): ParsedCommit | undefined {
  const m = HEADER_RE.exec(c.subject.trim());
  if (!m) return undefined;
  const note = BREAKING_RE.exec(c.body)?.[1]?.trim();
  return {
    hash: c.hash,
    type: m[1]!.toLowerCase(),
    scope: m[2],
    description: m[4]!.trim(),
    breaking: m[3] === '!' || note !== undefined,
    breakingNote: note,
  };
}

/** Commits that carry no information for users. */
const SKIP_SUBJECT = /^(Merge (branch|pull request|remote-tracking)|chore\(release\)|Revert ")/;

const SECTIONS: [string, string][] = [
  ['feat', 'Features'],
  ['fix', 'Bug fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['docs', 'Documentation'],
  ['build', 'Build & CI'],
  ['ci', 'Build & CI'],
];
/** Types that only matter to developers and stay out of the notes. */
const HIDDEN = new Set(['chore', 'test', 'style']);

export interface ChangelogInput {
  version: string;
  /** 'YYYY-MM-DD' */
  date: string;
  commits: RawCommit[];
  /** e.g. https://github.com/owner/repo – turns hashes into links. */
  repoUrl?: string;
  /** Link "Full changelog" from this tag (e.g. v0.1.0). */
  previousTag?: string;
}

const link = (hash: string, repoUrl?: string): string =>
  repoUrl ? `[\`${hash.slice(0, 7)}\`](${repoUrl}/commit/${hash})` : `\`${hash.slice(0, 7)}\``;

const line = (c: ParsedCommit, repoUrl?: string): string =>
  `- ${c.scope ? `**${c.scope}:** ` : ''}${c.description} (${link(c.hash, repoUrl)})`;

/** Markdown release notes: breaking changes first, then one section per commit type. */
export function renderChangelog(input: ChangelogInput): string {
  const parsed: ParsedCommit[] = [];
  const other: RawCommit[] = [];
  for (const c of input.commits) {
    if (SKIP_SUBJECT.test(c.subject)) continue;
    const p = parseCommit(c);
    if (p) parsed.push(p);
    else other.push(c);
  }

  const out: string[] = [`## ${input.version} (${input.date})`, ''];
  const breaking = parsed.filter((c) => c.breaking);
  if (breaking.length > 0) {
    out.push('### ⚠ Breaking changes', '');
    for (const c of breaking) {
      out.push(line(c, input.repoUrl));
      if (c.breakingNote) out.push(`  ${c.breakingNote}`);
    }
    out.push('');
  }

  const done = new Set<string>();
  for (const [, title] of SECTIONS) {
    if (done.has(title)) continue;
    done.add(title);
    const types = SECTIONS.filter(([, t]) => t === title).map(([type]) => type);
    const items = parsed.filter((c) => types.includes(c.type));
    if (items.length === 0) continue;
    out.push(`### ${title}`, '', ...items.map((c) => line(c, input.repoUrl)), '');
  }

  const known = new Set(SECTIONS.map(([type]) => type));
  const unknown = parsed.filter((c) => !known.has(c.type) && !HIDDEN.has(c.type));
  if (other.length > 0 || unknown.length > 0) {
    out.push('### Other changes', '');
    for (const c of unknown) out.push(line(c, input.repoUrl));
    for (const c of other) out.push(`- ${c.subject.trim()} (${link(c.hash, input.repoUrl)})`);
    out.push('');
  }

  if (out.length === 2) out.push('_No user-facing changes._', '');
  if (input.repoUrl && input.previousTag) {
    out.push(
      `**Full changelog:** ${input.repoUrl}/compare/${input.previousTag}...v${input.version.replace(/^v/, '')}`,
      '',
    );
  }
  return `${out.join('\n').trimEnd()}\n`;
}
