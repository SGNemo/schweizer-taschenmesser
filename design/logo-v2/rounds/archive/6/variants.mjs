// Round 6 – "the e is almost good, but its lower stroke is now too short": the bowl must run further
// to the right without closing the aperture. Four fixes on W10b3 (stroke 700). Rendered by `node render.mjs rounds/6`.
const A2b = {
  body: { nose: 466, joint: 176, height: 132, peak: 0.48, blunt: 0.74, stalk: 50 },
  tail: { style: 'fan', length: 68, spread: 76, notch: 16, overlap: 30 },
  stripes: { at: [0.7, 0.37], width: [34, 40], bend: [-24, -16] },
  eye: { at: 0.84, dy: -0.22, r: 26 },
  fins: { dorsal: { height: 30, from: 0.3, to: 0.7 }, ventral: { height: 18, from: 0.36, to: 0.6 } },
  soften: 12,
  views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.56 } },
};
const PILL = { source: 'mark', markHeight: 1.15, gap: 0.3, pill: { padX: 0.4, padY: 0.32, radius: 0.5 } };
const B7 = { text: 'Nemo', family: 'round', weight: 700, round: { xHeight: 0.84, eOpen: 32, eCap: 'butt' } };

export default {
  title: 'W10b: a longer e bowl that stays open',
  subtitle:
    'Same pill and mark (A2b). The e’s bowl ends at an angle below its bar: 72° (round 5) stops just past the bottom, which read as too short. A longer bowl narrows the aperture, so each variant buys the length differently: a lower end angle with a lighter stroke and a larger x-height, or a flat-cut terminal that keeps the gap open. True pixels at 36 and 28 px.',
  current: false,
  lockupHeight: 36,
  lockupWord: B7,
  lockup: PILL,
  wordmarkBase: 'A2b',
  wordmarkIntro: 'W10b5 and W10b6 keep every terminal round; W10b7 and W10b8 cut the e’s terminal flat (the only non-round end, perpendicular to the stroke) so the bowl can run to the lower right like in a text face.',
  variants: [
    {
      label: 'A2b',
      compact: true,
      direction: 'tile',
      title: 'The mark (unchanged)',
      desc: 'As decided in round 3; shown with W10b7 in the sidebar.',
      params: A2b,
      rail: 'app',
      notes: 'Reference only.',
    },
  ],
  wordmarks: [
    {
      label: 'W10b5',
      title: 'Bowl to 55°, stroke 700, x-height 0.84 (round terminal)',
      word: { text: 'Nemo', family: 'round', weight: 700, round: { xHeight: 0.84, eOpen: 55 } },
      lockup: PILL,
      notes: 'The bowl runs clearly past the bottom; the gap is about 3 px at 36 px and 2 px at 28 px.',
    },
    {
      label: 'W10b6',
      title: 'Bowl to 48°, stroke 700, x-height 0.86 (round terminal)',
      word: { text: 'Nemo', family: 'round', weight: 700, round: { xHeight: 0.86, eOpen: 48 } },
      lockup: PILL,
      notes: 'Longer still; the larger x-height keeps the counters open, the gap at 28 px becomes a notch.',
    },
    {
      label: 'W10b7',
      title: 'Bowl to 32° with a flat-cut terminal, stroke 700, x-height 0.84',
      word: B7,
      lockup: PILL,
      notes: 'The bowl ends at the lower right like a normal e; the flat cut gives the whole stroke width to the gap, so it stays open at 28 px. The cut is visible only above about 64 px.',
    },
    {
      label: 'W10b8',
      title: 'Bowl to 30° with a flat-cut terminal, stroke 800, x-height 0.86',
      word: { text: 'Nemo', family: 'round', weight: 800, round: { xHeight: 0.86, eOpen: 30, eCap: 'butt' } },
      lockup: PILL,
      notes: 'The same with the heavier 800 stroke of round 4; the gap at 28 px is tight but present.',
    },
  ],
};
