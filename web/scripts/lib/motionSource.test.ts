import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SRC } from './baseline';
import { findScriptMotion, isMotionHelper } from './motionSource';

/** Source files under `src/` (no tests), as posix paths relative to it. */
const sources = (): string[] =>
  (readdirSync(SRC, { recursive: true }) as string[])
    .map((f) => f.split('\\').join('/'))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes('__tests__/'))
    .sort();

describe('findScriptMotion (what counts as a hit)', () => {
  it('a Web Animations call is a hit, however the member is reached', () => {
    expect(findScriptMotion('el.animate([{ opacity: 0 }, { opacity: 1 }], 200);')).toEqual([
      { line: 1, what: 'animate' },
    ]);
    expect(findScriptMotion('ref.current?.animate(frames, opts);')).toHaveLength(1);
    expect(findScriptMotion("const a = 1;\nel['animate'](frames);")).toEqual([
      { line: 2, what: 'animate' },
    ]);
    expect(findScriptMotion('const a = <div ref={(el) => el?.animate(k, 1)} />;')).toHaveLength(1);
  });

  it('a view transition is a hit: called, feature-tested, passed on or as a key', () => {
    expect(findScriptMotion('document.startViewTransition(() => update());')).toEqual([
      { line: 1, what: 'startViewTransition' },
    ]);
    expect(findScriptMotion("if ('startViewTransition' in document) run();")).toHaveLength(1);
    expect(
      findScriptMotion('const go = document.startViewTransition?.bind(document);'),
    ).toHaveLength(1);
    expect(findScriptMotion("document['startViewTransition'](cb);")).toHaveLength(1);
  });

  it('other names, a plain function, comments and unrelated strings are not hits', () => {
    expect(
      findScriptMotion('animate(el); const animate = 1; el.animated(); el.reanimate();'),
    ).toEqual([]);
    expect(findScriptMotion('const o = { animate: true }; o.animate;')).toEqual([]);
    expect(findScriptMotion('// el.animate(k)\n/* startViewTransition */ const a = 1;')).toEqual(
      [],
    );
    expect(
      findScriptMotion("const s = 'call el.animate(k) or use startViewTransition()';"),
    ).toEqual([]);
  });

  it('only ui/motion is a motion helper', () => {
    for (const p of ['ui/motion.ts', 'ui/motion.tsx', 'ui/motion/collapse.ts'])
      expect(isMotionHelper(p), p).toBe(true);
    for (const p of [
      'ui/motionless.ts',
      'modules/notes/ui/motion.ts',
      'layout/motion.ts',
      'ui/x.ts',
    ])
      expect(isMotionHelper(p), p).toBe(false);
  });
});

describe('script motion in src/', () => {
  it('no .animate( and no startViewTransition outside a motion helper', () => {
    const files = sources();
    expect(files.length).toBeGreaterThan(500);
    const hits = files
      .filter((f) => !isMotionHelper(f))
      .flatMap((f) =>
        findScriptMotion(readFileSync(resolve(SRC, f), 'utf8')).map(
          (h) => `${f}:${h.line} ${h.what}`,
        ),
      );
    expect(
      hits,
      'script-driven motion belongs in a motion helper (src/ui/motion*): it asks for reduced motion and animates transform/opacity only',
    ).toEqual([]);
  });
});
