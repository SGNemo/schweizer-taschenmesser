import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  baselineFile,
  countPerFile,
  diffBaseline,
  isModuleSource,
  moduleFiles,
  readBaseline,
  sum,
} from './baseline';
import { findSegmentedViews } from './segmentedViews';

/**
 * Baseline that only shrinks (UI audit 2026-11, package 0b-1): `scripts/baselines/segmented-views.json` holds
 * today's view switches built with `Segmented`, per file. Strict on both sides. After moving one to `Tabs`,
 * lower the file:
 *   UPDATE_BASELINES=1 npx vitest run scripts/lib/segmentedViews.test.ts
 * (a raised number or a new file key is a ratchet hit: name it in the PR text, docs/howto/ci.md).
 */
const NAME = 'segmented-views';
const WHAT = '<Segmented> in the `views` slot of a page header in src/modules/**/*.tsx';
const files = () => moduleFiles(isModuleSource);

describe('findSegmentedViews (what counts as a hit)', () => {
  it('a Segmented in the views slot is a hit, also behind a condition or a fragment', () => {
    expect(
      findSegmentedViews(
        'const a = (\n  <PageHeader title={t}\n    views={<Segmented label="x" value={v} options={o} onChange={set} />}\n  />\n);',
      ),
    ).toEqual([{ line: 3, tag: 'Segmented' }]);
    expect(
      findSegmentedViews('const a = <PageHeader views={wide ? <Segmented /> : null} />;'),
    ).toHaveLength(1);
    expect(
      findSegmentedViews('const a = <PageHeader views={<><Segmented /><Chips /></>} />;'),
    ).toHaveLength(1);
  });

  it('one hit per slot, however many switches it holds', () => {
    expect(
      findSegmentedViews('const a = <PageHeader views={<><Segmented /><Segmented /></>} />;'),
    ).toHaveLength(1);
  });

  it('Tabs in the slot, a Segmented outside it (a filter), comments and strings are not hits', () => {
    expect(findSegmentedViews('const a = <PageHeader views={<Tabs label="x" />} />;')).toEqual([]);
    expect(
      findSegmentedViews('const a = <Toolbar><Segmented label="Zeitraum" /></Toolbar>;'),
    ).toEqual([]);
    expect(findSegmentedViews('const a = <PageHeader views={<MySegmented />} />;')).toEqual([]);
    expect(
      findSegmentedViews(
        '// <PageHeader views={<Segmented />} />\nconst a = "views={<Segmented />}";',
      ),
    ).toEqual([]);
  });
});

describe(`scripts/baselines/${NAME}.json`, () => {
  it('holds exactly the hits of today, file by file: no new one, and a removed one lowers the file', () => {
    const actual = countPerFile(files(), (source) => findSegmentedViews(source).length);
    if (process.env.UPDATE_BASELINES === '1')
      writeFileSync(
        baselineFile(NAME),
        `${JSON.stringify({ version: 1, what: WHAT, total: sum(actual), files: actual }, null, 2)}\n`,
      );
    const baseline = readBaseline(NAME);
    const { over, under } = diffBaseline(baseline.files, actual);
    expect(
      over,
      `new hits (${WHAT}): the views of a page are Tabs from @/ui, Segmented is a filter (docs/howto/design-rules.md)`,
    ).toEqual([]);
    expect(
      under,
      `fewer hits than scripts/baselines/${NAME}.json says: lower the baseline (UPDATE_BASELINES=1 npx vitest run scripts/lib/segmentedViews.test.ts)`,
    ).toEqual([]);
    expect(baseline.total, 'total = sum of the files').toBe(sum(baseline.files));
    expect(files().length, 'the counter found no files to read').toBeGreaterThan(20);
  });
});
