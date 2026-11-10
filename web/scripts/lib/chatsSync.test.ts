import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cells, isCurrent, normalizePrs, readTodos, syncDoc } from './chatsSync.ts';

const FIX = resolve(__dirname, '__fixtures__/chatsSync');
const CLI = resolve(__dirname, '../chats-sync.mjs');
const fixture = (name: string) => readFileSync(join(FIX, name), 'utf8');
const doc = fixture('CHATS.md');
const prs = normalizePrs(JSON.parse(fixture('prs-gh.json')));

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

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

  it('refuses entries without number, title or branch', () => {
    expect(() => normalizePrs({})).toThrow(/array/);
    expect(() => normalizePrs([{ number: 1, title: 'x' }])).toThrow(/entry 0/);
  });
});

describe('chats:sync – block', () => {
  const next = syncDoc(doc, prs);

  it('keeps "Zu tun" by PR number, drops closed PRs, adds new ones', () => {
    expect(readTodos(next)).toEqual(new Map([[10, 'mergen, Handtest X1']]));
    expect(next).toContain('feat(a): new title of A `full-ci` | mergen, Handtest X1 |');
    expect(next).not.toContain('old title of A');
    expect(next).not.toContain('#9]');
    expect(next).not.toContain('no-changelog');
  });

  it('puts drafts under "Läuft gerade" and escapes pipes', () => {
    const drafts = next.slice(next.indexOf('### Läuft gerade'));
    expect(drafts).toContain('| `feat/b` | draft: pipes \\| in a title | |');
    const row = drafts.split('\n').find((l) => l.includes('#12'))!;
    expect(cells(row)).toHaveLength(4);
  });

  it('leaves everything outside the markers alone and is idempotent', () => {
    const outside = (s: string) => [s.split('<!-- generated')[0], s.split('open-prs -->').pop()];
    expect(outside(next)).toEqual(outside(doc));
    expect(syncDoc(next, prs)).toBe(next);
  });

  it('--check logic: stale before, current after, padding does not count', () => {
    expect(isCurrent(doc, prs)).toBe(false);
    expect(isCurrent(next, prs)).toBe(true);
    const padded = next.replace(/\| --- \|/g, '| ------ |').replace(/ \| /g, '  |  ');
    expect(isCurrent(padded, prs)).toBe(true);
    expect(isCurrent(next, prs.slice(1))).toBe(false);
  });

  it('needs exactly one marker pair', () => {
    expect(() => syncDoc('# no block', prs)).toThrow(/exactly one/);
  });
});

describe('chats:sync – command line', () => {
  it('writes from stdin, then --check from a file exits 0; a stale block exits 1', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chats-sync-'));
    made.push(dir);
    const file = join(dir, 'CHATS.md');
    copyFileSync(join(FIX, 'CHATS.md'), file);
    const run = (args: string[], input?: string) =>
      execFileSync(process.execPath, [CLI, '--doc', file, ...args], {
        input: input ?? '',
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    expect(() => run(['--check', '--from', join(FIX, 'prs-gh.json')])).toThrow();
    run([], fixture('prs-mcp.json'));
    expect(readFileSync(file, 'utf8')).toBe(syncDoc(doc, prs));
    expect(run(['--check', '--from', join(FIX, 'prs-gh.json')])).toContain('current');
  });
});
