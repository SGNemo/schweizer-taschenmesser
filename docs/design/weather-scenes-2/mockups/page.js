/* Weather round 2 – full-page builder for the p4 mockups (mockup only, not shipped).
   Page.render(selector, model) draws the whole weather page for one view moment: head (Scene.svg), place row with the
   day stepper, rain in the next two hours, hour cards (radio group) + hour line, the curve (hand-drawn inline SVG with
   the select "Anzeigen"), 7 days (radio group), "Mehr Werte", air card, moon card, foot.
   Desktop (≥ 900 px): stage 1650 × 320 with hints, three chips and the rest line on the picture; main | aside.
   Phone: picture 256 px with temperature and detail line only; hint, two chips and the rest line under it; one column.
   Page.parts exposes the pieces for the state board (p4-zustaende). Depends on palette.js + scene.js only. */
(function () {
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var MINUS = '−';
  var I = {
    umbrella: '<path d="M2.5 8.5a5.5 5.5 0 0 1 11 0z"/><path d="M8 8.5v4.5a1.5 1.5 0 0 1-3 0"/><path d="M8 3V2"/>',
    wind: '<path d="M2 6h8a2 2 0 1 0-2-2"/><path d="M2 10h10a2 2 0 1 1-2 2"/>',
    sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
    rain: '<path d="M4.5 10a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 6 2 2 0 0 1 12 10z"/><path d="M5.5 12.5l-.8 1.6M8.5 12.5l-.8 1.6M11.5 12.5l-.8 1.6"/>',
    snow: '<path d="M4.5 10a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 6 2 2 0 0 1 12 10z"/><path d="M5.5 12.6h.01M8.5 12.6h.01M11.5 12.6h.01M7 14.6h.01M10 14.6h.01" stroke-width="2"/>',
    cloud: '<path d="M4.5 12.5a3.2 3.2 0 1 1 .7-6.3 4.3 4.3 0 0 1 8.2 1.4 2.5 2.5 0 0 1-.7 4.9z"/>',
    cloudSun: '<path d="M5.5 13a2.8 2.8 0 1 1 .5-5.6 3.6 3.6 0 0 1 6.9 1.2A2.2 2.2 0 0 1 12.5 13z"/><path d="M5 2v1M1.8 5.2h1M2.8 3l.7.7M7.2 3l-.7.7"/>',
    cloudMoon: '<path d="M5.5 13a2.8 2.8 0 1 1 .5-5.6 3.6 3.6 0 0 1 6.9 1.2A2.2 2.2 0 0 1 12.5 13z"/><path d="M6.2 2.2a2.6 2.6 0 1 0 2.6 3.6 2 2 0 0 1-2.6-3.6z"/>',
    moonC: '<path d="M10.5 2.5a5.5 5.5 0 1 0 3 9.5 4.5 4.5 0 0 1-3-9.5z"/>',
    thunder: '<path d="M4.5 10a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 6 2 2 0 0 1 12 10z"/><path d="M8.5 9.5l-1.5 2.5h2l-1.5 2.5"/>',
    thermo: '<path d="M6.5 9.3V3a1.5 1.5 0 0 1 3 0v6.3a3 3 0 1 1-3 0z"/><path d="M8 7v4"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    moon: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 0 0 11a4.6 5.5 0 0 0 0-11z" fill="currentColor" stroke="none"/>',
    left: '<path d="M10 3L5 8l5 5"/>', right: '<path d="M6 3l5 5-5 5"/>', down: '<path d="M3.5 6l4.5 4.5L12.5 6"/>',
    plus: '<path d="M8 3v10M3 8h10"/>', check: '<path d="M3.5 8.5l3 3 6-7"/>',
    good: '<circle cx="8" cy="8" r="6"/><path d="M5.5 8.2l1.8 1.8 3.2-3.6"/>', fair: '<circle cx="8" cy="8" r="6"/><path d="M5.5 8h5"/>',
    poor: '<circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 10.8v.1"/>',
  };
  function icon(n, size, cls, sw) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 16 16" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.5) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>';
  }
  function esc(s) { return String(s); }
  /* moon disc: lit part bounded by a semicircle and the terminator ellipse; waning = lit on the left (northern sky) */
  function moonGlyph(illum, waxing, size, mono) {
    var r = size / 2 - 1, c = size / 2, rx = Math.abs(2 * illum - 1) * r, big = illum > 0.5;
    var a1 = waxing ? 1 : 0, a2 = waxing ? (big ? 1 : 0) : big ? 0 : 1;
    var d = 'M' + c + ',' + (c - r) + 'A' + r + ',' + r + ' 0 0 ' + a1 + ' ' + c + ',' + (c + r) + 'A' + rx.toFixed(2) + ',' + r + ' 0 0 ' + a2 + ' ' + c + ',' + (c - r) + 'Z';
    return '<svg class="moonGlyph' + (mono ? ' mono' : '') + '" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true"><circle class="dark" cx="' + c + '" cy="' + c + '" r="' + r + '"/><path class="lit" d="' + d + '"/></svg>';
  }
  function tone(t) { return t <= 0 ? 'cold' : t >= 25 ? 'warm' : ''; }
  function deg(t) { return (t < 0 ? MINUS + Math.abs(t) : t) + '°'; }

  /* ---------- head ---------- */
  function chip(c) { return '<li class="key"' + (c.kind ? ' data-kind="' + c.kind + '"' : '') + '>' + icon(c.icon) + c.text + '</li>'; }
  function pills(h) {
    return h.hints && h.hints.length ? '<div class="pills"><div class="hint"><ul>' + h.hints.map(function (x) { return '<li>' + icon(x.icon) + '<span>' + x.text + '</span></li>'; }).join('') +
      '</ul><span class="suffix">· berechnet, keine amtliche Warnung</span></div></div>' : '';
  }
  function head(m, phone) {
    var h = m.head, st = Object.assign({ theme: dark ? 'dark' : 'light' }, m.scene), ink = Scene.ink(st);
    var stageH = phone ? 256 : 320, o = phone ? Scene.phoneOpts(256, 412) : {};
    o.idp = phone ? 'p' : 'd';
    var chips = phone ? h.chips.slice(0, 2) : h.chips, restLine = (phone && h.chips[2] ? [h.chips[2].text] : []).concat(h.rest).join(' · ');
    var keys = '<ul class="keys">' + chips.map(chip).join('') + '</ul>';
    var temp = '<div class="temp"' + (h.tempAria ? ' data-day role="img" aria-label="' + h.tempAria + '"' : '') + '>' + h.temp + '</div>';
    var fig = '<div class="fig">' + temp + '<div class="detail">' + h.detail + '</div></div>';
    var inside = phone ? fig : fig + pills(h) + keys + '<p class="rest">' + restLine + '</p>';
    var below = phone ? '<div class="under">' + pills(h) + keys + '</div><p class="restBelow">' + restLine + '</p>' : '';
    return '<header class="whead ' + (phone ? 'phone' : 'desk') + '" data-ink="' + ink + '" style="height:' + stageH + 'px;min-height:0;max-height:none">' +
      '<div class="backdrop">' + Scene.svg(st, o) + '</div>' +
      '<div class="titleRow"><span class="plate">' + icon('cloudSun', 18) + '</span><h1>' + m.place + '</h1><span class="sp"></span><button class="gear" aria-label="Einstellungen">' + icon('gear', 20) + '</button></div>' +
      (phone ? '<nav class="modrow"><span>Kalender</span><span>Planer</span><span>ToDos</span><span class="on">Wetter</span><span>…</span></nav>' : '') +
      '<div class="stageBody">' + inside + '</div></header>' + below;
  }

  /* ---------- place row + stepper ---------- */
  function stepper(s) {
    return '<div class="stepper" role="group" aria-label="Tag">' +
      '<button class="stepBtn" aria-label="Einen Tag zurück"' + (s.prevOff ? ' aria-disabled="true"' : '') + '>' + icon('left', 18) + '</button>' +
      '<span class="lbl">' + s.label + '</span>' +
      '<button class="stepBtn" aria-label="Einen Tag weiter"' + (s.nextOff ? ' aria-disabled="true"' : '') + '>' + icon('right', 18) + '</button>' +
      (s.today ? '' : '<button class="btn">Heute</button>') + '</div>';
  }
  function placeRow(m) {
    return '<div class="placeRow"><span class="placeChip">' + m.place + '</span><button class="ghost">' + icon('plus', 16) + 'Ort eintragen</button>' + stepper(m.stepper) + '</div>';
  }

  /* ---------- rain in the next two hours ---------- */
  function rainSoon(r) {
    var max = Math.max(0.6, Math.max.apply(null, r.bars));
    return '<section class="card rainSoon"' + (r.snow ? ' data-snow' : '') + ' aria-labelledby="rs-t' + (r.id || '') + '"><div class="secHead"><h2 class="secTitle" id="rs-t' + (r.id || '') + '">Regen in den nächsten zwei Stunden</h2></div>' +
      '<p class="sentence">' + r.sentence + '</p><div class="bars" aria-hidden="true">' +
      r.bars.map(function (v) { return v > 0 ? '<i style="height:' + Math.max(8, Math.round((v / max) * 100)) + '%"></i>' : '<i data-zero></i>'; }).join('') +
      '</div><div class="barTicks" aria-hidden="true"><span>jetzt</span><span>+1 h</span><span>+2 h</span></div></section>';
  }

  /* ---------- hours ---------- */
  function hourCard(c, i, h, extra) {
    // the round-1 "now" frame is replaced by the picked look: "Jetzt" is the checked card by default, one frame at a time
    var checked = h && h.checked === i;
    var rain = c.rain >= 30 ? c.rain + ' %' + (c.amt ? ' · ' + c.amt : '') : '';
    return '<label class="hc' + (extra ? ' ' + extra : '') + '"' + (checked ? ' data-checked' : '') + '>' +
      '<input class="sr" type="radio" name="hour"' + (checked ? ' checked' : '') + '>' + (checked ? '<span class="tick">' + icon('check', 12, '', 2.2) + '</span>' : '') +
      '<span class="t">' + c.t + '</span>' + icon(c.icon, 22) + '<span class="tp" data-tone="' + tone(c.temp) + '">' + deg(c.temp) + '</span>' +
      '<span class="w">' + c.word + '</span><span class="wi">Wind ' + c.wind + ' km/h</span>' +
      '<span class="rb" aria-hidden="true"><i style="width:' + Math.min(100, c.rain) + '%"></i></span><span class="r">' + (rain || ' ') + '</span></label>';
  }
  function hours(h) {
    var body = h.missing ? '<p class="missing">' + h.missing + '</p>'
      : '<div class="hourScroll" role="region" aria-label="Stunde für Stunde" tabindex="0"><div class="hourCards" role="radiogroup" aria-label="Stunde wählen">' +
        h.cards.map(function (c, i) { return hourCard(c, i, h); }).join('') + '</div></div>' +
        (h.line ? '<p class="hourLine"><span class="sr">' + h.lineLabel + ': </span>' + h.line + '</p>' : '');
    return '<section class="hours" aria-labelledby="h-t"><div class="secHead"><h2 class="secTitle" id="h-t">' + h.title + '</h2>' +
      (h.back ? '<button class="btn small">' + h.back + '</button>' : '') + '</div>' + body + '</section>';
  }

  /* ---------- curve ---------- */
  var OPTIONS = ['Temperatur und Regen', 'Wind und Böen', 'Sonne und Wolken', 'Luftdruck', 'UV', 'Luftqualität'];
  function select(chosen, open) {
    var box = open ? '<span class="fake" aria-expanded="true">' + chosen + '</span>'
      : '<select aria-label="Anzeigen">' + OPTIONS.map(function (o) { return '<option' + (o === chosen ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
    return '<label class="sel"><span>Anzeigen</span><span class="selBox">' + box + '<span class="chev">' + icon('down', 16) + '</span></span></label>' +
      (open ? '<ul class="openList" role="listbox" aria-label="Anzeigen">' + OPTIONS.map(function (o) {
        var on = o === chosen; return '<li role="option" aria-selected="' + on + '"><span class="ck">' + (on ? icon('check', 14, '', 2) : '') + '</span>' + o + '</li>';
      }).join('') + '</ul>' : '');
  }
  function legend(c) {
    var it = c.option === 'Wind und Böen'
      ? [['', 'Wind'], ['dash', 'Böen'], ['night', 'Nacht']]
      : [['', 'Temperatur'], ['dash', 'gefühlt'], ['box', 'Regenmenge'], ['thin', 'Regenwahrscheinlichkeit'], ['night', 'Nacht']];
    if (c.marker != null) it.push(['mark', c.markerLabel]);
    return '<ul class="legend" aria-hidden="true">' + it.map(function (x) { return '<li><span class="sw ' + x[0] + '"></span>' + x[1] + '</li>'; }).join('') + '</ul>';
  }
  function chartCard(c, idx) {
    return '<section class="card chartCard" aria-labelledby="c-t"><div class="secHead"><h2 class="secTitle" id="c-t">' + c.title + '</h2>' + select(c.option) + '</div>' +
      '<div class="chartBox" data-chart="' + idx + '"></div>' + legend(c) + '<p class="sr">' + (c.alt || '') + '</p></section>';
  }
  function smooth(p) {
    var d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1);
    for (var i = 1; i < p.length; i++) { var a = p[i - 1], b = p[i], dx = (b[0] - a[0]) / 2; d += 'C' + (a[0] + dx).toFixed(1) + ',' + a[1].toFixed(1) + ' ' + (b[0] - dx).toFixed(1) + ',' + b[1].toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1); }
    return d;
  }
  function drawChart(c, W, phone) {
    var L = 40, R = 8, N = c.labels.length, slot = (W - L - R) / N, X = function (i) { return L + (i + 0.5) * slot; };
    var T0 = 12, T1 = 172, B0 = 192, B1 = 236, LY = 258, H = 266, wind = c.option === 'Wind und Böen', out = '';
    // night shading across both bands
    (c.night || []).forEach(function (n) {
      var a = Math.max(L, X(n[0])), b = Math.min(W - R, X(n[1])); if (b > a) out += '<rect class="night" x="' + a.toFixed(1) + '" y="' + T0 + '" width="' + (b - a).toFixed(1) + '" height="' + (B1 - T0) + '"/>';
    });
    var s1 = wind ? c.wind : c.temp, s2 = wind ? c.gust : c.felt, all = s1.concat(s2);
    var lo = wind ? 0 : Math.floor(Math.min.apply(null, all)) - 1, hi = wind ? Math.ceil(Math.max.apply(null, all) / 10) * 10 : Math.ceil(Math.max.apply(null, all)) + 1;
    var Y = function (v) { return T1 - ((v - lo) / (hi - lo)) * (T1 - T0); };
    var ticks = wind ? [0, hi / 2, hi] : [lo, hi].concat(lo < 0 && hi > 0 ? [0] : [Math.round((lo + hi) / 2)]);
    ticks.forEach(function (v) {
      var y = Y(v).toFixed(1); out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"' + (v === 0 && !wind ? '' : ' stroke-dasharray="2 4"') + '/>' +
        '<text class="ax" x="' + (L - 6) + '" y="' + (+y + 4) + '" text-anchor="end">' + (wind ? v : deg(v)) + '</text>';
    });
    if (wind) out += '<text class="ax" x="' + (L - 6) + '" y="' + (T0 - 2 + 14 + 14) + '" text-anchor="end">km/h</text>';
    out += '<path class="l2" d="' + smooth(s2.map(function (v, i) { return [X(i), Y(v)]; })) + '"/>';
    out += '<path class="l1" d="' + smooth(s1.map(function (v, i) { return [X(i), Y(v)]; })) + '"/>';
    if (wind) {
      (c.dir || []).forEach(function (d, i) {
        if (i % 3) return; out += '<g transform="translate(' + X(i).toFixed(1) + ',' + ((B0 + B1) / 2) + ') rotate(' + (d + 180) + ')"><path class="arrow" d="M0,7L0,-7M-4,-3L0,-7L4,-3"/></g>';
      });
    } else {
      var maxA = Math.max(2, Math.max.apply(null, c.amount)), bw = Math.max(3, slot * 0.56);
      out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + B1 + '" y2="' + B1 + '"/>';
      c.amount.forEach(function (a, i) { if (a > 0) { var h = Math.max(2, (a / maxA) * (B1 - B0)); out += '<rect class="bar" x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + (B1 - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.5"/>'; } });
      out += '<path class="chance" d="' + smooth(c.chance.map(function (v, i) { return [X(i), B1 - (v / 100) * (B1 - B0)]; })) + '"/>';
      out += '<text class="ax" x="' + (L - 6) + '" y="' + (B0 + 4) + '" text-anchor="end">100 %</text><text class="ax" x="' + (L - 6) + '" y="' + (B1 + 4) + '" text-anchor="end">0</text>';
    }
    if (c.marker != null) out += '<line class="marker" x1="' + X(c.marker).toFixed(1) + '" x2="' + X(c.marker).toFixed(1) + '" y1="' + (T0 - 4) + '" y2="' + B1 + '"/>';
    var every = phone ? 6 : 3;
    c.labels.forEach(function (l, i) { if (i % every === 0) out += '<text class="ax" x="' + X(i).toFixed(1) + '" y="' + LY + '" text-anchor="middle">' + l + ' Uhr</text>'; });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' + out + '</svg>';
  }

  /* ---------- 7 days ---------- */
  var RT = { good: 'Gut', fair: 'Geht so', poor: 'Ungemütlich' };
  function dayRow(d, i, days, extra) {
    var checked = days.checked === i, lo = days.lo, span = days.hi - days.lo || 1;
    var left = ((d.min - lo) / span) * 100, width = Math.max(3, ((d.max - d.min) / span) * 100);
    var fill = 'left:' + left + '%;width:' + width + '%;background-size:' + (10000 / width) + '% 100%;background-position:' + (width >= 100 ? 0 : (left / (100 - width)) * 100) + '% 0';
    return '<label class="dr' + (extra ? ' ' + extra : '') + '"' + (checked ? ' data-checked' : '') + '><input class="sr" type="radio" name="day"' + (checked ? ' checked' : '') + '>' +
      icon(d.icon, 20, 'wx') + '<div class="rowBody"><p class="rowMain"><span class="dayName">' + d.name + '</span><span>' + d.word + '</span>' +
      '<span class="rchip" data-rating="' + d.rating + '">' + icon(d.rating, 14) + RT[d.rating] + '</span>' +
      '<span class="dayMoon" role="img" aria-label="Mond: ' + d.moon.name + '">' + moonGlyph(d.moon.illum, d.moon.waxing, 18, true) + '<span aria-hidden="true">' + d.moon.name + '</span></span></p>' +
      '<div class="range"><span class="rangeLabel" data-tone="' + tone(d.min) + '">' + deg(d.min) + '</span><span class="track" aria-hidden="true"><span class="fill" style="' + fill + '"></span></span>' +
      '<span class="rangeLabel" data-tone="' + tone(d.max) + '">' + deg(d.max) + '</span></div><p class="rowMeta">' + d.meta + '</p></div>' +
      '<span class="tickCol">' + (checked ? '<span class="tick">' + icon('check', 12, '', 2.2) + '</span>' : '') + '</span></label>';
  }
  function days(d) {
    d.lo = Math.min.apply(null, d.rows.map(function (r) { return r.min; })); d.hi = Math.max.apply(null, d.rows.map(function (r) { return r.max; }));
    return '<section class="card" aria-labelledby="d-t"><div class="secHead"><h2 class="secTitle" id="d-t">7 Tage</h2></div><div class="rows" role="radiogroup" aria-label="Tag wählen">' +
      d.rows.map(function (r, i) { return dayRow(r, i, d); }).join('') + '</div></section>';
  }

  /* ---------- Mehr Werte ---------- */
  function more(m) {
    return '<details class="more"' + (m.open ? ' open' : '') + '><summary>Mehr Werte' + icon('down', 18, 'chev') + '</summary><div class="groups">' +
      m.groups.map(function (g) {
        var body = g.text ? '<p>' + g.text + '</p>' : '<dl>' + g.items.map(function (x) { return '<dt' + (x[2] ? ' class="sub"' : '') + '>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>';
        return '<div class="grp"><h3>' + g.title + '</h3>' + body + '</div>';
      }).join('') + '</div></details>';
  }

  /* ---------- aside ---------- */
  function air(a) {
    if (a.missing) return '<section class="air"><div class="cardHead"><h2 class="cardTitle">Atemwege &amp; Allergie</h2></div><p class="note" style="font-size:var(--text-sm);color:var(--text)">' + a.missing + '</p></section>';
    return '<section class="air"><div class="cardHead"><h2 class="cardTitle">Atemwege &amp; Allergie</h2><span class="rchip" data-rating="' + a.rating + '">' + icon(a.rating, 14) + RT[a.rating] + '</span></div>' +
      '<p class="aqi" data-band="' + a.rating + '"><b>Luftqualität ' + a.aqi + '</b><span>' + a.band + '</span></p>' +
      '<ul class="kv">' + a.pollutants.map(function (p) { return '<li><span>' + p[0] + '</span><span>' + p[1] + ' µg/m³</span></li>'; }).join('') + '</ul>' +
      '<p class="sub">Pollen</p><ul class="kv">' + a.pollen.map(function (p) { return '<li data-level="' + (p[1] === 'keine' ? 'none' : '') + '"><b>' + p[0] + '</b><span>' + p[1] + (p[2] ? ' · ' + p[2] : '') + '</span></li>'; }).join('') + '</ul>' +
      '<p class="note">Orientierung, keine ärztliche Beratung. Bei Asthma oder Allergie gilt dein Behandlungsplan.</p></section>';
  }
  function moonCard(m) {
    return '<section class="moon"><h2 class="cardTitle">Mond &amp; Himmel</h2><p class="line">' + m.sun + '</p>' +
      '<div class="now">' + moonGlyph(m.illum, m.waxing, 56) + '<p class="name"><span class="phase">' + m.name + '</span><span>' + Math.round(m.illum * 100) + ' % beleuchtet</span></p></div>' +
      '<p class="line">' + m.times + '</p><p class="line">' + m.next + '</p></section>';
  }
  function foot() {
    return '<p class="foot">Gut, wenn nichts dagegen spricht. Ungemütlich bei Regen, Sturm, Frost oder Hitze.</p><p class="foot"><a href="#">Einstellungen</a></p>' +
      '<p class="foot">Wetterdaten von <a href="#">Open-Meteo.com (CC BY 4.0)</a></p>';
  }

  /* ---------- the page ---------- */
  function isPhone() { return window.innerWidth < 900; }
  function render(sel, m) {
    var phone = isPhone(), host = document.querySelector(sel);
    host.innerHTML = head(m, phone) + placeRow(m) +
      '<div class="layout"><div class="main">' + (m.rainSoon ? rainSoon(m.rainSoon) : '') + hours(m.hours) + (m.chart ? chartCard(m.chart, 0) : '') + days(m.days) + more(m.more) + '</div>' +
      '<aside class="aside" aria-label="Luft, Mond und Himmel">' + air(m.air) + moonCard(m.moon) + '</aside></div>' + foot() +
      '<div class="sr" aria-live="polite">' + (m.live || '') + '</div>';
    if (m.chart) { var box = host.querySelector('[data-chart]'); box.innerHTML = drawChart(m.chart, box.clientWidth, phone); }
    if (m.hours && m.hours.scrollTo) { var sc = host.querySelector('.hourScroll'); if (sc) sc.scrollLeft = m.hours.scrollTo; }
  }

  /* hour helpers for the models: keypoint interpolation */
  function curve(keys, from, n) { // keys: [[hour 0..47, value]], returns n values from hour `from`
    var out = [];
    for (var i = 0; i < n; i++) {
      var h = from + i, v = keys[keys.length - 1][1];
      for (var k = 1; k < keys.length; k++) if (h <= keys[k][0]) { var a = keys[k - 1], b = keys[k]; v = a[1] + ((b[1] - a[1]) * (h - a[0])) / (b[0] - a[0] || 1); break; }
      out.push(Math.round(v));
    }
    return out;
  }
  function hh(h) { h = h % 24; return (h < 10 ? '0' : '') + h; }

  /* ---------- sample data shared by the November pages (Lindenau, today Thursday 2026-11-26) ---------- */
  function week(checked) {
    var A = 'Abnehmender Mond', Q = 'Abnehmender Halbmond';
    return { checked: checked, rows: [
      { name: 'Heute', icon: 'cloud', word: 'bedeckt', rating: 'fair', moon: { name: A, illum: 0.95 }, min: -3, max: 2, meta: 'Wind 6 km/h NO · UV 1 · Sonne 07:41–16:22' },
      { name: 'Fr., 27.11.', icon: 'rain', word: 'leichter Regen', rating: 'poor', moon: { name: A, illum: 0.89 }, min: 1, max: 5, meta: 'Regen 70 % · Wind 14 km/h SW · UV 1 · Sonne 07:43–16:21' },
      { name: 'Sa., 28.11.', icon: 'snow', word: 'Schneefall', rating: 'poor', moon: { name: A, illum: 0.81 }, min: -3, max: 4, meta: 'Schnee 80 % · Wind 28 km/h NW · UV 1 · Sonne 07:44–16:20' },
      { name: 'So., 29.11.', icon: 'cloud', word: 'bewölkt', rating: 'fair', moon: { name: A, illum: 0.71 }, min: -5, max: 0, meta: 'Wind 12 km/h N · UV 1 · Sonne 07:45–16:19' },
      { name: 'Mo., 30.11.', icon: 'cloudSun', word: 'leicht bewölkt', rating: 'fair', moon: { name: A, illum: 0.61 }, min: -7, max: -1, meta: 'Wind 8 km/h O · UV 1 · Sonne 07:47–16:19' },
      { name: 'Di., 1.12.', icon: 'cloud', word: 'bedeckt', rating: 'fair', moon: { name: Q, illum: 0.52 }, min: -3, max: 3, meta: 'Wind 10 km/h S · UV 1 · Sonne 07:48–16:18' },
      { name: 'Mi., 2.12.', icon: 'rain', word: 'Regen', rating: 'poor', moon: { name: Q, illum: 0.43 }, min: 2, max: 6, meta: 'Regen 90 % · Wind 24 km/h SW · UV 1 · Sonne 07:49–16:18' },
    ] };
  }
  var NEXT_NOV = 'Vollmond am Do., 24. Dez. · Neumond am Mi., 9. Dez.';
  var POLLEN_NONE = [['Erle', 'keine'], ['Birke', 'keine'], ['Gräser', 'keine']];
  window.Page = { render: render, icon: icon, moonGlyph: moonGlyph, deg: deg, curve: curve, hh: hh, isPhone: isPhone, dark: dark,
    sample: { week: week, nextNov: NEXT_NOV, pollenNone: POLLEN_NONE },
    parts: { head: head, stepper: stepper, rainSoon: rainSoon, hourCard: hourCard, hours: hours, select: select, chartCard: chartCard, drawChart: drawChart, dayRow: dayRow, days: days, more: more, air: air, moonCard: moonCard } };
})();
