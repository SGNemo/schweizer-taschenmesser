import { describe, expect, it } from 'vitest';
import {
  checkToolKeywords,
  checkToolManifest,
  checkToolNeighbours,
  toolFacts,
  toolModuleKinship,
} from './checkTools';

const good = `
const tool = {
  id: 'x',
  category: 'rechnen',
  identity: { hue: 'cobalt', hue2: 'sky', signature: 'display' },
  get keywords() { return toolKeywords(t.tools.x.keywords); },
  order: 10,
};`;

describe('checkToolManifest', () => {
  it('accepts a complete manifest', () => {
    expect(checkToolManifest('x', good)).toEqual([]);
  });
  it('fails on a missing category, identity or keywords', () => {
    expect(checkToolManifest('x', good.replace("category: 'rechnen',", ''))).toEqual([
      expect.stringContaining('no `category`'),
    ]);
    expect(checkToolManifest('x', good.replace(/identity:[^\n]*\n/, ''))).toEqual([
      expect.stringContaining('no `identity`'),
    ]);
    expect(checkToolManifest('x', good.replace(/get keywords[^\n]*\n/, ''))).toEqual([
      expect.stringContaining('no `keywords`'),
    ]);
  });
  it('fails on values outside the lists', () => {
    expect(checkToolManifest('x', good.replace("'cobalt'", "'plum'")).join()).toMatch(/hue "plum"/);
    expect(checkToolManifest('x', good.replace("'display'", "'nope'")).join()).toMatch(/signature/);
    expect(checkToolManifest('x', good.replace("'rechnen'", "'misc'")).join()).toMatch(/category/);
    expect(checkToolManifest('x', good.replace("hue2: 'sky'", "hue2: 'cobalt'")).join()).toMatch(
      /differ/,
    );
  });
});

describe('checkToolNeighbours', () => {
  it('flags neighbours with the same hue only', () => {
    const f = (id: string, order: number, hue: string) => ({ ...toolFacts(id, ''), order, hue });
    expect(checkToolNeighbours([f('a', 1, 'teal'), f('b', 2, 'sky'), f('c', 3, 'teal')])).toEqual(
      [],
    );
    expect(checkToolNeighbours([f('a', 1, 'teal'), f('b', 2, 'teal')])).toHaveLength(1);
  });
});

describe('checkToolKeywords', () => {
  const de =
    "\n  tools: {\n    calc: {\n      name: 'Rechner',\n      keywords: 'a, b',\n    },\n    dev: {\n      name: 'Dev',\n    },\n  },";
  it('finds the keywords inside the tool block only', () => {
    expect(checkToolKeywords('calc', 'de', de)).toEqual([]);
    expect(checkToolKeywords('dev', 'de', de)).toEqual([expect.stringContaining('no `keywords`')]);
    expect(checkToolKeywords('qr', 'de', de)).toEqual([expect.stringContaining('no text block')]);
  });
});

describe('toolModuleKinship (F13)', () => {
  const tool = (id: string, signature: string, hue = 'sky') => ({
    ...toolFacts(id, ''),
    signature,
    hue,
  });
  it('names a tool that shares a signature with a module, and the hue when that is shared too', () => {
    const notes = toolModuleKinship(
      [tool('dates', 'calendarLeaf', 'sky'), tool('calc', 'display', 'violet')],
      [
        { id: 'calendar', hue: 'sky', signature: 'calendarLeaf' },
        { id: 'notes', hue: 'violet', signature: 'notePaper' },
      ],
    );
    expect(notes).toEqual([
      'tool dates shares the signature "calendarLeaf" and the hue "sky" with the module calendar',
    ]);
  });
  it('ignores "none"', () => {
    expect(toolModuleKinship([tool('x', 'none')], [{ id: 'm', signature: 'none' }])).toEqual([]);
  });
});
