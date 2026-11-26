/* Weather scene palette v2 (mockup). The only file with hex values; in the product these are --scene-* tokens.
   Skies are round 1's (contrast-tested there); new in v2: `deck` (cloud sheets per sky), `light` (how a sky lights the
   land), `land` with one tone per depth layer, and the things of the foreground.
   sky.<key>: { light: [stops], dark: [stops] }, a stop = [offset 0..1, hex]. */
(function () {
  var same = function (stops) { return { light: stops, dark: stops }; };
  var sky = {
    night: same([[0, '#0b1330'], [1, '#24356a']]),
    'night-full': same([[0, '#101c44'], [1, '#34508c']]),
    'night-overcast': same([[0, '#222a3d'], [1, '#414c68']]), // v2: the sky *under* the deck (was #171c2b → #2c3446)
    'night-rain': same([[0, '#1a2130'], [1, '#353f52']]),
    'night-snow': same([[0, '#262e44'], [1, '#49556f']]),
    'night-fog': same([[0, '#232a3a'], [1, '#3b4354']]),
    dawn: same([[0, '#27356a'], [0.55, '#4b4f86'], [1, '#7d6390']]),
    dusk: same([[0, '#1f2a5c'], [0.55, '#4a4580'], [1, '#985a6d']]),
    golden: { light: [[0, '#a9c9e8'], [0.7, '#f6e3c3'], [1, '#f9c98f']], dark: [[0, '#22355a'], [0.6, '#5a4f6e'], [1, '#7a5c50']] },
    day: { light: [[0, '#4696dd'], [1, '#dcf0fc']], dark: [[0, '#1c3a5c'], [1, '#2e5a86']] },
    overcast: { light: [[0, '#8fa1b3'], [1, '#c9d3dc']], dark: [[0, '#26303b'], [1, '#3d4a58']] },
    drizzle: { light: [[0, '#8496a8'], [1, '#bcc8d2']], dark: [[0, '#222b35'], [1, '#394653']] },
    rain: { light: [[0, '#3a495d'], [1, '#63768c']], dark: [[0, '#1a222c'], [1, '#33414f']] },
    storm: { light: [[0, '#232b38'], [1, '#6a7686']], dark: [[0, '#171c24'], [1, '#3a4452']] },
    snow: { light: [[0, '#aebccb'], [1, '#e6edf3']], dark: [[0, '#2c3644'], [1, '#4a586a']] },
    fog: { light: [[0, '#b9c2c9'], [1, '#dfe4e8']], dark: [[0, '#2d343c'], [1, '#48515a']] },
    heat: { light: [[0, '#4f9fe6'], [1, '#f4e9c8']], dark: [[0, '#1f4468'], [1, '#5a5a52']] },
    dust: { light: [[0, '#c9b98f'], [1, '#ead9ae']], dark: [[0, '#4a442f'], [1, '#6a6046']] },
    'eclipse-sky': same([[0, '#141a36'], [1, '#3a3f6a']]),
  };
  // dark ink over these skies in the light theme; everything else (and every sky in the dark theme) takes light ink
  var darkInk = { golden: 1, day: 1, overcast: 1, drizzle: 1, snow: 1, fog: 1, heat: 1, dust: 1 };
  var glow = { dawn: '#f7b08a', dusk: '#f29a6b', golden: '#ffd9a0', 'eclipse-sky': '#e59a6a' };
  /* cloud sheets of an overcast sky: [lowest roll, middle, upper, top, lit rim of the hole]; per sky, light / dark theme */
  var deck = {
    night: ['#1d2434', '#2a3247', '#3a445c', '#434e68', '#a4b1cf'],
    'night-wet': ['#171d2a', '#222a3a', '#2f384b', '#384256', '#8e9bb8'],
    day: { light: ['#8a97a6', '#9ba7b5', '#afb9c5', '#bfc8d2', '#f6f9fc'], dark: ['#2a343f', '#34404c', '#404d5b', '#4a5867', '#aebccb'] },
    wet: { light: ['#56636f', '#647280', '#74828f', '#808e9b', '#d3dce4'], dark: ['#1f2730', '#29333e', '#34404c', '#3d4a57', '#9aa8b6'] },
    storm: { light: ['#262d39', '#363f4d', '#4a5565', '#566172', '#8793a3'], dark: ['#161b23', '#222933', '#2f3844', '#39434f', '#737f8f'] },
    snow: { light: ['#a3b0be', '#b3bfcb', '#c5cfd9', '#d2dae3', '#ffffff'], dark: ['#2f3946', '#3a4553', '#465362', '#505e6e', '#b9c6d3'] },
    twilight: ['#2c3050', '#3a3d62', '#4a4a74', '#565480', '#e2b7a8'],
  };
  /* how a sky lights the land: mix every land tone toward `to` by `k`, after greying it by `grey` */
  var light = {
    day: { to: '#ffffff', k: 0, grey: 0 }, heat: { to: '#f4e9c8', k: 0.12, grey: 0 }, golden: { to: '#f2b877', k: 0.16, grey: 0 },
    overcast: { to: '#566270', k: 0.2, grey: 0.3 }, drizzle: { to: '#4e5a68', k: 0.26, grey: 0.32 }, rain: { to: '#2a3441', k: 0.4, grey: 0.35 },
    storm: { to: '#151c22', k: 0.42, grey: 0.25 }, snow: { to: '#8e9cab', k: 0.22, grey: 0.35 }, fog: { to: '#aeb7be', k: 0.34, grey: 0.45 },
    dust: { to: '#b7a67c', k: 0.3, grey: 0.2 }, dawn: { to: '#232c5a', k: 0.56, grey: 0.1 }, dusk: { to: '#2a2a58', k: 0.56, grey: 0.1 },
    night: { to: '#0a1022', k: 0.76, grey: 0.2 }, 'night-full': { to: '#101a3a', k: 0.64, grey: 0.15 }, 'eclipse-sky': { to: '#141a36', k: 0.6, grey: 0.2 },
    darkTheme: { to: '#0c1430', k: 0.42 }, // day skies in the dark theme: one more step toward night
  };
  /* land by season: rock (far massif), mid (second range), f1 / f2 (forest staffels), near (foreground trees), meadow, dark (shade) */
  var land = {
    spring: { rock: '#8f9caa', mid: '#6d8f7c', f1: '#447358', f2: '#33614a', near: '#234a39', meadow: '#6aa85f', dark: '#11261e', crowns: ['#7fb867', '#6aa85f', '#93c476'] },
    summer: { rock: '#8b98a8', mid: '#5f8474', f1: '#3b6a53', f2: '#2c5744', near: '#1e4234', meadow: '#4f8f56', dark: '#10241c', crowns: ['#4f9a58', '#438a50', '#5fa864'] },
    autumn: { rock: '#8d97a3', mid: '#74806a', f1: '#4a6650', f2: '#385543', near: '#263f33', meadow: '#8a8f55', dark: '#15241c', crowns: ['#d08a3a', '#b9562f', '#dba640'] },
    winter: { rock: '#8f9db0', mid: '#6f8290', f1: '#4d6a72', f2: '#3a5a60', near: '#274846', meadow: '#7d8468', dark: '#16302f', crowns: [] },
  };
  window.ScenePalette = {
    sky: sky, darkInk: darkInk, glow: glow, deck: deck, light: light, land: land,
    ink: { light: '#eceff1', dark: '#171f24' },
    c: {
      sun: '#ffd36a', 'sun-core': '#fff6cf', 'sun-low': '#ffb25e', 'sun-pale': '#f3ead0',
      moon: '#f1ecd8', 'moon-mare': '#d6cfb6', 'moon-dark': '#27335c', star: '#ffffff',
      cloud: '#ffffff', 'cloud-shade': '#d6e2ee', 'cloud-night': '#3a466e', 'cloud-night-shade': '#2a3458', 'cloud-grey': '#aab5c1', 'cloud-grey-shade': '#8f9ba8',
      snow: '#f7fbfe', 'snow-shade': '#bfd3e9', rime: '#dbe8f5', ice: '#c2e0f1', 'ice-hi': '#f0f9fe',
      rain: '#d6e3f0', fog: '#ffffff', bolt: '#ffe9a6', 'bolt-core': '#fffbe6', hail: '#f2f6fa', 'hail-edge': '#b8c6d6',
      'heat-haze': '#fbe7b0', 'dry-meadow': '#a39a55', leaf: '#c98a3c', 'leaf-green': '#8fa66a', flower: '#f3e9a8',
      wall: '#8b5e48', roof: '#5a3b2f', window: '#ffd98a', smoke: '#e3e8ee', 'smoke-dark': '#5a6580', flag: '#c9584a', wood: '#3a2e28',
      'water-deep': '#2d5d86',
    },
  };
})();
