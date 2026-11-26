/* Motion for the round-2 scene (mockup). SceneMotion.svg(state, opts) = Scene.svg plus the classes and the one extra
   copy that scene-motion.css animates. It post-processes the markup by its data-layer / data-part names, so scene.js
   stays the designer's drawing; the port puts the same classes in draw.ts. The still picture is unchanged: every
   animation ends exactly on it. What moves (at most 9 groups):
     precip   .sc-fall   a tile loop: the precip group gets a copy one tile up (and against the slant) and moves by one tile,
                         n times in 5 s; at the end of each tile the copy stands where the original stood, so the loop is
                         seamless and ends on the still. Rain is clipped to below the cloud base (y 124, showers 104);
                         the splash marks stay put.
     clouds   .sc-drift  veil, cumulus, the banks around the body, the single thunder tower: 16 units to the lee once.
                         Full-width sheets (deck, storm base) stay: a moved sheet would open a gap at the edge.
     smoke    .sc-smoke  rises and sways a little, once.
     flag     .sc-flag   waves three times at wind ≥ 1.
     trees    .sc-sway   sway once (one 5 s iteration) at wind ≥ 2: trees and the trees behind the cabin.
     glow     .sc-glow-up a hidden copy of the bolt glow (.sc-glow) fades in 1.2 s and out 1.2 s, from 1 s, once.
                         The bolts never move. */
(function () {
  var seq = 0;
  function svg(input, opts) {
    var s = Scene.state(input), G = Scene.G, out = Scene.svg(input, opts), dir = s.windTo === 'left' ? -1 : 1;
    var view = (opts && opts.view) || [0, 0, G.W, G.H], top = Math.min(0, view[1]) - 4, slant = G.slant[s.wind] * dir;
    // precipitation: the tile loop
    out = out.replace(/<g data-layer="precip" class="sc-fall"([^>]*)>([\s\S]*?)<\/g>/, function (m, attrs, inner) {
      var splash = '', snow = s.falling === 'snow', showers = /howers/.test(s.cond) || s.thunder === 1, drizzle = /rizzle/.test(s.cond);
      inner = inner.replace(/<path[^>]*data-part="splash"[^>]*\/>/, function (p) { splash = p; return ''; });
      var T = snow ? G.H - top : 190, fx = slant * T * (snow ? 0.5 : 1), dur = snow ? 5 : drizzle ? 5 / 6 : 0.5, n = Math.round(5 / dur);
      var clip = '', cid = 'mo' + seq++;
      if (!snow) clip = '<clipPath id="' + cid + '"><rect x="-400" y="' + (showers ? 104 : 124) + '" width="2400" height="' + (G.H + 40) + '"/></clipPath>';
      return clip + '<g' + (clip ? ' clip-path="url(#' + cid + ')"' : '') + attrs + '><g data-layer="precip" class="sc-fall" style="--fx:' + Scene.util.f(fx) + 'px;--fy:' + Scene.util.f(T) + 'px;--dur:' + Scene.util.f(dur * 1000) / 1000 + 's;--n:' + n + '">' +
        inner + '<g transform="translate(' + Scene.util.f(-fx) + ' ' + Scene.util.f(-T) + ')">' + inner + '</g></g>' + splash + '</g>';
    });
    // clouds drift to the lee (not the full-width sheets)
    out = out.replace(/<g data-layer="(clouds|cloudsFar)"( data-part="banks")?>(?!<path d="M0,)/g, function (m) { return m.slice(0, -1) + ' class="sc-drift" style="--lee:' + 16 * dir + 'px">'; });
    out = out.replace('data-part="smoke"', 'data-part="smoke" class="sc-smoke"');
    if (s.wind >= 1) out = out.replace('data-part="flag"', 'data-part="flag" class="sc-flag' + (dir < 0 ? ' sc-left' : '') + '"');
    if (s.wind >= 2) out = out.replace(/<g data-part="(trees|treesBehind)">/g, function (m) { return m.slice(0, -1) + ' class="sc-sway" style="--dir:' + dir + '">'; });
    out = out.replace(/<circle([^>]*)class="sc-glow"([^>]*)\/>/, function (m, a, b) { return m + '<circle' + a + 'class="sc-glow-up"' + b + '/>'; });
    return out;
  }
  function count(markup) { return (markup.match(/class="sc-(fall|drift|smoke|flag|sway|glow-up)/g) || []).length; }
  window.SceneMotion = { svg: svg, count: count };
})();
