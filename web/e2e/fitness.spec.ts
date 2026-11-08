import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { backSettled, calendarEntry, enable, ready, showAllWidgets, showPreview } from './helpers';

/**
 * Fitness (package 1, docs/features/fitness.md): a session shows up in the widget and the calendar,
 * a `kcal` capture adds to today's sum, the goal calculator keeps no body data. Desktop and pixel-7.
 */
test.beforeEach(async ({ page }) => {
  // Sunday 2026-11-08, 10:00: the week (Monday start) runs from 2026-11-02.
  await page.clock.setFixedTime(new Date('2026-11-08T10:00:00'));
  await showAllWidgets(page);
  await showPreview(page);
  await enable(page, 'fitness');
});

async function rows(page: Page, table: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction(name).objectStore(name).getAll();
          req.onsuccess = () => {
            open.result.close();
            resolve(req.result as Record<string, unknown>[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    table,
  );
}

async function capture(page: Page, text: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  await page.getByRole('textbox', { name: 'Was möchtest du festhalten?' }).fill(text);
  await expect(page.getByText('Ziel: Fitness')).toBeVisible();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('a session: logged in the form, counted in the widget, shown in the calendar', async ({
  page,
}) => {
  await page.goto('/fitness?new=session');
  const dialog = page.getByRole('dialog', { name: 'Einheit eintragen' });
  // Yesterday, so „Wie letztes Mal“ is offered for today below.
  await dialog.getByLabel('Datum').fill('2026-11-07');
  await dialog.getByRole('combobox', { name: 'Übung' }).fill('Bankdrücken');
  await dialog.getByLabel('Sätze').fill('3');
  await dialog.getByLabel('Wdh.').fill('8');
  await dialog.getByLabel('kg', { exact: true }).fill('60');
  await dialog.getByLabel('Dauer in Minuten').fill('45');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect(page.getByTestId('fitness-week')).toContainText('1');
  await expect(page.getByRole('button', { name: /Bankdrücken/ }).first()).toBeVisible();
  await expect(page.getByText(/Bankdrücken 3 × 8 · 60 kg/)).toBeVisible();

  await ready(page, '/');
  const widget = page.getByTestId('widget-fitness:week');
  await expect(widget).toContainText('1 Einheit · 45 Min');
  await expect(widget).toContainText('0 kcal');

  await ready(page, '/calendar?view=day&date=2026-11-07');
  await expect(calendarEntry(page, /Training: Bankdrücken/).first()).toBeVisible();

  // "Wie letztes Mal" repeats it for today with one tap (toast with undo).
  await page.goto('/fitness');
  await page.getByRole('button', { name: 'Wie letztes Mal: Bankdrücken' }).click();
  await expect(page.getByText('Für heute eingetragen: Bankdrücken')).toBeVisible();
  await expect(page.getByTestId('fitness-week')).toContainText('2');
  // Today has its session now: no second copy by a second tap.
  await expect(page.getByRole('button', { name: /Wie letztes Mal/ })).toHaveCount(0);
});

test('kcal by quick capture adds up to the day sum, past the goal only in words', async ({
  page,
}) => {
  await capture(page, 'kcal 650 Döner');
  await capture(page, 'Haferflocken 350 kcal');
  expect((await rows(page, 'fitness_meal')).map((m) => [m.text, m.kcal, m.date])).toEqual(
    expect.arrayContaining([
      ['Döner', 650, '2026-11-08'],
      ['Haferflocken', 350, '2026-11-08'],
    ]),
  );

  await page.goto('/fitness?view=food');
  await expect(page.getByTestId('fitness-kcal')).toContainText('1.000');
  await expect(page.getByText('1.000 kcal').first()).toBeVisible();

  await ready(page, '/');
  const widget = page.getByTestId('widget-fitness:week');
  await expect(widget).toContainText('1.000 kcal');

  // A goal below the sum: said in words, no overrun mark.
  await page.goto('/fitness?view=food');
  await page.getByRole('button', { name: 'Tagesziel' }).click();
  await page.getByRole('dialog').getByLabel('kcal pro Tag').fill('900');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The head says it the same calm way.
  await expect(page.locator('main').getByText('1.000 kcal · Ziel 900')).toBeVisible();
  await ready(page, '/');
  await expect(widget).toContainText('1.000 kcal · Ziel 900');
  await expect(widget.getByRole('img', { name: /drüber|over/i })).toHaveCount(0);
});

test('the goal can be worked out; weight, height and age are never stored', async ({ page }) => {
  await page.goto('/fitness?view=food');
  await page.getByRole('button', { name: 'Tagesziel' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tagesziel kcal' });
  await dialog.getByRole('button', { name: 'Ausrechnen' }).click();
  await dialog.getByLabel('Gewicht in kg').fill('80');
  await dialog.getByLabel('Größe in cm').fill('180');
  await dialog.getByLabel('Alter').fill('30');
  await dialog.getByLabel('Formel').selectOption('male');
  await dialog.getByLabel('Alltag').selectOption('moderate');
  await expect(dialog.getByTestId('fitness-estimate')).toHaveText('Etwa 2.750 kcal pro Tag');
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(dialog.getByLabel('kcal pro Tag')).toHaveValue('2750');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const settings = (await rows(page, '_settings')).find((r) => r.id === 'module.fitness');
  expect(settings).toMatchObject({ kcalGoal: 2750 });
  // Neither the settings, their change history nor any other storage holds the formula's inputs.
  const stored = [
    JSON.stringify(await rows(page, '_settings')),
    JSON.stringify(await rows(page, 'fitness_meal')),
    JSON.stringify(await rows(page, 'fitness_session')),
    await page.evaluate(() => JSON.stringify({ ...localStorage })),
  ].join('\n');
  for (const value of ['weightKg', 'heightCm', '"age"', '"sex"', '"180"', ':180', '"80"', '"30"'])
    expect(stored).not.toContain(value);
});

test('a planned session: in „Jetzt wichtig“ with its time, counted only once done, the week in rows', async ({
  page,
}) => {
  await page.goto('/fitness?new=session');
  const dialog = page.getByRole('dialog', { name: 'Einheit eintragen' });
  await dialog.getByRole('combobox', { name: 'Übung' }).fill('Kniebeuge');
  await dialog.getByLabel('Sätze').fill('4');
  await dialog.getByLabel('Geplant, noch nicht gemacht').check();
  await dialog.getByLabel('Uhrzeit').fill('18:00');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Planned: listed under „Geplant“, not counted.
  await expect(page.getByText('Geplant', { exact: true })).toBeVisible();
  await expect(page.getByTestId('fitness-week')).toContainText('0');

  await ready(page, '/');
  await expect(page.getByText('Heute 18:00 · Training: Kniebeuge')).toBeVisible();

  await ready(page, '/fitness');
  await page.getByRole('button', { name: 'Erledigt: Kniebeuge' }).click();
  await expect(page.getByText('Eingetragen: Kniebeuge')).toBeVisible();
  await expect(page.getByTestId('fitness-week')).toContainText('1');

  await page.getByRole('button', { name: 'Woche', exact: true }).click();
  const week = page.getByTestId('fitness-week-view');
  await expect(week.getByTestId('fitness-week-total')).toContainText('1 Einheit');
  await expect(week.getByRole('listitem')).toHaveCount(7);
  await week.getByRole('button', { name: 'Vorherige Woche' }).click();
  await expect(week.getByTestId('fitness-week-total')).toContainText('Nichts eingetragen');
});

test('a template: saved from the form, filled into a new session with one tap', async ({
  page,
}) => {
  await page.goto('/fitness?new=session');
  let dialog = page.getByRole('dialog', { name: 'Einheit eintragen' });
  await dialog.getByRole('combobox', { name: 'Übung' }).fill('Rudern');
  await dialog.getByLabel('Sätze').fill('3');
  await dialog.getByRole('button', { name: 'Als Vorlage speichern' }).click();
  await expect(page.getByText('Als Vorlage gespeichert.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  // Leaving a dialog with typed text asks first.
  const discard = page.getByRole('button', { name: /Verwerfen|Nicht speichern/ });
  if (await discard.count()) await discard.first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Einheit eintragen' }).click();
  dialog = page.getByRole('dialog', { name: 'Einheit eintragen' });
  await dialog.getByRole('button', { name: 'Vorlage Einheit übernehmen' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Übung' })).toHaveValue('Rudern');
  await expect(dialog.getByLabel('Sätze')).toHaveValue('3');
});

test('import from another app: a Strong export is recognised, previewed and lands as a session', async ({
  page,
}) => {
  const strong = [
    'Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE',
    '2026-11-05 18:05:00;Oberkörper;55m;Bankdrücken (Langhantel);1;50;10;0;0;;;',
    '2026-11-05 18:05:00;Oberkörper;55m;Bankdrücken (Langhantel);2;60;8;0;0;;;',
  ].join('\n');
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('Aus anderer App');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Umzug von einer anderen App' });
  const chooser = page.waitForEvent('filechooser');
  await sheet.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await (
    await chooser
  ).setFiles([{ name: 'strong.csv', mimeType: 'text/csv', buffer: Buffer.from(strong) }]);
  await expect(sheet.getByText('Strong (Training, CSV)')).toBeVisible();
  await sheet.getByRole('button', { name: 'Vorschau öffnen' }).click();

  const wizard = page.getByRole('dialog', { name: /Importieren/ });
  await expect(wizard.getByText('1 Eintrag erkannt')).toBeVisible();
  await wizard.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await expect(wizard.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');
  await wizard.getByRole('button', { name: 'Schließen' }).last().click();
  await backSettled(page);

  await ready(page, '/fitness');
  await expect(page.getByText(/Bankdrücken \(Langhantel\) 2 × 8 · 60 kg/)).toBeVisible();
  // The page's ⋯ menu offers the import too.
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await expect(page.getByRole('menuitem', { name: /Importieren/ })).toBeVisible();
});

test('import from MyFitnessPal: the export ZIP brings a day of exercise and a meal, never the body weight', async ({
  page,
}) => {
  const zip = zipSync({
    'Exercise-Summary-2026-11-01-to-2026-11-07.csv': strToU8(
      [
        'Date,Exercise,Type,Exercise Calories,Exercise Minutes,Sets,Reps Per Set,Kilograms,Steps,Note',
        '2026-11-05,"Squats, Barbell",Strength,,,3,5,80.0,,',
      ].join('\n'),
    ),
    'Nutrition-Summary-2026-11-01-to-2026-11-07.csv': strToU8(
      [
        'Date,Meal,Calories,Fat (g),Saturated Fat,Polyunsaturated Fat,Monounsaturated Fat,Trans Fat,Cholesterol,Sodium (mg),Potassium,Carbohydrates (g),Fiber,Sugar,Protein (g),Vitamin A,Vitamin C,Calcium,Iron,Note',
        '2026-11-08,Breakfast,412.6,9.1,2.0,1.5,3.2,0.0,15.0,210.4,320.0,63.5,7.1,18.2,16.4,4.0,12.0,15.0,10.0,',
      ].join('\n'),
    ),
    'Measurement-Summary-2026-11-01-to-2026-11-07.csv': strToU8('Date,Weight\n2026-11-05,81.4\n'),
  });
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('Aus anderer App');
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Umzug von einer anderen App' });
  const chooser = page.waitForEvent('filechooser');
  await sheet.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await (
    await chooser
  ).setFiles([{ name: 'File-Export.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) }]);
  await expect(sheet.getByText('MyFitnessPal (Essen und Training, Export)')).toBeVisible();
  await sheet.getByRole('button', { name: 'Vorschau öffnen' }).click();

  const wizard = page.getByRole('dialog', { name: /Importieren/ });
  await expect(wizard.getByText('2 Einträge erkannt')).toBeVisible();
  await wizard.getByRole('button', { name: '2 Einträge importieren' }).click();
  await expect(wizard.getByRole('status')).toHaveText('2 Einträge wurden importiert.');
  await wizard.getByRole('button', { name: 'Schließen' }).last().click();
  await backSettled(page);

  await ready(page, '/fitness');
  await expect(page.getByText(/Squats, Barbell 3 × 5 · 80 kg/)).toBeVisible();
  // The weight from Measurement-Summary is nowhere.
  await expect(page.getByText(/81[,.]4/)).toHaveCount(0);
});
