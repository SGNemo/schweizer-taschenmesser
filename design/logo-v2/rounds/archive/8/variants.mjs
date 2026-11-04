// Round 8 – mark A2b and pill W10c3 are chosen; last fine-tuning of the lockup in the sidebar head
// (44 px): pill height, padding, mark size, gap. Rendered by `node render.mjs rounds/8`.
const A2b = {
  body: { nose: 466, joint: 176, height: 132, peak: 0.48, blunt: 0.74, stalk: 50 },
  tail: { style: 'fan', length: 68, spread: 76, notch: 16, overlap: 30 },
  stripes: { at: [0.7, 0.37], width: [34, 40], bend: [-24, -16] },
  eye: { at: 0.84, dy: -0.22, r: 26 },
  fins: { dorsal: { height: 30, from: 0.3, to: 0.7 }, ventral: { height: 18, from: 0.36, to: 0.6 } },
  soften: 12,
  views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.56 } },
};
const WORD = { text: 'NEMO', family: 'round', weight: 700, round: { mVertex: 0.5 } };
const F1 = { source: 'mark', markHeight: 1.15, gap: 0.3, pill: { padX: 0.4, padY: 0.32, radius: 0.5 } };

export default {
  title: 'A2b + W10c3: fine-tuning the lockup',
  subtitle:
    'The mark in every context with the chosen pill (F1). F1–F4 change only the pill’s proportions: height in the 44 px head, padding, mark size, gap. Rail and phone keep the mark alone; the favourites list below must stay untouched.',
  current: false,
  lockupHeight: 36,
  lockupWord: WORD,
  lockup: F1,
  wordmarkBase: 'A2b',
  wordmarkIntro: 'F1 is round 7 as chosen (36 px tall in the 44 px head, 4 px air above and below). F2 is the same pill at 40 px. F3 tightens the padding so the word sits closer to the pill’s ends. F4 enlarges the mark inside the pill and narrows the gap to the word.',
  variants: [
    {
      label: 'A2b',
      direction: 'tile',
      title: 'The mark, final candidate',
      desc: 'Round body, fan tail, dorsal and ventral fin, head band curving with the gill line, wider middle band, eye r 26; tile radius 146 (the module chips’ 8/28), fish at 0.8; Android adaptive at 0.56.',
      params: A2b,
      rail: 'app',
      notes:
        '16 px: body, two bands, tail, the eye a 1 px dot. One colour: same shape. Safe zone: 153 of 156. Rail: tile 28 px in the 59 px brand box; phone: 32 px in the 44 px box; wide: the pill, 36 px tall, 4 px air to the head’s edges, the favourites list starts 12 px below as today.',
    },
  ],
  wordmarks: [
    {
      label: 'F1',
      title: 'As chosen (W10c3): pill 36 px, padding 0.4 / 0.32, mark 1.15, gap 0.3',
      word: WORD,
      lockup: F1,
      notes: 'Reference. Pill about 150 × 36 px at the sidebar’s 248 px; 4 px above and below inside the 44 px head.',
    },
    {
      label: 'F2',
      title: 'Same pill at 40 px',
      word: WORD,
      lockup: F1,
      height: 40,
      notes: 'Fills the head to 2 px above and below; the letters grow to the size of the nav labels’ cap height plus a little. Louder, fewer pixels wasted.',
    },
    {
      label: 'F3',
      title: 'Tighter padding (0.3 / 0.26), 36 px',
      word: WORD,
      lockup: { source: 'mark', markHeight: 1.15, gap: 0.3, pill: { padX: 0.3, padY: 0.26, radius: 0.5 } },
      notes: 'The same letters at the same height look bigger because the pill shrinks around them; more air to the search field on the right.',
    },
    {
      label: 'F4',
      title: 'Bigger mark (1.3) and narrower gap (0.24), 36 px',
      word: WORD,
      lockup: { source: 'mark', markHeight: 1.3, gap: 0.24, pill: { padX: 0.36, padY: 0.3, radius: 0.5 } },
      notes: 'The fish leads, the word follows closer; the mark in the pill matches the rail tile’s fish size more closely.',
    },
  ],
};
