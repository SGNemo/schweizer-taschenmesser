/* Weather scene (mockup, docs/design/weather-scenes, spec SCENE-SPEC v1). Classic script, no dependencies, works from
   file://. window.Scene = { svg, porthole, moonGlyph, presets, state, ink, skyKey,
   moonPath, G }. Pure: same state, same string; all
   randomness from mulberry32(seed). Colours come only from palette.js (window.ScenePalette); every fill passes X.c()
   so the "Ruhig" grey conversion is one place. Geometry is the G block below: change numbers there, not in the code. */
(function () {
  'use strict';
  var PAL = window.ScenePalette;

  /* ============================== GEOMETRY (scene units, viewBox 0 0 1600 320) ============================== */
  var G = {
    W: 1600, H: 320,
    shelterX: 900, // nothing with hard contrast left of this (text lies there)
    titleY: 60, // nothing but sky and stars above this (title row)
    arc: { x0: 1180, dx: 320, y0: 236, dy: 132 }, // x(t) = x0 + dx·t, y(t) = y0 − dy·sin(πt)
    sun: { r: 46, rHeat: 52, core: 0.62, halo: 2.6, haloOp: 0.35, low: 0.12 },
    moon: { r: 42, halo: 2.4, haloOp: 0.25, ring: 1.9, ringOp: 0.18, earthshine: 0.35, darkOp: 0.5 },
    dayMoon: { x: 1240, y: 120, r: 22, op: 0.55 },
    peek: 0.35, // a body that would sink behind the far ridge is lifted so its centre stays peek·r below the crest
    ridges: {
      mountains: {
        // farthest, pale alpine range: 5 summits (the highest moved right of the arc, see alpPeaks)
        alp: [[0, 248], [480, 240], [640, 226], [712, 204], [760, 190], [800, 200], [860, 198], [915, 178], [960, 165],
          [995, 176], [1035, 158], [1062, 136], [1085, 128], [1110, 140], [1160, 170], [1230, 186], [1310, 190], [1380, 182],
          [1440, 160], [1468, 145], [1490, 140], [1512, 146], [1530, 142], [1552, 114], [1575, 100], [1592, 104], [1600, 108]],
        far: [[0, 262], [300, 255], [600, 246], [800, 238], [960, 232], [1080, 224], [1150, 208], [1205, 178], [1240, 158],
          [1270, 150], [1300, 157], [1340, 180], [1390, 204], [1425, 200], [1455, 180], [1480, 170], [1505, 177], [1550, 198], [1600, 210]],
        mid: [[0, 282], [220, 277], [440, 275], [640, 268], [860, 262], [1040, 251], [1180, 244], [1300, 236], [1420, 241],
          [1520, 231], [1600, 228]],
        near: [[0, 304], [500, 301], [900, 296], [1050, 290], [1200, 277], [1320, 266], [1420, 262], [1510, 268], [1600, 276]],
      },
      village: {
        far: [[0, 262], [400, 252], [800, 240], [1060, 222], [1260, 206], [1420, 204], [1600, 214]],
        mid: [[0, 284], [420, 276], [800, 268], [1060, 256], [1220, 242], [1340, 236], [1460, 240], [1600, 250]],
        near: [[0, 304], [500, 301], [900, 296], [1100, 288], [1260, 276], [1420, 270], [1600, 280]],
      },
    },
    alpPeaks: [[760, 190], [960, 165], [1085, 128], [1490, 140], [1575, 100]], // summits: x, y
    farPeaks: [[1270, 150], [1480, 170]],
    alpFade: [560, 820], // the alpine range fades into the haze left of here
    flank: { max: 260, lean: 10, depth: 0.9, dark: 0.06 }, // shaded flank away from the body: walk to the valley, lean, band depth (× summit height), darkening
    capDepth: { high: 22, low: 15, far: 20, highY: 130 }, // snow caps: depth under the summit; "high" summits y ≤ highY
    lake: { x0: 930, x1: 1260, y0: 268, y1: 284, sky: 0.85 },
    bushes: [[1062, 7], [1236, 6], [1298, 8], [1452, 6], [1578, 9]], // x, r on the near ridge
    crestBand: { h: 11, lift: 0.1 }, // lighter band along the near crest
    conifers: { n: 34, from: 620, hMin: 14, hMax: 26, left: 6, leftFrom: 150, leftH: [8, 11], topMin: 250, w: 0.62 },
    crowns: [[1120, 14], [1176, 18], [1530, 24]], // deciduous trees on the near ridge: x, crown r
    grass: { n: 9, from: 1110, to: 1590 },
    village: {
      church: 1322, houses: [[1238, 18], [1260, 16], [1284, 20], [1356, 18], [1380, 22], [1405, 16], [1428, 20]],
      rows: [[1150, 1222, 6], [1452, 1530, 5]], path: 'M1238,322 C1300,306 1236,296 1290,286 S1350,276 1338,268',
    },
    stars: { n: 60, many: 150, yMin: 8, yMax: 200, rMin: 0.8, rMax: 1.8, sparkles: 6, sparkR: 4, few: 0.35 },
    milky: { cx: 1180, cy: 112, rx: 560, ry: 46, rot: -14, op: 0.12, n: 60 },
    // cloud templates: w×h box, flat-bottomed pill [x, y, w, h], circles [cx, cy, r]; top at y 0, flat base at y h
    tpl: {
      s: { w: 120, h: 40, pill: [12, 24, 102, 16], c: [[24, 28, 12], [52, 20, 20], [86, 24, 15], [104, 30, 10]] },
      m: { w: 190, h: 62, pill: [14, 36, 166, 26], c: [[34, 42, 20], [78, 30, 28], [124, 26, 26], [160, 42, 20]] },
      l: { w: 280, h: 84, pill: [18, 50, 250, 34], c: [[44, 58, 26], [100, 42, 36], [164, 34, 34], [222, 52, 30], [250, 66, 18]] },
    },
    shadeAt: 0.66, // the lower third of a cloud is cloud-shade
    deck: { y: 104, arcs: [90, 150], depth: [9, 17] },
    stretch: 1.25, // clouds at wind ≥ 2
    // precipitation; leftOp = the part left of x 1000 (was .3, .2 after the contrast measurement)
    precip: { top: 60, mask: [900, 1050], leftOp: 0.2, rain: [45, 80, 120], snow: [60, 100, 150], drizzle: 50, hail: 40,
      slant: [10, 10, 28, 42], showers: [1150, 1500], curtain: [1400, 1600, 34], len: 18, width: 2, op: 0.75, hailFrom: 1000,
      mass: [1130, 74, 1.35] }, // rain: one cloud mass x, y, scale
    fog: [[1040, 560, 192, 18, 'far'], [640, 700, 226, 22, 'far'], [240, 620, 262, 24, 'near'], [940, 660, 252, 26, 'near'],
      [1260, 380, 234, 16, 'near']], // x, width, y, height, in front of which ridge
    rainbow: { cx: 1180, cy: 330, r: 196, w: 5, op: 0.7, fade: [214, 274] },
    bolt: [[1296, 190], [1316, 190], [1305, 222], [1321, 222], [1288, 280], [1298, 236], [1283, 236]],
    skew: [0, 6, 12, 20], // trees lean with the wind (degrees, by wind 0..3)
    shelter: { x1: 1300, op: 0.75, y0: 196, y1: 252 }, // widened after the contrast measurement (was x1 1120, op .62) // haze wash over the low ridges left, where the text lies
    // aurora curtains: x0, x1, base y, height share, wave phase; top = base − h(amount); only the first `few` at amount < .6
    aurora: { bands: [[985, 1290, 198, 1, 0], [1100, 1490, 190, 0.85, 1.7], [1310, 1630, 200, 0.7, 3.1], [1020, 1210, 206, 0.5, 4.4]], few: 2,
      h: 128, top: 70, op: [0.2, 0.3], glow: [1260, 206, 520, 90] },
    meteors: [[1214, 76, 108], [1430, 116, 72], [1010, 66, 62]], // head x, y, tail length (up and to the right)
    motion: { drift: 16, rain: 2.4, rainHeavy: 1.6, snow: [10, 15], total: 12, fog: 20 },
    windStrokes: [[1150, 156, 190], [1238, 188, 210], [1330, 132, 170]], // start x, y, length
  };

  /* ============================== utilities ============================== */
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function f(n) { return Math.round(n * 10) / 10; }
  function rgb(h) { h = h.slice(1); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function hex(c) {
    return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function unlin(v) { return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }
  function greyOf(h) { var c = rgb(h); var g = unlin(0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])); return hex([g, g, g]); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); }
  function attrs(o) {
    var s = '';
    for (var k in o) if (o[k] != null && o[k] !== false) s += ' ' + k + '="' + (typeof o[k] === 'number' ? f(o[k]) : o[k]) + '"';
    return s;
  }
  function el(tag, o, inner) { return '<' + tag + attrs(o) + (inner == null ? '/>' : '>' + inner + '</' + tag + '>'); }
  function circ(x, y, r) { return 'M' + f(x - r) + ',' + f(y) + 'a' + f(r) + ',' + f(r) + ' 0 1,1 ' + f(2 * r) + ',0a' + f(r) + ',' + f(r) + ' 0 1,1 ' + f(-2 * r) + ',0'; }
  function rrect(x, y, w, h, r) {
    return 'M' + f(x + r) + ',' + f(y) + 'h' + f(w - 2 * r) + 'a' + f(r) + ',' + f(r) + ' 0 0 1 ' + f(r) + ',' + f(r) + 'v' + f(h - 2 * r) +
      'a' + f(r) + ',' + f(r) + ' 0 0 1 ' + f(-r) + ',' + f(r) + 'h' + f(2 * r - w) + 'a' + f(r) + ',' + f(r) + ' 0 0 1 ' + f(-r) + ',' + f(-r) +
      'v' + f(2 * r - h) + 'a' + f(r) + ',' + f(r) + ' 0 0 1 ' + f(r) + ',' + f(-r) + 'z';
  }

  /* Smooth ridge through key points: cubic Hermite with Catmull-Rom tangents, written as exact Bézier segments. */
  function spline(keys) {
    var n = keys.length, m = [];
    for (var i = 0; i < n; i++) {
      var a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)];
      m.push((b[1] - a[1]) / (b[0] - a[0]));
    }
    function y(x) {
      for (var i = 0; i < n - 1; i++) if (x <= keys[i + 1][0] || i === n - 2) {
        var h = keys[i + 1][0] - keys[i][0], t = Math.max(0, Math.min(1, (x - keys[i][0]) / h)), t2 = t * t, t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * keys[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * keys[i + 1][1] + (t3 - t2) * h * m[i + 1];
      }
    }
    var d = 'M' + keys[0][0] + ',' + keys[0][1];
    for (var j = 0; j < n - 1; j++) {
      var h = keys[j + 1][0] - keys[j][0];
      d += 'C' + f(keys[j][0] + h / 3) + ',' + f(keys[j][1] + (m[j] * h) / 3) + ' ' + f(keys[j + 1][0] - h / 3) + ',' +
        f(keys[j + 1][1] - (m[j + 1] * h) / 3) + ' ' + keys[j + 1][0] + ',' + keys[j + 1][1];
    }
    return { y: y, crest: d, fill: d + 'V' + G.H + 'H0Z' };
  }

  /* ============================== state ============================== */
  var CLOUD_DEFAULT = { clear: 5, mostlyClear: 25, partly: 50, overcast: 95, fog: 0, drizzle: 90, freezingDrizzle: 90, rain: 95,
    freezingRain: 95, showers: 60, snow: 95, snowShowers: 60, thunder: 92, thunderHail: 92 };
  function state(s) {
    s = s || {};
    var o = {
      phase: 'day', theme: 'light', cond: 'clear', intensity: 2, wind: 0, frost: 0, heat: false, snowGround: false,
      season: 'summer', dayMoon: false, event: null, eventAmount: 0.5, landscape: 'mountains', calm: false, level: 'full',
      motion: false, seed: 7,
    };
    for (var k in s) if (s[k] !== undefined && k !== 'body' && k !== 'moon') o[k] = s[k];
    if (o.cloud == null) o.cloud = CLOUD_DEFAULT[o.cond] != null ? CLOUD_DEFAULT[o.cond] : 0;
    var night = o.phase === 'night';
    var dk = o.phase === 'dawn' || o.phase === 'dusk';
    o.body = Object.assign({ kind: night ? 'moon' : dk ? 'none' : 'sun', t: o.phase === 'golden' ? 0.08 : night ? 0.62 : 0.5 }, s.body || {});
    o.moon = Object.assign({ illum: 0.6, waxing: true, tilt: 0, size: 1 }, s.moon || {});
    if (/snow/i.test(o.cond) && s.snowGround === undefined) o.snowGround = true;
    return o;
  }
  var PRECIP = { drizzle: 1, freezingDrizzle: 1, rain: 1, freezingRain: 1, showers: 1, snow: 1, snowShowers: 1, thunder: 1, thunderHail: 1 };
  var OPEN = { clear: 1, mostlyClear: 1, partly: 1 };
  /* Which sky (§7 "Which sky"): returns { key, glow: { colour, strength } | null }. */
  function skyOf(s) {
    var c = s.cond, wet = PRECIP[c], deck = s.cloud > 85 && c !== 'fog';
    var ev = s.event;
    if (ev === 'solarTotal') return { key: 'eclipse-sky' };
    if (ev === 'dust') return { key: 'dust' };
    function nightKey() {
      if (c === 'fog') return 'night-fog';
      if (/snow/i.test(c)) return 'night-snow';
      if (c === 'rain' || c === 'freezingRain' || c === 'showers' || /thunder/.test(c)) return 'night-rain';
      if (c === 'overcast' || /rizzle/.test(c) || deck) return 'night-overcast';
      return s.moon.size >= 1.2 && s.body.kind === 'moon' ? 'night-full' : 'night';
    }
    function dayKey() {
      if (c === 'fog') return 'fog';
      if (/snow/i.test(c)) return 'snow';
      if (/thunder/.test(c)) return 'storm';
      if (c === 'rain' || c === 'freezingRain') return 'rain';
      if (/rizzle/.test(c) || c === 'showers') return 'drizzle';
      if (c === 'overcast' || deck) return 'overcast';
      return s.heat ? 'heat' : 'day';
    }
    var p = s.phase, open = OPEN[c] && !deck && !wet;
    if (p === 'night') return { key: nightKey() };
    if (p === 'day') return { key: dayKey() };
    if (open) return { key: p, glow: { colour: PAL.glow[p], strength: 1 } };
    var g = { colour: PAL.glow[p], strength: 0.4 };
    return { key: p === 'golden' ? dayKey() : nightKey(), glow: g };
  }
  function ink(s) {
    s = state(s);
    if (s.calm) return s.theme === 'dark' ? 'light' : 'dark';
    var k = skyOf(s).key, i = PAL.inkOf[k];
    return i && i[s.theme === 'dark' ? 1 : 0] === 'D' ? 'dark' : 'light';
  }

  /* ============================== context: colours, defs ============================== */
  function context(s, idSeed) {
    var surface = PAL.surface[s.theme === 'dark' ? 'dark' : 'light'];
    var X = { s: s, defs: [], id: 'sc' + hash(idSeed), n: 0, ext: 0 };
    X.c = function (h) {
      if (PAL.c[h]) h = PAL.c[h];
      return s.calm ? mix(greyOf(h), surface, s.theme === 'dark' ? 0.45 : 0.6) : h;
    };
    X.uid = function (p) { return X.id + p + X.n++; };
    X.grad = function (stops, o) { // stops: [offset, colour, opacity?]; o: attributes (x1..y2 or cx/cy/r…), o.radial
      var id = X.uid('g'), tag = o.radial ? 'radialGradient' : 'linearGradient';
      delete o.radial;
      o.id = id;
      X.defs.push(el(tag, o, stops.map(function (st) {
        return el('stop', { offset: st[0], 'stop-color': X.c(st[1]), 'stop-opacity': st[2] == null ? null : st[2] });
      }).join('')));
      return 'url(#' + id + ')';
    };
    X.clip = function (inner) { var id = X.uid('c'); X.defs.push(el('clipPath', { id: id }, inner)); return 'url(#' + id + ')'; };
    X.mask = function (inner) { var id = X.uid('m'); X.defs.push(el('mask', { id: id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: G.W, height: G.H }, inner)); return 'url(#' + id + ')'; };
    return X;
  }
  function skyStops(X, sky) {
    var st = PAL.sky[sky.key][X.s.theme === 'dark' ? 'dark' : 'light'];
    var dim = (X.s.event === 'solarPartial' && X.s.eventAmount > 0.6) ? 0.3 : 0;
    return st.map(function (p) { return [p[0], dim ? mix(p[1], PAL.c['dim-target'], dim) : p[1]]; });
  }
  function skyAt(stops, y) { // colour of the sky gradient at a height (for atmospheric perspective)
    var t = y / G.H;
    for (var i = 0; i < stops.length - 1; i++) if (t <= stops[i + 1][0]) return mix(stops[i][1], stops[i + 1][1], (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]));
    return stops[stops.length - 1][1];
  }

  /* ============================== layers ============================== */
  function layer(name, inner, extra) { return inner ? '<g data-layer="' + name + '"' + attrs(extra || {}) + '>' + inner + '</g>' : ''; }

  function skyLayer(X, sky, stops, bodyPos) {
    var t0 = -X.ext; // extra sky above y 0 (opts.extendTop)
    X.skyFill = X.grad(stops.map(function (p) { return [p[0], p[1]]; }), { x1: 0, y1: t0, x2: 0, y2: G.H, gradientUnits: 'userSpaceOnUse' });
    var out = el('rect', { y: t0, width: G.W, height: G.H - t0, fill: X.skyFill });
    if (sky.glow) {
      var gx = X.s.phase === 'dawn' ? 1210 : X.s.phase === 'dusk' ? 1480 : bodyPos ? bodyPos[0] : 1300;
      var gl = X.grad([[0, sky.glow.colour, 0.75 * sky.glow.strength], [0.5, sky.glow.colour, 0.28 * sky.glow.strength], [1, sky.glow.colour, 0]],
        { radial: true, cx: gx, cy: 250, r: 560, gradientUnits: 'userSpaceOnUse', gradientTransform: 'translate(' + gx + ' 250) scale(1 0.34) translate(' + -gx + ' -250)' });
      out += el('rect', { width: G.W, height: G.H, fill: gl });
    }
    if (X.s.event === 'solarTotal') {
      out += el('rect', { y: 170, width: G.W, height: 100, fill: X.grad([[0, PAL.glow['eclipse-sky'], 0], [0.6, PAL.glow['eclipse-sky'], 0.35], [1, PAL.glow['eclipse-sky'], 0]], { x1: 0, y1: 0, x2: 0, y2: 1 }) });
    }
    return out;
  }

  function starsLayer(X) {
    var s = X.s, S = G.stars, ev = s.event, p = s.phase;
    var on = p === 'night' || p === 'dawn' || p === 'dusk' || ev === 'solarTotal' || ev === 'starNight';
    if (!on) return '';
    var many = ev === 'starNight' || ev === 'lunarTotal';
    var total = many ? S.many : S.n;
    var k = (1 - s.cloud / 100) * (p === 'dawn' || p === 'dusk' ? S.few : 1);
    if (s.body.kind === 'moon' && !many && ev !== 'lunarPartial') k *= 1 - 0.6 * s.moon.illum;
    if (s.cond === 'fog') k *= 0.3;
    var n = Math.round(total * k), r = prng(s.seed * 13 + 1), dots = ['', '', ''], sp = '';
    for (var i = 0; i < total; i++) {
      var x = r() * G.W, y = S.yMin + r() * (S.yMax - S.yMin), rr = S.rMin + r() * (S.rMax - S.rMin), b = r();
      if (i >= n || (X.bp && Math.hypot(x - X.bp[0], y - X.bp[1]) < X.br * 1.15)) continue;
      var qx = X.quiet || 760;
      if (x < qx && y > (X.quiet ? -X.ext : 64) && (b < 0.85 || x < qx - 200)) continue; // hardly any stars behind the text
      if (x < qx) b = 0;
      if (i < S.sparkles && x > 700) {
        var q = S.sparkR, w = q * 0.22;
        sp += 'M' + f(x) + ',' + f(y - q) + 'Q' + f(x + w) + ',' + f(y - w) + ' ' + f(x + q) + ',' + f(y) + 'Q' + f(x + w) + ',' + f(y + w) + ' ' + f(x) + ',' + f(y + q) +
          'Q' + f(x - w) + ',' + f(y + w) + ' ' + f(x - q) + ',' + f(y) + 'Q' + f(x - w) + ',' + f(y - w) + ' ' + f(x) + ',' + f(y - q) + 'Z';
      } else dots[b < 0.4 ? 0 : b < 0.8 ? 1 : 2] += circ(x, y, rr);
    }
    var star = X.c('star'), out = '';
    [0.45, 0.7, 0.95].forEach(function (o, i) { if (dots[i]) out += el('path', { d: dots[i], fill: star, opacity: o }); });
    if (sp) out += el('path', { d: sp, fill: star, opacity: 0.9 });
    if (ev === 'starNight') {
      var M = G.milky, mw = X.grad([[0, '#ffffff', 1], [1, '#ffffff', 0]], { radial: true });
      out += el('ellipse', { cx: M.cx, cy: M.cy, rx: M.rx, ry: M.ry, fill: mw, opacity: M.op, transform: 'rotate(' + M.rot + ' ' + M.cx + ' ' + M.cy + ')' });
      var md = '', rot = (M.rot * Math.PI) / 180;
      for (var j = 0; j < M.n; j++) {
        var u = (r() * 2 - 1) * M.rx * 0.9, v = (r() + r() - 1) * M.ry * 0.7;
        md += circ(M.cx + u * Math.cos(rot) - v * Math.sin(rot), M.cy + u * Math.sin(rot) + v * Math.cos(rot), 0.4 + r() * 0.5);
      }
      out += el('path', { d: md, fill: star, opacity: 0.8 });
    }
    return out;
  }

  /* --- moon (shared by scene, porthole and glyph) --- */
  function litPath(r, illum) { // waxing shape (lit on the right), centre 0,0; null for a new moon
    if (illum < 0.02) return null;
    if (illum > 0.98) return circ(0, 0, r);
    var rx = r * Math.abs(1 - 2 * illum);
    return 'M0,' + f(-r) + 'A' + f(r) + ',' + f(r) + ' 0 0 1 0,' + f(r) + 'A' + f(rx) + ',' + f(r) + ' 0 0 ' + (illum < 0.5 ? 0 : 1) + ' 0,' + f(-r) + 'Z';
  }
  var MARIA = [[-0.3, -0.3, 0.33, 0.25, -22], [0.22, -0.1, 0.21, 0.17, 12], [-0.1, 0.22, 0.2, 0.14, 0], [0.36, 0.38, 0.15, 0.11, 30]];
  function moonBody(X, cx, cy, r, m, o) { // o: { glow, eclipse, darkFill, maria }
    var s = X.s, ev = o.eclipse, illum = ev ? 1 : m.illum, out = '';
    var flip = m.waxing ? '' : ' scale(-1 1)';
    var lit = litPath(r, illum);
    // dark side: earthshine when thin, else the sky's own colour (it hides the stars behind the moon)
    if (!ev && lit && illum < G.moon.earthshine) out += el('circle', { r: r, fill: o.darkFill ? mix(X.c('moon-dark'), o.darkFill, 0.15) : X.c('moon-dark'), opacity: o.darkFill ? 0.85 : G.moon.darkOp });
    if (!lit) out += el('circle', { r: r - 0.75, fill: 'none', stroke: X.c('moon-dark'), 'stroke-width': 1.5, opacity: 0.9 });
    if (o.glow && lit && ev !== 'lunarTotal') {
      var gop = G.moon.haloOp * illum * (m.size >= 1.2 ? 1.25 : 1);
      // glow centred a little toward the lit side, so the unlit part of the disc shows no ring of its own
      var gg = X.grad([[0, 'moon', 0.8], [0.4, 'moon', 0.9], [1, 'moon', 0]], { radial: true }), gx = (m.waxing ? 1 : -1) * r * (1 - illum) * 0.9;
      out += el('circle', { cx: gx, r: r * G.moon.halo, fill: gg, opacity: f(gop * 100) / 100 });
      if (m.size >= 1.2) out += el('circle', { r: r * G.moon.ring, fill: 'none', stroke: X.c('moon'), 'stroke-width': 1.2, opacity: G.moon.ringOp });
    }
    if (ev === 'lunarTotal') {
      out += el('circle', { r: r, fill: X.grad([[0, 'eclipse-red'], [0.7, 'eclipse-red'], [1, 'eclipse-red-dark']], { radial: true }) });
      return '<g transform="translate(' + f(cx) + ' ' + f(cy) + ')">' + out + '</g>';
    }
    if (lit) {
      out += el('path', { d: lit, fill: X.c('moon'), transform: flip ? 'scale(-1 1)' : null });
      if (o.maria !== false && r >= 8) {
        var cp = X.clip(el('path', { d: lit, transform: flip ? 'scale(-1 1)' : null }));
        var md = MARIA.map(function (q) {
          return el('ellipse', { cx: q[0] * r, cy: q[1] * r, rx: q[2] * r, ry: q[3] * r, transform: 'rotate(' + q[4] + ' ' + f(q[0] * r) + ' ' + f(q[1] * r) + ')' });
        }).join('');
        out += el('g', { 'clip-path': cp, fill: X.c('moon-mare'), opacity: m.size >= 1.2 ? 0.95 : 0.75 }, md);
      }
      if (ev === 'lunarPartial') {
        var ru = r * 2.6, d = ru + r - X.s.eventAmount * 2 * r, k = Math.SQRT1_2;
        out += el('circle', { cx: -d * k, cy: d * k, r: ru, fill: X.c('eclipse-umbra'), opacity: 0.85, 'clip-path': X.clip(circ(0, 0, r).replace(/^/, '') && el('circle', { r: r })) });
      }
    }
    return '<g transform="translate(' + f(cx) + ' ' + f(cy) + ') rotate(' + (m.tilt || 0) + ')">' + out + '</g>';
  }

  function sunBody(X, x, y, r, sky) {
    var s = X.s, ev = s.event, low = s.body.t < G.sun.low || s.body.t > 1 - G.sun.low, out = '';
    var ring = X.c(low ? 'sun-low' : 'sun'), core = low ? mix(X.c('sun-core'), X.c('sun-low'), 0.3) : X.c('sun-core');
    if (s.cond === 'fog' || ev === 'dust') {
      return el('circle', { cx: x, cy: y, r: r, fill: ev === 'dust' ? X.c('dust-sun') : mix(X.c('sun-core'), X.c(sky.bottom), 0.35), opacity: 0.78 });
    }
    if (ev === 'solarTotal') {
      var cg = X.grad([[0, '#ffffff', 0.85], [0.36, '#ffffff', 0.45], [1, '#ffffff', 0]], { radial: true }), petals = '';
      for (var i = 0; i < 6; i++) {
        var a = i * 60 + 18 + (i % 2) * 9, L = r * (i % 2 ? 1.55 : 1.85), w = r * 0.55; // soft, rounded petals
        petals += 'M0,' + f(-w) + 'C' + f(L * 0.6) + ',' + f(-w) + ' ' + f(L) + ',' + f(-w * 0.25) + ' ' + f(L) + ',0C' + f(L) + ',' + f(w * 0.25) + ' ' + f(L * 0.6) + ',' + f(w) + ' 0,' + f(w) + 'Z';
        out += el('path', { d: petals, transform: 'rotate(' + a + ')', fill: '#ffffff', opacity: 0.42 });
        petals = '';
      }
      out = el('circle', { r: r * 2.8 * (X.haloK || 1), fill: cg }) + out + el('circle', { r: r, fill: X.c('eclipse-disc') });
      return '<g transform="translate(' + f(x) + ' ' + f(y) + ')">' + out.replace(/fill="#ffffff"/g, 'fill="' + X.c('#ffffff') + '"') + '</g>';
    }
    var amt = ev === 'solarPartial' ? s.eventAmount : ev === 'solarAnnular' ? 0.85 : 0;
    var hg = X.grad([[0, low ? 'sun-low' : 'sun', 0.9], [0.4, low ? 'sun-low' : 'sun', 0.45], [1, low ? 'sun-low' : 'sun', 0]], { radial: true });
    out += el('circle', { cx: x, cy: y, r: r * G.sun.halo * (X.haloK || 1), fill: hg, opacity: f(G.sun.haloOp * (1 - amt * 0.7) * (s.dayMoon ? 0.8 : 1) * 100) / 100 });
    out += el('circle', { cx: x, cy: y, r: r, fill: ring });
    if (ev !== 'solarAnnular') out += el('circle', { cx: x, cy: y, r: r * G.sun.core, fill: core });
    if (ev === 'solarPartial') {
      var d = 2 * r * (1 - s.eventAmount), k = Math.SQRT1_2;
      out += el('circle', { cx: x + d * k, cy: y - d * k, r: r + 0.5, fill: X.skyFill });
    }
    if (ev === 'solarAnnular') out += el('circle', { cx: x, cy: y, r: r * 0.93, fill: X.c('eclipse-disc') });
    return out;
  }

  /* --- clouds --- */
  function cloudPath(t) {
    var T = G.tpl[t], p = T.pill, d = rrect(p[0], p[1], p[2], p[3], p[3] / 2);
    T.c.forEach(function (c) { d += circ(c[0], c[1], c[2]); });
    return d;
  }
  function cloudTone(X) {
    var s = X.s, c = s.cond, dark = s.theme === 'dark', p = s.phase, i = s.intensity;
    var nightish = p === 'night' || p === 'dawn' || p === 'dusk' || s.event === 'solarTotal';
    var b, sh;
    if (nightish) {
      b = X.c('cloud-night'); sh = X.c('cloud-night-shade');
      if (PRECIP[c] && !/snow/i.test(c)) { b = mix(b, X.c('cloud-storm'), 0.35); sh = mix(sh, X.c('cloud-storm-shade'), 0.4); }
      if (PAL.glow[p]) b = mix(b, X.c(PAL.glow[p]), 0.18);
    } else if (/thunder/.test(c)) { b = X.c('cloud-storm'); sh = X.c('cloud-storm-shade'); }
    else if (c === 'rain' || c === 'freezingRain') {
      var k = i === 3 ? 0.55 : i === 1 ? -0.3 : 0;
      b = k >= 0 ? mix(X.c('cloud-rain'), X.c('cloud-storm'), k) : mix(X.c('cloud-rain'), X.c('cloud'), -k);
      sh = k >= 0 ? mix(X.c('cloud-rain-shade'), X.c('cloud-storm-shade'), k) : mix(X.c('cloud-rain-shade'), X.c('cloud-shade'), -k);
    } else if (/rizzle/.test(c) || c === 'showers') { b = mix(X.c('cloud-rain'), X.c('cloud'), 0.35); sh = mix(X.c('cloud-rain-shade'), X.c('cloud-shade'), 0.3); }
    else if (/snow/i.test(c)) { b = mix(X.c('cloud-rain'), X.c('cloud'), 0.55); sh = mix(X.c('cloud-rain-shade'), X.c('cloud-shade'), 0.5); }
    else if (c === 'overcast') { b = mix(X.c('cloud-shade'), X.c('cloud-rain'), 0.25); sh = mix(X.c('cloud-shade'), X.c('cloud-rain'), 0.5); }
    else { b = X.c('cloud'); sh = X.c('cloud-shade'); }
    if (p === 'golden' && !PRECIP[c]) { b = mix(b, X.c(PAL.glow.golden), 0.22); sh = mix(sh, X.c('#e2b7a0'), 0.3); }
    // clouds are opaque (a sun behind one must not show through); the spec's .92 / dark .5 become a pre-mix with the sky
    var sk = X.c(X.skyMid || '#88a0b8');
    if (dark && !nightish) { b = mix(b, sk, 0.5); sh = mix(sh, sk, 0.5); } else if (!nightish) { b = mix(b, sk, 0.08); sh = mix(sh, sk, 0.08); }
    var op = 1;
    var rim = nightish && s.body.kind === 'moon' && s.moon.illum > 0.3 ? mix(b, X.c('moon'), 0.32) : null;
    return { b: b, sh: sh, op: op, rim: rim };
  }
  function cloud(X, tone, t, x, y, sc, cls) {
    var s = X.s, T = G.tpl[t], d = cloudPath(t), out = '';
    if (X.quiet && x < X.quiet) { x = X.quiet + (x - G.shelterX) * 0.25; sc *= 0.7; y += 8; } // small crops: clouds out of the text
    var sx = sc * (s.wind >= 2 ? G.stretch : 1);
    if (X.clearBody && X.bodyP) { // cover ≤ 35: no cloud touches the body's disc + 0.4·r (right of it, else below, else left)
      var B = X.bodyP, rr = X.br * 1.4 + 4, w = T.w * sx, h = T.h * sc;
      var hit = function (cx, cy) { var nx = Math.max(cx, Math.min(B[0], cx + w)), ny = Math.max(cy, Math.min(B[1], cy + h)); return Math.hypot(nx - B[0], ny - B[1]) < rr; };
      if (hit(x, y)) {
        if (B[0] + rr + w <= G.W + 30 && !hit(B[0] + rr, y)) x = B[0] + rr;
        else if (!hit(x, B[1] + rr) && B[1] + rr + h < 200) y = B[1] + rr;
        else x = B[0] - rr - w;
      }
    }
    var fill = X.grad([[0, tone.b], [G.shadeAt, tone.b], [G.shadeAt, tone.sh], [1, tone.sh]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    if (tone.rim) out += el('path', { d: d, fill: tone.rim, transform: 'translate(0 ' + f(-2 / sc) + ')' });
    out += el('path', { d: d, fill: fill });
    var g = el('g', { transform: 'translate(' + f(x) + ' ' + f(y) + ') scale(' + f(sx * 100) / 100 + ' ' + sc + ')', opacity: tone.op }, out);
    if (s.wind >= 2) {
      var by = y + T.h * sc;
      g += el('path', { d: 'M' + f(x - 14) + ',' + f(by - 8 * sc) + 'h' + f(-70 * sc) + 'M' + f(x - 34) + ',' + f(by - 22 * sc) + 'h' + f(-46 * sc),
        stroke: tone.b, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: f(tone.op * 55) / 100 });
    }
    return s.motion ? el('g', { class: cls || 'sc-drift' }, g) : g;
  }
  function deck(X, tone, sky) {
    var s = X.s, r = prng(s.seed * 7 + 3), D = G.deck, x = G.W, d = 'M0,' + -X.ext + 'H' + G.W + 'V' + D.y;
    while (x > 0) {
      var w = D.arcs[0] + r() * (D.arcs[1] - D.arcs[0]), dep = D.depth[0] + r() * (D.depth[1] - D.depth[0]);
      var nx = Math.max(0, x - w), yy = D.y + (r() - 0.5) * 8;
      d += 'Q' + f((x + nx) / 2) + ',' + f(yy + dep * 2) + ' ' + f(nx) + ',' + f(yy);
      x = nx;
    }
    d += 'Z';
    var top = mix(tone.b, X.c(sky.top), 0.45);
    var g = X.grad([[0, top], [0.7, tone.b], [1, tone.sh]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    return el('path', { d: d, fill: g, opacity: X.s.theme === 'dark' && !/night|dawn|dusk/.test(X.s.phase) ? 0.5 : 1 }); // dark theme: a quieter deck (contrast)
  }
  function cloudLayers(X, bp, sky) {
    var s = X.s, c = s.cond, cov = s.cloud, tone = cloudTone(X), far = '', main = '';
    if (c === 'fog' || s.event === 'solarTotal' || s.event === 'dust') return { far: '', main: '' };
    var bx = bp ? bp[0] : 1340, by = bp ? bp[1] : 124;
    X.clearBody = cov <= 35 || (cov <= 60 && (s.body.t < G.sun.low || s.body.t > 1 - G.sun.low)); // low sun: also at ≤ 60
    var isDeck = cov > 85;
    if (isDeck) main += deck(X, tone, sky);
    if (/thunder/.test(c)) {
      main += cloud(X, tone, 'l', 1080, 64, 1.5);
      main += el('ellipse', { cx: 1306, cy: 186, rx: 64, ry: 16, fill: X.grad([[0, 'bolt', 0.55], [1, 'bolt', 0]], { radial: true }) });
    } else if (c === 'showers' || c === 'snowShowers') {
      main += cloud(X, tone, 'l', G.precip.showers[0], 82, 1.25);
      far += cloud(X, Object.assign({}, tone, { op: tone.op * 0.8 }), 's', 960, 92, 0.9);
    } else if (PRECIP[c]) {
      var M = G.precip.mass;
      main += cloud(X, tone, 'l', M[0], isDeck ? M[1] + 8 : M[1], M[2]);
    } else if (!isDeck) {
      if (cov > 60) {
        far += cloud(X, tone, 'm', 1040, 66, 0.9);
        main += cloud(X, tone, 'l', 930, 118, 1) + cloud(X, tone, 'l', bx - 124, by - 4, 1);
      } else if (cov > 35) {
        far += cloud(X, tone, 's', 1450, 66, 1);
        var low = bp && (s.body.t < G.sun.low || s.body.t > 1 - G.sun.low), lx = low && bx < 1300 ? Math.min(bx + 70, 1310) : 960;
        main += cloud(X, tone, 'l', lx, low ? 70 : 92, low ? 0.8 : 1);
      } else if (cov > 10) {
        far += cloud(X, tone, 's', 980, 74, 1) + cloud(X, tone, 's', bx > 1380 && !s.dayMoon ? 1210 : 1450, 92, 0.95);
      }
    }
    return { far: far, main: main };
  }

  /* --- landscape --- */
  function landColours(X, stops) {
    var s = X.s, night = s.phase === 'night' || s.phase === 'dawn' || s.phase === 'dusk' || s.event === 'solarTotal' || s.event === 'starNight';
    var L = PAL.land[s.season] || PAL.land.summer, base = night ? PAL.land.night : L.base;
    if (!night && s.theme === 'dark') base = mix(base, PAL.land.night, 0.45);
    if (s.phase === 'dusk' || s.phase === 'dawn') base = mix(base, '#2a2240', 0.25);
    var bottom = stops[stops.length - 1][1], wet = PRECIP[s.cond] && !/snow/i.test(s.cond);
    var near = base;
    if (s.heat && !night) near = mix(PAL.c['dry-meadow'], base, s.theme === 'dark' ? 0.45 : 0.1);
    if (wet) near = mix(near, '#000000', 0.12);
    if (s.frost === 2) near = mix(near, PAL.c.rime, night ? 0.12 : 0.25);
    if (s.event === 'rainbow') near = mix(near, PAL.glow.golden, 0.12);
    var snow = s.snowGround, snowTone = night ? mix(PAL.c.snow, bottom, 0.6) : s.theme === 'dark' ? mix(PAL.c.snow, bottom, 0.62) : PAL.c.snow; // dark theme .4 → .62 (contrast)
    var o = {
      night: night, bottom: bottom, base: base, wet: wet,
      near: snow ? snowTone : near,
      mid: mix(snow ? snowTone : base, bottom, 0.3),
      far: night ? mix(mix(base, bottom, 0.62), '#6a7aae', 0.2) : mix(base, bottom, s.event === 'dust' ? 0.82 : 0.62),
      alp: night ? mix(mix(base, bottom, 0.78), '#6a7aae', 0.22) : mix(base, bottom, s.event === 'dust' ? 0.9 : 0.78),
      crowns: night ? [mix(base, '#000000', 0.15), mix(base, '#000000', 0.2), mix(base, '#000000', 0.1)] : L.crowns.map(function (c) { return s.theme === 'dark' ? mix(c, PAL.land.night, 0.4) : c; }),
      snowTone: snowTone, snowShade: night ? mix(PAL.c['snow-shade'], bottom, 0.55) : s.theme === 'dark' ? mix(PAL.c['snow-shade'], bottom, 0.45) : PAL.c['snow-shade'],
    };
    if (s.event === 'rainbow') { o.mid = mix(o.mid, PAL.glow.golden, 0.12); o.far = mix(o.far, PAL.glow.golden, 0.15); }
    o.trees = mix(snow ? mix(base, bottom, 0.3) : o.mid, '#000000', night ? 0.25 : 0.22);
    return o;
  }
  function rightMask(X) { // hard-contrast details fade out toward the text zone (x 700 → 1000)
    if (!X.rm) X.rm = X.mask(el('rect', { width: G.W, height: G.H, fill: X.grad([[0, '#ffffff', 0], [1, '#ffffff', 1]], { x1: 700, x2: 1000, y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' }) }));
    return X.rm;
  }
  function edges(X, crest, col, w, op) { return el('path', { d: crest, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linejoin': 'round', opacity: op, mask: rightMask(X) }); }
  function ridgeTrims(X, R, LC, which, noMoon) { // rime, ice glaze, moonlit edge on one crest
    var s = X.s, out = '', w = which === 'far' ? 1.2 : 2;
    if (s.frost > 0 && which !== 'far') out += edges(X, R.crest, X.c('rime'), w * 0.75, LC.night ? 0.45 : 0.7);
    if (/^freezing/.test(s.cond) && which !== 'far') out += edges(X, R.crest, X.c('ice'), 1.6, 0.75);
    if (!noMoon && s.body.kind === 'moon' && s.moon.size >= 1.2 && LC.night && !s.event) out += edges(X, R.crest, mix(X.c(LC[which]), X.c('moon'), 0.35), 1.5, 0.9);
    return out;
  }
  function capPath(X, R, peaks, depth) { // clean scalloped caps: the cap line meets the crest exactly on both sides
    var reg = '', r = prng(X.s.seed * 5 + 11);
    peaks.forEach(function (p) {
      var d = depth(p);
      if (!d || (X.quiet && p[0] < X.quiet)) return; // no bright cap behind the text of a narrow crop
      var px = p[0];
      for (var q = p[0] - 15; q <= p[0] + 15; q++) if (R.y(q) < R.y(px)) px = q; // the spline's real summit
      var line = R.y(px) + d, xl = px, xr = px;
      while (R.y(xl - 1) < line && R.y(xl - 1) >= R.y(xl) - 0.01 && xl > p[0] - 220) xl--; // walk down the flank only
      while (R.y(xr + 1) < line && R.y(xr + 1) >= R.y(xr) - 0.01 && xr < p[0] + 220 && xr < G.W) xr++;
      if (R.y(xl - 1) < line || (xr < G.W && R.y(xr + 1) < line)) return; // the line runs into the next summit: no cap
      if (xr - xl < 6) return;
      var n = Math.max(2, Math.round((xr - xl) / 15)), w = (xr - xl) / n;
      reg += 'M' + xl + ',' + f(line) + 'V-300H' + xr + 'V' + f(line);
      for (var i = 0; i < n; i++) reg += 'Q' + f(xr - i * w - w / 2) + ',' + f(line + (i % 2 ? 3 : 6 + r() * 4)) + ' ' + f(xr - (i + 1) * w) + ',' + f(line);
      reg += 'Z';
    });
    return reg;
  }
  function mountain(X, R, LC, peaks, col, which) { // fill, one shaded flank per summit (away from the body), caps, trims
    var s = X.s, op = s.cond === 'fog' ? 0.4 : 1, out = el('path', { d: R.fill, fill: X.c(col) }), fac = '';
    if (s.landscape === 'mountains') {
      peaks.forEach(function (p) { // one long flank plane on the side away from the body, summit to valley
        var side = X.bodyX != null && X.bodyX > p[0] ? -1 : 1, xv = p[0], d = 'M' + p[0] + ',' + p[1];
        while (Math.abs(xv - p[0]) < G.flank.max && R.y(xv + side * 2) >= R.y(xv) - 0.01 && xv > 0 && xv < G.W) xv += side * 2;
        var D = (R.y(xv) - p[1]) * G.flank.depth + 12, back = '';
        for (var i = 1; i <= 14; i++) { var x = p[0] + ((xv - p[0]) * i) / 14; d += 'L' + f(x) + ',' + f(R.y(x)); }
        for (var j = 14; j >= 0; j--) { // lower edge: the crest shifted down, tapering to nothing at the valley
          var u = j / 14, x2 = p[0] + (xv - p[0]) * u - side * G.flank.lean * (1 - u);
          back += 'L' + f(x2) + ',' + f(R.y(p[0] + (xv - p[0]) * u) + D * Math.pow(1 - u, 0.8));
        }
        fac += d + back + 'Z';
      });
      out += el('path', { d: fac, fill: X.c(mix(col, '#000000', G.flank.dark)), 'clip-path': X.clip(el('path', { d: R.fill })) });
      var C = G.capDepth, cold = s.season === 'winter' || s.frost > 0 || s.snowGround || /snow/i.test(s.cond); // caps only when cold
      var reg = !cold ? '' : capPath(X, R, peaks, function (p) {
        return which === 'far' ? C.far * (p[1] < 160 ? 1 : 0.7) : p[1] <= C.highY ? C.high : C.low;
      });
      if (reg) out += el('path', { d: R.fill, fill: mix(X.c(LC.snowTone), X.c(LC.bottom), which === 'alp' ? 0.45 : LC.night ? 0.3 : s.theme === 'dark' ? 0.45 : 0.25), 'clip-path': X.clip(el('path', { d: reg })) });
    }
    out = el('g', { opacity: op }, out) + (which === 'far' ? ridgeTrims(X, R, LC, 'far') : '');
    if (which === 'alp') out = el('g', { mask: X.mask(el('rect', { y: -300, width: G.W, height: 700, fill: X.grad([[0, '#ffffff', 0], [1, '#ffffff', 1]], { x1: G.alpFade[0], x2: G.alpFade[1], y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' }) })) }, out);
    return out;
  }
  function lake(X, LC, bp) {
    var s = X.s, K = G.lake;
    if (s.landscape !== 'mountains') return '';
    var cx = (K.x0 + K.x1) / 2, cy = (K.y0 + K.y1) / 2, rx = (K.x1 - K.x0) / 2, ry = (K.y1 - K.y0) / 2;
    var d = 'M' + K.x0 + ',' + cy + 'C' + K.x0 + ',' + (K.y0 - 1) + ' ' + f(cx - rx * 0.4) + ',' + K.y0 + ' ' + cx + ',' + K.y0 + 'S' + K.x1 + ',' + (K.y0 + 2) + ' ' + K.x1 + ',' + cy +
      'S' + f(cx + rx * 0.5) + ',' + K.y1 + ' ' + cx + ',' + K.y1 + 'S' + K.x0 + ',' + (K.y1 - 2) + ' ' + K.x0 + ',' + cy + 'Z', frozen = s.frost === 2 || (s.season === 'winter' && s.frost > 0);
    var col = frozen ? mix(PAL.c.rime, LC.bottom, LC.night ? 0.6 : 0.35) : mix(LC.bottom, LC.mid, 1 - K.sky);
    if (s.heat && !frozen) col = mix(X.skyMid, LC.mid, 0.3); // heat: still water, not sand
    if (s.event === 'aurora') col = mix(col, PAL.c['aurora-1'], 0.3 * s.eventAmount); // a faint green in the lake
    if (LC.wet) col = mix(col, '#000000', 0.1);
    var out = el('path', { d: d, fill: X.c(mix(LC.mid, '#000000', 0.12)), transform: 'translate(0 2)' }) + el('path', { d: d, fill: X.c(col) }); // shore, water
    if (frozen) out += el('path', { d: d, fill: 'none', stroke: X.c('rime'), 'stroke-width': 1.5, opacity: 0.8 });
    var lowSun = s.body.kind === 'sun' && (s.body.t < 0.15 || s.body.t > 0.85);
    if (bp && !frozen && (s.body.kind === 'moon' || lowSun) && bp[0] < 1330 && !(s.cloud > 85)) { // soft vertical light path
      var x = Math.min(bp[0], K.x1 - 30), lp = '', lc = X.c(s.body.kind === 'moon' ? 'moon' : 'sun-low');
      [[0, 26], [4, 20], [8, 15], [12, 9]].forEach(function (q) { lp += rrect(x - q[1] / 2, K.y0 + 1.5 + q[0], q[1], 2.4, 1.2); });
      out += el('path', { d: lp, fill: lc, opacity: 0.55, 'clip-path': X.clip(el('path', { d: d })) });
    }
    return out;
  }
  function conifers(X, R, LC) {
    var s = X.s, C = G.conifers, r = prng(s.seed * 3 + 5), k = Math.tan((G.skew[s.wind] * Math.PI) / 180), body = '', caps = '', trunks = '', list = [];
    for (var i = 0; i < C.left; i++) list.push([C.leftFrom + ((C.from - 60 - C.leftFrom) * (i + r() * 0.7)) / C.left, C.leftH[0] + r() * (C.leftH[1] - C.leftH[0])]);
    for (var j = 0; j < C.n; j++) {
      var u = (j + 0.2 + r() * 0.6) / C.n, x = C.from + (G.W - C.from + 10) * Math.pow(u, 0.62);
      list.push([x, C.hMin + (C.hMax - C.hMin) * (0.35 * u + 0.65 * r())]);
    }
    list.forEach(function (t) {
      var x = t[0], yb = R.y(x) + 2.5, h = t[1];
      if (x < G.shelterX) h = Math.min(h, yb - C.topMin);
      if (h < 5) return;
      var w = h * C.w, P = function (dx, dy) { return f(x + dx + k * dy) + ',' + f(yb - dy); };
      var tier = function (b, top, ww) { // rounded triangle, base at height b, apex at top
        return 'M' + P(-ww / 2, b) + 'L' + P(-1.3, top - 1.6) + 'Q' + P(0, top + 0.6) + ' ' + P(1.3, top - 1.6) + 'L' + P(ww / 2, b) + 'Q' + P(0, b - 1.2) + ' ' + P(-ww / 2, b) + 'Z';
      };
      body += tier(2, h * 0.66, w) + tier(h * 0.4, h, w * 0.74);
      trunks += 'M' + P(-1, -1) + 'L' + P(-1, 3) + 'L' + P(1, 3) + 'L' + P(1, -1) + 'Z';
      if (s.snowGround || s.frost > 0) {
        var ch = s.snowGround ? 0.34 : 0.16, cw = w * 0.74 * ch;
        caps += 'M' + P(-cw / 2, h * (1 - ch)) + 'L' + P(-1.2, h - 1.6) + 'Q' + P(0, h + 0.6) + ' ' + P(1.2, h - 1.6) + 'L' + P(cw / 2, h * (1 - ch)) + 'Q' + P(0, h * (1 - ch) + 1.5) + ' ' + P(-cw / 2, h * (1 - ch)) + 'Z';
      }
    });
    var out = el('path', { d: trunks, fill: X.c(mix(LC.trees, '#000000', 0.2)) }) + el('path', { d: body, fill: X.c(LC.trees) });
    if (caps) out += el('path', { d: caps, fill: X.c(s.snowGround ? LC.snowTone : 'rime'), opacity: s.snowGround ? 0.95 : 0.8 });
    return s.motion && s.wind >= 2 ? el('g', { class: 'sc-sway' }, out) : out;
  }
  function crownTree(X, LC, R, x, cr, idx) {
    var s = X.s, k = Math.tan((G.skew[s.wind] * Math.PI) / 180), yb = R.y(x) + 3, th = cr * 0.95, tw = Math.max(2.4, cr * 0.2);
    var bare = s.season === 'winter' || s.snowGround, out = '', cy = yb - th - cr * 0.72, cx = x + k * (th + cr * 0.72);
    var trunk = X.c(LC.night ? mix(LC.base, '#000000', 0.35) : mix(PAL.c.trunk, LC.bottom, s.theme === 'dark' ? 0.35 : 0.1));
    out += el('path', { d: 'M' + f(x - tw / 2) + ',' + f(yb) + 'L' + f(x - tw * 0.32 + k * th) + ',' + f(yb - th - 2) + 'L' + f(x + tw * 0.32 + k * th) + ',' + f(yb - th - 2) + 'L' + f(x + tw / 2) + ',' + f(yb) + 'Z', fill: trunk });
    var col = X.c(LC.crowns[idx % 3]);
    if (bare) {
      var br = '', tx = x + k * th, ty = yb - th;
      [[-0.75, -0.9], [0.1, -1.25], [0.8, -0.85], [-0.35, -1.15]].forEach(function (b) { br += 'M' + f(tx) + ',' + f(ty) + 'Q' + f(tx + b[0] * cr * 0.3 + k * cr * 0.5) + ',' + f(ty - cr * 0.6) + ' ' + f(tx + b[0] * cr + k * cr) + ',' + f(ty + b[1] * cr); });
      out += el('circle', { cx: cx, cy: cy, r: cr * 0.86, fill: X.c(PAL.land.winter.crowns[0]), opacity: LC.night ? 0.35 : 0.42 });
      out += el('path', { d: br, fill: 'none', stroke: trunk, 'stroke-width': Math.max(1.4, cr * 0.09), 'stroke-linecap': 'round' });
    } else {
      var d = circ(cx, cy, cr * 0.9) + circ(cx - cr * 0.42, cy + cr * 0.22, cr * 0.66) + circ(cx + cr * 0.44, cy + cr * 0.18, cr * 0.68) + circ(cx + cr * 0.04, cy - cr * 0.42, cr * 0.66);
      var dk = mix(col, '#000000', 0.15);
      var fill = X.grad([[0, col], [0.58, col], [0.58, dk], [1, dk]], { x1: 0.15, y1: 0, x2: 0.85, y2: 1 });
      out += el('path', { d: d, fill: fill });
    }
    return s.motion && s.wind >= 2 ? el('g', { class: 'sc-sway' }, out) : out;
  }
  function nearRidge(X, R, LC) {
    var s = X.s, out = '';
    var fill = s.snowGround ? X.grad([[0, LC.snowTone], [0.45, LC.snowTone], [1, LC.snowShade]], { x1: 0, y1: 255, x2: 0, y2: 320, gradientUnits: 'userSpaceOnUse' }) : X.c(LC.near);
    out += el('path', { d: R.fill, fill: fill });
    var B = G.crestBand, band = 'M900,' + f(R.y(900));
    for (var bx = 920; bx <= G.W; bx += 20) band += 'L' + bx + ',' + f(R.y(bx));
    for (var bx2 = G.W; bx2 >= 900; bx2 -= 20) band += 'L' + bx2 + ',' + f(R.y(bx2) + B.h * (0.6 + 0.4 * Math.sin(bx2 / 37)));
    out += el('path', { d: band + 'Z', fill: X.c(mix(s.snowGround ? LC.snowTone : LC.near, LC.night ? '#8090c0' : '#ffffff', B.lift)), mask: rightMask(X) });
    if (s.landscape === 'village') {
      out += el('path', { d: G.village.path, fill: 'none', stroke: X.c(mix(LC.near, LC.night ? '#3b4766' : PAL.c.wall, LC.night ? 0.25 : 0.4)), 'stroke-width': 5, 'stroke-linecap': 'round', 'clip-path': X.clip(el('path', { d: R.fill })) });
    }
    out += ridgeTrims(X, R, LC, 'near', true);
    if (LC.wet) {
      var gl = '';
      [[1240, 0.6], [1350, 0.9], [1470, 0.7]].forEach(function (g) { var y = R.y(g[0]) + 14 + g[1] * 8; gl += 'M' + g[0] + ',' + f(y) + 'q' + f(22 * g[1]) + ',' + f(-3 * g[1]) + ' ' + f(46 * g[1]) + ',' + f(-1); });
      out += el('path', { d: gl, fill: 'none', stroke: X.c(mix(LC.near, '#ffffff', 0.3)), 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.45 });
    }
    if (!s.snowGround && s.landscape === 'mountains') {
      var r = prng(s.seed * 17 + 2), gt = '', Gs = G.grass;
      for (var i = 0; i < Gs.n; i++) {
        var x = Gs.from + ((Gs.to - Gs.from) * (i + r())) / Gs.n, y = R.y(x) + 1.5, h = 4 + r() * 4;
        gt += 'M' + f(x) + ',' + f(y) + 'l' + f(-1.5) + ',' + f(-h) + 'M' + f(x + 3) + ',' + f(y) + 'l' + f(1) + ',' + f(-h * 0.8);
      }
      out += el('path', { d: gt, fill: 'none', stroke: X.c(mix(LC.near, s.heat ? '#c9b46a' : '#000000', s.heat ? 0.4 : 0.22)), 'stroke-width': 1.4, 'stroke-linecap': 'round' });
    }
    var bu = '';
    G.bushes.forEach(function (b, i) {
      var y = R.y(b[0]) + 2;
      bu += circ(b[0], y - b[1] * 0.55, b[1]) + circ(b[0] + b[1] * 0.85, y - b[1] * 0.3, b[1] * 0.7);
    });
    var bcol = s.snowGround ? mix(LC.trees, LC.snowTone, 0.3) : mix(LC.crowns[1], LC.near, 0.45);
    out += el('path', { d: bu, fill: X.c(bcol) });
    G.crowns.forEach(function (c, i) { out += crownTree(X, LC, R, c[0], s.season === 'winter' ? c[1] * 0.85 : c[1], i); });
    if (s.frost === 2) {
      var rs = prng(s.seed * 19 + 4), sp = '';
      for (var j = 0; j < 8; j++) {
        var sx = 1080 + rs() * 500, sy = R.y(sx) + 6 + rs() * 22, q = 2.6;
        sp += 'M' + f(sx) + ',' + f(sy - q) + 'L' + f(sx + 0.6) + ',' + f(sy - 0.6) + 'L' + f(sx + q) + ',' + f(sy) + 'L' + f(sx + 0.6) + ',' + f(sy + 0.6) + 'L' + f(sx) + ',' + f(sy + q) + 'L' + f(sx - 0.6) + ',' + f(sy + 0.6) + 'L' + f(sx - q) + ',' + f(sy) + 'L' + f(sx - 0.6) + ',' + f(sy - 0.6) + 'Z';
      }
      out += el('path', { d: sp, fill: X.c('rime'), opacity: 0.95 });
    }
    // full-moon highlight: one continuous line over the crest, drawn after trees and bushes
    if (s.body.kind === 'moon' && s.moon.size >= 1.2 && LC.night && !s.event) out += edges(X, R.crest, mix(X.c(LC.near), X.c('moon'), 0.35), 1.5, 0.9);
    return out;
  }
  function village(X, R, LC) {
    var s = X.s, V = G.village, walls = '', roofs = '', wins = '', trees = '', snow = s.snowGround;
    var wall = X.c(LC.night ? mix(PAL.c.wall, PAL.land.night, 0.72) : mix(PAL.c.wall, LC.bottom, 0.28));
    var roof = X.c(snow ? (LC.night ? LC.snowTone : mix(PAL.c.snow, LC.bottom, 0.15)) : LC.night ? mix(PAL.c.roof, PAL.land.night, 0.7) : mix(PAL.c.roof, LC.bottom, 0.25));
    var win = LC.night ? X.c('window') : X.c(mix(PAL.c.wall, '#3a4048', 0.55));
    function house(x, w, hw, hr) {
      var yb = R.y(x + w / 2) + 3;
      walls += 'M' + f(x) + ',' + f(yb) + 'V' + f(yb - hw) + 'H' + f(x + w) + 'V' + f(yb) + 'Z';
      roofs += 'M' + f(x - 2) + ',' + f(yb - hw + 0.5) + 'L' + f(x + w / 2) + ',' + f(yb - hw - hr) + 'L' + f(x + w + 2) + ',' + f(yb - hw + 0.5) + 'Z';
      wins += 'M' + f(x + w * 0.25) + ',' + f(yb - hw * 0.62) + 'h4v4h-4z' + (w > 17 ? 'M' + f(x + w * 0.62) + ',' + f(yb - hw * 0.62) + 'h4v4h-4z' : '');
    }
    V.houses.forEach(function (h, i) { house(h[0], h[1], 10 + (i % 3) * 1.5, 7 + (i % 2) * 2); });
    var cx = V.church, yb = R.y(cx + 12) + 3;
    walls += 'M' + cx + ',' + f(yb) + 'V' + f(yb - 16) + 'H' + (cx + 32) + 'V' + f(yb) + 'Z' + 'M' + (cx - 2) + ',' + f(yb) + 'V' + f(yb - 34) + 'H' + (cx + 9) + 'V' + f(yb) + 'Z';
    roofs += 'M' + (cx + 7) + ',' + f(yb - 15.5) + 'L' + (cx + 20) + ',' + f(yb - 26) + 'L' + (cx + 34) + ',' + f(yb - 15.5) + 'Z' + 'M' + (cx - 3.5) + ',' + f(yb - 33.5) + 'L' + f(cx + 3.5) + ',' + f(yb - 54) + 'L' + (cx + 10.5) + ',' + f(yb - 33.5) + 'Z';
    wins += 'M' + (cx + 2) + ',' + f(yb - 28) + 'h3v5h-3z' + 'M' + (cx + 16) + ',' + f(yb - 11) + 'h3v5h-3zM' + (cx + 24) + ',' + f(yb - 11) + 'h3v5h-3z';
    var r = prng(s.seed * 23 + 9);
    V.rows.forEach(function (row) {
      for (var i = 0; i < row[2]; i++) {
        var x = row[0] + ((row[1] - row[0]) * (i + 0.5)) / row[2], rr = 5 + r() * 2.5, y = R.y(x) + 2;
        trees += circ(x, y - 4 - rr, rr) + 'M' + f(x - 0.8) + ',' + f(y) + 'h1.6v-5h-1.6z';
      }
    });
    return el('path', { d: trees, fill: X.c(snow ? mix(LC.trees, LC.snowTone, 0.25) : LC.trees) }) + el('path', { d: walls, fill: wall }) + el('path', { d: roofs, fill: roof }) + el('path', { d: wins, fill: win });
  }
  function fogBands(X, which) {
    if (X.s.cond !== 'fog') return '';
    var out = '', op = X.s.phase === 'night' ? 0.28 : X.s.theme === 'dark' ? 0.22 : 0.55;
    var g = X.grad([[0, 'fog', 0], [0.25, 'fog', 1], [0.75, 'fog', 1], [1, 'fog', 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
    G.fog.forEach(function (b) { if (b[4] === which) out += el('rect', { x: b[0], y: b[2], width: b[1], height: b[3], rx: b[3] / 2, fill: g, opacity: op }); });
    return X.s.motion && out ? el('g', { class: 'sc-fog' }, out) : out;
  }

  /* --- precipitation --- */
  function precip(X, sky) {
    var s = X.s, c = s.cond, P = G.precip, i = s.intensity, ev = s.event;
    var rainy = /rizzle|rain|showers|thunder/i.test(c) && c !== 'snowShowers', snowy = /snow/i.test(c), hail = c === 'thunderHail';
    var curtain = ev === 'rainbow';
    if (!rainy && !snowy && !curtain) return '';
    var slant = P.slant[s.wind], k = Math.tan((slant * Math.PI) / 180), top = P.top, Ht = G.H - top, r = prng(s.seed * 29 + 7);
    var light = ink(s) === 'dark';
    var rainCol = X.c(mix(X.skyMid || PAL.c.rain, '#ffffff', light ? 0.45 : 0.55)); // slightly lighter than the sky
    function region(n, len, x0, x1) { // n strokes in a tile [x0,x1]×[top, H], shifted copy above for the loop
      var d = '', dc = '';
      for (var j = 0; j < n; j++) {
        var x = x0 - k * Ht + r() * (x1 - x0 + k * Ht), y = top + r() * Ht, l = len * (0.75 + r() * 0.5);
        var seg = 'l' + f(k * l) + ',' + f(l);
        d += 'M' + f(x) + ',' + f(y) + seg;
        dc += 'M' + f(x - k * Ht) + ',' + f(y - Ht) + seg;
      }
      return s.motion ? d + dc : d;
    }
    function dots(n, rMin, rMax, x0, x1) {
      var d = '';
      for (var j = 0; j < n; j++) {
        var x = x0 - k * Ht + r() * (x1 - x0 + k * Ht), y = top + r() * Ht, rr = rMin + r() * (rMax - rMin);
        d += circ(x, y, rr) + (s.motion ? circ(x - k * Ht, y - Ht, rr) : '');
      }
      return d;
    }
    function fall(inner, dur, n) {
      if (!s.motion) return inner;
      return el('g', { class: 'sc-fall', style: '--fx:' + f(k * Ht) + 'px;--fy:' + Ht + 'px;--dur:' + dur + 's;--n:' + (5 / dur).toFixed(2) }, inner); // every motion ends after 5 s (fractional loop: both tiles are drawn)
    }
    var showers = c === 'showers' || c === 'snowShowers', x0 = 0, x1 = G.W, out = '';
    if (showers) { x0 = P.showers[0]; x1 = P.showers[1]; }
    if (curtain) { x0 = P.curtain[0]; x1 = P.curtain[1]; }
    var rdur = i === 3 ? G.motion.rainHeavy : G.motion.rain, rn = Math.round(G.motion.total / rdur);
    if (curtain && !rainy) {
      out += fall(el('path', { d: region(P.curtain[2], 14, x0, x1), stroke: rainCol, 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.4 }), rdur, rn);
    } else if (rainy) {
      var drizzle = /rizzle/.test(c), n = drizzle ? P.drizzle : P.rain[i - 1];
      if (showers) n = Math.round(n * 0.8);
      if (hail) n = Math.round(n * 0.5);
      out += fall(el('path', { d: region(n, drizzle ? 6 : P.len, x0, x1), stroke: rainCol, 'stroke-width': drizzle ? 1.2 : i >= 2 ? P.width : 1.6, 'stroke-linecap': 'round', opacity: P.op }), drizzle ? rdur * 1.5 : rdur, drizzle ? Math.round(rn / 1.5) : rn);
    }
    if (snowy) {
      var sn = P.snow[i - 1];
      if (showers) sn = Math.round(sn * 0.6);
      var farCol = light ? X.c(mix(PAL.c['snow-shade'], PAL.c['cloud-rain'], 0.3)) : X.c(mix(PAL.c.snow, sky.bottom, 0.25));
      out += fall(el('path', { d: dots(Math.round(sn * 0.55), 1.6, 2.2, x0, x1), fill: farCol, opacity: 0.8 }), G.motion.snow[1], 1);
      out += fall(el('path', { d: dots(Math.round(sn * 0.45), 2.2, 3, x0, x1), fill: X.c('#ffffff'), opacity: s.theme === 'dark' || !light ? 0.75 : 0.95 }), G.motion.snow[0], 1);
    }
    if (hail) {
      var hd = '', he = '';
      for (var j = 0; j < P.hail; j++) {
        var hx = P.hailFrom + r() * (G.W - P.hailFrom), hy = top + 10 + r() * (Ht - 10), hr = 3.2;
        hd += circ(hx, hy, hr);
        he += 'M' + f(hx - hr) + ',' + f(hy) + 'a' + hr + ',' + hr + ' 0 0 0 ' + f(2 * hr) + ',0z';
      }
      out += el('path', { d: hd, fill: X.c('#ffffff') }) + el('path', { d: he, fill: X.c('hail-edge') });
    }
    // left of x 1000 at 30 %, clipped below the title row (and under the shower cloud)
    var mk = X.mask(el('rect', { width: G.W, height: G.H, fill: X.grad([[0, '#ffffff', snowy && !light ? P.leftOp * 0.4 : P.leftOp], [1, '#ffffff', 1]], { x1: X.quiet ? X.quiet - 150 : P.mask[0], x2: X.quiet || P.mask[1], y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' }) }));
    var cy = showers ? 178 : curtain ? 96 : top;
    var clipD = 'M' + x0 + ',' + cy + 'H' + x1 + 'L' + f(x1 + k * (G.H - cy)) + ',' + G.H + 'H' + f(x0 + k * (G.H - cy)) + 'Z';
    if (!showers && !curtain) clipD = 'M0,' + top + 'H' + G.W + 'V' + G.H + 'H0Z';
    return el('g', { mask: mk }, el('g', { 'clip-path': X.clip(el('path', { d: clipD })) }, out));
  }

  /* --- events and wind --- */
  function eventLayer(X, LC) {
    var s = X.s, ev = s.event, out = '';
    if (/thunder/.test(s.cond)) out += el('path', { d: 'M' + G.bolt.map(function (p) { return p.join(','); }).join('L') + 'Z', fill: X.c('bolt'), 'stroke-linejoin': 'round' });
    if (ev === 'rainbow') {
      var R = G.rainbow, arcs = '';
      for (var i = 0; i < 5; i++) {
        var rr = R.r - R.w / 2 - i * R.w;
        arcs += el('path', { d: 'M' + (R.cx - rr) + ',' + R.cy + 'A' + rr + ',' + rr + ' 0 0 1 ' + (R.cx + rr) + ',' + R.cy, fill: 'none', stroke: X.c('rb-' + (i + 1)), 'stroke-width': R.w + 0.4 });
      }
      var mk = X.mask(el('rect', { width: G.W, height: G.H, fill: X.grad([[0, '#ffffff', 1], [1, '#ffffff', 0]], { x1: 0, x2: 0, y1: R.fade[0], y2: R.fade[1], gradientUnits: 'userSpaceOnUse' }) }));
      out += el('g', { mask: mk, opacity: R.op }, arcs);
    }
    if (ev === 'meteors') {
      G.meteors.forEach(function (m) {
        var a = (32 * Math.PI) / 180, tx = m[0] + Math.cos(a) * m[2], ty = m[1] - Math.sin(a) * m[2];
        var g = X.grad([[0, '#ffffff', 0.95], [1, '#ffffff', 0]], { x1: m[0], y1: m[1], x2: tx, y2: ty, gradientUnits: 'userSpaceOnUse' });
        out += el('path', { d: 'M' + m[0] + ',' + m[1] + 'L' + f(tx) + ',' + f(ty), stroke: g, 'stroke-width': 1.6, 'stroke-linecap': 'round' }) + el('circle', { cx: m[0], cy: m[1], r: 1.6, fill: X.c('star') });
      });
    }
    return out;
  }
  function auroraLayer(X) { // never animated; nothing left of the shelter / quiet zone except the faint glow
    var s = X.s, A = G.aurora, amt = Math.max(0, Math.min(1, s.eventAmount)), left = Math.max(G.shelterX, X.quiet || 0), out = '';
    var op = A.op[0] + A.op[1] * amt, gl = A.glow;
    out += el('ellipse', { cx: Math.max(gl[0], left + 200), cy: gl[1], rx: gl[2] * (0.6 + 0.4 * amt), ry: gl[3] * (0.5 + 0.5 * amt), fill: X.grad([[0, 'aurora-1', 0.3 * amt + 0.08], [1, 'aurora-1', 0]], { radial: true }) });
    var fill = X.grad([[0, 'aurora-3', 0], [0.35, 'aurora-3', 0.45], [0.7, 'aurora-2', 0.85], [1, 'aurora-1', 1]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    A.bands.slice(0, amt < 0.6 ? A.few : A.bands.length).forEach(function (b, bi) {
      var x0 = Math.max(b[0], left), x1 = b[1];
      if (x1 - x0 < 90) return;
      var h = Math.min(A.h * Math.pow(amt, 1.15) * b[3] + 14, b[2] - A.top), n = 16, top = '', base = '';
      for (var i = 0; i <= n; i++) {
        var u = i / n, x = x0 + (x1 - x0) * u, env = Math.pow(Math.sin(Math.PI * u), 0.55);
        var yb = b[2] + 7 * Math.sin(u * 7 + b[4]), yt = yb - h * env * (0.82 + 0.18 * Math.sin(u * 11 + b[4] * 2));
        top += (i ? 'L' : 'M') + f(x) + ',' + f(yt);
        base = 'L' + f(x) + ',' + f(yb) + base;
      }
      // two overlapping translucent copies (the second narrower and shifted) give the curtain its soft fold
      out += el('path', { d: top + base + 'Z', fill: fill, opacity: f(op * 100) / 100 });
      out += el('path', { d: top + base + 'Z', fill: fill, opacity: f(op * 60) / 100, transform: 'translate(' + f(x0 + (x1 - x0) * 0.5) + ' ' + b[2] + ') scale(0.62 0.8) translate(' + f(-(x0 + (x1 - x0) * 0.42)) + ' ' + -b[2] + ')' });
    });
    return out;
  }
  function windLayer(X, LC) {
    var s = X.s, out = '';
    if (s.wind < 2) return '';
    var col = X.c('#ffffff'), op = LC.night ? 0.32 : ink(s) === 'dark' ? 0.75 : 0.45, d = '';
    G.windStrokes.forEach(function (w) {
      var L = w[2], x = w[0], y = w[1];
      d += 'M' + x + ',' + y + 'c' + f(L * 0.3) + ',-10 ' + f(L * 0.6) + ',8 ' + f(L * 0.86) + ',0' + 'c' + f(L * 0.09) + ',-3 ' + f(L * 0.12) + ',-15 ' + f(L * 0.04) + ',-17' + 'c-7,-2 -12,5 -7,10';
    });
    out += el('path', { d: d, fill: 'none', stroke: col, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: op });
    if (s.wind === 3) {
      var lc = LC.crowns, lv = '';
      [[1250, 176, -30, 0], [1410, 212, 20, 1], [1520, 150, 60, 2]].forEach(function (l) {
        lv += el('ellipse', { cx: l[0], cy: l[1], rx: 5, ry: 2.4, fill: X.c(lc[l[3]]), transform: 'rotate(' + l[2] + ' ' + l[0] + ' ' + l[1] + ')' });
      });
      out += lv;
    }
    return out;
  }

  /* ============================== Scene.svg ============================== */
  function bodyPos(s, R, r) {
    var A = G.arc, t = s.body.t, x = A.x0 + A.dx * t, y = A.y0 - A.dy * Math.sin(Math.PI * t);
    if (R) y = Math.min(y, R.y(x) - G.peek * r); // "partly behind the far ridge", never fully hidden
    return [x, y];
  }
  function svg(input, opts) {
    var s = state(input);
    opts = opts || {};
    var X = context(s, JSON.stringify(s) + JSON.stringify(opts)), sky = skyOf(s), stops = skyStops(X, sky);
    X.quiet = opts.quietX || null;
    X.haloK = opts.bodyAt ? 0.75 : 1; // a body placed for a narrow crop: a tighter halo, clear of the text
    X.ext = opts.extendTop || 0; // short, narrow boxes (phone head): more sky above, so the landscape stays low
    X.skyMid = skyAt(stops, 120);
    var top = stops[0][1], bottom = stops[stops.length - 1][1];
    var skyInfo = { top: top, bottom: bottom };
    var RS = G.ridges[s.landscape] || G.ridges.mountains;
    var far = spline(RS.far), mid = spline(RS.mid), near = spline(RS.near), alp = RS.alp ? spline(RS.alp) : null;
    var crest = { y: function (x) { return alp ? Math.min(alp.y(x), far.y(x)) : far.y(x); } };
    var plain = s.level === 'plain';
    var deckOn = s.cloud > 85 && s.cond !== 'fog';
    var moonUp = s.body.kind === 'moon', sunUp = s.body.kind === 'sun';
    var br = moonUp ? G.moon.r * s.moon.size : s.heat ? G.sun.rHeat : G.sun.r;
    var bp = s.body.kind === 'none' || s.event === 'rainbow' ? null : opts.bodyAt || bodyPos(s, crest, br); // bodyAt: a fixed spot (phone head)
    X.bodyX = bp ? bp[0] : null;
    var L = [];
    X.bp = s.body.kind === 'moon' ? bp : null; X.br = br; X.bodyP = bp;
    L.push(layer('sky', skyLayer(X, sky, stops, bp)));
    L.push(layer('stars', plain && !moonUp ? '' : starsLayer(X)));
    var body = '';
    if (bp && !(deckOn && PRECIP[s.cond])) {
      if (deckOn) body = el('circle', { cx: bp[0], cy: Math.min(bp[1], 70), r: 90, fill: X.grad([[0, '#ffffff', 0.32], [1, '#ffffff', 0]], { radial: true }) });
      else if (sunUp) body = sunBody(X, bp[0], bp[1], br, skyInfo);
      else if (moonUp) body = moonBody(X, bp[0], bp[1], br, s.moon, { glow: true, eclipse: /^lunar/.test(s.event) ? s.event : null, darkFill: X.c(skyAt(stops, bp[1])) });
    }
    if (s.dayMoon && !plain) {
      var D = G.dayMoon;
      body += el('g', { opacity: D.op }, moonBody(X, D.x, D.y, D.r, s.moon, { glow: false, darkFill: X.c(skyAt(stops, D.y)), maria: true }).replace(/fill="[^"]*" opacity="0.5"/, 'fill="none"'));
    }
    L.push(layer('body', body));
    if (s.event === 'aurora' && !plain) L.push(layer('aurora', auroraLayer(X)));
    if (!plain) {
      var LC = landColours(X, stops), cl = cloudLayers(X, bp, skyInfo);
      L.push(layer('cloudsFar', cl.far));
      if (alp) L.push(layer('ridgeAlp', mountain(X, alp, LC, G.alpPeaks, LC.alp, 'alp') + (s.event === 'aurora' ? edges(X, alp.crest, X.c('aurora-1'), 1.6, f(0.45 * s.eventAmount * 100) / 100) : '')));
      L.push(layer('ridgeFar', mountain(X, far, LC, s.landscape === 'mountains' ? G.farPeaks : [], LC.far, 'far')));
      L.push(layer('fog', fogBands(X, 'far')));
      var midOut = el('path', { d: mid.fill, fill: s.snowGround ? X.grad([[0, LC.mid], [1, mix(LC.snowShade, bottom, 0.3)]], { x1: 0, y1: 220, x2: 0, y2: 300, gradientUnits: 'userSpaceOnUse' }) : X.c(LC.mid) }) + ridgeTrims(X, mid, LC, 'mid');
      if (s.heat && !LC.night) midOut += el('rect', { y: 200, width: G.W, height: 50, fill: X.grad([[0, 'heat-haze', 0], [0.5, 'heat-haze', 1], [1, 'heat-haze', 0]], { x1: 0, y1: 0, x2: 0, y2: 1 }), opacity: s.theme === 'dark' ? 0.16 : 0.5 });
      midOut += s.landscape === 'village' ? village(X, mid, LC) : conifers(X, mid, LC);
      L.push(layer('ridgeMid', midOut));
      L.push(layer('fog', fogBands(X, 'near'), { 'data-part': 'front' }));
      L.push(layer('clouds', cl.main));
      L.push(layer('event', eventLayer(X, LC)));
      L.push(layer('precip', precip(X, skyInfo)));
      L.push(layer('lake', lake(X, LC, bp)));
      L.push(layer('ridgeNear', nearRidge(X, near, LC)));
      L.push(layer('wind', windLayer(X, LC)));
      var S = G.shelter, wash = X.grad([[0, bottom, S.op], [0.72, bottom, S.op * 0.6], [1, bottom, 0]], { x1: 0, x2: S.x1, y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' });
      var vm = X.mask(el('rect', { width: G.W, height: G.H, fill: X.grad([[0, '#ffffff', 0], [1, '#ffffff', 1]], { x1: 0, x2: 0, y1: S.y0, y2: S.y1, gradientUnits: 'userSpaceOnUse' }) }));
      L.push(layer('shelter', el('rect', { y: S.y0, width: S.x1, height: G.H - S.y0, fill: wash, mask: vm })));
    }
    var a = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 ' + -X.ext + ' ' + G.W + ' ' + (G.H + X.ext), preserveAspectRatio: opts.align || 'xMaxYMax slice', 'aria-hidden': 'true',
      class: 'scene' + (s.motion && !s.calm ? ' scene-motion' : ''), 'data-ink': ink(s), width: opts.width || '100%', height: opts.height || '100%' };
    var body2 = L.join('');
    if (!s.motion || s.calm) body2 = body2.replace(/ class="sc-[a-z]+"/g, '');
    return '<svg' + attrs(a) + '><defs>' + X.defs.join('') + '</defs>' + body2 + '</svg>';
  }

  /* ============================== Scene.porthole (round crop, 40–64 px) ============================== */
  function porthole(input, px) {
    var s = state(input), X = context(s, 'p' + px + JSON.stringify(s)), sky = skyOf(s), stops = skyStops(X, sky);
    X.skyMid = skyAt(stops, 120);
    var bottom = stops[stops.length - 1][1], out = '';
    out += el('rect', { width: 100, height: 100, fill: X.grad(stops, { x1: 0, y1: 0, x2: 0, y2: 1 }) });
    if (sky.glow) out += el('rect', { width: 100, height: 100, fill: X.grad([[0, sky.glow.colour, 0.8 * sky.glow.strength], [1, sky.glow.colour, 0]], { radial: true, cx: 0.55, cy: 0.85, r: 0.6 }) });
    var deckOn = s.cloud > 85 && s.cond !== 'fog', wet = PRECIP[s.cond];
    if (s.phase === 'night' && s.cloud < 60) out += el('path', { d: circ(22, 24, 1.1) + circ(40, 14, 0.9) + circ(14, 46, 0.8) + circ(80, 60, 0.9), fill: X.c('star'), opacity: 0.85 });
    if (s.body.kind !== 'none' && !(deckOn && wet)) {
      if (s.body.kind === 'moon') out += moonBody(X, 64, 36, 15 * Math.min(1.15, s.moon.size), s.moon, { glow: true, darkFill: X.c(skyAt(stops, 120)), maria: px >= 48 });
      else if (s.cond === 'fog') out += el('circle', { cx: 62, cy: 36, r: 14, fill: mix(X.c('sun-core'), X.c(bottom), 0.35) });
      else {
        out += el('circle', { cx: 62, cy: 36, r: 30, fill: X.grad([[0, 'sun', 0.6], [1, 'sun', 0]], { radial: true }), opacity: 0.6 });
        out += el('circle', { cx: 62, cy: 36, r: 14, fill: X.c(s.phase === 'golden' ? 'sun-low' : 'sun') }) + el('circle', { cx: 62, cy: 36, r: 8.6, fill: X.c('sun-core') });
      }
    }
    var tone = cloudTone(X), cd = '';
    var n = deckOn || wet ? 2 : s.cloud > 60 ? 2 : s.cloud > 10 ? 1 : 0;
    if (n) {
      var fill = X.grad([[0, tone.b], [G.shadeAt, tone.b], [G.shadeAt, tone.sh], [1, tone.sh]], { x1: 0, y1: 0, x2: 0, y2: 1 });
      cd += el('path', { d: cloudPath('m'), fill: fill, opacity: tone.op, transform: 'translate(' + (deckOn || wet ? 30 : 42) + ' ' + (deckOn || wet ? 30 : 40) + ') scale(0.3)' });
      if (n > 1) cd += el('path', { d: cloudPath('s'), fill: fill, opacity: tone.op, transform: 'translate(4 ' + (deckOn || wet ? 22 : 30) + ') scale(0.36)' });
    }
    out += cd;
    var LC = landColours(X, stops), ry = 'M0,80 C24,74 52,70 100,76 V100 H0Z';
    if (/rizzle|rain|showers|thunder|snow/i.test(s.cond)) {
      var r = prng(s.seed * 41), marks = '', snowy = /snow/i.test(s.cond);
      var cnt = 6 + Math.min(4, s.intensity * 1 + 1);
      for (var i = 0; i < cnt; i++) {
        var x = 30 + ((i + r() * 0.6) * 60) / cnt, y = 56 + ((i * 7) % 17) + r() * 4;
        marks += snowy ? circ(x, y, 1.6) : 'M' + f(x) + ',' + f(y) + 'l1.4,6';
      }
      var lightInk = ink(s) === 'dark';
      out += snowy ? el('path', { d: marks, fill: X.c(lightInk ? '#ffffff' : 'snow') }) : el('path', { d: marks, stroke: X.c(lightInk ? mix(PAL.c.rain, PAL.c['cloud-rain-shade'], 0.6) : 'rain'), 'stroke-width': 2, 'stroke-linecap': 'round' });
    }
    if (/thunder/.test(s.cond)) out += el('path', { d: 'M54,60h7l-4,9h6l-11,15 3-11h-5z', fill: X.c('bolt') });
    out += el('path', { d: 'M0,74 C30,58 52,54 100,68 V100H0Z', fill: X.c(LC.far), opacity: s.cond === 'fog' ? 0.5 : 0.9 });
    out += el('path', { d: ry, fill: X.c(LC.near) });
    if (s.cond === 'fog') out += el('rect', { x: -10, y: 60, width: 120, height: 10, rx: 5, fill: X.c('fog'), opacity: 0.6 }) + el('rect', { x: 20, y: 74, width: 90, height: 8, rx: 4, fill: X.c('fog'), opacity: 0.5 });
    var clipId = X.clip(el('circle', { cx: 50, cy: 50, r: 50 }));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + px + '" height="' + px + '" aria-hidden="true" class="porthole"><defs>' + X.defs.join('') + '</defs><g clip-path="' + clipId + '">' + out + '</g></svg>';
  }

  /* ============================== Scene.moonGlyph (16–64 px) ============================== */
  function moonGlyph(o) {
    o = Object.assign({ illum: 0.5, waxing: true, tilt: 0, size: 18, mono: false }, o || {});
    var r = 10, lit = litPath(r, o.illum), flip = o.waxing ? '' : ' scale(-1 1)', out = '';
    if (o.mono) {
      out += el('circle', { r: r - 0.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', opacity: lit ? 0.6 : 1 });
      if (lit) out += el('path', { d: lit, fill: 'currentColor', transform: flip ? flip.trim() : null });
    } else {
      var X = context(state({}), 'glyph' + JSON.stringify(o));
      out += el('circle', { r: r, fill: X.c('moon-dark'), opacity: 0.55 });
      if (!lit) out += el('circle', { r: r - 0.5, fill: 'none', stroke: X.c('moon-dark'), 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' });
      else {
        out += el('path', { d: lit, fill: X.c('moon'), transform: flip ? flip.trim() : null });
        if (o.size >= 24) {
          var cp = X.clip(el('path', { d: lit, transform: flip ? flip.trim() : null }));
          out += el('g', { 'clip-path': cp, fill: X.c('moon-mare') }, MARIA.map(function (q) { return el('ellipse', { cx: q[0] * r, cy: q[1] * r, rx: q[2] * r, ry: q[3] * r, transform: 'rotate(' + q[4] + ' ' + f(q[0] * r) + ' ' + f(q[1] * r) + ')' }); }).join(''));
        }
      }
      out = '<defs>' + X.defs.join('') + '</defs>' + out;
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-11 -11 22 22" width="' + o.size + '" height="' + o.size + '" aria-hidden="true" class="moon-glyph"><g transform="rotate(' + o.tilt + ')">' + out.replace(/^<defs>.*?<\/defs>/, function (m) { return m; }) + '</g></svg>';
  }

  /* ============================== presets (typical states used by the pages) ============================== */
  var presets = {
    frostNightFull: { phase: 'night', cond: 'mostlyClear', cloud: 15, frost: 2, season: 'winter', body: { kind: 'moon', t: 0.4 }, moon: { illum: 1, waxing: true, size: 1.2 } },
    summerDay: { phase: 'day', cond: 'clear', season: 'summer', body: { kind: 'sun', t: 0.5 } },
    autumnRainWind: { phase: 'day', cond: 'rain', intensity: 2, wind: 2, season: 'autumn' },
    snowDusk: { phase: 'dusk', cond: 'snow', intensity: 1, cloud: 90, season: 'winter' },
    thunder: { phase: 'day', cond: 'thunder', intensity: 2, wind: 1, season: 'summer' },
    overcastMorning: { phase: 'day', cond: 'overcast', season: 'autumn', body: { kind: 'sun', t: 0.2 } },
    partlyDay: { phase: 'day', cond: 'partly', season: 'spring' },
    drizzle: { phase: 'day', cond: 'drizzle', season: 'spring' },
    fog: { phase: 'day', cond: 'fog', season: 'autumn', body: { kind: 'sun', t: 0.3 } },
    snowDay: { phase: 'day', cond: 'snow', intensity: 2, season: 'winter' },
    clearNight: { phase: 'night', cond: 'clear', season: 'summer', moon: { illum: 0.6, waxing: true } },
    showers: { phase: 'day', cond: 'showers', season: 'summer', body: { kind: 'sun', t: 0.35 } },
    golden: { phase: 'golden', cond: 'clear', season: 'summer', body: { kind: 'sun', t: 0.92 } },
  };

  function skyKey(s) { return skyOf(state(s)).key; }
  window.Scene = { svg: svg, porthole: porthole, moonGlyph: moonGlyph, presets: presets, state: state, ink: ink, skyKey: skyKey, moonPath: litPath, G: G };
})();
