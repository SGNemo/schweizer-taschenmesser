// Banner round 19. Feedback on 18: the fin must be narrow at the o (base on the o's height) and open
// to the right like a fan with a round end; widest point far right.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const R = { headStyle: 'flat', tailStyle: 'fan', stripeAt: 112, band: 24, head: 170, eye: 18, midBand: [116, 300, 524, 746] };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'O1', title: 'Fächer: schmal am o, breit und rund am Ende', desc: 'Basis 72 hoch auf der o-Mitte, Spitzen bei 66 % der Länge (170), Gesamthöhe 230.', wm: { ...R, tail: 170, finBase: 72, finTip: 0.66, finHeight: 230 } },
    { ...base, label: 'O2', title: 'Basis so hoch wie das o (aus O1)', desc: 'Basis 150 (volle o-Höhe), sonst gleich.', wm: { ...R, tail: 170, finBase: 150, finTip: 0.66, finHeight: 230 } },
    { ...base, label: 'O3', title: 'Kürzer (aus O1)', desc: 'Länge 140, Höhe 210.', wm: { ...R, tail: 140, finBase: 72, finTip: 0.66, finHeight: 210 } },
  ],
};
