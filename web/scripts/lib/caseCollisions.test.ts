import { describe, expect, it } from 'vitest';
import { findCaseCollisions } from './caseCollisions';

describe('findCaseCollisions', () => {
  it('finds two files that differ only in case', () => {
    expect(findCaseCollisions(['a/cockpit.ts', 'a/Cockpit.ts', 'a/other.ts'])).toEqual([
      ['a/Cockpit.ts', 'a/cockpit.ts'],
    ]);
  });

  it('finds a folder spelled two ways and reports it once, not per file', () => {
    expect(findCaseCollisions(['src/Tools/a.ts', 'src/tools/b.ts', 'src/Tools/c.ts'])).toEqual([
      ['src/Tools', 'src/tools'],
    ]);
  });

  it('accepts different names and the same path repeated', () => {
    expect(findCaseCollisions(['a/b.ts', 'a/c.ts', 'a/b.ts', 'A-b/x'])).toEqual([]);
    expect(findCaseCollisions([])).toEqual([]);
  });
});
