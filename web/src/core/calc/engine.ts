import type { BigNumber, MathJsInstance } from 'mathjs';
import { decimalSeparator, formatLocale, numberFormat } from '@/core/i18n/format';
import { CalcError, evaluate as evaluateBasic } from './expr';
import { normalizeNumbers, separatorsFor } from './numbers';

/**
 * Expression engine of the calculator and the command palette. The maths is done by mathjs (a
 * well-tested library, loaded on first use as its own chunk), configured for exact decimals
 * (BigNumber) and locked down: no `eval`, no `Function` from user input, no way to import, define
 * units or call the parser again, no matrix or range helpers that could allocate without limit.
 *
 * Input conventions (German first, others accepted): both decimal marks, `;` between function
 * arguments, `×`/`·`, `÷`/`:`, `−`, `√`, `π`, `²`/`³`; `a + b%` is relative to `a`; variables
 * (`a = 19%`), `ans`; trigonometry in degrees or radians. Offline and before the chunk is there,
 * the plain arithmetic parser (`expr.ts`) answers instead.
 */

export type AngleMode = 'deg' | 'rad';

export interface EvalOptions {
  angle?: AngleMode;
  /** Variables of this session; assignments (`a = 5`) and `ans` are written back. */
  vars?: Map<string, unknown>;
}

export interface EvalResult {
  /** Canonical text: '.' as decimal mark, no grouping ("1234.5", "5 inch"). */
  canonical: string;
  /** The same in the format locale ("1.234,5"). */
  display: string;
  /** Plain number when the result is one (possibly rounded to double precision). */
  value: number | undefined;
  /** True when the plain parser answered because the library was not available. */
  basic: boolean;
}

const MAX_LENGTH = 200;
const SIGNIFICANT = 15;
const FORBIDDEN_CHARS = /[[\]{}"'`\\?]/;
const HEAVY = /!|factorial|combinations|permutations|gamma|\bnC[rk]\b/i;
const BLOCKED = [
  'import',
  'createUnit',
  'evaluate',
  'parse',
  'compile',
  'simplify',
  'derivative',
  'resolve',
  'rationalize',
  'chain',
  'help',
  'reviver',
  'range',
  'zeros',
  'ones',
  'identity',
  'diag',
  'resize',
  'reshape',
  'sparse',
  'matrix',
  'random',
  'randomInt',
  'pickRandom',
];
const TRIG = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'] as const;
const ARC = ['asin', 'acos', 'atan'] as const;

type Math = MathJsInstance;
interface Loaded {
  math: Math;
  run: Math['evaluate'];
}
let loading: Promise<Loaded> | undefined;

function load(): Promise<Loaded> {
  loading ??= import('mathjs').then(({ create, all }) => {
    const math = create(all, { number: 'BigNumber', precision: 64 });
    const run = math.evaluate.bind(math);
    const blocked = (): never => {
      throw new CalcError('syntax');
    };
    math.import(Object.fromEntries(BLOCKED.map((n) => [n, blocked])), { override: true });
    return { math, run };
  });
  // A failed import is not retried forever: the next call tries again.
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}

/** Warms the chunk (e.g. when the tool opens) without waiting for it. */
export function preloadEngine(): void {
  void load().catch(() => undefined);
}

/** Symbols people type → what the library reads. Undefined for input it must not see. */
export function prepare(input: string): string | undefined {
  const s = input
    .replaceAll('×', '*')
    .replaceAll('·', '*')
    .replaceAll('÷', '/')
    .replaceAll(':', '/')
    .replaceAll('−', '-')
    .replaceAll('–', '-')
    .replaceAll(';', ',')
    .replace(/√\s*([0-9][0-9.,]*|pi|π)/g, 'sqrt($1)')
    .replaceAll('√', 'sqrt')
    .replaceAll('π', 'pi')
    .replaceAll('²', '^2')
    .replaceAll('³', '^3')
    .replace(/\bln\s*\(/gi, 'log(')
    .replace(/\blg\s*\(/gi, 'log10(')
    .replace(/\bwurzel\s*\(/gi, 'sqrt(')
    .trim();
  if (s === '') throw new CalcError('empty');
  if (s.length > MAX_LENGTH || FORBIDDEN_CHARS.test(s)) throw new CalcError('syntax');
  return normalizeNumbers(s, separatorsFor(formatLocale()));
}

function mapError(e: unknown): CalcError {
  if (e instanceof CalcError) return e;
  const msg = e instanceof Error ? e.message : '';
  if (/Undefined symbol|Undefined function/i.test(msg)) return new CalcError('unknown');
  if (/Units do not match|Unit .* not found|Unexpected type of argument.*Unit/i.test(msg)) {
    return new CalcError('unit');
  }
  if (/too large|too big|range/i.test(msg)) return new CalcError('range');
  return new CalcError('syntax');
}

type Num = BigNumber;

function plain(math: Math, v: unknown): { canonical: string; value: number | undefined } {
  if (math.isBigNumber(v)) {
    const n = v as Num;
    if (!n.isFinite()) throw new CalcError(n.isNaN() ? 'range' : 'divide-by-zero');
    const rounded = n.toSignificantDigits(SIGNIFICANT);
    const canonical =
      rounded.e >= 21 || rounded.e <= -7 ? rounded.toExponential() : rounded.toFixed();
    return { canonical, value: rounded.toNumber() };
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new CalcError('range');
    return { canonical: String(Number(v.toPrecision(SIGNIFICANT))), value: v };
  }
  if (typeof v === 'boolean') return { canonical: String(v), value: undefined };
  if (math.isUnit(v) || math.isFraction(v) || math.isComplex(v)) {
    const text = math.format(v, { notation: 'auto', precision: SIGNIFICANT });
    if (/[a-z]/i.test(text)) return { canonical: text, value: undefined };
    return { canonical: text, value: Number(text) };
  }
  throw new CalcError('syntax');
}

/** "1234567.5" → "1.234.567,5" in the format locale; non-numeric text only gets the decimal mark. */
export function localize(canonical: string): string {
  const m = /^(-?)([0-9]+)(?:\.([0-9]+))?(.*)$/.exec(canonical);
  if (!m) return canonical;
  const [, sign, int, frac, rest] = m as unknown as [string, string, string, string?, string?];
  const grouped = numberFormat({ useGrouping: true }).format(BigInt(int));
  return `${sign}${grouped}${frac ? decimalSeparator() + frac : ''}${rest ?? ''}`;
}

function finish(canonical: string, value: number | undefined, basic: boolean): EvalResult {
  return { canonical, display: localize(canonical), value, basic };
}

/** Evaluates `input`. Throws `CalcError` (typed) for everything the user can fix. */
export async function evaluateExpression(
  input: string,
  options: EvalOptions = {},
): Promise<EvalResult> {
  const prepared = prepare(input);
  if (prepared === undefined) throw new CalcError('syntax');
  if (
    HEAVY.test(prepared) &&
    (prepared.match(/[0-9]+(?:\.[0-9]+)?/g) ?? []).some((n) => Number(n) > 10_000)
  ) {
    throw new CalcError('range');
  }
  let lib: Loaded;
  try {
    lib = await load();
  } catch {
    // Offline before the first use: plain arithmetic still works.
    const value = evaluateBasic(prepared);
    return finish(String(value), value, true);
  }
  const { math, run } = lib;
  const vars = options.vars ?? new Map<string, unknown>();
  const scope = new Map<string, unknown>(vars);
  if (options.angle === 'deg') {
    const toRad = (x: unknown) =>
      math.isUnit(x) ? x : math.unit(math.bignumber(x as never), 'deg');
    for (const f of TRIG) {
      const fn = math[f] as (x: unknown) => unknown;
      scope.set(f, (x: unknown) => fn(toRad(x)));
    }
    for (const f of ARC) {
      const fn = math[f] as (x: unknown) => unknown;
      scope.set(f, (x: unknown) =>
        math.multiply(fn(x) as never, math.divide(math.bignumber(180), math.pi as never) as never),
      );
    }
  }
  const wrappers = new Set(scope.keys());
  for (const k of vars.keys()) wrappers.delete(k);
  let raw: unknown;
  try {
    raw = run(prepared, scope);
    if (typeof raw === 'function' || (raw && typeof raw === 'object' && 'entries' in raw)) {
      throw new CalcError('syntax');
    }
  } catch (e) {
    throw mapError(e);
  }
  const { canonical, value } = plain(math, raw);
  for (const [k, v] of scope) if (!wrappers.has(k)) vars.set(k, v);
  vars.set('ans', raw);
  return finish(canonical, value, false);
}
