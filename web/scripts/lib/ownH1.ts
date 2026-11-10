import ts from 'typescript';
import { lineOf, openingOf, parseTsx, tagOf, type JsxHit } from './jsxSource';

/**
 * Counts the `<h1>` elements a module route writes itself (UI audit 2026-11, package 0a-1b). The page
 * title is the `PageTitle` of the shell (`PageHeader` hands it over, `layout/pageTitle.test.tsx`), so every
 * own `<h1>` in `src/modules/**\/routes` is on a baseline that only shrinks
 * (`scripts/baselines/own-h1.json`). A hit is a JSX element named `h1`; `PageTitle` and `PageHeader` are not.
 */
export function findOwnH1(source: string): JsxHit[] {
  const file = parseTsx(source);
  const hits: JsxHit[] = [];
  const visit = (node: ts.Node): void => {
    const el = openingOf(node);
    if (el && tagOf(el) === 'h1') hits.push({ line: lineOf(file, el), tag: 'h1' });
    ts.forEachChild(node, visit);
  };
  visit(file);
  return hits;
}
