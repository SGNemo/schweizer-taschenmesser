/* Living scenes – the app shell around the overview mock (sidebar, top bar, phone top and bottom bar) and the overview
   head ("Guten Morgen", date, "Jetzt wichtig", agenda) as in web/.screens/living-scenes/ist/overview-*.png. Unchanged by
   the design round. window.Shell = { page(content) → html, head() → html, params() → { tone, sky, bilder } } */
(function () {
  var I = window.Icons;
  function params() {
    var q = new URLSearchParams(location.search), bilder = q.get('bilder') || 'verspielt';
    var tone = bilder === 'aus' ? '0' : q.get('tone') || '6', sky = q.get('sky') || 'day';
    // only for the look: greeting and clock follow the evening/night sky; the seed's data (10:00) stays
    var when = sky === 'evening' ? ['Guten Abend', '19:40'] : sky === 'night' ? ['Guten Abend', '22:30'] : ['Guten Morgen', '10:00'];
    return { tone: tone, sky: sky, bilder: bilder, dark: q.get('dark'), greet: when[0], time: when[1] };
  }
  function side(time) {
    var g = function (n) { return '<div class="navGroup"><span class="eyebrow">' + n + '</span>' + I.icon('chevronRight', 16) + '</div>'; };
    return '<aside class="side"><div class="brand"><span class="logo"><i></i>NEMO</span><time>' + time + '</time></div>' +
      '<p class="eyebrow">Favoriten</p><div class="favs">' + I.icon('calendar', 18) + I.icon('checklist', 18) + I.icon('wallet', 18) + '</div>' +
      '<div class="navItem">' + I.icon('home', 18) + 'Übersicht</div>' + ['Planen', 'Geld', 'Haushalt', 'Wissen', 'Tresor', 'System'].map(g).join('') +
      '<div class="sideFoot"><span>' + I.icon('grid', 16) + 'Modul-Bibliothek</span><span>' + I.icon('settings', 16) + 'Einstellungen</span><span>' + I.icon('collapse', 16) + 'Einklappen</span></div></aside>';
  }
  function top() {
    return '<header class="top"><div class="search">' + I.icon('search', 16) + 'Suchen<kbd>Strg+K</kbd></div><span class="sp"></span><span class="dev">Dev</span>' +
      '<span class="btn">' + I.icon('plus', 16) + 'Neu</span><span class="btn quiet">' + I.icon('wrench', 18) + 'Werkzeuge</span><span class="bell">' + I.icon('bell', 20) + '<b>8</b></span></header>' +
      '<header class="phoneTop"><span class="logoSq"></span><div class="search">' + I.icon('search', 16) + 'Suchen</div><span class="tb">' + I.icon('wrench', 20) + '</span><span class="tb bell">' + I.icon('bell', 20) + '<b>8</b></span></header>';
  }
  function bottom() {
    return '<nav class="bottomBar"><span class="on">' + I.icon('home', 20) + 'Übersicht</span><span>' + I.icon('calendar', 20) + 'Planen</span><span class="new"><i>' + I.icon('plus', 20) + '</i>Neu</span>' +
      '<span>' + I.icon('wallet', 20) + 'Geld</span><span>' + I.icon('more', 20) + 'Mehr</span></nav>';
  }
  function head(greet) {
    var ag = function (t, s, rows) {
      return '<div class="agCol"><h3>' + t + '<small>' + s + '</small></h3>' + rows.map(function (r) { return '<div class="agRow"><time>' + r[0] + '</time><i' + (r[2] ? ' class="g"' : '') + '></i>' + r[1] + '</div>'; }).join('') + '</div>';
    };
    return '<div class="ovHead"><div><h1>' + (greet || 'Guten Morgen') + '</h1><p class="date">Dienstag, 29. September</p></div>' +
      '<div class="ovTools"><span class="btn quiet">' + I.icon('maximize', 16) + '<span class="cockpitLabel">Cockpit</span></span><span class="seg"><span>Ruhig</span><span class="on">Ausführlich</span></span><span class="btn square edit">' + I.icon('pencil', 16) + '</span></div></div>' +
      '<p class="eyebrow secLabel">Jetzt wichtig</p><div class="attn">' +
      '<div class="attnCard danger" data-hue="ocean"><span class="plate">' + I.icon('receipt', 18) + '</span><div><strong class="red">2</strong><span>Rechnungen überfällig</span><br><span class="meta">169,90 €</span></div></div>' +
      '<div class="attnCard danger" data-hue="lime"><span class="plate">' + I.icon('piggy', 18) + '</span><div><span class="t">Budget „Freizeit“ überschritten</span><br><span class="meta">35,11 € drüber</span></div></div>' +
      '<div class="attnCard" data-hue="moss"><span class="plate">' + I.icon('checklist', 18) + '</span><div><strong>2</strong><span>ToDos heute fällig</span></div></div>' +
      '<div class="attnCard wait">' + I.icon('chevronRight', 16) + '<div><span class="t">Kann warten · 9</span> <span class="meta">· 8 ToDos warten, 1 Vorrat abgelaufen … · nichts davon muss heute sein.</span></div></div></div>' +
      '<p class="eyebrow secLabel" style="margin-top:22px">Heute · Morgen · Diese Woche</p><div class="agenda">' +
      ag('Heute', 'Di., 29. Sep.', [['08:00', 'Medikament nehmen'], ['10:00', 'Teammeeting'], ['13:00', 'Friseur'], ['15:30', 'Zahnarzt Dr. Beispiel', 1], ['17:30', 'Paket abholen']]) +
      ag('Morgen', 'Mi., 30. Sep.', [['08:00', 'Medikament nehmen'], ['12:15', 'Anna zurückrufen'], ['18:00', 'Termin bestätigen']]) +
      ag('Diese Woche', 'Do. – Mo.', [['Do. 08:00', 'Medikament nehmen'], ['Do. 09:00', 'Zählerstand ablesen'], ['Do. 16:00', 'Steuerberatung'], ['Do. 18:00', 'Termin bestätigen']]) +
      '</div><a class="allLink" href="#">Alle Termine</a>';
  }
  function page(content, time) {
    return '<div class="app">' + side(time || '10:00') + '<div class="main">' + top() + '<main class="page" id="main">' + content + '</main></div></div>' + bottom();
  }
  window.Shell = { params: params, page: page, head: head };
})();
