/** "umrechnen 5 km", "convert 70 f": a quick conversion typed into the search bar. */
import { formatNumber } from '@/core/i18n/format';
import { evaluate, CalcError } from '@/core/calc/expr';
import { convert, UNITS, type UnitKind } from './logic';

const PATTERN = /^(?:umrechnen|convert|convertir|converter)\s+(-?[\d.,]+)\s*([a-z0-9/°]+)$/i;

/** Units the answer lists, per kind (the source unit is left out). */
const TARGETS: Record<UnitKind, string[]> = {
  length: ['m', 'km', 'cm', 'in', 'ft', 'mi'],
  mass: ['kg', 'g', 'lb', 'oz'],
  temperature: ['c', 'f', 'k'],
  volume: ['l', 'ml', 'gal', 'cup'],
  speed: ['kmh', 'mph', 'ms', 'kn'],
};
const MAX_TARGETS = 3;

/** Spellings people type besides the unit id. */
const ALIASES: Record<string, string> = {
  '°c': 'c',
  '°f': 'f',
  'km/h': 'kmh',
  'm/s': 'ms',
  'l/100': 'l',
  pfund: 'lb',
  zoll: 'in',
  meile: 'mi',
  meilen: 'mi',
  fuss: 'ft',
  fuß: 'ft',
};

function findUnit(token: string): { kind: UnitKind; id: string } | undefined {
  const id = ALIASES[token.toLowerCase()] ?? token.toLowerCase();
  for (const kind of Object.keys(UNITS) as UnitKind[]) {
    if (UNITS[kind].some((u) => u.id === id)) return { kind, id };
  }
  return undefined;
}

/** One line "5 km = 5.000 m · 3,11 mi · 16.404 ft" and the plain text to copy, or `undefined`. */
export function convertQuery(query: string): { text: string; copy: string } | undefined {
  const m = PATTERN.exec(query.trim());
  if (!m) return undefined;
  let value: number;
  try {
    value = evaluate(m[1]!);
  } catch (e) {
    if (e instanceof CalcError) return undefined;
    throw e;
  }
  const from = findUnit(m[2]!);
  if (!from) return undefined;
  const parts: string[] = [];
  let firstRaw: number | undefined;
  for (const id of TARGETS[from.kind]) {
    if (id === from.id) continue;
    const out = convert(from.kind, from.id, id, value);
    if (out === undefined) continue;
    firstRaw ??= out;
    parts.push(`${formatNumber(out, { maximumFractionDigits: 4 })} ${id}`);
    if (parts.length === MAX_TARGETS) break;
  }
  if (parts.length === 0) return undefined;
  const head = `${formatNumber(value, { maximumFractionDigits: 4 })} ${from.id}`;
  // Plain number with a dot, so it pastes into any field in any language.
  return {
    text: `${head} = ${parts.join(' · ')}`,
    copy: String(Math.round(firstRaw! * 1e4) / 1e4),
  };
}
