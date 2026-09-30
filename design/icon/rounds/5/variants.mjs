// Round 5. Feedback round 4: "C8". Each variant changes exactly one thing on C8.
const C8 = {
  body: { height: 112 },
  stripes: { at: [0.72, 0.36], width: 40, bend: [-16, -10], mode: 'cut' },
  eye: { style: 'cut', r: 23 },
  colors: { body: '#FFFFFF' },
  soften: 10,
  mono: { style: 'negative' },
  mark: { colors: { body: '#F26A1E' } },
  tilt: -35,
  plate: { shape: 'rounded', radius: 112, fill: '#F26A1E', scale: 0.96, dx: 0, dy: 6 },
  adaptive: { scale: 0.68, bg: '#F26A1E', dy: 4 },
};
const DEEP = '#E0550F';

export default {
  title: 'C8 verfeinern',
  subtitle: 'Basis C8 (Runde 4 = C6 mit Auge r 23). C12–C15 ändern jeweils genau eine Sache.',
  variants: [
    { label: 'C8', title: 'Basis aus Runde 4', desc: 'Orange Kachel, weisser Fisch 96 %, 35° geneigt, zwei Bänder (40), Auge r 23 ausgestanzt.', params: C8 },
    {
      label: 'C12',
      title: 'Tieferes Orange (aus C8)',
      desc: 'Nur die Farbe: #E0550F. Kachel auf heller Taskleiste 3,5:1 statt 2,8:1, Weiss auf Orange 3,8:1 statt 3,1:1.',
      params: { ...C8, plate: { ...C8.plate, fill: DEEP }, adaptive: { ...C8.adaptive, bg: DEEP }, mark: { colors: { body: DEEP } } },
    },
    {
      label: 'C13',
      title: 'Kräftigere Bänder (aus C8)',
      desc: 'Nur die Bänder: 50 statt 40 breit, etwas weiter auseinander.',
      params: { ...C8, stripes: { ...C8.stripes, at: [0.74, 0.33], width: 50 } },
    },
    {
      label: 'C14',
      title: 'Auge etwas kleiner (aus C8)',
      desc: 'Nur das Auge: r 20 – Mittelweg, damit es gross nicht dominiert und klein noch sichtbar bleibt.',
      params: { ...C8, eye: { style: 'cut', r: 20 } },
    },
    {
      label: 'C15',
      title: 'Eigene Kleinversion ≤ 24 px (aus C8)',
      desc: 'Ab 32 px identisch mit C8; für 16 und 24 px nur ein breites Band und Auge r 27.',
      params: C8,
      small: { stripes: { at: [0.62], width: 58, bend: -14 }, eye: { style: 'cut', r: 27, at: 0.87 } },
    },
  ],
};
