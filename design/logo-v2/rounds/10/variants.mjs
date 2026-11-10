// Round 10 – mark v2.1 (2026-11-10): the app icon read as a speaker symbol at 32 px and below, because the cut
// bands split the fish into a cone, a bar and a D. Before (A2b) and after, both in every context.
// Rendered by `node render.mjs rounds/10`.
import { LOCKUP, MARK, WORD } from '../../final.params.mjs';

/** Mark A2b as shipped until round 9 (frozen; final.params.mjs now holds v2.1). */
const A2B = {
  body: { nose: 466, joint: 176, height: 132, peak: 0.48, blunt: 0.74, stalk: 50 },
  tail: { style: 'fan', length: 68, spread: 76, notch: 16, overlap: 30 },
  stripes: { at: [0.7, 0.37], width: [34, 40], bend: [-24, -16] },
  eye: { at: 0.84, dy: -0.22, r: 26 },
  fins: { dorsal: { height: 30, from: 0.3, to: 0.7 }, ventral: { height: 18, from: 0.36, to: 0.6 } },
  soften: 12,
  views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.56 } },
};

export default {
  title: 'Mark v2.1: one piece at 16 px',
  subtitle:
    'Same idea, new silhouette: pinched tail stalk and a two-lobed fan instead of the cone; the bands stop before the outline, so they no longer split the fish. As flat as before: one colour, white on the accent tile. Lettering and pill unchanged.',
  current: false,
  lockupHeight: 36,
  lockupWord: WORD,
  lockup: LOCKUP,
  wordmarkBase: 'v2.1',
  wordmarkIntro: 'The pill with the new mark; the lettering is the one from round 8.',
  variants: [
    {
      label: 'A2b',
      title: 'Before: mark A2b (round 9)',
      desc: 'White fish on the accent tile, bands and eye cut through the outline.',
      params: A2B,
      rail: 'app',
      notes: '16–32 px: triangle, bar and D – the speaker symbol. The mark covers 60 % of the tile width.',
    },
    {
      label: 'v2.1',
      title: 'After: mark v2.1',
      desc: 'Body 184–452, stalk 34, lobed tail 106 / 94 / notch 18, bands 24 and 34 with a rim of 28, eye r 22; tile radius 146, fish at 0.875 and centred; Android adaptive at 0.7.',
      params: MARK.params,
      rail: 'app',
      notes: '16 px: one white fish with two inner bands on the tile; one colour: the same shape. Safe zone 148 of 156. A two-colour tile on the ocean gradient was built first and dropped by the maintainer (too 3D).',
    },
  ],
  wordmarks: [
    {
      label: 'v2.1',
      title: 'NEMO pill with mark v2.1 · 36 px',
      word: WORD,
      lockup: LOCKUP,
      notes: 'Proportions as chosen in round 8 (F4).',
    },
  ],
};
