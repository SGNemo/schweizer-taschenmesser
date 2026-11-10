import ts from 'typescript';
import { containsTag, lineOf, openingOf, parseTsx, tagOf, type JsxHit } from './jsxSource';

/**
 * Counts hand-built lists of a module (UI audit 2026-11, package 0a-1b). Lists are grouped through
 * `GroupedList` (CLAUDE.md, UI rules), so every `<ul>` / `<ol>` that holds an `ItemRow` in a component file
 * of `src/modules/**` (routes, components, widgets) outside a `GroupedList` is on a baseline that only
 * shrinks (`scripts/baselines/grouped-list.json`).
 *
 * A hit is a `<ul>` or `<ol>` element with an `<ItemRow>` anywhere in its JSX subtree (also inside a
 * `.map()` callback or a render prop written there) and no `<GroupedList>` element around it. One hit per
 * list: an inner list inside a counted one is counted by itself only if it holds an `ItemRow` too.
 * Read from the text of one file: an `ItemRow` that arrives through another component is not seen, and
 * neither is a list built with `ItemList` (it renders the `<ul>` itself): whether an ungrouped `ItemList`
 * counts is an open decision of package 0b.
 */
const LISTS = ['ul', 'ol'];

export function findBareLists(source: string): JsxHit[] {
  const file = parseTsx(source);
  const hits: JsxHit[] = [];
  const visit = (node: ts.Node, grouped: boolean): void => {
    const el = openingOf(node);
    const tag = el ? tagOf(el) : '';
    if (el && !grouped && LISTS.includes(tag) && containsTag(node, ['ItemRow']))
      hits.push({ line: lineOf(file, el), tag });
    ts.forEachChild(node, (child) => visit(child, grouped || tag === 'GroupedList'));
  };
  visit(file, false);
  return hits;
}
