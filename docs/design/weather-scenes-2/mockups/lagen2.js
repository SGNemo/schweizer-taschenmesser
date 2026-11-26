/* The list of weather × level for p3-01 (day) and p3-02 (night). Lagen2.list(phase) → [{ label, state }]. */
(function () {
  function list(phase) {
    var night = phase === 'night', W = { season: 'winter' };
    function s(o, extra) { return Object.assign({ phase: phase }, o, extra || {}); }
    var L = [
      ['klar', s({ cond: 'clear' })],
      ['überwiegend klar', s({ cond: 'mostlyClear', cover: 1 })],
      ['leicht bewölkt', s({ cond: 'partly', cover: 2 })],
      ['bewölkt', s({ cond: 'partly', cover: 3 })],
      ['bedeckt', s({ cond: 'overcast', cover: 4 }), night ? 'der Mond zwischen den Wolkenbänken' : 'die Sonne zwischen den Wolkenbänken'],
      ['dünne hohe Wolken', s({ cond: 'clear', veil: true })],
      ['Nieselregen', s({ cond: 'drizzle' })],
      ['Regen 1', s({ cond: 'rain', intensity: 1 })], ['Regen 2', s({ cond: 'rain', intensity: 2 })], ['Regen 3', s({ cond: 'rain', intensity: 3 })],
      ['gefrierender Regen', s({ cond: 'freezingRain', season: 'winter' })],
      ['Schauer', s({ cond: 'showers' })],
      ['Schneefall 1', s({ cond: 'snow', intensity: 1, snowCover: 2 }, W)], ['Schneefall 2', s({ cond: 'snow', intensity: 2, snowCover: 2 }, W)], ['Schneefall 3', s({ cond: 'snow', intensity: 3, snowCover: 2 }, W)],
      ['Schneeschauer', s({ cond: 'snowShowers', snowCover: 1 }, W)],
      ['Gewitter 1', s({ cond: 'thunder', thunder: 1 })], ['Gewitter 2', s({ cond: 'thunder', thunder: 2 })], ['Gewitter 3', s({ cond: 'thunder', thunder: 3, intensity: 3 })],
      ['Gewitter mit Hagel', s({ cond: 'thunderHail', thunder: 3, intensity: 3 })],
      ['Nebel 1', s({ cond: 'fog', fog: 1 })], ['Nebel 2', s({ cond: 'fog', fog: 2 })],
      ['Frost 1', s({ cond: 'clear', frost: 1 }, W)], ['Frost 2', s({ cond: 'clear', frost: 2 }, W)],
      ['Schneedecke 1', s({ cond: 'clear', snowCover: 1 }, W)], ['Schneedecke 2', s({ cond: 'clear', snowCover: 2 }, W)], ['Schneedecke 3', s({ cond: 'clear', snowCover: 3 }, W)],
    ];
    if (!night) {
      L.push(['Hitze', s({ cond: 'clear', heat: true })]);
      [[3, 0], [2, 2], [1, 3], [0, 4]].forEach(function (p) { L.push(['wie sonnig ' + p[0], s({ cond: 'clear', cover: p[1] }), 'Sonnenstufe ' + p[0] + ' über Bewölkung ' + p[1]]); });
    } else {
      L.push(['Vollmond klar', s({ cond: 'clear', moon: { illum: 1 } })]);
      L.push(['Neumond klar', s({ cond: 'clear', moon: { illum: 0 } })]);
    }
    return L.map(function (x) { return { label: x[0], note: x[2], state: x[1] }; });
  }
  function cloudRow(phase) { // "wie bewölkt": no cloud when clear, then few to many (clear summer day / night)
    return [0, 1, 2, 3, 4].map(function (c) { return { label: 'wie bewölkt ' + c, note: ['keine Wolke', 'wenige', 'einige', 'viele', 'bedeckt'][c], state: { phase: phase, cond: c === 4 ? 'overcast' : 'clear', cover: c, season: 'summer' } }; });
  }
  window.Lagen2 = { list: list, cloudRow: cloudRow };
})();
