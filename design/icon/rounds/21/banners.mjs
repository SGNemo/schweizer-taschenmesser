// Banner round 21. "You had it once": the earlier fin shapes next to the current one, same head and
// bands (M2), so the right one can be pointed at.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const R = { headStyle: 'flat', stripeAt: 112, band: 24, head: 170, eye: 18, midBand: [116, 300, 524, 746] };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'Q1', title: 'D-Flosse aus Runde 17 (M1/M2)', desc: 'Ein „D“: leicht eingezogene linke Kante, grosser Rundbogen, höher als die Buchstaben.', wm: { ...R, tailStyle: 'd', tail: 150 } },
    { ...base, label: 'Q2', title: 'Schwanzansatz + runde Flosse aus Runde 13 (H1)', desc: 'Schmaler werdender Ansatz mit weissem Band, dann runde Flosse mit dunkler Kante.', wm: { ...R, tail: 140 } },
    { ...base, label: 'Q3', title: 'Fächer aus Runde 20 (P1)', desc: 'Schmale Basis am o, Kanten öffnen sich nach rechts, runde Spitzen.', wm: { ...R, tailStyle: 'fan', tail: 170, finTip: 0.6, finHeight: 230, finBase: 96, finRound: 34 } },
    { ...base, label: 'Q4', title: 'D-Flosse, Basis stärker eingezogen (aus Q1)', desc: 'Wie Q1, linke Kante tiefer gewölbt, Flosse 160 lang.', wm: { ...R, tailStyle: 'd', tail: 160 } },
  ],
};
