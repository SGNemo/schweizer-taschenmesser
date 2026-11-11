import { describe, expect, it } from 'vitest';
import {
  checkFontWeights,
  checkIdentityCollisions,
  checkIdentityGroups,
  checkSignatureUse,
  identityFacts,
  type IdentityFacts,
} from './checkIdentity';

const fact = (over: Partial<IdentityFacts> & { id: string }): IdentityFacts => ({
  area: 'plan',
  order: 100,
  hue: 'teal',
  head: 'standard',
  widget: 'kennzahl',
  signature: 'bankCard',
  retired: false,
  ...over,
});

describe('identity checks (Identity 4.0: two head variants)', () => {
  it('reads the facts out of a manifest source', () => {
    const src = `export default {
  id: 'x',
  order: 40,
  area: 'money',
  identity: {
    hue: 'teal',
    hue2: 'ocean',
    widget: 'kennzahl',
    head: 'standard',
    signature: 'bankCard',
    type: 'mono',
  },
};`;
    expect(identityFacts('x', src)).toEqual({
      id: 'x',
      area: 'money',
      order: 40,
      hue: 'teal',
      hue2: 'ocean',
      head: 'standard',
      widget: 'kennzahl',
      signature: 'bankCard',
      retired: false,
    });
  });

  it('inside an area: one hue per module, at most one stage head; neighbours may share the standard head', () => {
    expect(
      checkIdentityGroups([
        fact({ id: 'a', order: 1 }),
        fact({ id: 'b', order: 2, hue: 'sky' }),
        fact({ id: 'c', order: 3, hue: 'teal' }),
      ]),
    ).toEqual(['c and a share the hue "teal" in the area "plan"']);
    // Two neighbours with the standard head are the rule now, not a collision.
    expect(
      checkIdentityGroups([fact({ id: 'a', order: 1 }), fact({ id: 'b', order: 2, hue: 'sky' })]),
    ).toEqual([]);
    // The stage is the exception: a second one in the same area is refused, one in another area is fine.
    expect(
      checkIdentityGroups([
        fact({ id: 'weather', order: 1, hue: 'cobalt', head: 'stage' }),
        fact({ id: 'maps', order: 2, hue: 'ocean', head: 'stage' }),
        fact({ id: 'music', area: 'knowledge', hue: 'orchid', head: 'stage' }),
      ]),
    ).toEqual([
      'weather and maps both have a stage head in the area "plan" (at most one stage per area)',
    ]);
    // Retired modules and modules without an area are not in any group.
    expect(
      checkIdentityGroups([fact({ id: 'a' }), fact({ id: 'b', retired: true, area: undefined })]),
    ).toEqual([]);
  });

  it('app-wide: the same hue needs a signature of its own, whatever head and widget (finance ↔ mail, timetrack)', () => {
    const finance = fact({ id: 'finance', area: 'money' });
    // Same hue, head and widget (what identity v3.1 refused outright): the drawing tells them apart.
    const mail = fact({ id: 'mail', area: 'knowledge', signature: 'stamp' });
    expect(checkIdentityCollisions([finance, mail])).toEqual([]);
    expect(checkIdentityCollisions([finance, { ...mail, signature: 'bankCard' }])).toEqual([
      'finance and mail share the hue "teal"; each needs a signature of its own (not "none", not the same)',
    ]);
    // "none" is no signature, with another widget too.
    const timetrack = fact({ id: 'timetrack', widget: 'zeitleiste', signature: 'none' });
    expect(checkIdentityCollisions([finance, timetrack])).toEqual([
      'finance and timetrack share the hue "teal"; each needs a signature of its own (not "none", not the same)',
    ]);
    expect(checkIdentityCollisions([finance, { ...timetrack, signature: 'stopwatch' }])).toEqual(
      [],
    );
    // A stage head does not excuse it either.
    expect(
      checkIdentityCollisions([finance, { ...timetrack, head: 'stage', signature: 'bankCard' }]),
    ).toHaveLength(1);
  });

  it('app-wide: the same widget shape on another hue is fine; retired modules take no part', () => {
    expect(
      checkIdentityCollisions([
        fact({ id: 'a', hue: 'sky', widget: 'faellig' }),
        fact({ id: 'b', hue: 'ocean', widget: 'faellig' }),
      ]),
    ).toEqual([]);
    expect(checkIdentityCollisions([fact({ id: 'a' }), fact({ id: 'b', retired: true })])).toEqual(
      [],
    );
  });

  it('warns when a module says "none" but brings a signature block itself', () => {
    const manifest = `identity: { hue: 'teal', widget: 'kennzahl', head: 'standard', signature: 'none' }`;
    expect(
      checkSignatureUse('x', manifest, ['<div />', '<HeroSlot area="signature">']),
    ).toHaveLength(1);
    expect(checkSignatureUse('x', manifest, ["<HeroSlot area={'signature'}>"])).toHaveLength(1);
    // A figure or a notice is not the signature slot.
    expect(checkSignatureUse('x', manifest, ['<HeroSlot area="figure">', '<HeroSlot>'])).toEqual(
      [],
    );
    expect(
      checkSignatureUse('x', manifest.replace("'none'", "'stopwatch'"), [
        '<HeroSlot area="signature">',
      ]),
    ).toEqual([]);
  });
});

describe('checkFontWeights (C11)', () => {
  it('reports raw numbers, keeps tokens, keywords and @font-face ranges', () => {
    const css = [
      '@font-face { font-family: X; font-weight: 100 900; }',
      '.a { font-weight: 650; }',
      '.b { font-weight: var(--weight-semibold); }',
      '.c { font-weight: normal; }',
      '/* font-weight: 600; */',
    ].join('\n');
    expect(checkFontWeights('x.css', css)).toEqual([
      'x.css:2: font-weight 650 – use a token (var(--weight-…)) or "normal"',
    ]);
  });
});
