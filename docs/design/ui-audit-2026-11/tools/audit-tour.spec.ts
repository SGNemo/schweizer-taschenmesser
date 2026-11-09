import { mkdirSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { openToolbox } from '../helpers';
import { bootDev, SEED_TODAY, seedApp } from '../seed/helpers';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { mockWeather, pickWeatherPlace } from '../weather-mock';

/**
 * UI audit 2026-11 (docs/design/ui-audit-2026-11/REPORT.md): screenshot tour of every surface plus
 * "measure instead of opine" facts per view – stimulus load above the fold (visible actions, meaning
 * colours, text amount), consistency (head variant and height, h1/h2 type, icon sizes and strokes,
 * distinct spacing values, font weights, borders vs shadows vs tints), motion and states (transition
 * properties, running animations, hover/focus/active samples), layout shift, axe. Builds on the round-6
 * tour (docs/qa/round-6/tools/round6.spec.ts); round-6 findings are not re-measured here on purpose.
 * Usage (web/, seeded preview on :4174):
 *   SCREENS_DIR=.screens/ui-audit UA_RUNS=d-dark,d-light,p-dark,p-light UA_PARTS=seed,empty \
 *   npx playwright test -c playwright.audit.config.ts audit-tour.spec.ts
 */
const OUT = process.env.SCREENS_DIR ?? '.screens/ui-audit';
const WAIT = Number(process.env.SCREENS_WAIT ?? 700);
const ONLY = process.env.UA_PARTS?.split(',');
const part = (name: string) => !ONLY || ONLY.includes(name);
const AXE = process.env.UA_AXE !== '0';

interface Mod {
  id: string;
  path: string;
  desktop?: boolean;
  views?: string[];
}
const MODULES: Mod[] = [
  {
    id: 'calendar',
    path: `/calendar?view=month&date=${SEED_TODAY}`,
    views: ['week', 'day', 'agenda', 'year'].map((v) => `/calendar?view=${v}&date=${SEED_TODAY}`),
  },
  { id: 'planner', path: '/planner' },
  { id: 'todos', path: '/todos' },
  { id: 'habits', path: '/habits' },
  { id: 'timetrack', path: '/timetrack' },
  { id: 'weather', path: '/weather' },
  { id: 'maps', path: '/maps' },
  { id: 'people', path: '/people' },
  { id: 'fitness', path: '/fitness' },
  { id: 'finance', path: '/finance?tab=overview', views: ['/finance?tab=transactions', '/finance?tab=accounts'] },
  { id: 'invoices', path: '/invoices' },
  { id: 'subscriptions', path: '/subscriptions' },
  { id: 'budgets', path: '/budgets' },
  { id: 'lists', path: '/lists' },
  { id: 'pantry', path: '/pantry' },
  { id: 'bookmarks', path: '/bookmarks' },
  { id: 'notes', path: '/notes' },
  { id: 'chat', path: '/chat' },
  { id: 'browser', path: '/browser', desktop: true },
  { id: 'feeds', path: '/feeds' },
  { id: 'mail', path: '/mail', desktop: true },
  { id: 'music', path: '/music' },
  { id: 'vault', path: '/vault' },
  { id: 'accounts', path: '/accounts' },
  { id: 'disk', path: '/disk', desktop: true, views: ['/disk/scan'] },
  { id: 'downloads', path: '/downloads', desktop: true },
];
const AREAS = ['/planen', '/geld', '/haushalt', '/wissen', '/tresor', '/geraet'];
const SETTINGS = [
  'einrichtung', 'allgemein', 'darstellung', 'barrierefreiheit', 'module', 'werkzeuge', 'benachrichtigungen',
  'sicherheit', 'sync', 'ki', 'verbindungen', 'schnellerfassung', 'updates', 'entwickler', 'ueber',
];
const SHELL: { id: string; path: string; full?: boolean }[] = [
  { id: 'library', path: '/library', full: true },
  { id: 'library-vault', path: '/library/vault' },
  { id: 'tools', path: '/tools', full: true },
  { id: 'settings', path: '/settings' },
  ...SETTINGS.map((s) => ({ id: `settings-${s}`, path: `/settings/${s}`, full: true })),
  { id: 'settings-module-finance', path: '/settings/module/finance', full: true },
];

async function enableModules(page: Page, ids: string[]) {
  await page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of list)
            tx.objectStore('_modules').put({
              id, enabled: true, dataPolicy: null, createdAt: 1, updatedAt: 1, deviceId: 'screens', deletedAt: null, _f: {},
            });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ids,
  );
}

async function settle(page: Page, wait = WAIT) {
  await expect(page.locator('main')).toBeVisible();
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click().catch(() => {});
  await page.waitForTimeout(wait);
}

interface Vp { name: string; width: number; height: number; mobile?: boolean }
const DESKTOP: Vp = { name: '1920x1080', width: 1920, height: 1080 };
const PHONE: Vp = { name: '412x915', width: 412, height: 915, mobile: true };

const CLS_SCRIPT = `
  window.__cls = 0;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  } catch {}
`;

async function newContext(
  browser: Parameters<Parameters<typeof test>[2]>[0]['browser'],
  vp: Vp, scheme: 'light' | 'dark', seed: boolean,
): Promise<{ context: BrowserContext; page: Page }> {
  const desktop = !vp.mobile;
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile ?? false,
    hasTouch: vp.mobile ?? false,
    deviceScaleFactor: 1,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await mockWeather(page);
  await page.addInitScript((isDesktop) => {
    localStorage.setItem('tm-show-preview', '1');
    if (isDesktop) localStorage.setItem('__tmPlatformKind', 'desktop');
  }, desktop);
  await page.addInitScript(CLS_SCRIPT);
  await bootDev(page);
  if (seed) await seedApp(page, 'medium');
  else { await page.goto('/'); await settle(page); }
  await enableModules(page, MODULES.filter((m) => desktop || !m.desktop).map((m) => m.id));
  if (seed) {
    await pickWeatherPlace(page);
    await mockSpotify(page);
    await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
  }
  return { context, page };
}

/** Desktop: `main` scrolls, not the document; grow the viewport to the page for a full shot. */
async function fullShot(page: Page, vp: Vp, path: string) {
  if (vp.mobile) { await page.screenshot({ path, fullPage: true }); return; }
  const height = await page.evaluate(() => {
    const main = document.getElementById('main');
    return main ? Math.min(main.scrollHeight + main.getBoundingClientRect().top, 5000) : innerHeight;
  });
  await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, Math.ceil(height)) });
  await page.waitForTimeout(250);
  await page.screenshot({ path });
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

/** All measurements of one view, computed in the page. */
async function measure(page: Page, root: 'main' | 'dialog', phone: boolean) {
  return page.evaluate(
    ([rootSel, isPhone]) => {
      const scope =
        rootSel === 'dialog'
          ? (document.querySelector<HTMLElement>('dialog[open], [role="dialog"]') ?? document.body)
          : (document.getElementById('main') ?? document.body);
      const doc = document.documentElement;
      const main = document.getElementById('main');
      const fold = innerHeight;
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
      };
      const aboveFold = (el: Element) => { const r = el.getBoundingClientRect(); return r.top < fold && r.bottom > 0; };
      const txt = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
      const cls = (el: Element) => String(el.getAttribute('class') ?? '').split(' ')[0] ?? '';
      const all = Array.from(scope.querySelectorAll<HTMLElement>('*')).slice(0, 6000);
      const rootStyle = getComputedStyle(doc);
      const token = (name: string) => rootStyle.getPropertyValue(name).trim();
      const probe = document.createElement('span');
      document.body.appendChild(probe);
      const rgb = (css: string) => { probe.style.color = css; return getComputedStyle(probe).color; };
      const bgs = new Set([rgb(token('--bg')), rgb(token('--surface')), 'rgba(0, 0, 0, 0)', 'transparent']);
      const surface2 = rgb(token('--surface-2'));
      const neutralInk = new Set([rgb(token('--text')), rgb(token('--text-muted')), rgb(token('--text-3')), rgb(token('--text-on-tint'))]);
      probe.remove();
      const parseRgb = (c: string) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
        if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4] };
        // Chromium serialises `color-mix()` results as `color(srgb r g b / a)` with 0–1 channels.
        const k = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/.exec(c);
        return k ? { r: Math.round(+k[1]! * 255), g: Math.round(+k[2]! * 255), b: Math.round(+k[3]! * 255), a: k[4] === undefined ? 1 : +k[4] } : null;
      };
      const saturation = (c: string) => { const p = parseRgb(c); if (!p || p.a < 0.05) return 0; const max = Math.max(p.r, p.g, p.b), min = Math.min(p.r, p.g, p.b); return max === 0 ? 0 : (max - min) / max; };

      // 1. Stimulus above the fold: actions, meaning colours, text amount.
      const actionSel = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"]';
      const actions = all.filter((el) => el.matches(actionSel) && visible(el) && aboveFold(el));
      const chromeActions = actions.filter((el) => !el.closest('li, [data-row], table, [role="gridcell"], [role="grid"], [data-testid^="widget-"], article, dialog')).length;
      // Where the page's own content begins: the first list row, table, grid cell, tile or card below the head band and toolbars.
      const contentSel = 'main [data-row], main li, main table, main [role="gridcell"], main [role="grid"], main article, main [data-testid^="widget-"], main form textarea, main canvas, main svg[role="img"], main [class*="card"], main [class*="tile"], main [class*="Card"]';
      let firstContentY: number | null = null;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(contentSel))) { if (!visible(el) || el.closest('nav, [role="tablist"], dialog, aside, [data-testid="module-frame"]')) continue; const t = el.getBoundingClientRect().top; if (t > 60 && (firstContentY === null || t < firstContentY)) firstContentY = Math.round(t); }
      const primaries = actions.filter((el) => el.matches('button, a') && /(^|_| )primary(_|$| )/.test(String(el.className))).map((el) => txt(el) || el.getAttribute('aria-label') || '?');
      let colouredText = 0, colouredSurfaces = 0, colouredIcons = 0, gradients = 0;
      const colourSamples: string[] = [];
      for (const el of all) {
        if (!visible(el) || !aboveFold(el)) continue;
        const s = getComputedStyle(el);
        const isSvg = el instanceof SVGElement;
        if (isSvg) {
          if (el.tagName.toLowerCase() === 'svg' && saturation(s.color) > 0.25 && !neutralInk.has(s.color)) colouredIcons++;
          continue;
        }
        const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        if (own && saturation(s.color) > 0.25 && !neutralInk.has(s.color)) { colouredText++; if (colourSamples.length < 12) colourSamples.push(`text ${cls(el)} | ${txt(el).slice(0, 30)}`); }
        const pbg = parseRgb(s.backgroundColor);
        if (!bgs.has(s.backgroundColor) && s.backgroundColor !== surface2 && pbg && pbg.a > 0.05 && saturation(s.backgroundColor) > 0.12) { colouredSurfaces++; if (colourSamples.length < 12) colourSamples.push(`bg ${cls(el)} | ${txt(el).slice(0, 30)}`); }
        if (s.backgroundImage.includes('gradient')) gradients++;
      }
      let textChars = 0, words = 0;
      const leafs = all.filter((el) => visible(el) && aboveFold(el) && !(el instanceof SVGElement));
      for (const el of leafs) for (const n of Array.from(el.childNodes)) if (n.nodeType === Node.TEXT_NODE) { const t = n.textContent!.trim(); if (t) { textChars += t.length; words += t.split(/\s+/).length; } }

      // 2. Consistency: head, type, icons, spacing, weights, surfaces.
      const band = document.querySelector<HTMLElement>('[data-testid="module-frame"] [data-size], header [data-size], [data-size]');
      const h1 = scope.querySelector('h1') ?? document.querySelector('h1');
      const h1s = h1 ? getComputedStyle(h1) : null;
      const headEl = band ?? document.querySelector<HTMLElement>('[class*="band"]');
      const head = headEl ? { height: Math.round(headEl.getBoundingClientRect().height), size: headEl.getAttribute('data-size'), hue: headEl.getAttribute('data-hue'), area: headEl.getAttribute('data-area') } : null;
      const h2 = new Map<string, number>();
      for (const el of Array.from(scope.querySelectorAll<HTMLElement>('h2, h3')).filter(visible)) {
        const s = getComputedStyle(el);
        const key = `${el.tagName.toLowerCase()} ${s.fontSize}/${s.fontWeight}/${s.fontFamily.split(',')[0]!.replace(/"/g, '')}`;
        h2.set(key, (h2.get(key) ?? 0) + 1);
      }
      const sizes = new Map<string, number>(); const weights = new Map<string, number>();
      for (const el of leafs) { if (!Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())) continue; const s = getComputedStyle(el); sizes.set(s.fontSize, (sizes.get(s.fontSize) ?? 0) + 1); weights.set(s.fontWeight, (weights.get(s.fontWeight) ?? 0) + 1); }
      const icons = new Map<string, number>();
      for (const el of Array.from(scope.querySelectorAll<SVGElement>('svg')).filter(visible)) { const r = el.getBoundingClientRect(); const sw = el.getAttribute('stroke-width') ?? el.querySelector('[stroke-width]')?.getAttribute('stroke-width') ?? '-'; const key = `${Math.round(r.width)}px/${sw}`; icons.set(key, (icons.get(key) ?? 0) + 1); }
      const gaps = new Map<string, number>();
      for (const el of all.slice(0, 2500)) { if (!visible(el)) continue; const s = getComputedStyle(el); for (const p of ['gap', 'rowGap', 'paddingTop', 'paddingLeft'] as const) { const v = parseFloat(s[p]); if (v > 0) gaps.set(`${v}`, (gaps.get(`${v}`) ?? 0) + 1); } }
      let bordered = 0, shadowed = 0, tinted = 0, surface2Count = 0, ringed = 0, radii = new Map<string, number>();
      const visibleBorder = (c: string) => { const p = parseRgb(c); return !!p && p.a > 0.05; };
      for (const el of all) {
        if (!visible(el) || el instanceof SVGElement) continue;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 24) continue;
        if (s.borderTopWidth !== '0px' && s.borderTopStyle === 'solid' && s.borderTopWidth === s.borderBottomWidth && s.borderLeftWidth === s.borderTopWidth && s.borderRightWidth === s.borderTopWidth && visibleBorder(s.borderTopColor) && !el.matches('input, select, textarea, button')) bordered++;
        if (s.boxShadow !== 'none') {
          // A ring = every shadow segment has no offset and no blur (0 0 0 n px, inset or not); anything with blur is a shadow.
          const segs = s.boxShadow.split(/\),\s*/);
          const ring = segs.every((seg) => /(^|\s)0px 0px 0px \d+(\.\d+)?px/.test(seg));
          if (ring) ringed++; else shadowed++;
        }
        const pb = parseRgb(s.backgroundColor);
        if (s.backgroundColor === surface2) surface2Count++;
        else if (!bgs.has(s.backgroundColor) && pb && pb.a > 0.05 && !el.matches('button, input, select, [role="tab"]')) tinted++;
        if (s.borderTopLeftRadius !== '0px' && r.width > 80) radii.set(s.borderTopLeftRadius, (radii.get(s.borderTopLeftRadius) ?? 0) + 1);
      }
      const rows = Array.from(scope.querySelectorAll<HTMLElement>('[data-row]')).filter(visible).map((el) => Math.round(el.closest('li')?.getBoundingClientRect().height ?? el.getBoundingClientRect().height));
      rows.sort((a, b) => a - b);
      const rowMedian = rows.length ? rows[Math.floor(rows.length / 2)] : null;

      // 3. Motion: what moves and what transitions.
      const animated: string[] = []; const transitions = new Map<string, number>();
      for (const el of all) { if (!visible(el)) continue; const s = getComputedStyle(el); if (s.animationName !== 'none') animated.push(`${cls(el)} ${s.animationName}`); if (s.transitionProperty !== 'all' && s.transitionProperty !== 'none' && s.transitionDuration !== '0s') for (const p of s.transitionProperty.split(',').map((x) => x.trim())) transitions.set(p, (transitions.get(p) ?? 0) + 1); else if (s.transitionProperty === 'all' && s.transitionDuration !== '0s') transitions.set('all', (transitions.get('all') ?? 0) + 1); }

      // 4. Overflow, clipped text (kept from round 6 for regressions), small targets on the phone.
      const overflow = { doc: doc.scrollWidth - doc.clientWidth, main: main ? main.scrollWidth - main.clientWidth : 0 };
      const clipped: string[] = [];
      for (const el of all) {
        const s = getComputedStyle(el);
        if (s.overflow === 'visible' && s.overflowX === 'visible') continue;
        const cut = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
        if (!cut || !el.textContent?.trim() || el.children.length > 3) continue;
        if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
        if (el.matches('input, textarea, select, pre, code, canvas, svg, [data-scroll], [role="listbox"]')) continue;
        if (['auto', 'scroll'].includes(s.overflowY) || ['auto', 'scroll'].includes(s.overflowX)) continue;
        clipped.push(`${cls(el)} | ${txt(el)}`);
        if (clipped.length > 30) break;
      }
      const small: string[] = [];
      if (isPhone) for (const el of actions) { const r = el.getBoundingClientRect(); if (r.height >= 40 && r.width >= 40) continue; const after = getComputedStyle(el, '::after'); if (after.content !== 'none' && after.position === 'absolute') continue; small.push(`${Math.round(r.width)}×${Math.round(r.height)} ${cls(el)} | ${(el.getAttribute('aria-label') || txt(el) || el.tagName).slice(0, 40)}`); if (small.length > 20) break; }

      const top = (m: Map<string, number>, n = 8) => Object.fromEntries(Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n));
      return {
        stimulus: { actionsAboveFold: actions.length, chromeActions, firstContentY, primaries, colouredText, colouredSurfaces, gradients, colouredIcons, colourSamples, textChars, words },
        head,
        h1: h1s ? { size: h1s.fontSize, weight: h1s.fontWeight, family: h1s.fontFamily.split(',')[0]!.replace(/"/g, ''), text: txt(h1!) } : null,
        headings: Object.fromEntries(h2),
        fontSizes: top(sizes, 12), fontWeights: top(weights, 6), icons: top(icons, 10), spacing: { distinct: gaps.size, top: top(gaps, 10) },
        surfaces: { bordered, ringed, shadowed, tinted, surface2: surface2Count, gradients, radii: top(radii, 6) },
        rows: { n: rows.length, median: rowMedian, min: rows[0] ?? null, max: rows[rows.length - 1] ?? null },
        motion: { animated: animated.slice(0, 10), transitions: top(transitions, 10) },
        overflow, clipped, small,
        cls: (window as unknown as { __cls?: number }).__cls ?? null,
      };
    },
    [root, phone] as const,
  );
}

async function axe(page: Page) {
  if (!AXE) return null;
  try {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(['region', 'landmark-one-main', 'page-has-heading-one']).analyze();
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} :: ${(n.html ?? '').slice(0, 80)}`) }));
  } catch (e) {
    return [{ id: 'axe-error', impact: null, n: 0, targets: [String(e).slice(0, 120)] }];
  }
}

type Facts = Record<string, unknown>;

async function capture(page: Page, vp: Vp, dir: string, name: string, facts: Facts, opts: { full?: boolean; axe?: boolean } = {}) {
  if (opts.full) await fullShot(page, vp, `${dir}/${name}.png`);
  else await page.screenshot({ path: `${dir}/${name}.png` });
  facts[name] = { ...(await measure(page, 'main', !!vp.mobile)), axe: opts.axe === false ? null : await axe(page) };
}

async function discoverViews(page: Page): Promise<{ label: string; sel: string }[]> {
  const main = page.locator('main');
  const out: { label: string; sel: string }[] = [];
  for (const sel of ['[role="tab"]', '[role="group"] > button[aria-pressed]']) {
    const loc = main.locator(sel);
    const n = Math.min(await loc.count(), 9);
    for (let i = 0; i < n; i++) {
      const info = await loc.nth(i).evaluate((e) => ({
        inRow: !!e.closest('li, [data-row], [data-testid^="widget-"], dialog, [role="dialog"]'),
        label: ((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').trim(),
        visible: (e as HTMLElement).offsetWidth > 0,
      })).catch(() => null);
      if (info && !info.inRow && info.visible && info.label) out.push({ label: info.label, sel });
    }
  }
  return out;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöü]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
const ADD = /hinzufügen|anlegen|^neu(e[rs]?)?( |$)|neuer? [a-zäöü]+|erfassen|scannen|^\+/i;

async function closeDialogs(page: Page) {
  for (let i = 0; i < 3; i++) {
    const dlg = page.locator('dialog[open], [role="dialog"]');
    if (!(await dlg.count()) || !(await dlg.first().isVisible().catch(() => false))) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const discard = page.getByRole('button', { name: /verwerfen/i });
    if (await discard.count()) await discard.first().click().catch(() => {});
    await page.waitForTimeout(250);
  }
}

/** Hover / focus / active samples on one list page (desktop): computed-style diffs and crops. */
async function states(page: Page, dir: string, facts: Facts) {
  await page.goto('/invoices');
  await settle(page);
  const row = page.locator('main [data-row]').first();
  if (!(await row.count())) return;
  const li = row.locator('xpath=ancestor::li[1]');
  const target = (await li.count()) ? li : row;
  const styleOf = () => target.evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, shadow: s.boxShadow, transform: s.transform, outline: s.outlineStyle + ' ' + s.outlineWidth, transition: s.transitionProperty + ' ' + s.transitionDuration }; });
  const rest = await styleOf();
  await target.screenshot({ path: `${dir}/state-row-rest.png` }).catch(() => {});
  await target.hover();
  await page.waitForTimeout(300);
  const hover = await styleOf();
  const hoverActions = await target.evaluate((el) => Array.from(el.querySelectorAll('button')).filter((b) => b.offsetWidth > 0 && getComputedStyle(b).opacity !== '0').map((b) => b.getAttribute('aria-label') || b.innerText.trim()).slice(0, 6));
  await target.screenshot({ path: `${dir}/state-row-hover.png` }).catch(() => {});
  await page.mouse.move(5, 5);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focusInfo = await page.evaluate(() => { const el = document.activeElement as HTMLElement | null; if (!el) return null; const s = getComputedStyle(el); return { tag: el.tagName, name: el.getAttribute('aria-label') || el.innerText?.trim().slice(0, 30), outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineOffset}`, focusVisible: el.matches(':focus-visible') }; });
  await page.screenshot({ path: `${dir}/state-focus.png` });
  const btn = page.locator('main button').filter({ hasText: /Rechnung hinzufügen/ }).first();
  let press: unknown = null;
  if (await btn.count()) {
    const box = await btn.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(80);
      press = await btn.evaluate((el) => { const s = getComputedStyle(el); return { transform: s.transform, bg: s.backgroundColor, transition: s.transitionProperty }; });
      await btn.screenshot({ path: `${dir}/state-button-active.png` }).catch(() => {});
      await page.mouse.up();
      await closeDialogs(page);
    }
  }
  const nav = page.locator('aside [aria-current="page"], nav [aria-current="page"]').first();
  if (await nav.count()) await nav.screenshot({ path: `${dir}/state-nav-active.png` }).catch(() => {});
  facts.states = { rest, hover, hoverActions, focusInfo, press };
}

async function tour(page: Page, vp: Vp, dir: string, seed: boolean) {
  const desktop = !vp.mobile;
  const facts: Facts = {};
  for (const m of MODULES) {
    if (m.desktop && !desktop) continue;
    await page.goto(m.path);
    await settle(page);
    const frame = page.getByTestId('module-frame');
    if (await frame.count()) await frame.first().screenshot({ path: `${dir}/head-${m.id}.png` }).catch(() => {});
    await capture(page, vp, dir, `page-${m.id}`, facts);
    await fullShot(page, vp, `${dir}/full-${m.id}.png`);
    for (const v of m.views ?? []) {
      await page.goto(v);
      await settle(page);
      const n = slug(v.replace(/^\/[a-z]+\/?\??/, '').replace(/&date=.*$/, '') || 'sub');
      await capture(page, vp, dir, `page-${m.id}--${n}`, facts, { axe: false });
    }
    await page.goto(m.path);
    await settle(page);
    const seen = new Set<string>();
    for (const v of await discoverViews(page)) {
      const key = slug(v.label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      let el = page.locator('main').locator(v.sel).filter({ hasText: v.label }).first();
      if (!(await el.isVisible().catch(() => false))) {
        await page.goto(m.path);
        await settle(page);
        el = page.locator('main').locator(v.sel).filter({ hasText: v.label }).first();
        if (!(await el.isVisible().catch(() => false))) continue;
      }
      await el.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(WAIT);
      await capture(page, vp, dir, `page-${m.id}--v-${key}`, facts, { axe: false });
    }
    // The module's add dialog.
    await page.goto(m.path);
    await settle(page);
    const names: string[] = await page.locator('main button, main a[href]').evaluateAll((els) => els.slice(0, 60).map((e) => (e.getAttribute('aria-label') || (e as HTMLElement).innerText || '').trim())).catch(() => []);
    let opened = false;
    for (let i = 0; i < names.length && !opened; i++) {
      const name = names[i]!;
      if (!ADD.test(name) || /importieren|einrichtung|kalender verwalten|nachkaufen|satz eintragen/i.test(name)) continue;
      const b = page.locator('main button, main a[href]').nth(i);
      if (!(await b.isVisible({ timeout: 1500 }).catch(() => false))) continue;
      await b.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(WAIT);
      const dlg = page.locator('dialog[open], [role="dialog"]').last();
      if ((await dlg.count()) && (await dlg.isVisible().catch(() => false))) {
        opened = true;
        await page.screenshot({ path: `${dir}/dialog-${m.id}.png` });
        facts[`dialog-${m.id}`] = { trigger: name, title: await dlg.locator('h2').first().innerText({ timeout: 2000 }).catch(() => null), box: await dlg.boundingBox(), fields: await dlg.locator('input:not([type=hidden]), select, textarea').count(), buttons: await dlg.locator('button').count(), ...(await measure(page, 'dialog', !!vp.mobile)) };
      }
      await closeDialogs(page);
      if (!opened && page.url().replace(/[?#].*$/, '') !== new URL(m.path, page.url()).pathname) { await page.goto(m.path); await settle(page); }
    }
    if (!opened) facts[`dialog-${m.id}`] = { trigger: null };
  }

  for (const a of AREAS) {
    await page.goto(a);
    await settle(page);
    facts[`area-${a.slice(1)}`] = { landsOn: new URL(page.url()).pathname };
  }
  for (const s of SHELL) {
    await page.goto(s.path);
    await settle(page);
    await capture(page, vp, dir, `page-${s.id}`, facts, { full: !!s.full });
  }

  // Quick capture ("+ Neu" / FAB).
  await page.goto('/todos');
  await settle(page);
  const btn = page.getByRole('button', { name: /Neu: schnell|Schnell hinzufügen/ }).first();
  if (await btn.count()) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: `${dir}/quick-capture.png` });
    facts['quick-capture'] = await measure(page, 'dialog', !!vp.mobile);
    await closeDialogs(page);
  }
  // Palette.
  await page.goto('/');
  await settle(page);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(WAIT);
  if (await page.locator('dialog[open], [role="dialog"]').count()) {
    await page.keyboard.type('Milch');
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: `${dir}/palette.png` });
    facts.palette = await measure(page, 'dialog', !!vp.mobile);
    await closeDialogs(page);
  }
  // Toolbox.
  await page.goto('/');
  await settle(page);
  const dialog = await openToolbox(page).catch(() => null);
  if (dialog) {
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: `${dir}/toolbox.png` });
    facts.toolbox = { ...(await measure(page, 'dialog', !!vp.mobile)), axe: await axe(page) };
    for (const tool of [/Rechner/, /QR/]) {
      const item = dialog.getByRole('button', { name: tool }).or(dialog.getByRole('link', { name: tool })).first();
      if (await item.count()) { await item.click().catch(() => {}); await page.waitForTimeout(WAIT); await dialog.screenshot({ path: `${dir}/toolbox-${slug(tool.source)}.png` }).catch(() => {}); }
    }
    await page.keyboard.press('Escape');
  }

  // Overview: calm and all; sidebar states (desktop).
  await page.goto('/');
  await settle(page, WAIT * 2);
  await capture(page, vp, dir, 'overview-calm', facts, { full: true });
  await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
  await page.goto('/');
  await settle(page, WAIT * 3);
  await capture(page, vp, dir, 'overview-all', facts, { full: true });
  const items = page.locator('[data-testid^="widget-"]');
  const widgetSizes: Record<string, { w: number; h: number }> = {};
  const wn = await items.count();
  for (let i = 0; i < wn; i++) {
    const el = items.nth(i);
    const tid = (await el.getAttribute('data-testid')) ?? '';
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (box) widgetSizes[tid] = { w: Math.round(box.width), h: Math.round(box.height) };
    await el.screenshot({ path: `${dir}/widget-${tid.replace('widget-', '').replace(':', '-')}.png` }).catch(() => {});
  }
  facts.widgetSizes = widgetSizes;
  await page.evaluate(() => localStorage.removeItem('tm-home-view'));
  if (desktop) {
    await page.goto('/');
    await settle(page);
    await page.getByTestId('sidebar').screenshot({ path: `${dir}/sidebar-open.png` }).catch(() => {});
    const fold = page.getByRole('button', { name: /^Einklappen$/ }).first();
    if (await fold.count()) { await fold.click().catch(() => {}); await page.waitForTimeout(WAIT); await page.screenshot({ path: `${dir}/overview-rail.png` }); await page.getByRole('button', { name: /^Ausklappen$/ }).first().click().catch(() => {}); }
    await states(page, dir, facts);
  } else {
    // Phone: the "Mehr" sheet and the bottom navigation.
    await page.goto('/');
    await settle(page);
    const more = page.getByRole('button', { name: /^Mehr$/ }).first();
    if (await more.count()) { await more.click().catch(() => {}); await page.waitForTimeout(WAIT); await page.screenshot({ path: `${dir}/more-sheet.png` }); await closeDialogs(page); }
  }

  // Setup assistant.
  await page.goto('/settings/einrichtung');
  await settle(page);
  const start = page.locator('main').getByRole('button', { name: /Einrichtung starten|Fortsetzen|Weiter einrichten|Nochmal ansehen|Durchsehen|ansehen/i }).first();
  if (await start.count()) {
    await start.click().catch(() => {});
    await page.waitForTimeout(WAIT);
    for (let step = 0; step < 14; step++) {
      await page.screenshot({ path: `${dir}/setup-${String(step).padStart(2, '0')}.png` });
      facts[`setup-${step}`] = { title: await page.locator('dialog[open] h1, dialog[open] h2, [role="dialog"] h1, [role="dialog"] h2, main h1').first().innerText().catch(() => null), ...(await measure(page, 'dialog', !!vp.mobile)) };
      const next = page.getByRole('button', { name: /^(Weiter|Überspringen|Fertig|Los geht’s|Los geht's)$/ }).first();
      if (!(await next.count()) || !(await next.isVisible().catch(() => false))) break;
      const label = await next.innerText();
      await next.click().catch(() => {});
      await page.waitForTimeout(WAIT);
      if (/Fertig/.test(label)) break;
    }
    await closeDialogs(page);
  }
  writeFileSync(`${dir}/facts-${seed ? 'seed' : 'empty'}.json`, JSON.stringify(facts, null, 2));
}

const RUNS = (process.env.UA_RUNS ?? 'd-dark,d-light,p-dark,p-light').split(',');
for (const run of RUNS) {
  const [k, scheme] = run.split('-') as ['d' | 'p', 'light' | 'dark'];
  const vp = k === 'd' ? DESKTOP : PHONE;
  test(`audit ${run}: seeded`, async ({ browser }) => {
    test.skip(!part('seed'));
    test.setTimeout(0);
    const dir = `${OUT}/${vp.name}-${scheme}/seed`;
    mkdirSync(dir, { recursive: true });
    const { context, page } = await newContext(browser, vp, scheme, true);
    await tour(page, vp, dir, true);
    await context.close();
  });
  test(`audit ${run}: empty`, async ({ browser }) => {
    test.skip(!part('empty'));
    test.setTimeout(0);
    const dir = `${OUT}/${vp.name}-${scheme}/empty`;
    mkdirSync(dir, { recursive: true });
    const { context, page } = await newContext(browser, vp, scheme, false);
    await tour(page, vp, dir, false);
    await context.close();
  });
}
