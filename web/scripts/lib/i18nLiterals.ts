/**
 * Finds UI text written into code instead of `src/strings.ts`: string literals and template texts
 * that look like German prose (an umlaut or ß, or a common German word). Identifiers, CSS classes,
 * import paths, object keys and `id`-like values are ignored. Used by `npm run check:i18n`.
 */
import ts from 'typescript';

export interface Literal {
  line: number;
  text: string;
}

const GERMAN_WORDS =
  /\b(der|die|das|und|oder|nicht|kein|keine|mit|für|von|auf|ist|sind|wird|werden|bitte|noch|alle|neue?[nrs]?|anlegen|löschen|speichern|abbrechen|heute|morgen|gestern|täglich|wöchentlich|monatlich|jährlich|Tage?n?|Wochen?|Monate?n?|Jahre?n?|Stunden?|Minuten?|Erinnerung|Eintrag|Einträge|Fehler|Einstellungen)\b/;
const UMLAUT = /[äöüÄÖÜß]/;

/** Properties whose string values are data, not UI text. */
const DATA_KEYS = new Set([
  'id',
  'key',
  'icon',
  'path',
  'to',
  'href',
  'className',
  'type',
  'kind',
  'collection',
  'module',
  'area',
  'category',
  'variant',
  'tone',
  'size',
  'layout',
  'name', // form field names; UI names come from `t`
]);

export function looksGerman(s: string): boolean {
  const text = s.trim();
  if (text.length < 3 || !/[a-zA-ZäöüÄÖÜß]/.test(text)) return false;
  return UMLAUT.test(text) || GERMAN_WORDS.test(text);
}

function isIgnoredContext(n: ts.Node): boolean {
  const p = n.parent;
  if (!p) return false;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === n) return true;
  if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && DATA_KEYS.has(p.name.text)) return true;
  if (ts.isJsxAttribute(p) && DATA_KEYS.has(p.name.getText())) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return true;
  // console.* and thrown developer errors are logs, not UI.
  if (ts.isCallExpression(p) && /^console\./.test(p.expression.getText())) return true;
  if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())) return true;
  return false;
}

export function findLiterals(fileName: string, source: string): Literal[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Literal[] = [];
  const add = (n: ts.Node, text: string) => {
    if (!looksGerman(text)) return;
    const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
    out.push({ line: line + 1, text: text.trim().slice(0, 80) });
  };
  const visit = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !isIgnoredContext(n)) add(n, n.text);
    else if (ts.isTemplateExpression(n) && !isIgnoredContext(n)) {
      add(n, [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' '));
      n.templateSpans.forEach((s) => visit(s.expression));
      return;
    } else if (ts.isJsxText(n)) add(n, n.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
