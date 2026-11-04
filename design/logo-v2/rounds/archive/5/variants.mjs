// Round 5 – W10b is good, the "e" is not readable: at stroke 0.25 the round terminal closes the gap
// between bar and bowl (opening 42°). Four fixes, one or two changes each. Rendered by `node render.mjs rounds/5`.
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
const B1 = { text: 'Nemo', family: 'round', weight: 800, round: { xHeight: 0.82, eOpen: 72 } };

export default {
  title: 'W10b with a readable e',
  subtitle:
    'Same pill and mark (A2b); only the lettering changes. The e’s opening is the arc between its bar and its terminal: with stroke 0.25 and 42° (round 4) the round terminal fills it. Each variant opens it differently; the true-pixel rows show 36 px (sidebar) and 28 px.',
  current: false,
  lockupHeight: 36,
  lockupWord: B1,
  lockup: PILL,
  wordmarkBase: 'A2b',
  wordmarkIntro: 'W10b1 only opens the e; W10b2 opens it wider; W10b3 opens it and lightens the stroke one step; W10b4 opens it and raises the x-height so every lowercase counter grows.',
  variants: [
    {
      label: 'A2b',
      compact: true,
      direction: 'tile',
      title: 'The mark (unchanged)',
      desc: 'As decided in round 3; shown with W10b1 in the sidebar.',
      params: A2b,
      rail: 'app',
      notes: 'Reference only.',
    },
  ],
  wordmarks: [
    {
      label: 'W10b1',
      title: 'e opening 72° (from 42°), everything else as W10b',
      word: B1,
      lockup: PILL,
      notes: 'The gap below the bar is now 0.22 of the cap height (about 4 px at 36 px, 3 px at 28 px); the top counter stays small.',
    },
    {
      label: 'W10b2',
      title: 'e opening 85°',
      word: { text: 'Nemo', family: 'round', weight: 800, round: { xHeight: 0.82, eOpen: 85 } },
      lockup: PILL,
      notes: 'Widest opening, the e reads like a c with a bar; clearest at 28 px, a little less "closed geometric" in character.',
    },
    {
      label: 'W10b3',
      title: 'e opening 72° and stroke 700 (0.22 instead of 0.25)',
      word: { text: 'Nemo', family: 'round', weight: 700, round: { xHeight: 0.82, eOpen: 72 } },
      lockup: PILL,
      notes: 'One step lighter: every counter (e, o, m) grows; the word stays bold next to the fish. Between W10a and W10b in weight.',
    },
    {
      label: 'W10b4',
      title: 'e opening 72° and x-height 0.88 (from 0.82)',
      word: { text: 'Nemo', family: 'round', weight: 800, round: { xHeight: 0.88, eOpen: 72 } },
      lockup: PILL,
      notes: 'Keeps the 800 weight, the lowercase letters grow so the counters open; the N looks a touch shorter against them.',
    },
  ],
};
