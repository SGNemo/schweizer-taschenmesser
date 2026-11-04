import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadChanges } from './changesDir';

const root = fileURLToPath(new URL('../../../', import.meta.url));

describe('repository change data', () => {
  it('every note in .changes/ is valid', () => {
    expect(loadChanges(`${root}.changes`).errors).toEqual([]);
  });
  it('the committed changelog.json is well formed and has no unreleased block', () => {
    const file = `${root}web/src/generated/changelog.json`;
    expect(existsSync(file)).toBe(true);
    const data = JSON.parse(readFileSync(file, 'utf8')) as {
      versions: { version: string; entries: { de: string; en: string }[] }[];
    };
    expect(data.versions.length).toBeGreaterThan(0);
    expect(data.versions.some((x) => x.version === 'unreleased')).toBe(false);
    for (const x of data.versions) for (const en of x.entries) expect(en.de && en.en).toBeTruthy();
  });
});
