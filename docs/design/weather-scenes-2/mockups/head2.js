/* Weather round 2: head builder for the style page (mockup only). Head2.render(selector, style, opts).
   Geometry as built (PACKAGES "as built" 1b): desktop stage 1650 × 280 (title row 56), phone 412 × 272 (title row 44 +
   module row 44). opts.big: the proposed larger picture – desktop 320 px; phone: the picture carries only temperature and
   detail line (256 px), hint and chips stand under it on the page. Texts: sample place "Lindenau", Thursday 2026-11-26. */
(function () {
  var I = {
    umbrella: '<path d="M2.5 8.5a5.5 5.5 0 0 1 11 0z"/><path d="M8 8.5v4.5a1.5 1.5 0 0 1-3 0"/><path d="M8 3V2"/>',
    wind: '<path d="M2 6h8a2 2 0 1 0-2-2"/><path d="M2 10h10a2 2 0 1 1-2 2"/>',
    sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
    rain: '<path d="M4.5 10a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 6 2 2 0 0 1 12 10z"/><path d="M5.5 12.5l-.8 1.6M8.5 12.5l-.8 1.6M11.5 12.5l-.8 1.6"/>',
    thermo: '<path d="M6.5 9.3V3a1.5 1.5 0 0 1 3 0v6.3a3 3 0 1 1-3 0z"/><path d="M8 7v4"/>',
    bolt: '<path d="M9 1.5L4 9h4l-1 5.5L12 7H8z"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    cloudSun: '<path d="M5.5 13a2.8 2.8 0 1 1 .5-5.6 3.6 3.6 0 0 1 6.9 1.2A2.2 2.2 0 0 1 12.5 13z"/><path d="M5 2v1M1.8 5.2h1M2.8 3l.7.7M7.2 3l-.7.7"/>',
    moon: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 0 0 11a4.6 5.5 0 0 0 0-11z" fill="currentColor" stroke="none"/>',
  };
  function icon(n, size) {
    return '<svg class="ic" viewBox="0 0 16 16" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>';
  }
  var dry = { icon: 'umbrella', text: 'Kein Regen in Sicht' };
  var SIT = {
    frost: { label: '(a) Bedeckte Frostnacht, der Mond im Wolkenloch · 02:00, −1°', temp: '−1°', detail: 'fühlt sich an wie −5° · bedeckt · Frost',
      hints: [{ icon: 'thermo', text: 'Heute: Frost bis −3°' }], chips: [dry, { icon: 'wind', text: 'Wind 6 km/h NO' }, { icon: 'moon', text: 'Abnehmender Mond · 95 %' }],
      rest: ['−3° / 2°', 'Luftfeuchte 89 %', 'Bewölkung 100 %', '1024 hPa', 'Sonne 07:41–16:22'] },
    storm: { label: '(b) Starkes Gewitter am Tag, kräftiger Wind · 16:20, 19°', temp: '19°', detail: 'fühlt sich an wie 17° · starkes Gewitter · windig',
      hints: [{ icon: 'bolt', text: 'Heute: Gewitter, Böen bis 72 km/h' }], chips: [{ icon: 'rain', kind: 'rain', text: 'Regen bis 18 Uhr' }, { icon: 'wind', text: 'Wind 46 km/h SW' }, { icon: 'sun', text: 'UV 2' }],
      rest: ['15° / 27°', 'Luftfeuchte 84 %', 'Bewölkung 100 %', '1004 hPa', 'Sonne 05:40–21:12'] },
    winter: { label: '(c) Sonniger Wintertag, Schnee liegt · 12:30, −3°', temp: '−3°', detail: 'fühlt sich an wie −7° · klar · Schnee liegt',
      hints: [], chips: [dry, { icon: 'wind', text: 'Wind 7 km/h O' }, { icon: 'sun', text: 'UV 1' }],
      rest: ['−8° / −1°', 'Luftfeuchte 62 %', 'Bewölkung 5 %', '1031 hPa', 'Sonne 08:02–16:48'] },
  };
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, theme = dark ? 'dark' : 'light';
  function chip(c) { return '<li class="key"' + (c.kind ? ' data-kind="' + c.kind + '"' : '') + '>' + icon(c.icon) + c.text + '</li>'; }
  function pill(h) {
    return h.hints.length ? '<div class="pills"><div class="hint"><ul>' + h.hints.map(function (x) { return '<li>' + icon(x.icon) + '<span>' + x.text + '</span></li>'; }).join('') +
      '</ul><span class="suffix">· berechnet, keine amtliche Warnung</span></div></div>' : '';
  }
  function head(id, style, phone, big) {
    var h = SIT[id], ink = Styles.ink(id, theme), chips = phone ? h.chips.slice(0, 2) : h.chips, o = { theme: theme, idp: (phone ? 'p' : 'd') + (big ? 'b' : '') };
    var restLine = (phone ? [h.chips[2].text] : []).concat(h.rest).join(' · ');
    var stageH = phone ? (big ? 256 : 272) : big ? 320 : 280;
    if (phone) { var k = 0.56; o.view = [Math.round(1600 - 412 / k), Math.round(320 - stageH / k), Math.round(412 / k), Math.round(stageH / k)]; o.bodyAt = [1438, 98]; }
    var keys = '<ul class="keys">' + chips.map(chip).join('') + '</ul>';
    var fig = '<div class="fig"><div class="temp">' + h.temp + '</div><div class="detail">' + h.detail + '</div></div>';
    var inside = phone && big ? fig : fig + pill(h) + keys + (phone ? '' : '<p class="rest">' + restLine + '</p>');
    var below = phone ? (big ? '<div class="under">' + pill(h) + keys + '</div>' : '') + '<p class="restBelow">' + restLine + '</p>' : '';
    return '<div class="whead ' + (phone ? 'phone' : 'desk') + '" data-ink="' + ink + '" style="height:' + stageH + 'px;min-height:0;max-height:none">' +
      '<div class="backdrop">' + Styles.svg(id, style, o) + '</div>' +
      '<div class="titleRow"><span class="plate">' + icon('cloudSun', 18) + '</span><h1>Lindenau</h1><span class="sp"></span><button class="gear" aria-label="Einstellungen">' + icon('gear', 20) + '</button></div>' +
      (phone ? '<nav class="modrow"><span>Kalender</span><span>Planer</span><span>ToDos</span><span class="on">Wetter</span><span>…</span></nav>' : '') +
      '<div class="stageBody">' + inside + '</div></div>' + below;
  }
  function render(sel, style, opts) {
    opts = opts || {};
    var host = document.querySelector(sel), ids = ['frost', 'storm', 'winter'];
    host.innerHTML = ids.map(function (id) { return '<p class="label">' + SIT[id].label + '</p>' + head(id, style, false, opts.big); }).join('') +
      '<div class="phones">' + ids.map(function (id) { return '<div class="phonebox">' + head(id, style, true, opts.big) + '</div>'; }).join('') + '</div>';
    var cost = host.parentNode.querySelector('.cost');
    if (cost) cost.textContent = ids.map(function (id) { var s = Styles.svg(id, style, { theme: theme }); return id + ': ' + Styles.count(s) + ' Elemente, ' + (s.length / 1024).toFixed(1) + ' KB'; }).join(' · ');
  }
  window.Head2 = { render: render, icon: icon, SIT: SIT };
})();
