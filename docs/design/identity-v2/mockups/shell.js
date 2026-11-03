// Mockup helper: reads ?v=A|B|C&theme=light|dark&device=desktop|mobile&scrolled=1&state=…,
// sets the html attributes and fills the shared shell (sidebar, top bar, bottom nav).
// The page says which entry is active via <body data-active="finance" data-area="geld">.
(() => {
  const q = new URLSearchParams(location.search);
  const h = document.documentElement;
  h.dataset.v = q.get('v') || 'B';
  h.dataset.theme = q.get('theme') || 'light';
  h.dataset.device = q.get('device') || 'desktop';
  if (q.get('scrolled')) h.dataset.scrolled = '1';
  if (q.get('state')) h.dataset.state = q.get('state');

  const I = {
    home: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    cal: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    todo: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
    wallet: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></svg>',
    sun: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    music: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    map: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/></svg>',
    people: '<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-5-5.5"/></svg>',
    bill: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/></svg>',
    repeat: '<svg class="ic" viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/></svg>',
    budget: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16v12H4zM4 7l8-4 8 4M12 11v4"/></svg>',
    grid: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    gear: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    search: '<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    plus: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    bell: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/></svg>',
    more: '<svg class="ic" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  };
  window.ICONS = I;
  const active = document.body.dataset.active || '';
  const nav = (id, icon, label, extra = '') => {
    const cls = ['nav', extra, id === active ? (id === 'home' ? 'active-accent' : 'active') : ''].join(' ');
    return `<a class="${cls}">${I[icon]}${label}</a>`;
  };
  const sb = document.getElementById('sb');
  if (sb)
    sb.innerHTML = `
      <div class="brand">Nemo</div>
      ${nav('home', 'home', 'Übersicht')}
      <div class="navh">Favoriten</div>
      ${nav('calendar', 'cal', 'Kalender')}${nav('todos', 'todo', 'ToDos')}${nav('finance', 'wallet', 'Finanzen')}
      <div class="navh">Bereiche</div>
      <a class="nav grp" style="--area:var(--mod-sky)">${I.cal}Planen</a>
      ${nav('calendar', 'cal', 'Kalender', 'sub')}${nav('todos', 'todo', 'ToDos', 'sub')}${nav('weather', 'sun', 'Wetter', 'sub')}${nav('maps', 'map', 'Karten &amp; Orte', 'sub')}${nav('people', 'people', 'Personen', 'sub')}
      <a class="nav grp" style="--area:var(--mod-teal)">${I.wallet}Geld</a>
      ${nav('finance', 'wallet', 'Finanzen', 'sub')}${nav('invoices', 'bill', 'Rechnungen', 'sub')}${nav('subscriptions', 'repeat', 'Abos', 'sub')}${nav('budgets', 'budget', 'Budgets', 'sub')}
      <a class="nav grp" style="--area:var(--mod-moss)">${I.grid}Haushalt</a>
      <a class="nav grp" style="--area:var(--mod-violet)">${I.grid}Wissen</a>
      ${nav('music', 'music', 'Musik', 'sub')}
      <a class="nav grp" style="--area:var(--mod-plum)">${I.grid}Tresor</a>
      <div class="navfoot">${nav('library', 'grid', 'Modul-Bibliothek')}${nav('settings', 'gear', 'Einstellungen')}</div>`;
  const tb = document.getElementById('tb');
  if (tb)
    tb.innerHTML = `<div class="search">${I.search}Suchen oder fragen<span class="kbd">Strg K</span></div>
      <a class="btn primary">${I.plus}<span class="lbl">Neu</span></a><a class="btn ghost">${I.grid}<span class="lbl">Werkzeuge</span></a><a class="btn ghost" style="padding:0 10px">${I.bell}</a>`;
  const bn = document.getElementById('bn');
  const area = document.body.dataset.area || '';
  if (bn)
    bn.innerHTML = `<a class="${area === 'home' ? 'on-accent' : ''}">${I.home}Übersicht</a><a class="${area === 'planen' ? 'on' : ''}">${I.cal}Planen</a><a class="${area === 'geld' ? 'on' : ''}">${I.wallet}Geld</a><a>${I.grid}Haushalt</a><a class="${area === 'wissen' ? 'on' : ''}">${I.more}Mehr</a>`;
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `Variante ${h.dataset.v} · ${h.dataset.theme} · ${h.dataset.device}`;
  document.body.appendChild(label);
})();
