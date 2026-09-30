/**
 * A small, safe calculator: numbers, + − × ÷ ^, parentheses, percent, sqrt/pi. It is a hand-written
 * parser – nothing is ever passed to `eval` or `Function`. German input: the comma is the decimal
 * mark; dots are thousands separators when they fit that pattern ("1.234,56", "1.000") and a decimal
 * point otherwise ("12.5", "0.75"). Unary minus binds weaker than ^ (−2^2 = −4).
 *
 * Percent: `a + b%` and `a − b%` mean "b percent of a" (240 + 19% = 285,6); anywhere else `b%` is
 * the fraction b/100 (240 × 19% = 45,6).
 */

export type CalcErrorCode = 'syntax' | 'divide-by-zero' | 'range' | 'empty';

export class CalcError extends Error {
  constructor(readonly code: CalcErrorCode) {
    super(code);
    this.name = 'CalcError';
  }
}

type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: 'pct' }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'fn'; v: 'sqrt' }
  | { t: 'const'; v: number };

const MAX_LENGTH = 200;

const THOUSANDS = /^[1-9]\d{0,2}(?:\.\d{3})+$/;

function parseNumber(text: string): number {
  let s = text;
  if (s.includes(',')) s = s.replaceAll('.', '').replace(',', '.');
  else if (THOUSANDS.test(s)) s = s.replaceAll('.', '');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new CalcError('syntax');
  return n;
}

function tokenize(input: string): Token[] {
  const s = input
    .replaceAll('×', '*')
    .replaceAll('·', '*')
    .replaceAll('÷', '/')
    .replaceAll(':', '/')
    .replaceAll('−', '-')
    .replaceAll('–', '-')
    .replace(/\s+/g, '')
    .toLowerCase();
  if (s === '') throw new CalcError('empty');
  if (s.length > MAX_LENGTH) throw new CalcError('syntax');
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    const number = /^(?:[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?|[.,]\d+)/.exec(
      s.slice(i),
    );
    if (number) {
      out.push({ t: 'num', v: parseNumber(number[0]) });
      i += number[0].length;
    } else if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      out.push({ t: 'op', v: c });
      i += 1;
    } else if (c === '%') {
      out.push({ t: 'pct' });
      i += 1;
    } else if (c === '(') {
      out.push({ t: 'lp' });
      i += 1;
    } else if (c === ')') {
      out.push({ t: 'rp' });
      i += 1;
    } else if (s.startsWith('sqrt', i) || s.startsWith('wurzel', i)) {
      out.push({ t: 'fn', v: 'sqrt' });
      i += s.startsWith('sqrt', i) ? 4 : 6;
    } else if (s.startsWith('pi', i) || s.startsWith('π', i)) {
      out.push({ t: 'const', v: Math.PI });
      i += s.startsWith('pi', i) ? 2 : 1;
    } else throw new CalcError('syntax');
  }
  return out;
}

/** Value with a flag: was it written as "x%"? (needed for `a ± b%`). */
interface Val {
  v: number;
  pct: boolean;
}

class Parser {
  private i = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.i];
  }
  private next(): Token | undefined {
    return this.tokens[this.i++];
  }

  parse(): number {
    const v = this.expr();
    if (this.i < this.tokens.length) throw new CalcError('syntax');
    return v.pct ? v.v / 100 : v.v;
  }

  private expr(): Val {
    let left = this.term();
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op' || (t.v !== '+' && t.v !== '-')) return left;
      this.next();
      const right = this.term();
      const base = left.pct ? left.v / 100 : left.v;
      // "a ± b%" is relative to a.
      const delta = right.pct ? (base * right.v) / 100 : right.v;
      left = { v: t.v === '+' ? base + delta : base - delta, pct: false };
    }
  }

  private term(): Val {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t?.t !== 'op' || (t.v !== '*' && t.v !== '/')) return left;
      this.next();
      const right = this.unary();
      const a = left.pct ? left.v / 100 : left.v;
      const b = right.pct ? right.v / 100 : right.v;
      if (t.v === '/' && b === 0) throw new CalcError('divide-by-zero');
      left = { v: t.v === '*' ? a * b : a / b, pct: false };
    }
  }

  private power(): Val {
    const base = this.postfix();
    const t = this.peek();
    if (t?.t === 'op' && t.v === '^') {
      this.next();
      const exp = this.unary(); // right associative, and 2^-2 works
      const a = base.pct ? base.v / 100 : base.v;
      const b = exp.pct ? exp.v / 100 : exp.v;
      const r = a ** b;
      if (!Number.isFinite(r)) throw new CalcError('range');
      return { v: r, pct: false };
    }
    return base;
  }

  private unary(): Val {
    const t = this.peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) {
      this.next();
      const v = this.unary();
      return { v: t.v === '-' ? -v.v : v.v, pct: v.pct };
    }
    return this.power();
  }

  private postfix(): Val {
    let v = this.primary();
    while (this.peek()?.t === 'pct') {
      this.next();
      v = v.pct ? { v: v.v / 100, pct: true } : { v: v.v, pct: true };
    }
    return v;
  }

  private primary(): Val {
    const t = this.next();
    if (!t) throw new CalcError('syntax');
    if (t.t === 'num') return { v: t.v, pct: false };
    if (t.t === 'const') return { v: t.v, pct: false };
    if (t.t === 'lp') {
      const inner = this.expr();
      if (this.next()?.t !== 'rp') throw new CalcError('syntax');
      return inner;
    }
    if (t.t === 'fn') {
      if (this.next()?.t !== 'lp') throw new CalcError('syntax');
      const inner = this.expr();
      if (this.next()?.t !== 'rp') throw new CalcError('syntax');
      const x = inner.pct ? inner.v / 100 : inner.v;
      if (x < 0) throw new CalcError('range');
      return { v: Math.sqrt(x), pct: false };
    }
    throw new CalcError('syntax');
  }
}

/** Removes floating point noise (0.1 + 0.2) without hiding real precision. */
const clean = (n: number): number => Number(n.toPrecision(12));

export function evaluate(input: string): number {
  const result = new Parser(tokenize(input)).parse();
  if (!Number.isFinite(result) || Math.abs(result) > 1e15) throw new CalcError('range');
  return clean(result);
}

const de = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });
/** "1234.5" → "1.234,5" */
export const formatNumber = (n: number): string => de.format(n);
