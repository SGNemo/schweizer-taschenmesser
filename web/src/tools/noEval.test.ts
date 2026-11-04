import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The calculator and every tool parse what the user types themselves; nothing is ever handed to the
 * JavaScript engine as code. Comments may say so, code may not (`eval`, `new Function`, string timers).
 */
const ROOTS = ['src/tools', 'src/core/calc'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const withoutComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('no dynamic code in tools and calculator', () => {
  const files = ROOTS.flatMap(sources);

  it('looks at the tool and calculator sources', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files)('%s has no eval, new Function or string timers', (file) => {
    const code = withoutComments(readFileSync(file, 'utf8'));
    expect(code).not.toMatch(/\beval\s*\(/);
    expect(code).not.toMatch(/\bnew\s+Function\b|\bFunction\s*\(/);
    expect(code).not.toMatch(/\bset(Timeout|Interval)\s*\(\s*['"`]/);
  });
});
