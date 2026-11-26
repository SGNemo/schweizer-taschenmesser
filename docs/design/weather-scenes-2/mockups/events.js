/* Sky events in the round-2 drawing (mockup). Ported from round 1 (weather-scenes/mockups/scene.js: eventLayer, auroraLayer,
   the eclipse parts of moonBody / sunBody, the milky way of starsLayer, the dust sun). Each event hangs into Scene.hooks:
     sky(X)        after the sky and the stars, before the body (aurora, meteors, milky way, eclipse sky)
     body(X, pale) returns { svg, replace: true } to draw the body itself (eclipses, dust sun; rainbow: no sun disc at all)
     behindLand(X) after the massif, before the hills (rainbow, dust haze)
     skyKey(s)     an event may pick its sky (solarTotal → 'eclipse-sky')
   Geometry follows the new picture: the body is X.body, the summits are in Scene.G.mountains (top y 76…131 between x 956 and 1600).
   Nothing with hard contrast left of x 900 (the text side). Colours: palette.js `c` (event block at its end). Never animated. */
(function () {
  var E = {
    meteors: [[1258, 60, 104], [1478, 44, 70], [1064, 70, 62]], // head x, y, tail length (up and to the right, 32°)
    milky: { cx: 1260, cy: 92, rx: 420, ry: 42, rot: -14, op: 0.13, n: 70 },
    rainbow: { cx: 1290, cy: 300, r: 190, w: 5, op: 0.72, fade: [196, 258] }, // the antisolar arc: legs at x 1100 and 1480, top at y 110
    aurora: { bands: [[985, 1290, 162, 1, 0], [1100, 1490, 146, 0.85, 1.7], [1310, 1630, 156, 0.7, 3.1], [1020, 1210, 170, 0.5, 4.4]], few: 2, // bases raised over round 1 (198…206) so the curtains stand above the massif's summits
      h: 128, top: 24, op: [0.2, 0.3], glow: [1260, 160, 520, 90], left: 960 },
    left: 900, // stars added by an event stay right of here
  };
  function amount(X, d) { var a = X.s.eventAmount; return a == null ? d : Math.max(0, Math.min(1, a)); }
  function moreStars(X, n, seed) { // extra stars on the scene side, three brightnesses
    var q = X.prng(seed), d = ['', '', ''], y0 = X.top;
    for (var i = 0; i < n; i++) {
      var x = E.left + q() * (1600 - E.left), y = y0 + q() * (150 - y0), r = 0.5 + q() * 0.9;
      if (Math.hypot(x - X.body[0], y - X.body[1]) < 46) continue;
      d[i % 3] += X.circ(x, y, r);
    }
    return [0.45, 0.7, 0.95].map(function (op, j) { return d[j] ? X.el('path', { d: d[j], fill: X.PAL.c.star, opacity: op }) : ''; }).join('');
  }
  function wrapBody(X, inner) { return X.el('g', { transform: 'translate(' + X.f(X.body[0]) + ',' + X.f(X.body[1]) + ')', 'data-layer': 'body', 'data-mode': X.mode, 'data-event': X.s.event }, inner); }

  /* ---- sun with an eclipse ---- */
  function sunEclipse(X) {
    var s = X.s, c = X.PAL.c, ev = s.event, R = 25, out = '';
    if (ev === 'solarTotal') {
      var petals = '';
      for (var i = 0; i < 6; i++) { // soft, rounded corona petals
        var a = i * 60 + 18 + (i % 2) * 9, L = R * (i % 2 ? 1.55 : 1.85), w = R * 0.55;
        petals += X.el('path', { d: 'M0,' + X.f(-w) + 'C' + X.f(L * 0.6) + ',' + X.f(-w) + ' ' + X.f(L) + ',' + X.f(-w * 0.25) + ' ' + X.f(L) + ',0C' + X.f(L) + ',' + X.f(w * 0.25) + ' ' + X.f(L * 0.6) + ',' + X.f(w) + ' 0,' + X.f(w) + 'Z', transform: 'rotate(' + a + ')' });
      }
      out += X.el('circle', { r: R * 2.8, fill: X.grad([[0, '#ffffff', 0.85], [0.36, '#ffffff', 0.45], [1, '#ffffff', 0]], { cx: 0.5, cy: 0.5, r: 0.5 }, true) });
      out += X.el('g', { fill: '#ffffff', opacity: 0.42 }, petals) + X.el('circle', { r: R, fill: c['eclipse-disc'] });
      return wrapBody(X, out);
    }
    var amt = ev === 'solarPartial' ? amount(X, 0.5) : 0.85;
    out += X.el('circle', { r: R * 3.4, fill: X.grad([[0, c['sun-core'], 0.6 * (1 - amt * 0.7)], [0.45, c['sun-core'], 0.22 * (1 - amt * 0.7)], [1, c['sun-core'], 0]], { cx: 0.5, cy: 0.5, r: 0.5 }, true) });
    var disc = X.el('circle', { r: R, fill: c.sun }) + (ev === 'solarAnnular' ? X.el('circle', { r: R * 0.86, fill: c['eclipse-disc'] }) : X.el('circle', { r: R * 0.62, fill: c['sun-core'] }));
    if (ev === 'solarPartial') { // the moon's bite from the upper right: a mask, so the sky shows through it
      var m = X.id('m'), d = 2 * R * (1 - amt), k = Math.SQRT1_2, b = R * 1.2;
      out += X.el('mask', { id: m, maskUnits: 'userSpaceOnUse', x: -b, y: -b, width: 2 * b, height: 2 * b },
        X.el('rect', { x: -b, y: -b, width: 2 * b, height: 2 * b, fill: '#ffffff' }) + X.el('circle', { cx: X.f(d * k), cy: X.f(-d * k), r: R + 0.5, fill: '#000000' }));
      disc = X.el('g', { mask: 'url(#' + m + ')' }, disc);
    }
    return wrapBody(X, out + disc);
  }

  /* ---- moon with an eclipse (full moon, the designer's shape) ---- */
  function moonEclipse(X, pale) {
    var s = X.s, c = X.PAL.c, R = 24 * (s.moon ? s.moon.size : 1), out = '';
    if (s.event === 'lunarTotal') { // copper moon, no glow
      out += X.el('circle', { r: R, fill: X.grad([[0, c['eclipse-red'], 1], [0.7, c['eclipse-red'], 1], [1, c['eclipse-red-dark'], 1]], { cx: 0.5, cy: 0.5, r: 0.5 }, true) });
      out += X.el('path', { d: X.circ(R * 0.17, -R * 0.33, R * 0.23) + X.circ(-R * 0.12, R * 0.21, R * 0.17) + X.circ(R * 0.38, R * 0.3, R * 0.12), fill: c['eclipse-red-dark'], opacity: 0.45 });
      return wrapBody(X, out);
    }
    out += X.el('circle', { r: R * 2.7, fill: X.radial(c.moon, pale ? 0.5 : 0.34, 0) });
    out += X.el('circle', { r: R, fill: c.moon });
    out += X.el('path', { d: X.circ(R * 0.17, -R * 0.33, R * 0.23) + X.circ(-R * 0.12, R * 0.21, R * 0.17) + X.circ(R * 0.38, R * 0.3, R * 0.12) + X.circ(-R * 0.33, -R * 0.17, R * 0.11), fill: c['moon-mare'] });
    var cl = X.id('c'), ru = R * 2.6, d = ru + R - amount(X, 0.5) * 2 * R, k = Math.SQRT1_2; // the umbra comes in from the lower left
    out += X.el('clipPath', { id: cl }, X.el('circle', { r: R }));
    out += X.el('circle', { cx: X.f(-d * k), cy: X.f(d * k), r: X.f(ru), fill: c['eclipse-umbra'], opacity: 0.85, 'clip-path': 'url(#' + cl + ')' });
    return wrapBody(X, out);
  }

  function aurora(X) { // curtains behind the massif; nothing left of E.aurora.left but the faint glow
    var A = E.aurora, amt = amount(X, 0.5), c = X.PAL.c, out = '', op = A.op[0] + A.op[1] * amt, gl = A.glow;
    out += X.el('ellipse', { cx: Math.max(gl[0], A.left + 200), cy: gl[1], rx: X.f(gl[2] * (0.6 + 0.4 * amt)), ry: X.f(gl[3] * (0.5 + 0.5 * amt)), fill: X.radial(c['aurora-1'], 0.3 * amt + 0.08, 0) });
    var fill = X.grad([[0, c['aurora-3'], 0], [0.35, c['aurora-3'], 0.45], [0.7, c['aurora-2'], 0.85], [1, c['aurora-1'], 1]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    A.bands.slice(0, amt < 0.6 ? A.few : A.bands.length).forEach(function (b) {
      var x0 = Math.max(b[0], A.left), x1 = b[1];
      if (x1 - x0 < 90) return;
      var h = Math.min(A.h * Math.pow(amt, 1.15) * b[3] + 14, b[2] - A.top), n = 16, top = '', base = '';
      for (var i = 0; i <= n; i++) {
        var u = i / n, x = x0 + (x1 - x0) * u, env = Math.pow(Math.sin(Math.PI * u), 0.55);
        var yb = b[2] + 7 * Math.sin(u * 7 + b[4]), yt = yb - h * env * (0.82 + 0.18 * Math.sin(u * 11 + b[4] * 2));
        top += (i ? 'L' : 'M') + X.f(x) + ',' + X.f(yt); base = 'L' + X.f(x) + ',' + X.f(yb) + base;
      }
      // two overlapping translucent copies (the second narrower and shifted) give the curtain its soft fold
      out += X.el('path', { d: top + base + 'Z', fill: fill, opacity: X.f(op * 100) / 100 });
      out += X.el('path', { d: top + base + 'Z', fill: fill, opacity: X.f(op * 60) / 100, transform: 'translate(' + X.f(x0 + (x1 - x0) * 0.5) + ' ' + b[2] + ') scale(0.62 0.8) translate(' + X.f(-(x0 + (x1 - x0) * 0.42)) + ' ' + -b[2] + ')' });
    });
    return '<g data-layer="aurora">' + out + '</g>';
  }

  var H = Scene.hooks, none = function () { return { svg: '', replace: true }; };
  H.rainbow = {
    body: none, // the sun stands behind the viewer
    behindLand: function (X) {
      var R = E.rainbow, c = X.PAL.c, arcs = '', q = X.prng(121), cur = '';
      for (var i = 0; i < 40; i++) { var x = R.cx - R.r + 20 + q() * (2 * R.r - 40), y = 120 + q() * 110; cur += 'M' + X.f(x) + ',' + X.f(y) + 'l0.8,' + X.f(9 + q() * 8); } // a light rain curtain in the arc
      for (i = 0; i < 5; i++) { var rr = R.r - R.w / 2 - i * R.w; arcs += X.el('path', { d: 'M' + (R.cx - rr) + ',' + R.cy + 'A' + rr + ',' + rr + ' 0 0 1 ' + (R.cx + rr) + ',' + R.cy, fill: 'none', stroke: c['rb-' + (i + 1)], 'stroke-width': R.w + 0.4 }); }
      var m = X.id('m');
      var mask = X.el('mask', { id: m, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1600, height: 320 }, X.el('rect', { width: 1600, height: 320, fill: X.grad([[0, '#ffffff', 1], [1, '#ffffff', 0]], { x1: 0, x2: 0, y1: R.fade[0], y2: R.fade[1], gradientUnits: 'userSpaceOnUse' }) }));
      return '<g data-layer="event" data-part="rainbow">' + mask + X.el('path', { d: cur, fill: 'none', stroke: c.rain, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.22 }) + X.el('g', { mask: 'url(#' + m + ')', opacity: R.op }, arcs) + '</g>';
    },
  };
  H.meteors = {
    sky: function (X) {
      var out = '';
      E.meteors.forEach(function (m) {
        var a = (32 * Math.PI) / 180, tx = m[0] + Math.cos(a) * m[2], ty = m[1] - Math.sin(a) * m[2];
        var g = X.grad([[0, '#ffffff', 0.95], [1, '#ffffff', 0]], { x1: m[0], y1: m[1], x2: X.f(tx), y2: X.f(ty), gradientUnits: 'userSpaceOnUse' });
        out += X.el('path', { d: 'M' + m[0] + ',' + m[1] + 'L' + X.f(tx) + ',' + X.f(ty), stroke: g, 'stroke-width': 1.6, 'stroke-linecap': 'round' }) + X.el('circle', { cx: m[0], cy: m[1], r: 1.6, fill: X.PAL.c.star });
      });
      return '<g data-layer="event" data-part="meteors">' + out + '</g>';
    },
  };
  H.starNight = {
    sky: function (X) {
      var M = E.milky, q = X.prng(131), md = '', rot = (M.rot * Math.PI) / 180;
      var out = X.el('ellipse', { cx: M.cx, cy: M.cy, rx: M.rx, ry: M.ry, fill: X.radial('#ffffff', 1, 0), opacity: M.op, transform: 'rotate(' + M.rot + ' ' + M.cx + ' ' + M.cy + ')' });
      for (var j = 0; j < M.n; j++) { var u = (q() * 2 - 1) * M.rx * 0.9, v = (q() + q() - 1) * M.ry * 0.7, x = M.cx + u * Math.cos(rot) - v * Math.sin(rot); if (x < E.left) continue; md += X.circ(x, M.cy + u * Math.sin(rot) + v * Math.cos(rot), 0.4 + q() * 0.5); }
      return '<g data-layer="stars" data-part="milky">' + out + X.el('path', { d: md, fill: X.PAL.c.star, opacity: 0.8 }) + moreStars(X, 86, 133) + '</g>';
    },
  };
  ['solarPartial', 'solarAnnular', 'solarTotal'].forEach(function (ev) {
    H[ev] = { body: function (X) { return X.s.body.kind === 'sun' ? { svg: sunEclipse(X), replace: true } : null; } };
  });
  H.solarPartial.sky = function (X) { return amount(X, 0.5) > 0.6 ? X.el('rect', { x: 0, y: X.top, width: 1600, height: 320 - X.top, fill: X.PAL.c['dim-target'], opacity: 0.3 }) : ''; }; // one step dimmer
  H.solarTotal.skyKey = function (s) { return 'eclipse-sky'; };
  H.solarTotal.sky = function (X) { // stars and a glow all round the horizon
    var gc = X.PAL.glow['eclipse-sky'];
    return '<g data-layer="stars">' + moreStars(X, 40, 141) + '</g>' + X.el('rect', { x: 0, y: 150, width: 1600, height: 100, fill: X.grad([[0, gc, 0], [0.6, gc, 0.35], [1, gc, 0]], { x1: 0, y1: 0, x2: 0, y2: 1 }) });
  };
  ['lunarPartial', 'lunarTotal'].forEach(function (ev) {
    H[ev] = { body: function (X, pale) { return X.s.body.kind === 'moon' ? { svg: moonEclipse(X, pale), replace: true } : null; } };
  });
  H.lunarTotal.sky = function (X) { return X.s.cover < 4 && !X.s.falling ? '<g data-layer="stars">' + moreStars(X, 60, 151) + '</g>' : ''; }; // without the full moon's light: more stars
  H.aurora = { sky: aurora };
  H.dust = {
    body: function (X) { // a pale sun without halo or rays
      if (X.s.body.kind !== 'sun') return null;
      return { svg: wrapBody(X, X.el('circle', { r: 25, fill: X.PAL.c['dust-sun'], opacity: 0.78 })), replace: true };
    },
    behindLand: function (X) { // the far massif fades into the milky air
      return X.el('rect', { x: 0, y: 40, width: 1600, height: 200, 'data-part': 'dustHaze', fill: X.grad([[0, X.C.haze, 0], [0.45, X.C.haze, 0.3], [1, X.C.haze, 0.55]], { x1: 0, y1: 0, x2: 0, y2: 1 }) });
    },
  };
  window.SceneEvents = { E: E };
})();
