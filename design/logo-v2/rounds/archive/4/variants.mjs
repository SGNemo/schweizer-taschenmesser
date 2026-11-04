// Round 4 – A2b is the mark, W10 (pill) the sidebar head; the name in the pill needs a rounder, less
// standard letterform. Four letterings in the same pill. Rendered by `node render.mjs rounds/4`.
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
const W10A = { text: 'Nemo', family: 'round', weight: 700 };

export default {
  title: 'A2b as the mark, the pill with a rounder lettering',
  subtitle:
    'A2b in every context once more (lockup = W10a). W10a–W10d: the same accent pill with mark and name in the contrast colour; only the letters change – own monoline rounded lettering (regular, bolder, lowercase) and Nunito ExtraBold for comparison.',
  current: false,
  lockupHeight: 36,
  lockupWord: W10A,
  lockup: PILL,
  wordmarkBase: 'A2b',
  wordmarkIntro:
    'The round lettering is an own drawing (circles, stems, arches, round ends; no font): N from two stems and a diagonal, e a circle with a bar open at the lower right, m a stem with two arches, o a circle. Weights are stroke widths of the cap height (700 = 0.22, 800 = 0.25). Nunito ExtraBold (the previous wordmark’s font, rounded terminals) is the ready-made alternative.',
  variants: [
    {
      label: 'A2b',
      direction: 'tile',
      title: 'The mark (round 3 choice)',
      desc: 'Round body, fan tail, dorsal and ventral fin, the head band curving with the gill line, the middle band wider; eye r 26. Unchanged from round 3.',
      params: A2b,
      rail: 'app',
      notes:
        '16 px: body, two bands, tail; the eye is a 1 px dot. One colour: same shape. Safe zone: 0.56 (reach 153 of 156). Rail: tile 28 px; wide sidebar: the pill (W10a) 36 px tall, leaves the 44 px head with 4 px air above and below.',
    },
  ],
  wordmarks: [
    {
      label: 'W10a',
      title: 'Round lettering 700 · "Nemo"',
      word: W10A,
      lockup: PILL,
      notes: 'Monoline, stroke 0.22 of the cap height, x-height 0.78. Open, even, the e keeps a clear counter down to 28 px.',
    },
    {
      label: 'W10b',
      title: 'Round lettering 800, taller x-height · "Nemo"',
      word: { text: 'Nemo', family: 'round', weight: 800, round: { xHeight: 0.82, eOpen: 42 } },
      lockup: PILL,
      notes: 'Bolder (0.25) with a taller x-height so the counters stay open; the softest "Nemo" that is still a word at 28 px. 900 was tried and closes the e.',
    },
    {
      label: 'W10c',
      title: 'Round lettering 800 · lowercase "nemo"',
      word: { text: 'nemo', family: 'round', weight: 800 },
      lockup: { ...PILL, align: 'x', markHeight: 1.45 },
      notes: 'All arches and circles, the roundest option; the mark is centred on the x-height. Lowercase changes how the name is written elsewhere (title bar, store) – a decision, not only a look.',
    },
    {
      label: 'W10d',
      title: 'Nunito ExtraBold · "Nemo" (ready-made font)',
      word: { text: 'Nemo', family: 'nunito' },
      lockup: PILL,
      notes: 'Rounded terminals, the font of the previous wordmark. Less distinctive than the own lettering but proven at small sizes.',
    },
  ],
};
