import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  baselineFile,
  countPerFile,
  diffBaseline,
  srcFiles,
  readBaseline,
  sum,
} from './baseline';
import { findCssMotion, transitionProperties } from './cssMotion';

/**
 * Baseline that only shrinks (UI audit 2026-11, follow-up to package 0a): `scripts/baselines/css-motion.json`
 * holds today's hits per file. Strict on both sides. After removing hits, lower the file:
 *   UPDATE_BASELINES=1 npx vitest run scripts/lib/cssMotion.test.ts
 * (a raised number or a new file key is a ratchet hit: name it in the PR text, docs/howto/ci.md).
 */
const NAME = 'css-motion';
const WHAT =
  'transition entries and @keyframes declarations in src/**/*.css that move something else than transform/opacity';
// Every stylesheet of the app, not only the modules': the 4.0 packages build in `ui/` and `layout/` first.
const files = () => srcFiles((p) => /\.css$/.test(p));

describe('findCssMotion (what counts as a hit)', () => {
  it('a transition of another property is a hit, with line, selector and property', () => {
    expect(findCssMotion('.fill {\n  height: 100%;\n  transition: width 150ms;\n}')).toEqual([
      { line: 3, selector: '.fill', property: 'width', via: 'transition' },
    ]);
    expect(findCssMotion('.a { transition-property: background-color; }')).toEqual([
      { line: 1, selector: '.a', property: 'background-color', via: 'transition' },
    ]);
    expect(findCssMotion('.a{TRANSITION:Height .2s ease-in-out}')).toHaveLength(1);
    expect(findCssMotion('.a { transition: color 1s !important; }')).toHaveLength(1);
  });

  it('every entry of a list counts by itself', () => {
    expect(
      findCssMotion(
        '.a { transition: opacity 1s, width 1s cubic-bezier(0.2, 0, 0, 1), transform 1s, left 1s; }',
      ).map((h) => h.property),
    ).toEqual(['width', 'left']);
    expect(
      findCssMotion('.a { transition-property: transform, margin, opacity; }').map(
        (h) => h.property,
      ),
    ).toEqual(['margin']);
  });

  it('`all` and an entry without a property are hits (they move everything)', () => {
    expect(findCssMotion('.a { transition: all 200ms; }')[0]?.property).toBe('all');
    expect(findCssMotion('.a { transition: 200ms ease; }')[0]?.property).toBe('all');
    expect(findCssMotion('.a { transition: var(--dur-fast); }')[0]?.property).toBe('all');
    expect(findCssMotion('.a { transition: var(--motion); }')).toHaveLength(1);
    expect(findCssMotion('.a { transition: opacity 1s, 2s; }')).toHaveLength(1);
    expect(findCssMotion('.a { transition-property: all; }')).toHaveLength(1);
  });

  it('transform, opacity, the single transform properties and none are not hits', () => {
    expect(findCssMotion('.a { transition: transform var(--dur-fast) ease; }')).toEqual([]);
    expect(
      findCssMotion('.a { transition: opacity 150ms linear 20ms, transform 1s steps(4, end); }'),
    ).toEqual([]);
    expect(findCssMotion('.a { transition: translate 1s, scale 1s, rotate 1s; }')).toEqual([]);
    expect(findCssMotion('.a { transition: none; transition-property: none; }')).toEqual([]);
    expect(findCssMotion('.a { transition-duration: 1s; transition-delay: 0s; }')).toEqual([]);
    expect(
      findCssMotion('@media (prefers-reduced-motion: reduce) { .a { transition: none; } }'),
    ).toEqual([]);
  });

  it('@keyframes: a declaration of another property is a hit, transform and opacity are not', () => {
    expect(findCssMotion('@keyframes pop {\n  50% {\n    transform: scale(1.2);\n  }\n}')).toEqual(
      [],
    );
    expect(
      findCssMotion(
        '@keyframes in { from { opacity: 0; animation-timing-function: ease-out; } to { opacity: 1; } }',
      ),
    ).toEqual([]);
    expect(
      findCssMotion(
        '@keyframes grow {\n  from { width: 0; }\n  to { width: 100%; opacity: 1; }\n}',
      ),
    ).toEqual([
      { line: 2, selector: '@keyframes grow', property: 'width', via: 'keyframes' },
      { line: 3, selector: '@keyframes grow', property: 'width', via: 'keyframes' },
    ]);
    expect(findCssMotion('@keyframes hue { to { --hue: 200; } }')).toHaveLength(1);
    expect(
      findCssMotion('@media (min-width: 1px) { @keyframes x { to { left: 1px; } } }'),
    ).toHaveLength(1);
    expect(findCssMotion('@-webkit-keyframes x { to { background: red; } }')).toHaveLength(1);
    // After the block the same declaration is an ordinary one again.
    expect(findCssMotion('@keyframes x { to { opacity: 1; } }\n.a { width: 1px; }')).toEqual([]);
  });

  it('@media does not hide a hit; other declarations, comments and strings are not hits', () => {
    expect(
      findCssMotion('@media (min-width: 40rem) { .a { transition: width 1s; } }'),
    ).toHaveLength(1);
    expect(findCssMotion('.a { .b & { transition: top 1s; } }')).toHaveLength(1);
    expect(findCssMotion('.a { width: 10px; animation: pop 200ms ease-out; }')).toEqual([]);
    expect(findCssMotion('.a { --transition: width 1s; view-transition-name: x; }')).toEqual([]);
    expect(findCssMotion('.a { /* transition: width 1s; */ color: red; }')).toEqual([]);
    expect(findCssMotion('.a::before { content: "; transition: width 1s;"; }')).toEqual([]);
  });

  it('transitionProperties reads the shorthand and the long form', () => {
    expect(transitionProperties('width 150ms', true)).toEqual(['width']);
    expect(transitionProperties('.2s ease-in 0s opacity, 1s', true)).toEqual(['opacity', 'all']);
    expect(transitionProperties('transform, width', false)).toEqual(['transform', 'width']);
  });
});

describe(`scripts/baselines/${NAME}.json`, () => {
  it('holds exactly the hits of today, file by file: no new one, and a removed one lowers the file', () => {
    const actual = countPerFile(files(), (source) => findCssMotion(source).length);
    if (process.env.UPDATE_BASELINES === '1')
      writeFileSync(
        baselineFile(NAME),
        `${JSON.stringify({ version: 1, what: WHAT, total: sum(actual), files: actual }, null, 2)}\n`,
      );
    const baseline = readBaseline(NAME);
    const { over, under } = diffBaseline(baseline.files, actual);
    expect(
      over,
      `new hits (${WHAT}): animate transform or opacity only (docs/howto/design-rules.md)`,
    ).toEqual([]);
    expect(
      under,
      `fewer hits than scripts/baselines/${NAME}.json says: lower the baseline (UPDATE_BASELINES=1 npx vitest run scripts/lib/cssMotion.test.ts)`,
    ).toEqual([]);
    expect(baseline.total, 'total = sum of the files').toBe(sum(baseline.files));
    expect(files().length, 'the counter found no files to read').toBeGreaterThan(20);
  });
});
