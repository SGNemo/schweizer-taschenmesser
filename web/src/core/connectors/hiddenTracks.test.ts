// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { HIDDEN_KEY, clearHidden, readHidden, setHidden } from './hiddenTracks';

beforeEach(() => localStorage.clear());

describe('hidden tracks', () => {
  it('hides and shows a song inside one list, and forgets an empty list', () => {
    expect(readHidden()).toEqual({});
    setHidden('PL1', 'a1', true);
    setHidden('PL1', 'a2', true);
    setHidden('PL2', 'b1', true);
    expect(readHidden()).toEqual({ PL1: ['a1', 'a2'], PL2: ['b1'] });
    setHidden('PL1', 'a1', false);
    setHidden('PL2', 'b1', false);
    expect(readHidden()).toEqual({ PL1: ['a2'] });
    setHidden('PL1', 'a2', false);
    expect(localStorage.getItem(HIDDEN_KEY)).toBeNull();
  });

  it('hiding twice keeps one entry; unusable ids change nothing', () => {
    setHidden('PL1', 'a1', true);
    setHidden('PL1', 'a1', true);
    setHidden('bad id', 'a1', true);
    setHidden('PL1', 'a"1', true);
    expect(readHidden()).toEqual({ PL1: ['a1'] });
  });

  it('drops a damaged or foreign value and starts empty', () => {
    for (const bad of ['nope', '[]', '{"PL1":"a1"}', '{"bad id":["a1"]}', '{"PL1":["a 1"]}']) {
      localStorage.setItem(HIDDEN_KEY, bad);
      expect(readHidden()).toEqual({});
      expect(localStorage.getItem(HIDDEN_KEY)).toBeNull();
    }
  });

  it('keeps ids only (no names) and clearHidden forgets everything', () => {
    setHidden('PL1', 'a1', true);
    expect(localStorage.getItem(HIDDEN_KEY)).toBe('{"PL1":["a1"]}');
    clearHidden();
    expect(readHidden()).toEqual({});
  });
});
