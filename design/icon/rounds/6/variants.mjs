// Round 6. Feedback round 5: "C12". Each variant changes exactly one thing on C12.
const DEEP = '#E0550F';
const C12 = {
  body: { height: 112 },
  stripes: { at: [0.72, 0.36], width: 40, bend: [-16, -10], mode: 'cut' },
  eye: { style: 'cut', r: 23 },
  colors: { body: '#FFFFFF' },
  soften: 10,
  mono: { style: 'negative' },
  mark: { colors: { body: DEEP } },
  tilt: -35,
  plate: { shape: 'rounded', radius: 112, fill: DEEP, scale: 0.96, dx: 0, dy: 6 },
  adaptive: { scale: 0.68, bg: DEEP, dy: 4 },
};

export default {
  title: 'C12 verfeinern',
  subtitle: 'Basis C12 (Runde 5 = C8 in #E0550F). C16–C18 ändern jeweils genau eine Sache.',
  variants: [
    { label: 'C12', title: 'Basis aus Runde 5', desc: 'Kachel #E0550F, weisser Fisch 96 %, 35° geneigt, zwei Bänder (40), Auge r 23 ausgestanzt.', params: C12 },
    {
      label: 'C16',
      title: 'Kräftigere Bänder (aus C12)',
      desc: 'Nur die Bänder: 50 statt 40 breit, etwas weiter auseinander.',
      params: { ...C12, stripes: { ...C12.stripes, at: [0.74, 0.33], width: 50 } },
    },
    {
      label: 'C17',
      title: 'Eigene Kleinversion ≤ 24 px (aus C12)',
      desc: 'Ab 32 px identisch mit C12; für 16 und 24 px nur ein breites Band und Auge r 27.',
      params: C12,
      small: { stripes: { at: [0.62], width: 58, bend: -14 }, eye: { style: 'cut', r: 27, at: 0.87 } },
    },
    {
      label: 'C18',
      title: 'Mehr Luft (aus C12)',
      desc: 'Nur die Grösse: Fisch 88 % statt 96 %, ruhiger Rand um den Fisch, klein etwas weniger präsent.',
      params: { ...C12, plate: { ...C12.plate, scale: 0.88, dy: 4 } },
    },
  ],
};
