/**
 * `npm run chats:sync`: the generated block of docs/CHATS.md, written from the open pull requests.
 * Pure functions, no network: the caller hands in the PR list as JSON. Erasable TypeScript.
 *
 * The block sits between `<!-- generated:open-prs -->` and `<!-- /generated:open-prs -->` and holds
 * two tables: ready PRs (they wait for the maintainer) and drafts (running work). Every cell is
 * generated except "Zu tun", which a person writes; it survives a sync, keyed by the PR number.
 * A PR that is no longer in the list loses its row (and its "Zu tun" text).
 */

export const START = '<!-- generated:open-prs -->';
export const END = '<!-- /generated:open-prs -->';
const REPO_URL = 'https://github.com/SGNemo/schweizer-taschenmesser/pull/';

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

/** Splits a Markdown table row into trimmed cells; `\|` stays inside its cell. */
export function cells(row: string): string[] {
  const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((c) => c.trim());
}

/** Labels that say nothing about what waits (kept out of the table to stay inside the page budget). */
const QUIET_LABELS = new Set(['no-changelog', 'dependencies', 'javascript']);

const escapeCell = (s: string) => s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();

/** Locates the block; throws when the markers are missing, doubled or out of order. */
function locate(doc: string): { from: number; to: number } {
  const from = doc.indexOf(START);
  const to = doc.indexOf(END);
  if (from < 0 || to < 0 || to < from || doc.indexOf(START, from + 1) >= 0)
    throw new Error(`open-PR block: need exactly one ${START} … ${END} block`);
  return { from: from + START.length, to };
}

/** "Zu tun" text per PR number, read from the current block (the last cell of each PR row). */
export function readTodos(doc: string): Map<number, string> {
  const { from, to } = locate(doc);
  const todos = new Map<number, string>();
  for (const line of doc.slice(from, to).split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const row = cells(line);
    const m = /^\[#(\d+)\]/.exec(row[0] ?? '');
    const todo = row[row.length - 1];
    if (m && todo) todos.set(Number(m[1]), todo);
  }
  return todos;
}

function table(prs: OpenPr[], todos: Map<number, string>): string {
  if (prs.length === 0) return '_keine_';
  const head = '| PR | Branch | Titel | Zu tun |\n| --- | --- | --- | --- |';
  const rows = prs.map((pr) =>
    [
      `[#${pr.number}](${REPO_URL}${pr.number})`,
      `\`${escapeCell(pr.head)}\``,
      [
        escapeCell(pr.title),
        ...pr.labels.filter((l) => !QUIET_LABELS.has(l)).map((l) => `\`${escapeCell(l)}\``),
      ].join(' '),
      todos.get(pr.number) ?? '',
    ].join(' | '),
  );
  return [head, ...rows.map((r) => `| ${r} |`.replace(/ {2}\|/g, ' |'))].join('\n');
}

/** The block's inner text (between the markers) for this PR list. */
export function renderBlock(prs: OpenPr[], todos: Map<number, string>): string {
  return [
    '',
    '### Bereit (wartet auf Sven)',
    '',
    table(
      prs.filter((p) => !p.draft),
      todos,
    ),
    '',
    '### Läuft gerade (Draft)',
    '',
    table(
      prs.filter((p) => p.draft),
      todos,
    ),
    '',
  ].join('\n');
}

/** The whole document with a freshly generated block; "Zu tun" cells carried over by PR number. */
export function syncDoc(doc: string, prs: OpenPr[]): string {
  const { from, to } = locate(doc);
  return doc.slice(0, from) + renderBlock(prs, readTodos(doc)) + doc.slice(to);
}

/**
 * True when the block already says what a sync would write. Compared cell by cell, so a Markdown
 * formatter padding the table does not count as stale.
 */
export function isCurrent(doc: string, prs: OpenPr[]): boolean {
  const shape = (text: string) => {
    const { from, to } = locate(text);
    return text
      .slice(from, to)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) =>
        l.startsWith('|')
          ? cells(l)
              .map((c) => (/^-+$/.test(c) ? '-' : c))
              .join('|')
          : l,
      );
  };
  return JSON.stringify(shape(doc)) === JSON.stringify(shape(syncDoc(doc, prs)));
}
