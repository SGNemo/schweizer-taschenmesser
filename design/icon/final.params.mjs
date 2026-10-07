// Master parameters of the final Nemo icon (round 6, variant C12) and wordmark (round 2, W2).
// Everything the brand assets need comes from here; change a value, then run `npm run export`
// (see docs/howto/design-brand.md).
export const DEEP = '#E0550F'; // logo orange: 3.5:1 on a light taskbar, 3.8:1 with white (AA for UI)

export const ICON = {
  body: { height: 112 },
  stripes: { at: [0.72, 0.36], width: 40, bend: [-16, -10], mode: 'cut' },
  eye: { style: 'cut', r: 23 },
  colors: { body: '#FFFFFF' },
  soften: 10,
  tilt: -35, // degrees, the head points to the top-right corner
  mono: { style: 'negative' },
  mark: { colors: { body: DEEP } },
  plate: { shape: 'rounded', radius: 112, fill: DEEP, scale: 0.96, dx: 0, dy: 6 },
  adaptive: { scale: 0.68, bg: DEEP, dx: 0, dy: 4 },
};

// Wordmark Q2 (banner round 21, final): letters are the body with a white band (24) in every letter;
// clownfish head (pointed nose, nearly straight band, dark eye with a highlight top right) in front
// of the N; tapering tail base with band and a round caudal fin with a dark edge after the o.
// No other fins (rounds 11–13 and 16–20 rejected every fin and fan variant).
export const WORDMARK = {
  concept: 'clown',
  params: { colors: { fish: DEEP }, headStyle: 'flat', stripeAt: 112, band: 24, head: 170, eye: 18, tail: 140, midBand: [116, 300, 524, 746] },
};
/** Claim under the wordmark (README header + social preview only, never in the app): a backronym of NEMO. */
export const CLAIM = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']], sep: ' · ' };

/** Maskable PWA icon: the whole outline stays inside the safe circle (radius 40 % of the canvas). */
export const MASKABLE_SAFE_RADIUS = 196;
