/* Living scenes – step 1 "signs": 32 px flat shapes at the end of a card head that read the card's data.
   Two tones of the module hue (.s1 = the hue, .s2 = the hue 38 % into the card surface) plus the card surface (.s0);
   one exception: the lit window of the routines house (.sw, a warm fill). aria-hidden: numbers stay text in the card.
   window.Signs = { planner, budgets, timetrack, pantry, routines, todos, lists, habits } → '<span class="sign">…</span>' */
(function () {
  function f(n) { return Math.round(n * 100) / 100; }
  function wrap(inner, name) {
    return '<span class="sign" data-sign="' + name + '" aria-hidden="true"><svg viewBox="0 0 32 32" width="32" height="32" focusable="false">' + inner + '</svg></span>';
  }
  function rect(x, y, w, h, cls, rx) { return '<rect class="' + cls + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (rx ? ' rx="' + rx + '"' : '') + '/>'; }
  function path(d, cls, extra) { return '<path class="' + cls + '" d="' + d + '"' + (extra || '') + '/>'; }

  /* Wochenlast: seven bars Mo–So, height = the day's load 0..1, today's bar in the full hue (never red) */
  function planner(loads, today) {
    var o = rect(2, 28.6, 28, 1.4, 's2', 0.7);
    loads.forEach(function (v, i) {
      var h = Math.max(1.6, Math.min(1, v) * 22);
      o += rect(2.6 + i * 3.9, 28.6 - h, 2.9, h, i === today ? 's1' : 's2', 0.8);
    });
    return wrap(o, 'planner');
  }
  /* Budgets: an envelope filled to the spent share of the month's budgets in total (capped at full) */
  function budgets(share) {
    var s = Math.max(0, Math.min(1, share)), top = 8, h = 17, y = top + h * (1 - s), o = rect(4, top, 24, h, 's2', 2.5);
    if (s > 0) o += y <= top + h - 2.5
      ? path('M4,' + f(y) + 'H28V' + (top + h - 2.5) + 'a2.5,2.5 0 0 1 -2.5,2.5H6.5a2.5,2.5 0 0 1 -2.5,-2.5Z', 's1')
      : rect(5, y, 22, top + h - y, 's1');
    o += path('M5.5,9.6L16,17.6L26.5,9.6', 'l0', ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"');
    return wrap(o, 'budgets');
  }
  /* Zeiterfassung: a round dial, the arc = minutes today / 8 h, a hand only while a timer runs */
  function timetrack(min, running) {
    var c = [16, 18], r = 9.2, a = Math.min(1, min / 480), o = rect(14.2, 2.4, 3.6, 3, 's1', 0.8) + '<circle class="s2" cx="16" cy="18" r="11.4"/>';
    if (a >= 1) o += '<circle class="l1" cx="16" cy="18" r="' + r + '" stroke-width="3"/>';
    else if (a > 0) {
      var e = -Math.PI / 2 + a * 2 * Math.PI, x = c[0] + r * Math.cos(e), y = c[1] + r * Math.sin(e);
      o += path('M16,' + f(c[1] - r) + 'A' + r + ',' + r + ' 0 ' + (a > 0.5 ? 1 : 0) + ' 1 ' + f(x) + ',' + f(y), 'l1', ' stroke-width="3" stroke-linecap="round"');
    }
    if (running) {
      var h = -Math.PI / 2 + a * 2 * Math.PI;
      o += path('M16,18L' + f(16 + 6.4 * Math.cos(h)) + ',' + f(18 + 6.4 * Math.sin(h)), 'l1', ' stroke-width="2" stroke-linecap="round"') + '<circle class="s1" cx="16" cy="18" r="1.8"/>';
    }
    return wrap(o, 'timetrack');
  }
  /* Vorräte: a shelf of three boards (top to bottom: the first three storage places), 0–3 jars each = its stocked share in thirds */
  function pantry(jars) {
    var o = rect(3, 3, 1.6, 27.5, 's2') + rect(27.4, 3, 1.6, 27.5, 's2');
    [10.6, 19.6, 28.6].forEach(function (by, b) {
      for (var j = 0; j < Math.min(3, jars[b] || 0); j++) {
        var x = 6.4 + j * 6.8;
        o += rect(x, by - 5.6, 5.4, 5.6, 's2', 1.2) + rect(x + 0.6, by - 7, 4.2, 1.6, 's1', 0.5);
      }
      o += rect(3, by, 26, 1.9, 's1', 0.6);
    });
    return wrap(o, 'pantry');
  }
  /* Heute dran: a small house with four windows, one per room; a window is lit when that room's routines for today are done */
  function routines(lit) {
    var o = path('M3.5,14.5L16,4L28.5,14.5Z', 's1') + rect(6.5, 13.5, 19, 15.5, 's2', 1);
    [[9.2, 16.2], [17.8, 16.2], [9.2, 22.6], [17.8, 22.6]].forEach(function (w, i) { o += rect(w[0], w[1], 5, 4.6, lit[i] ? 'sw' : 's0', 0.8); });
    return wrap(o, 'routines');
  }
  /* Offene ToDos: the today card with up to three ticks = things done today (0, 1, 2, 3+); it never shows what is open */
  function todos(done) {
    var n = Math.min(3, done), o = rect(4, 4, 24, 24, 's2', 4), ys = [[], [16], [12.4, 20.2], [9.6, 16, 22.4]][n];
    ys.forEach(function (y) {
      o += path('M8.6,' + f(y) + 'l2.2,2.2l4,-4.2', 'l1', ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"');
      o += rect(17.6, y - 0.9, 6.6, 1.8, 's0', 0.9);
    });
    return wrap(o, 'todos');
  }
  /* Einkauf: a basket with no / a few (1–5) / many (6+) items */
  function lists(n) {
    var step = n <= 0 ? 0 : n <= 5 ? 1 : 2, o = path('M10,15.5Q16,3.5 22,15.5', 'l1', ' stroke-width="1.8" stroke-linecap="round"');
    if (step >= 1) o += '<circle class="s2" cx="12.6" cy="13.6" r="3.4"/>' + rect(16.6, 9.6, 4.6, 6.6, 's2', 1.4);
    if (step === 2) o += '<circle class="s2" cx="23.2" cy="13.4" r="3"/>' + path('M6.6,13.2L13.2,6.4l2,2L8.6,15.2Z', 's2') + '<circle class="s2" cx="18.2" cy="12.4" r="2.6"/>';
    o += path('M4.5,15H27.5L24.8,27.5H7.2Z', 's1') + path('M11.4,18.2V24.8M16,18.2V24.8M20.6,18.2V24.8', 'l0', ' stroke-width="1.4" stroke-linecap="round"');
    return wrap(o, 'lists');
  }
  /* Heute geschafft in "Ruhig" (no garden): a ring, the arc = k of n done today */
  function habits(k, n) {
    var a = n ? Math.min(1, k / n) : 0, r = 10.5, o = '<circle class="l2" cx="16" cy="16" r="' + r + '" stroke-width="4.2"/>';
    if (a >= 1) o += '<circle class="l1" cx="16" cy="16" r="' + r + '" stroke-width="4.2"/>';
    else if (a > 0) {
      var e = -Math.PI / 2 + a * 2 * Math.PI;
      o += path('M16,' + (16 - r) + 'A' + r + ',' + r + ' 0 ' + (a > 0.5 ? 1 : 0) + ' 1 ' + f(16 + r * Math.cos(e)) + ',' + f(16 + r * Math.sin(e)), 'l1', ' stroke-width="4.2" stroke-linecap="round"');
    }
    return wrap(o, 'habits');
  }
  window.Signs = { planner: planner, budgets: budgets, timetrack: timetrack, pantry: pantry, routines: routines, todos: todos, lists: lists, habits: habits };
})();
