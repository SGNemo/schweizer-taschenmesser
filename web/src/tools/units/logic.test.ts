import { describe, expect, it } from 'vitest';
import { convert } from './logic';

describe('convert', () => {
  it('converts linear units', () => {
    expect(convert('length', 'km', 'm', 1.5)).toBeCloseTo(1500);
    expect(convert('length', 'mi', 'km', 1)).toBeCloseTo(1.609344);
    expect(convert('mass', 'lb', 'kg', 1)).toBeCloseTo(0.45359237);
    expect(convert('volume', 'gal', 'l', 1)).toBeCloseTo(3.785411784);
    expect(convert('speed', 'kmh', 'ms', 36)).toBeCloseTo(10);
    expect(convert('speed', 'kn', 'kmh', 1)).toBeCloseTo(1.852);
  });
  it('converts temperature', () => {
    expect(convert('temperature', 'c', 'f', 100)).toBeCloseTo(212);
    expect(convert('temperature', 'f', 'c', -40)).toBeCloseTo(-40);
    expect(convert('temperature', 'k', 'c', 0)).toBeCloseTo(-273.15);
    expect(convert('temperature', 'c', 'k', 20)).toBeCloseTo(293.15);
  });
  it('rejects unknown units and non-finite values', () => {
    expect(convert('length', 'x', 'm', 1)).toBeUndefined();
    expect(convert('length', 'm', 'm', Number.NaN)).toBeUndefined();
  });
  it('round-trips', () => {
    expect(convert('length', 'in', 'ft', convert('length', 'ft', 'in', 7)!)).toBeCloseTo(7);
  });
});
