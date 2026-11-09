// Mockup helper: reads ?v=A|B|C&theme=light|dark&device=desktop|mobile, sets the html attributes and fills the shared
// shell (sidebar v3, top bar, bottom nav). The page says which entry is active via <body data-active="finance"
// data-area="money"> and sets its module hue via --mod on body.
(() => {
  const q = new URLSearchParams(location.search);
  const h = document.documentElement;
  h.dataset.v = 'four';
  h.dataset.theme = q.get('theme') || 'light';
  h.dataset.device = q.get('device') || 'desktop';

  const svg = (d) => `<svg class="ic" viewBox="0 0 24 24">${d}</svg>`;
  const I = {
    home: svg('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    cal: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    todo: svg('<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'),
    target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    map: svg('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'),
    people: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-5-5.5"/>'),
    wallet: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>'),
    bill: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>'),
    repeat: svg('<path d="M17 2l4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/>'),
    piggy: svg('<path d="M4 7h16v12H4zM4 7l8-4 8 4M12 11v4"/>'),
    cart: svg('<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11l2-7H6.5"/>'),
    box: svg('<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>'),
    bookmark: svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
    note: svg('<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6"/>'),
    spark: svg('<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    files: svg('<path d="M4 4h6l2 2h8v14H4z"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    disk: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18M7 17h2"/>'),
    download: svg('<path d="M12 3v12M6 9l6 6 6-6M4 21h16"/>'),
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>'),
    more: svg('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
    chev: svg('<path d="M9 6l6 6-6 6"/>'),
    chevd: svg('<path d="M6 9l6 6 6-6"/>'),
    panel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M6 8h1M6 11h1"/>'),
    tools: svg('<path d="M14 7a4 4 0 0 1 5 5l-8 8-4-4 8-8z"/><path d="M4 20l3-3"/>'),
    max: svg('<path d="M4 9V4h5M20 15v5h-5M20 4l-6 6M4 20l6-6"/>'),
    edit: svg('<path d="M4 20h4l10-10-4-4L4 16zM13 7l4 4"/>'),
    check: svg('<path d="M5 12l4 4 10-10"/>'),
    play: svg('<path d="M7 5l12 7-12 7z"/>'),
    pause: svg('<path d="M9 5v14M15 5v14"/>'),
    next: svg('<path d="M5 4l10 8-10 8zM19 5v14"/>'),
    alert: svg('<path d="M12 3l10 18H2zM12 10v4M12 17v1"/>'),
    cloud: svg('<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4 4 0 0 1 0 9z"/>'),
  };
  window.ICONS = I;
  document.querySelectorAll('[data-i]').forEach((el) => (el.innerHTML = I[el.dataset.i] || ''));

  // modules: id, icon, label, hue, area
  const MODS = {
    plan: [['calendar','cal','Kalender','sky'],['todos','todo','ToDos','moss'],['habits','target','Gewohnheiten','violet'],['timetrack','clock','Zeiterfassung','teal'],['weather','sun','Wetter','cobalt'],['maps','map','Karten &amp; Orte','ocean'],['people','people','Personen','orchid']],
    money: [['finance','wallet','Finanzen','teal'],['invoices','bill','Rechnungen','ocean'],['subscriptions','repeat','Abos','indigo'],['budgets','piggy','Budgets','lime']],
    household: [['lists','cart','Listen','orchid'],['pantry','box','Vorräte','fern']],
    knowledge: [['bookmarks','bookmark','Merkliste','indigo'],['notes','note','Notizen','violet'],['chat','spark','Chat','sky'],['browser','globe','Browser','cobalt'],['mail','mail','E-Mail','teal'],['music','music','Musik','orchid']],
    vault: [['vault','files','Unterlagen','indigo'],['accounts','lock','Passwörter','slate']],
    system: [['disk','disk','Dieser PC','slate'],['downloads','download','Downloads','cobalt']],
  };
  const AREA = { plan: ['Planen','cal'], money: ['Geld','wallet'], household: ['Haushalt','box'], knowledge: ['Wissen','note'], vault: ['Tresor','lock'], system: ['System','disk'] };
  const AREA_HUE = { plan: 'sky', money: 'teal', household: 'fern', knowledge: 'violet', vault: 'indigo', system: 'slate' };
  window.MODS = MODS;
  const active = document.body.dataset.active || '';
  const nav = ([id, icon, label, hue], cnt = '') =>
    `<a class="nav${id === active ? ' active' : ''}" style="--mod:var(--mod-${hue})">${I[icon]}<span>${label}</span>${cnt ? `<span class="cnt">${cnt}</span>` : ''}</a>`;
  const sb = document.getElementById('sb');
  if (sb)
    sb.innerHTML = `
      <a class="brand"><span class="logo">N</span>Nemo</a>
      <div class="favbar">${[MODS.plan[0], MODS.plan[1], MODS.money[0], MODS.household[1]].map(([id, icon, , hue]) => `<a class="${id === active ? 'cur' : ''}" style="--mod:var(--mod-${hue})" title="">${I[icon]}</a>`).join('')}</div>
      <div class="navscroll">
        <a class="nav${active === 'home' ? ' active-accent' : ''}">${I.home}<span>Übersicht</span></a>
        ${Object.entries(MODS).map(([a, mods]) => `<div class="navgrp" style="--area:var(--mod-${AREA_HUE[a]})"><div class="navh">${AREA[a][0]}${I.chevd}</div>${mods.map((m) => nav(m, m[0] === 'invoices' ? '2' : m[0] === 'todos' ? '11' : '')).join('')}</div>`).join('')}
      </div>
      <div class="navfoot"><a class="nav">${I.grid}<span>Modul-Bibliothek</span></a><a class="nav">${I.gear}<span>Einstellungen</span></a><a class="nav">${I.panel}<span>Einklappen</span></a></div>`;
  const tb = document.getElementById('tb');
  if (tb)
    tb.innerHTML = `${h.dataset.device === 'mobile' ? '<a class="brand" style="padding:0 4px 0 0"><span class="logo">N</span></a>' : ''}<div class="search">${I.search}<span class="lbl">Suchen oder fragen</span><span class="kbd">Strg K</span></div>
      <a class="btn primary">${I.plus}<span class="lbl">Neu</span></a><a class="btn ghost">${I.tools}<span class="lbl">Werkzeuge</span></a><a class="btn ghost icon">${I.bell}</a>`;
  const bn = document.getElementById('bn');
  const area = document.body.dataset.area || '';
  if (bn)
    bn.innerHTML = `<a class="${area === 'home' ? 'on-accent' : ''}">${I.home}Übersicht</a><a class="${area === 'plan' ? 'on' : ''}" style="--mod:var(--mod-sky)">${I.cal}Planen</a><a class="${area === 'money' ? 'on' : ''}" style="--mod:var(--mod-teal)">${I.wallet}Geld</a><a class="${area === 'household' ? 'on' : ''}" style="--mod:var(--mod-fern)">${I.box}Haushalt</a><a>${I.more}Mehr</a>`;
  // sub-navigation: the active module's area
  document.querySelectorAll('.subnav[data-area], .modrow[data-area]').forEach((el) => {
    const a = el.dataset.area;
    el.innerHTML = (el.classList.contains('modrow') ? '' : `<span class="area">${AREA[a][0]}</span>`) + MODS[a].map(([id, icon, label, hue]) => `<a class="${id === active ? 'on' : ''}" style="--mod:var(--mod-${hue})">${I[icon]}${label}</a>`).join('');
  });
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `4.0 Mockup · ${h.dataset.theme} · ${h.dataset.device}`;
  document.body.appendChild(label);
})();
