// Banner round 17. Feedback on 16: head and tail still off the reference (re-measured: fuller head,
// pointed nose, nearly straight band close to the back edge; tail with short concave base, diagonal
// flares, big round outer edge, taller than the letters). Bands back in N, m and o.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const R = { headStyle: 'flat', tailStyle: 'fan', stripeAt: 112, band: 36, head: 170, eye: 18, tail: 150 };
const ALL = [116, 300, 524, 746];
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'M1', title: 'Referenz-Kopf und -Flosse, Band in jedem Buchstaben', desc: 'Kopf/Flosse nach dem Bild, senkrechte Bänder in N, e, m, o (wie H1).', wm: { ...R, midBand: ALL } },
    { ...base, label: 'M2', title: 'Schmalere Bänder (aus M1)', desc: 'Bänder 24 statt 32 breit, damit die Buchstaben mehr Körper behalten.', wm: { ...R, midBand: ALL, band: 24 } },
    { ...base, label: 'M3', title: 'Bänder leicht geneigt (aus M1)', desc: 'Alle vier Bänder um 12° geneigt – wie der Körperstreifen eines schwimmenden Fischs.', wm: { ...R, midBand: ALL.map((x) => ({ x, angle: 12 })) } },
    { ...base, label: 'M4', title: 'Band im N weiter rechts (aus M1)', desc: 'Nur das N: Band durch den rechten Stamm statt durch die Diagonale.', wm: { ...R, midBand: [160, 300, 524, 746] } },
  ],
};
