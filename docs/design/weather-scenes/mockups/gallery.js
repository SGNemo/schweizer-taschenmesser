/* Gallery helper for the mockup pages: Gallery.tiles(selector, items, { crops, cols }).
   item = { label, note?, state }; crops: ['wide'] | ['wide', 'phone'] | ['phone']. The theme follows the page's
   prefers-color-scheme (the render script sets it), so every scene is drawn for the theme it is shown in. */
(function () {
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  function withTheme(s) { return Object.assign({ theme: dark ? 'dark' : 'light' }, s); }
  function tiles(sel, items, opts) {
    opts = opts || {};
    var crops = opts.crops || ['wide'], host = document.querySelector(sel);
    host.className = 'grid' + (opts.cols ? ' ' + opts.cols : '');
    host.innerHTML = items.map(function (it) {
      var s = withTheme(it.state), boxes = crops.map(function (c) { return '<div class="box ' + c + '">' + Scene.svg(s) + '</div>'; }).join('');
      return '<figure class="tile"><div class="crops">' + boxes + '</div><figcaption>' + it.label +
        (it.note ? '<small>' + it.note + '</small>' : '') + '</figcaption></figure>';
    }).join('');
  }
  window.Gallery = { dark: dark, withTheme: withTheme, tiles: tiles };
})();
