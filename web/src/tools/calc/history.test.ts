import { beforeEach, describe, expect, it } from 'vitest';
import {
  historyText,
  loadHistory,
  MAX_HISTORY,
  pushHistory,
  saveHistory,
  searchHistory,
} from './history';

beforeEach(() => localStorage.clear());

describe('history', () => {
  const list = [
    { expr: '2+2', result: '4' },
    { expr: 'sqrt(2)', result: '1,4142' },
  ];
  it('moves a repeated expression to the front and caps the length', () => {
    expect(pushHistory(list, { expr: 'sqrt(2)', result: '1,4142' })[0]!.expr).toBe('sqrt(2)');
    expect(pushHistory(list, { expr: 'sqrt(2)', result: '1,4142' })).toHaveLength(2);
    const many = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({ expr: `${i}`, result: '0' }));
    expect(pushHistory(many, { expr: 'x', result: '1' })).toHaveLength(MAX_HISTORY);
  });
  it('searches expression and result', () => {
    expect(searchHistory(list, 'SQRT')).toEqual([list[1]]);
    expect(searchHistory(list, '4')).toEqual(list);
    expect(searchHistory(list, 'zzz')).toEqual([]);
    expect(searchHistory(list, '  ')).toEqual(list);
  });
  it('writes a note text, oldest first', () => {
    expect(historyText(list)).toBe('sqrt(2) = 1,4142\n2+2 = 4');
  });
  it('stores and reloads, and carries over the former format', () => {
    saveHistory(list);
    expect(loadHistory()).toEqual(list);
    localStorage.clear();
    localStorage.setItem('tm-calc-history', JSON.stringify([{ expr: '1+1', result: 2.5 }]));
    expect(loadHistory()).toEqual([{ expr: '1+1', result: '2,5' }]);
    localStorage.setItem('tm-calc-history-2', 'not json');
    expect(loadHistory()).toEqual([]);
  });
});
