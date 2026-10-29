import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function ready(page: Page, url = '/') {
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

const wizard = (page: Page) => page.getByRole('dialog', { name: 'Einrichtung' });

/** Reads the stored setup state straight from IndexedDB (device-local `_meta`). */
async function setupState(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('_meta').objectStore('_meta').get('setup.state');
          req.onsuccess = () => {
            open.result.close();
            resolve(req.result?.value);
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

async function dbName(page: Page) {
  const names = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  return names.find((n) => n?.toLowerCase().includes('taschenmesser')) ?? 'taschenmesser';
}

/**
 * Closing the wizard pops its history entry with `history.back()` (see `useBackClose`), which is
 * asynchronous. A `goto` right after the dialog disappears can collide with it (ERR_ABORTED, or the
 * back navigation lands on the new page). Wait until the overlay entry is gone.
 */
async function overlayGone(page: Page) {
  await expect(wizard(page)).toHaveCount(0);
  await page.waitForFunction(() => !(history.state as { tmOverlay?: boolean } | null)?.tmOverlay);
}

/** A fresh installation opens the three questions; the full list is one click away. */
async function startFull(page: Page) {
  await page.getByRole('button', { name: 'Einrichtung starten' }).click();
  await wizard(page).getByRole('button', { name: 'Alle Schritte ansehen' }).click();
  await expect(wizard(page).getByText(/^Schritt 1 von \d+$/)).toBeVisible();
}

const later = (page: Page) => wizard(page).getByRole('button', { name: 'Später', exact: true });

async function skipEverything(page: Page) {
  const dialog = wizard(page);
  const summary = dialog.getByTestId('setup-summary');
  const skip = dialog.getByRole('button', { name: 'Später', exact: true });
  const title = dialog.locator('h3').first();
  for (let i = 0; i < 40; i++) {
    await expect(title).toBeVisible();
    if (await summary.isVisible()) return;
    const label = await title.textContent();
    await skip.click();
    // The skip button of the old step stays clickable until the save finished and the wizard
    // moved on; only a changed heading (or the summary) proves the step really changed.
    await expect(title).not.toHaveText(label ?? '');
  }
}

test('a really empty app offers the setup discreetly; "Später" ends the offer for good', async ({
  page,
}) => {
  await ready(page);
  const card = page.getByTestId('setup-welcome');
  await expect(card).toBeVisible();
  await expect(wizard(page)).toHaveCount(0); // an offer, never a forced full screen
  await card.getByRole('button', { name: 'Später' }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(async () => (await setupState(page))?.status).toBe('dismissed');
  await page.reload();
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByTestId('setup-welcome')).toHaveCount(0);
});

test('an existing installation never shows the assistant by itself, but it starts from the settings', async ({
  page,
}) => {
  await ready(page, '/todos');
  // Give the app some data, then let the start migration run again as if this were an update.
  // On a fresh database the inbox list is created right after the page shows; until then the
  // add button is disabled and Enter is a silent no-op, so wait for it before typing.
  await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill('Erfundene Aufgabe');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Erfundene Aufgabe')).toBeVisible();
  const name = await dbName(page);
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(n);
        open.onsuccess = () => {
          const tx = open.result.transaction('_meta', 'readwrite');
          tx.objectStore('_meta').delete('setup.state');
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    name,
  );
  await page.reload();
  await expect(page.locator('main h1')).toBeVisible();
  await expect.poll(async () => (await setupState(page))?.status).toBe('dismissed');
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByTestId('setup-welcome')).toHaveCount(0);
  await expect(page.getByTestId('setup-checklist')).toHaveCount(0);
  await expect(wizard(page)).toHaveCount(0);

  await page.goto('/settings/ueber');
  await page.getByRole('button', { name: 'Einrichtung starten' }).click();
  await expect(wizard(page)).toBeVisible();
  // The existing data is untouched by merely looking.
  await wizard(page).getByRole('button', { name: 'Schließen' }).first().click();
  await wizard(page).getByRole('button', { name: 'Einrichtung beenden' }).click();
  await overlayGone(page);
  await page.goto('/todos');
  await expect(page.getByText('Erfundene Aufgabe')).toBeVisible();
});

test('full run: every step can be skipped, the summary lists them, "Fertig" completes', async ({
  page,
}) => {
  await ready(page, '/settings/ueber');
  await startFull(page);
  const dialog = wizard(page);
  await expect(dialog.getByRole('progressbar')).toBeVisible();
  await skipEverything(page);
  await expect(dialog.getByTestId('setup-summary')).toBeVisible();
  await expect(dialog.getByText('Später', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Fertig' }).click();
  await expect(wizard(page)).toHaveCount(0);
  await expect.poll(async () => (await setupState(page))?.status).toBe('completed');
});

test('cancelling keeps finished steps, drops the current one and resumes after a reload', async ({
  page,
}) => {
  await ready(page, '/settings/ueber');
  await startFull(page);
  const dialog = wizard(page);
  await dialog.getByLabel('Dein Name (optional)').fill('Erika Erfunden');
  await dialog.getByRole('button', { name: 'Weiter' }).click();
  await expect(dialog.getByText('Schritt 2 von')).toBeVisible();

  // Esc asks first; a second Esc goes back to the step.
  await page.keyboard.press('Escape');
  await expect(dialog.getByTestId('setup-confirm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByText('Schritt 2 von')).toBeVisible();

  await dialog.getByRole('button', { name: 'Schließen' }).first().click();
  await dialog.getByRole('button', { name: 'Später fortsetzen' }).click();
  await expect(wizard(page)).toHaveCount(0);
  await expect.poll(async () => (await setupState(page))?.doneSteps).toEqual(['core.basics']);

  await page.reload();
  await expect(page.locator('main h1')).toBeVisible();
  // Nothing opens by itself after a restart …
  await expect(wizard(page)).toHaveCount(0);
  // … the progress is offered on the next manual start.
  await page.getByRole('button', { name: 'Einrichtung fortsetzen' }).first().click();
  await expect(wizard(page).getByRole('button', { name: /Fortsetzen bei/ })).toBeVisible();
  await wizard(page)
    .getByRole('button', { name: /Fortsetzen bei/ })
    .click();
  await expect(wizard(page).getByText('Schritt 2 von')).toBeVisible();
});

test('the Android back gesture asks before leaving the assistant', async ({ page }) => {
  await ready(page, '/settings/ueber');
  await page.getByRole('button', { name: 'Einrichtung starten' }).click();
  await expect(wizard(page).getByText('Frage 1 von 3')).toBeVisible();
  await page.goBack();
  await expect(wizard(page).getByTestId('setup-confirm')).toBeVisible();
  await wizard(page).getByRole('button', { name: 'Weiter einrichten' }).click();
  await expect(wizard(page).getByText('Frage 1 von 3')).toBeVisible();
});

test('starts from the command palette; ending leaves a checklist on the dashboard', async ({
  page,
}) => {
  await ready(page);
  await page.getByTestId('setup-welcome').getByRole('button', { name: 'Später' }).click();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('Einrichtung');
  await page.keyboard.press('Enter');
  await expect(wizard(page)).toBeVisible();
  await wizard(page).getByLabel('Dein Name (optional)').fill('Erika');
  await wizard(page).getByRole('button', { name: 'Weiter' }).click();
  // Closing while "Weiter" still saves would be undone when the wizard moves on to step 2.
  await expect(wizard(page).getByText('Schritt 2 von')).toBeVisible();
  await wizard(page).getByRole('button', { name: 'Schließen' }).first().click();
  await wizard(page).getByRole('button', { name: 'Einrichtung beenden' }).click();
  await expect(wizard(page)).toHaveCount(0);

  const checklist = page.getByTestId('setup-checklist');
  await expect(checklist).toBeVisible();
  await expect(checklist.getByText(/1 von \d+ Schritten erledigt/)).toBeVisible();
  await checklist.getByRole('button', { name: /Sync und Wiederherstellung: Öffnen/ }).click();
  await expect(
    wizard(page).getByRole('heading', { name: 'Sync und Wiederherstellung' }),
  ).toBeVisible();
  await wizard(page).getByRole('button', { name: 'Schließen' }).first().click();
  await wizard(page).getByRole('button', { name: 'Später fortsetzen' }).click();

  // Hide, and bring it back from the settings.
  await checklist.getByRole('button', { name: 'Ausblenden' }).click();
  await expect(checklist).toHaveCount(0);
  await page.goto('/settings/ueber');
  const show = page.getByRole('switch', { name: 'Checkliste auf der Übersicht anzeigen' });
  await show.click();
  await expect(show).toBeChecked(); // the write is done once the switch reflects it
  await page.goto('/');
  await expect(page.getByTestId('setup-checklist')).toBeVisible();
});

test('a profile shows its diff and needs a confirmation before it switches modules off', async ({
  page,
}) => {
  await ready(page, '/settings/ueber');
  await startFull(page);
  const dialog = wizard(page);
  await later(page).click(); // basics
  // Wait for the next step: the old step's skip button is clickable until the wizard moved on.
  await expect(dialog.getByRole('heading', { name: 'Sync und Wiederherstellung' })).toBeVisible();
  await later(page).click(); // sync
  await expect(dialog.getByRole('heading', { name: 'Profil und Module' })).toBeVisible();
  await dialog.getByTestId('profile-minimal').click();
  await expect(dialog.getByTestId('profile-diff')).toContainText('Wird deaktiviert');
  await expect(dialog.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  // The reason sits next to the button, not far below the fold.
  await expect(dialog.getByRole('status').filter({ hasText: 'Hake bei' })).toBeVisible();
  await dialog.getByLabel('Ich habe die Änderungen geprüft und möchte sie übernehmen.').check();
  await expect(dialog.getByRole('button', { name: 'Weiter' })).toBeEnabled();
});

test('an empty module page links to the assistant, which opens on the start-data step', async ({
  page,
}) => {
  await ready(page, '/todos');
  await expect(wizard(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Einrichtung öffnen' }).click();
  await expect(wizard(page)).toBeVisible();
  await expect(wizard(page).getByRole('heading', { name: 'Importieren' })).toBeVisible();
});

/** Everything that leaves the page (not the app's own origin, not data:/blob:). */
function watchNetwork(page: Page) {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!/^(data:|blob:|http:\/\/localhost:4173)/.test(url)) external.push(url);
  });
  return external;
}

test('first run: three questions, five taps, nothing leaves the page, the rest waits in the checklist', async ({
  page,
}) => {
  const external = watchNetwork(page);
  await ready(page);
  let taps = 0;
  const tap = async (loc: ReturnType<Page['locator']>) => {
    await loc.click();
    taps++;
  };
  await tap(page.getByTestId('setup-welcome').getByRole('button', { name: 'Einrichtung starten' }));
  const dialog = wizard(page);
  await expect(dialog.getByText('Frage 1 von 3')).toBeVisible();
  await dialog.getByLabel('Dein Name (optional)').fill('Erika Erfunden');
  await tap(dialog.getByRole('button', { name: 'Weiter' }));

  await expect(dialog.getByText('Frage 2 von 3')).toBeVisible();
  // Each card says what it switches off; the choice is shown as chosen.
  await expect(dialog.getByTestId('profile-everyday').locator('xpath=ancestor::li')).toContainText(
    'Schaltet ab:',
  );
  await tap(dialog.getByTestId('profile-everyday'));
  await expect(dialog.getByTestId('profile-everyday')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Weiter' })).toBeEnabled();
  await tap(dialog.getByRole('button', { name: 'Weiter' }));

  await expect(dialog.getByText('Frage 3 von 3')).toBeVisible();
  await expect(dialog.getByTestId('ai-choice-local')).toBeChecked();
  await tap(dialog.getByRole('button', { name: 'Fertig' }));
  await expect(wizard(page)).toHaveCount(0);

  expect(taps).toBeLessThanOrEqual(6);
  await expect.poll(async () => (await setupState(page))?.status).toBe('completed');
  const state = await setupState(page);
  expect(state?.doneSteps).toEqual(['core.basics', 'core.profiles', 'core.ai']);
  // One number, and the open steps wait on the dashboard.
  const checklist = page.getByTestId('setup-checklist');
  await expect(checklist).toBeVisible();
  await expect(checklist.getByText(/^2 von \d+ Schritten erledigt$/)).toBeVisible();
  expect(external).toEqual([]);
});

test('"Rest später" on a question keeps everything open and shows the checklist', async ({
  page,
}) => {
  await ready(page);
  await page
    .getByTestId('setup-welcome')
    .getByRole('button', { name: 'Einrichtung starten' })
    .click();
  await wizard(page).getByRole('button', { name: 'Rest später' }).click();
  await expect(wizard(page)).toHaveCount(0);
  await expect.poll(async () => (await setupState(page))?.status).toBe('inProgress');
  await expect(page.getByTestId('setup-checklist')).toBeVisible();
  await expect(
    page.getByTestId('setup-checklist').getByText(/^0 von \d+ Schritten erledigt$/),
  ).toBeVisible();
});

test('"Weiter" without a change is not "erledigt"; the sync default is', async ({ page }) => {
  await ready(page, '/settings/ueber');
  await startFull(page);
  const dialog = wizard(page);
  await dialog.getByRole('button', { name: 'Weiter' }).click(); // basics: always writes
  await expect(dialog.getByRole('heading', { name: 'Sync und Wiederherstellung' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Weiter' }).click(); // sync default is the answer
  await expect(dialog.getByRole('heading', { name: 'Profil und Module' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Weiter' }).click(); // nothing chosen
  await expect(dialog.getByRole('heading', { name: 'Werkzeugkasten' })).toBeVisible();
  await expect
    .poll(async () => (await setupState(page))?.doneSteps)
    .toEqual(['core.basics', 'core.sync']);
  expect((await setupState(page))?.skippedSteps).toEqual(['core.profiles']);
});

test('the AI step asks nothing until "nach Ollama suchen" is clicked; Spotify has no Google note', async ({
  page,
}) => {
  const external = watchNetwork(page);
  await page.route('http://localhost:11434/**', (route) =>
    route.fulfill({ json: { models: [{ name: 'llama3' }] } }),
  );
  await ready(page, '/settings/ueber');
  await startFull(page);
  const dialog = wizard(page);
  for (let i = 0; i < 6; i++) {
    if (await dialog.getByRole('heading', { name: 'KI-Anbieter' }).isVisible()) break;
    const label = await dialog.getByText(/^Schritt \d+ von \d+$/).textContent();
    await later(page).click();
    await expect(dialog.getByText(/^Schritt \d+ von \d+$/)).not.toHaveText(label ?? '');
  }
  await expect(dialog.getByRole('heading', { name: 'KI-Anbieter' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(external).toEqual([]);
  await dialog.getByTestId('setup-ollama-search').click();
  await expect(dialog.getByText('Ollama läuft auf diesem Computer.')).toBeVisible();
  expect(external).toEqual(['http://localhost:11434/api/tags']);

  await later(page).click();
  await expect(dialog.getByRole('heading', { name: 'Konten verknüpfen' })).toBeVisible();
  await expect(dialog.getByText(/Testing/)).toHaveCount(1); // only the Google section
});

test('Back closes the import dialog above the assistant first, then asks about the assistant', async ({
  page,
}) => {
  await ready(page, '/todos');
  await page.getByRole('button', { name: 'Einrichtung öffnen' }).click();
  await expect(wizard(page).getByRole('heading', { name: 'Importieren' })).toBeVisible();
  await wizard(page).getByRole('button', { name: 'Importieren' }).first().click();
  const importDialog = page.getByRole('dialog', { name: /^Importieren:/ });
  await expect(importDialog).toBeVisible();

  await page.goBack();
  await expect(importDialog).toHaveCount(0);
  await expect(wizard(page).getByRole('heading', { name: 'Importieren' })).toBeVisible();
  await expect(wizard(page).getByTestId('setup-confirm')).toHaveCount(0);

  await page.goBack();
  await expect(wizard(page).getByTestId('setup-confirm')).toBeVisible();
});
