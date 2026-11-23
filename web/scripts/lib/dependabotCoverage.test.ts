import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SC7 (launch review 2026-11): every project with a lock file gets dependency updates. A new npm
 * project, crate lock file or Android Gradle project without an entry in `.github/dependabot.yml`
 * fails here.
 */
const root = resolve(__dirname, '../../..');
/** Tracked files only: scratch clones, worktrees and reports in a dev checkout do not count. */
function tracked(pattern: string): string[] {
  return execFileSync('git', ['ls-files', '--', pattern], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function entries(): Set<string> {
  const text = readFileSync(join(root, '.github/dependabot.yml'), 'utf8');
  const found = new Set<string>();
  let ecosystem = '';
  for (const line of text.split('\n')) {
    const eco = /package-ecosystem:\s*"?([\w-]+)"?/.exec(line);
    if (eco) ecosystem = eco[1]!;
    const dir = /directory:\s*"([^"]+)"/.exec(line);
    if (dir) found.add(`${ecosystem} ${dir[1]}`);
  }
  return found;
}

const dirOf = (file: string) => `/${file.split('/').slice(0, -1).join('/')}`;

describe('Dependabot covers every project', () => {
  const have = entries();
  const want = [
    ...tracked('*package-lock.json').map((f) => `npm ${dirOf(f)}`),
    ...tracked('web/src-tauri/*Cargo.lock').map((f) => `cargo ${dirOf(f)}`),
    ...tracked('web/src-tauri/plugins/*build.gradle.kts').map((f) => `gradle ${dirOf(f)}`),
  ];

  it('finds the projects', () => {
    expect(want.length).toBeGreaterThan(15);
  });

  it('has an entry for each', () => {
    expect(want.filter((w) => !have.has(w)).sort()).toEqual([]);
  });
});
