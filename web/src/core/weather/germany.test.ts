import { describe, expect, it } from 'vitest';
import { inGermany } from './germany';

/** Towns on both sides of the border (handoff/03b test 1), plus islands and lake towns. */
const IN = {
  Aachen: [50.776, 6.084],
  Flensburg: [54.784, 9.436],
  Görlitz: [51.153, 14.988],
  Konstanz: [47.663, 9.175],
  Passau: [48.574, 13.465],
  Lindau: [47.546, 9.684],
  'Weil am Rhein': [47.594, 7.62],
  Oberstdorf: [47.41, 10.28],
  'Sylt (Westerland)': [54.91, 8.31],
  'Rügen (Bergen)': [54.42, 13.43],
  Berlin: [52.52, 13.4],
} as const;
const OUT = {
  Zürich: [47.377, 8.541],
  Basel: [47.559, 7.588],
  Salzburg: [47.81, 13.055],
  Innsbruck: [47.269, 11.404],
  Prague: [50.075, 14.438],
  Strasbourg: [48.573, 7.752],
  Luxembourg: [49.611, 6.13],
  Szczecin: [53.428, 14.553],
  Kreuzlingen: [47.65, 9.17],
  Bregenz: [47.503, 9.747],
  Schaffhausen: [47.696, 8.635],
  Singapore: [1.35, 103.82],
} as const;

describe('inGermany (simplified VG250 outline)', () => {
  it.each(Object.entries(IN))('%s is in', (_, [lat, lon]) =>
    expect(inGermany(lat, lon)).toBe(true),
  );
  it.each(Object.entries(OUT))('%s is out', (_, [lat, lon]) =>
    expect(inGermany(lat, lon)).toBe(false),
  );
});
