// Round 7 – "just write NEMO in capitals": no e aperture to fight. Uppercase E, M, O in the same
// rounded monoline lettering; four settings in the pill. Rendered by `node render.mjs rounds/7`.
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
const C1 = { text: 'NEMO', family: 'round', weight: 700 };

export default {
  title: 'NEMO in capitals in the pill',
  subtitle:
    'Same pill and mark (A2b). The name in capitals of the own rounded monoline lettering: N (two stems, diagonal), E (stem, three bars, the middle one shorter), M (two stems, diagonals meeting at the baseline or half way up), O (full circle). No aperture, nothing to close at 28 px. True pixels at 36 and 28 px.',
  current: false,
  lockupHeight: 36,
  lockupWord: C1,
  lockup: PILL,
  wordmarkBase: 'A2b',
  wordmarkIntro: 'W10c1 is the plain setting; W10c2 the heavier stroke; W10c3 moves the M’s vertex to half height (more geometric); W10c4 opens the letter spacing (airier, longer pill).',
  variants: [
    {
      label: 'A2b',
      compact: true,
      direction: 'tile',
      title: 'The mark (unchanged)',
      desc: 'As decided in round 3; shown with W10c1 in the sidebar.',
      params: A2b,
      rail: 'app',
      notes: 'Reference only.',
    },
  ],
  wordmarks: [
    {
      label: 'W10c1',
      title: 'NEMO · stroke 700, M to the baseline',
      word: C1,
      lockup: PILL,
      notes: 'Even stroke 0.22 of the cap height; every letter is open at 28 px. The pill grows about 12 % in width against the "Nemo" pill.',
    },
    {
      label: 'W10c2',
      title: 'NEMO · stroke 800',
      word: { text: 'NEMO', family: 'round', weight: 800 },
      lockup: PILL,
      notes: 'Heavier, the O’s counter and the E’s gaps stay clear because the capitals are taller than the lowercase was.',
    },
    {
      label: 'W10c3',
      title: 'NEMO · stroke 700, M vertex at half height',
      word: { text: 'NEMO', family: 'round', weight: 700, round: { mVertex: 0.5 } },
      lockup: PILL,
      notes: 'The M becomes a geometric shape (like the fish’s tail notch); slightly more "logo", slightly less "word".',
    },
    {
      label: 'W10c4',
      title: 'NEMO · stroke 700, wider letter spacing',
      word: { text: 'NEMO', family: 'round', weight: 700, round: { gap: 1.3 } },
      lockup: PILL,
      notes: 'Spaced capitals read calmer and more like a label; the pill is about 8 % longer than W10c1.',
    },
  ],
};
