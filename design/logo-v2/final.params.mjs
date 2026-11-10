// Final parameters of the Nemo logo v2 (chosen in rounds 1–8 with the maintainer; mark revised as v2.1 in round 10 and v2.2 in round 11). Everything the
// asset export needs comes from here: the mark (variant A2b), the lettering
// (W10c3: own rounded monoline capitals, M vertex at half height) and the pill lockup (F4).
export const MARK = {
  params: {
    // v2.2 (2026-11-10, round 11): back to the A2b silhouette the maintainer prefers (deep round body, fan tail), with a
    // larger tail and bands that stop just before the outline (a narrow rim), so the fish stays one piece and no
    // longer reads as a speaker. It fills the tile (scale 1.0625). Flat as before: one colour on the accent tile.
    body: { nose: 466, joint: 176, height: 132, peak: 0.48, blunt: 0.74, stalk: 50 },
    tail: { style: 'fan', length: 88, spread: 96, notch: 20, overlap: 30 },
    stripes: { at: [0.7, 0.37], width: [34, 42], bend: [-24, -16], rim: 18 },
    eye: { at: 0.84, dy: -0.22, r: 26 },
    fins: { dorsal: { height: 30, from: 0.3, to: 0.7 }, ventral: { height: 18, from: 0.36, to: 0.6 } },
    soften: 12,
    // tile radius 146/512 = the module chips' 8/28; dx centres the fish on the tile (its box is not centred in the
    // canvas); Android adaptive keeps the fish inside the 66 dp safe zone
    views: { tile: { radius: 146, scale: 1.0625, dx: -24 }, adaptive: { scale: 0.72, dx: -12 } },
  },
};

/** The name in the pill: own rounded monoline capitals (wordmark.mjs `round`), stroke 0.22 of the cap height. */
export const WORD = { text: 'NEMO', family: 'round', weight: 700, round: { mVertex: 0.5 } };

/** Mark + name in the contrast colour on an accent pill (lockupSvg options). */
export const LOCKUP = { source: 'mark', markHeight: 1.3, gap: 0.24, pill: { padX: 0.36, padY: 0.3, radius: 0.5 } };

/** Where the pieces appear in the app (CSS px at 16 px root). */
export const PLACEMENT = {
  sidebarWide: { pill: 36 }, // in the 44 px brand box, 4 px air above and below
  sidebarRail: { tile: 44 }, // the mark on the accent tile (`<Logo tile />`) filling the 2.75rem home link
  phoneTopBar: { tile: 32 }, // below 416 px: the tile alone (`<Logo tile />` in a 2rem box); above: the pill
};

/** Safe zones of the 512 canvas: PWA maskable icon (circle, 40 % radius minus a margin) and the Android adaptive icon (66 dp of 108). */
export const MASKABLE_SAFE_RADIUS = 196;
export const ADAPTIVE_SAFE_RADIUS = 156.4;

/** The sidebar head is 44 px high; the pill sits in it at 36 px (`PLACEMENT.sidebarWide.pill`), left-aligned, so the file keeps the old wordmark's aspect ratio and `ui/Wordmark.tsx` needs no change. */
export const WORDMARK_BOX = { aspect: 1368 / 401, headPx: 44 };
