import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SC6 (launch review 2026-11): the composite actions in `.github/actions/*` run inside the same
 * jobs as the workflows, so their external `uses:` are pinned to a full commit SHA too. (The
 * workflow files are checked by `actionsPinned.test.ts`.)
 */
const actionsDir = resolve(__dirname, '../../../.github/actions');

function compositeUses(): { file: string; line: number; ref: string }[] {
  return readdirSync(actionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      ['action.yml', 'action.yaml']
        .map((name) => join(d.name, name))
        .filter((file) => existsSync(join(actionsDir, file))),
    )
    .flatMap((file) =>
      readFileSync(join(actionsDir, file), 'utf8')
        .split('\n')
        .map((text, i) => ({ file, line: i + 1, text: text.replace(/#.*$/, '').trim() }))
        .filter((l) => /^(- )?uses:\s/.test(l.text))
        .map((l) => ({ file: l.file, line: l.line, ref: l.text.replace(/^(- )?uses:\s*/, '') })),
    );
}

describe('GitHub composite actions pinning', () => {
  it('finds the composite actions and their steps', () => {
    expect(compositeUses().length).toBeGreaterThan(0);
  });

  it('pins every external action to a 40-hex commit SHA', () => {
    const unpinned = compositeUses().filter(
      (u) => !u.ref.startsWith('./') && !/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/.test(u.ref),
    );
    expect(unpinned.map((u) => `${u.file}:${u.line} ${u.ref}`)).toEqual([]);
  });
});
