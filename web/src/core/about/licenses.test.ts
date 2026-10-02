import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import licenses from './licenses.json';

const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>;
};

describe('licence list of Über Nemo', () => {
  it('lists every production dependency (run `npm run gen:licenses` after changing them)', () => {
    expect(licenses.map((l) => l.name)).toEqual(Object.keys(pkg.dependencies).sort());
  });

  it('names a licence for every entry', () => {
    for (const l of licenses) {
      expect(l.license, l.name).not.toBe('');
      expect(l.license, l.name).not.toBe('UNKNOWN');
      expect(l.version, l.name).not.toBe('');
    }
  });
});
