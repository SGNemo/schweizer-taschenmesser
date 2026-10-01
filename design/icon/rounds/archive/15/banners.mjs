// Banner round 15. Feedback: take the head (straight white band, pointed nose, white eye with pupil)
// and the flat-based fan tail from the reference; letters stay orange; vary the band in the e.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const R = { headStyle: 'flat', tailStyle: 'fan', stripeAt: 120, band: 34, head: 170 };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'K1', title: 'Neuer Kopf + Flosse, Band mittig im e', desc: 'Kopf und Fächerflosse nach deinem Bild, Buchstaben orange, Band wie bisher durch die Mitte des e.', wm: { ...R, midBand: 300 } },
    { ...base, label: 'K2', title: 'Band links im e (aus K1)', desc: 'Das Band sitzt im linken Bogen des e, der Querbalken bleibt frei.', wm: { ...R, midBand: 262 } },
    { ...base, label: 'K3', title: 'Band rechts im e (aus K1)', desc: 'Das Band sitzt am rechten Rand des e, dort wo sich die Form öffnet.', wm: { ...R, midBand: 346 } },
    { ...base, label: 'K4', title: 'Band schräg durch das e (aus K1)', desc: 'Dasselbe Band, um 25° geneigt – wie der Körperstreifen eines schwimmenden Fischs.', wm: { ...R, midBand: { x: 305, angle: 25 } } },
  ],
};
