import { expect, test, type Locator, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function enable(page: Page, id: string) {
  await page.goto('/library');
  const card = page.getByTestId(`module-${id}`);
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
}

/** Controlled checkboxes update after the (async) database write, so click first and then wait for the state. */
async function tick(box: Locator) {
  await box.click();
  await expect(box).toBeChecked();
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

/** Clicks "Speichern" and waits until the dialog is gone, i.e. the write has finished. */
async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('the extra modules are off until enabled', async ({ page }) => {
  await open(page, '/library');
  for (const id of [
    'bookmarks',
    'notes',
    'shopping',
    'birthdays',
    'habits',
    'contracts',
    'budgets',
    'packing',
    'vault',
  ]) {
    await expect(
      page.getByTestId(`module-${id}`).getByRole('button', { name: 'Aktivieren' }),
    ).toBeVisible();
  }
  await page.goto('/bookmarks');
  await expect(page).toHaveURL(/\/library|\/$/); // disabled module: redirected away
});

test.describe('Merkliste', () => {
  test('tags, filters and status', async ({ page }) => {
    await enable(page, 'bookmarks');
    const add = async (title: string, url: string, tags: string, kind: string) => {
      await open(page, '/bookmarks?new=1');
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Titel').fill(title);
      if (url) await dialog.getByLabel('Adresse (Link)').fill(url);
      await dialog.getByLabel('Art').selectOption({ label: kind });
      await dialog.getByLabel('Tags').fill(tags);
      await save(page);
    };
    await add('Pasta Rezept', 'koch.de/pasta', 'Kochen, Rezept', 'Lesen');
    await add('Dune', '', 'Film', 'Ansehen');

    const list = page.getByRole('list', { name: 'Merkliste' });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list.getByRole('link', { name: /Pasta Rezept/ })).toHaveAttribute(
      'href',
      'https://koch.de/pasta',
    );

    await page.getByRole('button', { name: 'Kochen (1)' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(list).toContainText('Pasta Rezept');
    await page.getByRole('button', { name: 'Kochen (1)' }).click();

    await page.getByLabel('Merkliste durchsuchen').fill('dune');
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await page.getByLabel('Merkliste durchsuchen').fill('');

    await page.getByRole('checkbox', { name: /Erledigt: Dune/ }).click(); // leaves the "Offen" view
    await expect(list.getByRole('listitem')).toHaveCount(1); // "Offen" view hides it
    await page.getByRole('button', { name: 'Erledigt', exact: true }).click();
    await expect(list).toContainText('Dune');
  });

  test('a link shared from another app opens the create dialog prefilled', async ({ page }) => {
    await enable(page, 'bookmarks');
    await page.goto(
      '/bookmarks?title=Schöner%20Wanderweg&text=Schau%20mal%20https%3A%2F%2Fwandern.example%2Fweg',
    );
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Titel')).toHaveValue('Schöner Wanderweg');
    await expect(dialog.getByLabel('Adresse (Link)')).toHaveValue('https://wandern.example/weg');
  });
});

test('Notizen: create, pin, search', async ({ page }) => {
  await enable(page, 'notes');
  const add = async (title: string, body: string, pin = false) => {
    await open(page, '/notes?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill(title);
    await dialog.getByLabel('Text').fill(body);
    if (pin) await dialog.getByRole('switch', { name: /anheften/ }).click();
    await save(page);
  };
  await add('Einkaufsideen', 'Käse und Brot');
  await add('WLAN', 'Passwort steht im Router', true);
  const items = page.getByRole('list', { name: 'Notizen' }).getByRole('listitem');
  await expect(items.first()).toContainText('WLAN'); // pinned first
  await page.getByLabel('Notizen durchsuchen').fill('kase');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Einkaufsideen');
});

test('Einkaufsliste: quantities, ticking, clearing bought items', async ({ page }) => {
  await enable(page, 'shopping');
  await open(page, '/shopping');
  const input = page.getByLabel('Artikel hinzufügen');
  await input.fill('2 Milch');
  await input.press('Enter');
  await input.fill('Brot');
  await input.press('Enter');
  await input.fill('brot'); // duplicate of an open item is ignored
  await input.press('Enter');
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await expect(page.getByText('2 · Milch')).toBeVisible();

  await tick(page.getByRole('checkbox', { name: /Milch/ }));
  await page.getByRole('button', { name: 'Gekauftes entfernen (1)' }).click();
  await expect(page.getByText('1 Artikel entfernt.')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
});

test('Geburtstage: next date, age, calendar and dashboard widget', async ({ page }) => {
  await enable(page, 'birthdays');
  await open(page, '/birthdays?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Anna');
  await dialog.getByLabel('Geburtsdatum').fill('1990-10-03');
  await save(page);
  const row = page.getByRole('button', { name: /Anna/ });
  await expect(row).toContainText('wird 36');
  await expect(row).toContainText('in 4 Tagen');

  await open(page, '/calendar?view=week&date=2026-10-03');
  await expect(page.getByRole('button', { name: /Anna wird 36/ })).toBeVisible();

  await open(page, '/');
  await expect(page.getByTestId('widget-birthdays:next')).toContainText('Anna');
});

test('Habit-Tracker: tick today, streak', async ({ page }) => {
  await enable(page, 'habits');
  await open(page, '/habits?new=1');
  await page.getByRole('dialog').getByLabel('Name').fill('Lesen');
  await save(page);
  await expect(page.getByTestId('streak-Lesen')).toContainText('0 Tage in Folge');
  await tick(page.getByRole('checkbox', { name: 'Lesen' }));
  await expect(page.getByTestId('streak-Lesen')).toContainText('1 Tag in Folge');
  // Yesterday via the week strip → 2 days in a row.
  await page.getByRole('button', { name: /Lesen, Montag, 28. September/ }).click();
  await expect(page.getByTestId('streak-Lesen')).toContainText('2 Tage in Folge');
  await page.reload();
  await expect(page.getByTestId('streak-Lesen')).toContainText('2 Tage in Folge');
});

test('Verträge: cancellation deadline is flagged and on the calendar', async ({ page }) => {
  await enable(page, 'contracts');
  await open(page, '/contracts?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bezeichnung').fill('Handyvertrag');
  await dialog.getByLabel('Ende / Ablauf').fill('2026-12-31');
  await dialog.getByLabel(/Kündigungsfrist/).fill('90');
  await save(page);
  const row = page.getByRole('button', { name: /Handyvertrag/ });
  await expect(row).toContainText('Kündigen bis');
  await expect(page.getByText('Jetzt kündigen')).toBeVisible();

  await open(page, '/calendar?view=week&date=2026-10-02');
  await expect(page.getByRole('button', { name: /Kündigungsfrist: Handyvertrag/ })).toBeVisible();
});

test.describe('Budgets & Sparziele', () => {
  test('needs the finance module', async ({ page }) => {
    await enable(page, 'budgets');
    // finance is enabled by default; disable it
    await page.goto('/library');
    const card = page.getByTestId('module-finance');
    await card.getByRole('button', { name: 'Deaktivieren' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /behalten/i })
      .click();
    await expect(card.getByRole('button', { name: 'Aktivieren' })).toBeVisible();
    await open(page, '/budgets');
    await expect(page.getByText('Budgets brauchen das Modul „Finanzen“.')).toBeVisible();
  });

  test('a budget follows the spending of its finance category', async ({ page }) => {
    await enable(page, 'budgets');
    await open(page, '/finance?new=1');
    const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
    await dialog.getByRole('button', { name: 'Ausgabe', exact: true }).click();
    await dialog.getByLabel('Betrag').fill('60,00');
    await dialog.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
    await save(page);

    await open(page, '/budgets');
    await page.getByRole('button', { name: 'Budget hinzufügen' }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
    await editor.getByLabel('Limit pro Monat').fill('50');
    await save(page);
    const card = page.getByRole('listitem').filter({ hasText: 'Lebensmittel' });
    await expect(card).toContainText('60,00');
    await expect(card).toContainText('10,00');
    await expect(card).toContainText('drüber');
    await expect(card).toContainText('120 %');
  });

  test('savings goal with deposits', async ({ page }) => {
    await enable(page, 'budgets');
    await open(page, '/budgets?tab=goals&new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Wofür sparst du?').fill('Urlaub');
    await dialog.getByLabel('Zielbetrag').fill('1000');
    await dialog.getByLabel('Bis (optional)').fill('2026-12-29');
    await save(page);

    await page.getByRole('button', { name: 'Einzahlen' }).click();
    await page.getByRole('dialog').getByLabel('Betrag').fill('250');
    await save(page);
    const card = page.getByRole('listitem').filter({ hasText: 'Urlaub' });
    await expect(card).toContainText('250,00');
    await expect(card).toContainText('750,00'); // still missing
    await expect(card).toContainText('250,00 € pro Monat');
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');

    await page.getByRole('button', { name: 'Verlauf' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Löschen/ })
      .click();
    await page.keyboard.press('Escape');
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });
});

test('Packlisten: pack, reset, copy as template', async ({ page }) => {
  await enable(page, 'packing');
  await open(page, '/packing?new=1');
  await page.getByRole('dialog').getByLabel('Name der Liste').fill('Urlaub');
  await save(page);
  const input = page.getByLabel('Gegenstand hinzufügen');
  for (const item of ['Zahnbürste', 'Ladekabel']) {
    await input.fill(item);
    await input.press('Enter');
  }
  await expect(page.getByTestId('packing-progress')).toContainText('0 von 2 gepackt');
  await tick(page.getByRole('checkbox', { name: 'Zahnbürste' }));
  await expect(page.getByTestId('packing-progress')).toContainText('1 von 2 gepackt');
  await tick(page.getByRole('checkbox', { name: 'Ladekabel' }));
  await expect(page.getByTestId('packing-progress')).toContainText('Alles gepackt!');

  await page.getByRole('button', { name: 'Als Vorlage kopieren' }).click();
  await expect(page.getByRole('heading', { name: 'Kopie von Urlaub' })).toBeVisible();
  await expect(page.getByTestId('packing-progress')).toContainText('0 von 2 gepackt');

  await page.getByRole('button', { name: 'Urlaub', exact: true }).click();
  await page.getByRole('button', { name: 'Alles auspacken' }).click();
  await expect(page.getByTestId('packing-progress')).toContainText('0 von 2 gepackt');
});

test('Dokumente: metadata, local file and expiry', async ({ page }) => {
  await enable(page, 'vault');
  await open(page, '/vault?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill('Reisepass');
  await dialog.getByLabel('Kategorie').selectOption({ label: 'Ausweise' });
  await dialog.getByLabel('Läuft ab am').fill('2026-10-20');
  await dialog.getByLabel('Datei').setInputFiles({
    name: 'pass.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('mein pass'),
  });
  await save(page);

  const row = page.getByRole('button', { name: /^Reisepass/ });
  await expect(row).toContainText('pass.txt');
  await expect(page.getByText('Läuft bald ab')).toBeVisible();

  // The file survives a reload and can be downloaded with its content.
  await page.reload();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Herunterladen: Reisepass' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('pass.txt');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).toString()).toBe('mein pass');

  await open(page, '/calendar?view=week&date=2026-10-20');
  await expect(page.getByRole('button', { name: /Läuft ab: Reisepass/ })).toBeVisible();
});
