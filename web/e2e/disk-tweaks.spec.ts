import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Tab "Windows-Einstellungen" of the disk module against the invented settings of
 * `core/platform/fakeDisk.ts` (E2E builds only). Nothing here touches a real Windows setting.
 */

/** Poses as the desktop app (E2E builds read `localStorage.__tmPlatformKind`). */
async function asDesktop(page: Page) {
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
}

async function enableDisk(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'disk',
            enabled: true,
            dataPolicy: null,
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
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
  );
}

async function openTweaks(page: Page) {
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk?tab=tweaks');
  await expect(page.getByRole('region', { name: 'Darstellung' })).toBeVisible();
}

const BALANCED = '381b4222-f694-41f0-9685-ff5bb260df2e';
const SAVER = 'a1841308-3541-4fab-bc81-f71556f20b4a';

/** Where the keyboard focus is: the test id of the row around it, or the tag of the element. */
const focusPlace = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el?.closest('[data-testid]')?.getAttribute('data-testid') ?? el?.tagName ?? 'none';
  });

test('settings tab: the catalogue in calm groups, each with a Microsoft source', async ({
  page,
}) => {
  await openTweaks(page);
  for (const group of ['Darstellung', 'Explorer', 'Privatsphäre', 'Energie'])
    await expect(page.getByRole('heading', { name: group, exact: true })).toBeVisible();
  await expect(page.getByText('ohne dass du die Windows-App „Einstellungen“')).toBeVisible();
  // Nothing was changed yet: no count and no reset button take up room.
  await expect(page.getByText(/von Nemo geändert/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Alle zurücksetzen' })).toHaveCount(0);

  const row = page.getByTestId('tweak-hiddenFiles');
  await expect(row.getByRole('switch', { name: 'Versteckte Dateien anzeigen' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  // Details are folded until asked for; a risk is named only where there is one.
  await expect(row.getByText('Risiko: gering.')).toBeHidden();
  await row.getByText('Mehr dazu').click();
  await expect(row.getByText('Risiko: gering. Versteckte Dateien gehören oft')).toBeVisible();
  await expect(
    row.getByText('Offene Explorer-Fenster zeigen es nach dem Aktualisieren'),
  ).toBeVisible();
  await expect(row.getByText('auf demselben Weg um wie Windows selbst')).toBeVisible();
  const source = row.getByRole('link', {
    name: 'Quelle: Dokumentation von Microsoft (Versteckte Dateien anzeigen, öffnet im Browser)',
  });
  await expect(source).toHaveAttribute('href', /^https:\/\/learn\.microsoft\.com\//);
  const calm = page.getByTestId('tweak-animations');
  await calm.getByText('Mehr dazu').click();
  await expect(calm.getByText('Barrierefreiheit → Visuelle Effekte')).toBeVisible();
  await expect(calm.getByText(/Risiko/)).toHaveCount(0);
  await expect(page.getByText(/SystemParametersInfo|SHGetSetSettings/)).toHaveCount(0);

  // A setting Windows has no stored value for shows no switch that pretends to know.
  const unset = page.getByTestId('tweak-trackAppLaunches');
  await expect(
    unset.getByText('Windows entscheidet selbst (Standard). Nemo hat hier noch nichts festgelegt.'),
  ).toBeVisible();
  await expect(unset.getByRole('switch')).toHaveCount(0);
  await expect(
    unset.getByRole('button', { name: 'Einschalten: App-Starts für Start und Suche merken' }),
  ).toBeVisible();
  // The power plan is a choice among the plans of this PC, and says whom it reaches.
  const plan = page.getByTestId('tweak-powerPlan');
  await expect(plan.getByRole('combobox', { name: 'Energiesparplan wählen' })).toHaveValue(
    BALANCED,
  );
  await expect(plan.getByText('Der Plan gilt für alle Konten dieses PCs.')).toBeVisible();

  // The restore point is Windows' own dialog, offered quietly below and never required.
  await expect(page.getByText('Nötig ist das nicht.')).toBeVisible();
  await page.getByRole('button', { name: 'Wiederherstellungspunkt anlegen' }).click();
  expect(
    await page.evaluate(() => (globalThis as { __tmCareTools?: string[] }).__tmCareTools),
  ).toEqual(['systemProtection']);
});

test('settings tab: a switch shows the new state, the history takes it back', async ({ page }) => {
  await openTweaks(page);
  const row = page.getByTestId('tweak-fileExtensions');
  const toggle = row.getByRole('switch', { name: 'Dateiendungen anzeigen' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(row.getByText('von Nemo geändert')).toBeVisible();
  await expect(
    page.getByText('Dateiendungen anzeigen: eingeschaltet.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('1 Einstellung von Nemo geändert.')).toBeVisible();

  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const history = page.getByRole('list', { name: 'Verlauf' });
  await expect(history).toContainText('Dateiendungen anzeigen: eingeschaltet');
  await history
    .getByRole('button', { name: 'Rückgängig: Dateiendungen anzeigen: eingeschaltet' })
    .click();
  await expect(history).toContainText('Zurückgenommen.');

  await page.getByRole('button', { name: 'Windows-Einstellungen', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(row.getByText('von Nemo geändert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Alle zurücksetzen' })).toHaveCount(0);
});

test('settings tab: the notice takes a switch back right away', async ({ page }) => {
  await openTweaks(page);
  const row = page.getByTestId('tweak-animations');
  const toggle = row.getByRole('switch', { name: 'Animationen in Fenstern' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(
    page.getByText('Animationen in Fenstern: ausgeschaltet.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Zurückgestellt.')).toBeVisible();
  await expect(row.getByText('von Nemo geändert')).toHaveCount(0);
  await expect(page.getByText(/Einstellung(en)? von Nemo geändert\./)).toHaveCount(0);

  // A setting without a value gets exactly that state back, buttons and all.
  const unset = page.getByTestId('tweak-trackAppLaunches');
  await unset.getByRole('button', { name: /^Ausschalten/ }).click();
  await expect(unset.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(unset.getByText('Windows entscheidet selbst (Standard).')).toBeVisible();
  await expect(unset.getByRole('switch')).toHaveCount(0);
});

test('settings tab: the power plan changes only with "Übernehmen"', async ({ page }) => {
  await openTweaks(page);
  const row = page.getByTestId('tweak-powerPlan');
  const select = row.getByRole('combobox', { name: 'Energiesparplan wählen' });
  const apply = row.getByRole('button', { name: 'Übernehmen: Energiesparplan' });
  await expect(apply).toBeDisabled();

  // Choosing alone changes nothing and writes no history line.
  await select.selectOption({ label: 'Energiesparmodus' });
  await expect(apply).toBeEnabled();
  await expect(row.getByText('Aktiv: Ausbalanciert')).toBeVisible();
  await expect(row.getByText('von Nemo geändert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await expect(page.getByText('Im Verlauf steht noch nichts.')).toBeVisible();

  await page.getByRole('button', { name: 'Windows-Einstellungen', exact: true }).click();
  await expect(select).toHaveValue(BALANCED);
  await select.selectOption({ label: 'Energiesparmodus' });
  await apply.click();
  await expect(row.getByText('Aktiv: Energiesparmodus')).toBeVisible();
  await expect(page.getByText('Energiesparplan: Energiesparmodus.', { exact: true })).toBeVisible();
  await expect(apply).toBeDisabled();
  await expect(row.getByText('von Nemo geändert')).toBeVisible();

  // The history names the chosen plan; the notice takes it back and the select follows.
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(row.getByText('Aktiv: Ausbalanciert')).toBeVisible();
  await expect(select).toHaveValue(BALANCED);
  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Verlauf' })).toContainText(
    'Energiesparplan: Energiesparmodus',
  );
});

test('settings tab: the keyboard focus stays in the row after a change', async ({ page }) => {
  await openTweaks(page);
  // A switch stays a switch: it is never disabled, so it keeps the focus.
  const animations = page
    .getByTestId('tweak-animations')
    .getByRole('switch', { name: 'Animationen in Fenstern' });
  await animations.focus();
  await page.keyboard.press('Space');
  await expect(animations).toHaveAttribute('aria-checked', 'false');
  await expect(animations).toBeFocused();
  expect(await focusPlace(page)).toBe('tweak-animations');

  // Two buttons become a switch: the focus moves to it instead of dropping to the page.
  const unset = page.getByTestId('tweak-trackAppLaunches');
  await unset.getByRole('button', { name: /^Einschalten/ }).focus();
  await page.keyboard.press('Enter');
  const toggle = unset.getByRole('switch', { name: 'App-Starts für Start und Suche merken' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).toBeFocused();

  // The plan: arrow keys in the select only choose; "Übernehmen" keeps the focus once applied.
  const plan = page.getByTestId('tweak-powerPlan');
  const select = plan.getByRole('combobox');
  await select.focus();
  await select.selectOption(SAVER);
  await expect(plan.getByText('Aktiv: Ausbalanciert')).toBeVisible();
  await page.keyboard.press('Tab');
  const apply = plan.getByRole('button', { name: 'Übernehmen: Energiesparplan' });
  await expect(apply).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(plan.getByText('Aktiv: Energiesparmodus')).toBeVisible();
  await expect(apply).toBeFocused();
});

test('settings tab: "Alle zurücksetzen" puts two changes back after asking', async ({ page }) => {
  await openTweaks(page);
  const animations = page
    .getByTestId('tweak-animations')
    .getByRole('switch', { name: 'Animationen in Fenstern' });
  const plan = page.getByTestId('tweak-powerPlan').getByRole('combobox');
  await animations.click();
  await expect(animations).toHaveAttribute('aria-checked', 'false');
  await plan.selectOption({ label: 'Energiesparmodus' });
  await page.getByRole('button', { name: 'Übernehmen: Energiesparplan' }).click();
  await expect(page.getByText('2 Einstellungen von Nemo geändert.')).toBeVisible();

  await page.getByRole('button', { name: 'Alle zurücksetzen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Alle zurücksetzen?' });
  await expect(dialog.getByRole('listitem')).toHaveText([
    'Animationen in Fenstern',
    'Energiesparplan',
  ]);
  // Cancelling changes nothing.
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(animations).toHaveAttribute('aria-checked', 'false');

  await page.getByRole('button', { name: 'Alle zurücksetzen' }).click();
  await dialog.getByRole('button', { name: 'Zurücksetzen', exact: true }).click();
  await expect(
    page.getByText('Zurückgesetzt: Animationen in Fenstern, Energiesparplan.', { exact: true }),
  ).toBeVisible();
  await expect(animations).toHaveAttribute('aria-checked', 'true');
  await expect(plan).toHaveValue(BALANCED);
  await expect(page.getByText('von Nemo geändert', { exact: true })).toHaveCount(0);
  // The count and the button leave with the last change; the focus does not drop to the page.
  await expect(page.getByRole('button', { name: 'Alle zurücksetzen' })).toHaveCount(0);
  await expect.poll(() => focusPlace(page)).not.toBe('BODY');

  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const history = page.getByRole('list', { name: 'Verlauf' });
  await expect(history).toContainText('Energiesparplan: Energiesparmodus');
  await expect(history.getByRole('button', { name: /Rückgängig/ })).toHaveCount(0);
});

test('settings tab: a reset says in one notice what it left alone and why', async ({ page }) => {
  await openTweaks(page);
  for (const id of ['animations', 'hiddenFiles', 'fileExtensions']) {
    const toggle = page.getByTestId(`tweak-${id}`).getByRole('switch');
    const before = await toggle.getAttribute('aria-checked');
    await toggle.click();
    await expect(toggle).not.toHaveAttribute('aria-checked', before ?? '');
  }
  await expect(page.getByText('3 Einstellungen von Nemo geändert.')).toBeVisible();
  await page.evaluate(() => {
    const g = globalThis as { __tmCareResetLeft?: string[]; __tmCareResetFailed?: string[] };
    g.__tmCareResetLeft = ['hiddenFiles'];
    g.__tmCareResetFailed = ['fileExtensions'];
  });
  await page.getByRole('button', { name: 'Alle zurücksetzen' }).click();
  await page
    .getByRole('dialog', { name: 'Alle zurücksetzen?' })
    .getByRole('button', { name: 'Zurücksetzen', exact: true })
    .click();
  await expect(
    page.getByText(
      'Zurückgesetzt: Animationen in Fenstern. Unverändert geblieben: Versteckte Dateien anzeigen (inzwischen in Windows geändert), Dateiendungen anzeigen (ließ sich nicht zurücksetzen).',
      { exact: true },
    ),
  ).toBeVisible();
  // What Windows changed is no longer Nemo's change; what could not be written still is.
  await expect(page.getByText('1 Einstellung von Nemo geändert.')).toBeVisible();
  await expect(page.getByTestId('tweak-hiddenFiles').getByText('von Nemo geändert')).toHaveCount(0);
  await expect(
    page.getByTestId('tweak-fileExtensions').getByText('von Nemo geändert'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alle zurücksetzen' })).toBeFocused();
});

test('settings tab: only the newest change of a setting offers undo, and one changed in Windows none', async ({
  page,
}) => {
  await openTweaks(page);
  const toggle = page
    .getByTestId('tweak-animations')
    .getByRole('switch', { name: 'Animationen in Fenstern' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const history = page.getByRole('list', { name: 'Verlauf' });
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(history.getByRole('button', { name: /^Rückgängig/ })).toHaveCount(1);
  await expect(history).toContainText('Nimm zuerst die neuere Änderung daran zurück.');

  // Windows changed it since: the undo is refused, changes nothing and settles both lines.
  await page.evaluate(() => {
    (globalThis as { __tmCareChangedElsewhere?: boolean }).__tmCareChangedElsewhere = true;
  });
  await history.getByRole('button', { name: /^Rückgängig/ }).click();
  await expect(page.getByText('Das wurde inzwischen in Windows geändert.')).toBeVisible();
  await expect(history.getByText('Inzwischen in Windows geändert.')).toHaveCount(2);
  await expect(history.getByRole('button', { name: /^Rückgängig/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Windows-Einstellungen', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/von Nemo geändert/)).toHaveCount(0);
});

test('settings tab: a stored value Nemo cannot place is never called the default', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (globalThis as { __tmCareCustom?: string[] }).__tmCareCustom = ['advertisingId'];
  });
  await openTweaks(page);
  const row = page.getByTestId('tweak-advertisingId');
  await expect(
    row.getByText('Hier ist ein anderer Wert gespeichert, den Nemo nicht einordnet.'),
  ).toBeVisible();
  await expect(row.getByText(/Standard/)).toHaveCount(0);
  await expect(row.getByRole('switch')).toHaveCount(0);
  await row.getByRole('button', { name: 'Ausschalten: Werbe-ID für Apps' }).click();
  await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(
    row.getByText('Hier ist ein anderer Wert gespeichert, den Nemo nicht einordnet.'),
  ).toBeVisible();
});

test('settings tab has no accessibility violations', async ({ page }) => {
  await openTweaks(page);
  await page.getByTestId('tweak-hiddenFiles').getByText('Mehr dazu').click();
  await page.getByTestId('tweak-powerPlan').getByText('Mehr dazu').click();
  const open = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(open.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  // With a change: the count, the reset button, a switch in place of two buttons, a plan to apply.
  await page
    .getByTestId('tweak-trackAppLaunches')
    .getByRole('button', { name: /^Einschalten/ })
    .click();
  await page.getByTestId('tweak-powerPlan').getByRole('combobox').selectOption(SAVER);
  await expect(page.getByText('1 Einstellung von Nemo geändert.')).toBeVisible();
  const changed = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(changed.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await page.getByRole('button', { name: 'Alle zurücksetzen' }).click();
  await expect(page.getByRole('dialog', { name: 'Alle zurücksetzen?' })).toBeVisible();
  const dialog = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(dialog.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
