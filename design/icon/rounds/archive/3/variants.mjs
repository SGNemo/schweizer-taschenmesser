// Round 3. Feedback round 2: "C4 ist moderner, den Fisch aber mehr Richtung Kante oben rechts
// neigen." Banner: "W2 gefällt sehr gut, das Nemo mehr wie Gräten aussehen lassen." Plus a
// sketch: handwriting (fountain pen) in the direction of W3, the word flowing into the fish.
const C = {
  body: { height: 112 },
  stripes: { at: [0.72, 0.36], width: 40, bend: [-16, -10], mode: 'cut' },
  eye: { style: 'cut', r: 17 },
  colors: { body: '#FFFFFF' },
  soften: 10,
  mono: { style: 'negative' },
  mark: { colors: { body: '#F26A1E' } },
};
// C4 from round 2 (C1 on a rounded tile).
const C4 = { ...C, tilt: -8, plate: { shape: 'rounded', radius: 112, fill: '#F26A1E', scale: 0.92, dx: 4 }, adaptive: { scale: 0.68, bg: '#F26A1E' } };
const tilted = (deg, scale, adaptive = 0.68) => ({ ...C4, tilt: deg, plate: { ...C4.plate, scale, dx: 0, dy: 6 }, adaptive: { ...C4.adaptive, scale: adaptive, dy: 4 } });
const BONE = { light: '#B3A994', dark: '#EDE6D6' };

export default {
  title: 'C4 geneigt, Gräten, Schreibschrift',
  subtitle: 'Icons: Basis C4, C5–C7 ändern nur Neigung (und bei C6/C7 die Grösse). Wortmarken: Basis W2 → G1–G3 (Gräten), Basis W3 + Skizze → S1–S3 (Füller).',
  variants: [
    { label: 'C4', title: 'Basis aus Runde 2', desc: 'Orange Kachel, weisser Fisch 92 %, 8° geneigt.', params: C4 },
    { label: 'C5', title: '25° nach oben rechts (aus C4)', desc: 'Nur die Neigung: 25° statt 8°.', params: tilted(-25, 0.92) },
    { label: 'C6', title: '35°, etwas grösser (aus C4)', desc: 'Neigung 35°, Fisch 96 % (die Diagonale gibt mehr Platz).', params: tilted(-35, 0.96) },
    { label: 'C7', title: '45°, genau in die Ecke (aus C4)', desc: 'Neigung 45° (Kopf zeigt in die Ecke oben rechts), Fisch 100 %.', params: tilted(-45, 1.0, 0.7) },
  ],
  wordmarks: [
    { label: 'W2', concept: 'headfin', title: 'Basis aus Runde 2', desc: 'Orange Nunito-Buchstaben zwischen Fischkopf und Flosse.' },
    {
      label: 'G1',
      concept: 'bones',
      title: 'Gräten (aus W2)',
      desc: 'Buchstaben als dünne Linien auf einer Wirbelsäule (Grundlinie), Rippen hängen darunter; alles orange.',
    },
    {
      label: 'G2',
      concept: 'bones',
      title: 'Gräten in Knochenfarbe (aus G1)',
      desc: 'Nur die Farbe: Gräten elfenbein (dunkel) bzw. warmgrau (hell), Kopf und Flosse bleiben orange.',
      params: { bone: BONE },
    },
    {
      label: 'G3',
      concept: 'bones',
      title: 'Mehr Skelett (aus G2)',
      desc: 'Zusätzliche kurze Rippen nach oben in den Lücken zwischen den Buchstaben.',
      params: { bone: BONE, ribsAbove: true },
    },
    { label: 'W3', concept: 'ofish', title: 'Basis aus Runde 2', desc: '„Nem“ gesetzt, das o ist ein runder Clownfisch.' },
    {
      label: 'S1',
      concept: 'script',
      title: 'Füller-Schreibschrift nach deiner Skizze (aus W3)',
      desc: 'Anschwung, N, e, m in einer Breitfeder-Linie, das m läuft in den Fischumriss (Rückenflosse, Schwanz am Ende).',
    },
    {
      label: 'S2',
      concept: 'script',
      title: 'Fisch gefüllt (aus S1)',
      desc: 'Nur der Fisch: orange gefüllt mit weissem Band, Linie bleibt Tinte.',
      params: { fill: true },
    },
    {
      label: 'S3',
      concept: 'script',
      title: 'Orange Tinte (aus S1)',
      desc: 'Nur die Tintenfarbe: alles in Markenorange, Fisch als Umriss.',
      params: { ink: { light: '#E0601A', dark: '#F26A1E' } },
    },
  ],
};
