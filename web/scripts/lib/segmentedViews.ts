import ts from 'typescript';
import { containsTag, lineOf, parseTsx, type JsxHit } from './jsxSource';

/**
 * Counts view switches built with `Segmented` (UI audit 2026-11, Identity 4.0, package 0b-1). The views of a
 * page are `Tabs` from `@/ui`, a `Segmented` is a filter inside a view. Today's hits stand on a baseline that
 * only shrinks (`scripts/baselines/segmented-views.json`); the area packages (0b-3 … 0b-6) move them over
 * (`Tabs` takes the props of `Segmented`: `value`, `options`, `onChange`).
 *
 * A hit is a JSX attribute named `views` (the view slot of `PageHeader`) with a `<Segmented>` element
 * anywhere in its value, one hit per attribute. Read from the text of one file: a `Segmented` that arrives
 * in the slot through a variable or another component is not seen, and neither is a view switch that sits
 * outside the slot (in a toolbar): reviewers look at those.
 */
export function findSegmentedViews(source: string): JsxHit[] {
  const file = parseTsx(source);
  const hits: JsxHit[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(file) === 'views' &&
      node.initializer &&
      containsTag(node.initializer, ['Segmented'])
    )
      hits.push({ line: lineOf(file, node), tag: 'Segmented' });
    ts.forEachChild(node, visit);
  };
  visit(file);
  return hits;
}
