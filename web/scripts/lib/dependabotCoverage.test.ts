import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SC7 (launch review 2026-11): every project with a lock file gets dependency updates. A new npm
 * project, crate lock file or Android Gradle project without an entry in `.github/dependabot.yml`
 * fails here.
 */
const root = resolve(__dirname, '../../..');
const SKIP = new Set(['node_modules', 'target', 'dist', '.git', 'build', '.gradle', 'gen']);

function find(dir: string, names: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) find(path, names, out);
    else if (names.includes(entry)) out.push(path);
  }
  return out;
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

const dirOf = (file: string) =>
  `/${relative(root, file).split('/').slice(0, -1).join('/')}`.replace(/\/$/, '') || '/';

describe('Dependabot covers every project', () => {
  const have = entries();
  const want = [
    ...find(root, ['package-lock.json']).map((f) => `npm ${dirOf(f)}`),
    ...find(join(root, 'web/src-tauri'), ['Cargo.lock']).map((f) => `cargo ${dirOf(f)}`),
    ...find(join(root, 'web/src-tauri/plugins'), ['build.gradle.kts']).map(
      (f) => `gradle ${dirOf(f)}`,
    ),
  ];

  it('finds the projects', () => {
    expect(want.length).toBeGreaterThan(15);
  });

  it('has an entry for each', () => {
    expect(want.filter((w) => !have.has(w)).sort()).toEqual([]);
  });
});
