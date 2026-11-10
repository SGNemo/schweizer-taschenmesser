import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BUDGET,
  chatsProblems,
  HARD_BUDGET_FILES,
  isHardBudget,
  statusWarnings,
} from './check-docs.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-docs.mjs');

const CHATS = `# Chats

| PR | Was | Zu tun |
| --- | --- | --- |
| #1 \`feat/a\` | Thing A | mergen |
| #2 \`feat/b\` | Thing B | lock files never hand-merged |
`;

describe('chatsProblems', () => {
  it('passes rows about open work, separators and prose', () => {
    expect(
      chatsProblems(`${CHATS}\nHandtests aus gemergten PRs stehen in MANUAL-TESTS.\n`),
    ).toEqual([]);
  });

  it('flags a row that says merged or gemergt', () => {
    const text = `${CHATS}| #3 | Thing C | merged |\n| #4 | Thing D | gemergt am 01.11. |\n`;
    const out = chatsProblems(text);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/CHATS\.md:7: row about a merged PR/);
    expect(out[1]).toMatch(/CHATS\.md:8: row about a merged PR/);
  });

  it('flags a duplicate row (whitespace ignored)', () => {
    const text = `${CHATS}|  #1 \`feat/a\` | Thing A |   mergen |\n`;
    expect(chatsProblems(text)).toEqual(['docs/CHATS.md:7: same row as line 5 – keep one']);
  });
});

describe('statusWarnings', () => {
  const remotes = new Set(['develop', 'feat/alive']);

  it('flags "PR offen"', () => {
    const out = statusWarnings('- Paket 2: PR offen (#12)\n- Paket 1: auf develop\n', remotes);
    expect(out).toEqual([expect.stringMatching(/^docs\/STATUS\.md:1: "PR offen"/)]);
  });

  it('flags a backticked branch the remote does not have', () => {
    const text = 'Läuft: `feat/alive`, `fix/gone`; Pfad `docs/brand/x.png`; Befehl `npm run x`.';
    const out = statusWarnings(text, remotes, (p) => p === 'docs/brand/x.png');
    expect(out).toEqual([expect.stringMatching(/STATUS\.md:1: branch `fix\/gone` is not on/)]);
  });

  it('skips the branch check when the clone has no remote branches', () => {
    expect(statusWarnings('Läuft: `fix/gone`', null)).toEqual([]);
  });
});

describe('budgets', () => {
  it('CHATS.md and STATUS.md are hard limits, other docs warn', () => {
    expect(HARD_BUDGET_FILES).toEqual(['docs/CHATS.md', 'docs/STATUS.md']);
    expect(isHardBudget('docs/CHATS.md')).toBe(true);
    expect(isHardBudget('docs/STATUS.md')).toBe(true);
    expect(isHardBudget('docs/HOW-TO.md')).toBe(false);
  });

  it('start context is hard once the switch is on', () => {
    expect(isHardBudget('start context', true)).toBe(true);
    expect(isHardBudget('start context', false)).toBe(false);
  });
});

describe('cli (fixture tree, no git)', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  function run(files: Record<string, string>): { code: number; out: string } {
    const root = mkdtempSync(join(tmpdir(), 'check-docs-'));
    dirs.push(root);
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), text);
    }
    try {
      const out = execFileSync('node', [SCRIPT, '--root', root], { encoding: 'utf8' });
      return { code: 0, out };
    } catch (e) {
      const err = e as { status: number; stdout: string };
      return { code: err.status, out: err.stdout };
    }
  }
  const base = { 'CLAUDE.md': '# Root\n', 'docs/CHATS.md': CHATS, 'docs/STATUS.md': '# Status\n' };
  const big = (limit: number) => 'x'.repeat(limit * 4 + 8);

  it('clean tree exits 0', () => {
    const r = run(base);
    expect(r.code).toBe(0);
    expect(r.out).toContain('branch check skipped');
  });

  it('a merged row in CHATS.md exits 1', () => {
    const r = run({ ...base, 'docs/CHATS.md': `${CHATS}| #9 | Old | merged |\n` });
    expect(r.code).toBe(1);
    expect(r.out).toContain('blocking problem');
  });

  it('CHATS.md or STATUS.md over budget exits 1 without --strict', () => {
    const chats = BUDGET.overrides['docs/CHATS.md'];
    const status = BUDGET.overrides['docs/STATUS.md'];
    expect(run({ ...base, 'docs/CHATS.md': big(chats) }).code).toBe(1);
    expect(run({ ...base, 'docs/STATUS.md': big(status) }).code).toBe(1);
  });

  it('another doc over budget only warns', () => {
    const r = run({ ...base, 'docs/HOW-TO.md': big(BUDGET.lookup) });
    expect(r.code).toBe(0);
    expect(r.out).toContain('docs/HOW-TO.md');
  });

  it('"PR offen" in STATUS.md only warns', () => {
    const r = run({ ...base, 'docs/STATUS.md': '- Paket 2: PR offen\n' });
    expect(r.code).toBe(0);
    expect(r.out).toContain('"PR offen"');
  });
});
