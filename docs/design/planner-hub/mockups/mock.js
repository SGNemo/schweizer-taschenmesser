// Mockup helper (planner hub, chat E; nothing here ships). Reads ?theme=light|dark (else the system scheme) and
// ?state=empty|over|late|many, fills the shared shell and offers the sample data plus ONE row renderer, so every
// direction draws a thing the same way. Sample scene: Sunday 2026-11-15; all names are made up.
(() => {
  const q = new URLSearchParams(location.search);
  const h = document.documentElement;
  h.dataset.theme = q.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const phone = matchMedia('(max-width: 899px)').matches;
  const state = q.get('state') || 'week';
  const svg = (d, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const P = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    todo: '<path d="M10 6h11M10 12h11M10 18h11M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    plan: '<path d="M4 4v16h16M8 8h7M8 12h10M8 16h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    rain: '<path d="M7 17a4 4 0 0 1-.5-8A6 6 0 0 1 18 10a3.5 3.5 0 0 1 0 7M9 20l-1 2M13 20l-1 2M17 20l-1 2"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gym: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11l2-7H6.5"/>',
    bill: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    repeat: '<path d="M17 2l4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/>',
    euro: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    wait: '<path d="M7 3h10M7 21h10M8 3v4l4 5-4 5v4M16 3v4l-4 5 4 5v4"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  };
  const I = (n, c) => svg(P[n], c);

  // ---- source kinds: icon WITH text, and what the lead slot holds ----
  const KIND = {
    todo: { src: ['todo', 'ToDo'], lead: 'tick' },
    routine: { src: ['repeat', 'Routine'], lead: 'tick' },
    gym: { src: ['gym', 'Training'], lead: 'tick' },
    invoice: { src: ['bill', 'Rechnung'], lead: ['euro', 'Bezahlt …'] },
    list: { src: ['cart', 'Liste'], lead: ['list', 'Zur Liste'] },
    sub: { src: ['wallet', 'Abo'], lead: ['cut', 'Kündigen …'] },
    event: { src: ['cal', 'Termin'], lead: 'still' },
  };
  const T = (kind, title, dur, x = {}) => ({ kind, title, dur, ...x });
  const late = [
    T('invoice', 'Zahnarzt Dr. Beispiel bezahlen', '10 Min', { detail: '84,00 €', was: 'So' }),
    T('invoice', 'Tischlerei Beispiel bezahlen', '10 Min', { detail: '139,00 €', was: 'So' }),
    T('invoice', 'Musterversicherung bezahlen', '10 Min', { detail: '46,90 €', was: 'Di' }),
    T('invoice', 'Kfz-Werkstatt Muster bezahlen', '10 Min', { detail: '212,50 €', was: 'Di' }),
    T('invoice', 'Telefon Beispielnetz bezahlen', '10 Min', { detail: '29,99 €', was: 'Do' }),
    T('invoice', 'Schornsteinfeger Muster bezahlen', '10 Min', { detail: '61,20 €', was: 'Do' }),
  ];
  const monday = [
    T('event', 'Teamrunde', '1 h', { time: '09:30–10:30', block: 1 }),
    T('invoice', 'Stadtwerke Musterstadt bezahlen', '10 Min', { detail: 'Mahnung · 92,40 € bis 20.11.', links: [['bill', 'Zur Mahnung'], ['bill', 'Zur Rechnung']], first: 1 }),
    T('todo', 'Steuerunterlagen sortieren', '35 Min', { due: 'Frist Do', first: 1 }),
    T('list', 'Einkaufen · 7 Dinge', '30 Min', { first: 1 }),
    T('todo', 'Antwort an Hausverwaltung Muster', '15 Min', { links: [['mail', 'Aus Mail']] }),
    T('todo', 'Wohnung saugen', '30 Min'),
    T('todo', 'Angebot Fahrradladen prüfen', '20 Min'),
    T('sub', 'Probeabo Musikdienst Beispiel kündigen', '10 Min', { due: 'Frist 23.11.' }),
    T('routine', 'Pflanzen gießen', '5 Min'),
    T('gym', 'Training · Oberkörper', '1 h', { time: '18:00–19:00', block: 1, fixed: 1 }),
  ];
  const DAYS = [
    { id: 'So', n: 15, name: 'Sonntag, 15. November', rel: 'Heute', cap: 0, used: 0, free: 'frei', things: [] },
    { id: 'Mo', n: 16, name: 'Montag, 16. November', rel: 'Morgen', cap: 192, used: 155, free: '37 Min frei', of: '3 h 12', things: monday },
    { id: 'Di', n: 17, name: 'Dienstag, 17. November', cap: 192, used: 75, free: '1 h 57 frei', of: '3 h 12', things: [
      T('todo', 'Reisekosten abrechnen', '30 Min', { due: 'Frist Do' }), T('todo', 'Rücksendung an Musterversand', '30 Min', { links: [['mail', 'Aus Mail']] }), T('todo', 'Altglas wegbringen', '15 Min')] },
    { id: 'Mi', n: 18, name: 'Mittwoch, 18. November', cap: 132, used: 50, free: '1 h 22 frei', of: '2 h 12', things: [
      T('event', 'Zahnarzt', '1 h', { time: '14:00–15:00', block: 1 }), T('todo', 'Angebote Handwerker vergleichen', '30 Min'), T('todo', 'Wäsche', '20 Min')] },
    { id: 'Do', n: 19, name: 'Donnerstag, 19. November', cap: 192, used: 60, free: '2 h 12 frei', of: '3 h 12', things: [
      T('todo', 'Belege scannen', '45 Min', { due: 'Frist Do' }), T('todo', 'Bücher zur Bücherei bringen', '15 Min')] },
    { id: 'Fr', n: 20, name: 'Freitag, 20. November', cap: 192, used: 20, free: '2 h 52 frei', of: '3 h 12', things: [T('list', 'Packen: Wochenende Beispielstadt', '20 Min')] },
    { id: 'Sa', n: 21, name: 'Samstag, 21. November', cap: 96, used: 30, free: '1 h 06 frei', of: '1 h 36', things: [T('todo', 'Fahrrad putzen', '30 Min')] },
  ];
  const D = { late, days: DAYS, waiting: 16, pick: 1, state, phone };
  if (state === 'empty') { D.late = []; D.waiting = 0; DAYS.forEach((d) => { d.things = []; d.used = 0; if (d.cap) d.free = d.of + ' frei'; }); D.pick = 0; }
  if (state === 'late') { D.waiting = 0; DAYS.forEach((d) => { d.things = []; d.used = 0; if (d.cap) d.free = d.of + ' frei'; }); D.pick = 0; }
  if (state === 'over') { DAYS[1].used = 232; DAYS[1].free = '40 Min mehr als planbar'; DAYS[1].short = '40 Min mehr'; DAYS[1].over = 1; monday.splice(6, 0, T('todo', 'Keller aufräumen · Teil 1/2', '1 h 17')); }
  if (state === 'many') {
    D.waiting = 31;
    const more = ['Kontoauszüge ablegen', 'Fenster putzen', 'Drucker einrichten', 'Regal aufbauen', 'Fotos sichern', 'Balkon fegen', 'Schuhe zum Schuster', 'Lampe tauschen', 'Passbild machen', 'Akten schreddern', 'Winterreifen-Termin', 'Garantie Musterherd prüfen', 'Schrank ausmisten', 'Fahrradlicht laden', 'Briefe frankieren', 'Müllkalender eintragen', 'Blumenerde besorgen', 'Rauchmelder testen', 'Auto saugen', 'Gästebett beziehen', 'Kabel sortieren', 'Kühlschrank abtauen'];
    more.forEach((t, i) => monday.splice(monday.length - 1, 0, T('todo', t, [10, 15, 20][i % 3] + ' Min')));
    DAYS[1].used = 192; DAYS[1].free = 'voll'; DAYS[1].many = 1;
  }

  const count = (d) => d.things.filter((t) => t.kind !== 'event').length;
  const things = (n) => (n === 1 ? '1 Ding' : `${n} Dinge`);

  // ---- the ONE row: lead 44 · title / meta (source icon + text · deadline) / one chip line · duration · menu ----
  function row(t, o = {}) {
    const k = KIND[t.kind];
    const who = t.title.replace(/ bezahlen$| kündigen$/, '');
    let lead;
    if (k.lead === 'tick') lead = `<button class="lead tick" aria-label="Erledigt: ${t.title}"><span class="box"></span></button>`;
    else if (k.lead === 'still') lead = `<span class="lead still">${I('clock')}</span>`;
    else lead = `<button class="lead act" title="${k.lead[1]}" aria-label="${k.lead[1]}: ${who}${t.detail && t.kind === 'invoice' ? ', ' + t.detail.replace('Mahnung · ', '') : ''}"><span class="box">${I(k.lead[0])}</span></button>`;
    const bits = [`<span class="src">${I(k.src[0], 's')}${k.src[1]}</span>`];
    if (t.time) bits.push(`<span>${t.time}${t.fixed ? ' · fest' : ''}</span>`);
    if (t.detail) bits.push(`<span>${t.detail}</span>`);
    if (t.was) bits.push(`<span class="was${o.dangerWords ? ' money' : ''}">Frist war ${t.was}</span>`);
    if (t.due) bits.push(`<span>${t.due}</span>`);
    const links = t.links && !o.compact ? `<div class="links" aria-label="Verknüpft">${t.links.map(([i, l]) => `<a class="chip" href="#"><span>${I(i, 's')}${l}</span></a>`).join('')}</div>` : '';
    const cls = ['thing', t.block ? 'block' : '', o.next ? 'next' : '', o.compact ? 'compact' : ''].join(' ').trim();
    const menu = t.kind === 'event' ? '<span></span>' : `<button class="more" aria-label="Aktionen für ${t.title}">${I('more')}</button>`;
    return `<li class="${cls}" data-kind="${t.kind}">${lead}<div class="body"><div class="ttl">${t.title}</div><div class="meta">${(o.compact ? bits.concat(`<span>${t.dur}</span>`) : bits).join('<span class="sep" aria-hidden="true">·</span>')}</div></div><span class="dur">${t.dur}</span>${menu}${links}</li>`;
  }
  const rows = (list, o) => list.map((t) => row(t, o)).join('');

  function band(o = {}) {
    const max = Math.max(...DAYS.map((d) => d.cap));
    return `<div class="band" role="group" aria-label="Woche">${DAYS.map((d, i) => {
      const n = count(d);
      const label = d.cap ? `${d.free}${n ? ' · ' + things(n) : ''}` : 'frei';
      return `<button class="daytile" aria-pressed="${i === D.pick}"${i === 0 ? ' aria-current="date"' : ''} aria-label="${d.rel ? d.rel + ', ' : ''}${d.name}: ${label}">
        <span class="d"><span>${i === 0 ? '<span class="deskonly">Heute · </span>' : ''}${d.id} ${d.n}<span class="deskonly">.</span></span><small class="deskonly">${n ? things(n) : ''}</small></span>
        <span class="meta deskonly">${d.cap ? d.short || d.free : 'frei'}</span><span class="meta phoneonly">${d.cap ? (n || '–') : 'frei'}</span>
        <span class="bar${d.over ? ' over' : ''}" style="width:${d.cap ? Math.round((d.cap / max) * 100) : 100}%${d.cap ? '' : ';opacity:.35'}"><i style="width:${d.cap ? Math.min(100, Math.round((d.used / d.cap) * 100)) : 0}%"></i></span></button>`;
    }).join('')}</div>`;
  }

  function capture(o = {}) {
    const ex = ['Steuer 2 Std bis Do', 'Donnerstag frei', 'schieb Saugen auf Mi'];
    return `<form class="capture" onsubmit="return false"><label for="cap">Eintragen oder sagen</label>
      <div class="line"><div class="input${o.focus ? ' focus' : ''}" id="cap" role="textbox" aria-label="Eintragen oder sagen" tabindex="0">${I('plus')}<span>Was steht an?</span></div><button class="btn primary">Eintragen</button></div>
      <div class="ex"><span class="meta">Zum Beispiel</span>${ex.map((e) => `<button class="chip" type="button"><span>${e}</span></button>`).join('')}</div></form>`;
  }

  function lateGroup(o = {}) {
    if (!D.late.length) return '';
    const show = o.limit ? D.late.slice(0, o.limit) : D.late;
    const rest = D.late.length - show.length;
    return `<section class="card late" aria-labelledby="late-h"><header><h2 id="late-h" style="display:flex;align-items:center;gap:8px"><span style="color:var(--danger);display:inline-flex">${I('alert')}</span>Frist vorbei <span class="meta" style="font-weight:400">${D.late.length} Rechnungen · 573,59 €</span></h2>
      <p class="meta" style="padding-top:2px">Liegt auf keinem Tag. Bezahlt ist bezahlt – wann, entscheidest du.</p></header>
      <ul class="things">${rows(show, o)}</ul>${rest > 0 ? `<button class="fold">${I('down')}<b>${rest} weitere</b></button>` : ''}</section>`;
  }
  const lateFold = () => (D.late.length ? `<button class="fold card" style="padding:0 12px"><span style="color:var(--danger);display:inline-flex">${I('alert')}</span><b>Frist vorbei · ${D.late.length} Rechnungen</b><span style="margin-left:auto;display:inline-flex">${I('right')}</span></button>` : '');
  const waitFold = () => (D.waiting ? `<button class="fold card" style="padding:0 12px" aria-expanded="false">${I('right')}<b>Wartet auf freie Zeit · ${D.waiting}</b> <span class="deskonly">Nichts davon muss heute sein.</span></button>` : '');


  // The day surface: title + free time on one scale, fixed blocks as recessed rows, „Zuerst“ (≤ 3) then „Danach“.
  function daySheet(d, o = {}) {
    const title = `${d.rel ? d.rel + ' · ' : ''}${d.name}`;
    const all = d.things, first = all.filter((t) => t.first), n = count(d);
    const after = all.filter((t) => !t.first && !t.block), pre = all.filter((t) => t.block && !t.fixed), post = all.filter((t) => t.fixed);
    const open = phone ? 0 : o.open ?? 5;
    const cap = d.cap ? `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="muted">${d.over || d.many ? d.free : d.free + ' von ' + d.of}</span><a class="lk meta why" href="#">Warum?</a></div>` : '<span class="muted">frei</span>';
    let body;
    if (!n && !all.length) {
      body = `<div style="padding:28px 8px 32px;display:grid;gap:6px;justify-items:start"><p>${state === 'empty' ? 'Noch nichts geplant. Eine Sache reicht.' : d.cap ? 'Für diesen Tag ist nichts geplant.' : 'Heute ist frei.'}</p>
        <p class="meta">${state === 'empty' ? 'Schreib oben, was ansteht – oder tippe ein Beispiel an.' : state === 'late' ? 'Die Woche ist leer. Offen sind nur die Rechnungen unter „Frist vorbei“.' : 'Der nächste Tag mit Dingen ist Montag.'}</p></div>`;
    } else {
      const sum = d.id === 'Mo' && state === 'week' && !o.firstLabel ? ' · 1 h 20' : '';
      const lead3 = first.length ? first : after.splice(0, 3);
      body = `<ul class="things">${rows(pre)}<li class="grp" role="presentation">${o.firstLabel ?? 'Zuerst'}</li>${lead3.map((t, i) => row(t, { next: i === 0 })).join('')}
        ${after.length ? (open ? `<li class="grp" role="presentation">Danach <span class="n">${after.length}${sum}</span></li>${rows(after.slice(0, open))}${after.length > open ? `<li><button class="fold">${I('down')}<b>${after.length - open} weitere</b></button></li>` : ''}` : `<li><button class="fold" aria-expanded="false">${I('right')}<b>Danach · ${things(after.length)}</b> <span>${sum.replace(' · ', '')}</span></button></li>`) : ''}
        ${rows(post)}</ul>`;
    }
    const hint = d.over ? `<p class="meta" style="padding:8px 8px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap">${I('alert', 's')}Der Tag hat mehr Dinge als Zeit.<a class="lk" href="#">Rest verteilen</a></p>` : '';
    return `<section class="card sheet" aria-labelledby="day-h"><header style="display:grid;gap:8px;padding:10px 8px 8px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px 16px;flex-wrap:wrap"><h2 class="daytitle" id="day-h">${title}</h2>${cap}</div>
      <div class="bar${d.over ? ' over' : ''}" role="img" aria-label="${d.cap ? d.free : 'frei'}"><i style="width:${d.cap ? Math.min(100, Math.round((d.used / d.cap) * 100)) : 0}%"></i></div>${hint}</header>${body}
      ${n && !o.noFoot ? `<footer class="deskonly" style="display:flex;gap:20px;padding:0 8px;border-top:1px solid var(--border);margin-top:4px"><a class="lk meta" href="#" style="min-height:44px;display:inline-flex;align-items:center">Rest verteilen</a><a class="lk meta" href="#" style="min-height:44px;display:inline-flex;align-items:center">Tage einteilen</a></footer>` : ''}</section>`;
  }

  function context() {
    const li = (i, a, b) => `<li class="thing" style="grid-template-columns:var(--touch) minmax(0,1fr);min-height:52px"><span class="lead still" style="margin:0;align-self:center">${I(i)}</span><div><div class="ttl" style="font-weight:400">${a}</div><div class="meta">${b}</div></div></li>`;
    return `<section class="card"><h2>Termine</h2><ul class="things">${li('cal', 'Teamrunde', 'Mo 09:30 · 1 h')}${li('cal', 'Zahnarzt', 'Mi 14:00 · 1 h')}</ul></section>
      ${state === 'empty' || state === 'late' ? '<!--' : ''}<section class="card"><h2>Nächste Fristen</h2><ul class="things">${li('bill', 'Stadtwerke Musterstadt', 'Fr 20.11. · Mahnung · 92,40 €')}${li('wallet', 'Probeabo Musikdienst Beispiel', 'Mo 23.11. · endet')}${li('todo', 'Steuerunterlagen sortieren', 'Do 19.11.')}</ul></section>${state === 'empty' || state === 'late' ? '-->' : ''}
      <p class="meta" style="display:flex;gap:8px;align-items:center;padding:4px 16px">${I('rain', 's')}Mo: Regen ab 16 Uhr</p>`;
  }

  function shell() {
    const nav = (i, t, on, hue) => `<a href="#"${on ? ' class="on" aria-current="page"' : ''}><span style="color:var(--mod-${hue || 'x'},currentColor);display:inline-flex">${I(i)}</span>${t}</a>`;
    const sb = document.getElementById('sb');
    if (sb) sb.innerHTML = `<div class="brand"><b>NEMO</b></div><nav class="nav" aria-label="Hauptnavigation" style="display:flex;flex-direction:column;flex:1">
      ${nav('home', 'Übersicht')}<div class="sgrp"><div class="caps">Planen</div>${nav('cal', 'Kalender', 0, 'sky')}${nav('plan', 'Planer', 1, 'indigo')}${nav('todo', 'ToDos', 0, 'moss')}${nav('sun', 'Wetter', 0, 'ocean')}</div>
      <div class="caps">Geld</div><div class="foot">${nav('grid', 'Modul-Bibliothek')}${nav('gear', 'Einstellungen')}${nav('panel', 'Einklappen')}</div></nav>`;
    const tb = document.getElementById('tb');
    if (tb) tb.innerHTML = `<a class="brand phoneonly" href="#" aria-label="Nemo, zur Übersicht"><b>N</b></a><div class="search" role="search">${I('search')}<span>Suchen</span></div><span class="sp"></span>
      <button class="btn line new">${I('plus')}Neu</button><button class="btn" aria-label="Werkzeuge">${I('tool')}<span class="lbl">Werkzeuge</span></button><button class="btn icon" aria-label="Mitteilungen">${I('bell')}</button>`;
    const hd = document.getElementById('hd');
    if (hd) {
      const fig = hd.dataset.figure, sub = hd.dataset.sub;
      const psub = hd.dataset.psub;
      hd.innerHTML = `<div class="titlerow"><span class="plate">${I('plan')}</span><div><div class="caps">Planen<span class="deskonly"> · Sonntag, 15. November</span></div><h1>Planer</h1></div>
        ${fig ? `<div class="figure"><b>${fig}</b><small class="deskonly">${sub || ''}</small><small class="phoneonly">${psub || sub || ''}</small></div>` : '<span style="margin-left:auto"></span>'}
        <div class="act"><button class="btn quiet icon" aria-label="Weitere Optionen">${I('more')}</button><button class="btn quiet icon" aria-label="Einstellungen: Planer">${I('gear')}</button></div></div>
        <nav class="modrow" aria-label="Planen"><a href="#"><span>Kalender</span></a><a href="#" class="on" aria-current="page"><span>Planer</span></a><a href="#"><span>ToDos</span></a><a href="#"><span>Wetter</span></a></nav>`;
    }
    const bt = document.getElementById('bt');
    if (bt) bt.innerHTML = `<a href="#">${I('home')}Übersicht</a><a href="#" class="on" aria-current="page">${I('cal')}Planen</a><a href="#" class="plus" aria-label="Ding eintragen"><i>${I('plus')}</i>Ding</a><a href="#">${I('wallet')}Geld</a><a href="#">${I('more')}Mehr</a>`;
  }

  window.PH = { D, I, daySheet, row, rows, band, capture, lateGroup, lateFold, waitFold, context, count, things, shell, phone };
})();
