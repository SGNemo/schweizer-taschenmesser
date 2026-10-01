// Banner round 10. Feedback: B7 and B8 are the best. The two differ in head width and tail
// shape; this round isolates each difference.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const base = { concept: 'headfin', school: true, tag: A };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'B7', title: 'Schmaler Kopf, Fächerflosse', desc: 'Unverändert aus Runde 9.', wm: { band: 30, stripeAt: 100 } },
    { ...base, label: 'B9', title: 'Schmaler Kopf, Kerbe (aus B7)', desc: 'Nur die Schwanzflosse: mit Kerbe.', wm: { band: 30, stripeAt: 100, tailStyle: 'fork' } },
    { ...base, label: 'B10', title: 'Breiter Kopf, Fächerflosse (aus B8)', desc: 'Kopf 190 breit, Band hinten, runde Fächerflosse.', wm: { band: 32, stripeAt: 128, head: 190 } },
    { ...base, label: 'B8', title: 'Breiter Kopf, Kerbe', desc: 'Unverändert aus Runde 9.', wm: { band: 32, stripeAt: 128, head: 190, tailStyle: 'fork' } },
  ],
};
