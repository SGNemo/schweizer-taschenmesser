// Banner round 14. Feedback: H1's "Nemo" is not readable enough; two references: (1) plain letters
// in text colour between clownfish head and tail, (2) diagonal candy stripes across the lettering.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'J1', title: 'Buchstaben in Schriftfarbe (wie Beispiel 1)', desc: 'Kopf mit Band und Auge, „Nemo“ weiss bzw. dunkel ohne Streifen, Schwanzband und runde Schwanzflosse.', wm: { textLetters: true } },
    { ...base, label: 'J2', title: 'Orange mit schrägen Streifen (wie Beispiel 2)', desc: 'Buchstaben orange, weisse Streifen laufen schräg (62°) durch das Wort; Kopf und Schwanz wie J1.', wm: { diag: { w: 26, gap: 70, angle: 62 } } },
    { ...base, label: 'J3', title: 'Schräge Streifen, breiter (aus J2)', desc: 'Streifen 34 breit im Abstand 96: weniger, dafür deutlicher.', wm: { diag: { w: 34, gap: 96, angle: 62 } } },
    { ...base, label: 'J4', title: 'Nur Band im e (aus J1)', desc: 'Schriftfarbe wie J1, aber das e bekommt das orange-weisse Band als einzigen Fischakzent im Wort.', wm: { textLetters: true, midBand: 300 } },
  ],
};
