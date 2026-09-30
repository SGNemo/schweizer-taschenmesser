import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Layout screenshots with invented demo data. Not part of CI (see playwright.screens.config.ts).
 * Output directory: SCREENS_DIR (default test-results/screens/current).
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/current';
const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '3440x1440', width: 3440, height: 1440 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '412x915', width: 412, height: 915, mobile: true },
];
/** Optional filters for quick iterations, e.g. SCREENS_VIEWPORTS=1920x1080 SCREENS_PAGES=calendar. */
const ONLY_VIEWPORTS = process.env.SCREENS_VIEWPORTS?.split(',');
const ONLY_PAGES = process.env.SCREENS_PAGES ? new RegExp(process.env.SCREENS_PAGES) : undefined;
const MODULES = [
  'calendar',
  'todos',
  'reminders',
  'finance',
  'invoices',
  'subscriptions',
  'bookmarks',
  'notes',
  'shopping',
  'birthdays',
  'habits',
  'contracts',
  'budgets',
  'packing',
  'vault',
  'accounts',
];
const MASTER = 'Demo-Master-Passwort-1'; // gitleaks:allow (invented demo value)

const PAGES: { name: string; path: string }[] = [
  { name: 'dashboard', path: '/' },
  { name: 'calendar-month', path: '/calendar?view=month&date=2026-09-29' },
  { name: 'calendar-week', path: '/calendar?view=week&date=2026-09-29' },
  { name: 'calendar-day', path: '/calendar?view=day&date=2026-09-29' },
  { name: 'todos', path: '/todos' },
  { name: 'reminders', path: '/reminders' },
  { name: 'finance-overview', path: '/finance?tab=overview' },
  { name: 'finance-transactions', path: '/finance?tab=transactions' },
  { name: 'invoices', path: '/invoices' },
  { name: 'subscriptions', path: '/subscriptions' },
  { name: 'bookmarks', path: '/bookmarks' },
  { name: 'notes', path: '/notes' },
  { name: 'shopping', path: '/shopping' },
  { name: 'birthdays', path: '/birthdays' },
  { name: 'habits', path: '/habits' },
  { name: 'contracts', path: '/contracts' },
  { name: 'budgets', path: '/budgets' },
  { name: 'packing', path: '/packing' },
  { name: 'vault', path: '/vault' },
  { name: 'library', path: '/library' },
  { name: 'settings', path: '/settings' },
];

async function seed(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    async ({ modules }) => {
      const env = (data: Record<string, unknown>, id: string) => ({
        ...data,
        id,
        createdAt: 1,
        updatedAt: 1,
        deviceId: 'screens',
        deletedAt: null,
        _f: {},
      });
      const ev = (id: string, title: string, d: string, t?: string, e?: string) => ({
        id,
        title,
        allDay: !t,
        startDate: d,
        startTime: t,
        endTime: e,
      });
      const many = (prefix: string, n: number, fn: (i: number) => Record<string, unknown>) =>
        Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, ...fn(i) }));
      const tables: Record<string, Record<string, unknown>[]> = {
        _modules: modules.map((id) => ({ id, enabled: true, dataPolicy: null })),
        calendar_event: [
          ev('e1', 'Zahnarzt Dr. Muster', '2026-09-29', '14:00', '15:00'),
          ev('e2', 'Team-Meeting', '2026-09-29', '09:30', '10:30'),
          ev('e3', 'Mittagessen mit Anna', '2026-09-29', '12:00', '13:00'),
          ev('e4', 'Yoga', '2026-09-29', '18:00', '19:00'),
          ev('e5', 'Wochenplanung', '2026-09-28', '08:30', '09:00'),
          ev('e6', 'Lesekreis', '2026-09-30', '19:30', '21:00'),
          ev('e7', 'Handwerker Beispielstadt', '2026-10-01', '08:00', '12:00'),
          ev('e8', 'Geburtstag Onkel Max', '2026-10-03'),
          ev('e9', 'Elternabend', '2026-10-06', '19:00', '20:30'),
          ev('e10', 'Fahrradinspektion', '2026-10-08', '16:00', '17:00'),
          ev('e11', 'Konzert Demo-Band', '2026-10-10', '20:00', '23:00'),
          ev('e12', 'Umzugskartons packen', '2026-09-12'),
          ev('e13', 'Steuerberater', '2026-09-15', '10:00', '11:00'),
          ev('e14', 'Sprachkurs', '2026-09-17', '18:30', '20:00'),
          ev('e15', 'Sprachkurs', '2026-09-24', '18:30', '20:00'),
        ],
        todos_list: [
          { id: 'inbox', name: 'Eingang', order: 0 },
          { id: 'home', name: 'Haushalt', order: 1 },
          { id: 'work', name: 'Arbeit', order: 2 },
        ],
        todos_task: [
          ...['Milch kaufen', 'Paket abholen', 'Geschenk für Anna', 'Bibliothek: Buch zurück'].map(
            (title, i) => ({
              id: `t${i}`,
              listId: 'inbox',
              title,
              done: i === 3,
              priority: i % 4,
              order: i,
              dueDate: i < 3 ? '2026-10-0' + (i + 1) : undefined,
            }),
          ),
          { id: 'h1', listId: 'home', title: 'Fenster putzen', done: false, priority: 1, order: 0 },
          {
            id: 'w1',
            listId: 'work',
            title: 'Bericht Q3 fertigstellen',
            done: false,
            priority: 3,
            order: 0,
            dueDate: '2026-10-02',
          },
        ],
        reminders_reminder: many('r', 6, (i) => ({
          title: [
            'Medikamente',
            'Müll rausstellen',
            'Pflanzen gießen',
            'Oma anrufen',
            'Auto-TÜV',
            'Backup prüfen',
          ][i],
          startDate: '2026-09-29',
          time: `${String(7 + i).padStart(2, '0')}:30`,
          active: i !== 4,
          recurrence: i % 2 === 0 ? { freq: 'daily', interval: 1 } : undefined,
        })),
        finance_account: [
          { id: 'acc-main', name: 'Girokonto Demo', openingBalanceMinor: 250000, order: 0 },
          { id: 'acc-save', name: 'Sparkonto Demo', openingBalanceMinor: 1200000, order: 1 },
        ],
        finance_transaction: [
          {
            id: 'inc0',
            accountId: 'acc-main',
            kind: 'income',
            amountMinor: 320000,
            date: '2026-09-01',
            payee: 'Arbeitgeber Muster GmbH',
          },
          ...many('x', 14, (i) => ({
            accountId: 'acc-main',
            kind: 'expense',
            amountMinor: 1500 + i * 2300,
            date: `2026-09-${String(2 + i).padStart(2, '0')}`,
            payee: [
              'Supermarkt',
              'Bäckerei',
              'Tankstelle',
              'Kino',
              'Drogerie',
              'Restaurant',
              'Bahn',
            ][i % 7],
            categoryId: ['cat-food', 'cat-home', 'cat-mobility', 'cat-leisure'][i % 4],
          })),
        ],
        invoices_invoice: [
          {
            id: 'i1',
            payee: 'Stadtwerke Musterstadt',
            amountMinor: 8990,
            dueDate: '2026-10-05',
            status: 'open',
          },
          {
            id: 'i2',
            payee: 'Internet Beispiel AG',
            amountMinor: 3999,
            dueDate: '2026-09-25',
            status: 'open',
          },
          {
            id: 'i3',
            payee: 'Versicherung Demo',
            amountMinor: 12500,
            dueDate: '2026-10-15',
            status: 'open',
          },
          {
            id: 'i4',
            payee: 'Telefon Muster',
            amountMinor: 2500,
            dueDate: '2026-09-10',
            status: 'paid',
            paidAt: '2026-09-11',
          },
        ],
        subscriptions_subscription: [
          ['Streaming Demo', 1299],
          ['Musik Beispiel', 999],
          ['Cloud-Speicher', 299],
          ['Zeitung Muster', 2490],
          ['Fitnessstudio Demo', 3490],
        ].map(([name, amountMinor], i) => ({
          id: `s${i}`,
          name,
          amountMinor,
          startDate: '2026-09-15',
          recurrence: { freq: 'monthly', interval: 1 },
          active: i !== 3,
        })),
        bookmarks_item: many('b', 6, (i) => ({
          title: [
            'Rezept: Kürbissuppe',
            'Wanderweg Beispieltal',
            'Buch: Demo-Roman',
            'Film: Muster',
            'Café Beispiel',
            'Idee: Balkon-Garten',
          ][i],
          kind: ['read', 'place', 'read', 'watch', 'place', 'idea'][i],
          tags: i % 2 ? ['freizeit'] : ['küche', 'herbst'],
          done: false,
        })),
        notes_note: many('n', 5, (i) => ({
          title: ['Wochenplan', 'Geschenkideen', 'Reise-Ideen', 'Einkaufstour', 'Zitate'][i],
          body: 'Erfundener Beispieltext für die Vorschau. Zeile zwei.\nZeile drei.',
          pinned: i === 0,
        })),
        shopping_item: many('sh', 8, (i) => ({
          name: ['Milch', 'Brot', 'Äpfel', 'Nudeln', 'Tomaten', 'Käse', 'Kaffee', 'Seife'][i],
          quantity: i % 2 ? '2' : undefined,
          done: i > 5,
        })),
        birthdays_birthday: many('bd', 5, (i) => ({
          name: ['Anna Beispiel', 'Onkel Max', 'Lea Muster', 'Tom Demo', 'Oma Erika'][i],
          month: [10, 10, 11, 12, 1][i],
          day: [3, 21, 5, 14, 30][i],
          year: 1950 + i * 9,
        })),
        habits_habit: many('hb', 4, (i) => ({
          name: ['Wasser trinken', 'Spazieren', 'Lesen', 'Dehnen'][i],
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          archived: false,
        })),
        contracts_contract: many('c', 4, (i) => ({
          name: ['Handyvertrag Demo', 'Hausrat Muster', 'Waschmaschine Beispiel', 'Strom Demo'][i],
          kind: ['contract', 'insurance', 'warranty', 'contract'][i],
          provider: 'Anbieter Muster',
          endDate: ['2027-03-01', '2026-11-15', '2027-06-30', '2026-12-31'][i],
          noticeDays: 30,
        })),
        budgets_budget: [
          { id: 'bu1', categoryId: 'cat-food', monthlyLimitMinor: 40000 },
          { id: 'bu2', categoryId: 'cat-leisure', monthlyLimitMinor: 15000 },
        ],
        budgets_goal: [
          { id: 'g1', name: 'Urlaub Beispielküste', targetMinor: 200000, deadline: '2027-06-01' },
        ],
        packing_list: [{ id: 'p1', name: 'Wochenende Demo-Berge' }],
        packing_item: many('pi', 6, (i) => ({
          listId: 'p1',
          name: ['Zahnbürste', 'Jacke', 'Wanderschuhe', 'Ladekabel', 'Sonnencreme', 'Buch'][i],
          packed: i < 2,
          order: i,
        })),
      };
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = Object.keys(tables).filter((n) => db.objectStoreNames.contains(n));
          const tx = db.transaction(names, 'readwrite');
          for (const name of names)
            for (const { id, ...rest } of tables[name]!)
              tx.objectStore(name).put(env(rest, id as string));
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { modules: MODULES },
  );
}

/** Creates a vault with two invented entries through the UI (the data is encrypted at rest). */
async function seedVault(page: Page) {
  await page.goto('/accounts');
  await page.getByLabel('Master-Passwort', { exact: true }).fill(MASTER);
  await page.getByLabel('Master-Passwort wiederholen').fill(MASTER);
  await page.getByRole('button', { name: 'Tresor erstellen' }).click();
  await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
    timeout: 30_000,
  });
  for (const [title, user] of [
    ['Demo-Shop example.org', 'demo.user'],
    ['Demo-Forum example.org', 'forum.demo'],
  ] as const) {
    await page.getByRole('button', { name: 'Zugang hinzufügen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Zugang hinzufügen' });
    await dialog.getByLabel('Name', { exact: true }).fill(title);
    await dialog.getByLabel('Benutzername').fill(user);
    await dialog.getByLabel('Passwort', { exact: true }).fill('demo-passwort-000'); // gitleaks:allow
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog', { name: 'Zugang hinzufügen' })).toHaveCount(0);
    // Saving selects the new entry: as a dialog on narrow screens, in the side panel on wide ones.
    await page.waitForTimeout(400);
    const detail = page.getByRole('dialog', { name: title });
    if (await detail.count()) {
      await detail.getByRole('button', { name: 'Schließen' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  }
}

test('capture layout screenshots', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  for (const vp of VIEWPORTS.filter((v) => !ONLY_VIEWPORTS || ONLY_VIEWPORTS.includes(v.name))) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile ?? false,
      hasTouch: vp.mobile ?? false,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
    await seed(page);
    await seedVault(page);
    for (const p of PAGES.filter((x) => !ONLY_PAGES || ONLY_PAGES.test(x.name))) {
      await page.goto(p.path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${vp.name}--${p.name}.png` });
    }
    if (ONLY_PAGES && !ONLY_PAGES.test('accounts')) {
      await context.close();
      continue;
    }
    // Unlocked vault list (the session key is in memory only, so use client-side navigation).
    await page.goto('/accounts');
    await page.waitForTimeout(300);
    await page.getByLabel('Master-Passwort').fill(MASTER);
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: `${OUT}/${vp.name}--accounts.png` });
    await context.close();
  }
});
