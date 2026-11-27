/* Living scenes – step 1 "signs": 32 px flat shapes at the end of a card head that read the card's data.
   Data is always drawn in the MAIN tone (the module hue: .s1 fill, .l1 stroke); what is not there is the card surface
   (.s0 / .l0) or a 1.5 px outline in the main tone (.o1). No second fill tone carries data. aria-hidden: numbers stay text.
   window.Signs = { planner, budgets, timetrack, pantry, routines, todos, lists, habits } → '<span class="sign">…</span>' */
(function () {
  var uid = 0;
  function f(n) { return Math.round(n * 100) / 100; }
  function wrap(inner, name) {
    return '<span class="sign" data-sign="' + name + '" aria-hidden="true"><svg viewBox="0 0 32 32" width="32" height="32" focusable="false">' + inner + '</svg></span>';
  }
  function rect(x, y, w, h, cls, rx, extra) { return '<rect class="' + cls + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (rx ? ' rx="' + rx + '"' : '') + (extra || '') + '/>'; }
  function path(d, cls, extra) { return '<path class="' + cls + '" d="' + d + '"' + (extra || '') + '/>'; }

  /* Wochenlast: seven bars Mo–So in the main tone, height = the day's load 0..1; today marked by a dot under its bar (never red).
     A day without load keeps a 1.5 px outline stub so the week still reads as seven. */
  function planner(loads, today) {
    var o = '';
    loads.forEach(function (v, i) {
      var x = 2.4 + i * 3.95, h = Math.min(1, v) * 21;
      o += h >= 1.5 ? rect(x, 25 - h, 3, h, 's1', 0.8) : rect(x + 0.75, 22.75, 1.5, 1.5, 'o1', 0.3);
    });
    o += '<circle class="s1" cx="' + f(3.9 + today * 3.95) + '" cy="29.2" r="1.7"/>';
    return wrap(o, 'planner');
  }
  /* Budgets: an envelope (1.5 px outline) filled in the main tone up to the spent share of the month's budgets (capped at full) */
  function budgets(share) {
    var s = Math.max(0, Math.min(1, share)), top = 8, h = 17, y = top + h * (1 - s), id = 'sgb' + ++uid;
    var o = '<clipPath id="' + id + '"><rect x="4" y="' + f(y) + '" width="24" height="' + f(top + h - y) + '"/></clipPath>';
    o += rect(4.75, 8.75, 22.5, 15.5, 'o1', 2) + path('M5.5,9.6L16,17.6L26.5,9.6', 'o1', ' stroke-linecap="round" stroke-linejoin="round"');
    if (s > 0) o += '<g clip-path="url(#' + id + ')">' + rect(4, 8, 24, 17, 's1', 2.5) + path('M5.5,9.6L16,17.6L26.5,9.6', 'l0', ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"') + '</g>';
    return wrap(o, 'budgets');
  }
  /* Zeiterfassung: a round dial (outline), the arc in the main tone = minutes today / 8 h, a hand only while a timer runs */
  function timetrack(min, running) {
    var c = [16, 18], r = 8.6, a = Math.min(1, min / 480), o = rect(14.2, 2.4, 3.6, 3, 's1', 0.8) + '<circle class="o1" cx="16" cy="18" r="11.2"/>';
    if (a >= 1) o += '<circle class="l1" cx="16" cy="18" r="' + r + '" stroke-width="3.4"/>';
    else if (a > 0) {
      var e = -Math.PI / 2 + a * 2 * Math.PI;
      o += path('M16,' + f(c[1] - r) + 'A' + r + ',' + r + ' 0 ' + (a > 0.5 ? 1 : 0) + ' 1 ' + f(c[0] + r * Math.cos(e)) + ',' + f(c[1] + r * Math.sin(e)), 'l1', ' stroke-width="3.4" stroke-linecap="round"');
    }
    if (running) {
      var hd = -Math.PI / 2 + a * 2 * Math.PI;
      o += path('M16,18L' + f(16 + 6 * Math.cos(hd)) + ',' + f(18 + 6 * Math.sin(hd)), 'l1', ' stroke-width="2" stroke-linecap="round"') + '<circle class="s1" cx="16" cy="18" r="1.8"/>';
    }
    return wrap(o, 'timetrack');
  }
  /* Vorräte: a shelf of three boards (top to bottom: the first three storage places), 0–3 jars each in the main tone = its
     stocked share in thirds; a board without a jar is drawn as an outline */
  function pantry(jars) {
    var o = path('M3.75,3V30.5M28.25,3V30.5', 'o1', ' stroke-linecap="round"');
    [10.6, 19.6, 28.6].forEach(function (by, b) {
      var n = Math.min(3, jars[b] || 0);
      for (var j = 0; j < n; j++) { var x = 6.6 + j * 6.6; o += rect(x, by - 5.4, 5, 5.4, 's1', 1.1) + rect(x + 0.9, by - 7, 3.2, 1.2, 's1', 0.4); }
      o += n ? rect(3, by, 26, 1.9, 's1', 0.6) : rect(3.75, by + 0.2, 24.5, 1.5, 'o1', 0.6);
    });
    return wrap(o, 'pantry');
  }
  /* Heute dran: a small house (outline, roof in the main tone) with four windows, one per room; a window is lit (main tone)
     when that room's routines for today are done, otherwise an outline */
  function routines(lit) {
    var o = path('M3,14.5L16,3.6L29,14.5Z', 's1') + rect(5.75, 14.25, 20.5, 14.5, 'o1', 1);
    [[8.2, 16.4], [17.4, 16.4], [8.2, 22.4], [17.4, 22.4]].forEach(function (w, i) { o += lit[i] ? rect(w[0], w[1], 6.4, 4.6, 's1', 0.8) : rect(w[0] + 0.75, w[1] + 0.75, 4.9, 3.1, 'o1', 0.5); });
    return wrap(o, 'routines');
  }
  /* Offene ToDos: the today card (outline) with up to three ticks in the main tone = things done today (0, 1, 2, 3+); it never shows what is open */
  function todos(done) {
    var n = Math.min(3, done), o = rect(4.75, 4.75, 22.5, 22.5, 'o1', 4), ys = [[], [16.4], [12.6, 20.4], [9.8, 16.2, 22.6]][n];
    ys.forEach(function (y) { o += path('M9.6,' + f(y) + 'l2.6,2.6l5.4,-5.6', 'l1', ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'); });
    return wrap(o, 'todos');
  }
  /* Einkauf: a basket with no / a few (1–5) / many (6+) items; items in the main tone, kept apart by a line of the card surface */
  function lists(n) {
    var step = n <= 0 ? 0 : n <= 5 ? 1 : 2, sep = ' stroke-width="1.2"', o = path('M10,15.5Q16,3.5 22,15.5', 'o1', ' stroke-linecap="round"');
    var items = '';
    if (step >= 1) items += '<circle cx="12.4" cy="13.4" r="3.4"/>' + rect(16.4, 9.4, 4.8, 7, '', 1.4);
    if (step === 2) items += '<circle cx="23.4" cy="13.2" r="3"/>' + path('M6.2,13.2L12.8,6.4l2.1,2.1L8.3,15.3Z', '') + '<circle cx="19" cy="8.6" r="2.4"/>';
    if (items) o += '<g class="s1" style="stroke:var(--card-bg, var(--surface-raised))"' + sep + '>' + items + '</g>';
    o += path('M4.5,15H27.5L24.8,27.5H7.2Z', 's1') + path('M11.4,18.2V24.8M16,18.2V24.8M20.6,18.2V24.8', 'l0', ' stroke-width="1.4" stroke-linecap="round"');
    return wrap(o, 'lists');
  }
  /* Heute geschafft in "Ruhig" (no garden): a ring, the track a 1.5 px outline, the arc in the main tone = k of n done today */
  function habits(k, n) {
    var a = n ? Math.min(1, k / n) : 0, r = 10.5, o = '<circle class="o1" cx="16" cy="16" r="' + r + '"/>';
    if (a >= 1) o += '<circle class="l1" cx="16" cy="16" r="' + r + '" stroke-width="4.4"/>';
    else if (a > 0) {
      var e = -Math.PI / 2 + a * 2 * Math.PI;
      o += path('M16,' + (16 - r) + 'A' + r + ',' + r + ' 0 ' + (a > 0.5 ? 1 : 0) + ' 1 ' + f(16 + r * Math.cos(e)) + ',' + f(16 + r * Math.sin(e)), 'l1', ' stroke-width="4.4" stroke-linecap="round"');
    }
    return wrap(o, 'habits');
  }
  window.Signs = { planner: planner, budgets: budgets, timetrack: timetrack, pantry: pantry, routines: routines, todos: todos, lists: lists, habits: habits };
})();
