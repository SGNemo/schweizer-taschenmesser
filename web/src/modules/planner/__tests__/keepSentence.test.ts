import { describe, expect, it } from 'vitest';
import { readKeepSentence } from '../keepSentence';

const rows = [
  { unitId: 'a#0', title: 'Wäsche waschen' },
  { unitId: 'b#0', title: 'Küche aufräumen' },
  { unitId: 'c#0', title: 'Pfand sammeln' },
  { unitId: 'd#0', title: 'Pfand wegbringen' },
];

describe('readKeepSentence (P4)', () => {
  it('names what stays: exact titles or the one title that holds the word', () => {
    expect(readKeepSentence('heute nur Wäsche, Küche und Pfand sammeln', rows)).toEqual([
      'a#0',
      'b#0',
      'c#0',
    ]);
    expect(readKeepSentence('nur noch Küche aufräumen heute', rows)).toEqual(['b#0']);
  });

  it('an unclear or unknown name, a name twice or another sentence is no such sentence', () => {
    expect(readKeepSentence('heute nur Pfand', rows)).toBeUndefined();
    expect(readKeepSentence('heute nur Steuer', rows)).toBeUndefined();
    expect(readKeepSentence('heute nur Wäsche und Wäsche waschen', rows)).toBeUndefined();
    expect(readKeepSentence('Donnerstag frei', rows)).toBeUndefined();
    expect(readKeepSentence('Wäsche waschen', rows)).toBeUndefined();
  });
});
