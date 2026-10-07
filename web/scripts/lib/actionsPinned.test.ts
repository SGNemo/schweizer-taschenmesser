import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every third-party GitHub Action is pinned to a full commit SHA (a moving tag could be re-pointed
 * at malicious code and would run in the jobs that hold the signing keys). Local reusable
 * workflows (`./.github/...`) are exempt. Dependabot keeps the pins fresh (`github-actions`
 * ecosystem in `.github/dependabot.yml`).
 */
const workflowsDir = resolve(__dirname, '../../../.github/workflows');

function usesLines(): { file: string; line: number; ref: string }[] {
  return readdirSync(workflowsDir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .flatMap((file) =>
      readFileSync(join(workflowsDir, file), 'utf8')
        .split('\n')
        .map((text, i) => ({ file, line: i + 1, text: text.replace(/#.*$/, '').trim() }))
        .filter((l) => /^(- )?uses:\s/.test(l.text))
        .map((l) => ({ file: l.file, line: l.line, ref: l.text.replace(/^(- )?uses:\s*/, '') })),
    );
}

describe('GitHub Actions pinning', () => {
  it('finds the workflows', () => {
    expect(usesLines().length).toBeGreaterThan(10);
  });

  it('pins every external action to a 40-hex commit SHA', () => {
    const unpinned = usesLines().filter(
      (u) => !u.ref.startsWith('./') && !/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/.test(u.ref),
    );
    expect(unpinned.map((u) => `${u.file}:${u.line} ${u.ref}`)).toEqual([]);
  });
});
