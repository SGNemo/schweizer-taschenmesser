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
import { findBareLists } from './groupedList';

/**
 * Baseline that only shrinks (UI audit 2026-11, package 0a-1b): `scripts/baselines/grouped-list.json` holds today's
 * hits per file. Strict on both sides. After removing hits, lower the file:
 *   UPDATE_BASELINES=1 npx vitest run scripts/lib/groupedList.test.ts
 * (a raised number or a new file key is a ratchet hit: name it in the PR text, docs/howto/ci.md).
 */
const NAME = 'grouped-list';
const WHAT = '<ul>/<ol> with an ItemRow in src/modules/**/*.tsx outside GroupedList';
const files = () => moduleFiles(isModuleSource);

describe('findBareLists (what counts as a hit)', () => {
  it('a list with an ItemRow is a hit, also through map, a fragment or a wrapper', () => {
    expect(findBareLists('const a = (\n  <ul>\n    <ItemRow title="x" />\n  </ul>\n);')).toEqual([
      { line: 2, tag: 'ul' },
    ]);
    expect(
      findBareLists('const a = <ol>{rows.map((r) => <ItemRow key={r.id} title={r.t} />)}</ol>;'),
    ).toEqual([{ line: 1, tag: 'ol' }]);
    expect(
      findBareLists(
        'const a = <ul>{rows.map((r) => (<li key={r.id}><ItemRow>x</ItemRow></li>))}</ul>;',
      ),
    ).toHaveLength(1);
    expect(findBareLists('const a = <ul className={s.l}><><ItemRow /></></ul>;')).toHaveLength(1);
    expect(findBareLists('const a = <Card><ul><ItemRow /></ul></Card>;')).toHaveLength(1);
  });

  it('inside a GroupedList it is not a hit, at any depth', () => {
    expect(findBareLists('const a = <GroupedList><ul><ItemRow /></ul></GroupedList>;')).toEqual([]);
    expect(
      findBareLists(
        'const a = <GroupedList groups={g} renderItem={(r) => <ul><ItemRow title={r.t} /></ul>} />;',
      ),
    ).toEqual([]);
    expect(
      findBareLists(
        'const a = <GroupedList><div>{x ? <ol><ItemRow /></ol> : null}</div></GroupedList>;',
      ),
    ).toEqual([]);
    expect(
      findBareLists(
        'const a = <><GroupedList><ul><ItemRow /></ul></GroupedList><ul><ItemRow /></ul></>;',
      ),
    ).toHaveLength(1);
  });

  it('a list without an ItemRow, an ItemRow without a list, comments and strings are not hits', () => {
    expect(findBareLists('const a = <ul><li>x</li></ul>;')).toEqual([]);
    expect(findBareLists('const a = <div><ItemRow /></div>;')).toEqual([]);
    expect(findBareLists('const a = <ul><ItemRowish /><MyItemRow /></ul>;')).toEqual([]);
    expect(findBareLists('// <ul><ItemRow /></ul>\nconst a = "<ul><ItemRow /></ul>";')).toEqual([]);
  });

  it('nested lists: each one that holds an ItemRow counts once', () => {
    expect(findBareLists('const a = <ul><li><ol><ItemRow /></ol></li></ul>;')).toEqual([
      { line: 1, tag: 'ul' },
      { line: 1, tag: 'ol' },
    ]);
    expect(findBareLists('const a = <ul><ItemRow /><li><ol><li /></ol></li></ul>;')).toHaveLength(
      1,
    );
  });
});

describe(`scripts/baselines/${NAME}.json`, () => {
  it('holds exactly the hits of today, file by file: no new one, and a removed one lowers the file', () => {
    const actual = countPerFile(files(), (source) => findBareLists(source).length);
    if (process.env.UPDATE_BASELINES === '1')
      writeFileSync(
        baselineFile(NAME),
        `${JSON.stringify({ version: 1, what: WHAT, total: sum(actual), files: actual }, null, 2)}\n`,
      );
    const baseline = readBaseline(NAME);
    const { over, under } = diffBaseline(baseline.files, actual);
    expect(
      over,
      `new hits (${WHAT}): group the rows with GroupedList from @/ui (docs/howto/design-rules.md)`,
    ).toEqual([]);
    expect(
      under,
      `fewer hits than scripts/baselines/${NAME}.json says: lower the baseline (UPDATE_BASELINES=1 npx vitest run scripts/lib/groupedList.test.ts)`,
    ).toEqual([]);
    expect(baseline.total, 'total = sum of the files').toBe(sum(baseline.files));
    expect(files().length, 'the counter found no files to read').toBeGreaterThan(20);
  });

  it('reads every component file of a module, not only its routes', () => {
    const all = files();
    for (const folder of ['routes', 'components', 'widgets'])
      expect(
        all.some((f) => f.includes(`/${folder}/`)),
        folder,
      ).toBe(true);
    expect(isModuleSource('modules/calendar/components/Agenda.tsx')).toBe(true);
    expect(isModuleSource('modules/calendar/widget.tsx')).toBe(true);
    expect(isModuleSource('modules/calendar/__tests__/Agenda.tsx')).toBe(false);
    expect(isModuleSource('modules/calendar/components/Agenda.test.tsx')).toBe(false);
    expect(isModuleSource('modules/calendar/logic.ts')).toBe(false);
    expect(isModuleSource('ui/ItemList.tsx')).toBe(false);
  });

  it('the comparison is strict on both sides', () => {
    expect(diffBaseline({ 'a.x': 2, 'b.x': 1 }, { 'a.x': 2, 'b.x': 1 })).toEqual({
      over: [],
      under: [],
    });
    expect(diffBaseline({ 'a.x': 2 }, { 'a.x': 3, 'c.x': 1 }).over).toEqual([
      'a.x: 2 → 3',
      'c.x: 0 → 1',
    ]);
    expect(diffBaseline({ 'a.x': 2, 'b.x': 1 }, { 'a.x': 1 }).under).toEqual([
      'a.x: 2 → 1',
      'b.x: 1 → 0',
    ]);
  });
});
