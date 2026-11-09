import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';
import { mockWeather } from '../weather-mock';

/**
 * UI audit 2026-11: click paths of the most common actions, counted on the real app (seeded Dev-Preview
 * on :4174). A step is a click/tap, a key (Enter, Tab, Escape, shortcuts – typed text is free), a screen
 * (route change) or a dialog/sheet that opens; `scroll` counts targets that were outside the viewport
 * when they were used. Every path starts on the overview, as a person would. Results:
 * `.screens/ui-audit/click-paths-<run>.json` and `.md`.
 * Usage (web/): UA_RUNS=d,p npx playwright test -c playwright.audit.config.ts click-paths.spec.ts
 */
const OUT = process.env.SCREENS_DIR ?? '.screens/ui-audit';
const WAIT = 450;

class Counter {
  clicks = 0;
  keys = 0;
  screens = 0;
  dialogs = 0;
  scrolls = 0;
  notes: string[] = [];
  private path = '';
  private open = 0;
  constructor(private page: Page, private vh: number) {}
  async start(path: string) {
    // Every path starts like a fresh visit: only the current area is open in the sidebar (F06), no hand choice kept.
    await this.page.evaluate(() => localStorage.removeItem('tm-nav-open')).catch(() => {});
    await this.page.goto(path);
    await settle(this.page);
    this.path = new URL(this.page.url()).pathname;
    this.open = await this.openDialogs();
  }
  private openDialogs() {
    return this.page.locator('dialog[open], [role="dialog"]').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetWidth > 0).length).catch(() => 0);
  }
  private async diff() {
    await this.page.waitForTimeout(WAIT);
    const p = new URL(this.page.url()).pathname;
    if (p !== this.path) { this.screens++; this.path = p; }
    const o = await this.openDialogs();
    if (o > this.open) this.dialogs += o - this.open;
    this.open = o;
  }
  async click(loc: Locator, what: string) {
    const el = loc.first();
    await expect(el, what).toBeVisible({ timeout: 8000 });
    const box = await el.boundingBox();
    if (box && (box.y + box.height > this.vh || box.y < 0)) { this.scrolls++; this.notes.push(`scroll for „${what}“`); }
    await el.click();
    this.clicks++;
    await this.diff();
  }
  async key(k: string) {
    await this.page.keyboard.press(k);
    this.keys++;
    await this.diff();
  }
  async type(text: string) {
    await this.page.keyboard.type(text);
  }
  async fill(loc: Locator, text: string, what: string) {
    const el = loc.first();
    await expect(el, what).toBeVisible({ timeout: 8000 });
    const focused = await el.evaluate((e) => e === document.activeElement);
    if (!focused) { await el.click(); this.clicks++; }
    await el.fill(text);
    await this.diff();
  }
  result() {
    return { clicks: this.clicks, keys: this.keys, screens: this.screens, dialogs: this.dialogs, scrolls: this.scrolls, total: this.clicks + this.keys, notes: this.notes };
  }
}

async function settle(page: Page, wait = 600) {
  await expect(page.locator('main')).toBeVisible();
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click().catch(() => {});
  await page.waitForTimeout(wait);
}

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

type Flow = (c: Counter, page: Page, phone: boolean) => Promise<void>;

/** Navigate to a module the way the shell offers it: favourite, sidebar (area + module) or bottom nav + tab. */
async function goModule(c: Counter, page: Page, phone: boolean, area: RegExp, module: string) {
  if (phone) {
    const nav = page.getByRole('navigation', { name: /Hauptnavigation/ }).or(page.locator('nav').last());
    const areaBtn = nav.getByRole('link', { name: area }).or(nav.getByRole('button', { name: area }));
    if (await areaBtn.count()) await c.click(areaBtn, `bottom nav ${area.source}`);
    else {
      await c.click(nav.getByRole('button', { name: /^Mehr$/ }), 'Mehr');
      await c.click(page.getByRole('link', { name: area }).or(page.getByRole('button', { name: area })), `sheet ${area.source}`);
    }
    const tab = page.locator('main, [data-testid="module-frame"]').getByRole('link', { name: new RegExp(`^${module}$`) }).first();
    if (await tab.isVisible().catch(() => false)) {
      const current = await tab.getAttribute('aria-current');
      if (current !== 'page') await c.click(tab, `tab ${module}`);
    }
    return;
  }
  const side = page.getByTestId('sidebar');
  const fav = side.getByRole('link', { name: new RegExp(`^${module}$`) });
  if (await fav.first().isVisible().catch(() => false)) { await c.click(fav, `favourite ${module}`); return; }
  const toggle = side.getByRole('button', { name: new RegExp(`${area.source} auf- oder zuklappen`) });
  const link = side.getByRole('link', { name: new RegExp(`^${module}$`) });
  if (!(await link.first().isVisible().catch(() => false))) await c.click(toggle, `area ${area.source}`);
  await c.click(link, `module ${module}`);
}

const quickAdd = (page: Page) => page.getByRole('button', { name: /schnell hinzufügen|^\+?\s*Neu$/i }).filter({ visible: true }).first();

const FLOWS: Record<string, Flow> = {
  'A1 ToDo eintragen – Schnellerfassung': async (c, page) => {
    await c.start('/');
    await c.click(quickAdd(page), '+ Neu');
    await c.type('Fenster putzen morgen');
    await c.key('Enter');
  },
  'A2 ToDo eintragen – im Modul': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Planen/, 'ToDos');
    const field = page.locator('main').getByRole('textbox').first();
    await c.fill(field, 'Fenster putzen', 'ToDo field');
    await c.key('Enter');
  },
  'A3 Ausgabe eintragen – Schnellerfassung': async (c, page) => {
    await c.start('/');
    await c.click(quickAdd(page), '+ Neu');
    await c.type('Tanken 62,40');
    await c.key('Enter');
  },
  'A4 Buchung eintragen – im Modul': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Geld/, 'Finanzen');
    await c.click(page.locator('main').getByRole('button', { name: /^Buchung hinzufügen$|^Buchung$/ }), 'Buchung hinzufügen');
    const dlg = page.locator('dialog[open], [role="dialog"]').last();
    const fields = dlg.locator('input:not([type=hidden]):not([type=checkbox])');
    await c.fill(fields.nth(0), 'Supermarkt', 'field 1');
    await c.key('Tab');
    await c.type('23,50');
    await c.click(dlg.getByRole('button', { name: /^Speichern$/ }), 'Speichern');
  },
  'A5 Einkauf eintragen – Listen': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Haushalt/, 'Listen');
    const field = page.locator('main').getByRole('textbox').first();
    await c.fill(field, 'Milch', 'list field');
    await c.key('Enter');
  },
  'A6 Vorrat eintragen – Dialog': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Haushalt/, 'Vorräte');
    await c.click(page.locator('main').getByRole('button', { name: /Vorrat hinzufügen/ }), 'Vorrat hinzufügen');
    const dlg = page.locator('dialog[open], [role="dialog"]').last();
    await c.fill(dlg.locator('input:not([type=hidden])').first(), 'Reis', 'name');
    await c.click(dlg.getByRole('button', { name: /^Speichern$/ }), 'Speichern');
  },
  'A7 Notiz anlegen': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Wissen/, 'Notizen');
    await c.click(page.locator('main').getByRole('button', { name: /^Neue Seite$/ }), 'Neue Seite');
    await c.type('Einkauf Wochenende');
    c.notes.push(`after: ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
  },
  'A8 Unterlage anlegen – Tresor': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Tresor/, 'Unterlagen');
    await c.click(page.locator('main').getByRole('button', { name: /Unterlage hinzufügen/ }), 'Unterlage hinzufügen');
    const dlg = page.locator('dialog[open], [role="dialog"]').last();
    await c.fill(dlg.locator('input:not([type=hidden])').first(), 'Mietvertrag', 'title');
    c.notes.push(`fields: ${await dlg.locator('input:not([type=hidden]), select, textarea').count()}`);
    await c.click(dlg.getByRole('button', { name: /^Speichern$/ }), 'Speichern');
  },
  'B1 Erledigen – ToDo in der Liste': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Planen/, 'ToDos');
    await c.click(page.locator('main').getByRole('checkbox').first(), 'tick');
  },
  'B2 Erledigen – Rechnung bezahlt': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Geld/, 'Rechnungen');
    await c.click(page.locator('main').getByRole('button', { name: /Als bezahlt markieren/ }), 'Als bezahlt');
  },
  'B3 Erledigen – aus der Übersicht': async (c, page) => {
    await c.start('/');
    await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
    await c.start('/');
    await c.click(page.locator('[data-testid^="widget-"]').getByRole('checkbox').first(), 'widget tick');
    await page.evaluate(() => localStorage.removeItem('tm-home-view'));
  },
  'C1 Suchen – Palette': async (c, page, phone) => {
    await c.start('/');
    if (phone) await c.click(page.getByRole('button', { name: /^Suchen/ }), 'search');
    else await c.key('Control+k');
    await c.type('Schmierzettel');
    await page.waitForTimeout(500);
    await c.key('ArrowDown');
    await c.key('Enter');
    c.notes.push(`lands on ${new URL(page.url()).pathname}`);
  },
  'C2 Notiz finden – im Modul': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Wissen/, 'Notizen');
    await c.click(page.locator('main').getByRole('button', { name: /Notizen durchsuchen/ }).or(page.locator('main').getByRole('searchbox')), 'search field');
    await c.type('Linsen');
    await page.waitForTimeout(500);
    await c.click(page.locator('main').getByText(/Linseneintopf/).first(), 'result');
  },
  'D1 Modul wechseln – Sidebar in anderen Bereich': async (c, page, phone) => {
    await c.start('/todos');
    await goModule(c, page, phone, /Geld/, 'Budgets');
  },
  'D2 Modul wechseln – im Bereich': async (c, page, phone) => {
    await c.start('/finance');
    const tab = page.locator('[data-testid="module-frame"], main').getByRole('link', { name: /^Budgets$/ }).first();
    if (await tab.isVisible().catch(() => false)) await c.click(tab, 'sub-nav Budgets');
    else await goModule(c, page, phone, /Geld/, 'Budgets');
  },
  'D3 Modul wechseln – Wissen (Handy: Mehr)': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Wissen/, 'Merkliste');
  },
  'E1 Einstellung ändern – Dunkel (Startseite)': async (c, page, phone) => {
    await c.start('/');
    if (phone) { await c.click(page.getByRole('button', { name: /^Mehr$/ }), 'Mehr'); await c.click(page.getByRole('link', { name: /^Einstellungen/ }), 'Einstellungen'); }
    else await c.click(page.getByTestId('sidebar').getByRole('link', { name: /^Einstellungen/ }), 'Einstellungen');
    await c.click(page.locator('main').getByRole('button', { name: /^Dunkel$/ }), 'Dunkel');
  },
  'E2 Einstellung ändern – Hell (Kategorie)': async (c, page) => {
    await c.start('/settings');
    await c.click(page.locator('main').getByRole('link', { name: /^Darstellung/ }), 'Darstellung');
    await c.click(page.locator('main').getByRole('button', { name: /^Hell$/ }), 'Hell');
  },
  'F1 Tag planen – Planer': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Planen/, 'Planer');
    const field = page.locator('main').getByRole('textbox').first();
    await c.fill(field, 'Steuer 30 Min', 'planner field');
    await c.key('Enter');
  },
  'F2 Tag planen – ToDo auf heute': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Planen/, 'ToDos');
    const direct = page.locator('main').getByRole('button', { name: /^Auf heute/ }).first();
    if (await direct.isVisible().catch(() => false)) await c.click(direct, 'Auf heute');
    else {
      // Phone: the row action lives in the ⋯ menu (round 6, U21).
      await c.click(page.locator('main').getByRole('button', { name: /Weitere Aktionen/ }), '⋯');
      await c.click(page.getByRole('menuitem', { name: /Auf heute/ }).or(page.getByRole('button', { name: /^Auf heute/ })), 'Auf heute');
    }
  },
  'G1 Rechnung anlegen': async (c, page, phone) => {
    await c.start('/');
    await goModule(c, page, phone, /Geld/, 'Rechnungen');
    await c.click(page.locator('main').getByRole('button', { name: /Rechnung hinzufügen/ }), 'Rechnung hinzufügen');
    const dlg = page.locator('dialog[open], [role="dialog"]').last();
    await c.fill(dlg.locator('input:not([type=hidden])').first(), 'Stadtwerke', 'payee');
    await c.key('Tab');
    await c.type('88,10');
    await c.click(dlg.getByRole('button', { name: /^Speichern$/ }), 'Speichern');
  },
  'H1 Backup herunterladen': async (c, page, phone) => {
    await c.start('/');
    if (phone) { await c.click(page.getByRole('button', { name: /^Mehr$/ }), 'Mehr'); await c.click(page.getByRole('link', { name: /^Einstellungen/ }), 'Einstellungen'); }
    else await c.click(page.getByTestId('sidebar').getByRole('link', { name: /^Einstellungen/ }), 'Einstellungen');
    await c.click(page.locator('main').getByRole('link', { name: /^Sync & Backup/ }), 'Sync & Backup');
    const dl = page.locator('main').getByRole('button', { name: /Backup herunterladen|Verschlüsselt exportieren/ });
    await c.click(dl, 'Backup');
    c.notes.push(`dialog buttons: ${await page.locator('dialog[open] button, [role="dialog"] button').allInnerTexts().then((t) => t.join('/')).catch(() => '-')}`);
  },
};

const RUNS = (process.env.UA_RUNS ?? 'd,p').split(',');
for (const run of RUNS) {
  const phone = run === 'p';
  test(`click paths ${phone ? 'phone' : 'desktop'}`, async ({ browser }) => {
    test.setTimeout(0);
    const vp = phone ? { width: 412, height: 915 } : { width: 1920, height: 1080 };
    const context = await browser.newContext({ viewport: vp, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await mockWeather(page);
    await page.addInitScript((d) => { localStorage.setItem('tm-show-preview', '1'); if (d) localStorage.setItem('__tmPlatformKind', 'desktop'); }, !phone);
    await bootDev(page);
    await seedApp(page, 'medium');
    const results: Record<string, unknown> = {};
    for (const [name, flow] of Object.entries(FLOWS)) {
      const c = new Counter(page, vp.height);
      try {
        await flow(c, page, phone);
        results[name] = c.result();
      } catch (e) {
        results[name] = { ...c.result(), error: String(e).split('\n')[0]!.slice(0, 160) };
      }
      await closeDialogs(page);
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/click-paths-${run}.json`, JSON.stringify(results, null, 2));
    const lines = ['| Handlung | Klicks | Tasten | Bildschirme | Dialoge | Scroll | Notiz |', '| --- | --- | --- | --- | --- | --- | --- |'];
    for (const [name, r] of Object.entries(results) as [string, ReturnType<Counter['result']> & { error?: string }][])
      lines.push(`| ${name} | ${r.clicks} | ${r.keys} | ${r.screens} | ${r.dialogs} | ${r.scrolls} | ${[...r.notes, r.error ? `FEHLER ${r.error}` : ''].filter(Boolean).join('; ')} |`);
    writeFileSync(`${OUT}/click-paths-${run}.md`, lines.join('\n') + '\n');
    await context.close();
  });
}
