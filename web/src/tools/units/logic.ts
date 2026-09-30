/** Unit conversion tables. Linear kinds go through a base unit; temperature is special. */
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
    { id: 'mm', label: 'Millimeter (mm)', factor: 0.001 },
    { id: 'cm', label: 'Zentimeter (cm)', factor: 0.01 },
    { id: 'm', label: 'Meter (m)', factor: 1 },
    { id: 'km', label: 'Kilometer (km)', factor: 1000 },
    { id: 'in', label: 'Zoll (in)', factor: 0.0254 },
    { id: 'ft', label: 'Fuß (ft)', factor: 0.3048 },
    { id: 'yd', label: 'Yard (yd)', factor: 0.9144 },
    { id: 'mi', label: 'Meile (mi)', factor: 1609.344 },
  ],
  // base: gram
  mass: [
    { id: 'mg', label: 'Milligramm (mg)', factor: 0.001 },
    { id: 'g', label: 'Gramm (g)', factor: 1 },
    { id: 'kg', label: 'Kilogramm (kg)', factor: 1000 },
    { id: 't', label: 'Tonne (t)', factor: 1_000_000 },
    { id: 'oz', label: 'Unze (oz)', factor: 28.349523125 },
    { id: 'lb', label: 'Pfund (lb)', factor: 453.59237 },
  ],
  temperature: [
    { id: 'c', label: 'Celsius (°C)' },
    { id: 'f', label: 'Fahrenheit (°F)' },
    { id: 'k', label: 'Kelvin (K)' },
  ],
  // base: litre
  volume: [
    { id: 'ml', label: 'Milliliter (ml)', factor: 0.001 },
    { id: 'l', label: 'Liter (l)', factor: 1 },
    { id: 'm3', label: 'Kubikmeter (m³)', factor: 1000 },
    { id: 'tsp', label: 'Teelöffel (5 ml)', factor: 0.005 },
    { id: 'tbsp', label: 'Esslöffel (15 ml)', factor: 0.015 },
    { id: 'cup', label: 'US-Cup (cup)', factor: 0.2365882365 },
    { id: 'floz', label: 'US-Flüssigunze (fl oz)', factor: 0.0295735295625 },
    { id: 'gal', label: 'US-Gallone (gal)', factor: 3.785411784 },
  ],
  // base: metres per second
  speed: [
    { id: 'ms', label: 'Meter pro Sekunde (m/s)', factor: 1 },
    { id: 'kmh', label: 'Kilometer pro Stunde (km/h)', factor: 1 / 3.6 },
    { id: 'mph', label: 'Meilen pro Stunde (mph)', factor: 0.44704 },
    { id: 'kn', label: 'Knoten (kn)', factor: 1852 / 3600 },
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
