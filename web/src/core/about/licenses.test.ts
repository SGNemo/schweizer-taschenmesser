import { describe, expect, it } from 'vitest';
import licenses from './licenses.json';

/** The list is checked against the lock files in `scripts/lib/licenseList.test.ts`; this is the view of the app. */
describe('licence list of Über Nemo', () => {
  it('has every group and names a licence for every entry', () => {
    for (const group of ['npm', 'cargo', 'gradle', 'assets', 'models'] as const) {
      expect(licenses[group].length, group).toBeGreaterThan(0);
      for (const l of licenses[group]) {
        expect(l.license, l.name).not.toBe('');
        expect(l.license, l.name).not.toBe('UNKNOWN');
      }
    }
  });
});
