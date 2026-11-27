/* Living scenes – the drawing (mockup; the product ports it shape by shape into the scene kit of package 1).
   One world: every picture is a crop ("spot") of the weather landscape, drawn by the weather mockup itself
   (../../weather-scenes-2/mockups/scene.js + palette.js, loaded before this file), under the same sky. A module adds
   its own things through the scene's `front` hook; their colours pass through the scene's light (X.C.lit), so a bed of
   flowers is dark at night and warm at dusk without a rule of its own.
   window.Living = { scene(spot, sky, data, opts), tile(sky, opts), SPOTS, count(svg), growth(n), FLOWERS }
     spot  'garden' (habits), 'lake' (todos), 'way' (planner) – more spots arrive with their module pages; opts.box [w, h] = the picture's size in px
     sky   a weather scene state (phase, cond, season, moon, theme …) – the shared environment, never module data
     data  the module's variables, see each spot
   Colours: palette.js plus the block P below (the only new hex values; product: --scene-* tokens).
   Blooms take only a third of the sky's darkening, so today's state stays readable at night (a bloom is the datum).
   Nothing here moves. Randomness: none – the same data is the same picture. */
(function () {
  var P = {
    soil: '#5b4334', soilLit: '#75573f', stone: '#a9a39a', stem: '#3f7a45', leaf: '#5fa052', leafLit: '#86bf62', bud: '#6f9a55',
    core: '#f6d569', hull: '#6b4a38', path: '#d9c9a3', walker: '#3d4a63', lamp: '#ffd98a', lampPost: '#3a2e28', can: '#7d98ad', canLit: '#a5bccb', wing: '#f4efe2', sign: '#c9b08a',
  };
  /* bloom colours by the goal's place in the list (1st, 2nd, …): a plant keeps its colour as long as the order stays */
  var FLOWERS = ['#e8807a', '#f2b56b', '#b79be8', '#f3e9a8', '#7fb2e6', '#f29ac0'];
  var SPOTS = {
    /* the meadow in front of the fence, the cabin behind it. Bed: baseline y, first x, step */
    /* the meadow west of the lake (planner): the day as a way from the left (morning) to the right (evening) */
    way: { span: [846, 1010], k: 1.7, line: [[850, 315], [874, 309], [900, 313], [926, 305], [952, 309], [978, 302], [1006, 304]] },
    /* the lake below the massif (ToDos): boats on the water, stars over it */
    lake: { span: [1000, 1346], slots: [[1066, 285], [1112, 276], [1158, 291], [1204, 275], [1244, 287], [1100, 297], [1186, 283]],
      stars: [[1046, 56], [1090, 34], [1134, 50], [1180, 26], [1224, 46], [1264, 22], [1306, 42]] },
    garden: { span: [1470, 1596], bedY: 313, x0: 1486, x1: 1580, rowDy: -9, k: 1.7, max: 12 },
  };
  /* growth step from the number of days a goal was ever done: it only rises, a pause changes nothing */
  function growth(doneDays) { return doneDays >= 30 ? 3 : doneDays >= 10 ? 2 : doneDays >= 3 ? 1 : 0; }

  function plant(X, x, y, g, state, col, k) {
    var f = X.f, L = X.C.lit, o = '', h = [5, 9, 13, 16][g] * k, w = [2.2, 3, 3.6, 4.2][g] * k;
    function p(d, fill, part) { o += X.el('path', { d: d, fill: fill, 'data-part': part }); }
    function leaf(cx, cy, dir, s, lit) { p('M' + f(cx) + ',' + f(cy) + 'q' + f(dir * s * 0.9) + ',' + f(-s * 0.9) + ' ' + f(dir * s * 1.5) + ',' + f(-s * 0.2) + 'q' + f(-dir * s * 0.6) + ',' + f(s * 0.7) + ' ' + f(-dir * s * 1.5) + ',' + f(s * 0.2) + 'Z', L(lit ? P.leafLit : P.leaf, 0.8), 'leaf'); }
    function head(cx, cy, r) {
      if (state === 'done') { // open: five petals and a core
        var d = ''; for (var i = 0; i < 5; i++) { var a = -1.57 + i * 1.2566; d += X.circ(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.52); }
        p(d, L(col, 0.34), 'bloom'); p(X.circ(cx, cy, r * 0.36), L(P.core, 0.3), 'core');
      } else if (state === 'part') { // half open: three petals above the cup
        p(X.circ(cx - r * 0.42, cy - r * 0.2, r * 0.42) + X.circ(cx + r * 0.42, cy - r * 0.2, r * 0.42) + X.circ(cx, cy - r * 0.5, r * 0.44), L(col, 0.34), 'bloom');
        p('M' + f(cx - r * 0.7) + ',' + f(cy) + 'q' + f(r * 0.7) + ',' + f(r * 1.1) + ' ' + f(r * 1.4) + ',0Z', L(P.bud), 'cup');
      } else { // closed bud (not yet today, or a rest day): green with a tip of its colour
        p('M' + f(cx) + ',' + f(cy - r * 1.1) + 'q' + f(r * 0.8) + ',' + f(r * 0.9) + ' 0,' + f(r * 1.7) + 'q' + f(-r * 0.8) + ',' + f(-r * 0.8) + ' 0,' + f(-r * 1.7) + 'Z', L(P.bud), 'bud');
        p('M' + f(cx) + ',' + f(cy - r * 1.1) + 'q' + f(r * 0.4) + ',' + f(r * 0.4) + ' 0,' + f(r * 0.8) + 'q' + f(-r * 0.4) + ',' + f(-r * 0.4) + ' 0,' + f(-r * 0.8) + 'Z', L(col, 0.55), 'tip');
      }
    }
    o += X.el('path', { d: 'M' + f(x) + ',' + f(y) + 'q' + f(w * 0.25) + ',' + f(-h * 0.5) + ' 0,' + f(-h), fill: 'none', stroke: L(P.stem), 'stroke-width': f(0.9 * k), 'stroke-linecap': 'round' });
    leaf(x, y - h * 0.22, -1, w, false); leaf(x, y - h * 0.3, 1, w, true);
    if (g >= 1) { leaf(x, y - h * 0.52, 1, w * 0.8, false); leaf(x, y - h * 0.6, -1, w * 0.8, true); }
    if (g >= 2) { leaf(x, y - h * 0.8, -1, w * 0.6, false); }
    if (g === 0) { if (state === 'done') p(X.circ(x, y - h - 0.6 * k, 1.5 * k), L(col, 0.34), 'bloom'); return o; } // a sprout shows its day as one dot of colour
    if (g === 3) { // a bush: two side heads on short stems
      o += X.el('path', { d: 'M' + f(x) + ',' + f(y - h * 0.5) + 'q' + f(-w * 1.1) + ',' + f(-h * 0.1) + ' ' + f(-w * 1.3) + ',' + f(-h * 0.34) + 'M' + f(x) + ',' + f(y - h * 0.42) + 'q' + f(w * 1.1) + ',' + f(-h * 0.1) + ' ' + f(w * 1.4) + ',' + f(-h * 0.28), fill: 'none', stroke: L(P.stem), 'stroke-width': f(0.8 * k), 'stroke-linecap': 'round' });
      head(x - w * 1.3, y - h * 0.86, 2.3 * k); head(x + w * 1.4, y - h * 0.72, 2.1 * k);
    }
    head(x, y - h - 1.2 * k, [0, 2.4, 3, 3.2][g] * k);
    return o;
  }

  /* garden: data = { goals: [{ state: 'open' | 'part' | 'done' | 'rest', doneDays }], allDone } */
  function garden(X, data) {
    var S = SPOTS.garden, f = X.f, L = X.C.lit, o = '', goals = (data.goals || []).slice(0, S.max), n = goals.length, dark = X.s.dark;
    function p(d, fill, part, extra) { var a = { d: d, fill: fill, 'data-part': part }; for (var k in extra || {}) a[k] = extra[k]; o += X.el('path', a); }
    var two = n > 6, front = two ? Math.ceil(n / 2) : n, bx0 = S.x0 - 8, bx1 = S.x1 + 6;
    // the bed: turned soil with a lit edge and a row of stones – there in every state, also without a goal
    p('M' + bx0 + ',' + (S.bedY + 1) + 'q' + f((bx1 - bx0) / 2) + ',' + (two ? -22 : -10) + ' ' + (bx1 - bx0) + ',0q' + f(-(bx1 - bx0) / 2) + ',7 ' + -(bx1 - bx0) + ',0Z', L(P.soil), 'bed');
    p('M' + (bx0 + 6) + ',' + (S.bedY - 1) + 'q' + f((bx1 - bx0) / 2 - 6) + ',' + (two ? -17 : -7) + ' ' + (bx1 - bx0 - 12) + ',0q' + f(-(bx1 - bx0) / 2 + 6) + ',2.5 ' + -(bx1 - bx0 - 12) + ',0Z', L(P.soilLit), 'bed-lit');
    var st = ''; for (var i = 0; i < 9; i++) st += X.circ(bx0 + 5 + i * ((bx1 - bx0 - 10) / 8), S.bedY + 3.2 + Math.sin(i / 8 * 3.14) * 1.6, 1.5);
    p(st, L(P.stone), 'stones');
    if (!n) { // empty: a watering can and a name stick wait in the bed
      p('M1528,300h13l1.5,9h-16ZM1541,302l7,-4l1,1.6l-6.4,5ZM1528,303q-5,-1 -5,3q0,3 4,3l0.3,-1.4q-2.6,0 -2.6,-1.8q0,-1.6 3,-1.4Z', L(P.can), 'can');
      p('M1530,300h9l0.6,3h-10Z', L(P.canLit), 'can-lit');
      p('M1562,309v-9h-4v-5h10v5h-4v9Z', L(P.sign), 'stick');
    }
    function row(list, y, k, xa, xb) {
      var step = list.length > 1 ? (xb - xa) / (list.length - 1) : 0, x = list.length > 1 ? xa : (xa + xb) / 2;
      list.forEach(function (g, i) { o += plant(X, x + step * i, y, growth(g.doneDays || 0), g.state, FLOWERS[g.i % FLOWERS.length], k); });
    }
    goals = goals.map(function (g, i) { return { state: g.state, doneDays: g.doneDays, i: i }; });
    if (two) row(goals.slice(front), S.bedY + S.rowDy, S.k * 0.8, S.x0 + 10, S.x1 - 10);
    row(goals.slice(0, front), S.bedY, S.k, n < 4 ? S.x0 + 24 : S.x0, n < 4 ? S.x1 - 24 : S.x1);
    // everything scheduled for today is done: the lantern on the fence post is lit (night, dawn, dusk) or two butterflies sit over the bed (day)
    p('M1484,281h2v-9h-2Z', L(P.lampPost), 'lamp-post');
    p('M1482.2,266h5.6v6h-5.6ZM1483,265l2,-2l2,2Z', data.allDone && n ? P.lamp : L(P.lampPost, 0.6), 'lamp', { 'data-on': data.allDone && n ? 1 : 0 });
    if (data.allDone && n) {
      if (dark || X.s.phase === 'golden') o += X.el('circle', { cx: 1485, cy: 269, r: 11, fill: X.radial(P.lamp, 0.5, 0), 'data-part': 'lamp-glow' });
      else [[1516, 286, 1], [1560, 281, -1]].forEach(function (b) { p('M' + b[0] + ',' + b[1] + 'q' + 3 * b[2] + ',-4 ' + 4.4 * b[2] + ',-0.6q0,2.6 ' + -4.4 * b[2] + ',0.6q' + 1.6 * b[2] + ',2.6 ' + 3.4 * b[2] + ',2q-1,-2.4 ' + -3.4 * b[2] + ',-2Z', L(P.wing, 0.3), 'butterfly'); });
    }
    return o;
  }

  /* lake: data = { done } – things ticked today. One sailing boat per thing (at most seven; the text names the number).
     By night every boat carries a lantern, and under a sky that shows stars the same number of stars stands over the lake,
     joined to a figure that grows star by star. Nothing is drawn for what is open. A new day starts with the still lake. */
  function lake(X, data) {
    var S = SPOTS.lake, f = X.f, L = X.C.lit, o = '', n = Math.max(0, Math.min(7, data.done || 0)), dark = X.s.dark, i;
    function p(d, fill, part, extra) { var a = { d: d, fill: fill, 'data-part': part }; for (var k in extra || {}) a[k] = extra[k]; o += X.el('path', a); }
    if (dark && X.s.cover < 3 && !X.s.falling && !X.s.fog && n) {
      var st = S.stars.slice(0, n), d = '';
      if (n > 1) o += X.el('path', { d: X.pts(st), fill: 'none', stroke: X.PAL.c.star, 'stroke-width': 0.8, opacity: 0.38, 'data-part': 'figure' });
      st.forEach(function (q) { d += X.circ(q[0], q[1], 2.1); });
      p(d, X.PAL.c.star, 'done-stars');
    }
    for (i = 0; i < n; i++) {
      var b = S.slots[i], x = b[0], y = b[1], k = 0.8 + (y - 274) / 60, col = FLOWERS[i % FLOWERS.length];
      p('M' + f(x - 7 * k) + ',' + f(y) + 'h' + f(14 * k) + 'l' + f(-2.6 * k) + ',' + f(3.4 * k) + 'h' + f(-8.8 * k) + 'Z', L(P.hull), 'hull');
      p('M' + f(x + 0.6 * k) + ',' + f(y - 1) + 'v' + f(-12 * k) + 'l' + f(7 * k) + ',' + f(11 * k) + 'Z', L(P.wing, 0.5), 'sail');
      p('M' + f(x - 0.6 * k) + ',' + f(y - 1) + 'v' + f(-9 * k) + 'l' + f(-5 * k) + ',' + f(8.4 * k) + 'Z', L(col, 0.4), 'jib');
      p('M' + f(x - 6 * k) + ',' + f(y + 4.6 * k) + 'h' + f(12 * k) + 'v' + f(0.9) + 'h' + f(-12 * k) + 'Z', X.C.waterHi, 'wake', { opacity: 0.5 });
      if (dark || X.s.phase === 'golden') { // the lantern at the mast and its light on the water
        o += X.el('circle', { cx: f(x), cy: f(y - 3 * k), r: f(8 * k), fill: X.radial(P.lamp, 0.5, 0), 'data-part': 'lantern-glow' });
        p(X.circ(x, y - 3 * k, 1.5 * k), P.lamp, 'lantern');
        p('M' + f(x - 1.2 * k) + ',' + f(y + 5.5 * k) + 'h' + f(2.4 * k) + 'v' + f(5 * k) + 'h' + f(-2.4 * k) + 'Z', P.lamp, 'lantern-mirror', { opacity: 0.35 });
      }
    }
    return o;
  }

  /* way: data = { stations: [{ at: 0..1, done }], now: 0..1 | null } – the day as a way. `at` is the thing's start between the day's
     begin and end; a done thing has its flag up, a coming one is a plain post; the walker stands at `now` (null outside the day:
     no walker; at night the walker's lantern shows). Posts never fall, nothing turns red, a passed post without a flag is just a post. */
  function way(X, data) {
    var S = SPOTS.way, f = X.f, L = X.C.lit, o = '', P0 = S.line, dark = X.s.dark;
    function p(d, fill, part, extra) { var a = { d: d, fill: fill, 'data-part': part }; for (var k in extra || {}) a[k] = extra[k]; o += X.el('path', a); }
    function at(t) { var u = Math.max(0, Math.min(1, t)) * (P0.length - 1), i = Math.min(P0.length - 2, Math.floor(u)), r = u - i; return [P0[i][0] + (P0[i + 1][0] - P0[i][0]) * r, P0[i][1] + (P0[i + 1][1] - P0[i][1]) * r]; }
    var up = P0.map(function (q) { return [q[0], q[1] - 2.2]; }), down = P0.slice().reverse().map(function (q) { return [q[0], q[1] + 2.2]; });
    p(X.pts(up.concat(down), true), X.mix(X.C.meadow, L(P.path), 0.6), 'way');
    var K = S.k;
    function thing(x, y, inner) { o += '<g transform="translate(' + f(x) + ',' + f(y) + ') scale(' + K + ')">' + inner + '</g>'; }
    function q(d, fill, part) { return X.el('path', { d: d, fill: fill, 'data-part': part }); }
    (data.stations || []).slice(0, 8).forEach(function (st, i) {
      var w = at(st.at);
      thing(w[0], w[1] - 2, q('M-0.7,0v-11h1.4v11Z', L(P.lampPost), 'post') + (st.done ? q('M0.7,-11l8,2.6l-8,2.8Z', L(FLOWERS[i % FLOWERS.length], 0.4), 'flag') : q(X.circ(0, -11.4, 1.3), L(P.sign), 'knob')));
    });
    if (data.now != null) {
      var w = at(data.now), lit = dark || X.s.phase === 'golden';
      thing(w[0], w[1] - 2, (lit ? X.el('circle', { cx: 4, cy: -5, r: 9, fill: X.radial(P.lamp, 0.5, 0), 'data-part': 'lantern-glow' }) : '') +
        q('M-2.6,0l2.6,-8.4l2.6,8.4Z', L(P.walker), 'walker') + q(X.circ(0, -10, 2), L(P.wing, 0.5), 'head') + q('M-3.6,-7.6h2.2v4.4h-2.2Z', L(X.PAL.c.flag, 0.5), 'pack') + (lit ? q(X.circ(4, -5, 1.4), P.lamp, 'lantern') : ''));
    }
    return o;
  }
  var DRAW = { garden: garden, lake: lake, way: way };

  /* the crop of a spot for a picture box [w, h] in px: the width is fixed by the module's things (the bed fills the picture's
     width), the height follows the box, the foot of the picture is the foot of the landscape. A tall box shows more forest,
     summit and sky above the same bed; a low strip shows the bed and the fence. One rule for both forms. */
  function viewFor(spot, box) {
    var S = SPOTS[spot], w = S.span[1] - S.span[0], h = Math.min(320, w * (box ? box[1] / box[0] : 0.9));
    return [S.span[0], Math.round(320 - h), w, Math.round(h)];
  }
  function scene(spot, sky, data, opts) {
    var s = {}, k, H = window.Scene.hooks, ev = sky.event && H[sky.event];
    for (k in sky) s[k] = sky[k];
    // the shared sky keeps its event (rainbow, meteors …): the module's layer is added to that event's hooks, not put in its place
    var mine = {}; for (k in ev || {}) mine[k] = ev[k];
    mine.front = function (X) { return (ev && ev.front ? ev.front(X) || '' : '') + '<g data-layer="module" data-spot="' + spot + '">' + DRAW[spot](X, data || {}) + '</g>'; };
    H.living = mine; s.event = 'living';
    var o = { view: viewFor(spot, opts && opts.box), quietX: -2000 }; for (k in opts || {}) if (k !== 'box') o[k] = opts[k];
    return crop(window.Scene.svg(s, o), o.view, 'xMaxYMax slice');
  }
  /* a sky tile (clock): sky and body only – the weather's own "Schlicht" level. sky.body.t 0..1 is where the body stands on its
     way; it always stands whole inside the tile (opts.box [w, h] in px shapes the crop) */
  function tile(sky, opts) {
    var s = { level: 'plain', cond: 'clear' }, k; for (k in sky) s[k] = sky[k];
    var box = (opts && opts.box) || [72, 80], w = 150, h = w * box[1] / box[0], v = [1200, 40, w, h], t = s.body && s.body.t != null ? s.body.t : 0.5, r = 30;
    var at = [v[0] + r + (w - 2 * r) * t, v[1] + h - r - (h - 2 * r) * Math.sin(Math.PI * t)];
    return crop(window.Scene.svg(s, { view: v, quietX: -2000, bodyAt: at }), v, 'xMidYMid slice');
  }
  function crop(svg, v, par) { return svg.replace(/viewBox="[^"]*"/, 'viewBox="' + v.join(' ') + '"').replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="' + par + '"'); }
  window.Living = { scene: scene, tile: tile, viewFor: viewFor, SPOTS: SPOTS, FLOWERS: FLOWERS, growth: growth, count: function (s) { return window.Scene.count(s); }, P: P };
})();
