import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  baselineFile,
  countPerFile,
  diffBaseline,
  isRouteSource,
  moduleFiles,
  readBaseline,
  sum,
} from './baseline';
import { findOwnH1 } from './ownH1';

/**
 * Baseline that only shrinks (UI audit 2026-11, package 0a-1b): `scripts/baselines/own-h1.json` holds today's
 * hits per file. Strict on both sides. After removing hits, lower the file:
 *   UPDATE_BASELINES=1 npx vitest run scripts/lib/ownH1.test.ts
 * (a raised number or a new file key is a ratchet hit: name it in the PR text, docs/howto/ci.md).
 */
const NAME = 'own-h1';
const WHAT = 'own <h1> elements in src/modules/**/routes';
const files = () => moduleFiles(isRouteSource);

describe('findOwnH1 (what counts as a hit)', () => {
  it('an h1 element is a hit, with its line', () => {
    expect(findOwnH1('const a = (\n  <h1 className={s.title}>{title}</h1>\n);')).toEqual([
      { line: 2, tag: 'h1' },
    ]);
    expect(findOwnH1('const a = <div>{x ? <h1>a</h1> : <h1 />}</div>;')).toHaveLength(2);
  });

  it('the shell title, other headings, comments and strings are not hits', () => {
    expect(findOwnH1('const a = <PageHeader title={t.x.title} />;')).toEqual([]);
    expect(findOwnH1('const a = <PageTitle>{title}</PageTitle>;')).toEqual([]);
    expect(findOwnH1('const a = <><h2>a</h2><h10>b</h10><H1>c</H1></>;')).toEqual([]);
    expect(findOwnH1('// <h1>x</h1>\nconst a = "<h1>x</h1>"; const b = `<h1>${a}</h1>`;')).toEqual(
      [],
    );
  });
});

describe(`scripts/baselines/${NAME}.json`, () => {
  it('holds exactly the hits of today, file by file: no new one, and a removed one lowers the file', () => {
    const actual = countPerFile(files(), (source) => findOwnH1(source).length);
    if (process.env.UPDATE_BASELINES === '1')
      writeFileSync(
        baselineFile(NAME),
        `${JSON.stringify({ version: 1, what: WHAT, total: sum(actual), files: actual }, null, 2)}\n`,
      );
    const baseline = readBaseline(NAME);
    const { over, under } = diffBaseline(baseline.files, actual);
    expect(
      over,
      `new hits (${WHAT}): the page title is the PageTitle of the shell: use PageHeader, or a lower heading level`,
    ).toEqual([]);
    expect(
      under,
      `fewer hits than scripts/baselines/${NAME}.json says: lower the baseline (UPDATE_BASELINES=1 npx vitest run scripts/lib/ownH1.test.ts)`,
    ).toEqual([]);
    expect(baseline.total, 'total = sum of the files').toBe(sum(baseline.files));
    expect(files().length, 'the counter found no files to read').toBeGreaterThan(20);
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
