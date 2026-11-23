import { describe, expect, it } from 'vitest';
import { readKeepSentence } from '../keepSentence';

const rows = [
  { unitId: 'a#0', itemKey: 'a', title: 'Wäsche waschen' },
  { unitId: 'b#0', itemKey: 'b', title: 'Küche aufräumen' },
  { unitId: 'c#0', itemKey: 'c', title: 'Pfand sammeln' },
  { unitId: 'd#0', itemKey: 'd', title: 'Pfand wegbringen' },
  { unitId: 'e#0', itemKey: 'e', title: 'Brot und Butter kaufen' },
  { unitId: 'f#0', itemKey: 'f', title: 'Steuer' },
  { unitId: 'f#1', itemKey: 'f', title: 'Steuer' },
  { unitId: 'g#0', itemKey: 'g', title: 'Pfandflaschen zählen' },
];

describe('readKeepSentence (P4)', () => {
  it('names what stays: exact titles or the one title with a word starting so; a thing in parts once', () => {
    expect(readKeepSentence('heute nur Wäsche, Küche und Pfand sammeln', rows)).toEqual({
      unitIds: ['a#0', 'b#0', 'c#0'],
      today: true,
    });
    expect(readKeepSentence('nur noch Küche', rows)).toEqual({ unitIds: ['b#0'], today: false });
    expect(readKeepSentence('nur Steuer', rows)?.unitIds).toEqual(['f#0']);
    // A title with „und“ in it, named whole.
    expect(readKeepSentence('heute nur Brot und Butter kaufen', rows)?.unitIds).toEqual(['e#0']);
  });

  it('unclear, unknown or twice named, or a sentence the field reads itself: no such sentence', () => {
    expect(readKeepSentence('heute nur Pfand', rows)).toBeUndefined();
    expect(readKeepSentence('heute nur Steuerberater', rows)).toBeUndefined();
    expect(readKeepSentence('heute nur Wäsche und Wäsche waschen', rows)).toBeUndefined();
    expect(readKeepSentence('nur Donnerstag frei', rows)).toBeUndefined();
    expect(readKeepSentence('heute nur 2 Stunden', rows)).toBeUndefined();
    expect(readKeepSentence('Wäsche waschen', rows)).toBeUndefined();
  });
});
