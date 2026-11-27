/* Living scenes – card builders for the mockups (invented seed data, the texts of the app's seed).
   Needs icons.js, signs.js and, for pictures, ../../weather-scenes-2/mockups/palette.js + scene.js and world.js.
   window.Cards = {
     MODS                          module meta (title, icon, hue, area, grey mark) per card id
     sky(key, extra)               the shared sky: day | evening | night | rain (+ any weather-state fields)
     frame(id, o)                  one card: o = { size, body, sign, noMark, pic: {kind, form, …}, cls }
     <card builders>(v)            v = { bilder: 'aus' | 'ruhig' | 'verspielt', sky, … }: todayCard, planner, todos, habits, …
     overview(v)                   the overview's cards in the app's order
     paint(root)                   draws every picture slot (.pic, .skyPanel, .panel, .skyRow) at its measured size
   } */
(function () {
  var I = window.Icons, S = window.Signs;
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches, theme = dark ? 'dark' : 'light';
  var MODS = {
    today: ['Heute', 'checklist', 'moss', 'plan', 'todayCard'], planner: ['Wochenlast', 'chartGantt', 'indigo', 'plan', 'weekBars'],
    todos: ['Offene ToDos', 'checklist', 'moss', 'plan', 'todayCard'], habits: ['Heute geschafft', 'target', 'violet', 'plan', 'ring'],
    balance: ['Kontostand', 'wallet', 'teal', 'money', 'bankCard'], month: ['Diesen Monat', 'wallet', 'teal', 'money', 'bankCard'],
    timetrack: ['Zeiterfassung', 'clock', 'teal', 'plan', 'stopwatch'], weather: ['Wetter heute', 'cloudSun', 'cobalt', 'plan', 'sky'],
    clock: ['Uhrzeit anderswo', 'globe', 'lime', 'plan', 'dial'], bookmarks: ['Merkliste', 'bookmark', 'indigo', 'knowledge', 'pinboard'],
    invoices: ['Fällige Rechnungen', 'receipt', 'ocean', 'money', 'bill'], subs: ['Nächste Abbuchungen', 'repeat', 'indigo', 'money', 'cycle'],
    lists: ['Einkauf', 'cart', 'orchid', 'household', 'receipt'], packing: ['Packlisten', 'cart', 'orchid', 'household', 'receipt'],
    routines: ['Heute dran', 'repeat', 'cobalt', 'household', 'cycle'], pantry: ['Vorräte', 'package', 'fern', 'household', 'shelf'],
    budgets: ['Budgets & Sparziele', 'piggy', 'lime', 'money', 'envelope'], vault: ['Passwort-Tresor', 'lock', 'slate', 'vault', 'vaultDoor'],
    music: ['Musik', 'music', 'orchid', 'knowledge', 'coverTone'],
  };
  /* ---- the shared sky (the weather card's state): an invented Bern-like place, late September ---- */
  var SKIES = {
    day: { phase: 'day', cond: 'partly', temp: '14°', word: 'leicht bewölkt', rain: 'ab 15 Uhr Regen' },
    evening: { phase: 'dusk', cond: 'clear', temp: '11°', word: 'klar', rain: 'Kein Regen in Sicht' },
    night: { phase: 'night', cond: 'clear', temp: '8°', word: 'klar', rain: 'Kein Regen in Sicht' },
    rain: { phase: 'day', cond: 'rain', intensity: 2, temp: '12°', word: 'Regen', rain: '' },
  };
  function sky(key, extra) {
    var b = SKIES[key] || SKIES.day, s = { theme: theme, season: 'autumn', moon: { illum: 0.62, waxing: true } }, k;
    for (k in b) s[k] = b[k];
    for (k in extra || {}) s[k] = extra[k];
    return s;
  }
  /* the sky of a clock tile for a local hour: 21–6 night, 6–7 dawn, 7–18 day, 18–20 golden, 20–21 dusk */
  function hourSky(h, moon) {
    var phase = h >= 21 || h < 6 ? 'night' : h < 7 ? 'dawn' : h < 18 ? 'day' : h < 20 ? 'golden' : 'dusk';
    var body = phase === 'night' ? { kind: 'moon', t: (((h - 21) % 24) + 24) % 24 / 9 } : { kind: 'sun', t: (h - 6) / 15 };
    return { theme: theme, phase: phase, body: body, moon: moon || { illum: 0.62, waxing: true } };
  }

  /* ---- picture slots: filled by paint() at their measured size ---- */
  var PICS = [];
  function slot(cls, pic) { PICS.push(pic); return '<div class="' + cls + '" data-pic="' + (PICS.length - 1) + '" aria-hidden="true"></div>'; }
  /* a spot's view widened to the slot's aspect: the right/bottom edge stays, more sky above or more land to the left */
  function fitView(v, w, h) {
    var ar = w / h, x = v[0], y = v[1], vw = v[2], vh = v[3];
    if (ar < vw / vh) { var nh = vw / ar; y = y + vh - nh; vh = nh; if (y < 0) { vh += y; y = 0; var nw = vh * ar; x = x + vw - nw; vw = nw; } }
    else { var nw2 = vh * ar; x = x + vw - nw2; vw = nw2; }
    return [Math.round(x), Math.round(y), Math.round(vw), Math.round(vh)];
  }
  var NOFIT = /[?&]fit=0/.test(location.search);
  function draw(p, w, h) {
    if (p.kind === 'garden') {
      var o = { form: p.form };
      if (!NOFIT) o.view = fitView(window.Living.SPOTS.garden.views[p.form], w, h);
      return window.Living.scene('garden', p.sky, p.data, o);
    }
    if (p.kind === 'tile') return window.Living.tile(p.sky, { view: [1150, 30, Math.round(128 * w / h), 128] });
    if (p.kind === 'weather') { // the overview card's crop (product: cardFit, k = 0.46, right/bottom aligned)
      var k = 0.46, vw = w / k, vh = h / k, x0 = 1600 - vw, y0 = 320 - vh;
      return window.Scene.svg(p.sky, { view: [Math.round(x0), Math.round(y0), Math.round(vw), Math.round(vh)], quietX: Math.round(x0 + 0.55 * vw + 80),
        bodyAt: [Math.round(x0 + 0.8 * vw), Math.round(Math.max(y0 + 30, Math.min(y0 + 0.5 * vh, 110)))], idp: 'w' + Math.random().toString(36).slice(2, 6) });
    }
    return '';
  }
  function paint(root) {
    (root || document).querySelectorAll('[data-pic]').forEach(function (el) {
      var p = PICS[+el.getAttribute('data-pic')], w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      var svg = draw(p, w, h);
      el.innerHTML = svg;
      el.setAttribute('data-els', window.Scene.count(svg));
      el.setAttribute('data-kb', (svg.length / 1024).toFixed(1));
    });
  }

  /* ---- the frame (Home.tsx: icon plate, title link with chevron, signature mark / sign at the end) ---- */
  function frame(id, o) {
    var m = MODS[id], end = o.noMark ? '' : o.sign ? o.sign : '<span class="mark">' + I.mark(m[4], 22) + '</span>';
    var pic = o.pic ? slot('pic', o.pic) : '';
    var cls = 'card ' + (o.size || 's') + (o.pic && o.pic.form ? ' ' + o.pic.form : '') + (o.cls ? ' ' + o.cls : '');
    return '<section class="' + cls + '" data-card="' + id + '" data-hue="' + m[2] + '" data-area="' + m[3] + '"' + (o.attrs || '') + '>' +
      (o.picFirst ? pic : '') +
      '<div class="head"><span class="plate">' + I.icon(m[1], 16) + '</span><a class="title" href="#">' + m[0] + I.icon('chevronRight', 16) + '</a>' + end + '</div>' +
      '<div class="body">' + o.body + '</div>' + (o.picFirst ? '' : pic) + '</section>';
  }
  function signs(v) { return v.bilder && v.bilder !== 'aus'; }
  function check(t, d) { return '<div class="checkRow"><span class="box"></span><span class="rowTitle">' + t + '</span>' + (d ? '<span class="rowAmount">' + d + '</span>' : '') + '</div>'; }
  function ring(pct, small) {
    var r = 34, c = 2 * Math.PI * r;
    return '<span class="ring"' + (small ? ' style="width:3rem;height:3rem"' : '') + '><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-2)" stroke-width="8"/>' +
      '<circle cx="40" cy="40" r="34" fill="none" stroke="var(--module-color)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * pct / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 40 40)"/></svg>' +
      '<b' + (small ? ' style="font-size:var(--text-xs)"' : '') + '>' + Math.round(pct) + ' %</b></span>';
  }

  /* ---- the cards ---- */
  function todayCard() {
    return frame('today', { size: 'l', body: '<div class="todayTask"><p><b>in 3 Std</b> <span class="muted">· 13:00 Friseur</span></p><h4>Recherche 13</h4><p class="sub">Arbeit</p>' +
      '<div class="todayAct"><span class="btn filled">Anfangen · 25 Min</span><span class="btn quiet">Später</span><span class="btn square">' + I.icon('more', 16) + '</span></div>' +
      '<p class="sub" style="margin-top:22px">Noch Platz für 3. <span class="link">Aus den offenen wählen</span></p></div>' });
  }
  var LOAD = [0.55, 1, 1, 1, 0.9, 0.15, 0]; // Mo–So, today = Di
  function planner(v) {
    var rows = [['Heute · voll', '43 Min mehr als planbar'], ['Mi · voll', '4 Min mehr als planbar'], ['Do · voll', '13 Min mehr als planbar'], ['Fr · frei', '40 Min mehr als planbar']];
    return frame('planner', { size: 'm', sign: signs(v) ? S.planner(LOAD, 1) : null, body: '<p class="summary">Bis Fr: 4 h 40 geplant · 0 Min frei</p>' +
      rows.map(function (r) { return '<div class="prog"><div class="ph"><span class="rowTitle">' + r[0] + '</span><span class="rowAmount">' + r[1] + '</span></div><div class="bar"><i style="width:100%"></i></div></div>'; }).join('') });
  }
  function todos(v) {
    var rows = [['Recherche 16', 'Mo., 21. Sep.'], ['Bücher aussortieren 18', 'Mo., 21. Sep.'], ['Formular ausfüllen 8', 'Mo., 21. Sep.'], ['Termin vereinbaren 9', 'Mi., 23. Sep.'], ['Vorräte prüfen 2', 'Do., 24. Sep.']];
    return frame('todos', { size: 'm', sign: signs(v) ? S.todos(v.todosDone == null ? 2 : v.todosDone) : null,
      body: '<p class="summary">43 offen · 8 warten</p>' + rows.map(function (r) { return check(r[0], r[1]); }).join('') });
  }
  /* habits: goals = [{ name, pct, detail, state, doneDays, count }]; form 'wide' | 'strip'; v.bilder */
  var SEED_GOALS = [
    { name: 'Wasser trinken', pct: 38, detail: '3 von 8 Gläser', state: 'part', doneDays: 24, count: true },
    { name: 'Spazieren gehen', pct: 100, detail: 'Geschafft', state: 'done', doneDays: 41 },
    { name: 'Dehnen', pct: 0, detail: '', state: 'open', doneDays: 6 },
    { name: 'Medikament nehmen', pct: 0, detail: '', state: 'open', doneDays: 2 },
  ];
  function habits(v, o) {
    o = o || {};
    var goals = o.goals || SEED_GOALS, small = o.size === 's', shown = goals.slice(0, small ? 2 : o.size === 'l' ? 6 : 4);
    var done = goals.filter(function (g) { return g.state === 'done'; }).length;
    var next = goals.filter(function (g) { return g.state === 'open' || g.state === 'part'; })[0];
    var body = !goals.length ? '<p class="muted">Noch keine Gewohnheiten.</p><p style="margin-top:8px"><span class="link">Gewohnheit eintragen</span></p>'
      : '<p class="summary">' + done + ' von ' + goals.length + ' geschafft</p><ul class="rings">' + shown.map(function (g) {
        return '<li class="ringItem">' + ring(g.pct, small) + '<span class="ringName">' + g.name + '</span><span class="sub">' + (g.detail || '') + '</span></li>';
      }).join('') + '</ul>' + (next ? '<p style="margin-top:8px"><span class="btn small">' + (next.count ? '+1 ' + next.name : next.name + ': Erledigt') + '</span></p>' : '');
    var verspielt = v.bilder === 'verspielt', form = o.form || 'wide';
    var data = { goals: goals.map(function (g) { return { state: g.state, doneDays: g.doneDays }; }), allDone: o.allDone != null ? o.allDone : !!goals.length && done === goals.length };
    return frame('habits', { size: o.size || 'm', body: body, cls: o.cls,
      noMark: verspielt, sign: v.bilder === 'ruhig' ? S.habits(done, goals.length) : null,
      pic: verspielt ? { kind: 'garden', form: form, sky: v.sky, data: data } : null });
  }
  /* finance: state = 'leer' | 'wenig' | 'normal' | 'viel' | 'besonders' (masked) */
  var FIN = {
    wenig: { bal: '842,10 €', balSub: 'Vermögen, davon 842,10 € verfügbar · 1 Konto', free: '318,40 €', monthSub: 'Noch fällig 0,00 € · Ausgegeben 523,70 €', n: 1 },
    normal: { bal: '12.616,33 €', balSub: 'Vermögen, davon 11.598,49 € verfügbar · 3 Konten', free: '12.446,43 €', monthSub: 'Noch fällig 169,90 € · Ausgegeben 1.618,76 €', n: 3 },
    viel: { bal: '1.284.906,57 €', balSub: 'Vermögen, davon 1.103.250,08 € verfügbar · 11 Konten', free: '−12.446,43 €', monthSub: 'Noch fällig 24.169,90 € · Ausgegeben 31.618,76 €', n: 11 },
  };
  function mask(note) { return '<span class="mask">' + I.icon('eyeOff', 16) + '<span>••••</span><small>Zum Einblenden tippen</small></span>' + (note ? '<p class="sub" style="margin-top:4px">' + note + '</p>' : ''); }
  function balance(v, state) {
    state = state || 'normal';
    var d = FIN[state === 'besonders' ? 'normal' : state], empty = '<p class="muted">Noch keine Konten.</p><p style="margin-top:8px"><span class="link">Finanzen</span></p>';
    var body = state === 'leer' ? empty : state === 'besonders' ? mask('Vermögen · 3 Konten')
      : '<div class="kpi"><span class="kpiValue">' + d.bal + '</span><span class="sub">' + d.balSub + '</span></div>';
    return frame('balance', { size: 's', body: body });
  }
  function month(v, state) {
    state = state || 'normal';
    var d = FIN[state === 'besonders' ? 'normal' : state], empty = '<p class="muted">Noch keine Konten.</p><p style="margin-top:8px"><span class="link">Finanzen</span></p>';
    var body = state === 'leer' ? empty : '<div class="kpi"><span class="kpiLabel">Frei bis Monatsende</span>' + (state === 'besonders' ? mask() : '<span class="kpiValue">' + d.free + '</span><span class="sub">' + d.monthSub + '</span>') + '</div>';
    return frame('month', { size: 's', body: body });
  }
  function timetrack(v) {
    return frame('timetrack', { size: 'm', sign: signs(v) ? S.timetrack(120, false) : null,
      body: '<div class="kpi"><span class="kpiValue">2:00</span><span class="sub">heute · nichts läuft</span><span class="btn small">Website Relaunch starten</span></div>' });
  }
  function weather(v) {
    var s = v.sky, ink = window.Scene.ink(s);
    return frame('weather', { size: 's', cls: 'weather', picFirst: true, attrs: ' data-ink="' + ink + '"', pic: { kind: 'weather', sky: s },
      body: '<p class="wPlace">Bern</p><p class="kpiValue">' + s.temp + '</p><p class="wWord"><span>' + s.word + '</span>' + (s.rain ? '<span class="wRain">' + s.rain + '</span>' : '') + '</p>' });
  }
  /* clock: places = [{ time, name, line, h }]; tiles with a sky panel from "Ruhig" on */
  var SEED_PLACES = [{ time: '19:00', name: 'Büro Tokio', line: 'Tag · +9 h', h: 19 }, { time: '06:00', name: 'Tante Ines', line: 'Tag · −4 h', h: 6 },
    { time: '20:00', name: 'Sydney', line: 'Tag · +10 h', h: 20 }, { time: '11:00', name: 'Lissabon', line: 'Tag · +1 h', h: 11 }];
  function tile(p, v, moon) {
    var skyOn = signs(v);
    return '<li class="kachel' + (skyOn ? ' sky' : '') + '"><span class="kVal">' + p.time + '</span><span class="kLab">' + p.name + '</span><span class="kSt">' + p.line + '</span>' +
      (skyOn ? slot('skyPanel', { kind: 'tile', sky: hourSky(p.h, moon) }) : '') + '</li>';
  }
  function clock(v, o) {
    o = o || {};
    var places = o.places || SEED_PLACES, size = o.size || 'm', shown = places.slice(0, size === 's' ? 2 : size === 'm' ? 4 : 6);
    var body = !places.length ? '<p class="muted">Noch keine Orte.</p><p style="margin-top:8px"><span class="link">Ort eintragen</span></p>'
      : '<ul class="kacheln">' + shown.map(function (p) { return tile(p, v, o.moon); }).join('') + '</ul>';
    return frame('clock', { size: size, body: body, cls: o.cls });
  }
  function bookmarks() {
    var rows = [['Dokumentation über Alpenseen', 'Film/Serie'], ['Dokumentation über Alpenseen (2)', 'Film/Serie'], ['Artikel über Schlafhygiene (2)', 'Lesen']];
    return frame('bookmarks', { size: 's', body: '<p class="sub" style="margin-bottom:8px">Als Nächstes · such dir eins aus</p><ul class="rows">' +
      rows.map(function (r) { return '<li class="row"><span class="rowTitle">' + r[0] + '</span><span class="rowAmount">' + r[1] + '</span></li>'; }).join('') + '</ul>' });
  }
  function invoices() {
    var rows = [['Stadtwerke Musterstadt', '87,40 €', 'war am 17. Sep. fällig', 'overdue'], ['Zahnarztpraxis Dr. Beispiel', '82,50 €', 'war am Sa. fällig', 'overdue'],
      ['Internet & Telefon Küstennetz', '39,99 €', 'in 2 Tagen', 'soon'], ['Stadtwerke Musterstadt', '85,95 €', 'in 2 Tagen', 'soon'], ['Kfz-Versicherung Nordstern', '418,00 €', 'Mo., 5. Okt.', 'later']];
    return frame('invoices', { size: 'm', body: '<p class="summary">1.017,84 € offen · 2 überfällig</p>' + rows.map(function (r) {
      return '<div class="due" data-tone="' + r[3] + '"><span class="rowTitle">' + r[0] + '</span><span class="rowAmount">' + r[1] + '</span><span class="state' + (r[3] === 'overdue' ? ' overdue' : '') + '">' +
        (r[3] === 'overdue' ? I.icon('alert', 14) : '') + r[2] + '</span><span class="okBtn">' + I.icon('check', 16) + '</span></div>';
    }).join('') + '<p class="sub">+ 2 weitere</p>' });
  }
  function subs() {
    var rows = [['Streaming Plus', '12,99 €', 'Sa., 3. Okt.'], ['Musik Flat', '10,99 €', 'Mi., 14. Okt.'], ['Handyvertrag Küstenmobil', '19,90 €', 'Sa., 17. Okt.'], ['Cloud-Speicher 200 GB', '2,99 €', 'Mi., 21. Okt.'], ['Fitnessstudio Aktiv', '29,90 €', 'Mo., 26. Okt.']];
    return frame('subs', { size: 'm', body: '<p class="summary">100,82 € pro Monat · nächste: Streaming Plus, 3. Okt.</p><ul class="rows" style="gap:12px">' + rows.map(function (r) {
      return '<li class="row"><span class="rowTitle muted">' + r[0] + '</span><span class="rowAmount">' + r[1] + '&nbsp; ' + r[2] + '</span></li>'; }).join('') + '</ul><p class="sub" style="margin-top:4px">+ 3 weitere</p>' });
  }
  function lists(v) {
    return frame('lists', { size: 's', sign: signs(v) ? S.lists(10) : null, body: '<p class="summary">10 Artikel offen</p>' + check('Milch (2)') + check('Brot') + check('Eier') });
  }
  function packing() {
    var r = function (n) { return '<div class="prog"><div class="ph"><span class="rowTitle">' + n + '</span><span class="rowAmount">2/6</span></div><div class="bar"><i style="width:33%"></i></div></div>'; };
    return frame('packing', { size: 's', body: '<p class="summary">4 von 12 gepackt</p>' + r('Wochenendtrip') + r('Camping') });
  }
  function routines(v) {
    return frame('routines', { size: 's', sign: signs(v) ? S.routines([false, true, false, false]) : null,
      body: '<p class="summary">3 dran · 12 Routinen</p>' + check('Bad putzen · Mia') + check('Müll rausbringen · Ben') + check('Staubsaugen · Mia') });
  }
  function pantry(v) {
    var t = [['5', 'Kühlschrank', '1 abgelaufen', 1], ['2', 'Tiefkühler', '1 knapp'], ['6', 'Vorratsschrank', '1 bald', 1], ['1', 'Sonstiges', 'Alles im Plan']];
    return frame('pantry', { size: 's', sign: signs(v) ? S.pantry([2, 1, 3]) : null, body: '<ul class="kacheln">' + t.map(function (k) {
      return '<li class="kachel"><span class="kVal" style="font-size:var(--text-lg)">' + k[0] + '</span><span class="kLab">' + k[1] + '</span><span class="kSt' + (k[3] ? ' warn' : '') + '">' + k[2] + '</span></li>'; }).join('') +
      '</ul><p class="sub" style="margin-top:12px">1 abgelaufen · 3 bald · 6 wenig</p><p style="font-size:var(--text-sm);margin-top:6px">Joghurt natur · MHD war Mo.<br>Frischkäse · Morgen</p>' });
  }
  function budgets(v) {
    var r = function (n, pct, end, red) { return '<div class="prog"><div class="ph"><span class="rowTitle">' + n + '</span>' + end + '</div><div class="bar' + (red ? ' red' : '') + '"><i style="width:' + pct + '%"></i></div></div>'; };
    return frame('budgets', { size: 'm', sign: signs(v) ? S.budgets(0.82) : null, body: '<p class="summary">1 Budget überschritten</p>' +
      r('Freizeit', 100, '<span class="over">' + I.icon('alert', 14) + '35,11 € drüber</span>', true) + r('Wohnen', 96, '<span class="rowAmount">96 %</span>') +
      r('Urlaub Italien', 63, '<span class="rowAmount">63 %</span>') + r('Neues Fahrrad', 78, '<span class="rowAmount">78 %</span>') +
      '<div class="spark"><svg width="96" height="28" viewBox="0 0 96 28" aria-hidden="true"><path d="M2,26H20L38,4L56,8H76L94,6" fill="none" stroke="var(--module-color)" stroke-width="1.6"/></svg>Ausgaben mit Limit, letzte 6 Monate</div><p><span class="btn small">Ausgabe +</span></p>' });
  }
  function vault() { return frame('vault', { size: 's', body: '<p style="display:flex;gap:8px;align-items:center;font-weight:600">' + I.icon('lock', 18) + 'Gesperrt</p><p style="margin-top:4px"><span class="link">Entsperren</span></p>' }); }
  function music() { return frame('music', { size: 's', body: '<p class="sub">Spotify ist nicht verbunden. &nbsp;<span class="link">Spotify verbinden</span></p>' }); }

  function overview(v) {
    return [todayCard(v), planner(v), todos(v), habits(v), balance(v), month(v), timetrack(v), weather(v), clock(v), bookmarks(v), invoices(v), subs(v),
      lists(v), packing(v), routines(v), pantry(v), budgets(v), vault(v), music(v)].join('');
  }
  window.Cards = { MODS: MODS, sky: sky, hourSky: hourSky, frame: frame, ring: ring, fitView: fitView, paint: paint, slot: slot, theme: theme, SEED_GOALS: SEED_GOALS, SEED_PLACES: SEED_PLACES,
    todayCard: todayCard, planner: planner, todos: todos, habits: habits, balance: balance, month: month, timetrack: timetrack, weather: weather, clock: clock,
    bookmarks: bookmarks, invoices: invoices, subs: subs, lists: lists, packing: packing, routines: routines, pantry: pantry, budgets: budgets, vault: vault, music: music, overview: overview };
})();
