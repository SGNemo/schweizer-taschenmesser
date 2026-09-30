// Round 1: current icon + four clearly different directions.
// Params are overrides of DEFAULTS in ../../fish.mjs.
const OCEAN = { from: '#1D6B7A', to: '#0E2F45' };

export default {
  title: 'Ausgangslage und vier Richtungen',
  subtitle: 'Ist = aktuelles Icon aus web/brand. A–D sind eigene, generische Clownfisch-Zeichnungen aus dem parametrischen Master (fish.mjs).',
  variants: [
    {
      label: 'Ist',
      title: 'Aktuelles Icon „Welle“',
      desc: 'Eine orange Fläche, zwei Streifen und Auge ausgestanzt (zeigen das Plättchen), Meeres-Verlauf, Fisch 74 % der Kachel.',
      files: {
        full: 'web/brand/app-icon.svg',
        mark: 'web/brand/logo-mark.svg',
        mono: 'web/brand/logo-mono.svg',
        adFg: 'web/brand/android-foreground.svg',
        adBg: '#164D60',
        adMono: 'web/brand/android-monochrome.svg',
      },
    },
    {
      label: 'A',
      title: 'Kopf-Nahaufnahme',
      desc: 'Vorderkörper gross angeschnitten (Kopf, zwei Bänder, grosses Auge), leicht nach oben geneigt; helles Lagunen-Plättchen statt dunklem Meer.',
      params: {
        stripes: { at: [0.7, 0.3], width: [46, 46], bend: [-18, -12], edge: 9 },
        eye: { at: 0.86, dy: -0.18, r: 21 },
        tilt: -6,
        plate: { shape: 'rounded', radius: 112, fill: { from: '#A8E0E6', to: '#5DB7C6' }, scale: 1.7, dx: -124, dy: 12, clip: true },
        adaptive: { scale: 1.3, dx: -100, dy: 8 },
        mark: { scale: 1 },
        mono: { style: 'negative' },
      },
    },
    {
      label: 'B',
      title: 'Ganzer Fisch, klassisch',
      desc: 'Seitenansicht mit Rückenflosse, drei weiße Bänder mit dunklem Rand, Umriss, Fächerschwanz; Meeres-Plättchen wie bisher.',
      params: {
        dorsal: { height: 30, from: 0.22, to: 0.68 },
        stripes: { at: [0.76, 0.42, 0.1], width: [36, 38, 26], bend: [-14, -10, 0], edge: 7 },
        outline: 7,
        soften: 6,
        eye: { r: 15 },
        plate: { shape: 'rounded', radius: 112, fill: OCEAN, scale: 0.8 },
        adaptive: { scale: 0.64 },
      },
    },
    {
      label: 'C',
      title: 'Emblem im Kreis',
      desc: 'Orange Scheibe, Fisch als weiße Silhouette, Streifen und Auge ausgestanzt (orange), schräg nach oben; einfarbig = Scheibe mit Fisch-Loch.',
      params: {
        body: { height: 112 },
        stripes: { at: [0.72, 0.36], width: 40, bend: [-16, -10], mode: 'cut' },
        eye: { style: 'cut', r: 17 },
        colors: { body: '#FFFFFF' },
        tilt: -14,
        soften: 10,
        plate: { shape: 'circle', fill: '#F26A1E', scale: 0.8, dx: 6 },
        adaptive: { scale: 0.62, bg: '#F26A1E' },
        mono: { style: 'negative' },
      },
    },
    {
      label: 'D',
      title: 'Geometrisch reduziert, ohne Plättchen',
      desc: 'Ellipse + Dreieck + zwei gerade Bänder, dunkler Umriss, frei stehend (transparent); adaptiv auf hellem Sand-Hintergrund.',
      params: {
        body: { height: 132, peak: 0.5, blunt: 0.55, stalk: 30 },
        tail: { style: 'triangle', length: 104, spread: 104, overlap: 30 },
        stripes: { at: [0.7, 0.32], width: 46, bend: 0, edge: 10 },
        outline: 13,
        soften: 14,
        eye: { at: 0.84, dy: -0.2, r: 19 },
        colors: { edge: '#0E2F45', eye: '#0E2F45' },
        plate: { shape: 'none', scale: 1.04 },
        adaptive: { scale: 0.62, bg: '#FBF8F3' },
        mono: { scale: 1.04 },
      },
    },
  ],
};
