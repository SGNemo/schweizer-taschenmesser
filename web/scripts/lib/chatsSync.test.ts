import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchOpenPrs, normalizePrs, renderTable } from './chatsSync.ts';

const FIX = resolve(__dirname, '__fixtures__/chatsSync');
const CLI = resolve(__dirname, '../chats-sync.mjs');
const fixture = (name: string) => readFileSync(join(FIX, name), 'utf8');
const prs = normalizePrs(JSON.parse(fixture('prs-gh.json')));

describe('chats:sync – PR list', () => {
  it('reads the gh and the REST/MCP shape alike, newest first', () => {
    const mcp = normalizePrs(JSON.parse(fixture('prs-mcp.json')));
    expect(mcp).toEqual(prs);
    expect(prs[0]).toEqual({
      number: 12,
      title: 'draft: pipes | in a title',
      head: 'feat/b',
      draft: true,
      labels: [],
    });
    expect(prs[1]!.labels).toEqual(['full-ci', 'no-changelog']);
  });

  it('fetches through gh api (REST, one page) and refuses a full page', () => {
    const calls: string[][] = [];
    const prsFrom = (n: number) => (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      return JSON.stringify(
        Array.from({ length: n }, (_, i) => ({ number: i + 1, title: 't', head: { ref: 'b' } })),
      );
    };
    expect(fetchOpenPrs(prsFrom(2))).toHaveLength(2);
    expect(calls[0]).toEqual([
      'gh',
      'api',
      'repos/SGNemo/schweizer-taschenmesser/pulls?state=open&per_page=100',
    ]);
    expect(() => fetchOpenPrs(prsFrom(100))).toThrow(/incomplete/);
  });

  it('refuses entries without number, title or branch', () => {
    expect(() => normalizePrs({})).toThrow(/array/);
    expect(() => normalizePrs([{ number: 1, title: 'x' }])).toThrow(/entry 0/);
  });
});

describe('chats:sync – table', () => {
  const table = renderTable(prs);
  const rows = table.split('\n').filter((l) => l.startsWith('| [#'));

  it('lists drafts after ready PRs, marked as such, and escapes pipes', () => {
    expect(rows).toEqual([
      '| [#10](https://github.com/SGNemo/schweizer-taschenmesser/pull/10) | `feat/a` | feat(a): new title of A `full-ci` |',
      '| [#12](https://github.com/SGNemo/schweizer-taschenmesser/pull/12) Draft | `feat/b` | draft: pipes \\| in a title |',
    ]);
    expect(table.match(/\| PR \|/g)).toHaveLength(1);
  });

  it('leaves quiet labels out and says so when nothing is open', () => {
    expect(table).not.toContain('no-changelog');
    expect(renderTable([])).toBe('_keine_');
  });
});

describe('chats:sync – command line', () => {
  const run = (args: string[], input?: string) =>
    execFileSync(process.execPath, [CLI, ...args], {
      input: input ?? '',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

  it('prints the same table from stdin and from a file, and writes nothing', () => {
    const fromFile = run(['--from', join(FIX, 'prs-gh.json')]);
    expect(fromFile).toContain(renderTable(prs));
    expect(run([], fixture('prs-mcp.json'))).toBe(fromFile);
  });
});
