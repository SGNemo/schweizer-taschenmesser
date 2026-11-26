/* Gallery helper for the round-2 pages: Gallery2.tiles(selector, items, { crops, cols }).
   item = { label, note?, state, wrap? }; crops: ['wide'] | ['wide', 'phone'] | ['phone'].
   wide = a box of the built desktop stage (1650 × 320), phone = 412 × 256 with Scene.phoneOpts(256, 412).
   The theme follows the page's prefers-color-scheme unless the state sets `theme`. Every scene gets its own idp.
   The note under the label lists the state keys (set by hand plus what Scene.state derives: sky, cover, mode). */
(function () {
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, seq = 0;
  function withTheme(s) { return Object.assign({ theme: dark ? 'dark' : 'light' }, s); }
  function keys(s) {
    var full = Scene.state(s), parts = [];
    Object.keys(s).forEach(function (k) { if (k !== 'theme') parts.push(k + ': ' + (typeof s[k] === 'object' && s[k] ? JSON.stringify(s[k]).replace(/"/g, '') : s[k])); });
    parts.push('→ ' + Scene.skyKey(full) + ', cover ' + full.cover + (full.body ? ', ' + (Scene.bodyMode(s) || '–') : ''));
    return parts.join(' · ');
  }
  function box(kind, s, wrap) {
    var o = kind === 'phone' ? Scene.phoneOpts(256, 412) : {};
    o.idp = 'g' + seq++;
    var svg = Scene.svg(s, o);
    if (wrap) svg = wrap(svg, s);
    var st = kind === 'phone' ? 'width:412px;height:256px' : 'aspect-ratio:1650/320';
    return '<div class="box ' + kind + '" style="' + st + '">' + svg + '</div>';
  }
  function tiles(sel, items, opts) {
    opts = opts || {};
    var crops = opts.crops || ['wide'], host = document.querySelector(sel);
    host.className = 'grid' + (opts.cols ? ' ' + opts.cols : '');
    host.innerHTML = items.map(function (it) {
      var s = withTheme(it.state), boxes = crops.map(function (c) { return box(c, s, it.wrap); }).join('');
      return '<figure class="tile"><div class="crops">' + boxes + '</div><figcaption>' + it.label +
        '<small>' + (it.note ? it.note + ' · ' : '') + keys(it.state) + '</small></figcaption></figure>';
    }).join('');
  }
  window.Gallery2 = { dark: dark, withTheme: withTheme, tiles: tiles, box: box, keys: keys };
})();
