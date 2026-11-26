/* Weather round 2, phase 2: the same three scenes in three drawing languages (mockup only, never shipped).
   Styles.svg(sceneId, style, opts) → SVG string. sceneId: 'frost' | 'storm' | 'winter'; style: 'A' | 'B' | 'C'.
   A "Staffeln"  – layered flat silhouettes, depth by haze only.
   B "Facetten"  – cut-paper facets: every mountain, tree and roof has a lit and a shaded face.
   C "Bilderbuch" – flat colour with a dark outline and hatching (ligne claire).
   Same geometry (G) for all three, so only the language differs. opts: { theme, view: [x, y, w, h], bodyAt: [x, y] }.
   Every random number comes from prng(seed): the picture is the same on every render. */
(function () {
  var W = 1600, H = 320;
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
  function jag(line, seed, amp, step) { // angular notches between the key points
    var r = prng(seed), out = [line[0]];
    for (var i = 1; i < line.length; i++) {
      var a = line[i - 1], b = line[i], d = b[0] - a[0], n = Math.max(1, Math.round(d / step));
      for (var j = 1; j < n; j++) { var t = j / n + ((r() - 0.5) * 0.3) / n; out.push([a[0] + d * t, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * 2 * amp]); }
      out.push(b);
    }
    return out;
  }
  function circ(x, y, r) { return 'M' + f(x - r) + ',' + f(y) + 'a' + f(r) + ',' + f(r) + ' 0 1,1 ' + f(2 * r) + ',0a' + f(r) + ',' + f(r) + ' 0 1,1 ' + f(-2 * r) + ',0Z'; }
  function blob(cx, cy, r, seed, n) { // smooth irregular ring
    var q = prng(seed), p = [], i;
    n = n || 11;
    for (i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2, rr = r * (0.84 + 0.3 * q()); p.push([cx + Math.cos(a) * rr * 1.12, cy + Math.sin(a) * rr * 0.94]); }
    var m = function (u, v) { return [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2]; }, s = m(p[n - 1], p[0]), d = 'M' + f(s[0]) + ',' + f(s[1]);
    for (i = 0; i < n; i++) { var e = m(p[i], p[(i + 1) % n]); d += 'Q' + f(p[i][0]) + ',' + f(p[i][1]) + ' ' + f(e[0]) + ',' + f(e[1]); }
    return d + 'Z';
  }

  /* ---------- geometry shared by the three styles ---------- */
  var G = {
    far: [[0, 204], [110, 192], [200, 200], [320, 180], [420, 194], [550, 172], [660, 190], [780, 164], [870, 182], [950, 160], [1005, 168], [1070, 126], [1098, 136],
      [1150, 100], [1180, 120], [1210, 130], [1256, 152], [1300, 128], [1352, 78], [1380, 96], [1402, 90], [1452, 132], [1490, 112], [1528, 140], [1562, 128], [1600, 150]],
    peaks: [[550, 172, 0.35], [780, 164, 0.4], [1070, 126, 0.55], [1150, 100, 0.95], [1352, 78, 1.25], [1402, 90, 0.5], [1490, 112, 0.8], [1562, 128, 0.4]],
    mid: [[0, 232], [130, 220], [250, 230], [390, 212], [520, 226], [650, 210], [790, 222], [900, 204], [990, 216], [1050, 190], [1092, 202], [1160, 180], [1232, 206],
      [1290, 194], [1362, 210], [1430, 176], [1482, 196], [1540, 170], [1600, 186]],
    midPeaks: [[390, 212], [650, 210], [900, 204], [1050, 190], [1160, 180], [1290, 194], [1430, 176], [1540, 170]],
    f1: [[0, 244], [400, 238], [800, 241], [1100, 235], [1400, 231], [1600, 227]],
    f2: [[0, 264], [400, 259], [800, 263], [1000, 257], [1340, 255], [1600, 247]],
    ground: [[0, 291], [300, 285], [600, 293], [880, 287], [985, 300], [1335, 300], [1362, 277], [1440, 267], [1530, 270], [1600, 262]],
    shore: [[985, 300], [985, 267], [1040, 261], [1120, 264], [1210, 259], [1290, 263], [1345, 258], [1345, 300]],
    body: [1238, 104],
    nearTrees: [[1548, 269, 122], [1583, 265, 88], [1346, 282, 56], [958, 292, 60], [928, 290, 42], [640, 292, 30], [300, 286, 26], [1512, 270, 40]],
    leaf: [[1300, 300, 15], [880, 288, 13]], // broadleaf trees: x, base y, crown radius
  };

  /* ---------- scenes: what the data says + the palette ---------- */
  var SCENES = {
    frost: {
      id: 'frost', night: true, deck: true, hole: true, frost: 1, lean: 0, ink: ['light', 'light'],
      body: { kind: 'moon', illum: 0.95, waxing: false },
      P: {
        sky: ['#0a1432', '#27407a'], under: ['#222a3d', '#414c68'], haze: '#3a4560',
        far: '#2f3a54', mid: '#252e44', f1: '#1c2437', f2: '#141b2c', near: '#0b111e', dark: '#04070e',
        snow: '#9fadcb', snowShade: '#63708f', rime: '#b9c7de', water: '#27324c', waterHi: '#aab6d0',
        cloud: ['#1d2434', '#2a3247', '#3a445c', '#a4b1cf'], line: '#03060c', trunk: '#0a0f1a',
        wall: '#1b2233', roof: '#0c111d', window: '#ffd98a', smoke: '#5a6580', flag: '#6f7a94',
        moon: '#f1ecd8', mare: '#d6cfb6', moonDark: '#27335c', star: '#ffffff',
      },
    },
    storm: {
      id: 'storm', storm: 3, rain: 3, lean: 0.24, wind: 2, ink: ['light', 'light'],
      P: {
        sky: ['#232b38', '#6a7686'], under: ['#232b38', '#6a7686'], haze: '#5f6b7b',
        far: '#56636f', mid: '#465a56', f1: '#30493f', f2: '#233a32', near: '#152823', dark: '#0a1512',
        meadow: '#2c4735', snow: '#8a97a4', snowShade: '#66727e', water: '#465563', waterHi: '#9aaab8',
        cloud: ['#262d39', '#363f4d', '#4a5565', '#8793a3'], line: '#0a1210', trunk: '#12201c',
        wall: '#5d4838', roof: '#35271f', window: '#ffd98a', smoke: '#7b8794', flag: '#d5dbe2',
        rain: '#d6e3f0', bolt: '#ffe9a6', boltCore: '#fffbe6', leaf: '#8fa66a',
      },
    },
    winter: {
      id: 'winter', snowCover: true, sun: 3, lean: 0, ink: ['dark', 'light'],
      body: { kind: 'sun' },
      P: {
        sky: ['#4696dd', '#dcf0fc'], under: ['#4696dd', '#dcf0fc'], haze: '#d3e8f7',
        far: '#93a9c4', mid: '#7c97b3', f1: '#56767f', f2: '#3a5c62', near: '#274846', dark: '#16302f',
        snow: '#f7fbfe', snowShade: '#bfd3e9', rime: '#ffffff', water: '#c2e0f1', waterHi: '#f0f9fe',
        cloud: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'], line: '#1c3040', trunk: '#3a2e28',
        wall: '#8b5e48', roof: '#5a3b2f', window: '#f3d9a0', smoke: '#eef2f6', flag: '#c9584a',
        sun: '#ffd36a', sunCore: '#fff6cf',
      },
    },
  };
  function themed(st, theme) { // dark theme: day scenes one step dimmer; night and storm skies are the same in both
    if (theme !== 'dark' || st.night || st.storm) return st.P;
    var P = {}, k;
    for (k in st.P) P[k] = Array.isArray(st.P[k]) ? st.P[k].map(function (c) { return mix(c, '#0c1430', 0.5); }) : mix(st.P[k], '#0c1430', 0.5);
    P.sun = st.P.sun; P.sunCore = st.P.sunCore; P.window = st.P.window;
    return P;
  }

  function svg(sceneId, style, o) {
    o = o || {};
    var st = SCENES[sceneId], P = themed(st, o.theme), A = style === 'A', B = style === 'B', C = style === 'C';
    var out = '', defs = '', n = 0, idp = 'w' + sceneId + style + (o.idp || '') + '-';
    var view = o.view || [0, 0, W, H], top = Math.min(0, view[1]) - 4, body = o.bodyAt || G.body;
    var LN = C ? { stroke: P.line, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } : {};
    var lean = st.lean || 0, lee = 1; // wind blows to the right
    function id(p) { return idp + p + n++; }
    function add(tag, a, inner) { out += el(tag, a, inner); }
    function path(d, fill, extra) { var a = { d: d, fill: fill }; for (var k in extra || {}) a[k] = extra[k]; add('path', a); }
    function lined(d, fill, extra) { var a = { d: d, fill: fill }, k; for (k in LN) a[k] = LN[k]; for (k in extra || {}) a[k] = extra[k]; add('path', a); }
    function grad(stops, a, radial) {
      var g = id('g'); a.id = g;
      defs += el(radial ? 'radialGradient' : 'linearGradient', a, stops.map(function (s) { return el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }); }).join(''));
      return 'url(#' + g + ')';
    }
    var lightRight = function (x) { return x < body[0]; }; // the lit side faces the body
    var hzCache = {};
    function hz(fill) { // the quiet side: every far layer fades toward the sky under the text
      if (!hzCache[fill]) { var m = mix(fill, P.haze, 0.6); hzCache[fill] = grad([[0, m], [0.5, m], [0.8, fill]], { x1: 0, y1: 0, x2: 1200, y2: 0, gradientUnits: 'userSpaceOnUse' }); }
      return hzCache[fill];
    }

    /* ---- 1 sky ---- */
    var skyStops = st.deck ? P.under : P.sky;
    add('rect', { x: 0, y: top, width: W, height: H - top, fill: grad([[0, skyStops[0]], [1, skyStops[1]]], { x1: 0, y1: 0, x2: 0, y2: 250, gradientUnits: 'userSpaceOnUse' }) });

    /* ---- 2 body (and the hole it shines through) ---- */
    var holeD = st.hole ? blob(body[0], body[1], 50, 5, 12) : '', holeIn = st.hole ? blob(body[0] - 1.5, body[1] + 2.5, 45.5, 5, 12) : '';
    if (st.hole) {
      path(holeD, grad([[0, P.sky[0]], [1, P.sky[1]]], { x1: 0, y1: body[1] - 60, x2: 0, y2: body[1] + 60, gradientUnits: 'userSpaceOnUse' }));
      var q = prng(21), sd = '';
      for (var i = 0; i < 9; i++) { var a = q() * 6.28, rr = 30 + q() * 16; sd += circ(body[0] + Math.cos(a) * rr * 1.1, body[1] + Math.sin(a) * rr * 0.9, 0.7 + q() * 0.7); }
      path(sd, P.star, { opacity: 0.8 });
    }
    if (st.body && st.body.kind === 'moon') {
      var R = 24, k = st.body.illum, rx = R * Math.abs(2 * k - 1);
      var lit = 'M0,' + -R + 'A' + R + ',' + R + ' 0 0,1 0,' + R + 'A' + f(rx) + ',' + R + ' 0 0,' + (k > 0.5 ? 1 : 0) + ' 0,' + -R + 'Z';
      var g = '';
      if (!A) g += el('circle', { r: R * 2.7, fill: grad([[0, P.moon, 0.34], [1, P.moon, 0]], { cx: 0, cy: 0, r: R * 2.7, gradientUnits: 'userSpaceOnUse' }, true) });
      else g += el('circle', { r: R * 1.75, fill: P.moon, opacity: 0.1 }) + el('circle', { r: R * 1.35, fill: P.moon, opacity: 0.12 });
      g += el('circle', { r: R, fill: P.moonDark });
      g += el('g', { transform: 'rotate(-18)' + (st.body.waxing ? '' : ' scale(-1,1)') }, el('path', { d: lit, fill: P.moon }) +
        el('path', { d: circ(4, -8, 5.5) + circ(-3, 5, 4) + circ(9, 7, 3) + circ(-8, -4, 2.6), fill: P.mare }));
      if (C) g += el('circle', { r: R, fill: 'none', stroke: P.line, 'stroke-width': 1.8 });
      add('g', { transform: 'translate(' + body[0] + ',' + body[1] + ')', 'data-layer': 'body' }, g);
    }
    if (st.body && st.body.kind === 'sun') {
      var Rs = 25, s = '';
      s += el('circle', { r: Rs * 3.4, fill: grad([[0, P.sunCore, 0.6], [0.45, P.sunCore, 0.22], [1, P.sunCore, 0]], { cx: 0, cy: 0, r: Rs * 3.4, gradientUnits: 'userSpaceOnUse' }, true) });
      if (!A) { // "how sunny": level 3 = full ring of rays
        var rd = '';
        for (var j = 0; j < 12; j++) {
          var an = (j / 12) * 6.283, r0 = Rs + 7, r1 = Rs + (j % 2 ? 17 : 24), w = 0.085;
          rd += 'M' + f(Math.cos(an - w) * r0) + ',' + f(Math.sin(an - w) * r0) + 'L' + f(Math.cos(an) * r1) + ',' + f(Math.sin(an) * r1) + 'L' + f(Math.cos(an + w) * r0) + ',' + f(Math.sin(an + w) * r0) + 'Z';
        }
        s += C ? el('path', { d: rd, fill: P.sun, stroke: P.line, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }) : el('path', { d: rd, fill: P.sun, opacity: 0.9 });
      } else s += el('circle', { r: Rs + 14, fill: P.sun, opacity: 0.35 });
      s += el('circle', { r: Rs, fill: P.sun, stroke: C ? P.line : null, 'stroke-width': C ? 1.8 : null }) + el('circle', { r: Rs * 0.62, fill: P.sunCore });
      add('g', { transform: 'translate(' + body[0] + ',' + body[1] + ')', 'data-layer': 'body' }, s);
    }

    /* ---- 3 clouds: the deck with its hole, or the storm ---- */
    function scallop(x0, x1, y, seed, depth, wMin, wMax, shear) { // lower edge of a cloud sheet, right → left
      var Y = typeof y === 'function' ? y : function () { return y; };
      var q = prng(seed), d = 'L' + x1 + ',' + f(Y(x1)), x = x1;
      while (x > x0) { var w = wMin + q() * (wMax - wMin), nx = Math.max(x0, x - w), dp = depth * (0.5 + q()), mx = (x + nx) / 2; d += 'Q' + f(mx + (shear || 0)) + ',' + f(Y(mx) + dp * 2) + ' ' + f(nx) + ',' + f(Y(nx) + (q() - 0.5) * depth * 0.5); x = nx; }
      return d;
    }
    function sheet(y, seed, depth, wMin, wMax, fill, shear) {
      var d = 'M0,' + top + 'L' + W + ',' + top + scallop(0, W, y, seed, depth, wMin, wMax, shear) + 'Z';
      if (C) lined(d, fill); else path(d, fill);
    }
    if (st.deck) {
      // three sheets, darkest lowest: it reads as a ceiling of rolls, not as a grey sky
      var mk = id('m');
      defs += el('mask', { id: mk, maskUnits: 'userSpaceOnUse', x: 0, y: top, width: W, height: H - top }, el('rect', { x: 0, y: top, width: W, height: H - top, fill: '#fff' }) + el('path', { d: holeD, fill: '#000' }));
      out += '<g data-layer="clouds" mask="url(#' + mk + ')">';
      sheet(140, 31, 7, 70, 150, P.cloud[0]);
      sheet(120, 32, 8, 60, 130, P.cloud[1]);
      sheet(96, 33, 8, 70, 140, P.cloud[2]);
      sheet(66, 34, 7, 80, 150, mix(P.cloud[2], P.cloud[3], 0.12));
      out += '</g>';
      // the lit rim of the hole and the light that spills onto the deck
      path(holeD + holeIn, P.cloud[3], { 'fill-rule': 'evenodd', opacity: A ? 0.85 : 0.95 });
      if (C) add('path', { d: holeIn, fill: 'none', stroke: P.line, 'stroke-width': 1.6 });
      if (!A) add('circle', { cx: body[0], cy: body[1], r: 150, fill: grad([[0.3, P.cloud[3], 0.4], [1, P.cloud[3], 0]], { cx: body[0], cy: body[1], r: 150, gradientUnits: 'userSpaceOnUse' }, true) });
      else path(blob(body[0], body[1], 74, 6, 12) + holeD, P.cloud[3], { 'fill-rule': 'evenodd', opacity: 0.16 });
    }
    if (st.storm) {
      var sh = lean * 60;
      // one dark base across the sky (higher over the text), billows with lit rims above it, towers on the right
      var baseY = function (x) { return x < 760 ? 86 : x > 1040 ? 124 : 86 + (38 * (x - 760)) / 280; };
      out += '<g data-layer="clouds">';
      sheet(baseY, 53, 5, 44, 96, P.cloud[0], sh * 0.5);
      var rim = '', lobes = '', lq = prng(52), x;
      for (var row = 0; row < 4; row++) {
        var y0 = [84, 44, -8, -70][row], x0 = [820, 900, 1010, 1120][row];
        for (x = x0; x < 1660; x += 58 + row * 14) {
          var r1 = (30 + lq() * 16) * (1 + row * 0.28), cy = y0 + (lq() - 0.5) * 16 - (x > 1100 ? 6 : 0), cx = x + sh * (0.3 + row * 0.25);
          lobes += circ(cx, cy, r1);
          rim += circ(cx - r1 * 0.16, cy - r1 * 0.2, r1 * 0.96);
        }
      }
      for (x = 60; x < 820; x += 150) lobes += circ(x + lq() * 40, 6 + lq() * 8, 70); // the flat anvil over the text side
      if (C) { lined(lobes, P.cloud[1], { 'stroke-width': 3.6 }); path(lobes, P.cloud[1]); } else { path(rim, P.cloud[3], { opacity: A ? 0.5 : 0.75 }); path(lobes, P.cloud[1]); }
      if (!A) path('M0,' + top + 'L' + W + ',' + top + 'L' + W + ',60' + scallop(0, W, function (x) { return baseY(x) - 22; }, 54, 3, 60, 130, sh * 0.5) + 'Z', P.cloud[1], { opacity: 0.001 });
      out += '</g>';
    }

    /* ---- 4 mountains ---- */
    function capPath(crest, pk, depth) {
      var lim = pk[1] + depth, L = [], Rr = [], i, x;
      for (x = pk[0]; x > pk[0] - 140; x -= 3) { if (yAt(crest, x) > lim) break; L.push(x); }
      for (x = pk[0]; x < pk[0] + 140; x += 3) { if (yAt(crest, x) > lim) break; Rr.push(x); }
      var xl = L[L.length - 1], xr = Rr[Rr.length - 1], up = crest.filter(function (p) { return p[0] > xl && p[0] < xr; });
      var d = 'M' + f(xl) + ',' + f(yAt(crest, xl)) + up.map(function (p) { return 'L' + f(p[0]) + ',' + f(p[1]); }).join('') + 'L' + f(xr) + ',' + f(yAt(crest, xr));
      var nz = Math.max(3, Math.round((xr - xl) / 11)), q2 = prng(Math.round(pk[0]));
      for (i = 1; i < nz; i++) { var t = i / nz, zx = xr + (xl - xr) * t; d += 'L' + f(zx) + ',' + f(lim + (i % 2 ? depth * (0.25 + q2() * 0.45) : -depth * (0.2 + q2() * 0.3))); }
      return d + 'Z';
    }
    function shadeFace(crest, pk, baseY, reach) { // the face turned away from the body: crest → gully → foot → zig-zag arête
      var dir = lightRight(pk[0]) ? -1 : 1, x, d = 'M' + pk[0] + ',' + pk[1], vx = pk[0], vy = pk[1];
      for (x = pk[0] + dir * 4; Math.abs(x - pk[0]) < reach; x += dir * 4) { var y = yAt(crest, x); if (y < vy - 2.5 && vy - pk[1] > 10) break; d += 'L' + f(x) + ',' + f(y); vx = x; vy = Math.max(vy, y); }
      var q3 = prng(Math.round(pk[0] * 3)), fx = pk[0] - dir * (baseY - pk[1]) * 0.1, steps = 5;
      d += 'L' + f(vx + dir * 3) + ',' + f((vy + baseY) / 2) + 'L' + f(vx + dir * 9) + ',' + baseY + 'L' + f(fx) + ',' + baseY;
      for (var s2 = steps - 1; s2 > 0; s2--) { var t = s2 / steps; d += 'L' + f(pk[0] + (fx - pk[0]) * t + (s2 % 2 ? 1 : -1) * (2 + q3() * 3.5)) + ',' + f(pk[1] + (baseY - pk[1]) * t); }
      return d + 'Z';
    }
    function hatch(crest, pk, len, reach) { // style C: short strokes down the shaded face
      var dir = lightRight(pk[0]) ? -1 : 1, d = '', x;
      for (x = pk[0] + dir * 7; Math.abs(x - pk[0]) < reach; x += dir * 9) { var y = yAt(crest, x) + 4, l = len * (1 - Math.abs(x - pk[0]) / reach * 0.5); d += 'M' + f(x) + ',' + f(y) + 'l' + f(dir * l * 0.35) + ',' + f(l); }
      return d;
    }
    function range(line, peaks, fill, seed, amp, step, baseY, capK, layer) {
      var crest = jag(line, seed, amp, step), d = pts([[0, H]].concat(crest, [[W, H]]), true);
      out += '<g data-layer="' + layer + '">';
      if (C) lined(d, hz(fill)); else path(d, hz(fill));
      var caps = '', shade = '', hs = '';
      peaks.forEach(function (pk) {
        var size = pk[2] == null ? 0.5 : pk[2];
        var depth = size === 0.5001 ? 0 : (st.snowCover ? 34 : 16) * size * capK;
        if (depth > 4) caps += capPath(crest, pk, depth);
        if (B && size >= 0.5) shade += shadeFace(crest, pk, baseY, 110 * Math.max(0.5, size));
        if (C) hs += hatch(crest, pk, 30 * Math.max(0.5, size), 70 * Math.max(0.5, size));
      });
      if (st.snowCover && layer === 'ridgeFar') { // snow lies on the whole massif: rock only shows on the steep faces
        path(d, P.snow, { opacity: 0.55 });
      }
      if (caps) { if (C) lined(caps, P.snow, { 'stroke-width': 1.3 }); else path(caps, P.snow, { opacity: A ? 0.9 : 1 }); }
      if (shade) path(shade, st.snowCover ? P.snowShade : P.dark, { opacity: st.snowCover ? 0.75 : 0.34 });
      if (hs) add('path', { d: hs, fill: 'none', stroke: P.line, 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.6 });
      if (st.frost && !st.snowCover && !A) add('path', { d: pts(crest), fill: 'none', stroke: P.rime, 'stroke-width': 1, opacity: 0.25 });
      out += '</g>';
    }
    range(G.far, G.peaks, P.far, 11, 5, 16, 215, 1, 'ridgeFar');
    range(G.mid, G.midPeaks.map(function (p) { return [p[0], p[1], st.snowCover ? 0.5 : p[0] > 1000 ? 0.5001 : 0]; }), st.snowCover ? mix(P.mid, P.snow, 0.35) : P.mid, 12, 3.5, 20, 240, 1, 'ridgeMid');

    /* ---- 5 forest in staffels ---- */
    function coniferD(x, yb, h, acc, tiers) {
      var w = h * 0.4, t = tiers || 3, sx = function (px, py) { var dy = yb - py; return f(px + lee * lean * dy * (0.45 + (0.9 * dy) / h)) + ',' + f(py); };
      acc.full += 'M' + sx(x - h * 0.035, yb) + 'L' + sx(x - h * 0.035, yb - h * 0.2) + 'L' + sx(x + h * 0.035, yb - h * 0.2) + 'L' + sx(x + h * 0.035, yb) + 'Z';
      for (var i = 0; i < t; i++) {
        var b = yb - h * (0.13 + (0.72 / t) * i), a = i === t - 1 ? yb - h : b - h * (1.25 / t), ww = w * (1 - (0.62 / t) * i);
        acc.full += 'M' + sx(x - ww, b) + 'L' + sx(x, a) + 'L' + sx(x + ww, b) + 'Z';
        var side = lightRight(x) ? -1 : 1;
        acc.shade += 'M' + sx(x, a) + 'L' + sx(x + side * ww, b) + 'L' + sx(x, b) + 'Z';
        acc.snow += 'M' + sx(x - ww * 0.62, b - (b - a) * 0.36) + 'L' + sx(x, a) + 'L' + sx(x + ww * 0.62, b - (b - a) * 0.36) + 'L' + sx(x + ww * 0.2, b - (b - a) * 0.5) + 'L' + sx(x - ww * 0.25, b - (b - a) * 0.3) + 'Z';
      }
    }
    function skyline(line, seed, sMin, sMax, hMin, hMax, fill, layer, snowK) {
      var q = prng(seed), x = -10, d = 'M-10,' + H, tips = '';
      while (x < W + 10) {
        var s = sMin + q() * (sMax - sMin), h = hMin + q() * (hMax - hMin) * (q() > 0.85 ? 1.5 : 1), yb = yAt(line, Math.max(0, Math.min(W, x + s / 2)));
        var tx = x + s / 2 + lee * lean * h * 1.1;
        d += 'L' + f(x) + ',' + f(yb) + 'L' + f(tx - s * 0.16) + ',' + f(yb - h * 0.52) + 'L' + f(tx - s * 0.3) + ',' + f(yb - h * 0.5) + 'L' + f(tx) + ',' + f(yb - h) +
          'L' + f(tx + s * 0.3) + ',' + f(yb - h * 0.5) + 'L' + f(tx + s * 0.16) + ',' + f(yb - h * 0.52);
        tips += 'M' + f(tx - s * 0.26) + ',' + f(yb - h * 0.56) + 'L' + f(tx) + ',' + f(yb - h) + 'L' + f(tx + s * 0.26) + ',' + f(yb - h * 0.56) + 'L' + f(tx) + ',' + f(yb - h * 0.7) + 'Z';
        x += s;
      }
      d += 'L' + (W + 10) + ',' + H + 'Z';
      out += '<g data-layer="' + layer + '">';
      if (C) lined(d, hz(fill), { 'stroke-width': 1.4 }); else path(d, hz(fill));
      if (st.snowCover) path(tips, P.snow, { opacity: snowK });
      else if (st.frost && !A) path(tips, P.rime, { opacity: 0.22 });
      out += '</g>';
    }
    function mist(y, h, op) { add('rect', { x: 0, y: y, width: W, height: h, fill: grad([[0, P.haze, 0], [1, P.haze, op]], { x1: 0, y1: 0, x2: 0, y2: 1 }) }); }
    if (A) mist(196, 50, 0.5);
    skyline(G.f1, 61, C ? 13 : 8, C ? 20 : 13, 9, 15, P.f1, 'forestFar', 0.8);
    /* ---- 6 water ---- */
    if (A) mist(232, 34, 0.42);
    out += '<g data-layer="water">';
    if (C) lined(pts(G.shore, true), P.water); else path(pts(G.shore, true), P.water);
    if (!A && !st.snowCover) { // the range stands in the water
      var rf = 'M985,266';
      for (x = 985; x <= 1345; x += 12) rf += 'L' + x + ',' + f(264 + Math.max(0, 196 - yAt(G.far, x)) * 0.3);
      path(rf + 'L1345,262Z', P.far, { opacity: 0.45 });
    }
    var wd = '', wq = prng(71);
    if (st.body && !st.snowCover) { // the body's light on the water
      for (i = 0; i < 5; i++) { var ww2 = 6 + i * 5 + wq() * 14; wd += 'M' + f(body[0] - ww2 / 2 + (wq() - 0.5) * 16) + ',' + f(270 + i * 5.6 + wq() * 2) + 'h' + f(ww2); }
      add('path', { d: wd, fill: 'none', stroke: P.waterHi, 'stroke-width': 1.7, 'stroke-linecap': 'round', opacity: 0.6 });
      if (st.frost) add('path', { d: 'M985,267L1040,261L1120,264L1210,259L1290,263L1345,258', fill: 'none', stroke: P.rime, 'stroke-width': 2.4, opacity: 0.5 }); // a rim of ice
    } else if (st.snowCover) { // frozen: ice streaks and snow patches
      path('M1000,272l60,-4l44,5l-52,5ZM1150,282l70,-5l56,6l-60,6ZM1240,266l50,-2l30,4l-44,3Z', P.snow, { opacity: 0.85 });
      add('path', { d: 'M1010,290l80,-6M1110,270l60,3M1200,292l90,-3M1060,280l30,2', fill: 'none', stroke: P.waterHi, 'stroke-width': 1.6, 'stroke-linecap': 'round' });
    } else { // wind and rain: chevrons and rings
      for (i = 0; i < 16; i++) { var cx2 = 1000 + wq() * 330, cy2 = 268 + wq() * 28; wd += 'M' + f(cx2) + ',' + f(cy2) + 'l7,-2.5l7,2.5'; }
      add('path', { d: wd, fill: 'none', stroke: P.waterHi, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.7 });
    }
    out += '</g>';
    skyline([[0, 264], [400, 259], [800, 263], [985, 258], [985, 400]], 62, C ? 20 : 12, C ? 30 : 19, 16, 26, P.f2, 'forestNear', 0.9);
    // right of the lake the second staffel stands behind the hut
    (function () {
      var acc = { full: '', shade: '', snow: '' }, q = prng(63), x = 1352;
      while (x < 1600) { var h = 26 + q() * 22; coniferD(x, yAt(G.f2, x) + 14, h, acc, 3); x += 10 + q() * 12; }
      if (C) lined(acc.full, P.f2, { 'stroke-width': 1.4 }); else path(acc.full, P.f2);
      if (B) path(acc.shade, P.dark, { opacity: 0.3 });
      if (st.snowCover) path(acc.snow, P.snow, { opacity: 0.9 }); else if (st.frost && !A) path(acc.snow, P.rime, { opacity: 0.2 });
    })();

    /* ---- 7 foreground: ground, path, hut, smoke, fence, flag, trees ---- */
    out += '<g data-layer="near">';
    var gfill = st.snowCover ? P.snow : st.storm ? P.meadow : P.near, gd = pts([[0, H]].concat(G.ground, [[W, H]]), true);
    if (C) lined(gd, gfill); else path(gd, gfill);
    if (st.snowCover) { // drifts and long blue shadows (low sun behind the scene)
      path('M0,300Q200,292 420,302T860,298L880,320L0,320Z M1350,292Q1450,280 1600,286L1600,320L1340,320Z', P.snowShade, { opacity: 0.55 });
    }
    if (st.frost && !st.snowCover) add('path', { d: pts(G.ground), fill: 'none', stroke: P.rime, 'stroke-width': 2.6, opacity: A ? 0.3 : 0.45 }); // hoar frost on the grass
    if (st.storm) path('M0,304Q240,296 520,306T985,304L985,320L0,320Z M1360,290Q1470,280 1600,284L1600,320L1350,320Z', P.near, { opacity: 0.6 });
    if (!A) { // the way to the hut
      var way = 'M1404,268C1390,280 1420,290 1400,300C1388,308 1400,314 1396,320L1424,320C1426,312 1412,308 1424,298C1440,288 1408,280 1416,268Z';
      path(way, st.snowCover ? P.snowShade : mix(gfill, P.haze, 0.3), { opacity: st.snowCover ? 0.7 : 0.8 });
    }
    // shadows on snow
    if (st.snowCover) {
      var shd = '';
      G.nearTrees.forEach(function (t) { var dx = (t[0] - body[0]) * 0.5, l = t[2] * 0.5; shd += 'M' + f(t[0] - 5) + ',' + t[1] + 'L' + f(t[0] + 5) + ',' + t[1] + 'L' + f(t[0] + dx * 0.35 + 9) + ',' + f(t[1] + l) + 'L' + f(t[0] + dx * 0.35 - 12) + ',' + f(t[1] + l) + 'Z'; });
      shd += 'M1392,268L1452,266L1486,286L1410,290Z';
      path(shd, P.snowShade, { opacity: 0.8 });
    }
    // fence
    var fd = '';
    [[1350, 1384], [1462, 1600]].forEach(function (seg) {
      var r1 = '', r2 = '';
      for (var x = seg[0]; x <= seg[1]; x += 16) { var gy = yAt(G.ground, x); fd += 'M' + x + ',' + f(gy + 1) + 'v-13'; r1 += (r1 ? 'L' : 'M') + x + ',' + f(gy - 9); r2 += (r2 ? 'L' : 'M') + x + ',' + f(gy - 4); }
      fd += r1 + r2;
    });
    add('path', { d: fd, fill: 'none', stroke: st.snowCover ? P.trunk : P.dark, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: st.snowCover ? 0.75 : 1 });
    // hut
    var hx = 1392, hy = 269;
    if (A) {
      path('M' + hx + ',' + hy + 'v-20l-5,0l19,-18l8,7v-6h7v13l16,2l8,16l-6,0v6Z', st.snowCover ? P.wall : P.dark);
      if (st.snowCover) path('M' + (hx - 5) + ',' + (hy - 20) + 'l19,-18l33,3l8,17l-8,-2l-6,-11l-26,-2l-15,14Z', P.snow);
    } else {
      var gable = 'M' + hx + ',' + hy + 'v-20l14,-16l14,16v20Z', side = 'M' + (hx + 28) + ',' + hy + 'v-20l30,-2v20Z';
      var roof = 'M' + (hx + 14) + ',' + (hy - 38) + 'l31,-2l17,19l-34,2Z', eave = 'M' + (hx - 4) + ',' + (hy - 17) + 'l18,-21l3,3l-17,20Z';
      var chim = 'M' + (hx + 40) + ',' + (hy - 44) + 'h7v12h-7Z';
      if (C) { lined(chim, P.roof); lined(side, mix(P.wall, P.dark, 0.35)); lined(gable, P.wall); lined(roof, st.snowCover ? P.snow : P.roof); lined(eave, st.snowCover ? P.snow : P.roof); }
      else { path(chim, P.roof); path(side, mix(P.wall, P.dark, 0.4)); path(gable, P.wall); path(roof, st.snowCover ? P.snow : P.roof); path(eave, st.snowCover ? P.snowShade : mix(P.roof, P.dark, 0.3)); }
      if (st.snowCover) path('M' + (hx + 39) + ',' + (hy - 46) + 'h9v3h-9Z', P.snow);
      path('M' + (hx + 10) + ',' + hy + 'v-10h7v10Z', mix(P.wall, P.dark, 0.6));
    }
    path('M' + (hx + 36) + ',' + (hy - 15) + 'h9v8h-9Z', P.window); // the lit window
    if (st.night && !A) add('circle', { cx: hx + 40, cy: hy - 11, r: 22, fill: grad([[0, P.window, 0.3], [1, P.window, 0]], { cx: hx + 40, cy: hy - 11, r: 22, gradientUnits: 'userSpaceOnUse' }, true) });
    // smoke: still air → it stands straight up and spreads; wind → a flat streak to the lee
    var sx0 = hx + 43.5, sy0 = hy - 45;
    if (!lean) {
      var sm = '', sq = prng(81);
      for (i = 0; i < 6; i++) sm += circ(sx0 + (sq() - 0.5) * (3 + i * 2) + i * 0.8, sy0 - 5 - i * 10, 3.2 + i * 1.7);
      if (C) lined(sm, P.smoke, { 'stroke-width': 1.3 }); else path(sm, P.smoke, { opacity: A ? 0.75 : 0.85 });
    } else {
      var smk = 'M' + sx0 + ',' + sy0 + 'q6,-7 26,-9q34,-3 66,-1q-30,6 -58,8q-22,2 -30,6Z';
      if (C) lined(smk, P.smoke, { 'stroke-width': 1.3 }); else path(smk, P.smoke, { opacity: 0.8 });
    }
    // flag
    var fx = 1478, fy = yAt(G.ground, 1478);
    add('path', { d: 'M' + fx + ',' + f(fy) + 'v-60', fill: 'none', stroke: st.snowCover ? P.trunk : P.dark, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    var cloth = lean ? 'M' + fx + ',' + f(fy - 59) + 'q10,-5 19,-1t19,-1l-1,15q-9,4 -18,1t-19,2Z' : 'M' + fx + ',' + f(fy - 59) + 'l8,3l-2,22l-6,-4Z';
    if (C) lined(cloth, P.flag, { 'stroke-width': 1.4 }); else path(cloth, P.flag);
    // near trees
    var acc2 = { full: '', shade: '', snow: '' };
    G.nearTrees.forEach(function (t) { coniferD(t[0], t[1], t[2], acc2, t[2] > 80 ? 5 : t[2] > 50 ? 4 : 3); });
    var ncol = st.snowCover ? P.near : P.dark;
    if (C) lined(acc2.full, st.snowCover || st.storm ? P.near : P.f2); else path(acc2.full, ncol);
    if (B) path(acc2.shade, st.snowCover ? P.dark : P.f1, { opacity: st.snowCover ? 0.5 : 0.55 });
    if (st.snowCover) { if (C) lined(acc2.snow, P.snow, { 'stroke-width': 1.1 }); else path(acc2.snow, P.snow); }
    else if (st.frost) path(acc2.snow, P.rime, { opacity: A ? 0.22 : 0.4 });
    // broadleaf trees: full crowns in summer, bare branches in winter
    G.leaf.forEach(function (t, ti) {
      var x0 = t[0], y0 = t[1], r2 = t[2], k2 = lee * lean;
      if (st.storm) {
        var cxr = x0 + k2 * 42, cyr = y0 - r2 * 2.1, cr = '';
        add('path', { d: 'M' + x0 + ',' + y0 + 'Q' + f(x0 + k2 * 6) + ',' + f(y0 - r2) + ' ' + f(cxr) + ',' + f(cyr), fill: 'none', stroke: P.trunk, 'stroke-width': 3, 'stroke-linecap': 'round' });
        if (A) cr = pts([[cxr - r2, cyr + 4], [cxr - r2 * 0.7, cyr - r2 * 0.8], [cxr, cyr - r2 * 1.1], [cxr + r2 * 1.2, cyr - r2 * 0.7], [cxr + r2 * 1.5, cyr + 2], [cxr + r2 * 0.6, cyr + r2 * 0.7], [cxr - r2 * 0.5, cyr + r2 * 0.6]], true);
        else cr = circ(cxr - r2 * 0.5, cyr + 1, r2 * 0.62) + circ(cxr + r2 * 0.1, cyr - r2 * 0.5, r2 * 0.7) + circ(cxr + r2 * 0.75, cyr - r2 * 0.1, r2 * 0.62) + circ(cxr + r2 * 0.2, cyr + r2 * 0.3, r2 * 0.6);
        if (C) lined(cr, P.f1, { 'stroke-width': 1.4 }); else path(cr, P.f1);
        if (B) path(circ(cxr + r2 * 0.35, cyr + r2 * 0.35, r2 * 0.5), P.dark, { opacity: 0.35 });
      } else {
        var br = 'M' + x0 + ',' + y0 + 'v' + f(-r2 * 1.5) + 'M' + x0 + ',' + f(y0 - r2 * 0.9) + 'l' + f(-r2 * 0.8) + ',' + f(-r2 * 1.1) + 'M' + x0 + ',' + f(y0 - r2 * 1.1) + 'l' + f(r2 * 0.85) + ',' + f(-r2) +
          'M' + x0 + ',' + f(y0 - r2 * 1.5) + 'l' + f(-r2 * 0.35) + ',' + f(-r2 * 0.9) + 'M' + x0 + ',' + f(y0 - r2 * 1.5) + 'l' + f(r2 * 0.4) + ',' + f(-r2 * 0.8) +
          'M' + f(x0 - r2 * 0.5) + ',' + f(y0 - r2 * 1.6) + 'l' + f(-r2 * 0.5) + ',' + f(-r2 * 0.25) + 'M' + f(x0 + r2 * 0.55) + ',' + f(y0 - r2 * 1.75) + 'l' + f(r2 * 0.5) + ',' + f(-r2 * 0.15);
        add('path', { d: br, fill: 'none', stroke: st.snowCover ? P.trunk : P.dark, 'stroke-width': 2, 'stroke-linecap': 'round' });
        if (st.frost || st.snowCover) add('path', { d: br, fill: 'none', stroke: st.snowCover ? P.snow : P.rime, 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: st.snowCover ? 0.9 : 0.55, transform: 'translate(-0.6 -0.9)' });
      }
    });
    // grass tufts (storm: they lie over), rocks at the shore
    if (!st.snowCover) {
      var tf = '', tq = prng(91);
      for (i = 0; i < (A ? 14 : 26); i++) { var tx2 = 880 + tq() * 720; if (tx2 > 985 && tx2 < 1345) continue; var ty = yAt(G.ground, tx2) + 3 + tq() * 22, k3 = lean * 22; tf += 'M' + f(tx2) + ',' + f(ty) + 'l' + f(-2 + k3) + ',-7M' + f(tx2 + 3) + ',' + f(ty) + 'l' + f(1 + k3) + ',-9M' + f(tx2 + 6) + ',' + f(ty) + 'l' + f(3 + k3) + ',-6'; }
      add('path', { d: tf, fill: 'none', stroke: st.frost ? P.rime : P.f1, 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: st.frost ? 0.4 : 0.9 });
    }
    if (!A) {
      var rocks = 'M990,300l6,-9l10,-2l7,11Z M1322,300l5,-7l9,1l4,6Z M1262,300l4,-4l7,1l2,3Z';
      if (C) lined(rocks, st.snowCover ? P.mid : P.f1, { 'stroke-width': 1.3 }); else path(rocks, st.snowCover ? P.mid : P.f1);
      if (st.snowCover) path('M992,293l4,-2l10,-2l4,5l-9,-2Z M1324,295l3,-2l9,1l2,3Z', P.snow);
    }
    // sparkle on snow, puddles in the storm
    if (st.snowCover && !A) {
      var sp = '', pq2 = prng(95);
      for (i = 0; i < 8; i++) { var px = 900 + pq2() * 680, py = 290 + pq2() * 24; sp += 'M' + f(px) + ',' + f(py - 4) + 'l1,3l3,1l-3,1l-1,3l-1,-3l-3,-1l3,-1Z'; }
      path(sp, P.rime);
    }
    if (st.storm) {
      path('M1440,300a26,4.5 0 1,0 52,0a26,4.5 0 1,0 -52,0Z M1530,310a20,3.6 0 1,0 40,0a20,3.6 0 1,0 -40,0Z M905,306a22,4 0 1,0 44,0a22,4 0 1,0 -44,0Z', P.water, { opacity: 0.9 });
      add('path', { d: 'M1456,300a10,2 0 1,0 20,0M1544,310a7,1.6 0 1,0 14,0M918,306a8,1.8 0 1,0 16,0', fill: 'none', stroke: P.waterHi, 'stroke-width': 1.2, opacity: 0.8 });
    }
    out += '</g>';

    /* ---- 8 bolts: more storm = more drawn bolts, none of them flashes ---- */
    if (st.storm) {
      function bolt(p, wd0, op) {
        var L = [], Rr = [];
        p.forEach(function (q0, i2) { var w = wd0 * (1 - i2 / p.length) + 0.6; L.push([q0[0] - w, q0[1]]); Rr.unshift([q0[0] + w * (i2 % 2 ? 1.6 : 0.6), q0[1] + (i2 % 2 ? 0 : 2)]); });
        var d = pts(L.concat(Rr), true);
        if (C) lined(d, P.bolt, { 'stroke-width': 1.3, opacity: op }); else path(d, P.bolt, { opacity: op });
        if (!A) add('path', { d: pts(p), fill: 'none', stroke: P.boltCore, 'stroke-width': Math.max(0.8, wd0 * 0.35), opacity: op, 'stroke-linejoin': 'round' });
      }
      add('circle', { cx: 1216, cy: 124, r: 52, fill: grad([[0, P.bolt, 0.34], [1, P.bolt, 0]], { cx: 0.5, cy: 0.5, r: 0.5 }, true) }); // a still glow where the main bolt leaves the cloud (no flash)
      out += '<g data-layer="event">';
      bolt([[1218, 120], [1204, 150], [1220, 156], [1196, 190], [1212, 195], [1184, 236]], 5, 1);
      bolt([[1204, 152], [1226, 172], [1220, 178], [1244, 204]], 2.4, 0.9);
      bolt([[1462, 120], [1452, 146], [1466, 151], [1448, 182], [1458, 186], [1446, 212]], 3.4, 0.95);
      bolt([[1040, 118], [1032, 140], [1042, 144], [1026, 172], [1034, 176], [1024, 196]], 2.2, 0.6);
      out += '</g>';
    }

    /* ---- 10 rain: heavy = dense, long, slanted, with splashes ---- */
    if (st.rain) {
      var rq = prng(101), slant = 0.42 * lee, back = '', front = '', quiet = '', spl = '';
      for (i = 0; i < 170; i++) {
        var rx2 = rq() * (W + 120) - 120, ry = 124 + rq() * 190, len = 15 + rq() * 13, seg = 'M' + f(rx2) + ',' + f(ry) + 'l' + f(len * slant) + ',' + f(len);
        if (rx2 < 880) { if (i % 2) quiet += seg; } else if (i % 3) front += seg; else back += seg;
      }
      for (i = 0; i < 26; i++) { var px2 = 900 + rq() * 690, py2 = (px2 > 985 && px2 < 1345 ? 266 + rq() * 30 : yAt(G.ground, px2) + 2 + rq() * 20); spl += 'M' + f(px2 - 3.5) + ',' + f(py2 - 3) + 'l3.5,3l4,-3.6'; }
      out += '<g data-layer="precip" fill="none" stroke="' + P.rain + '" stroke-linecap="round">' +
        el('path', { d: quiet, 'stroke-width': 1.2, opacity: 0.22 }) + el('path', { d: back, 'stroke-width': 1.1, opacity: 0.4 }) +
        el('path', { d: front, 'stroke-width': 1.9, opacity: 0.7 }) + el('path', { d: spl, 'stroke-width': 1.2, opacity: 0.75 }) + '</g>';
    }
    /* ---- 11 wind: leaves fly to the lee ---- */
    if (lean) {
      var lf = '', lq2 = prng(111);
      for (i = 0; i < 8; i++) { var lx = 980 + lq2() * 560, ly = 150 + lq2() * 110, ra = lq2() * 60 - 30; lf += '<path d="M-4,0q4,-3.5 8,0q-4,3.5 -8,0Z" transform="translate(' + f(lx) + ' ' + f(ly) + ') rotate(' + f(ra) + ')"/>'; }
      out += '<g data-layer="wind" fill="' + P.leaf + '" opacity="0.9">' + lf + '</g>';
      add('path', { d: 'M1040,214q40,-9 84,-2M1270,232q34,-8 70,-1M1108,246q26,-6 52,-1', fill: 'none', stroke: P.rain, 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.35, 'data-layer': 'wind' });
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + view.join(' ') + '" preserveAspectRatio="xMaxYMax slice" width="100%" height="100%" aria-hidden="true" focusable="false">' +
      '<defs>' + defs + '</defs>' + out + '</svg>';
  }
  function count(s) { return (s.match(/<(path|rect|circle|ellipse|g|stop|linearGradient|radialGradient)\b/g) || []).length; }
  window.Styles = { svg: svg, scenes: SCENES, G: G, count: count, ink: function (id, theme) { return SCENES[id].ink[theme === 'dark' ? 1 : 0]; } };
})();
