import { describe, expect, it } from 'vitest';
import {
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
  head: 'kennzahl',
  widget: 'kennzahl',
  signature: 'bankCard',
  retired: false,
  ...over,
});

describe('identity checks (identity v3.1)', () => {
  it('reads the facts out of a manifest source', () => {
    const src = `export default {
  id: 'x',
  order: 40,
  area: 'money',
  identity: {
    hue: 'teal',
    hue2: 'ocean',
    widget: 'kennzahl',
    head: 'kennzahl',
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
      head: 'kennzahl',
      widget: 'kennzahl',
      signature: 'bankCard',
      retired: false,
    });
  });

  it('inside an area: one hue per module, neighbours differ in head', () => {
    expect(
      checkIdentityGroups([
        fact({ id: 'a', order: 1 }),
        fact({ id: 'b', order: 2, hue: 'sky' }),
        fact({ id: 'c', order: 3, hue: 'teal', head: 'fokus' }),
      ]),
    ).toEqual([
      'c and a share the hue "teal" in the area "plan"',
      'a and b are neighbours in the area "plan" and share the head variant "kennzahl"',
    ]);
    // Retired modules and modules without an area are not in any group.
    expect(
      checkIdentityGroups([fact({ id: 'a' }), fact({ id: 'b', retired: true, area: undefined })]),
    ).toEqual([]);
  });

  it('app-wide: same hue never with the same head and widget (finance ↔ mail before v3.1)', () => {
    const finance = fact({ id: 'finance', area: 'money' });
    const mail = fact({ id: 'mail', area: 'knowledge', signature: 'stamp' });
    expect(checkIdentityCollisions([finance, mail])).toEqual([
      'finance and mail share the hue "teal", the head "kennzahl" and the widget "kennzahl" (app-wide rule: differ in head or widget)',
    ]);
    expect(
      checkIdentityCollisions([finance, { ...mail, head: 'schreib', widget: 'notiz' }]),
    ).toEqual([]);
  });

  it('app-wide: a shared head or widget on the same hue needs a signature of its own (timetrack ↔ finance)', () => {
    const finance = fact({ id: 'finance', area: 'money' });
    const timetrack = fact({ id: 'timetrack', head: 'zeit', signature: 'none' });
    expect(checkIdentityCollisions([finance, timetrack])).toEqual([
      'finance and timetrack share the hue "teal" and the widget "kennzahl"; each needs a signature of its own (not "none", not the same)',
    ]);
    expect(checkIdentityCollisions([finance, { ...timetrack, signature: 'stopwatch' }])).toEqual(
      [],
    );
    // The same signature twice is no signature either.
    expect(
      checkIdentityCollisions([finance, { ...timetrack, signature: 'bankCard' }]),
    ).toHaveLength(1);
    // Same hue and head (bookmarks ↔ vault): fine while the signatures differ.
    expect(
      checkIdentityCollisions([
        fact({
          id: 'bookmarks',
          hue: 'indigo',
          head: 'regal',
          widget: 'kacheln',
          signature: 'pinboard',
        }),
        fact({
          id: 'vault',
          hue: 'indigo',
          head: 'regal',
          widget: 'kennzahl',
          signature: 'folderTab',
        }),
      ]),
    ).toEqual([]);
  });

  it('app-wide: the same widget shape on another hue is fine; retired modules take no part', () => {
    expect(
      checkIdentityCollisions([
        fact({ id: 'a', hue: 'sky', head: 'fokus', widget: 'faellig' }),
        fact({ id: 'b', hue: 'ocean', head: 'fokus', widget: 'faellig' }),
      ]),
    ).toEqual([]);
    expect(checkIdentityCollisions([fact({ id: 'a' }), fact({ id: 'b', retired: true })])).toEqual(
      [],
    );
  });

  it('warns when a module says "none" but fills the head itself', () => {
    const manifest = `identity: { hue: 'teal', widget: 'kennzahl', head: 'zeit', signature: 'none' }`;
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
