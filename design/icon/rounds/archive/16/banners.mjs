// Banner round 16. Feedback on 15: head and tail do not match the reference – head more pointed,
// eye with a small white highlight, head band curved again, the tail must read as a caudal fin.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const R = { headStyle: 'flat', tailStyle: 'fan', stripeAt: 118, band: 34, head: 190, eye: 20 };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'L1', title: 'Spitzer Kopf, Reflexauge, Fächerflosse · Band mittig im e', desc: 'Kopf spitz zulaufend, gebogener Kopfstreifen, dunkles Auge mit weissem Reflexpunkt; Schwanzflosse mit schmaler Basis, die sich zum Fächer öffnet.', wm: { ...R, midBand: 300 } },
    { ...base, label: 'L2', title: 'Band links im e (aus L1)', desc: 'Band im linken Bogen des e.', wm: { ...R, midBand: 262 } },
    { ...base, label: 'L3', title: 'Band schräg im e (aus L1)', desc: 'Band um 25° geneigt.', wm: { ...R, midBand: { x: 305, angle: 25 } } },
    { ...base, label: 'L4', title: 'Grössere Flosse (aus L1)', desc: 'Nur die Schwanzflosse: 170 statt 140 lang.', wm: { ...R, midBand: 300, tail: 170 } },
  ],
};
