import { describe, expect, it } from 'vitest';
import type { CaptureFields } from '../parser';
import { TARGETS } from './adapters';
import { CaptureError, type CaptureFieldSpec } from './types';

/** A usable value for every field a spec can name (the edit panel writes exactly these shapes). */
const SAMPLE: Required<Pick<CaptureFields, CaptureFieldSpec['key']>> = {
  title: 'Beispiel',
  amountMinor: 1250,
  date: '2026-12-01',
  time: '09:30',
  reference: 'R-1',
  recurrence: { freq: 'monthly', interval: 1 },
  estimateMin: 30,
  url: 'https://example.org/',
  kcal: 400,
};
const ctx = { today: '2026-11-16' };
const filled = (specs: readonly CaptureFieldSpec[]): CaptureFields => ({
  title: '',
  ...Object.fromEntries(specs.filter((s) => s.required).map((s) => [s.key, SAMPLE[s.key]])),
});

/**
 * The edit panel's fields come from each target's definition: what a target marks `required` is exactly what
 * its `build` cannot do without. A new required input that is not declared, or a declared one the target no
 * longer needs, fails here instead of leaving the mail dialog with an entry it cannot save.
 */
describe('target fields', () => {
  for (const [type, target] of Object.entries(TARGETS)) {
    // Targets that only read their own words (exercises, a city, a break's span) declare no fields.
    if (target.fields.length === 0) continue;
    it(`${type}: the required fields are enough to build`, () => {
      expect(() => target.build(filled(target.fields), ctx)).not.toThrow();
    });
    for (const spec of target.fields.filter((s) => s.required)) {
      it(`${type}: without „${spec.key}“ the entry is incomplete`, () => {
        const fields = {
          ...filled(target.fields),
          [spec.key]: spec.key === 'title' ? '' : undefined,
        };
        expect(() => target.build(fields, ctx)).toThrow(CaptureError);
      });
    }
    it(`${type}: every field is named once`, () => {
      const keys = target.fields.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  }

  it('invoice: payee, amount, due day and reference', () => {
    expect(TARGETS.invoice.fields.map((s) => s.key)).toEqual([
      'title',
      'amountMinor',
      'date',
      'reference',
    ]);
    expect(
      TARGETS.invoice.build({ ...filled(TARGETS.invoice.fields), reference: ' R-9 ' }, ctx),
    ).toMatchObject({ reference: 'R-9' });
  });
});
