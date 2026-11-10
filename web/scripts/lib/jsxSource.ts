import ts from 'typescript';

/**
 * JSX facts read from source text with the TypeScript parser (no type check, no program): the baselines
 * `groupedList` and `ownH1` (UI audit 2026-11, package 0a-1b) count elements, and a parser does not trip
 * over a `<ul` in a comment, a string or a generic.
 */
export interface JsxHit {
  /** 1-based line of the opening tag. */
  line: number;
  tag: string;
}

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

export function parseTsx(source: string, file = 'x.tsx'): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

export const tagOf = (el: Opening): string => el.tagName.getText();

export function openingOf(node: ts.Node): Opening | undefined {
  if (ts.isJsxElement(node)) return node.openingElement;
  if (ts.isJsxSelfClosingElement(node)) return node;
  return undefined;
}

export const lineOf = (file: ts.SourceFile, node: ts.Node): number =>
  file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;

/** True if `node` or anything below it is a JSX element with one of `tags`. */
export function containsTag(node: ts.Node, tags: readonly string[]): boolean {
  const el = openingOf(node);
  if (el && tags.includes(tagOf(el))) return true;
  return ts.forEachChild(node, (child) => containsTag(child, tags) || undefined) ?? false;
}
