/* Weather head mockup builder (07-kopf): title row, the phone's module row, the stage with the scene as backdrop.
   Head.render(selector, situations). Geometry from the coordinator's measurements (2026-11-24): desktop stage
   1650 × 280 (title row 56 + body 224), phone ≤ 312 (title row 44 + module row 44 + body). Text on the sky takes the
   scene's ink (Scene.ink); chips, pills and the module row have opaque backings with the theme's own ink.
   Phone: after layout the scene is redrawn for the measured stage (PHONE below): the body at 80 % of the width between
   the module row and the first pill/chip, the landscape scaled so the summits stay below it. */
(function () {
  var PHONE = { k: 0.6, bodyX: 0.83, rowsBottom: 88, quietPx: 300 }; // scene scale, body centre (share of width), rows end
  var I = { // 16 px line icons (stroke currentColor)
    umbrella: '<path d="M2.5 8.5a5.5 5.5 0 0 1 11 0z"/><path d="M8 8.5v4.5a1.5 1.5 0 0 1-3 0"/><path d="M8 3V2"/>',
    wind: '<path d="M2 6h8a2 2 0 1 0-2-2"/><path d="M2 10h10a2 2 0 1 1-2 2"/>',
    sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
    rain: '<path d="M4.5 10a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 6 2 2 0 0 1 12 10z"/><path d="M5.5 12.5l-.8 1.6M8.5 12.5l-.8 1.6M11.5 12.5l-.8 1.6"/>',
    snow: '<path d="M4.5 10a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 6 2 2 0 0 1 12 10z"/><path d="M5.5 13h.01M8.5 14h.01M11 13h.01"/>',
    cloud: '<path d="M4.5 12a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 8 2 2 0 0 1 12 12z"/>',
    thermo: '<path d="M6.5 9.3V3a1.5 1.5 0 0 1 3 0v6.3a3 3 0 1 1-3 0z"/><path d="M8 7v4"/>',
    bolt: '<path d="M9 1.5L4 9h4l-1 5.5L12 7H8z"/>',
    warn: '<path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3M8 11.6h.01"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    cloudSun: '<path d="M5.5 13a2.8 2.8 0 1 1 .5-5.6 3.6 3.6 0 0 1 6.9 1.2A2.2 2.2 0 0 1 12.5 13z"/><path d="M5 2v1M1.8 5.2h1M2.8 3l.7.7M7.2 3l-.7.7"/>',
    // sky-event glyphs (10-karte)
    eclipse: '<circle cx="7" cy="9" r="5"/><circle cx="10.2" cy="5.8" r="4" fill="currentColor" stroke="none"/>',
    lunar: '<circle cx="8" cy="8" r="5.5"/><path d="M4.1 4.1a5.5 5.5 0 0 0 7.8 7.8z" fill="currentColor"/>',
    rainbow: '<path d="M1.5 12.5a6.5 6.5 0 0 1 13 0"/><path d="M4 12.5a4 4 0 0 1 8 0"/>',
    meteor: '<path d="M13.5 2.5L6 10"/><path d="M11 2.5L7.5 6"/><circle cx="4.5" cy="11.5" r="1.8" fill="currentColor"/>',
    solstice: '<path d="M1.5 12.5h13"/><path d="M3 12.5a5 3.5 0 0 1 10 0" stroke-dasharray="1.6 1.8"/><circle cx="11.4" cy="10.4" r="1.6" fill="currentColor"/>',
    aurora: '<path d="M1.5 6.5c2-3 4 3 6.5 0s4.5 3 6.5 0"/><path d="M1.5 11c2-3 4 3 6.5 0s4.5 3 6.5 0"/>',
    dust: '<path d="M2 5h8M4 8h10M2 11h7"/><circle cx="12.5" cy="5" r=".6" fill="currentColor"/><circle cx="11" cy="11" r=".6" fill="currentColor"/>',
  };
  function icon(n, size) {
    return '<svg class="ic" viewBox="0 0 16 16" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>';
  }
  function chip(c) {
    var ic = c.moon ? Scene.moonGlyph(Object.assign({ size: 16, mono: true }, c.moon)) : c.icon ? icon(c.icon) : '';
    return '<li class="key"' + (c.kind ? ' data-kind="' + c.kind + '"' : '') + '>' + ic + c.text + '</li>';
  }
  /* Official warning (drawn for a real source): a pill that looks more official than the computed hint – 22 % warning tint,
     a hairline in --warning, theme ink – and replaces today's computed hints. Computed hints for other days follow. */
  function hintPill(h) {
    var out = '', o = h.official;
    if (o) out += '<div class="official">' + icon('warn') + '<span class="ot"><b>' + o.title + '</b> <span class="om">' + o.until + ' · Quelle: <a href="#">' + o.source + '</a></span></span></div>';
    if (h.hints && h.hints.length) out += '<div class="hint"><ul>' + h.hints.map(function (x) { return '<li>' + icon(x.icon) + '<span>' + x.text + '</span></li>'; }).join('') +
      '</ul><span class="suffix">· berechnet, keine amtliche Warnung</span></div>';
    return out ? '<div class="pills">' + out + '</div>' : '';
  }
  function stateOf(h) {
    var st = Object.assign({}, h.state);
    if (h.theme) st.theme = h.theme;
    return Gallery.withTheme(st);
  }
  function head(h, phone) {
    var st = stateOf(h), ink = Scene.ink(st), chips = h.chips || [];
    var restLine = phone ? [chips[2] && chips[2].text].concat(h.rest || []).filter(Boolean).join(' · ') : (h.rest || []).join(' · ');
    if (phone) chips = chips.slice(0, 2);
    var body = h.empty ? '' : '<div class="stageBody"><div class="fig"><div class="temp">' + h.temp + '</div><div class="detail">' + (h.detail || '&nbsp;') + '</div></div>' +
      hintPill(h) + '<ul class="keys">' + chips.map(chip).join('') + '</ul>' + (phone ? '' : '<p class="rest">' + restLine + '</p>') + '</div>';
    return '<div class="whead ' + (phone ? 'phone' : 'desk') + (h.theme ? ' theme-' + h.theme : '') + '" data-ink="' + ink + '"' +
      (h.width && !phone ? ' style="width:' + h.width + 'px"' : '') + '>' +
      '<div class="backdrop">' + Scene.svg(st) + '</div>' +
      '<div class="titleRow"><span class="plate">' + icon('cloudSun', 18) + '</span><h1>' + (h.place || 'Lindenau') + '</h1><span class="sp"></span>' +
      '<button class="gear" aria-label="Einstellungen">' + icon('gear', 20) + '</button></div>' +
      (phone ? '<nav class="modrow"><span>Kalender</span><span>Planer</span><span>ToDos</span><span class="on">Wetter</span><span>…</span></nav>' : '') +
      body + '</div>' + (phone && restLine && !h.empty ? '<p class="restBelow' + (h.theme ? ' theme-' + h.theme : '') + '">' + restLine + '</p>' : '');
  }
  /* Phone: redraw the scene for the measured stage. Scale k: the summits (alpine crest ≈ y 140 at the body's x)
     stay below the body; the body sits between the rows and the first pill or chip. */
  function fitPhone(el, h) {
    var H = el.offsetHeight, W = el.offsetWidth, first = el.querySelector('.pills, .keys');
    var below = first ? first.getBoundingClientRect().top - el.getBoundingClientRect().top : H - 40, yc = (PHONE.rowsBottom + below) / 2;
    var st = stateOf(h), r = (st.body && st.body.kind === 'moon' ? 42 * ((st.moon && st.moon.size) || 1) : 46);
    var k = Math.min(PHONE.k, (H - yc - 6) / (320 - 140 + r)), ext = H / k - 320;
    var opts = { extendTop: Math.round(ext), quietX: Math.round(1600 - W / k + PHONE.quietPx / k) };
    opts.bodyAt = [Math.round(1600 - (W * (1 - PHONE.bodyX)) / k), Math.round(-ext + yc / k)];
    el.querySelector('.backdrop').innerHTML = Scene.svg(st, opts);
  }
  function render(sel, list) {
    var host = document.querySelector(sel);
    host.innerHTML = list.map(function (h, i) {
      return '<section class="sit"><p class="label">(' + (h.n || i + 1) + ') ' + h.title + '</p>' + (h.phoneOnly ? '' : head(h, false)) +
        (h.deskOnly ? '' : '<div class="phonebox">' + head(h, true) + '</div>') + '</section>';
    }).join('');
    var phones = host.querySelectorAll('.whead.phone'), k = 0;
    list.forEach(function (h) { if (!h.deskOnly) fitPhone(phones[k++], h); });
  }
  window.Head = { render: render, icon: icon };
})();
