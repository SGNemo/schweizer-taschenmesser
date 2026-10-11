/**
 * Finds UI texts read at module load time: a property chain on `t` (or on a module-level alias of a
 * part of `t`, e.g. `const s = t.settings`) that is evaluated outside any function. Such a value is
 * read once at import and does not follow a language switch. Inside functions, getters and class
 * members the read happens at call time and is fine.
 */
import ts from 'typescript';

export interface Capture {
  line: number;
  text: string;
}

const isFunctionLike = (n: ts.Node) =>
  ts.isFunctionLike(n) || ts.isClassStaticBlockDeclaration(n) || ts.isGetAccessor(n);

/** Root identifier of `a.b.c` / `a['b'].c`, or undefined. */
function rootOf(e: ts.Expression): string | undefined {
  let cur: ts.Expression = e;
  while (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur))
    cur = cur.expression;
  return ts.isIdentifier(cur) ? cur.text : undefined;
}

export function findCaptures(fileName: string, source: string, roots = ['t']): Capture[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const aliases = new Set(roots);
  // Module-level `const s = t.x.y` aliases (objects, not leaves) – collected first.
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer) {
        const init = d.initializer;
        if (
          (ts.isPropertyAccessExpression(init) || ts.isIdentifier(init)) &&
          aliases.has(rootOf(init) ?? '')
        )
          aliases.add(d.name.text);
      }
    }
  }
  const out: Capture[] = [];
  const visit = (n: ts.Node, inFn: boolean) => {
    if (isFunctionLike(n)) inFn = true;
    if (!inFn && (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n))) {
      const parent = n.parent;
      const isOuter = !(
        (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
        parent.expression === n
      );
      const r = rootOf(n);
      // A whole alias initializer (`const s = t.settings`) is not a read of a text.
      const isAliasInit =
        ts.isVariableDeclaration(parent) &&
        ts.isIdentifier(parent.name) &&
        aliases.has(parent.name.text);
      // `Object.keys(t.x)` only reads keys, which do not depend on the language.
      const isKeysOnly =
        ts.isCallExpression(parent) && /^Object\.keys$/.test(parent.expression.getText());
      if (isOuter && r && aliases.has(r) && !isAliasInit && !isKeysOnly) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
        out.push({ line: line + 1, text: n.getText().slice(0, 80) });
        return;
      }
    }
    ts.forEachChild(n, (c) => visit(c, inFn));
  };
  visit(sf, false);
  return out;
}
