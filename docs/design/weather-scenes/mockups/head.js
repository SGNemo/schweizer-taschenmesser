/* Weather head mockup builder (07-kopf): title row, the phone's module row, the stage with the scene as backdrop.
   Head.render(selector, situations). Geometry from the coordinator's measurements (2026-11-24): desktop stage
   1650 × 280 (title row 56 + body 224), phone ≤ 312 (title row 44 + module row 44 + body). Text on the sky takes the
   scene's ink (Scene.ink); chips, pills and the module row have opaque backings with the theme's own ink. */
(function () {
  var I = { // 16 px line icons (stroke currentColor)
    umbrella: '<path d="M2.5 8.5a5.5 5.5 0 0 1 11 0z"/><path d="M8 8.5v4.5a1.5 1.5 0 0 1-3 0"/><path d="M8 3V2"/>',
    wind: '<path d="M2 6h8a2 2 0 1 0-2-2"/><path d="M2 10h10a2 2 0 1 1-2 2"/>',
    sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>',
    rain: '<path d="M4.5 10a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 6 2 2 0 0 1 12 10z"/><path d="M5.5 12.5l-.8 1.6M8.5 12.5l-.8 1.6M11.5 12.5l-.8 1.6"/>',
    snow: '<path d="M4.5 10a3 3 0 1 1 .6-5.9A4 4 0 0 1 12.8 6 2 2 0 0 1 12 10z"/><path d="M5.5 13h.01M8.5 14h.01M11 13h.01"/>',
    thermo: '<path d="M6.5 9.3V3a1.5 1.5 0 0 1 3 0v6.3a3 3 0 1 1-3 0z"/><path d="M8 7v4"/>',
    bolt: '<path d="M9 1.5L4 9h4l-1 5.5L12 7H8z"/>',
    warn: '<path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3M8 11.6h.01"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    cloudSun: '<path d="M5.5 13a2.8 2.8 0 1 1 .5-5.6 3.6 3.6 0 0 1 6.9 1.2A2.2 2.2 0 0 1 12.5 13z"/><path d="M5 2v1M1.8 5.2h1M2.8 3l.7.7M7.2 3l-.7.7"/>',
  };
  function icon(n, size) {
    return '<svg class="ic" viewBox="0 0 16 16" width="' + (size || 16) + '" height="' + (size || 16) + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>';
  }
  function chip(c) {
    var ic = c.moon ? Scene.moonGlyph(Object.assign({ size: 16, mono: true }, c.moon)) : icon(c.icon);
    return '<li class="key"' + (c.kind ? ' data-kind="' + c.kind + '"' : '') + '>' + ic + c.text + '</li>';
  }
  function hintPill(h) {
    if (!h.hints || !h.hints.length) return '';
    var off = h.official ? '<div class="official">' + icon('warn') + '<b>Amtliche Warnung · ' + h.official + '</b><a href="#">Quelle</a></div>' : '';
    return off + '<div class="hint"><ul>' + h.hints.map(function (x) { return '<li>' + icon(x.icon) + '<span>' + x.text + '</span></li>'; }).join('') +
      '</ul><span class="suffix">· berechnet, keine amtliche Warnung</span></div>';
  }
  function head(h, phone) {
    var st = Gallery.withTheme(Object.assign({}, h.state)), ink = Scene.ink(st);
    var chips = phone ? h.chips.slice(0, 2) : h.chips;
    var restLine = phone ? [h.chips[2] && h.chips[2].text].concat(h.rest).filter(Boolean).join(' · ') : h.rest.join(' · ');
    return '<div class="whead ' + (phone ? 'phone' : 'desk') + '" data-ink="' + ink + '">' +
      '<div class="backdrop">' + Scene.svg(st, phone ? { quietX: 1300, extendTop: 90 } : null) + '</div>' +
      '<div class="titleRow"><span class="plate">' + icon('cloudSun', 18) + '</span><h1>Lindenau</h1><span class="sp"></span>' +
      '<button class="gear" aria-label="Einstellungen">' + icon('gear', 20) + '</button></div>' +
      (phone ? '<nav class="modrow"><span>Kalender</span><span>Planer</span><span>ToDos</span><span class="on">Wetter</span><span>…</span></nav>' : '') +
      '<div class="stageBody"><div class="fig"><div class="temp">' + h.temp + '</div><div class="detail">' + h.detail + '</div></div>' +
      hintPill(h) + '<ul class="keys">' + chips.map(chip).join('') + '</ul>' + (phone ? '' : '<p class="rest">' + restLine + '</p>') + '</div></div>' +
      (phone ? '<p class="restBelow">' + restLine + '</p>' : '');
  }
  function render(sel, list) {
    var host = document.querySelector(sel);
    host.innerHTML = list.map(function (h, i) {
      return '<section class="sit"><p class="label">(' + (h.n || i + 1) + ') ' + h.title + '</p>' + head(h, false) +
        '<div class="phonebox">' + head(h, true) + '</div></section>';
    }).join('');
  }
  window.Head = { render: render, icon: icon };
})();
