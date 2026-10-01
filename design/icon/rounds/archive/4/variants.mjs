// Round 4. Feedback round 3: "C6". Each variant changes exactly one thing on C6.
const C6 = {
  body: { height: 112 },
  stripes: { at: [0.72, 0.36], width: 40, bend: [-16, -10], mode: 'cut' },
  eye: { style: 'cut', r: 17 },
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
  title: 'C6 verfeinern',
  subtitle: 'Basis C6 (Runde 3). C8–C11 ändern jeweils genau eine Sache: Auge, Bänder, Orangeton, eigene Kleinversion für 16/24 px.',
  variants: [
    { label: 'C6', title: 'Basis aus Runde 3', desc: 'Orange Kachel, weisser Fisch 96 %, 35° nach oben rechts, zwei Bänder (40) + Auge (r 17) ausgestanzt.', params: C6 },
    { label: 'C8', title: 'Grösseres Auge (aus C6)', desc: 'Nur das Auge: r 23 statt 17, bleibt bei 16 px als Punkt sichtbar.', params: { ...C6, eye: { style: 'cut', r: 23 } } },
    {
      label: 'C9',
      title: 'Kräftigere Bänder (aus C6)',
      desc: 'Nur die Bänder: 50 statt 40 breit, etwas weiter auseinander – bei 16/24 px klarer getrennt.',
      params: { ...C6, stripes: { ...C6.stripes, at: [0.74, 0.33], width: 50 } },
    },
    {
      label: 'C10',
      title: 'Tieferes Orange (aus C6)',
      desc: 'Nur die Farbe: #E0550F statt #F26A1E. Kontrast Weiss/Orange 3,8:1 statt 3,1:1, Kachel auf heller Taskleiste 3,5:1 statt 2,8:1.',
      params: { ...C6, plate: { ...C6.plate, fill: DEEP }, adaptive: { ...C6.adaptive, bg: DEEP }, mark: { colors: { body: DEEP } } },
    },
    {
      label: 'C11',
      title: 'Eigene Kleinversion ≤ 24 px (aus C6)',
      desc: 'Ab 32 px identisch mit C6; für 16 und 24 px (ICO, Tray, Taskleiste 100 %) nur ein breites Band und grösseres Auge.',
      params: C6,
      small: { stripes: { at: [0.62], width: 58, bend: -14 }, eye: { style: 'cut', r: 26, at: 0.87 } },
    },
  ],
};
