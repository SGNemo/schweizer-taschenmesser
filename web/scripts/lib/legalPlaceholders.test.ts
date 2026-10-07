import { describe, expect, it } from 'vitest';
import { findOpenPlaceholders } from './legalPlaceholders';

describe('open legal placeholders', () => {
  it('finds [[X]] and the website markers with their line', () => {
    const hits = findOpenPlaceholders(
      'f',
      "const a = '[[NAME]]';\nSven [PLATZHALTER: Nachname]\n[PLACEHOLDER: street]\nfine",
    );
    expect(hits.map((h) => [h.line, h.text])).toEqual([
      [1, '[[NAME]]'],
      [2, '[PLATZHALTER: Nachname]'],
      [3, '[PLACEHOLDER: street]'],
    ]);
  });

  it('ignores comment lines that only explain the format', () => {
    expect(findOpenPlaceholders('f', ' * a `[[NAME]]` is open\n// [[X]]\nname: ""')).toEqual([]);
  });
});
