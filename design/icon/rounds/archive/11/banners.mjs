// Banner round 11. Feedback: fins like a real clownfish (rounded, dark edge, pale rim) placed around
// the word, white bands visible, a round tail fin. New wordmark concept "clown".
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'F1', title: 'Clownfisch: Rücken-, Bauch-, After- und runde Schwanzflosse', desc: 'Buchstaben sind der Körper; Kopfband und Band am Schwanzansatz, Flossen mit dunklem Rand und hellem Saum.', wm: {} },
    { ...base, label: 'F2', title: 'Dazu Brustflosse (aus F1)', desc: 'Kleine Brustflosse hinter dem Kopfband, liegt über dem N.', wm: { pectoral: true } },
    { ...base, label: 'F3', title: 'Drittes Band im Körper (aus F1)', desc: 'Das mittlere Band läuft als weisser Streifen durch das e, nur innerhalb der Buchstaben sichtbar.', wm: { midBand: 300 } },
    { ...base, label: 'F4', title: 'Nur Schwanz und Bänder (aus F1)', desc: 'Ohne Rücken-/Bauch-/Afterflosse: ruhiger, näher an W2.', wm: { fins: false } },
  ],
};
