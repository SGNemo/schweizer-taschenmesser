import { describe, expect, it } from 'vitest';
import { normalizeNumbers, normalizeNumberToken, separatorsFor } from './numbers';

const de = separatorsFor('de-DE');
const en = separatorsFor('en-US');

describe('separatorsFor', () => {
  it('reads the decimal and grouping mark of a locale', () => {
    expect(de).toEqual({ decimal: ',', group: '.' });
    expect(en).toEqual({ decimal: '.', group: ',' });
    expect(separatorsFor('fr-FR').decimal).toBe(',');
    expect(separatorsFor('pt-BR')).toEqual({ decimal: ',', group: '.' });
    expect(separatorsFor('es-ES').decimal).toBe(',');
  });
});

describe('normalizeNumberToken', () => {
  it.each([
    ['1.234,56', de, '1234.56'],
    ['1,234.56', de, '1234.56'],
    ['1,234.56', en, '1234.56'],
    ['1.234,56', en, '1234.56'],
    ['12,5', de, '12.5'],
    ['12,5', en, '12.5'],
    ['12.5', de, '12.5'],
    ['1.234', de, '1234'],
    ['1,234', en, '1234'],
    ['1,234', de, '1.234'],
    ['1.234', en, '1.234'],
    ['0.750', de, '0.750'],
    ['1.234.567', de, '1234567'],
    ['1,234,567', en, '1234567'],
    ['.5', de, '0.5'],
    [',5', de, '0.5'],
    ['1 234,5', de, '1234.5'],
    ["1'234.5", en, '1234.5'],
    ['42', de, '42'],
  ])('%s (%j) → %s', (token, sep, expected) => {
    expect(normalizeNumberToken(token, sep)).toBe(expected);
  });

  it.each(['1.23.4', '1,2,3', '1.2345.678', '1,234,56'])('rejects %s', (token) => {
    expect(normalizeNumberToken(token, de)).toBeUndefined();
  });
});

describe('normalizeNumbers', () => {
  it('normalises every number in an expression', () => {
    expect(normalizeNumbers('1.234,5 + 2,5*3', de)).toBe('1234.5 + 2.5*3');
    expect(normalizeNumbers('sqrt(2,25)', en)).toBe('sqrt(2.25)');
  });
  it('keeps hex digits, exponents and identifiers', () => {
    expect(normalizeNumbers('0x1F + log10(100) + 1e5', de)).toBe('0x1F + log10(100) + 1e5');
  });
  it('is undefined when a number is invalid', () => {
    expect(normalizeNumbers('1.2.3,4,5', de)).toBeUndefined();
  });
});
