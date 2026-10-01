// Banner round 18. Feedback on 17: M2 (bands 24) and the head are right, the eye highlight goes to
// the top right; the fin now follows the crop: taller than wide, short concave base, short diagonals
// to rounded tips close to the base, then one big half-arc.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const R = { headStyle: 'flat', tailStyle: 'fan', stripeAt: 112, band: 24, head: 170, eye: 18, midBand: [116, 300, 524, 746] };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'N1', title: 'M2 mit Referenz-Flosse', desc: 'Flosse 130 lang bei 226 Höhe, Spitzen bei 25 %; Reflexpunkt oben rechts im Auge.', wm: { ...R, tail: 130, finTip: 0.25 } },
    { ...base, label: 'N2', title: 'Etwas breiter (aus N1)', desc: 'Flosse 150 lang, Spitzen bei 30 %.', wm: { ...R, tail: 150, finTip: 0.3 } },
  ],
};
