// Final parameters of the Nemo logo v2 (chosen in rounds 1–8 with the maintainer; mark revised as v2.1 in round 10). Everything the
// asset export needs comes from here: the mark (variant A2b), the lettering
// (W10c3: own rounded monoline capitals, M vertex at half height) and the pill lockup (F4).
export const MARK = {
  params: {
    // v2.1 (2026-11-10): pinched tail stalk and a two-lobed fan instead of the cone, so the piece behind the band no
    // longer reads as a speaker; the bands stop before the outline (rim), so the fish stays one piece. Flat as
    // before: one colour, white on the accent tile, no gradient.
    body: { nose: 452, joint: 184, height: 110, peak: 0.49, blunt: 0.6, stalk: 34 },
    tail: { style: 'lobe', length: 106, spread: 94, notch: 18, overlap: 30 },
    stripes: { at: [0.69, 0.31], width: [24, 34], bend: [-21, -18], rim: 28 },
    eye: { at: 0.836, dy: -0.22, r: 22 },
    fins: { dorsal: { height: 34, from: 0.23, to: 0.76 }, ventral: { height: 30, from: 0.33, to: 0.63 } },
    soften: 12,
    // tile radius 146/512 = the module chips' 8/28; dx centres the fish on the tile (its box is not centred in the
    // canvas); Android adaptive keeps the fish inside the 66 dp safe zone
    views: { tile: { radius: 146, scale: 0.875, dx: -6 }, adaptive: { scale: 0.7, dx: -5 } },
  },
};

/** The name in the pill: own rounded monoline capitals (wordmark.mjs `round`), stroke 0.22 of the cap height. */
export const WORD = { text: 'NEMO', family: 'round', weight: 700, round: { mVertex: 0.5 } };

/** Mark + name in the contrast colour on an accent pill (lockupSvg options). */
export const LOCKUP = { source: 'mark', markHeight: 1.3, gap: 0.24, pill: { padX: 0.36, padY: 0.3, radius: 0.5 } };

/** Where the pieces appear in the app (CSS px at 16 px root). */
export const PLACEMENT = {
  sidebarWide: { pill: 36 }, // in the 44 px brand box, 4 px air above and below
  sidebarRail: { tile: 28 }, // mark only
  phoneTopBar: { tile: 32 }, // mark only
};

/** Safe zones of the 512 canvas: PWA maskable icon (circle, 40 % radius minus a margin) and the Android adaptive icon (66 dp of 108). */
export const MASKABLE_SAFE_RADIUS = 196;
export const ADAPTIVE_SAFE_RADIUS = 156.4;

/** The sidebar head is 44 px high; the pill sits in it at 36 px (`PLACEMENT.sidebarWide.pill`), left-aligned, so the file keeps the old wordmark's aspect ratio and `ui/Wordmark.tsx` needs no change. */
export const WORDMARK_BOX = { aspect: 1368 / 401, headPx: 44 };
