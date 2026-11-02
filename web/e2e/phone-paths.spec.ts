import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { dismissNotices, enable, moduleSwitch, ready } from './helpers';

/**
 * The ten everyday paths on the phone (one hand), with a step count per path. The ten paths run on the phone
 * (project `pixel-7`); the Back cases run on the phone and on the desktop. A step is one touch (tap, swipe) or one input (typing into a field, Enter);
 * waiting and looking are free. The table lands in the test report (attachment `phone-paths`) and
 * in `test-results/phone-paths.md`. `MAX` is the number of steps before the one-hand package
 * (counted on `develop`): no path may take more. The Back gesture and the keyboard have a case each.
 */

const OUT = 'test-results/phone-paths';
/** Steps on `develop` before this package. */
const MAX: Record<string, number> = {
  '1 ToDo anlegen': 3,
  '2 Später': 1,
  '3 Termin heute ansehen': 0,
  '4 Erinnerung erledigen': 3,
  '5 Notiz anlegen': 3,
  '6 Einkauf abhaken': 1,
  '7 Vorrat niedrig': 1,
  '8 Tresor-Eintrag kopieren': 2,
  '9 Einstellung ändern': 5,
  '10 Suche': 3,
};

class Steps {
  n = 0;
  constructor(private page: Page) {}
  async tap(target: Locator) {
    this.n += 1;
    await target.tap();
  }
  async type(target: Locator, text: string) {
    this.n += 1;
    await target.fill(text);
  }
  async enter(target: Locator) {
    this.n += 1;
    await target.press('Enter');
  }
  /** A real touch swipe (CDP), so the pointer events carry `pointerType: touch`. */
  async swipeLeft(target: Locator) {
    this.n += 1;
    const box = (await target.boundingBox())!;
    const y = box.y + box.height / 2;
    const from = box.x + box.width * 0.8;
    const cdp = await this.page.context().newCDPSession(this.page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });
    await touch('touchStart', from);
    for (let i = 1; i <= 6; i += 1) await touch('touchMove', from - i * 25);
    await touch('touchEnd', 0);
  }
}

function writeTable() {
  const rows: Array<{ name: string; steps: number }> = readdirSync(OUT)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
  const table = [
    '| Path | Steps before | Steps now |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.name} | ${MAX[r.name]} | ${r.steps} |`),
  ].join('\n');
  writeFileSync('test-results/phone-paths.md', `${table}\n`);
}

async function record(info: TestInfo, name: string, steps: number) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/${name.split(' ')[0]!.padStart(2, '0')}.json`,
    JSON.stringify({ name, steps }),
  );
  writeTable();
  await info.attach('phone-paths', { path: 'test-results/phone-paths.md' });
  expect(steps, `${name}: steps before = ${MAX[name]}`).toBeLessThanOrEqual(MAX[name]!);
  info.annotations.push({ type: 'steps', description: `${name}: ${steps} (before ${MAX[name]})` });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addTodoPlain(page: Page, title: string) {
  await ready(page, '/todos');
  await page.getByLabel('ToDo hinzufügen').fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click(); // enabled once the lists are loaded
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

test.describe('ten paths', () => {
  test.skip(({ isMobile }) => !isMobile, 'step counts are measured on the phone');

  test('1 ToDo anlegen', async ({ page }, info) => {
    await ready(page, '/todos');
    const s = new Steps(page);
    const field = page.getByLabel('ToDo hinzufügen');
    await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeEnabled();
    await s.tap(field);
    await s.type(field, 'Wäsche falten');
    await s.enter(field);
    await expect(page.getByRole('checkbox', { name: 'Wäsche falten' })).toBeVisible();
    // The next entry follows right away: the field keeps the focus and is empty.
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('');
    await record(info, '1 ToDo anlegen', s.n);
  });

  test('2 Später', async ({ page }, info) => {
    await addTodoPlain(page, 'Fenster putzen');
    const s = new Steps(page);
    await s.swipeLeft(page.getByRole('listitem').filter({ hasText: 'Fenster putzen' }).first());
    await expect(page.getByText('Auf morgen verschoben.')).toBeVisible();
    await record(info, '2 Später', s.n);
  });

  test('3 Termin heute ansehen', async ({ page }, info) => {
    await ready(page, '/calendar?new=1');
    await page.getByLabel('Titel').fill('Zahnarzt');
    await page.getByLabel('Beginn').fill('11:30');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await ready(page, '/');
    const s = new Steps(page);
    // The home screen already shows it ("Jetzt wichtig"): nothing to tap.
    await expect(page.getByRole('region', { name: 'Jetzt wichtig' })).toContainText('Zahnarzt');
    await record(info, '3 Termin heute ansehen', s.n);
  });

  test('4 Erinnerung erledigen', async ({ page }, info) => {
    await page.clock.install({ time: new Date('2026-09-29T19:59:00') });
    await page.goto('/calendar?tab=reminders&new=1');
    const dialog = page.getByRole('dialog', { name: 'Erinnerung hinzufügen' });
    await dialog.getByLabel('Titel').fill('Tabletten nehmen');
    await dialog.getByLabel('Datum').fill('2026-09-29');
    await dialog.getByLabel('Beginn').fill('20:00');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.clock.fastForward(90_000);
    const s = new Steps(page);
    await s.tap(page.getByTestId('notification-bell'));
    const panel = page.getByRole('dialog', { name: 'Erinnerungen' });
    await s.tap(panel.getByRole('button', { name: 'Nächste Erinnerung' }));
    await s.tap(panel.getByTestId('center-card').getByRole('button', { name: 'Erledigt' }));
    await expect(panel.getByText('Keine offenen Erinnerungen.')).toBeVisible();
    await record(info, '4 Erinnerung erledigen', s.n);
  });

  test('5 Notiz anlegen', async ({ page }, info) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    const s = new Steps(page);
    await s.tap(page.getByRole('button', { name: 'Neue Seite' }));
    await s.type(page.getByRole('textbox', { name: 'Text der Seite' }), 'Paket abholen');
    // Autosave: no save button. On a phone the list is behind the page, so go back to it.
    const back = page.getByRole('button', { name: 'Zurück zur Liste' });
    if (await back.isVisible()) await back.tap();
    await expect(
      page.getByRole('navigation', { name: 'Seiten' }).getByText('Paket abholen').first(),
    ).toBeVisible();
    await record(info, '5 Notiz anlegen', s.n);
  });

  test('6 Einkauf abhaken', async ({ page }, info) => {
    await enable(page, 'lists');
    await ready(page, '/lists');
    const input = page.getByLabel('Eintrag hinzufügen');
    await input.fill('Milch');
    await input.press('Enter');
    const box = page.getByRole('checkbox', { name: 'Milch' });
    await expect(box).toBeVisible();
    const s = new Steps(page);
    await s.tap(box);
    await expect(box).toBeChecked();
    await record(info, '6 Einkauf abhaken', s.n);
  });

  test('7 Vorrat niedrig', async ({ page }, info) => {
    await enable(page, 'pantry');
    await enable(page, 'lists');
    await page.goto('/pantry');
    await page.getByRole('button', { name: 'Vorrat hinzufügen' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Vorrat hinzufügen' });
    await dialog.getByLabel('Name', { exact: true }).fill('Milch');
    await dialog.getByLabel('Vorrat (Anzahl)').fill('1');
    const more = dialog.getByRole('button', { name: 'Mehr Felder anzeigen' });
    if (await more.count()) await more.click();
    await dialog.getByLabel('Nachkaufen ab (Anzahl, optional)').fill('2');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const s = new Steps(page);
    await s.tap(page.getByRole('button', { name: 'Auf die Einkaufsliste' }));
    await expect(page.getByText('„Milch“ an die Einkaufsliste gesendet.')).toBeVisible();
    await record(info, '7 Vorrat niedrig', s.n);
  });

  test('8 Tresor-Eintrag kopieren', async ({ page, context }, info) => {
    test.setTimeout(90_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await dismissNotices(page);
    await page.goto('/library');
    await moduleSwitch(page.getByTestId('module-accounts')).click();
    await expect(
      page.getByTestId('module-accounts').getByText('Aktiv', { exact: true }),
    ).toBeVisible();
    await page.goto('/accounts');
    await page.getByLabel('Master-Passwort', { exact: true }).fill('Mein-Master-Passwort-1');
    await page.getByLabel('Master-Passwort wiederholen').fill('Mein-Master-Passwort-1');
    await page.getByRole('button', { name: 'Tresor erstellen' }).click();
    await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Zugang hinzufügen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Zugang hinzufügen' });
    await dialog.getByLabel('Name', { exact: true }).fill('Beispiel-Shop');
    await dialog.getByLabel('Benutzername').fill('alice');
    await dialog.getByLabel('Passwort', { exact: true }).fill('geheim-4711'); // gitleaks:allow (test fixture)
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    // The new entry opens its detail by itself; close it to start from the list.
    await page
      .getByRole('dialog', { name: 'Beispiel-Shop' })
      .getByRole('button', { name: 'Schließen' })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const s = new Steps(page);
    await s.tap(page.getByRole('button', { name: /Beispiel-Shop/ }).first());
    await s.tap(page.getByRole('button', { name: 'Passwort kopieren' }));
    await expect(page.getByText(/Passwort kopiert/)).toBeVisible();
    await record(info, '8 Tresor-Eintrag kopieren', s.n);
  });

  test('9 Einstellung ändern', async ({ page }, info) => {
    await ready(page, '/');
    const s = new Steps(page);
    await s.tap(
      page
        .getByRole('navigation', { name: 'Hauptnavigation' })
        .getByRole('button', { name: 'Mehr' }),
    );
    await s.tap(
      page.getByRole('dialog', { name: 'Mehr' }).getByRole('link', { name: 'Einstellungen' }),
    );
    await s.tap(
      page
        .getByRole('navigation', { name: 'Einstellungs-Kategorien' })
        .getByRole('link', { name: /Darstellung/ }),
    );
    await expect(page).toHaveURL(/\/settings\/darstellung$/);
    const group = page.getByTestId('appearance-group-theme');
    await s.tap(group.locator('summary'));
    await s.tap(page.locator('#appearance--theme').getByRole('button', { name: 'Dunkel' }));
    await expect(group.locator('summary')).toContainText('Thema: Dunkel');
    await record(info, '9 Einstellung ändern', s.n);
  });

  test('10 Suche', async ({ page }, info) => {
    await addTodoPlain(page, 'Zahnbürste kaufen');
    await ready(page, '/');
    const s = new Steps(page);
    await s.tap(page.getByRole('button', { name: 'Suchen' }).first());
    await s.type(page.getByRole('combobox'), 'Zahnbürste');
    await s.tap(page.getByRole('option', { name: /Zahnbürste kaufen/ }).first());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await record(info, '10 Suche', s.n);
  });
});

test.describe('Back gesture', () => {
  test('Back closes a dialog first, then the page goes back as before', async ({ page }) => {
    await ready(page, '/');
    await ready(page, '/todos');
    await page.getByRole('button', { name: 'Suchen' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/todos$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Back closes a row menu, not the page', async ({ page }) => {
    await addTodoPlain(page, 'Fenster putzen');
    const row = page.getByRole('listitem').filter({ hasText: 'Fenster putzen' }).first();
    await row
      .getByRole('button', { name: /Optionen|Menü|Weitere/ })
      .first()
      .click();
    await expect(page.getByRole('menu').first()).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page).toHaveURL(/\/todos$/);
  });

  test('a draft asks before it is thrown away; Back at the question keeps editing', async ({
    page,
  }) => {
    await ready(page, '/dev/components');
    await page.getByRole('button', { name: 'Dialog öffnen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neuer Eintrag' });
    await dialog.getByLabel('Name').fill('Anna');
    await page.goBack();
    await expect(dialog.getByText('Entwurf verwerfen?')).toBeVisible();
    await page.goBack();
    await expect(dialog.getByText('Entwurf verwerfen?')).toHaveCount(0);
    await expect(dialog.getByLabel('Name')).toHaveValue('Anna');
    // The entry was put back: the next Back asks again, and the page was never left.
    await page.goBack();
    await expect(dialog.getByText('Entwurf verwerfen?')).toBeVisible();
    await expect(page).toHaveURL(/\/dev\/components$/);
  });

  test('a note page: Back never asks, typed text is already saved', async ({ page }) => {
    // Notes are a page with autosave now, not a dialog: there is nothing to discard.
    await enable(page, 'notes');
    await ready(page, '/notes');
    await page.getByRole('button', { name: 'Neue Seite' }).click();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await ready(page, '/notes');
    await page.getByRole('button', { name: 'Neue Seite' }).click();
    const editor = page.getByRole('textbox', { name: 'Text der Seite' });
    await editor.click();
    await page.keyboard.type('Halber Gedanke');
    // Autosave runs a moment after typing; Back never has to ask because nothing is pending.
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await ready(page, '/notes');
    const list = page.getByRole('navigation', { name: 'Seiten' });
    await expect(list.getByText('Halber Gedanke').first()).toBeVisible();
  });

  test('the "Mehr" sheet: opening a page from it, one Back returns to where it was', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'pixel-7', 'the "Mehr" sheet is the phone navigation');
    await ready(page, '/todos');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('button', { name: 'Mehr' })
      .click();
    await page
      .getByRole('dialog', { name: 'Mehr' })
      .getByRole('link', { name: 'Einstellungen' })
      .click();
    await expect(page).toHaveURL(/\/settings/);
    await page.goBack();
    await expect(page).toHaveURL(/\/todos$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Keyboard', () => {
  test.skip(({ isMobile }) => !isMobile, 'the on-screen keyboard is a phone matter');

  test('the add field stays above a keyboard that only shrinks the visual viewport, and keeps the focus', async ({
    page,
  }) => {
    await ready(page, '/todos');
    const field = page.getByLabel('ToDo hinzufügen');
    await field.click();
    // Emulate a browser that does not resize the page for the keyboard: only visualViewport shrinks.
    await page.evaluate(() => {
      const vv = window.visualViewport!;
      const real = { height: vv.height };
      Object.defineProperty(vv, 'height', { get: () => real.height - 320, configurable: true });
      vv.dispatchEvent(new Event('resize'));
    });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.style.getPropertyValue('--kb-inset')),
      )
      .toBe('320px');
    // Not under the keyboard: the field's bottom edge is inside the visible part.
    const box = (await field.boundingBox())!;
    const visibleBottom = await page.evaluate(() => window.innerHeight - 320);
    expect(box.y + box.height).toBeLessThanOrEqual(visibleBottom);
    await field.fill('Müll rausbringen');
    await field.press('Enter');
    await expect(page.getByRole('checkbox', { name: 'Müll rausbringen' })).toBeVisible();
    await expect(field).toBeFocused();
  });
});
