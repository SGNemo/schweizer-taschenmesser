import { describe, expect, it } from 'vitest';
import { findOpenPlaceholders, readsBuildDetails } from './legalPlaceholders';

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

describe('pages that read the provider details from the build environment', () => {
  it('accepts a page that calls provider() from legal.js', () => {
    expect(
      readsBuildDetails("import { provider } from '../legal.js';\nconst p = provider();"),
    ).toBe(true);
    expect(
      readsBuildDetails("import { provider } from '../../legal.js';\nconst p = provider();"),
    ).toBe(true);
  });

  it('rejects a page with the details written into it', () => {
    expect(readsBuildDetails('<p>Erika Beispiel<br />Musterweg 1</p>')).toBe(false);
    expect(readsBuildDetails("import { provider } from '../legal.js';")).toBe(false);
  });
});
