// Round 3 – A2 is the base ("A2 is the best, the wordmark not at all"). Four refinements of A2 with one
// change each, and four new answers for the sidebar head: pill, mark only, own rounded lettering in
// the accent and in the text colour. Rendered by `node render.mjs rounds/3`.
const A1 = {
  body: { nose: 466, joint: 176, height: 132, peak: 0.48, blunt: 0.74, stalk: 50 },
  tail: { style: 'fan', length: 68, spread: 76, notch: 16, overlap: 30 },
  stripes: { at: [0.72, 0.38], width: 36, bend: -16 },
  eye: { at: 0.84, dy: -0.22, r: 26 },
  soften: 12,
};
const VIEWS = { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.56 } };
const A2 = { ...A1, fins: { dorsal: { height: 30, from: 0.3, to: 0.7 }, ventral: { height: 18, from: 0.36, to: 0.6 } }, views: VIEWS };
// A2a: bigger eye (r 32, a touch further forward).
const A2a = { ...A2, eye: { at: 0.83, dy: -0.2, r: 32 } };
// A2b: bands follow the body – the head band curves more (−24), the middle band is wider (40).
const A2b = { ...A2, stripes: { at: [0.7, 0.37], width: [34, 40], bend: [-24, -16] } };
// A2c: stronger fins (dorsal 42, ventral 24).
const A2c = { ...A2, fins: { dorsal: { height: 42, from: 0.26, to: 0.72 }, ventral: { height: 24, from: 0.34, to: 0.62 } }, views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.54 } } };
// A2d: 5° upward lean.
const A2d = { ...A2, tilt: -5, views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.52 } } };

const W = { text: 'Nemo', weight: 700, tracking: -0.01 };

export default {
  title: 'A2 refined, four answers for the sidebar head',
  subtitle:
    'A2 from round 2 for comparison; A2a–A2d change one thing each. The wide sidebar shows the tile alone (36 px) in the variant blocks; the wordmark block tries a pill, the mark alone, and an own rounded lettering (accent / text colour), all with A2.',
  current: false,
  lockupHeight: 36,
  lockupWord: W,
  lockup: { source: 'markOnly' },
  wordmarkBase: 'A2',
  wordmarkIntro:
    'Round 2’s fish-words, o-fish and badge were rejected, so the word steps back: W10 keeps mark and name on one accent pill (name in the contrast colour, like a filled button); W11 drops the word (the name stays in the window title and the About page); W13 sets the name in an own monoline rounded lettering built from circles and stems like the fish’s shapes, in the accent; W14 the same lettering in the text colour so the mark carries the colour alone.',
  variants: [
    {
      label: 'A2',
      compact: true,
      direction: 'tile',
      title: 'Round 2 base (for comparison)',
      desc: 'Round body, fan tail, dorsal and ventral fin, two bands, eye r 26.',
      params: A2,
      rail: 'app',
      notes: 'Reference only.',
    },
    {
      label: 'A2a',
      direction: 'tile',
      title: 'Bigger eye',
      desc: 'Change: eye r 32 (from 26), a touch further forward and higher.',
      params: A2a,
      rail: 'app',
      notes: '16 px: the eye stays a visible 2 px dot (A2’s is 1 px); nothing else changes. Friendlier face, slightly less neutral.',
    },
    {
      label: 'A2b',
      direction: 'tile',
      title: 'Bands follow the body',
      desc: 'Change: the head band curves with the gill line (bend −24), the middle band is a little wider (40) and curves less (−16).',
      params: A2b,
      rail: 'app',
      notes: '16 px: bands stay 2 px; the curve is visible from 32 px. Reads more like a real clownfish than A2’s parallel bands; one colour unchanged.',
    },
    {
      label: 'A2c',
      direction: 'tile',
      title: 'Stronger fins',
      desc: 'Change: dorsal fin 42 (from 30) over a longer base, ventral fin 24 (from 18).',
      params: A2c,
      rail: 'app',
      notes: '16 px: the dorsal fin now shows as a bump. Silhouette the most "fish" of the four. Safe zone needs 0.54 (taller shape). Rail: the mark gets a little taller than wide.',
    },
    {
      label: 'A2d',
      direction: 'tile',
      title: 'Slight lean',
      desc: 'Change: the fish leans 5° upwards (nose up), everything else as A2.',
      params: A2d,
      rail: 'app',
      notes: '16–24 px: the lean is invisible; from 48 px it adds a little life. Costs width in the rail and tile (safe zone 0.52). Keep only if A2 feels too static.',
    },
  ],
  wordmarks: [
    {
      label: 'W10',
      title: 'Pill · mark and name on one accent pill',
      word: W,
      lockup: { source: 'mark', markHeight: 1.15, gap: 0.3, pill: { padX: 0.4, padY: 0.32, radius: 0.5 } },
      notes: 'One shape, no second fish; the name sits in the contrast colour like on a filled button. Heavier than the rail tile; could be read as a button, so it needs the hover state of the brand link.',
    },
    {
      label: 'W11',
      title: 'Mark only · the tile alone, no word',
      word: W,
      lockup: { source: 'markOnly' },
      notes: 'Quietest option; the name stays in the window title, the About page and the PWA name. Wide and rail become the same tile (36 / 28 px).',
    },
    {
      label: 'W13',
      title: 'Own rounded lettering · accent, next to the tile',
      word: { text: 'Nemo', family: 'round', weight: 800 },
      lockup: { source: 'app', markHeight: 1.3, gap: 0.42, art: { ink: 'accent' } },
      notes: 'Monoline letters from circles and stems (own drawing, no font), round ends like the fish’s soft corners. Accent letters compete a little with the tile.',
    },
    {
      label: 'W14',
      title: 'Own rounded lettering · text colour',
      word: { text: 'Nemo', family: 'round', weight: 800 },
      lockup: { source: 'app', markHeight: 1.3, gap: 0.42, art: { ink: 'text' } },
      notes: 'Same lettering, the mark alone carries the colour; the calmest pairing that still has a drawn word.',
    },
  ],
};
