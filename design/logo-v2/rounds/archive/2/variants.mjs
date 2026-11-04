// Round 2 – direction A refined (round 1: "A is the best, none convinces yet") and the wordmark as a
// fish instead of plain type. Rendered by `node render.mjs rounds/2`.
const A = {
  body: { nose: 472, joint: 168, height: 118, peak: 0.5, blunt: 0.66, stalk: 42 },
  tail: { length: 82, spread: 82, notch: 26, overlap: 30 },
  stripes: { at: [0.74, 0.4], width: 34, bend: -10 },
  eye: { at: 0.86, dy: -0.2, r: 24 },
  soften: 12,
  views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.6 } },
};
// A1: rounder, chubbier body and a rounded fan tail (the clownfish's real tail shape).
const A1 = {
  body: { nose: 466, joint: 176, height: 132, peak: 0.48, blunt: 0.74, stalk: 50 },
  tail: { style: 'fan', length: 68, spread: 76, notch: 16, overlap: 30 },
  stripes: { at: [0.72, 0.38], width: 36, bend: -16 },
  eye: { at: 0.84, dy: -0.22, r: 26 },
  soften: 12,
  views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.6 } },
};
// A2: A1 plus a dorsal and a small ventral fin (the clownfish silhouette).
const A2 = { ...A1, fins: { dorsal: { height: 30, from: 0.3, to: 0.7 }, ventral: { height: 18, from: 0.36, to: 0.6 } }, views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.56 } } };
// A3: A1 with a bigger eye, more curved bands and a slight upward tilt (friendlier, livelier).
const A3 = { ...A1, eye: { at: 0.82, dy: -0.2, r: 34 }, stripes: { at: [0.68, 0.36], width: 40, bend: -22 }, tilt: -6, views: { tile: { radius: 146, scale: 0.8 }, adaptive: { scale: 0.55 } } };
// A4: A2 bleeding off the tile (tail and fins touch the edges); the transparent mark stays whole.
const A4 = { ...A2, views: { tile: { radius: 146, scale: 1.16, clip: true, dx: -10, dy: 0 }, adaptive: { scale: 0.56 } } };

const FISHWORD = { head: { length: 0.9, gap: 0.12, eye: 0.13 }, tail: { style: 'fan', length: 0.5, spread: 0.6, gap: 0.12, bulge: 0.1 } };
const W5 = { text: 'Nemo', weight: 800, tracking: -0.02 };

export default {
  title: 'A refined, wordmark as a fish',
  subtitle:
    'Base A from round 1 for comparison; A1–A4 each change one or two things. Lockups use W5 (fish-word) in the wide sidebar; the rail shows the mark alone. Wordmarks W5–W8 are shown with A2.',
  current: false,
  lockupHeight: 36,
  lockupWord: W5,
  lockup: { source: 'none', art: { ink: 'accent', ...FISHWORD } },
  wordmarkBase: 'A2',
  wordmarkIntro:
    'No plain type: the letters stay in the accent and become the fish. W5 Inter ExtraBold with a flat head (eye cut out) and a fan tail; W6 the same with the previous Nunito letters for a direct comparison of the typeface; W7 the mark swims in as the "o"; W8 the word knocked out of the fish silhouette.',
  variants: [
    {
      label: 'A',
      compact: true,
      direction: 'tile',
      title: 'Round 1 base (for comparison)',
      desc: 'Lens body, forked tail, two straight bands, eye r 24; tile scale 0.8.',
      params: A,
      rail: 'app',
      notes: 'Reference only.',
    },
    {
      label: 'A1',
      direction: 'tile',
      title: 'Round body, fan tail',
      desc: 'Changes: chubbier oval body (height 132, blunter nose) and a rounded fan tail instead of the fork; bands a touch wider and more curved, eye r 26.',
      params: A1,
      rail: 'app',
      notes:
        '16 px: body, two bands and the tail read; the eye becomes a 1 px dot. Silhouette: closer to the previous tile fish (C12) but upright. One colour: same shape, cut-outs keep it. Safe zone: ok at 0.6. Sidebar: the tile at 28 px is as heavy as the rail icons’ chips.',
    },
    {
      label: 'A2',
      direction: 'tile',
      title: 'A1 plus fins',
      desc: 'Changes: a soft dorsal fin and a small ventral fin on A1 – the outline says clownfish even without the bands.',
      params: A2,
      rail: 'app',
      notes:
        '16 px: the fins fold into the body (fine); 24 px and up they show. Silhouette: the most recognisable of the four. One colour: fins read as bumps, no detail below 1 px. Safe zone: needs 0.56 (the fins add height), still 66 dp clean.',
    },
    {
      label: 'A3',
      direction: 'tile',
      title: 'Bigger eye, curved bands, slight tilt',
      desc: 'Changes: eye r 34 placed higher, bands curve with the body (bend −22), the fish leans 6° upwards.',
      params: A3,
      rail: 'app',
      notes:
        '16 px: the big eye survives as a 2 px dot, the lean is invisible. Silhouette: friendlier face, less neutral. The tilt costs a little width in the rail (28 px box). Safe zone: needs 0.55.',
    },
    {
      label: 'A4',
      direction: 'tile',
      title: 'A2 bleeding off the tile',
      desc: 'Changes: the fish fills the tile at 1.16 and is clipped (tail and fins touch the edge); mark, rail and favicon keep the whole fish.',
      params: A4,
      rail: 'app',
      notes:
        '16 px: the strongest of the four (bigger white shapes). Silhouette on the tile is partly implied by the edges; the maskable/Android layer stays inside the safe zone at 0.6 with the whole fish. One colour: unchanged (mark).',
    },
  ],
  wordmarks: [
    {
      label: 'W5',
      title: 'Fish-word · Inter ExtraBold, flat head + fan tail',
      word: W5,
      art: { ink: 'accent', ...FISHWORD },
      notes: 'Modern version of the previous Q2: one accent fill, no edges or highlights; the head’s flat side and the gap before the N act as the first band.',
    },
    {
      label: 'W6',
      title: 'Fish-word · Nunito ExtraBold (previous letters)',
      word: { text: 'Nemo', family: 'nunito' },
      art: { ink: 'accent', ...FISHWORD },
      notes: 'Same head and tail, the rounded Nunito letters of the old wordmark: compare the typeface directly against W5.',
    },
    {
      label: 'W7',
      title: 'o-fish · the mark swims in as the "o"',
      word: W5,
      art: { ink: 'accent', ofish: { scale: 1.3, gap: 0.06 } },
      notes: 'Playful; at 28 px it reads "Nem" plus fish, so it needs the mark to be known. Shares the mark exactly (sidebar and rail show the same fish).',
    },
    {
      label: 'W8',
      title: 'Badge · the word knocked out of the fish',
      word: W5,
      art: { badge: { height: 2.2, padRight: 0.5, tail: 0.62, spread: 0.95 } },
      notes: 'Boldest and most compact; one orange shape in the sidebar head (44 px tall), the word in white. Heavier than everything around it.',
    },
  ],
};
