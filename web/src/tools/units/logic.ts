/** Unit conversion tables. Linear kinds go through a base unit; temperature is special. */
import { t } from '@/strings';

export type UnitKind = 'length' | 'mass' | 'temperature' | 'volume' | 'speed';

export interface UnitDef {
  id: string;
  label: string;
  /** How many base units one of this unit is (linear kinds only). */
  factor?: number;
}

export const UNITS: Record<UnitKind, UnitDef[]> = {
  // base: metre
  length: [
    {
      id: 'mm',
      get label() {
        return t.tools.units.names['mm']!;
      },
      factor: 0.001,
    },
    {
      id: 'cm',
      get label() {
        return t.tools.units.names['cm']!;
      },
      factor: 0.01,
    },
    {
      id: 'm',
      get label() {
        return t.tools.units.names['m']!;
      },
      factor: 1,
    },
    {
      id: 'km',
      get label() {
        return t.tools.units.names['km']!;
      },
      factor: 1000,
    },
    {
      id: 'in',
      get label() {
        return t.tools.units.names['in']!;
      },
      factor: 0.0254,
    },
    {
      id: 'ft',
      get label() {
        return t.tools.units.names['ft']!;
      },
      factor: 0.3048,
    },
    {
      id: 'yd',
      get label() {
        return t.tools.units.names['yd']!;
      },
      factor: 0.9144,
    },
    {
      id: 'mi',
      get label() {
        return t.tools.units.names['mi']!;
      },
      factor: 1609.344,
    },
  ],
  // base: gram
  mass: [
    {
      id: 'mg',
      get label() {
        return t.tools.units.names['mg']!;
      },
      factor: 0.001,
    },
    {
      id: 'g',
      get label() {
        return t.tools.units.names['g']!;
      },
      factor: 1,
    },
    {
      id: 'kg',
      get label() {
        return t.tools.units.names['kg']!;
      },
      factor: 1000,
    },
    {
      id: 't',
      get label() {
        return t.tools.units.names['t']!;
      },
      factor: 1_000_000,
    },
    {
      id: 'oz',
      get label() {
        return t.tools.units.names['oz']!;
      },
      factor: 28.349523125,
    },
    {
      id: 'lb',
      get label() {
        return t.tools.units.names['lb']!;
      },
      factor: 453.59237,
    },
  ],
  temperature: [
    {
      id: 'c',
      get label() {
        return t.tools.units.names['c']!;
      },
    },
    {
      id: 'f',
      get label() {
        return t.tools.units.names['f']!;
      },
    },
    {
      id: 'k',
      get label() {
        return t.tools.units.names['k']!;
      },
    },
  ],
  // base: litre
  volume: [
    {
      id: 'ml',
      get label() {
        return t.tools.units.names['ml']!;
      },
      factor: 0.001,
    },
    {
      id: 'l',
      get label() {
        return t.tools.units.names['l']!;
      },
      factor: 1,
    },
    {
      id: 'm3',
      get label() {
        return t.tools.units.names['m3']!;
      },
      factor: 1000,
    },
    {
      id: 'tsp',
      get label() {
        return t.tools.units.names['tsp']!;
      },
      factor: 0.005,
    },
    {
      id: 'tbsp',
      get label() {
        return t.tools.units.names['tbsp']!;
      },
      factor: 0.015,
    },
    {
      id: 'cup',
      get label() {
        return t.tools.units.names['cup']!;
      },
      factor: 0.2365882365,
    },
    {
      id: 'floz',
      get label() {
        return t.tools.units.names['floz']!;
      },
      factor: 0.0295735295625,
    },
    {
      id: 'gal',
      get label() {
        return t.tools.units.names['gal']!;
      },
      factor: 3.785411784,
    },
  ],
  // base: metres per second
  speed: [
    {
      id: 'ms',
      get label() {
        return t.tools.units.names['ms']!;
      },
      factor: 1,
    },
    {
      id: 'kmh',
      get label() {
        return t.tools.units.names['kmh']!;
      },
      factor: 1 / 3.6,
    },
    {
      id: 'mph',
      get label() {
        return t.tools.units.names['mph']!;
      },
      factor: 0.44704,
    },
    {
      id: 'kn',
      get label() {
        return t.tools.units.names['kn']!;
      },
      factor: 1852 / 3600,
    },
  ],
};

const toCelsius = (v: number, unit: string): number =>
  unit === 'f' ? ((v - 32) * 5) / 9 : unit === 'k' ? v - 273.15 : v;
const fromCelsius = (c: number, unit: string): number =>
  unit === 'f' ? (c * 9) / 5 + 32 : unit === 'k' ? c + 273.15 : c;

/** Converts `value` between two units of `kind`; undefined for an unknown unit. */
export function convert(
  kind: UnitKind,
  from: string,
  to: string,
  value: number,
): number | undefined {
  const defs = UNITS[kind];
  const a = defs.find((u) => u.id === from);
  const b = defs.find((u) => u.id === to);
  if (!a || !b || !Number.isFinite(value)) return undefined;
  if (kind === 'temperature') return fromCelsius(toCelsius(value, from), to);
  return (value * a.factor!) / b.factor!;
}
