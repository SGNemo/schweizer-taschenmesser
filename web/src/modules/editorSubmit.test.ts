import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

/** The modules of QA round 4, X13 (a double click on "Speichern" saved twice). */
const MODULES = [
  'budgets',
  'finance',
  'invoices',
  'subscriptions',
  'calendar',
  'timetrack',
  'habits',
  'pantry',
  'people',
  'lists',
  'bookmarks',
  'maps',
  'notes',
];

/**
 * `Form` locks while the promise of `onSubmit` runs; `() => void save()` hands it nothing to wait
 * for, so a double click saves twice again.
 */
it('editor forms hand their save promise to Form', () => {
  const found: string[] = [];
  for (const mod of MODULES) {
    const dir = join(__dirname, mod, 'components');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx') && !x.includes('.test.'))) {
      if (/<Form onSubmit=\{\(\) => void /.test(readFileSync(join(dir, f), 'utf8')))
        found.push(`${mod}/${f}`);
    }
  }
  expect(found).toEqual([]);
});
