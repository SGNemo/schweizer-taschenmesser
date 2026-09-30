// Round 2: refine direction C (emblem in a circle) + wordmarks where "Nemo" becomes the fish.
// Feedback round 1: "C gefällt mir gut als App-Icon (Handy, PC-Leiste)". New idea for the
// wordmark: the lettering itself is the logo, a fish starting at the N and ending with the fin.
const C = {
  body: { height: 112 },
  stripes: { at: [0.72, 0.36], width: 40, bend: [-16, -10], mode: 'cut' },
  eye: { style: 'cut', r: 17 },
  colors: { body: '#FFFFFF' },
  tilt: -14,
  soften: 10,
  plate: { shape: 'circle', fill: '#F26A1E', scale: 0.8, dx: 6 },
  adaptive: { scale: 0.62, bg: '#F26A1E' },
  mono: { style: 'negative' },
};
// C1 = C with a bigger, flatter fish; the transparent mark is orange (C's was white on white).
const C1 = {
  ...C,
  tilt: -8,
  plate: { ...C.plate, scale: 0.92, dx: 4 },
  adaptive: { scale: 0.68, bg: '#F26A1E' },
  mark: { colors: { body: '#F26A1E' } },
};

export default {
  title: 'C verfeinern + Wortmarken',
  subtitle: 'Basis: C aus Runde 1. C1 baut auf C auf, C2–C4 bauen auf C1 auf und ändern je genau eine Sache. Darunter vier Wortmarken-Ideen für README-Header und Sidebar.',
  variants: [
    { label: 'C', title: 'Basis aus Runde 1', desc: 'Unverändert zum Vergleich: orange Scheibe, weisser Fisch, zwei Bänder + Auge ausgestanzt, 14° geneigt, Fisch 80 %.', params: C },
    {
      label: 'C1',
      title: 'Grösser und ruhiger (aus C)',
      desc: 'Fisch 92 % statt 80 %, Neigung 8° statt 14°. Logo ohne Plättchen jetzt orange (in C unsichtbar auf Weiss).',
      params: C1,
    },
    {
      label: 'C2',
      title: 'Ein Band, grosses Auge (aus C1)',
      desc: 'Nur noch der Kopfstreifen, breiter (50), Auge r 23 statt 17: weniger Details für 16 px.',
      params: { ...C1, stripes: { ...C1.stripes, at: [0.64], width: 52, bend: -16 }, eye: { style: 'cut', r: 23, at: 0.85 } },
    },
    {
      label: 'C3',
      title: 'Dunkle Akzente (aus C1)',
      desc: 'Bänder orange mit dunkelblauem Rand, Auge dunkelblau statt ausgestanzt: mehr „Clownfisch“, etwas mehr Detail.',
      params: {
        ...C1,
        stripes: { ...C1.stripes, mode: 'white', edge: 7 },
        eye: { style: 'dot', r: 18 },
        colors: { body: '#FFFFFF', stripe: '#F26A1E', edge: '#0E2F45', eye: '#0E2F45' },
        mark: { colors: { body: '#F26A1E', stripe: '#FFFFFF' } },
      },
    },
    {
      label: 'C4',
      title: 'Kachel statt Kreis (aus C1)',
      desc: 'Abgerundetes Quadrat (rx 112) statt Scheibe: gleiche Fläche wie andere Taskleisten-Icons; Android maskiert ohnehin selbst.',
      params: { ...C1, plate: { ...C1.plate, shape: 'rounded', radius: 112 } },
    },
  ],
  wordmarks: [
    {
      label: 'W1',
      concept: 'body',
      title: 'Fischkörper (deine Idee wörtlich)',
      desc: 'Kopf mit Auge vor dem N, das Wort ist aus dem Körper ausgestanzt, Schwanzflosse nach dem o. Fisch schwimmt nach links.',
    },
    {
      label: 'W2',
      concept: 'headfin',
      title: 'Kopf und Flosse, Buchstaben sind der Körper',
      desc: 'Orange Buchstaben, davor ein Fischkopf mit Auge, danach die Flosse; die Lücken wirken wie die weissen Bänder.',
    },
    {
      label: 'W3',
      concept: 'ofish',
      title: 'Das o ist der Fisch',
      desc: '„Nem“ in Schriftfarbe, das o ist ein runder Clownfisch mit Band und Auge, die Flosse beendet das Wort.',
    },
    {
      label: 'W4',
      concept: 'swoosh',
      title: 'Fisch als Unterstrich',
      desc: 'Wort bleibt sauber; ein schlanker Fisch beginnt mit Kopf und Auge unter dem N und endet mit der Flosse hinter dem o.',
    },
  ],
};
