/* Weather scene palette (mockup, spec §7). The only file with hex values; later these become --scene-* tokens.
   sky.<key>: { light: [stops], dark: [stops], glow?, ink: [lightTheme, darkTheme] }. A stop = [offset 0..1, hex]. */
(function () {
  var same = function (stops) { return { light: stops, dark: stops }; };
  var sky = {
    night: same([[0, '#0b1330'], [1, '#24356a']]),
    'night-full': same([[0, '#101c44'], [1, '#34508c']]),
    'night-overcast': same([[0, '#171c2b'], [1, '#2c3446']]),
    'night-rain': same([[0, '#121722'], [1, '#252d3d']]),
    'night-snow': same([[0, '#1d2438'], [1, '#3a4560']]),
    'night-fog': same([[0, '#232a3a'], [1, '#3b4354']]),
    dawn: same([[0, '#27356a'], [0.55, '#4b4f86'], [1, '#7d6390']]), // bottom #8a6f9c → #7d6390 (contrast, measure.md)
    dusk: same([[0, '#1f2a5c'], [0.55, '#4a4580'], [1, '#985a6d']]), // bottom #a86478 → #985a6d
    golden: { light: [[0, '#a9c9e8'], [0.7, '#f6e3c3'], [1, '#f9c98f']], dark: [[0, '#22355a'], [0.6, '#5a4f6e'], [1, '#7a5c50']] }, // dark bottom #8a6a5a → #7a5c50
    day: { light: [[0, '#5aa7e6'], [1, '#cfe8f8']], dark: [[0, '#1c3a5c'], [1, '#2e5a86']] },
    overcast: { light: [[0, '#8fa1b3'], [1, '#c9d3dc']], dark: [[0, '#26303b'], [1, '#3d4a58']] },
    drizzle: { light: [[0, '#8496a8'], [1, '#bcc8d2']], dark: [[0, '#222b35'], [1, '#394653']] },
    rain: { light: [[0, '#3a495d'], [1, '#56687d']], dark: [[0, '#1a222c'], [1, '#33414f']] }, // light was #3f4f64 → #63768c
    storm: { light: [[0, '#2b3442'], [1, '#515d6e']], dark: [[0, '#171c24'], [1, '#2c3440']] },
    snow: { light: [[0, '#aebccb'], [1, '#e6edf3']], dark: [[0, '#2c3644'], [1, '#4a586a']] },
    fog: { light: [[0, '#b9c2c9'], [1, '#dfe4e8']], dark: [[0, '#2d343c'], [1, '#48515a']] },
    heat: { light: [[0, '#4f9fe6'], [1, '#f4e9c8']], dark: [[0, '#1f4468'], [1, '#5a5a52']] },
    dust: { light: [[0, '#c9b98f'], [1, '#ead9ae']], dark: [[0, '#4a442f'], [1, '#6a6046']] },
    'eclipse-sky': same([[0, '#141a36'], [1, '#3a3f6a']]),
  };
  // ink over the sky: 'L' = light ink, 'D' = dark ink; [light theme, dark theme]
  var inkOf = {
    golden: ['D', 'L'], day: ['D', 'L'], overcast: ['D', 'L'], drizzle: ['D', 'L'], snow: ['D', 'L'],
    fog: ['D', 'L'], heat: ['D', 'L'], dust: ['D', 'L'],
  };
  var glow = { dawn: '#f7b08a', dusk: '#f29a6b', golden: '#ffd9a0', 'eclipse-sky': '#e59a6a' };

  window.ScenePalette = {
    sky: sky,
    inkOf: inkOf,
    glow: glow,
    ink: { light: '#eceff1', dark: '#171f24' }, // coordinator 2026-11-24: the app's own inks (spec had #f3f5f8 / #1b1f24)
    surface: { light: '#f4f5f7', dark: '#1c1f24' }, // "Ruhig": greys mixed toward this
    c: {
      sun: '#ffd36a', 'sun-core': '#fff5c8', 'sun-low': '#ffb25e',
      moon: '#f1ecd8', 'moon-mare': '#d8d1b8', 'moon-dark': '#2a3660', star: '#ffffff',
      cloud: '#ffffff', 'cloud-shade': '#dfe8f1', 'cloud-rain': '#6f7d8e', 'cloud-rain-shade': '#5a6878', // were #7c8a9b / #647283
      'cloud-storm': '#4a5463', 'cloud-storm-shade': '#363f4c', 'cloud-night': '#33406a', 'cloud-night-shade': '#29345a',
      snow: '#eef3f8', 'snow-shade': '#cfdbe8', rime: '#e8f3fb', ice: '#cfeeff', rain: '#d6e4f2', fog: '#ffffff',
      bolt: '#ffe9a6', 'hail-edge': '#b8c6d6', 'heat-haze': '#fbe7b0', 'dust-sun': '#f6e7c0',
      'eclipse-disc': '#0b0f22', 'eclipse-red': '#c8694a', 'eclipse-red-dark': '#8f3d2e', 'eclipse-umbra': '#5a2a25',
      'rb-1': '#e8807a', 'rb-2': '#f2b56b', 'rb-3': '#f1dd7a', 'rb-4': '#8fcf9a', 'rb-5': '#7fb2e6',
      window: '#ffd98a', 'dry-meadow': '#8a8a4a', trunk: '#4a3b30', roof: '#8c4a3a', wall: '#e9e2d4',
      'dim-target': '#1b2340', // one step dimmer (solar partial > .6)
    },
    land: {
      spring: { base: '#3f7a58', crowns: ['#5f9a62', '#4f8c5a', '#6aa36a'] },
      summer: { base: '#2f6650', crowns: ['#3f7a52', '#356f4c', '#4a8558'] },
      autumn: { base: '#5b6a45', crowns: ['#c98a3c', '#b5562f', '#d9a441'] },
      winter: { base: '#47594f', crowns: ['#6f6a62', '#6f6a62', '#6f6a62'] },
      night: '#0c1430',
    },
  };
})();
