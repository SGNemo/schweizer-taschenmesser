// Banner round 20. Feedback on O1: tips too angular, base ("Stamm") a bit too narrow.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const R = { headStyle: 'flat', tailStyle: 'fan', stripeAt: 112, band: 24, head: 170, eye: 18, midBand: [116, 300, 524, 746], tail: 170, finTip: 0.6, finHeight: 230 };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'P1', title: 'O1 mit runden Spitzen, Basis 96', desc: 'Spitzen oben/unten gerundet (34), Basis 96 statt 72 hoch.', wm: { ...R, finBase: 96, finRound: 34 } },
    { ...base, label: 'P2', title: 'Basis 110 (aus P1)', desc: 'Basis noch etwas höher.', wm: { ...R, finBase: 110, finRound: 34 } },
    { ...base, label: 'P3', title: 'Noch rundere Spitzen (aus P1)', desc: 'Rundung 50 statt 34.', wm: { ...R, finBase: 96, finRound: 50 } },
  ],
};
