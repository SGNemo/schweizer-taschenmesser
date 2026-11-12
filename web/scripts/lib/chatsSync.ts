/**
 * `npm run chats:sync`: the open pull requests as one table, printed, never written into a file.
 * Pure functions, no network: the caller hands in the PR list as JSON. Erasable TypeScript.
 *
 * The table used to be a generated block of docs/CHATS.md that every branch committed. Each branch then
 * carried its own snapshot of the same lines, so nearly every PR conflicted with `develop` in that file.
 * State that GitHub already holds is read from GitHub when someone asks for it (decisions/meta-ci-docs.md).
 */

export const REPO = 'SGNemo/schweizer-taschenmesser';
const REPO_URL = `https://github.com/${REPO}/pull/`;
const PAGE = 100;

/**
 * The open PRs from GitHub's REST API through the `gh` CLI (GraphQL `gh pr list` is blocked in Claude
 * sessions). One page of 100; more open PRs throw instead of silently dropping rows. `run` is the
 * command runner (tests pass a fake).
 */
export function fetchOpenPrs(run: (cmd: string, args: string[]) => string): OpenPr[] {
  const out = run('gh', ['api', `repos/${REPO}/pulls?state=open&per_page=${PAGE}`]);
  const list: unknown = JSON.parse(out);
  if (Array.isArray(list) && list.length >= PAGE)
    throw new Error(`${PAGE} or more open PRs: the list may be incomplete, sync stopped`);
  return normalizePrs(list);
}

export interface OpenPr {
  number: number;
  title: string;
  head: string;
  draft: boolean;
  labels: string[];
}

type Raw = Record<string, unknown>;

/**
 * Accepts the shapes the PR list comes in: `gh pr list --json number,title,headRefName,isDraft,labels`,
 * the REST / MCP `list_pull_requests` answer (`head.ref`, `draft`, labels as objects or strings) and the
 * flat shape of `OpenPr`. Throws on anything without a number, title and head branch.
 */
export function normalizePrs(input: unknown): OpenPr[] {
  if (!Array.isArray(input)) throw new Error('PR list: expected a JSON array');
  const prs = input.map((item, i): OpenPr => {
    const raw = (item ?? {}) as Raw;
    const headObj = raw.head as Raw | string | undefined;
    const head =
      typeof headObj === 'string'
        ? headObj
        : typeof headObj?.ref === 'string'
          ? headObj.ref
          : raw.headRefName;
    const labels = Array.isArray(raw.labels)
      ? raw.labels.map((l) => (typeof l === 'string' ? l : String((l as Raw)?.name ?? '')))
      : [];
    if (typeof raw.number !== 'number' || typeof raw.title !== 'string' || typeof head !== 'string')
      throw new Error(`PR list entry ${i}: needs number, title and head branch`);
    return {
      number: raw.number,
      title: raw.title,
      head,
      draft: raw.draft === true || raw.isDraft === true,
      labels: labels.filter(Boolean).sort(),
    };
  });
  return prs.sort((a, b) => b.number - a.number);
}

/** Labels that say nothing about what waits (kept out of the table to keep it short). */
const QUIET_LABELS = new Set(['no-changelog', 'dependencies', 'javascript']);

const escapeCell = (s: string) => s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();

/**
 * The open PRs as a Markdown table: ready PRs first (they wait for the maintainer), then drafts
 * (running work), marked as such. `_keine_` when nothing is open.
 */
export function renderTable(prs: OpenPr[]): string {
  if (prs.length === 0) return '_keine_';
  const ordered = [...prs.filter((p) => !p.draft), ...prs.filter((p) => p.draft)];
  const head = '| PR | Branch | Titel |\n| --- | --- | --- |';
  const rows = ordered.map((pr) =>
    [
      `[#${pr.number}](${REPO_URL}${pr.number})${pr.draft ? ' Draft' : ''}`,
      `\`${escapeCell(pr.head)}\``,
      [
        escapeCell(pr.title),
        ...pr.labels.filter((l) => !QUIET_LABELS.has(l)).map((l) => `\`${escapeCell(l)}\``),
      ].join(' '),
    ].join(' | '),
  );
  return [head, ...rows.map((r) => `| ${r} |`)].join('\n');
}
