import { mkdirSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { openToolbox } from '../helpers';
import { bootDev, SEED_TODAY, seedApp } from '../seed/helpers';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { mockWeather, pickWeatherPlace } from '../weather-mock';

/**
 * UI round 6 tour (docs/qa/round-6/FINDINGS.md): every module page and each of its views (tabs, segmented
 * switches, calendar views, finance tabs), the add dialog of every module, the "+ Neu" menu, overview (all
 * widgets, calm), library, tool panel, settings (every category + a module page), the setup assistant –
 * 1920 × 1080 and 412 × 915, light and dark, seeded and empty. Besides screenshots it measures per view:
 * overflow, clipped text, breaks inside words, filled primary actions, h2 variants, red text without an
 * overdue word, small touch targets (phone), layout shift after load, axe violations. Not part of CI.
 * Usage (web/, seeded preview on :4174): SCREENS_DIR=.screens/round6 R6_RUNS=d-dark,d-light,p-dark,p-light
 *   R6_PARTS=seed,empty npx playwright test -c playwright.round6.config.ts
 */
const OUT = process.env.SCREENS_DIR ?? '.screens/round6';
const WAIT = Number(process.env.SCREENS_WAIT ?? 700);
const ONLY = process.env.R6_PARTS?.split(',');
const part = (name: string) => !ONLY || ONLY.includes(name);
const AXE = process.env.R6_AXE !== '0';

interface Mod {
  id: string;
  path: string;
  desktop?: boolean;
  /** Explicit extra views (query strings) besides the ones discovered from tabs/segments. */
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
  {
    id: 'finance',
    path: '/finance?tab=overview',
    views: ['/finance?tab=transactions', '/finance?tab=accounts'],
  },
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
const SETTINGS = [
  'einrichtung',
  'allgemein',
  'darstellung',
  'barrierefreiheit',
  'module',
  'werkzeuge',
  'benachrichtigungen',
  'sicherheit',
  'sync',
  'ki',
  'verbindungen',
  'schnellerfassung',
  'updates',
  'entwickler',
  'ueber',
];
const SHELL: { id: string; path: string; full?: boolean }[] = [
  { id: 'library', path: '/library', full: true },
  { id: 'library-pantry', path: '/library/pantry' },
  { id: 'tools', path: '/tools', full: true },
  { id: 'settings', path: '/settings' },
  ...SETTINGS.map((s) => ({ id: `settings-${s}`, path: `/settings/${s}`, full: true })),
  { id: 'settings-module-pantry', path: '/settings/module/pantry', full: true },
  { id: 'settings-module-calendar', path: '/settings/module/calendar', full: true },
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
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'screens',
              deletedAt: null,
              _f: {},
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
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

interface Vp {
  name: string;
  width: number;
  height: number;
  mobile?: boolean;
}
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
  vp: Vp,
  scheme: 'light' | 'dark',
  seed: boolean,
  local: Record<string, string> = {},
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
  await page.addInitScript(
    ([isDesktop, extra]) => {
      localStorage.setItem('tm-show-preview', '1');
      if (isDesktop) localStorage.setItem('__tmPlatformKind', 'desktop');
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    },
    [desktop, local] as const,
  );
  await page.addInitScript(CLS_SCRIPT);
  await bootDev(page);
  if (seed) await seedApp(page, 'medium');
  else {
    await page.goto('/');
    await settle(page);
  }
  const all = MODULES.filter((m) => desktop || !m.desktop).map((m) => m.id);
  await enableModules(page, all);
  if (seed) {
    await pickWeatherPlace(page);
    await mockSpotify(page);
    await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
  }
  return { context, page };
}

/** Desktop: `main` scrolls, not the document; grow the viewport to the page for a full shot. */
async function fullShot(page: Page, vp: Vp, path: string) {
  if (vp.mobile) {
    await page.screenshot({ path, fullPage: true });
    return;
  }
  const height = await page.evaluate(() => {
    const main = document.getElementById('main');
    return main ? Math.min(main.scrollHeight + main.getBoundingClientRect().top, 5000) : innerHeight;
  });
  await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, Math.ceil(height)) });
  await page.waitForTimeout(250);
  await page.screenshot({ path });
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

/** All measurements of one view, computed in the page. `root` = 'main' or 'dialog'. */
async function measure(page: Page, root: 'main' | 'dialog', phone: boolean) {
  return page.evaluate(
    ([rootSel, isPhone]) => {
      const scope =
        rootSel === 'dialog'
          ? (document.querySelector<HTMLElement>('dialog[open], [role="dialog"]') ?? document.body)
          : (document.getElementById('main') ?? document.body);
      const doc = document.documentElement;
      const main = document.getElementById('main');
      const overflow = {
        doc: doc.scrollWidth - doc.clientWidth,
        main: main ? main.scrollWidth - main.clientWidth : 0,
      };
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
      };
      const txt = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
      const cls = (el: Element) => String(el.getAttribute('class') ?? '').split(' ')[0] ?? '';
      const all = Array.from(scope.querySelectorAll<HTMLElement>('*')).slice(0, 6000);

      // 1. clipped text (line clamp or ellipsis actually cutting).
      const clipped: string[] = [];
      for (const el of all) {
        const s = getComputedStyle(el);
        if (s.overflow === 'visible' && s.overflowX === 'visible') continue;
        const cut = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
        if (!cut || !el.textContent?.trim() || el.children.length > 3) continue;
        if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
        if (el.matches('input, textarea, select, pre, code, canvas, svg, [data-scroll], [role="listbox"]'))
          continue;
        // Scroll containers (lists, grids) are not clipped text.
        if (s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflowX === 'auto' || s.overflowX === 'scroll')
          continue;
        clipped.push(`${cls(el)} | ${txt(el)}`);
        if (clipped.length > 40) break;
      }

      // 2. breaks inside a word: a word whose glyphs sit on two lines.
      const wordBreaks: string[] = [];
      let checked = 0;
      for (const el of all) {
        if (checked > 500) break;
        if (el.children.length > 0 || !el.textContent || el.textContent.trim().length < 6) continue;
        if (!visible(el)) continue;
        const s = getComputedStyle(el);
        const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
        if (el.getBoundingClientRect().height < lh * 1.6) continue;
        if (el.matches('input, textarea, pre, code, kbd, svg *')) continue;
        checked++;
        const node = el.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.textContent ?? '';
        const re = /[A-Za-zÄÖÜäöüß0-9€.,%-]{5,}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          if (m[0].includes('-')) continue;
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
          if (rects.length > 1 && Math.abs(rects[0]!.top - rects[rects.length - 1]!.top) > lh * 0.5) {
            wordBreaks.push(`${cls(el)} | ${m[0]} | ${txt(el)}`);
            break;
          }
        }
        if (wordBreaks.length > 20) break;
      }

      // 3. filled primary actions.
      const primaries = all
        .filter((el) => el.matches('button, a') && /(^|_| )primary(_|$| )/.test(String(el.className)))
        .filter(visible)
        .map((el) => txt(el) || el.getAttribute('aria-label') || '?');

      // 4. heading variants (h2 inside the scope).
      const h2 = new Map<string, string[]>();
      for (const el of Array.from(scope.querySelectorAll<HTMLElement>('h2')).filter(visible)) {
        const s = getComputedStyle(el);
        const key = `${s.fontSize}/${s.fontWeight}/${s.fontFamily.split(',')[0]}`;
        (h2.get(key) ?? h2.set(key, []).get(key)!).push(txt(el));
      }

      // 5. red text without an overdue / exceeded / expired word.
      const danger = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
      const probe = document.createElement('span');
      probe.style.color = danger;
      document.body.appendChild(probe);
      const dangerRgb = getComputedStyle(probe).color;
      probe.remove();
      const okWords =
        /überfällig|abgelaufen|MHD war|war am|drüber|überschritten|Frist war|verpasst|Fehler|löschen|entfernen|verwerfen|abbrechen|stopp|−|-\d|ausgabe|minus|gesperrt|offline|kein|nicht|zu wenig|%|fällig/i;
      const reds: string[] = [];
      for (const el of all) {
        if (el.children.length > 2 || !el.textContent?.trim()) continue;
        if (!visible(el)) continue;
        const c = getComputedStyle(el).color;
        if (c !== dangerRgb) continue;
        const t = txt(el);
        const context = txt(el.closest('li, article, section, tr, p, div') ?? el);
        if (okWords.test(t) || okWords.test(context)) continue;
        reds.push(`${cls(el)} | ${t}`);
        if (reds.length > 20) break;
      }

      // 6. small touch targets (phone).
      const small: string[] = [];
      if (isPhone) {
        for (const el of all) {
          if (!el.matches('button, a[href], input:not([type=hidden]), [role="button"], [role="tab"], label'))
            continue;
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.height >= 40 && r.width >= 40) continue;
          const after = getComputedStyle(el, '::after');
          const hit = after.content !== 'none' && after.position === 'absolute';
          if (hit) continue;
          const name = el.getAttribute('aria-label') || txt(el) || el.tagName;
          small.push(`${Math.round(r.width)}×${Math.round(r.height)} ${cls(el)} | ${name.slice(0, 40)}`);
          if (small.length > 30) break;
        }
      }

      // 7. unequal heights among cards in one row of a grid/flex container.
      const rows: string[] = [];
      for (const el of all) {
        const s = getComputedStyle(el);
        if (s.display !== 'grid' && s.display !== 'flex') continue;
        if (s.display === 'flex' && s.flexWrap === 'nowrap') continue;
        const kids = Array.from(el.children).filter((k) => visible(k) && k.getBoundingClientRect().height > 60);
        if (kids.length < 2) continue;
        const byTop = new Map<number, Element[]>();
        for (const k of kids) {
          const t = Math.round(k.getBoundingClientRect().top / 4) * 4;
          (byTop.get(t) ?? byTop.set(t, []).get(t)!).push(k);
        }
        for (const [, group] of byTop) {
          if (group.length < 2) continue;
          const hs = group.map((k) => Math.round(k.getBoundingClientRect().height));
          if (Math.max(...hs) - Math.min(...hs) > 2)
            rows.push(`${cls(el)} | ${hs.join('/')} | ${group.map((k) => txt(k).slice(0, 18)).join(' ‖ ')}`);
        }
        if (rows.length > 12) break;
      }

      // 8. big numbers without a sibling context line (widget/head figures).
      const numbers: string[] = [];
      for (const el of all) {
        if (!visible(el) || el.children.length > 1) continue;
        const t = txt(el);
        if (!/^[-+]?\d[\d.,]*\s?[%€a-zA-Z]{0,4}$/.test(t)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 26) continue;
        const parent = el.parentElement;
        const around = txt(parent?.parentElement ?? parent ?? el).replace(t, '').trim();
        if (around.length < 3) numbers.push(`${cls(el)} | ${t}`);
      }

      // 9. 4-px grid: paddings/gaps that are not multiples of 4 (ignores 1/2 px and ≤ 2 px values).
      const grid = new Map<string, number>();
      for (const el of all.slice(0, 2500)) {
        if (!visible(el)) continue;
        const s = getComputedStyle(el);
        for (const p of ['paddingTop', 'paddingLeft', 'gap', 'rowGap', 'columnGap', 'marginBottom'] as const) {
          const v = parseFloat(s[p]);
          if (!v || v <= 2 || Math.abs(v / 4 - Math.round(v / 4)) < 0.01) continue;
          if (Math.abs(v / 2 - Math.round(v / 2)) < 0.01 && v <= 6) continue; // 6 px (--space-1.5) tolerated
          const key = `${cls(el)} ${p}=${v}`;
          grid.set(key, (grid.get(key) ?? 0) + 1);
        }
      }
      const offGrid = Array.from(grid.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([k, n]) => `${k} ×${n}`);

      return {
        overflow,
        clipped,
        wordBreaks,
        primaries,
        h2: Object.fromEntries(h2),
        reds,
        small,
        rows,
        numbers,
        offGrid,
        cls: (window as unknown as { __cls?: number }).__cls ?? null,
      };
    },
    [root, phone] as const,
  );
}

async function axe(page: Page) {
  if (!AXE) return null;
  try {
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['region', 'landmark-one-main', 'page-has-heading-one'])
      .analyze();
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      n: v.nodes.length,
      targets: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} :: ${(n.html ?? '').slice(0, 90)}`),
    }));
  } catch (e) {
    return [{ id: 'axe-error', impact: null, n: 0, targets: [String(e).slice(0, 120)] }];
  }
}

type Facts = Record<string, unknown>;

async function capture(page: Page, vp: Vp, dir: string, name: string, facts: Facts, opts: { full?: boolean } = {}) {
  if (opts.full) await fullShot(page, vp, `${dir}/${name}.png`);
  else await page.screenshot({ path: `${dir}/${name}.png` });
  const light = process.env.R6_AXE_LIGHT === '1' && name.includes('--v-');
  facts[name] = { ...(await measure(page, 'main', !!vp.mobile)), axe: light ? null : await axe(page) };
}

/** Views reachable from the toolbar: tabs and segmented switches inside main (not inside lists/rows). */
async function discoverViews(page: Page): Promise<{ label: string; sel: string }[]> {
  const main = page.locator('main');
  const out: { label: string; sel: string }[] = [];
  const sels = ['[role="tab"]', '[role="group"] > button[aria-pressed]'];
  for (const sel of sels) {
    const loc = main.locator(sel);
    const n = Math.min(await loc.count(), 9);
    for (let i = 0; i < n; i++) {
      const el = loc.nth(i);
      const info = await el
        .evaluate((e) => ({
          inRow: !!e.closest('li, [data-row], [data-testid^="widget-"], dialog, [role="dialog"]'),
          label: ((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').trim(),
          visible: (e as HTMLElement).offsetWidth > 0,
        }))
        .catch(() => null);
      if (info && !info.inRow && info.visible && info.label) out.push({ label: info.label, sel });
    }
  }
  return out;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9äöü]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

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
    // Explicit views by query string.
    for (const v of m.views ?? []) {
      await page.goto(v);
      await settle(page);
      const n = slug(v.replace(/^\/[a-z]+\/?\??/, '').replace(/&date=.*$/, '') || 'sub');
      await capture(page, vp, dir, `page-${m.id}--${n}`, facts);
      await fullShot(page, vp, `${dir}/full-${m.id}--${n}.png`);
    }
    // Views discovered from the toolbar (tabs, segmented), each clicked once.
    await page.goto(m.path);
    await settle(page);
    const views = await discoverViews(page);
    const seen = new Set<string>();
    for (const v of views) {
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
      await capture(page, vp, dir, `page-${m.id}--v-${key}`, facts);
    }
    // The module's add dialog: the first visible add button in main.
    await page.goto(m.path);
    await settle(page);
    const buttons = page.locator('main button, main a[href]');
    const n = Math.min(await buttons.count(), 60);
    let opened = false;
    for (let i = 0; i < n && !opened; i++) {
      const b = buttons.nth(i);
      const name = ((await b.getAttribute('aria-label')) || (await b.innerText().catch(() => ''))).trim();
      if (!ADD.test(name) || /importieren|einrichtung|kalender verwalten|nachkaufen/i.test(name)) continue;
      if (!(await b.isVisible().catch(() => false))) continue;
      await b.click().catch(() => {});
      await page.waitForTimeout(WAIT);
      const dlg = page.locator('dialog[open], [role="dialog"]').last();
      if ((await dlg.count()) && (await dlg.isVisible().catch(() => false))) {
        opened = true;
        await page.screenshot({ path: `${dir}/dialog-${m.id}.png` });
        await dlg.screenshot({ path: `${dir}/dialog-${m.id}-box.png` }).catch(() => {});
        facts[`dialog-${m.id}`] = {
          trigger: name,
          title: await dlg.locator('h2').first().innerText().catch(() => null),
          box: await dlg.boundingBox(),
          ...(await measure(page, 'dialog', !!vp.mobile)),
          axe: await axe(page),
        };
      }
      await closeDialogs(page);
    }
    if (!opened) facts[`dialog-${m.id}`] = { trigger: null };
  }

  for (const s of SHELL) {
    await page.goto(s.path);
    await settle(page);
    await capture(page, vp, dir, `page-${s.id}`, facts, { full: !!s.full });
  }

  // "+ Neu" (top bar / FAB) menu.
  await page.goto('/todos');
  await settle(page);
  const create = page.locator('header button, [data-testid="fab"], button').filter({ hasText: /^\+?\s*Neu$/ }).first();
  const createAlt = page.getByRole('button', { name: /^(\+ )?Neu$|Schnell hinzufügen|Neu anlegen/ }).first();
  const btn = (await create.count()) ? create : createAlt;
  if (await btn.count()) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: `${dir}/create-menu.png` });
    facts['create-menu'] = await measure(page, 'dialog', !!vp.mobile);
    await closeDialogs(page);
    await page.keyboard.press('Escape');
  }

  // Toolbox panel.
  await page.goto('/');
  await settle(page);
  const dialog = await openToolbox(page).catch(() => null);
  if (dialog) {
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: `${dir}/toolbox.png` });
    await dialog.screenshot({ path: `${dir}/toolbox-panel.png` }).catch(() => {});
    facts.toolbox = { ...(await measure(page, 'dialog', !!vp.mobile)), axe: await axe(page) };
    // Two tools opened in the panel.
    for (const tool of [/Rechner/, /QR/]) {
      const item = dialog.getByRole('button', { name: tool }).or(dialog.getByRole('link', { name: tool })).first();
      if (await item.count()) {
        await item.click().catch(() => {});
        await page.waitForTimeout(WAIT);
        await dialog.screenshot({ path: `${dir}/toolbox-${slug(tool.source)}.png` }).catch(() => {});
      }
    }
    await page.keyboard.press('Escape');
  }

  // Overview: calm (default) and every widget.
  await page.goto('/');
  await settle(page, WAIT * 2);
  await capture(page, vp, dir, 'overview-calm', facts, { full: true });
  await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
  await page.goto('/');
  await settle(page, WAIT * 3);
  await capture(page, vp, dir, 'overview-all', facts, { full: true });
  const items = page.locator('[data-testid^="widget-"]');
  const wn = await items.count();
  const widgetSizes: Record<string, { w: number; h: number }> = {};
  for (let i = 0; i < wn; i++) {
    const el = items.nth(i);
    const tid = (await el.getAttribute('data-testid')) ?? '';
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    if (box) widgetSizes[tid] = { w: Math.round(box.width), h: Math.round(box.height) };
    await el
      .screenshot({ path: `${dir}/widget-${tid.replace('widget-', '').replace(':', '-')}.png` })
      .catch(() => {});
  }
  facts.widgetSizes = widgetSizes;
  await page.evaluate(() => localStorage.removeItem('tm-home-view'));

  // Setup assistant from Einstellungen → Einrichtung.
  await page.goto('/settings/einrichtung');
  await settle(page);
  const start = page
    .locator('main')
    .getByRole('button', { name: /Einrichtung starten|Fortsetzen|Weiter einrichten|Nochmal ansehen|Durchsehen|ansehen/i })
    .first();
  if (await start.count()) {
    await start.click().catch(() => {});
    await page.waitForTimeout(WAIT);
    for (let step = 0; step < 14; step++) {
      await page.screenshot({ path: `${dir}/setup-${String(step).padStart(2, '0')}.png` });
      facts[`setup-${step}`] = {
        title: await page.locator('dialog[open] h1, dialog[open] h2, [role="dialog"] h1, [role="dialog"] h2, main h1').first().innerText().catch(() => null),
        ...(await measure(page, 'dialog', !!vp.mobile)),
      };
      const next = page.getByRole('button', { name: /^(Weiter|Überspringen|Fertig|Los geht’s|Los geht's)$/ }).first();
      if (!(await next.count()) || !(await next.isVisible().catch(() => false))) break;
      const label = await next.innerText();
      await next.click().catch(() => {});
      await page.waitForTimeout(WAIT);
      if (/Fertig/.test(label)) {
        await page.screenshot({ path: `${dir}/setup-${String(step + 1).padStart(2, '0')}-done.png` });
        break;
      }
    }
    await closeDialogs(page);
  }

  // Keyboard vs mouse focus ring (desktop, one check).
  if (desktop) {
    await page.goto('/todos');
    await settle(page);
    const b = page.locator('main button').filter({ hasText: /Heute|Alle/ }).first();
    if (await b.count()) {
      await b.click();
      const mouseRing = await page.evaluate(() => document.activeElement?.matches(':focus-visible') ?? null);
      await page.keyboard.press('Tab');
      const keyRing = await page.evaluate(() => document.activeElement?.matches(':focus-visible') ?? null);
      facts.focusRing = { mouseRing, keyRing };
      await page.screenshot({ path: `${dir}/focus-ring-keyboard.png` });
    }
  }

  writeFileSync(`${dir}/facts-${seed ? 'seed' : 'empty'}.json`, JSON.stringify(facts, null, 2));
}

const RUNS = (process.env.R6_RUNS ?? 'd-dark,d-light,p-dark,p-light').split(',');

for (const run of RUNS) {
  const [k, scheme] = run.split('-') as ['d' | 'p', 'light' | 'dark'];
  const vp = k === 'd' ? DESKTOP : PHONE;

  test(`round6 ${run}: seeded`, async ({ browser }) => {
    test.skip(!part('seed'));
    test.setTimeout(0);
    const dir = `${OUT}/${vp.name}-${scheme}/seed`;
    mkdirSync(dir, { recursive: true });
    const { context, page } = await newContext(browser, vp, scheme, true);
    await tour(page, vp, dir, true);
    await context.close();
  });

  test(`round6 ${run}: empty`, async ({ browser }) => {
    test.skip(!part('empty'));
    test.setTimeout(0);
    const dir = `${OUT}/${vp.name}-${scheme}/empty`;
    mkdirSync(dir, { recursive: true });
    const { context, page } = await newContext(browser, vp, scheme, false);
    await tour(page, vp, dir, false);
    await context.close();
  });
}
