// Final parameters of the Nemo logo v2 (chosen in rounds 1–8 with the maintainer). Everything the
// asset export needs comes from here: the mark (variant A2b), the lettering
// (W10c3: own rounded monoline capitals, M vertex at half height) and the pill lockup (F4).
export const MARK = {
  params: {
    body: { nose: 466, joint: 176, height: 132, peak: 0.48, blunt: 0.74, stalk: 50 },
    tail: { style: 'fan', length: 68, spread: 76, notch: 16, overlap: 30 },
    stripes: { at: [0.7, 0.37], width: [34, 40], bend: [-24, -16] },
    eye: { at: 0.84, dy: -0.22, r: 26 },
    fins: { dorsal: { height: 30, from: 0.3, to: 0.7 }, ventral: { height: 18, from: 0.36, to: 0.6 } },
    soften: 12,
    // tile radius 146/512 = the module chips' 8/28; Android adaptive at 0.56 keeps the fish inside the 66 dp safe zone (reach 153 of 156)
    views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.56 } },
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
