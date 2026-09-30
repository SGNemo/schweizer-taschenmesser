import { describe, expect, it } from 'vitest';
import { outName, parseRanges, without } from './logic';

describe('parseRanges', () => {
  it('reads pages, ranges and open ends', () => {
    expect(parseRanges('3', 10)).toEqual([3]);
    expect(parseRanges('1-3, 5', 10)).toEqual([1, 2, 3, 5]);
    expect(parseRanges('8-', 10)).toEqual([8, 9, 10]);
    expect(parseRanges('2–4', 10)).toEqual([2, 3, 4]);
    expect(parseRanges(' 1 ; 4 - 5 ', 10)).toEqual([1, 4, 5]);
  });
  it('keeps the order given and drops duplicates', () => {
    expect(parseRanges('5,1-3,2,5', 10)).toEqual([5, 1, 2, 3]);
  });
  it('rejects empty, malformed and impossible input', () => {
    for (const bad of [
      '',
      '  ',
      ',',
      'a',
      '0',
      '11',
      '1-11',
      '5-3',
      '1-2-3',
      '-3',
      '1,,x',
      '1.5',
      '99999999',
    ])
      expect(parseRanges(bad, 10), bad).toBeUndefined();
    expect(parseRanges('1', 0)).toBeUndefined();
  });
});

describe('without and outName', () => {
  it('lists the pages that stay', () => {
    expect(without(5, [2, 4])).toEqual([1, 3, 5]);
    expect(without(3, [])).toEqual([1, 2, 3]);
    expect(without(2, [1, 2])).toEqual([]);
  });
  it('builds the output name', () => {
    expect(outName('Vertrag.PDF', 'gedreht')).toBe('Vertrag-gedreht.pdf');
    expect(outName('ohne', 'x')).toBe('ohne-x.pdf');
    expect(outName('.pdf', 'x')).toBe('dokument-x.pdf');
  });
});
