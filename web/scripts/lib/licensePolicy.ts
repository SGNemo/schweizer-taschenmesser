/**
 * Licence allowlist for everything Nemo ships (npm, Cargo, Gradle, fonts, icons, models).
 * Not legal advice: it only fails the build when a licence is unknown or not on the list, so a person
 * has to look at it. Copyleft (GPL, AGPL, LGPL, EUPL, CC-BY-SA, …) is deliberately NOT allowed; a package
 * that offers it only as one choice of an `OR` expression passes through the permissive alternative.
 */

/** SPDX ids (case-insensitive compare) that may ship with the app. */
export const ALLOWED = [
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSL-1.0',
  'CC-BY-4.0', // content licence of data files; attribution is part of the list
  'CC0-1.0',
  'CDLA-Permissive-2.0',
  'ISC',
  'MIT',
  'MIT-0',
  'MPL-2.0', // file-level copyleft: unmodified third-party files, source is public
  'OFL-1.1', // fonts
  'Python-2.0',
  'Unicode-3.0',
  'Unlicense',
  'Zlib',
] as const;

/** Exceptions after a person looked at the package: `name` or `name@version` → why it is fine. */
export const EXCEPTIONS: Readonly<Record<string, string>> = {};

const allowed = new Set(ALLOWED.map((l) => l.toLowerCase()));
/** Old Cargo spellings and a few npm ones, mapped to SPDX. */
const ALIASES: Record<string, string> = {
  'mit/apache-2.0': 'MIT OR Apache-2.0',
  'apache-2.0/mit': 'Apache-2.0 OR MIT',
  'unlicense/mit': 'Unlicense OR MIT',
  'bsd-3-clause/mit': 'BSD-3-Clause OR MIT',
  'apache-2.0 / mit': 'Apache-2.0 OR MIT',
};

export interface Verdict {
  ok: boolean;
  /** Ids that are not on the allowlist (empty when ok). */
  rejected: string[];
}

type Node = { kind: 'id'; id: string } | { kind: 'op'; op: 'AND' | 'OR'; l: Node; r: Node };

function parse(expr: string): Node {
  const tokens = expr
    .replace(/([()])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean);
  let i = 0;
  const primary = (): Node => {
    const t = tokens[i++];
    if (t === undefined) throw new Error(`incomplete licence expression "${expr}"`);
    if (t === '(') {
      const n = or();
      if (tokens[i++] !== ')') throw new Error(`unbalanced licence expression "${expr}"`);
      return n;
    }
    let id = t.replace(/\+$/, '');
    // `Apache-2.0 WITH LLVM-exception`: the exception only widens the licence, the base id decides.
    if (tokens[i]?.toUpperCase() === 'WITH') i += 2;
    if (id.toUpperCase() === 'AND' || id.toUpperCase() === 'OR' || id === ')') {
      throw new Error(`malformed licence expression "${expr}"`);
    }
    id = id.replace(/-or-later$|-only$/i, '');
    return { kind: 'id', id };
  };
  const and = (): Node => {
    let n = primary();
    while (tokens[i]?.toUpperCase() === 'AND') {
      i++;
      n = { kind: 'op', op: 'AND', l: n, r: primary() };
    }
    return n;
  };
  const or = (): Node => {
    let n = and();
    while (tokens[i]?.toUpperCase() === 'OR') {
      i++;
      n = { kind: 'op', op: 'OR', l: n, r: and() };
    }
    return n;
  };
  const n = or();
  if (i !== tokens.length) throw new Error(`malformed licence expression "${expr}"`);
  return n;
}

function rejectedIn(n: Node): string[] {
  if (n.kind === 'id') return allowed.has(n.id.toLowerCase()) ? [] : [n.id];
  const l = rejectedIn(n.l);
  const r = rejectedIn(n.r);
  // OR: one allowed alternative is enough. AND: every part has to be allowed.
  return n.op === 'OR' ? (l.length === 0 || r.length === 0 ? [] : [...l, ...r]) : [...l, ...r];
}

/** Whether an SPDX expression (`MIT OR Apache-2.0`, `(MIT AND Zlib)`, `Apache-2.0/MIT`) is allowed. */
export function checkLicense(expression: string): Verdict {
  const raw = expression.trim();
  if (!raw || /^(unknown|unlicensed|see license.*|custom.*)$/i.test(raw)) {
    return { ok: false, rejected: [raw || '(none)'] };
  }
  try {
    const rejected = [...new Set(rejectedIn(parse(ALIASES[raw.toLowerCase()] ?? raw)))];
    return { ok: rejected.length === 0, rejected };
  } catch {
    return { ok: false, rejected: [raw] };
  }
}
