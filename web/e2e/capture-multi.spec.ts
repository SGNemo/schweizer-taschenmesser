import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Several things at once (quick capture, package 2; „Kopf leer“ package 1): one line = one entry, a
 * preview row per entry, one click saves all – a batch never books – and the closing line
 * „<n> Dinge gespeichert. Sortiert wird später. · Ansehen · Rückgängig“ takes them all back. Runs on
 * desktop and pixel-7.
 */
test.beforeEach(async ({ page }) => {
  // Tuesday 2026-09-29, 10:00 local time.
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function rows(page: Page, table: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(name).objectStore(name).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(req.result as Record<string, unknown>[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    table,
  );
}

const live = (list: Record<string, unknown>[]) => list.filter((r) => !r.deletedAt);
const input = (page: Page) => page.getByRole('textbox', { name: 'Was möchtest du festhalten?' });

test('three lines become three entries in one click, and "Rückgängig" takes all back', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  await input(page).fill('Milch kaufen\nmorgen Oma anrufen\nFreitag Zahnarzt 9 Uhr');

  const list = page.getByTestId('capture-row');
  await expect(list).toHaveCount(3);
  await expect(list.nth(2)).toContainText('9:00 Uhr');
  await expect(page.getByTestId('capture-row-target').nth(2)).toHaveAttribute('data-type', 'event');
  await expect(page.getByRole('radio')).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .include('[data-testid="capture-rows"]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: 'Alle speichern (3)' }).click();
  await expect(page.getByText('3 Dinge gespeichert. Sortiert wird später.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ansehen' })).toBeVisible();
  expect(live(await rows(page, 'todos_task'))).toHaveLength(2);
  const [event] = live(await rows(page, 'calendar_event'));
  expect(event).toMatchObject({ title: 'Zahnarzt', startDate: '2026-10-02', startTime: '09:00' });

  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(input(page)).toHaveValue('Milch kaufen\nmorgen Oma anrufen\nFreitag Zahnarzt 9 Uhr');
  await expect.poll(async () => live(await rows(page, 'todos_task')).length).toBe(0);
  expect(live(await rows(page, 'calendar_event'))).toHaveLength(0);
});

test('a sentence with commas and "und" splits; Mo, Mi und Fr does not', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  await input(page).fill('Sport Mo, Mi und Fr 18 Uhr');
  await expect(page.getByTestId('capture-chips')).toContainText('Ziel:');
  await expect(page.getByTestId('capture-rows')).toHaveCount(0);

  await input(page).fill('Milch kaufen, morgen Oma anrufen und Freitag Zahnarzt 9 Uhr');
  await expect(page.getByTestId('capture-row-target').nth(2)).toHaveAttribute('data-type', 'event');
  await input(page).press('Enter');
  await expect(page.getByText('3 Dinge gespeichert')).toBeVisible();
});

test('Shift+Enter starts a new line, Enter saves; the phone shows "Eine Zeile = ein Eintrag"', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  const hint = page.getByTestId('capture-line-hint');
  if (isMobile) await expect(hint).toBeVisible();
  else await expect(hint).toBeHidden();

  await input(page).pressSequentially('Steuer abgeben');
  await input(page).press('Shift+Enter');
  await input(page).pressSequentially('Auto waschen');
  await expect(page.getByTestId('capture-row')).toHaveCount(2);
  await expect(page.getByTestId('capture-row-target').first()).toHaveAttribute('data-type', 'todo');
  await input(page).press('Enter');
  await expect(page.getByText('2 Dinge gespeichert')).toBeVisible();
  expect(
    live(await rows(page, 'todos_task'))
      .map((x) => x.title)
      .sort(),
  ).toEqual(['Auto waschen', 'Steuer abgeben']);
});

test('a batch with a money line: one tap saves all, nothing is booked, the line offers „Als Ausgabe buchen“', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  await input(page).fill('Müll runterbringen\nMittagessen 12,50 € ausgegeben\n$ 8,90 Pizza');
  const list = page.getByTestId('capture-row');
  await expect(list).toHaveCount(3);
  // Both money lines (the spend word and the `$` line) are ToDos with their amount and the chip.
  for (const i of [1, 2])
    await expect(page.getByTestId('capture-row-target').nth(i)).toHaveAttribute(
      'data-type',
      'todo',
    );
  await expect(page.getByTestId('capture-row-book')).toHaveCount(2);
  // The first view has no select; a tap on the target text opens the choice, which has no booking.
  await expect(page.locator('[data-testid="capture-rows"] select')).toHaveCount(0);
  await page.getByTestId('capture-row-target').first().click();
  await expect(page.getByTestId('capture-row-type').locator('option[value="finance"]')).toHaveCount(
    0,
  );
  await page.getByTestId('capture-row-type').selectOption('reminder');
  await expect(page.getByTestId('capture-row-target').first()).toHaveAttribute(
    'data-type',
    'reminder',
  );
  await page.getByRole('button', { name: 'Alle speichern (3)' }).click();
  await expect(page.getByText('3 Dinge gespeichert. Sortiert wird später.')).toBeVisible();
  await expect(page.getByTestId('capture-draft')).toHaveCount(0);
  expect(live(await rows(page, 'calendar_event'))).toHaveLength(1);
  const titles = live(await rows(page, 'todos_task')).map((x) =>
    String(x.title).replace(/\s/g, ' '),
  );
  expect(titles.sort()).toEqual(['Mittagessen · 12,50 €', 'Pizza · 8,90 €']);
  expect(live(await rows(page, 'finance_transaction'))).toHaveLength(0);
});

test('shared text with several lines arrives as one entry; the rest only behind „Text als Notiz“', async ({
  page,
}) => {
  const text = encodeURIComponent('- Milch kaufen\n- Oma anrufen');
  await page.goto(`/share?text=${text}`);
  await expect(page.getByTestId('capture-row')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Text als Notiz' })).not.toBeChecked();
  await page.getByRole('radio', { name: 'ToDo' }).click();
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Gespeichert in ToDos')).toBeVisible();
  const tasks = live(await rows(page, 'todos_task'));
  expect(tasks.map((x) => x.title)).toEqual(['Milch kaufen']);
  expect(tasks[0]!.note ?? '').toBe('');
});

test('the capture window saves several lines at once', async ({ page }) => {
  await page.goto('/capture.html');
  await input(page).fill('Milch kaufen\nOma anrufen');
  await expect(page.getByTestId('capture-row-target').first()).toHaveAttribute('data-type', 'todo');
  await input(page).press('Enter');
  await expect(page.getByTestId('capture-saved')).toContainText('2 Dinge gespeichert');
  expect(live(await rows(page, 'todos_task'))).toHaveLength(2);
});
