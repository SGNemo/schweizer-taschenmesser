import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  baselineFile,
  countPerFile,
  diffBaseline,
  moduleFiles,
  readBaseline,
  sum,
} from './baseline';
import { findMaxWidth } from './maxWidth';

/**
 * Baseline that only shrinks (UI audit 2026-11, package 0a-1b): `scripts/baselines/max-width.json` holds today's
 * hits per file. Strict on both sides. After removing hits, lower the file:
 *   UPDATE_BASELINES=1 npx vitest run scripts/lib/maxWidth.test.ts
 * (a raised number or a new file key is a ratchet hit: name it in the PR text, docs/howto/ci.md).
 */
const NAME = 'max-width';
const WHAT = 'max-width declarations in src/modules/**/*.module.css outside @media and @container';
const files = () => moduleFiles((p) => /\.module\.css$/.test(p));

describe('findMaxWidth (what counts as a hit)', () => {
  it('a declaration in a rule is a hit, with line, selector and value', () => {
    expect(findMaxWidth('.a {\n  color: red;\n  max-width: 60ch;\n}')).toEqual([
      { line: 3, selector: '.a', value: '60ch' },
    ]);
    expect(findMaxWidth('.a { max-width: 14rem }')).toHaveLength(1);
    expect(findMaxWidth('.a{max-width:min(100%, 20rem);min-width:0}')).toHaveLength(1);
    expect(findMaxWidth('.a { MAX-WIDTH : 10px; }\n.b { max-width: 1px; }')).toHaveLength(2);
  });

  it('other at-rules and nesting do not hide a declaration', () => {
    expect(findMaxWidth('@supports (display: grid) { .a { max-width: 1rem; } }')).toHaveLength(1);
    expect(findMaxWidth('@layer x { .a { max-width: 1rem; } }')).toHaveLength(1);
    expect(findMaxWidth('.a { .b & { max-width: 1rem; } }')).toHaveLength(1);
    expect(findMaxWidth('.a { color: red; &:hover { color: blue; } max-width: 1rem; }')).toEqual([
      { line: 1, selector: '.a', value: '1rem' },
    ]);
  });

  it('inside @media or @container it is not a hit, at any depth; after the block it is one again', () => {
    expect(findMaxWidth('@media (max-width: 40rem) { .a { max-width: 100%; } }')).toEqual([]);
    expect(findMaxWidth('@container (max-width: 40rem) { .a { max-width: 100%; } }')).toEqual([]);
    expect(findMaxWidth('@container card (min-width: 1px) { .a { max-width: 1px } }')).toEqual([]);
    expect(findMaxWidth('.a { @media (min-width: 1px) { max-width: 1px; } }')).toEqual([]);
    expect(findMaxWidth('@media print { @supports (x: y) { .a { max-width: 1px; } } }')).toEqual(
      [],
    );
    expect(
      findMaxWidth('@media (max-width: 40rem) { .a { color: red; } }\n.b { max-width: 2rem; }'),
    ).toEqual([{ line: 2, selector: '.b', value: '2rem' }]);
  });

  it('the query, custom properties, other properties, comments and strings are not hits', () => {
    expect(findMaxWidth('@media (max-width: 40rem) { .a { color: red; } }')).toEqual([]);
    expect(findMaxWidth('.a { --card-max-width: 20rem; width: var(--card-max-width); }')).toEqual(
      [],
    );
    expect(findMaxWidth('.a { max-inline-size: 20rem; min-width: 0; }')).toEqual([]);
    expect(findMaxWidth('.a { /* max-width: 20rem; */ color: red; }')).toEqual([]);
    expect(findMaxWidth('.a::before { content: "; max-width: 1px;"; }')).toEqual([]);
    expect(findMaxWidth('/* { */ .a { max-width: 1px; } /* } */')).toHaveLength(1);
  });
});

describe(`scripts/baselines/${NAME}.json`, () => {
  it('holds exactly the hits of today, file by file: no new one, and a removed one lowers the file', () => {
    const actual = countPerFile(files(), (source) => findMaxWidth(source).length);
    if (process.env.UPDATE_BASELINES === '1')
      writeFileSync(
        baselineFile(NAME),
        `${JSON.stringify({ version: 1, what: WHAT, total: sum(actual), files: actual }, null, 2)}\n`,
      );
    const baseline = readBaseline(NAME);
    const { over, under } = diffBaseline(baseline.files, actual);
    expect(
      over,
      `new hits (${WHAT}): the page width comes from manifest.layout / PageContainer, a module sets no max-width (docs/RULES.md)`,
    ).toEqual([]);
    expect(
      under,
      `fewer hits than scripts/baselines/${NAME}.json says: lower the baseline (UPDATE_BASELINES=1 npx vitest run scripts/lib/maxWidth.test.ts)`,
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
