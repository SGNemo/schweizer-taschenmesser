import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The parser is a pure TS package: no app, UI, storage or network imports.
describe('parser isolation', () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it.each(files)('%s only imports from inside the parser', (file) => {
    const src = readFileSync(join(dir, file), 'utf8');
    const specs = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
    for (const spec of specs) expect(spec.startsWith('./'), `${file} imports ${spec}`).toBe(true);
    expect(src).not.toMatch(/\bfetch\b|XMLHttpRequest|console\.|Date\.now\(|new Date\(\)/);
  });
});
