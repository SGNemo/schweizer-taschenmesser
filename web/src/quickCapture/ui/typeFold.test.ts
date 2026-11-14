import { describe, expect, it } from 'vitest';
import type { CaptureType } from '../parser';
import { visibleTypes } from './typeFold';

const ALL: CaptureType[] = [
  'todo',
  'event',
  'reminder',
  'bookmark',
  'list',
  'finance',
  'invoice',
  'note',
  'subscription',
];

describe('visibleTypes', () => {
  it('shows everything when six or fewer fit', () => {
    const six = ALL.slice(0, 6);
    expect(visibleTypes(six, undefined, false)).toEqual({ shown: six, hidden: 0 });
  });

  it('folds to five fixed chips and the sixth in order', () => {
    expect(visibleTypes(ALL, 'event', false)).toEqual({ shown: ALL.slice(0, 6), hidden: 3 });
  });

  it('puts a folded selected type into the sixth slot, never re-sorting the first five', () => {
    const { shown, hidden } = visibleTypes(ALL, 'note', false);
    expect(shown).toEqual([...ALL.slice(0, 5), 'note']);
    expect(hidden).toBe(3);
  });

  it('ignores a selected type that is not available', () => {
    expect(visibleTypes(ALL, 'meal', false).shown).toEqual(ALL.slice(0, 6));
  });

  it('shows everything once the fold is open', () => {
    expect(visibleTypes(ALL, 'note', true)).toEqual({ shown: ALL, hidden: 0 });
  });
});
