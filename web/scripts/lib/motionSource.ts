import ts from 'typescript';
import { lineOf, parseTsx } from './jsxSource';

/**
 * Motion started from script (UI audit 2026-11, package 0a-1b). CSS motion is held to `transform` / `opacity`
 * and to the reduced-motion switch by the tokens and their tests; a Web Animations call or a view transition
 * written in a component passes all of them unseen. So `.animate(` and `startViewTransition` are allowed in
 * a motion helper only: one place that asks for reduced motion and animates nothing but `transform` and
 * `opacity`.
 *
 * A hit is a call of a member named `animate` (`el.animate(…)`, `el?.animate(…)`, `el['animate'](…)`) and
 * every use of the name `startViewTransition` (called, read, passed on or as a string key). Comments and
 * other strings are not read.
 */
export interface MotionHit {
  /** 1-based line. */
  line: number;
  what: 'animate' | 'startViewTransition';
}

/**
 * The motion helpers, as posix paths relative to `src/`: `ui/motion.ts(x)` and everything under `ui/motion/`.
 * None exists yet; the first one arrives with the package that needs it.
 */
export const isMotionHelper = (path: string): boolean =>
  /^ui\/motion\.tsx?$/.test(path) || path.startsWith('ui/motion/');

export function findScriptMotion(source: string): MotionHit[] {
  const file = parseTsx(source);
  const hits: MotionHit[] = [];
  const named = (node: ts.Node, name: string): boolean =>
    (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && node.text === name;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        (ts.isPropertyAccessExpression(callee) && named(callee.name, 'animate')) ||
        (ts.isElementAccessExpression(callee) && named(callee.argumentExpression, 'animate'))
      )
        hits.push({ line: lineOf(file, node), what: 'animate' });
    }
    if (named(node, 'startViewTransition'))
      hits.push({ line: lineOf(file, node), what: 'startViewTransition' });
    ts.forEachChild(node, visit);
  };
  visit(file);
  return hits;
}
