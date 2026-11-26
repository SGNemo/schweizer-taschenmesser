/* Weather scene v2, direction B "Facetten" (mockup; the product ports it shape by shape into ui/weather-scene/draw.ts).
   window.Scene = { svg(state, opts), state(partial), ink(state), skyKey(state), count(svg), G, presets }.
   One SVG, viewBox 0 0 1600 320, xMaxYMax slice: a wide head shows all of it, a phone the right ~740 units.
   Every layer is a <g data-layer="…"> named as in round 1, so the port can go layer by layer:
   sky · stars · body · cloudsFar (veil) · clouds (deck, cumulus, storm) · ridgeAlp (far massif) · ridgeFar (second range) ·
   fog · ridgeMid (forest staffels) · water · ridgeNear (ground, way, hut, smoke, fence, flag, trees) · event (bolts) ·
   precip · wind.  Colours only from palette.js. Randomness only from prng(seed): the same state is the same picture.
   opts: { view: [x, y, w, h] (phone crop), bodyAt: [x, y], quietX (right edge of the text column in scene units), idp }.
   Events (rainbow, meteors, eclipses, aurora, star night, dust) live in events.js and hook in through Scene.hooks. */
(function () {
  var PAL = window.ScenePalette, W = 1600, H = 320, uid = 0; // uid: ids stay unique when several scenes share a page
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function f(n) { return Math.round(n * 10) / 10; }
  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function greyOf(h) { var c = rgb(h), g = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return hex([g, g, g]); }
  function el(tag, o, inner) {
    var s = '<' + tag;
    for (var k in o) if (o[k] != null && o[k] !== '') s += ' ' + k + '="' + o[k] + '"';
    return s + (inner == null ? '/>' : '>' + inner + '</' + tag + '>');
  }
  function pts(a, close) { return 'M' + a.map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join('L') + (close ? 'Z' : ''); }
  function yAt(line, x) {
    for (var i = 1; i < line.length; i++) if (x <= line[i][0]) { var a = line[i - 1], b = line[i]; return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1); }
    return line[line.length - 1][1];
  }
  function jag(line, seed, amp, step) {
    var r = prng(seed), out = [line[0]];
    for (var i = 1; i < line.length; i++) {
      var a = line[i - 1], b = line[i], d = b[0] - a[0], n = Math.max(1, Math.round(d / step));
      for (var j = 1; j < n; j++) { var t = j / n + ((r() - 0.5) * 0.3) / n; out.push([a[0] + d * t, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * 2 * amp]); }
      out.push(b);
    }
    return out;
  }
  function circ(x, y, r) { return 'M' + f(x - r) + ',' + f(y) + 'a' + f(r) + ',' + f(r) + ' 0 1,1 ' + f(2 * r) + ',0a' + f(r) + ',' + f(r) + ' 0 1,1 ' + f(-2 * r) + ',0Z'; }
  function rrect(x, y, w, h, r) { return 'M' + f(x + r) + ',' + f(y) + 'h' + f(w - 2 * r) + 'a' + f(r) + ',' + f(r) + ' 0 0,1 0,' + f(h) + 'h' + f(-(w - 2 * r)) + 'a' + f(r) + ',' + f(r) + ' 0 0,1 0,' + f(-h) + 'Z'; }
  function ell(cx, cy, rx, ry) { return 'M' + f(cx - rx) + ',' + f(cy) + 'a' + f(rx) + ',' + f(ry) + ' 0 1,1 ' + f(2 * rx) + ',0a' + f(rx) + ',' + f(ry) + ' 0 1,1 ' + f(-2 * rx) + ',0Z'; }
  function smooth(p, closeTo) { // a round line through the midpoints of the key points
    var d = 'M' + f(p[0][0]) + ',' + f(p[0][1]);
    for (var i = 1; i < p.length - 1; i++) d += 'Q' + f(p[i][0]) + ',' + f(p[i][1]) + ' ' + f((p[i][0] + p[i + 1][0]) / 2) + ',' + f((p[i][1] + p[i + 1][1]) / 2);
    d += 'L' + f(p[p.length - 1][0]) + ',' + f(p[p.length - 1][1]);
    return closeTo == null ? d : d + 'L' + f(p[p.length - 1][0]) + ',' + closeTo + 'L' + f(p[0][0]) + ',' + closeTo + 'Z';
  }
  function ribbon(p, w0, w1) { // a tapering band along a line (bolts)
    var L = [], R = [], n = p.length - 1;
    for (var i = 0; i <= n; i++) {
      var a = p[Math.max(0, i - 1)], b = p[Math.min(n, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = (w0 + ((w1 - w0) * i) / n) / 2;
      L.push([p[i][0] - (dy / l) * w, p[i][1] + (dx / l) * w]); R.unshift([p[i][0] + (dy / l) * w, p[i][1] - (dx / l) * w]);
    }
    return pts(L.concat(R), true);
  }
  function blob(cx, cy, r, seed, n, kx, ky) {
    var q = prng(seed), p = [], i;
    n = n || 12; kx = kx || 1.12; ky = ky || 0.94;
    for (i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2, rr = r * (0.84 + 0.3 * q()); p.push([cx + Math.cos(a) * rr * kx, cy + Math.sin(a) * rr * ky]); }
    var m = function (u, v) { return [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2]; }, s = m(p[n - 1], p[0]), d = 'M' + f(s[0]) + ',' + f(s[1]);
    for (i = 0; i < n; i++) { var e = m(p[i], p[(i + 1) % n]); d += 'Q' + f(p[i][0]) + ',' + f(p[i][1]) + ' ' + f(e[0]) + ',' + f(e[1]); }
    return d + 'Z';
  }

  /* ============================== geometry ============================== */
  var G = {
    W: W, H: H,
    // the pale range far behind (whole width; under the text it is the only range)
    back: [[0, 206], [110, 194], [200, 201], [320, 182], [420, 195], [550, 174], [660, 191], [780, 166], [870, 183], [950, 168], [1040, 186], [1140, 170], [1240, 190], [1330, 174], [1440, 188], [1540, 170], [1600, 182]],
    backPeaks: [[320, 182, 0.3], [550, 174, 0.4], [780, 166, 0.45], [1140, 170, 0.35], [1330, 174, 0.3]],
    // the massif: five mountains, each its own shape, drawn back to front. sil: left foot → right foot; top: index of the summit;
    // arete: the zig-zag edge from the summit to the foot that parts the lit face from the shaded one; spurs: buttresses [sil index, foot x]
    mountains: [
      { id: 'outlier', size: 0.5, top: 4, haze: 0.3, sil: [[836, 218], [872, 190], [900, 178], [924, 160], [948, 148], [962, 158], [984, 166], [1010, 192], [1030, 218]],
        arete: [[948, 148], [944, 164], [951, 180], [942, 198], [947, 218]], ribs: [[2, 884, 22], [6, 996, 20]], gullies: [], fields: [] },
      { id: 'main', size: 1.25, top: 6, haze: 0.14, sil: [[1206, 218], [1240, 180], [1262, 162], [1286, 152], [1310, 114], [1330, 104], [1352, 76], [1366, 89], [1384, 93], [1404, 87], [1422, 112], [1452, 134], [1482, 170], [1516, 218]],
        arete: [[1352, 76], [1347, 98], [1356, 116], [1344, 138], [1354, 160], [1340, 186], [1348, 218]], ribs: [[2, 1250, 26], [4, 1292, 34], [8, 1392, 30], [10, 1440, 36]],
        gullies: [[1338, 100, 16], [1370, 96, 20], [1408, 96, 14], [1322, 118, 18]], fields: ['M1322,130l14,-6l10,8l-6,12l-14,4Z', 'M1372,114l12,-4l8,10l-10,10Z', 'M1300,152l12,-4l6,8l-12,8Z', 'M1418,128l10,-2l6,10l-10,6Z'] },
      { id: 'edge', size: 0.6, top: 2, haze: 0, sil: [[1516, 218], [1546, 160], [1574, 131], [1600, 146], [1600, 218]], arete: [[1574, 131], [1570, 152], [1578, 172], [1568, 196], [1574, 218]], ribs: [[1, 1548, 20]], gullies: [[1570, 144, 10]], fields: [] },
      { id: 'shoulder', size: 0.6, top: 4, haze: 0, sil: [[956, 218], [998, 178], [1022, 171], [1046, 142], [1074, 128], [1090, 139], [1114, 152], [1150, 192], [1176, 218]],
        arete: [[1074, 128], [1070, 148], [1078, 166], [1068, 188], [1074, 218]], ribs: [[2, 1012, 24], [6, 1122, 24]], gullies: [[1066, 140, 10], [1084, 142, 9]], fields: ['M1056,150l8,-4l6,8l-8,6Z'] },
      { id: 'west', size: 0.95, top: 4, haze: 0, sil: [[1038, 218], [1082, 162], [1104, 147], [1128, 113], [1150, 98], [1162, 109], [1178, 105], [1196, 127], [1224, 152], [1262, 192], [1292, 218]],
        arete: [[1150, 98], [1146, 118], [1154, 134], [1143, 156], [1151, 176], [1140, 198], [1146, 218]], ribs: [[2, 1088, 28], [6, 1188, 26], [8, 1238, 30]],
        gullies: [[1136, 116, 14], [1168, 114, 12], [1122, 130, 12]], fields: ['M1128,134l10,-6l8,10l-12,8Z', 'M1170,130l8,-2l6,10l-10,4Z', 'M1206,150l10,-3l5,8l-11,5Z'] },
      { id: 'east', size: 0.8, top: 3, haze: 0, sil: [[1398, 218], [1440, 162], [1462, 147], [1490, 112], [1506, 123], [1524, 141], [1548, 151], [1580, 192], [1600, 208], [1600, 218]],
        arete: [[1490, 112], [1486, 132], [1494, 150], [1484, 172], [1491, 194], [1485, 218]], ribs: [[1, 1434, 24], [5, 1532, 28], [6, 1564, 24]],
        gullies: [[1480, 128, 12], [1500, 128, 10]], fields: ['M1472,138l8,-4l6,8l-8,8Z', 'M1508,144l10,-2l4,10l-10,4Z'] },
    ],
    // round wooded hills in front of the massif, and the clearings on them
    hills: [[-20, 236], [130, 222], [250, 232], [390, 214], [520, 228], [650, 212], [790, 224], [900, 206], [990, 218], [1060, 196], [1120, 206], [1190, 188], [1262, 208], [1330, 198], [1400, 212], [1466, 184], [1530, 198], [1620, 180]],
    clearings: ['M1040,212q16,-10 34,-6q-8,10 -34,6Z', 'M1176,202q18,-9 40,-3q-14,9 -40,3Z', 'M1450,200q20,-12 44,-8q-12,12 -44,8Z', 'M640,222q16,-8 34,-4q-10,8 -34,4Z'],
    f1: [[0, 244], [400, 238], [800, 241], [1100, 235], [1400, 231], [1600, 227]],
    f2: [[0, 264], [400, 259], [800, 263], [985, 258]],
    backShore: 'M930,270C1000,252 1100,249 1200,251C1290,252 1352,256 1410,264L1410,300L930,300Z', // the meadow behind the lake
    lake: 'M1002,281C1004,270 1052,263 1110,262C1150,261 1168,266 1196,264C1250,260 1318,264 1336,274C1348,282 1330,292 1290,297C1240,303 1180,300 1130,303C1070,306 1000,298 1002,281Z',
    lakeBox: [1002, 1340, 262, 304],
    ground: [[-20, 292], [160, 286], [330, 291], [520, 289], [700, 287], [860, 293], [990, 297], [1080, 306], [1160, 307], [1310, 304], [1344, 293], [1372, 280], [1410, 269], [1458, 265], [1560, 263], [1620, 258]],
    way: 'M1424,267C1408,278 1436,288 1416,298C1402,306 1414,314 1408,320L1438,320C1442,312 1428,307 1440,297C1456,286 1424,279 1436,267Z',
    arc: { x0: 1010, x1: 1550, yLow: 150, rise: 96 }, // the body's way: t 0..1 → x, y = yLow − rise·sin(πt)
    phoneBodyX: 1438,
    cabin: [1404, 266, 1.15], shed: [1350, 280, 0.62], farHouses: [[1086, 256], [1110, 258], [1232, 254], [1250, 256]], flag: 1530, jetty: [1318, 289], boat: [1264, 288],
    // trees: [kind, x, base y, height or crown radius]; kinds: spruce, fir, pine, birch, leaf, bush
    behind: [['spruce', 1396, 264, 62], ['spruce', 1484, 260, 76], ['fir', 1502, 262, 40]], // behind the cabin
    trees: [['spruce', 1562, 268, 118], ['spruce', 1592, 262, 84], ['pine', 1512, 268, 70], ['birch', 1546, 272, 46], ['bush', 1578, 274, 7], ['leaf', 1324, 298, 15], ['birch', 1372, 284, 40],
      ['spruce', 958, 296, 64], ['fir', 930, 293, 44], ['pine', 984, 298, 50], ['leaf', 890, 291, 13], ['bush', 1004, 300, 6], ['bush', 906, 296, 5],
      ['spruce', 842, 293, 40], ['leaf', 812, 294, 10], ['birch', 1014, 303, 34], ['spruce', 1446, 300, 30], ['fir', 1470, 304, 22], ['leaf', 1610, 296, 14],
      ['fir', 640, 290, 30], ['fir', 300, 288, 26], ['leaf', 470, 291, 9], ['fir', 760, 291, 22], ['fir', 1182, 258, 14], ['fir', 1194, 259, 11], ['fir', 1150, 257, 12]],
    // four bolts, each its own figure: the long strike, the crawler under the base, the forked one, the far one
    bolts: [
      { w: 4.4, op: 1, p: [[1218, 118], [1213, 131], [1220, 139], [1209, 152], [1214, 160], [1203, 171], [1207, 181], [1194, 196], [1198, 205], [1187, 219], [1190, 226], [1178, 240]],
        forks: [[[1209, 152], [1222, 160], [1228, 172], [1240, 178], [1244, 190]], [[1194, 196], [1182, 202], [1176, 212], [1166, 216]]] },
      { w: 3.2, op: 0.95, p: [[1470, 120], [1466, 134], [1473, 142], [1465, 156], [1469, 166], [1458, 176], [1460, 186], [1450, 198], [1452, 208]], forks: [[[1469, 166], [1480, 174], [1478, 184], [1488, 192]]] },
      { w: 2.6, op: 0.9, p: [[1300, 122], [1318, 116], [1332, 124], [1352, 118], [1368, 127], [1390, 121], [1404, 131], [1426, 126]], forks: [[[1368, 127], [1372, 140], [1366, 148], [1371, 160]], [[1332, 124], [1328, 134], [1334, 141]]] },
      { w: 1.9, op: 0.55, p: [[1042, 116], [1038, 128], [1044, 136], [1035, 150], [1039, 158], [1030, 172], [1033, 180], [1026, 196]], forks: [[[1035, 150], [1028, 156], [1026, 164]]] },
    ],
    // cloud shapes (lobes [cx, cy, r], base from x0 to x1) and where they stand: [x, base y, scale, shape]
    cloudShapes: [
      { l: [[-18, -8, 13], [0, -16, 17], [20, -9, 13]], b: [-30, 32] },
      { l: [[-52, -7, 12], [-30, -15, 17], [-4, -21, 22], [24, -14, 18], [48, -8, 13]], b: [-64, 60] },
      { l: [[-26, -9, 15], [-6, -24, 20], [10, -40, 16], [26, -20, 19], [44, -8, 12]], b: [-40, 56] },
      { l: [[-40, -10, 15], [-18, -20, 19], [8, -10, 14], [30, -22, 20], [52, -9, 13]], b: [-54, 64] },
      { l: [[-14, -5, 8], [2, -9, 10], [18, -5, 8]], b: [-22, 26] },
    ],
    cumulus: [[1430, 78, 1.05, 1], [1090, 98, 0.8, 0], [1300, 52, 1.15, 2], [1180, 72, 0.9, 4], [1520, 46, 0.9, 3], [1010, 60, 1, 1], [1390, 30, 1.2, 3], [1240, 34, 1.1, 2], [1565, 96, 0.75, 0]], // cover 1 takes 2, 2 takes 4, 3 all
    // the cloud banks the body looks out between (overcast): at = offset from the body, l = lobes [x, y, r], base = flat underside [x, y, rx, ry]. Each its own shape
    banks: [
      { at: [-150, 26], l: [[-50, 2, 20], [-20, -12, 26], [12, -8, 22], [40, 4, 18], [-78, 8, 14]], base: [-18, 12, 76, 13] },
      { at: [-120, -30], l: [[-50, 0, 14], [-24, -8, 18], [4, -10, 20], [32, -4, 16], [56, 2, 12]], base: [2, 6, 64, 9] },
      { at: [128, 20], l: [[-34, 0, 16], [-8, -10, 22], [20, -4, 18], [44, 6, 14]], base: [6, 9, 56, 10] },
      { at: [108, -34], l: [[-40, 2, 14], [-14, -8, 20], [14, -6, 18], [40, 2, 14]], base: [0, 7, 52, 9] },
      { at: [-62, 40], l: [[-70, 6, 20], [-44, -8, 26], [-14, -14, 24], [14, -4, 20], [40, 6, 16], [-96, 12, 14]], base: [-30, 16, 86, 14] },
      { at: [38, 48], l: [[-36, -2, 18], [-10, -16, 24], [18, -10, 22], [44, 2, 18], [70, 8, 14]], base: [16, 12, 70, 13] }, // this one reaches a little over the lower edge of the disc
    ],
    lean: [0, 0.05, 0.24, 0.42], // wind 0..3: shear of trees (units per unit of height)
    slant: [0, 0.14, 0.42, 0.8], // wind 0..3: rain slant
    rain: [0, 46, 96, 170], snow: [0, 60, 110, 170], // marks by level
  };

  /* ============================== state ============================== */
  var WET = { drizzle: 1, freezingDrizzle: 1, rain: 1, freezingRain: 1, showers: 1, thunder: 1, thunderHail: 1 };
  var SNOWY = { snow: 1, snowShowers: 1 };
  function state(s) {
    var o = { theme: 'light', phase: 'day', cond: 'clear', intensity: 2, veil: false, thunder: 0, fog: 0, wind: 0, windTo: 'right', frost: 0, heat: false,
      snowCover: 0, season: 'summer', level: 'full', event: null }, k;
    for (k in s) o[k] = s[k];
    if (/thunder/.test(o.cond) && !o.thunder) o.thunder = 2;
    if (o.cond === 'fog' && !o.fog) o.fog = 1;
    o.falling = WET[o.cond] ? 'rain' : SNOWY[o.cond] ? 'snow' : '';
    if (o.cover == null) {
      o.cover = o.cloud != null ? (o.cloud <= 10 ? 0 : o.cloud <= 35 ? 1 : o.cloud <= 60 ? 2 : o.cloud <= 85 ? 3 : 4)
        : { clear: 0, mostlyClear: 1, partly: 2, showers: 3, snowShowers: 3 }[o.cond] != null ? { clear: 0, mostlyClear: 1, partly: 2, showers: 3, snowShowers: 3 }[o.cond] : 4;
      if (o.thunder === 1 && s.cloud == null) o.cover = 3;
    }
    var dayish = o.phase === 'day' || o.phase === 'golden';
    if (o.body === undefined) o.body = dayish ? { kind: 'sun', t: 0.42 } : { kind: 'moon', t: 0.42 };
    if (o.body && o.body.kind === 'moon') { var m = { illum: 0.95, waxing: false, tilt: -18, size: 1 }; for (k in o.moon || {}) m[k] = o.moon[k]; o.moon = m; }
    if (o.sun == null) o.sun = dayish && o.body && o.body.kind === 'sun' ? [3, 3, 2, 1, 0][o.cover] : 0; // how sunny, 0..3
    if (o.falling || o.fog) o.sun = 0;
    if (o.wet == null) o.wet = !!WET[o.cond];
    o.dark = !dayish;
    return o;
  }
  function skyKey(s) {
    s = s.falling == null ? state(s) : s;
    var hk = s.event && window.Scene && window.Scene.hooks[s.event]; if (hk && hk.skyKey && hk.skyKey(s)) return hk.skyKey(s); // an event may pick its own sky (solarTotal → eclipse-sky)
    if (s.event === 'dust') return 'dust';
    var grey = s.cover === 4 || s.falling || s.fog;
    if (s.phase === 'night' || ((s.phase === 'dawn' || s.phase === 'dusk') && grey)) {
      return s.fog ? 'night-fog' : s.falling === 'snow' ? 'night-snow' : s.falling || s.thunder ? 'night-rain' : s.cover === 4 ? 'night-overcast'
        : s.body && s.body.kind === 'moon' && s.moon.illum > 0.9 && s.cover <= 1 ? 'night-full' : 'night';
    }
    if (s.phase === 'dawn' || s.phase === 'dusk') return s.phase;
    if (s.thunder >= 2) return 'storm';
    if (s.fog) return 'fog';
    if (s.falling === 'snow') return 'snow';
    if (s.falling) return s.thunder || (s.intensity >= 2 && !/rizzle/.test(s.cond)) ? 'rain' : 'drizzle';
    if (s.cover === 4) return 'overcast';
    if (s.phase === 'golden') return 'golden';
    return s.heat ? 'heat' : 'day';
  }
  function ink(s) { s = state(s); return s.theme !== 'dark' && PAL.darkInk[skyKey(s)] ? 'dark' : 'light'; }
  /* how the body is seen: clear · veil (thin high cloud, a halo) · hole (a rimmed gap in the deck) · schein (pale through wet cloud or fog) */
  function bodyMode(s) {
    if (!s.body) return '';
    if (s.fog >= 2 || (s.cover === 4 && (s.falling || s.fog)) || s.thunder >= 2) return 'schein';
    if (s.cover === 4) return 'hole';
    return s.veil ? 'veil' : 'clear';
  }

  function colours(s, key, stops) {
    var bottom = stops[stops.length - 1][1], top = stops[0][1], L = PAL.land[s.season];
    var li = PAL.light[/^night/.test(key) ? (key === 'night-full' ? 'night-full' : 'night') : PAL.light[key] ? key : 'day'];
    var dt = s.theme === 'dark' && PAL.darkInk[key] ? PAL.light.darkTheme : null;
    function lit(c, k) { var g = mix(mix(c, greyOf(c), li.grey), li.to, li.k * (k == null ? 1 : k)); return dt ? mix(g, dt.to, dt.k) : g; }
    function air(c, a) { return mix(lit(c), bottom, a); }
    var snow = lit(PAL.c.snow, 0.6), snowShade = lit(PAL.c['snow-shade'], 0.6), meadow = lit(s.heat ? mix(L.meadow, PAL.c['dry-meadow'], 0.6) : L.meadow);
    var water = mix(mix(top, bottom, 0.5), lit(PAL.c['water-deep']), 0.45);
    return {
      lit: lit, top: top, haze: bottom, far: air(L.rock, 0.5), mid: air(L.mid, 0.36), f1: air(L.f1, 0.2), f2: air(L.f2, 0.08), near: lit(L.near), dark: lit(L.dark),
      meadow: meadow, snow: snow, snowShade: snowShade, rime: lit(PAL.c.rime, 0.45), water: water, waterHi: mix(water, s.dark ? PAL.c.moon : '#ffffff', 0.55),
      ice: lit(PAL.c.ice, 0.6), iceHi: lit(PAL.c['ice-hi'], 0.6), wall: lit(PAL.c.wall, 0.8), roof: lit(PAL.c.roof, 0.8), wood: lit(PAL.c.wood, 0.7),
      smoke: s.dark || /storm|rain/.test(key) ? mix(PAL.c['smoke-dark'], bottom, 0.3) : lit(PAL.c.smoke, 0.5), flag: lit(PAL.c.flag, 0.6),
      crowns: L.crowns.map(function (c) { return lit(c); }), lightsOn: s.dark || /storm|rain/.test(key),
    };
  }
  function deckTones(s, key) {
    var D = PAL.deck, t = /^night/.test(key) ? (s.falling || s.fog ? D['night-wet'] : D.night) : key === 'dawn' || key === 'dusk' ? D.twilight
      : key === 'storm' ? D.storm : key === 'snow' ? D.snow : key === 'rain' ? D.wet : D.day;
    return Array.isArray(t) ? t : t[s.theme === 'dark' ? 'dark' : 'light'];
  }

  /* ============================== the drawing ============================== */
  function svg(input, o) {
    o = o || {};
    var s = state(input), key = skyKey(s), th = s.theme === 'dark' ? 'dark' : 'light', stops = PAL.sky[key][th], C = colours(s, key, stops);
    var out = '', defs = '', n = 0, idp = 'sc' + (o.idp || '') + (uid++) + '-', view = o.view || [0, 0, W, H], top = Math.min(0, view[1]) - 4;
    var t = s.body ? (s.body.t == null ? 0.42 : s.body.t) : 0.42;
    var body = o.bodyAt || [G.arc.x0 + (G.arc.x1 - G.arc.x0) * t, G.arc.yLow - G.arc.rise * Math.sin(Math.PI * t)];
    var mode = bodyMode(s), dir = s.windTo === 'left' ? -1 : 1, lean = G.lean[s.wind] * dir, plain = s.level === 'plain';
    var cover2 = s.snowCover >= 2, frozen = s.frost >= 2 || (s.snowCover >= 2 && !s.wet), quietEnd = (o.quietX == null ? 1000 : o.quietX) + 200;
    function id(p) { return idp + p + n++; }
    function add(tag, a, inner) { out += el(tag, a, inner); }
    function path(d, fill, extra) { var a = { d: d, fill: fill }; for (var k in extra || {}) a[k] = extra[k]; out += el('path', a); }
    function line(d, stroke, w, extra) { var a = { d: d, fill: 'none', stroke: stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }; for (var k in extra || {}) a[k] = extra[k]; out += el('path', a); }
    function open(layer, extra) { out += '<g data-layer="' + layer + '"' + (extra || '') + '>'; }
    function close() { out += '</g>'; }
    function grad(st, a, radial) {
      var g = id('g'); a.id = g;
      defs += el(radial ? 'radialGradient' : 'linearGradient', a, st.map(function (p) { return el('stop', { offset: p[0], 'stop-color': p[1], 'stop-opacity': p[2] }); }).join(''));
      return 'url(#' + g + ')';
    }
    function radial(col, a0, a1, at) { return grad([[at || 0, col, a0], [1, col, a1]], { cx: 0.5, cy: 0.5, r: 0.5 }, true); }
    var lightRight = function (x) { return x < body[0]; }, hzc = {};
    function hz(fill) { // the quiet side: far layers fade toward the sky under the text
      if (quietEnd <= 200) return fill;
      if (!hzc[fill]) { var m = mix(fill, C.haze, 0.6); hzc[fill] = grad([[0, m], [0.5, m], [0.8, fill]], { x1: 0, y1: 0, x2: quietEnd, y2: 0, gradientUnits: 'userSpaceOnUse' }); }
      return hzc[fill];
    }
    var hooks = window.Scene && window.Scene.hooks, X = { s: s, C: C, G: G, PAL: PAL, key: key, body: body, mode: mode, el: el, path: path, line: line, add: add, grad: grad, radial: radial, circ: circ, pts: pts, prng: prng, mix: mix, f: f, top: top, id: id, view: view };
    // a hook returns an SVG string (appended at its slot) or { svg, replace: true } (appended; for `body` it replaces the drawn body). arg: body → pale
    function hook(slot, arg) { if (hooks && s.event && hooks[s.event] && hooks[s.event][slot]) { var r = hooks[s.event][slot](X, arg); if (r && typeof r === 'object') { out += r.svg || ''; return r.replace === true; } if (typeof r === 'string') out += r; return r; } }

    /* ---- sky ---- */
    open('sky');
    add('rect', { x: 0, y: top, width: W, height: H - top, fill: grad(stops.map(function (p) { return [p[0], p[1]]; }), { x1: 0, y1: 0, x2: 0, y2: 250, gradientUnits: 'userSpaceOnUse' }) });
    if (PAL.glow[key]) add('ellipse', { cx: body[0], cy: 236, rx: 520, ry: 120, fill: radial(PAL.glow[key], 0.55, 0) });
    if (s.heat && !plain) add('rect', { x: 0, y: 150, width: W, height: 110, fill: grad([[0, PAL.c['heat-haze'], 0], [1, PAL.c['heat-haze'], 0.5]], { x1: 0, y1: 0, x2: 0, y2: 1 }) });
    close();

    /* ---- stars ---- */
    var starry = s.dark && key !== 'night-fog';
    function stars(count, clipTo) {
      var q = prng(21), d = ['', '', ''], i;
      for (i = 0; i < count; i++) {
        var x, y, r = 0.6 + q() * 0.9;
        if (clipTo) { var a = q() * 6.28, rr = 30 + q() * 60; x = body[0] + Math.cos(a) * rr * 1.5; y = body[1] - 4 + Math.sin(a) * rr * 0.6; }
        else { x = q() * W; y = top + q() * (200 - top); if (Math.hypot(x - body[0], y - body[1]) < 44) continue; }
        d[i % 3] += circ(x, y, r);
      }
      [0.5, 0.75, 1].forEach(function (op, j) { if (d[j]) path(d[j], PAL.c.star, { opacity: op }); });
    }
    if (starry && s.cover < 4 && !s.falling) { open('stars'); var moonLight = s.body && s.body.kind === 'moon' ? s.moon.illum : 0; stars(Math.round((s.phase === 'night' ? 64 : 22) * (1 - s.cover * 0.22) * (1 - moonLight * 0.5))); close(); }
    hook('sky');

    /* ---- body ---- */
    function drawBody(pale) {
      if (!s.body || hook('body', pale) === true) return;
      var g = '', R;
      if (s.body.kind === 'moon') {
        R = 24 * s.moon.size;
        var k = s.moon.illum, rx = R * Math.abs(2 * k - 1), col = PAL.c.moon;
        g += el('circle', { r: R * 2.7, fill: radial(col, pale ? 0.5 : 0.34, 0) });
        if (mode === 'veil') g += el('circle', { r: R * 2.1, fill: 'none', stroke: col, 'stroke-width': 2.2, opacity: 0.3 }); // the halo ring of thin high cloud
        g += el('circle', { r: R, fill: PAL.c['moon-dark'], opacity: pale ? 0.5 : 1 });
        if (k > 0.02) g += el('g', { transform: 'rotate(' + s.moon.tilt + ')' + (s.moon.waxing ? '' : ' scale(-1,1)'), opacity: pale ? 0.72 : 1 },
          el('path', { d: k > 0.98 ? circ(0, 0, R) : 'M0,' + -R + 'A' + R + ',' + R + ' 0 0,1 0,' + R + 'A' + f(rx) + ',' + R + ' 0 0,' + (k > 0.5 ? 1 : 0) + ' 0,' + -R + 'Z', fill: col }) +
          (k > 0.3 ? el('path', { d: circ(R * 0.17, -R * 0.33, R * 0.23) + circ(k > 0.6 ? -R * 0.12 : R * 0.5, R * 0.21, R * 0.17) + circ(R * 0.38, R * 0.3, R * 0.12) + (k > 0.6 ? circ(-R * 0.33, -R * 0.17, R * 0.11) : ''), fill: PAL.c['moon-mare'] }) : ''));
      } else {
        var low = s.phase === 'golden';
        R = s.heat ? 30 : low ? 28 : 25;
        var col2 = pale ? PAL.c['sun-pale'] : low ? PAL.c['sun-low'] : PAL.c.sun, rays = pale ? 0 : s.heat ? 16 : s.sun >= 3 ? 12 : s.sun === 2 ? 8 : 0;
        g += el('circle', { r: R * 3.4, fill: grad([[0, PAL.c['sun-core'], pale ? 0.5 : 0.6], [0.45, PAL.c['sun-core'], 0.22], [1, PAL.c['sun-core'], 0]], { cx: 0.5, cy: 0.5, r: 0.5 }, true) });
        if (mode === 'veil') g += el('circle', { r: R * 2.2, fill: 'none', stroke: '#ffffff', 'stroke-width': 2.4, opacity: 0.45 });
        if (rays) { // "how sunny": 3 = a full ring of long and short rays, 2 = eight short ones, heat = sixteen
          var rd = '';
          for (var j = 0; j < rays; j++) {
            var an = (j / rays) * 6.283, r0 = R + 7, r1 = R + (s.sun === 2 && !s.heat ? 14 : j % 2 ? 17 : s.heat ? 30 : 24), w = 0.085;
            rd += 'M' + f(Math.cos(an - w) * r0) + ',' + f(Math.sin(an - w) * r0) + 'L' + f(Math.cos(an) * r1) + ',' + f(Math.sin(an) * r1) + 'L' + f(Math.cos(an + w) * r0) + ',' + f(Math.sin(an + w) * r0) + 'Z';
          }
          g += el('path', { d: rd, fill: col2, opacity: 0.9 });
        }
        g += el('circle', { r: R, fill: col2, opacity: pale ? 0.8 : 1 }) + (pale ? '' : el('circle', { r: R * 0.62, fill: PAL.c['sun-core'] }));
      }
      out += el('g', { transform: 'translate(' + f(body[0]) + ',' + f(body[1]) + ')', 'data-layer': 'body', 'data-mode': mode }, g);
    }
    if (mode === 'clear' || mode === 'veil') drawBody(false);
    if (plain) { if (mode === 'schein') drawBody(true); return finish(); }

    /* ---- clouds ---- */
    function scallop(x0, x1, y, seed, depth, wMin, wMax, shear) { // lower edge of a sheet, right → left
      var Y = typeof y === 'function' ? y : function () { return y; };
      var q = prng(seed), d = 'L' + x1 + ',' + f(Y(x1)), x = x1;
      while (x > x0) { var w = wMin + q() * (wMax - wMin), nx = Math.max(x0, x - w), dp = depth * (0.5 + q()), mx = (x + nx) / 2; d += 'Q' + f(mx + (shear || 0)) + ',' + f(Y(mx) + dp * 2) + ' ' + f(nx) + ',' + f(Y(nx) + (q() - 0.5) * depth * 0.5); x = nx; }
      return d;
    }
    function sheet(y, seed, depth, wMin, wMax, fill, shear) { path('M0,' + top + 'L' + W + ',' + top + scallop(0, W, y, seed, depth, wMin, wMax, shear) + 'Z', fill); }
    var sh = lean * 60, DT = deckTones(s, key);
    if (s.veil && s.cover < 4) { // thin high cloud: long pale streaks, the body keeps its disc and gets a ring
      open('cloudsFar');
      var vq = prng(35), vd = '';
      for (var vi = 0; vi < 7; vi++) { var vx = 860 + vq() * 640, vy = 22 + vq() * 70, vw = 120 + vq() * 160; vd += 'M' + f(vx) + ',' + f(vy) + 'q' + f(vw * 0.5) + ',' + f(-8 - vq() * 6) + ' ' + f(vw) + ',-2q' + f(-vw * 0.5) + ',3 ' + f(-vw) + ',2Z'; }
      path(vd, s.dark ? PAL.c['cloud-night'] : '#ffffff', { opacity: s.dark ? 0.5 : 0.6 });
      close();
    }
    if (s.cover === 4 && s.thunder < 2) {
      // the deck: four rolls, darkest lowest, so it reads as a ceiling and not as a grey sky
      var wetLow = s.falling ? 10 : 0;
      open('clouds');
      sheet(140 + wetLow, 31, 7, 70, 150, DT[0], sh);
      sheet(120 + wetLow, 32, 8, 60, 130, DT[1], sh);
      sheet(96 + wetLow, 33, 8, 70, 140, DT[2], sh);
      sheet(66 + wetLow, 34, 7, 80, 150, DT[3], sh);
      close();
      if (mode === 'hole') {
        // the deck breaks into single banks around the body: dark bodies, the edge toward the body lit, lighter billows on that side;
        // one bank stands a little in front of the disc, two shreds drift past. No outline of a hole anywhere.
        var hs = s.dark ? PAL.sky.night[th] : PAL.sky.day[th], hsCol = mix(hs[0][1], hs[hs.length - 1][1], 0.45);
        add('ellipse', { cx: f(body[0] - 6), cy: f(body[1] - 4), rx: 196, ry: 92, fill: grad([[0, hsCol, 1], [0.5, hsCol, 0.96], [0.78, hsCol, 0.55], [1, hsCol, 0]], { cx: 0.5, cy: 0.5, r: 0.5 }, true), 'data-layer': 'sky', 'data-part': 'opening' }); // the open sky fades into the deck: no edge
        if (s.dark) { open('stars'); stars(12, true); close(); }
        add('circle', { cx: f(body[0]), cy: f(body[1]), r: 170, fill: radial(DT[4], 0.24, 0, 0.2), 'data-part': 'spill' });
        drawBody(false);
        open('clouds', ' data-part="banks"');
        G.banks.forEach(function (b, bi) {
          var cx = body[0] + b.at[0], cy = body[1] + b.at[1], dd = Math.hypot(b.at[0], b.at[1]) || 1, ux = -b.at[0] / dd, uy = -b.at[1] / dd, d = '', inner = '';
          b.l.forEach(function (l) { d += circ(cx + l[0], cy + l[1], l[2]); inner += circ(cx + l[0] + ux * l[2] * 0.16, cy + l[1] + uy * l[2] * 0.16 - l[2] * 0.08, l[2] * 0.8); }); // inner: the lit face, one joined shape
          d += ell(cx + b.base[0], cy + b.base[1], b.base[2], b.base[3]);
          var tone = DT[1 + (bi % 3)], near = Math.max(0.45, 1 - dd / 260);
          path(d, DT[4], { transform: 'translate(' + f(ux * 3.4) + ' ' + f(uy * 3.4) + ')', opacity: f(near), 'data-part': 'rim' });
          path(d, tone);
          path(inner, mix(tone, DT[4], 0.3 * near));
        });
        path('M' + f(body[0] - 96) + ',' + f(body[1] - 44) + 'q30,-10 70,-5q16,2 26,-1q-12,9 -40,9q-30,1 -56,-3Z M' + f(body[0] + 52) + ',' + f(body[1] - 60) + 'q24,-7 52,-2q-22,7 -52,2Z', mix(DT[2], DT[4], 0.3), { opacity: 0.8, 'data-part': 'shreds' });
        close();
      }
      if (mode === 'schein') { add('circle', { cx: f(body[0]), cy: f(body[1]), r: 120, fill: radial(DT[4], 0.5, 0), 'data-part': 'schein' }); drawBody(true); }
    }
    function cumulus(x, y, sc, shape) { // five hand-made shapes; a darker underside, a mid tone inside the lobes
      var Sh = G.cloudShapes[shape], d = '', inner = '';
      Sh.l.forEach(function (l) { d += circ(l[0], l[1], l[2]); if (l[1] > -22) inner += circ(l[0] + l[2] * 0.15, l[1] + l[2] * 0.4, l[2] * 0.55); });
      d += rrect(Sh.b[0], -12, Sh.b[1] - Sh.b[0], 14, 7);
      var light = s.dark ? PAL.c['cloud-night'] : s.falling ? PAL.c['cloud-grey'] : PAL.c.cloud, shade = s.dark ? PAL.c['cloud-night-shade'] : s.falling ? PAL.c['cloud-grey-shade'] : PAL.c['cloud-shade'];
      if (th === 'dark' && !s.dark) { light = mix(light, '#0c1430', 0.35); shade = mix(shade, '#0c1430', 0.4); }
      return el('g', { transform: 'translate(' + f(x) + ' ' + f(y) + ') scale(' + sc + ')' + (lean ? ' skewX(' + f(-lean * 55) + ')' : '') },
        el('path', { d: d, fill: shade, transform: 'translate(0 4)' }) + el('path', { d: d, fill: light }) + el('path', { d: inner, fill: shade, opacity: 0.45 }));
    }
    if (s.cover >= 1 && s.cover <= 3) {
      open('clouds');
      G.cumulus.slice(0, [0, 2, 4, 9][s.cover]).forEach(function (c, i) {
        var x = c[0] + sh * 0.5, y = c[1], half = 62 * c[2], gap = s.cover === 3 ? 34 : 58; // the body stays free: clouds step aside (cover 3: they close in to a gap)
        if (s.body && Math.abs(x - body[0]) < half + gap && Math.abs(y - 14 - body[1]) < 52) x = body[0] + (x < body[0] ? -1 : 1) * (half + gap);
        out += cumulus(x, y, c[2], c[3]);
      });
      if (s.cover === 3) { out += el('g', { opacity: 0.55 }, cumulus(300, 46, 1.3, 1) + cumulus(660, 64, 1.1, 3)); }
      close();
    }
    if (s.thunder) {
      // light: one tower with sky around it. From level 2: one dark base across the sky, billows with lit rims above it
      var wall = s.thunder >= 2, baseY = function (x) { return x < 760 ? 86 : x > 1040 ? 124 : 86 + (38 * (x - 760)) / 280; };
      open('clouds');
      if (wall) sheet(baseY, 53, 5, 44, 96, DT[0], sh * 0.5);
      var rim = '', lobes = '', lq = prng(52), xx, x0 = wall ? [820, 900, 1010, 1120] : [1130, 1150, 1180, 1200], x1 = wall ? 1660 : 1470;
      for (var row = 0; row < 4; row++) {
        var y0 = [84, 44, -8, -70][row];
        for (xx = x0[row]; xx < x1 - (wall ? 0 : row * 16); xx += 58 + row * 14) {
          var r1 = (30 + lq() * 16) * (1 + row * 0.28), cy = y0 + (lq() - 0.5) * 16, cx3 = xx + sh * (0.3 + row * 0.25);
          lobes += circ(cx3, cy, r1); rim += circ(cx3 - r1 * 0.16, cy - r1 * 0.2, r1 * 0.96);
        }
      }
      if (wall) for (xx = 60; xx < 820; xx += 150) lobes += circ(xx + lq() * 40, 6 + lq() * 8, 70); // the flat anvil over the text side
      path(rim, DT[4], { opacity: 0.75 }); path(lobes, DT[1]);
      if (!wall) path('M1100,96' + 'L1500,96' + scallop(1100, 1500, 122, 53, 4, 40, 80, sh * 0.5) + 'Z', DT[0]); // the tower's flat dark base
      close();
      if (wall && s.body) { add('circle', { cx: f(body[0]), cy: f(Math.max(40, body[1] - 30)), r: 110, fill: radial(DT[4], 0.42, 0), 'data-part': 'schein' }); }
    }

    /* ---- the pale range far behind, then the massif: five mountains, each drawn as its own body ---- */
    function capOf(crest, pk, depth) { // snow from the summit down to a jagged line
      var lim = pk[1] + depth, L = [], Rr = [], i, x;
      for (x = pk[0]; x > pk[0] - 140; x -= 3) { if (yAt(crest, x) > lim) break; L.push(x); }
      for (x = pk[0]; x < pk[0] + 140; x += 3) { if (yAt(crest, x) > lim) break; Rr.push(x); }
      var xl = L[L.length - 1], xr = Rr[Rr.length - 1], up = crest.filter(function (p) { return p[0] > xl && p[0] < xr; });
      var d = 'M' + f(xl) + ',' + f(yAt(crest, xl)) + up.map(function (p) { return 'L' + f(p[0]) + ',' + f(p[1]); }).join('') + 'L' + f(xr) + ',' + f(yAt(crest, xr));
      var nz = Math.max(3, Math.round((xr - xl) / 11)), q2 = prng(Math.round(pk[0]));
      for (i = 1; i < nz; i++) { var tt = i / nz, zx = xr + (xl - xr) * tt; d += 'L' + f(zx) + ',' + f(lim + (i % 2 ? depth * (0.25 + q2() * 0.45) : -depth * (0.2 + q2() * 0.3))); }
      return d + 'Z';
    }
    var cold = s.snowCover || s.frost || s.season === 'winter' || s.falling === 'snow', capK = cover2 ? 36 : cold ? 24 : s.season === 'summer' ? 10 : 15;
    var fogFar = [1, 0.35, 0][s.fog], fogMid = [1, 0.65, 0.22][s.fog], snowHaze = s.falling === 'snow' && s.intensity >= 3 ? 0.55 : 1, farOp = Math.min(fogFar, snowHaze);
    function fogBand(y, h, op, x0, w) { add('rect', { x: x0 == null ? -40 : x0, y: y, width: w || W + 80, height: h, rx: h / 2, fill: PAL.c.fog, opacity: op }); }
    if (farOp > 0) {
      open('ridgeAlp', farOp < 1 ? ' opacity="' + farOp + '"' : '');
      var bc = jag(G.back, 9, 2.5, 22), bcol = mix(cover2 ? mix(C.far, C.snow, 0.5) : C.far, C.haze, 0.45), bcaps = '';
      path(pts([[0, H]].concat(bc, [[W, H]]), true), hz(bcol), { 'data-part': 'back' });
      if (cold) G.backPeaks.forEach(function (pk) { var d = pk[2] * capK * 0.8; if (d > 4) bcaps += capOf(bc, pk, d); });
      if (bcaps) path(bcaps, mix(C.snow, C.haze, 0.55));
      var glowC = PAL.glow[key], rockGlow = glowC && s.cover < 4 ? 0.34 : 0; // twilight: the lit faces and the snow take the colour of the low sun
      G.mountains.forEach(function (m, mi) {
        var sil = jag(m.sil, 40 + mi, 1.6, 15), S = m.sil[m.top], shadeLeft = lightRight(S[0]), it = sil.indexOf(S), sd = shadeLeft ? -1 : 1, q4 = prng(900 + mi);
        var col = mix(mix(mix(C.far, C.haze, m.haze), C.snow, cover2 ? 0.55 : 0), glowC || '#000000', rockGlow), snowC = mix(mix(C.snow, C.haze, m.haze), glowC || '#000000', rockGlow * 1.1);
        out += '<g data-part="' + m.id + '">';
        path(pts(sil, true), col);
        // snow: the cap, the gullies under it, and fields lower down (more of them when it is cold)
        var depth = m.size * capK, cap = capOf(sil, S, depth);
        m.gullies.slice(0, cold ? 9 : 2).forEach(function (g) { cap += 'M' + g[0] + ',' + g[1] + 'l2.6,' + g[2] + 'l-5.4,' + f(-g[2] * 0.25) + 'Z'; });
        cap += m.fields.slice(0, cover2 ? 9 : cold ? 3 : 0).join('');
        path(cap, snowC, { 'data-part': 'caps' });
        // every rib throws a shaded flank; the main arête parts the lit face from the shaded one
        var ribs = '';
        m.ribs.forEach(function (rb) {
          var a = m.sil[rb[0]], n2 = 4, d = 'M' + a[0] + ',' + a[1];
          for (var k2 = 1; k2 <= n2; k2++) { var tt = k2 / n2; d += 'L' + f(a[0] + (rb[1] - a[0]) * tt + (k2 < n2 ? (k2 % 2 ? 1 : -1) * (2 + q4() * 3) : 0)) + ',' + f(a[1] + (218 - a[1]) * tt); }
          ribs += d + 'L' + f(rb[1] + sd * rb[2]) + ',218Z';
        });
        if (ribs) path(ribs, cover2 ? C.snowShade : C.dark, { opacity: cover2 ? 0.45 : 0.2, 'data-part': 'ribs' });
        var face = shadeLeft ? sil.slice(0, it + 1).concat(m.arete.slice(1)) : sil.slice(it).concat(m.arete.slice(1).reverse());
        path(pts(face, true), cover2 ? C.snowShade : C.dark, { opacity: cover2 ? 0.7 : 0.36, 'data-part': 'shade' });
        if (s.wind === 3 && cover2 && m.size >= 0.8) path('M' + S[0] + ',' + S[1] + 'q' + f(dir * 22) + ',-9 ' + f(dir * 52) + ',-4q' + f(-dir * 20) + ',1 ' + f(-dir * 44) + ',10Z', C.snow, { opacity: 0.6, 'data-part': 'spindrift' });
        out += '</g>';
      });
      close();
    }
    hook('behindLand');
    if (s.fog) { open('fog'); fogBand(168, 30, 0.5); fogBand(196, 22, 0.42, 300, 1100); close(); }

    /* ---- round wooded hills ---- */
    open('ridgeFar', fogMid < 1 ? ' opacity="' + fogMid + '"' : '');
    var hillCol = cover2 ? mix(C.mid, C.snow, 0.45) : C.mid, hq = prng(14), hd = '', hx2;
    path(smooth(G.hills, H), hz(hillCol));
    if (!cover2 && !s.fog) path(G.clearings.join(''), mix(C.meadow, C.haze, 0.4), { opacity: 0.8, 'data-part': 'clearings' });
    for (hx2 = 20; hx2 < W; hx2 += 9 + hq() * 16) { var hy = yAt(G.hills, hx2) + 6 + hq() * 10, hh = 5 + hq() * 5; hd += 'M' + f(hx2 - hh * 0.38) + ',' + f(hy) + 'L' + f(hx2 + lean * hh) + ',' + f(hy - hh) + 'L' + f(hx2 + hh * 0.38) + ',' + f(hy) + 'Z'; }
    path(hd, hz(mix(C.f1, hillCol, 0.35)), { 'data-part': 'wood' });
    close();

    /* ---- forest in staffels ---- */
    function skyline(lineKeys, seed, sMin, sMax, hMin, hMax, fill, layer, fogOp) {
      var q = prng(seed), x = -10, d = 'M-10,' + H, tips = '', end = lineKeys[lineKeys.length - 1][0];
      while (x < end + 10) {
        var sp = sMin + q() * (sMax - sMin), kind = q(), h = hMin + q() * (hMax - hMin) * (kind > 0.88 ? 1.5 : 1), yb = yAt(lineKeys, Math.max(0, Math.min(end, x + sp / 2))), tx = x + sp / 2 + lean * h * 1.1;
        if (kind > 0.7 && kind <= 0.88) d += 'L' + f(x) + ',' + f(yb) + 'Q' + f(tx - sp * 0.7) + ',' + f(yb - h * 0.95) + ' ' + f(tx) + ',' + f(yb - h * 0.82) + 'Q' + f(tx + sp * 0.7) + ',' + f(yb - h * 0.95) + ' ' + f(x + sp) + ',' + f(yb); // a round crown among the spruces
        else {
          d += 'L' + f(x) + ',' + f(yb) + 'L' + f(tx - sp * 0.16) + ',' + f(yb - h * 0.52) + 'L' + f(tx - sp * 0.3) + ',' + f(yb - h * 0.5) + 'L' + f(tx) + ',' + f(yb - h) + 'L' + f(tx + sp * 0.3) + ',' + f(yb - h * 0.5) + 'L' + f(tx + sp * 0.16) + ',' + f(yb - h * 0.52);
          tips += 'M' + f(tx - sp * 0.26) + ',' + f(yb - h * 0.56) + 'L' + f(tx) + ',' + f(yb - h) + 'L' + f(tx + sp * 0.26) + ',' + f(yb - h * 0.56) + 'L' + f(tx) + ',' + f(yb - h * 0.7) + 'Z';
        }
        x += sp;
      }
      d += 'L' + (end + 10) + ',' + H + 'Z';
      open(layer, fogOp < 1 ? ' opacity="' + fogOp + '"' : '');
      path(d, hz(fill));
      if (s.snowCover) path(tips, C.snow, { opacity: cover2 ? 0.85 : 0.5 }); else if (s.frost) path(tips, C.rime, { opacity: 0.22 });
      close();
    }
    /* trees: six kinds, each its own figure. They fill accumulators, so a whole group costs a handful of elements */
    function newAcc() { return { full: '', shade: '', snow: '', trunk: '', crown: ['', '', ''], crownShade: '', bare: '', birch: '', marks: '' }; }
    function shear(x, yb, h) { return function (px, py) { var dy = yb - py; return f(px + lean * dy * (0.45 + (0.9 * dy) / h)) + ',' + f(py); }; }
    function spruce(x, yb, h, acc, seed, wide) { // tiers with a drooping, toothed hem
      var q = prng(seed), tn = wide ? 3 : Math.max(3, Math.round(h / 21)), w = h * (wide ? 0.46 : 0.36), P = shear(x, yb, h), side = lightRight(x) ? -1 : 1;
      acc.trunk += 'M' + P(x - h * 0.03, yb) + 'L' + P(x - h * 0.03, yb - h * 0.2) + 'L' + P(x + h * 0.03, yb - h * 0.2) + 'L' + P(x + h * 0.03, yb) + 'Z';
      for (var i = 0; i < tn; i++) {
        var b = yb - h * (0.1 + (0.76 * i) / tn), a = i === tn - 1 ? yb - h : b - h * (1.3 / tn), k = 1 - (0.68 * i) / tn, wl = w * k * (0.88 + q() * 0.24), wr = w * k * (0.88 + q() * 0.24), dr = h * 0.022;
        acc.full += 'M' + P(x - wl, b + dr) + 'L' + P(x, a) + 'L' + P(x + wr, b + dr) + 'L' + P(x + wr * 0.62, b - dr * 0.7) + 'L' + P(x + wr * 0.33, b + dr * 0.8) + 'L' + P(x, b - dr * 0.5) + 'L' + P(x - wl * 0.33, b + dr * 0.8) + 'L' + P(x - wl * 0.62, b - dr * 0.7) + 'Z';
        var ws = side > 0 ? wr : wl;
        acc.shade += 'M' + P(x, a) + 'L' + P(x + side * ws, b + dr) + 'L' + P(x + side * ws * 0.62, b - dr * 0.7) + 'L' + P(x + side * ws * 0.33, b + dr * 0.8) + 'L' + P(x, b - dr * 0.5) + 'Z';
        acc.snow += 'M' + P(x - wl * 0.6, b - (b - a) * 0.36) + 'L' + P(x, a) + 'L' + P(x + wr * 0.6, b - (b - a) * 0.36) + 'L' + P(x + wr * 0.2, b - (b - a) * 0.5) + 'L' + P(x - wl * 0.25, b - (b - a) * 0.3) + 'Z';
      }
    }
    function pine(x, yb, h, acc) { // a bare stem with flat tufts at the top
      var P = shear(x, yb, h), k = lean * h, side = lightRight(x) ? -1 : 1;
      acc.trunk += 'M' + P(x - h * 0.028, yb) + 'L' + P(x - h * 0.012, yb - h * 0.9) + 'L' + P(x + h * 0.016, yb - h * 0.9) + 'L' + P(x + h * 0.028, yb) + 'Z' +
        'M' + P(x, yb - h * 0.52) + 'L' + P(x + h * 0.17, yb - h * 0.62) + 'L' + P(x + h * 0.17, yb - h * 0.6) + 'L' + P(x, yb - h * 0.48) + 'Z';
      [[-0.1, 0.8, 0.2, 0.08], [0.1, 0.9, 0.22, 0.085], [-0.02, 1.0, 0.15, 0.07], [0.18, 0.64, 0.11, 0.045]].forEach(function (c) {
        var cx = x + c[0] * h + k * c[1] * 1.1, cy = yb - c[1] * h;
        acc.full += ell(cx, cy, c[2] * h, c[3] * h); acc.shade += ell(cx + side * c[2] * h * 0.3, cy + c[3] * h * 0.42, c[2] * h * 0.66, c[3] * h * 0.5); acc.snow += ell(cx, cy - c[3] * h * 0.5, c[2] * h * 0.8, c[3] * h * 0.42);
      });
    }
    function bareD(x0, y0, r2) { // a winter crown: a stem and its branches
      return 'M' + x0 + ',' + y0 + 'v' + f(-r2 * 1.5) + 'M' + x0 + ',' + f(y0 - r2 * 0.9) + 'l' + f(-r2 * 0.8) + ',' + f(-r2 * 1.1) + 'M' + x0 + ',' + f(y0 - r2 * 1.1) + 'l' + f(r2 * 0.85) + ',' + f(-r2) +
        'M' + x0 + ',' + f(y0 - r2 * 1.5) + 'l' + f(-r2 * 0.35) + ',' + f(-r2 * 0.9) + 'M' + x0 + ',' + f(y0 - r2 * 1.5) + 'l' + f(r2 * 0.4) + ',' + f(-r2 * 0.8) +
        'M' + f(x0 - r2 * 0.5) + ',' + f(y0 - r2 * 1.6) + 'l' + f(-r2 * 0.5) + ',' + f(-r2 * 0.25) + 'M' + f(x0 + r2 * 0.55) + ',' + f(y0 - r2 * 1.75) + 'l' + f(r2 * 0.5) + ',' + f(-r2 * 0.15);
    }
    function leafTree(x, yb, r, acc, ci) { // a round crown of six lobes on a forked stem
      if (leafless) { acc.bare += bareD(x, yb, r); return; }
      var cx = x + lean * r * 2.8, cy = yb - r * 2.2, side = lightRight(x) ? -1 : 1;
      acc.trunk += 'M' + f(x - r * 0.13) + ',' + yb + 'L' + f(cx - r * 0.08) + ',' + f(cy + r * 0.3) + 'L' + f(cx + r * 0.08) + ',' + f(cy + r * 0.3) + 'L' + f(x + r * 0.13) + ',' + yb + 'Z';
      [[-0.55, 0.1, 0.6], [0.05, -0.55, 0.72], [0.7, -0.1, 0.62], [0.2, 0.35, 0.6], [-0.25, -0.25, 0.6], [0.5, -0.5, 0.5]].forEach(function (l) { acc.crown[ci % 3] += circ(cx + l[0] * r, cy + l[1] * r, l[2] * r); });
      acc.crownShade += circ(cx + side * 0.35 * r, cy + 0.36 * r, 0.48 * r) + circ(cx + side * 0.62 * r, cy - 0.02 * r, 0.36 * r);
    }
    function birch(x, yb, h, acc, ci) { // a white slender stem, a loose light crown
      var k = lean * h * 0.7, tx = x + k, ty = yb - h * 0.8;
      acc.birch += 'M' + f(x - h * 0.03) + ',' + yb + 'L' + f(tx - h * 0.012) + ',' + f(ty) + 'L' + f(tx + h * 0.012) + ',' + f(ty) + 'L' + f(x + h * 0.03) + ',' + yb + 'Z';
      acc.marks += 'M' + f(x - h * 0.02) + ',' + f(yb - h * 0.16) + 'h' + f(h * 0.035) + 'M' + f(x - h * 0.01 + k * 0.4) + ',' + f(yb - h * 0.36) + 'h' + f(h * 0.03) + 'M' + f(x - h * 0.012 + k * 0.7) + ',' + f(yb - h * 0.55) + 'h' + f(h * 0.028);
      if (leafless) { acc.bare += 'M' + f(tx) + ',' + f(ty) + 'l' + f(-h * 0.16) + ',' + f(-h * 0.2) + 'M' + f(tx) + ',' + f(ty) + 'l' + f(h * 0.14) + ',' + f(-h * 0.22) + 'M' + f(tx) + ',' + f(ty) + 'v' + f(-h * 0.2) + 'M' + f(x + k * 0.6) + ',' + f(yb - h * 0.55) + 'l' + f(-h * 0.2) + ',' + f(-h * 0.14) + 'M' + f(x + k * 0.7) + ',' + f(yb - h * 0.62) + 'l' + f(h * 0.2) + ',' + f(-h * 0.12); return; }
      [[-0.15, -0.62, 0.13], [0.12, -0.7, 0.14], [0, -0.86, 0.13], [-0.2, -0.8, 0.1], [0.2, -0.88, 0.1], [0.04, -1.0, 0.1], [0.24, -0.58, 0.09]].forEach(function (l) { acc.crown[ci % 3] += circ(x + k * -l[1] + l[0] * h, yb + l[1] * h, l[2] * h); });
    }
    function bush(x, yb, r, acc) { acc.full += circ(x - r, yb - r * 0.6, r * 0.8) + circ(x, yb - r, r) + circ(x + r, yb - r * 0.6, r * 0.8); }
    function plant(list, acc) {
      list.forEach(function (tr, i) {
        var kd = tr[0];
        if (kd === 'spruce') spruce(tr[1], tr[2], tr[3], acc, 500 + i * 7 + tr[1]);
        else if (kd === 'fir') spruce(tr[1], tr[2], tr[3], acc, 500 + i * 7 + tr[1], true);
        else if (kd === 'pine') pine(tr[1], tr[2], tr[3], acc);
        else if (kd === 'birch') birch(tr[1], tr[2], tr[3], acc, i);
        else if (kd === 'leaf') leafTree(tr[1], tr[2], tr[3], acc, i);
        else bush(tr[1], tr[2], tr[3], acc);
      });
    }
    function paint(acc, part, far) {
      out += '<g data-part="' + part + '">';
      if (acc.trunk) path(acc.trunk, C.wood);
      if (acc.full) path(acc.full, far ? C.f2 : cover2 ? C.near : mix(C.near, C.dark, 0.45));
      if (acc.shade) path(acc.shade, C.dark, { opacity: far ? 0.3 : 0.45 });
      if (s.snowCover && acc.snow) path(acc.snow, C.snow, { opacity: cover2 ? 1 : 0.6 }); else if (s.frost && acc.snow) path(acc.snow, C.rime, { opacity: far ? 0.2 : 0.4 });
      if (acc.birch) { path(acc.birch, C.lit('#e9e6dc')); line(acc.marks, C.dark, 0.9, { opacity: 0.7 }); }
      acc.crown.forEach(function (d, ci) { if (d) path(d, C.crowns[ci % C.crowns.length]); });
      if (acc.crownShade) path(acc.crownShade, C.dark, { opacity: 0.28 });
      if (acc.bare) { line(acc.bare, cover2 ? C.wood : C.dark, 1.8); if (s.frost || s.snowCover) line(acc.bare, s.snowCover ? C.snow : C.rime, 0.9, { opacity: s.snowCover ? 0.9 : 0.55, transform: 'translate(-0.6 -0.9)' }); }
      out += '</g>';
    }
    function leafy(lineKeys, seed, n3, r0, r1, col, op) { // round crowns of broadleaf trees in front of a staffel (not in winter)
      if (leafless) return;
      var q = prng(seed), d = '', end = lineKeys[lineKeys.length - 1][0];
      for (var i3 = 0; i3 < n3; i3++) { var x = q() * end, r = r0 + q() * (r1 - r0); d += circ(x + lean * r, yAt(lineKeys, x) + r * 0.2 + q() * r, r) + circ(x + r * 0.9 + lean * r, yAt(lineKeys, x) + r * 0.7 + q() * r * 0.5, r * 0.75); }
      path(d, hz(col), { opacity: op, 'data-layer': 'ridgeMid', 'data-part': 'leafy' });
    }
    var leafless = s.season === 'winter' || cover2;
    skyline(G.f1, 61, 8, 13, 9, 15, C.f1, 'ridgeMid', [1, 0.8, 0.45][s.fog]);
    leafy(G.f1, 64, 46, 3, 5, mix(C.crowns[0] || C.f1, C.haze, 0.3), [0.9, 0.7, 0.35][s.fog]);
    if (s.fog) { open('fog'); fogBand(222, 20, 0.5); if (s.fog >= 2) fogBand(240, 26, 0.6); close(); }

    /* ---- the lake: round, whole, in a meadow; far houses, jetty and boat ---- */
    open('water');
    var shoreCol = cover2 ? mix(C.snow, C.snowShade, 0.3) : s.snowCover ? mix(C.meadow, C.snow, 0.6) : mix(C.meadow, C.f1, 0.3), i, x, wq = prng(71);
    path(G.backShore, shoreCol, { 'data-part': 'shore' });
    var hw = '', hr = '', hwin = '';
    G.farHouses.forEach(function (h0, hi) { var w = hi % 2 ? 8 : 10; hw += 'M' + h0[0] + ',' + h0[1] + 'v-5h' + w + 'v5Z'; hr += 'M' + (h0[0] - 1.5) + ',' + (h0[1] - 5) + 'l' + (w / 2 + 1.5) + ',-4.5l' + (w / 2 + 1.5) + ',4.5Z'; hwin += 'M' + (h0[0] + w - 4) + ',' + (h0[1] - 3.8) + 'h2v2h-2Z'; });
    path(hw, mix(C.wall, C.haze, 0.25), { 'data-part': 'farHouses' }); path(hr, s.snowCover ? C.snow : mix(C.roof, C.haze, 0.2)); if (C.lightsOn) path(hwin, PAL.c.window);
    line(G.lake, mix(shoreCol, cover2 ? C.snowShade : C.haze, 0.5), 3.4, { 'data-part': 'rim' });
    path(G.lake, frozen ? C.ice : C.water, { 'data-part': 'lake' });
    var lc = id('c'); defs += el('clipPath', { id: lc }, el('path', { d: G.lake }));
    out += '<g clip-path="url(#' + lc + ')">';
    if (!frozen && !s.fog && s.wind <= 1) { // the massif stands in the water (a mirror only in still air)
      var rf = 'M1002,262';
      for (x = 1002; x <= 1342; x += 10) { var top2 = 218; G.mountains.forEach(function (m) { if (x >= m.sil[0][0] && x <= m.sil[m.sil.length - 1][0]) top2 = Math.min(top2, yAt(m.sil, x)); }); rf += 'L' + x + ',' + f(263 + (218 - top2) * 0.3); }
      path(rf + 'L1342,262Z', C.far, { opacity: s.wind ? 0.28 : 0.5, 'data-part': 'mirror' });
    }
    if (frozen) {
      path('M1010,276l60,-5l44,6l-52,5ZM1150,286l70,-5l56,6l-60,6ZM1236,270l50,-2l30,4l-44,3Z', cover2 ? C.snow : C.iceHi, { opacity: 0.85 });
      line('M1020,290l80,-6M1110,272l60,3M1200,294l90,-3M1060,282l30,2', C.iceHi, 1.6);
    } else {
      var wd = '';
      if (s.body && mode !== 'schein' && Math.abs(body[0] - 1170) < 160 && s.wind <= 2) { // the body's light on the water
        for (i = 0; i < 5; i++) { var ww2 = 6 + i * 5 + wq() * 14; wd += 'M' + f(body[0] - ww2 / 2 + (wq() - 0.5) * 16) + ',' + f(271 + i * 5.6 + wq() * 2) + 'h' + f(ww2); }
        line(wd, C.waterHi, 1.7, { opacity: 0.6, 'data-part': 'glitter' });
      }
      var nRip = [0, 7, 16, 26][s.wind] + (s.falling === 'rain' ? 6 * s.intensity : 0), rd2 = '', caps2 = '';
      for (i = 0; i < nRip; i++) { var cx2 = 1010 + wq() * 316, cy2 = 268 + wq() * 30; rd2 += 'M' + f(cx2) + ',' + f(cy2) + 'l7,-2.5l7,2.5'; if (s.wind === 3 && i % 3 === 0) caps2 += 'M' + f(cx2) + ',' + f(cy2) + 'l7,-3.4l7,3.4l-7,-1Z'; }
      if (rd2) line(rd2, C.waterHi, 1.5, { opacity: 0.7, 'data-part': 'ripples' });
      if (caps2) path(caps2, '#ffffff', { opacity: 0.75, 'data-part': 'whitecaps' });
    }
    out += '</g>';
    if (s.frost === 1 && !frozen) line(G.lake, C.rime, 2, { opacity: 0.5, 'data-part': 'iceRim' });
    path('M' + (G.jetty[0] + 6) + ',' + G.jetty[1] + 'l-36,-3.6v2.6l36,3.8Z', C.wood, { 'data-part': 'jetty' });
    line('M' + (G.jetty[0] - 26) + ',' + (G.jetty[1] - 2) + 'v5M' + (G.jetty[0] - 10) + ',' + (G.jetty[1]) + 'v5', C.wood, 1.6);
    out += el('g', { transform: 'translate(' + G.boat[0] + ' ' + G.boat[1] + ') rotate(' + (frozen ? 0 : s.wind * 2.5 * dir) + ')', 'data-part': 'boat' },
      el('path', { d: 'M-12,-3.4h24l-3,5.2q-9,2.4 -18,0Z', fill: C.wall }) + el('path', { d: 'M-12,-3.4h24l-1,1.6h-22Z', fill: mix(C.wall, C.dark, 0.5) }));
    close();
    skyline(G.f2, 62, 12, 19, 16, 26, C.f2, 'ridgeMid', [1, 0.9, 0.7][s.fog]);
    leafy(G.f2, 65, 30, 5, 8, mix(C.crowns[1] || C.f2, C.haze, 0.12), [0.95, 0.8, 0.5][s.fog]);
    open('ridgeMid', s.fog >= 2 ? ' opacity="0.7"' : ''); // right of the lake the second staffel is single firs behind the cabin
    (function () {
      var acc = newAcc(), q = prng(63), x = 1356, i2 = 0;
      while (x < 1610) { spruce(x, 268 - (x - 1356) * 0.035 + q() * 4, 24 + q() * 24, acc, 700 + i2++, q() > 0.6); x += 9 + q() * 12; }
      paint(acc, 'staffel', true);
    })();
    close();
    if (s.fog >= 2) { open('fog'); fogBand(252, 30, 0.6); close(); }

    /* ---- foreground: round ground, way, buildings, smoke, fence, flag, trees ---- */
    open('ridgeNear');
    var gfill = cover2 ? C.snow : s.snowCover ? mix(C.meadow, C.snow, 0.7) : C.meadow, gy = function (x) { return yAt(G.ground, x) + 2; };
    path(smooth(G.ground, H), gfill, { 'data-part': 'ground' });
    path('M-20,320L-20,307Q240,298 520,309T990,309Q1160,318 1340,311Q1470,292 1620,290L1620,320Z', cover2 ? C.snowShade : C.near, { opacity: cover2 ? 0.5 : 0.32, 'data-part': 'fold' });
    if (s.sun >= 2 && !s.snowCover) path('M300,294Q560,284 860,294Q960,298 990,301Q700,292 300,300Z M1380,284Q1470,270 1600,270Q1500,276 1400,292Z', mix(C.meadow, '#fff7c0', 0.3), { opacity: 0.7, 'data-part': 'sunband' });
    if (s.frost && !s.snowCover) line(smooth(G.ground), C.rime, 2.6, { opacity: 0.45, 'data-part': 'hoar' });
    path(G.way, cover2 ? C.snowShade : mix(gfill, C.haze, 0.35), { opacity: cover2 ? 0.7 : 0.85, 'data-part': 'way' });
    if (s.sun >= 2 || (s.dark && mode === 'clear' && s.moon && s.moon.illum > 0.9 && cover2)) { // cast shadows: only under a clear body
      var shd = '';
      G.trees.forEach(function (tr) { if (tr[0] === 'bush' || tr[2] < 262) return; var h = tr[0] === 'leaf' ? tr[3] * 3 : tr[3], dx = (tr[1] - body[0]) * 0.5, l = h * 0.5; shd += 'M' + f(tr[1] - 5) + ',' + tr[2] + 'L' + f(tr[1] + 5) + ',' + tr[2] + 'L' + f(tr[1] + dx * 0.35 + 9) + ',' + f(tr[2] + l) + 'L' + f(tr[1] + dx * 0.35 - 12) + ',' + f(tr[2] + l) + 'Z'; });
      shd += 'M1404,266L1490,263L1530,284L1424,290Z';
      path(shd, cover2 ? C.snowShade : C.dark, { opacity: (cover2 ? 0.8 : 0.26) * (s.sun === 2 ? 0.6 : 1), 'data-part': 'shadows' });
    }
    var accB = newAcc(); plant(G.behind, accB); paint(accB, 'treesBehind');
    function building(at, cabin) { // a log cabin (or the plain shed): gable, side wall, roof plane, eave; the cabin has a chimney, a door, three windows
      var b = '', wallS = mix(C.wall, C.dark, 0.42), roofC = s.snowCover ? C.snow : C.roof, win = C.lightsOn ? PAL.c.window : mix(C.wall, C.dark, 0.72);
      if (cabin) b += el('path', { d: 'M48,-56h8v14h-8Z', fill: mix(C.roof, C.haze, 0.25) }) + el('path', { d: 'M46.5,-57.5h11v3h-11Z', fill: s.snowCover ? C.snow : C.roof });
      b += el('path', { d: 'M34,0v-20l40,-3v20Z', fill: wallS }) + el('path', { d: 'M0,0v-20l17,-17l17,17v20Z', fill: C.wall });
      if (cabin) b += el('path', { d: 'M0,-5h34M0,-10h34M0,-15h34M34,-6l40,-3M34,-11.5l40,-3', fill: 'none', stroke: C.dark, 'stroke-width': 0.7, opacity: 0.28 }); // logs
      b += el('path', { d: 'M15,-39.4l44,-3.3l19,21.6l-44,3.3Z', fill: roofC }) + el('path', { d: 'M-4.5,-16.5l19.5,-23l3,2.6l-19.5,22.6Z', fill: s.snowCover ? C.snowShade : mix(C.roof, C.dark, 0.35) });
      if (s.snowCover >= 2 && cabin) b += el('path', { d: 'M15,-42.4l44,-3.3l2,2.4l-44,3.3Z', fill: C.snow });
      b += el('path', { d: cabin ? 'M12,0v-12h8v12Z' : 'M9,0v-13h14v13Z', fill: mix(C.wall, C.dark, 0.62) });
      if (cabin) b += el('path', { d: 'M14,-27h6v5.5h-6ZM42,-15l8,-0.6v7l-8,0.6ZM58,-16.2l8,-0.6v7l-8,0.6Z', fill: win, 'data-part': 'window' }) +
        el('path', { d: 'M76,0v-6q7,-2.4 14,0v6Z', fill: C.wood }) + el('path', { d: 'M79,-3h.1M83,-4h.1M87,-3h.1M81,-1h.1M85,-1h.1', stroke: mix(C.wood, C.haze, 0.5), 'stroke-width': 1.6, 'stroke-linecap': 'round' }); // the wood pile
      out += el('g', { transform: 'translate(' + at[0] + ' ' + at[1] + ') scale(' + at[2] + ')', 'data-part': cabin ? 'cabin' : 'shed' }, b);
    }
    building(G.shed, false); building(G.cabin, true);
    if (C.lightsOn) add('circle', { cx: G.cabin[0] + 62, cy: G.cabin[1] - 14, r: 30, fill: radial(PAL.c.window, 0.3, 0) });
    var fd = '';
    [[1384, 1406], [1452, 1612]].forEach(function (seg) { // the fence runs in front of the cabin and leaves the way open
      var r1 = '', r2 = '';
      for (var x = seg[0]; x <= seg[1]; x += 16) { var y = gy(x) + 12; fd += 'M' + x + ',' + f(y + 1) + 'v-12'; r1 += (r1 ? 'L' : 'M') + x + ',' + f(y - 8); r2 += (r2 ? 'L' : 'M') + x + ',' + f(y - 3.5); }
      fd += r1 + r2;
    });
    line(fd, cover2 ? C.wood : C.dark, 1.9, { opacity: cover2 ? 0.75 : 1, 'data-part': 'fence' });
    // smoke shows the wind: 0 a column that spreads · 1 it leans · 2 a flat streak · 3 torn off the chimney
    var sx0 = G.cabin[0] + 52 * G.cabin[2], sy0 = G.cabin[1] - 57.5 * G.cabin[2], sm = '', sq = prng(81);
    if (s.wind <= 1) for (i = 0; i < 6; i++) sm += circ(sx0 + (sq() - 0.5) * (3 + i * 2) + i * (s.wind ? 7 * dir : 0.8), sy0 - 5 - i * (s.wind ? 8 : 10), 3.2 + i * 1.7);
    else if (s.wind === 2) sm = 'M' + f(sx0) + ',' + f(sy0) + 'q' + 6 * dir + ',-7 ' + 26 * dir + ',-9q' + 34 * dir + ',-3 ' + 66 * dir + ',-1q' + -30 * dir + ',6 ' + -58 * dir + ',8q' + -22 * dir + ',2 ' + -30 * dir + ',6Z';
    else sm = 'M' + f(sx0) + ',' + f(sy0) + 'q' + 5 * dir + ',-4 ' + 20 * dir + ',-4q' + 14 * dir + ',1 ' + 26 * dir + ',3q' + -16 * dir + ',1 ' + -28 * dir + ',2Z M' + f(sx0 + 58 * dir) + ',' + f(sy0 - 3) + 'q' + 12 * dir + ',-3 ' + 30 * dir + ',0q' + -14 * dir + ',2 ' + -30 * dir + ',0Z';
    path(sm, C.smoke, { opacity: 0.85, 'data-part': 'smoke' });
    // flag at the lake: 0 hangs · 1 half out · 2 straight out · 3 straight, frayed, the pole bends
    var fx = G.flag[0], fy = G.flag[1], bend = s.wind === 3 ? 4 * dir : 0, tx0 = fx + bend, ty0 = fy - 59;
    line('M' + fx + ',' + fy + 'Q' + fx + ',' + (fy - 30) + ' ' + tx0 + ',' + (fy - 60), cover2 ? C.wood : C.dark, 2.2, { 'data-part': 'pole' });
    var cloth = s.wind === 0 ? 'M' + tx0 + ',' + ty0 + 'l' + 8 * dir + ',3l' + -2 * dir + ',22l' + -6 * dir + ',-4Z'
      : s.wind === 1 ? 'M' + tx0 + ',' + ty0 + 'q' + 12 * dir + ',1 ' + 22 * dir + ',9l' + -3 * dir + ',14q' + -9 * dir + ',-7 ' + -19 * dir + ',-8Z'
      : 'M' + tx0 + ',' + ty0 + 'q' + 10 * dir + ',-5 ' + 19 * dir + ',-1t' + 19 * dir + ',-1' + (s.wind === 3 ? 'l' + -5 * dir + ',4l' + 6 * dir + ',3l' + -6 * dir + ',4l' + 4 * dir + ',4' : 'l' + -1 * dir + ',15') + 'q' + -9 * dir + ',4 ' + -18 * dir + ',1t' + -19 * dir + ',2Z';
    path(cloth, C.flag, { 'data-part': 'flag' });
    var accT = newAcc(); plant(G.trees, accT); paint(accT, 'trees');
    if (!cover2) { // grass tufts lie over with the wind; flowers in spring, fallen leaves in autumn
      var tf = '', tq = prng(91), dots = '';
      for (i = 0; i < 30; i++) { var tx2 = 860 + tq() * 740, ty = gy(tx2) + 6 + tq() * 20, k3 = lean * 22; if (tx2 > 1000 && tx2 < 1345 && ty < 306) continue; tf += 'M' + f(tx2) + ',' + f(ty) + 'l' + f(-2 + k3) + ',-7M' + f(tx2 + 3) + ',' + f(ty) + 'l' + f(1 + k3) + ',-9M' + f(tx2 + 6) + ',' + f(ty) + 'l' + f(3 + k3) + ',-6'; if (i % 2) dots += circ(tx2 + 11, ty - 1, 1.5); }
      line(tf, s.frost || s.snowCover ? C.rime : mix(C.near, C.meadow, 0.4), 1.3, { opacity: s.frost ? 0.4 : 0.9, 'data-part': 'grass' });
      if (s.season === 'spring' && !s.snowCover) path(dots, C.lit(PAL.c.flower), { 'data-part': 'flowers' });
      if (s.season === 'autumn' && !s.snowCover) path(dots, C.lit(PAL.c.leaf), { 'data-part': 'fallen' });
    }
    path('M996,300q2,-8 9,-9q8,0 10,9Z M1334,296q2,-6 8,-6q6,1 7,6Z M1150,309q1,-4 6,-4q5,0 6,4Z M1060,307q1,-5 7,-5q6,1 7,5Z M1226,308q2,-6 8,-6q7,1 8,6Z M1244,309q1,-3 4,-3q4,0 5,3Z', cover2 ? mix(C.mid, C.snow, 0.4) : mix(C.far, C.dark, 0.25), { 'data-part': 'rocks' });
    if (cover2 && (s.sun >= 2 || s.frost >= 2)) { // sparkle
      var sp2 = '', pq2 = prng(95);
      for (i = 0; i < 8; i++) { var px = 900 + pq2() * 680, py = 296 + pq2() * 20; sp2 += 'M' + f(px) + ',' + f(py - 4) + 'l1,3l3,1l-3,1l-1,3l-1,-3l-3,-1l3,-1Z'; }
      path(sp2, '#ffffff', { 'data-part': 'sparkle' });
    }
    if (s.wet && !cover2) { // puddles: one per rain level
      var pn = Math.max(1, s.thunder >= 3 ? 3 : s.intensity);
      path(['M1462,304a26,4.5 0 1,0 52,0a26,4.5 0 1,0 -52,0Z', 'M1540,312a20,3.6 0 1,0 40,0a20,3.6 0 1,0 -40,0Z', 'M905,310a22,4 0 1,0 44,0a22,4 0 1,0 -44,0Z'].slice(0, pn).join(''), C.water, { opacity: 0.9, 'data-part': 'puddles' });
      line(['M1478,304a10,2 0 1,0 20,0', 'M1554,312a7,1.6 0 1,0 14,0', 'M918,310a8,1.8 0 1,0 16,0'].slice(0, pn).join(''), C.waterHi, 1.2, { opacity: 0.8 });
    }
    if (s.heat) line('M1010,250q14,-4 28,0t28,0M1120,256q14,-4 28,0t28,0M1400,244q14,-4 28,0t28,0M930,262q12,-3 24,0t24,0', PAL.c['heat-haze'], 1.4, { opacity: 0.7, 'data-part': 'shimmer' });
    close();
    if (s.fog >= 2) { open('fog'); add('rect', { x: 0, y: top, width: W, height: H - top, fill: PAL.c.fog, opacity: 0.22 }); fogBand(278, 22, 0.5, 860, 520); close(); }

    /* ---- bolts: more storm = more drawn bolts, each its own figure; they never flash. The glow at the cloud brightens once (class sc-glow) ---- */
    if (s.thunder) {
      add('circle', { cx: 1216, cy: 122, r: 52, fill: radial(PAL.c.bolt, 0.34, 0), class: 'sc-glow', 'data-part': 'glow' });
      open('event');
      G.bolts.slice(0, [0, 1, 2, 4][s.thunder]).forEach(function (b) {
        var d = ribbon(b.p, b.w, 0.7), core = pts(b.p);
        b.forks.forEach(function (fk) { d += ribbon(fk, b.w * 0.45, 0.4); });
        path(d, PAL.c.bolt, { opacity: b.op, 'stroke-linejoin': 'round', stroke: PAL.c.bolt, 'stroke-width': 0.6 });
        line(core, PAL.c['bolt-core'], Math.max(0.7, b.w * 0.3), { opacity: b.op });
      });
      close();
    }
    hook('event');

    /* ---- precipitation ---- */
    var showers = /howers/.test(s.cond) || s.thunder === 1, px0 = showers ? 1060 : -120, px1 = showers ? 1500 : W, slant = G.slant[s.wind] * dir;
    if (s.falling === 'rain') {
      var drizzle = /rizzle/.test(s.cond), lvl = s.thunder >= 3 ? 3 : s.intensity, cnt = Math.round((drizzle ? 60 : G.rain[lvl]) * (showers ? 0.45 : 1)), rq = prng(101), back = '', front = '', quiet = '', spl = '';
      var l0 = drizzle ? 6 : [0, 9, 13, 15][lvl], l1 = drizzle ? 4 : [0, 5, 8, 13][lvl];
      for (i = 0; i < cnt; i++) {
        var rx2 = px0 + rq() * (px1 - px0), ry = (showers ? 104 : 124) + rq() * 190, len = l0 + rq() * l1, seg = 'M' + f(rx2) + ',' + f(ry) + 'l' + f(len * slant) + ',' + f(len);
        if (rx2 < 880) { if (i % 2) quiet += seg; } else if (i % 3) front += seg; else back += seg;
      }
      var nSpl = drizzle ? 0 : [0, 0, 10, 26][lvl];
      for (i = 0; i < nSpl; i++) { var px2 = 900 + rq() * 690, py2 = px2 > 985 && px2 < 1345 ? 266 + rq() * 30 : yAt(G.ground, px2) + 2 + rq() * 20; spl += 'M' + f(px2 - 3.5) + ',' + f(py2 - 3) + 'l3.5,3l4,-3.6'; }
      out += '<g data-layer="precip" class="sc-fall" fill="none" stroke="' + PAL.c.rain + '" stroke-linecap="round">' +
        (quiet ? el('path', { d: quiet, 'stroke-width': 1.2, opacity: 0.22 }) : '') + el('path', { d: back, 'stroke-width': drizzle ? 0.9 : 1.1, opacity: 0.4 }) +
        el('path', { d: front, 'stroke-width': drizzle ? 1.1 : [0, 1.3, 1.6, 1.9][lvl], opacity: [0, 0.55, 0.65, 0.7][lvl] }) + (spl ? el('path', { d: spl, 'stroke-width': 1.2, opacity: 0.75, 'data-part': 'splash' }) : '') + '</g>';
      if (/reezing/.test(s.cond)) line(pts(G.ground), C.iceHi, 2.2, { opacity: 0.8, 'data-part': 'glaze' });
      if (s.cond === 'thunderHail') { var hd = '', hq = prng(105); for (i = 0; i < 40; i++) hd += circ(900 + hq() * 690, 130 + hq() * 180, 1.8 + hq() * 1.4); path(hd, PAL.c.hail, { stroke: PAL.c['hail-edge'], 'stroke-width': 0.6, 'data-layer': 'precip', 'data-part': 'hail' }); }
    }
    if (s.falling === 'snow') {
      var cs = Math.round(G.snow[s.intensity] * (showers ? 0.45 : 1)), nq = prng(103), a1 = '', a2 = '', a3 = '';
      for (i = 0; i < cs; i++) { var nx = px0 + nq() * (px1 - px0) + slant * 30, ny = top + nq() * (H - top), r3 = 1 + nq() * (s.intensity >= 3 ? 2.2 : 1.4), c1 = circ(nx, ny, r3); if (nx < 880) { if (i % 2) a3 += circ(nx, ny, r3 * 0.8); } else if (i % 3) a1 += c1; else a2 += circ(nx, ny, r3 * 0.7); }
      out += '<g data-layer="precip" class="sc-fall" fill="' + C.snow + '">' + (a3 ? el('path', { d: a3, opacity: 0.35 }) : '') + el('path', { d: a2, opacity: 0.6 }) + el('path', { d: a1, opacity: 0.95 }) + '</g>';
    }

    /* ---- wind: things in the air ---- */
    if (s.wind >= 2) {
      var lf = '', lq2 = prng(111), cntL = s.wind === 3 ? 16 : 8;
      open('wind');
      if (cover2) { // snow dust instead of leaves
        var dd = ''; for (i = 0; i < cntL / 2; i++) { var dx2 = 960 + lq2() * 560, dy2 = 240 + lq2() * 60; dd += 'M' + f(dx2) + ',' + f(dy2) + 'q' + f(dir * 30) + ',-7 ' + f(dir * 64) + ',-2q' + f(-dir * 30) + ',0 ' + f(-dir * 64) + ',2Z'; }
        path(dd, C.snow, { opacity: 0.7, 'data-part': 'dust' });
      } else {
        for (i = 0; i < cntL; i++) lf += '<path d="M-4,0q4,-3.5 8,0q-4,3.5 -8,0Z" transform="translate(' + f(980 + lq2() * 560) + ' ' + f(150 + lq2() * 110) + ') rotate(' + f(lq2() * 60 - 30) + ')"/>';
        out += '<g fill="' + C.lit(s.season === 'autumn' ? PAL.c.leaf : PAL.c['leaf-green']) + '" opacity="0.9" data-part="leaves">' + lf + '</g>';
      }
      line(dir > 0 ? 'M1040,214q40,-9 84,-2M1270,232q34,-8 70,-1M1108,246q26,-6 52,-1' : 'M1124,214q-40,-9 -84,-2M1340,232q-34,-8 -70,-1M1160,246q-26,-6 -52,-1', PAL.c.rain, 1.3, { opacity: 0.35, 'data-part': 'streaks' });
      close();
    }
    hook('front');
    return finish();

    function finish() {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + view.join(' ') + '" preserveAspectRatio="xMaxYMax slice" width="100%" height="100%" aria-hidden="true" focusable="false" data-sky="' + key + '">' +
        '<defs>' + defs + '</defs>' + out + '</svg>';
    }
  }
  function count(s) { return (s.match(/<(path|rect|circle|ellipse|g|stop|linearGradient|radialGradient|mask)\b/g) || []).length; }
  /* the phone crop: scale k, stage height in px; the body at G.phoneBodyX */
  function phoneOpts(stagePx, widthPx, bodyY) {
    var k = 0.56;
    return { view: [Math.round(W - widthPx / k), Math.round(H - stagePx / k), Math.round(widthPx / k), Math.round(stagePx / k)], bodyAt: [G.phoneBodyX, bodyY == null ? 98 : bodyY], quietX: 700 };
  }
  var presets = { // the three scenes of the stop
    frost: { phase: 'night', cond: 'overcast', frost: 1, season: 'winter', moon: { illum: 0.95, waxing: false } },
    storm: { phase: 'day', cond: 'thunder', thunder: 3, intensity: 3, wind: 2, season: 'summer' },
    winter: { phase: 'day', cond: 'clear', snowCover: 2, frost: 1, season: 'winter' },
  };
  window.Scene = { svg: svg, state: state, ink: ink, skyKey: skyKey, bodyMode: function (s) { return bodyMode(state(s)); }, count: count, phoneOpts: phoneOpts, presets: presets, G: G, hooks: {}, util: { prng: prng, mix: mix, circ: circ, pts: pts, el: el, f: f, blob: blob } };
})();
