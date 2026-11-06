import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openMoreFocus, ready, showPreview } from './helpers';

/** Deterministic "today": Monday 2026-11-09, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T10:00:00'));
  await showPreview(page);
});

/** Enables the planner (preview) and the ToDos with a raw write into the module table, like the library would. */
async function enablePlanner(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    (ids) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of ids)
            tx.objectStore('_modules').put({
              id,
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
    ['todos', 'planner'],
  );
}

/** A ToDo through the planner's own field; the run follows and the row appears on the board. */
async function enter(page: Page, text: string) {
  const field = page.getByLabel('Eintragen oder sagen', { exact: true });
  await expect(field).toBeVisible();
  await field.focus();
  await page.keyboard.insertText(text);
  await expect(field).toHaveValue(text);
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('');
}

const today = (page: Page) => page.getByTestId('day-2026-11-09');

test.describe('Planer (week board, package 1)', () => {
  // The board tests read seven columns side by side; the phone shows one day (its own test below).
  test.beforeEach(({ isMobile }, info) => {
    test.skip(isMobile && !info.title.startsWith('phone:'), 'wide board only');
  });

  test('the one field makes a ToDo; „bis Do“ sets a deadline; the head counts the free time', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await expect(page.getByTestId('planner-head')).toContainText('frei heute');
    await enter(page, 'Steuer 2 Std bis Do');
    await expect(page.getByText('Eingetragen · Frist Do', { exact: false })).toBeVisible();
    // 120 minutes become two sessions of one hour on different days.
    await expect(page.getByText('Steuer · Teil 1/2')).toBeVisible();
    await expect(page.getByText('Steuer · Teil 2/2')).toBeVisible();
    await expect(today(page)).toContainText('Frist Do');
    await expect(page.getByTestId('planner-head')).toContainText('2 h 12 frei heute');
    // Four columns a row at 1280 px, seven from 73rem of page width; no row runs past its column, nothing scrolls sideways.
    const measure = () =>
      page.evaluate(() => {
        const main = document.querySelector('main')!;
        const board = document.querySelector('[aria-label="Wochenbrett"]')!;
        const rows = Array.from(document.querySelectorAll('[data-testid^="day-"] li'));
        return {
          columns: getComputedStyle(board).gridTemplateColumns.split(' ').length,
          main: main.scrollWidth - main.clientWidth,
          rows: rows.filter((li) => li.scrollWidth > li.clientWidth + 1).length,
        };
      });
    expect(await measure()).toEqual({ columns: 4, main: 0, rows: 0 });
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect.poll(measure).toEqual({ columns: 7, main: 0, rows: 0 });
    // The reason sits behind „Warum hier?“ (a Thursday deadline is no pressure yet on Monday: placed by priority).
    await expect(today(page)).not.toContainText('neu, nach Priorität');
    await today(page).getByRole('button', { name: 'Aktionen für Steuer' }).first().click();
    await page.getByRole('menuitemcheckbox', { name: 'Warum hier?' }).click();
    await expect(today(page)).toContainText('neu, nach Priorität');
  });

  test('board titles break between words, never inside one, at 1920 and 1280 (N01)', async ({
    page,
  }) => {
    await enablePlanner(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await ready(page, '/planner');
    for (const text of [
      'Steuererklärung vorbereiten 30min',
      'Urlaubsantrag einreichen 20min',
      'Quartalsbericht schreiben 30min',
    ])
      await enter(page, text);
    await expect(today(page)).toContainText('Quartalsbericht');
    // Per word of every board title: one line box (not split), inside the title box (not cut off).
    const broken = () =>
      page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll('[data-board-title]'))) {
          const box = el.getBoundingClientRect();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent ?? '';
            for (const m of text.matchAll(/\S+/g)) {
              const range = document.createRange();
              range.setStart(node, m.index);
              range.setEnd(node, m.index + m[0].length);
              const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
              const tops = new Set(rects.map((r) => Math.round(r.top)));
              const right = Math.max(...rects.map((r) => r.right));
              if (tops.size > 1 || right > box.right + 1) out.push(m[0]);
            }
          }
        }
        return out;
      });
    await expect(page.locator('[data-board-title]')).toHaveCount(3);
    await expect.poll(broken).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(broken).toEqual([]);
  });

  test('day sheet: less time, „Tag frei“ empties the day, both undoable', async ({ page }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Blogpost 90min');
    await expect(today(page)).toContainText('Blogpost');
    await today(page)
      .getByRole('button', { name: /^Mo\.? 9\./ })
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByTestId('day-available')).toHaveText('4 h');
    await sheet.getByRole('button', { name: 'Weniger Zeit' }).click();
    await expect(sheet.getByTestId('day-available')).toHaveText('3 h 30');
    await sheet.getByTestId('day-off').click();
    await expect(sheet.getByTestId('day-available')).toHaveText('frei');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('planner-head')).toContainText('Heute ist frei.');
    await expect(page.getByTestId('day-2026-11-10')).toContainText('Blogpost');
    await page.getByRole('button', { name: 'Rückgängig' }).last().click();
    await expect(page.getByTestId('planner-head')).not.toContainText('Heute ist frei.');
  });

  test('Erledigt and Rückgängig, Festnageln, Später; the ToDo page shows „im Plan“', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Keller 60min');
    await enter(page, 'Angebot 45min !hoch');
    await expect(today(page)).toContainText('Angebot');
    // Erledigt is one tap (the tick in the row), with undo.
    await today(page).getByRole('checkbox', { name: 'Keller' }).click();
    await expect(today(page)).not.toContainText('Keller');
    await page.getByRole('button', { name: 'Rückgängig' }).last().click();
    await expect(today(page)).toContainText('Keller');
    // Festnageln keeps the thing on its day: the menu changes to „Nicht mehr festnageln“.
    await today(page).getByRole('button', { name: 'Aktionen für Keller' }).click();
    await page.getByRole('menuitem', { name: 'Festnageln auf Mo' }).click();
    await expect(page.getByText('Festgenagelt: Mo')).toBeVisible();
    await today(page).getByRole('button', { name: 'Aktionen für Keller' }).click();
    await expect(page.getByRole('menuitem', { name: 'Nicht mehr festnageln' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Später: the thing's own date becomes tomorrow; in Bald the ToDo page says where the planner put it.
    await today(page).getByRole('button', { name: 'Aktionen für Angebot' }).click();
    await page.getByRole('menuitem', { name: 'Später' }).click();
    await expect(page.getByTestId('day-2026-11-10')).toContainText('Angebot');
    await ready(page, '/todos?view=soon');
    await expect(page.getByTestId('in-plan').first()).toHaveText('im Plan: Di');
    await expect(page.getByRole('button', { name: 'Neu planen' })).toHaveCount(0);
  });

  test('phone: one day per screen with a strip from today and no horizontal overflow at 412 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Fenster putzen 30min');
    const strip = page.getByRole('group', { name: 'Tage' });
    await expect(strip).toBeVisible();
    await expect(strip.getByRole('button')).toHaveCount(7);
    await expect(today(page)).toContainText('Fenster putzen');
    await strip.getByRole('button').nth(1).click();
    await expect(page.getByTestId('day-2026-11-10')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // The strip's chosen chip and the one-day board pass axe at phone width too (a11y.spec covers the desktop in both themes).
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('„Woche prüfen“ from the head menu confirms the week in two taps', async ({ page }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await page.getByRole('button', { name: 'Weitere Optionen' }).click();
    await page.getByRole('menuitem', { name: 'Woche prüfen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Woche prüfen' });
    await dialog.getByRole('button', { name: 'Mehr Zeit' }).first().click();
    await dialog.getByRole('button', { name: 'Passt so' }).click();
    await expect(page.getByText('Woche bestätigt.')).toBeVisible();
    await expect(page.getByTestId('planner-head')).toContainText('3 h 36 frei heute');
  });
});

/** All rows of a table straight from IndexedDB. */
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

test.describe('Planer (calendar chip, prefix, sentences – package 2)', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'wide board only');
  });

  test('one plan chip per day in the calendar; the switch turns them off', async ({ page }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Steuer 2 Std bis Do');
    await enter(page, 'Keller 30min');
    await expect(page.getByText('Steuer · Teil 2/2')).toBeVisible();
    const days = new Set(
      (await rows(page, 'planner_assignment'))
        .filter((r) => r.deletedAt === null)
        .map((r) => r.date as string),
    );
    expect(days.size).toBeGreaterThan(1);
    await ready(page, '/calendar?view=month&date=2026-11-09');
    const chips = page.getByRole('button', { name: /^Plan · / });
    await expect(chips).toHaveCount(days.size);
    // Monday holds two things (Steuer · Teil 1/2 and Keller), still one chip.
    await expect(chips.filter({ hasText: '2 Dinge' })).toHaveCount(1);
    // The view switcher's „Plan“ is a link to the board, not a sixth view.
    await page
      .getByRole('group', { name: 'Ansicht' })
      .last()
      .getByRole('button', { name: 'Plan' })
      .click();
    await expect(page).toHaveURL(/\/planner/);
    await ready(page, '/settings/module/planner');
    const sw = page.getByRole('switch', { name: 'Plan im Kalender zeigen' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await ready(page, '/calendar?view=month&date=2026-11-09');
    await expect(page.getByRole('button', { name: 'Neuer Termin' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Plan · / })).toHaveCount(0);
  });

  test('quick capture: prefix „p“ makes a ToDo plus its plan entry with a hard due', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/?capture=1');
    const input = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' });
    await input.fill('p Steuer 2 Std bis Do');
    await expect(page.getByTestId('capture-chips')).toContainText('Ziel: Planer');
    await input.press('Enter');
    await expect(page.getByText('Gespeichert in Planer')).toBeVisible();
    const [task] = await rows(page, 'todos_task');
    expect(task).toMatchObject({ title: 'Steuer', estimateMin: 120, dueDate: '2026-11-12' });
    const items = await rows(page, 'planner_item');
    expect(items.find((i) => i.id === `todos:${task!.id as string}`)).toMatchObject({
      due: { date: '2026-11-12', hard: true },
    });
  });

  test('„Donnerstag frei“ → preview → Übernehmen → Rückgängig, without a single request', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Blogpost 90min');
    const thursday = page.getByTestId('day-2026-11-12');
    await expect(thursday).toContainText('frei von');
    const requests: string[] = [];
    const origin = new URL(page.url()).origin;
    page.on('request', (r) => {
      if (['fetch', 'xhr', 'websocket'].includes(r.resourceType()) || !r.url().startsWith(origin))
        requests.push(r.url());
    });
    const field = page.getByLabel('Eintragen oder sagen', { exact: true });
    await field.fill('Donnerstag frei');
    await field.press('Enter');
    const preview = page.getByTestId('plan-preview');
    await expect(preview).toContainText('Do ist frei.');
    // Nothing is stored before „Übernehmen“.
    await expect(thursday).toContainText('frei von');
    await preview.getByRole('button', { name: 'Übernehmen' }).click();
    await expect(preview).toHaveCount(0);
    await expect(thursday).not.toContainText('frei von');
    await page.getByRole('button', { name: 'Rückgängig' }).last().click();
    await expect(thursday).toContainText('frei von');
    // No ToDo came from the sentence, and nothing left the device.
    expect((await rows(page, 'todos_task')).map((r) => r.title)).toEqual(['Blogpost']);
    expect(requests).toEqual([]);
  });

  test('Monday: „Woche prüfen“ line only with the switch; × hides it, also after a reload', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await expect(page.getByLabel('Eintragen oder sagen', { exact: true })).toBeVisible();
    await expect(page.getByTestId('week-check-link')).toHaveCount(0);
    await ready(page, '/settings/barrierefreiheit');
    await openMoreFocus(page);
    const sw = page.getByRole('switch', { name: '„Woche prüfen“ am Montag' });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await ready(page, '/planner');
    const line = page.getByTestId('week-check-link');
    await expect(line).toContainText('Woche prüfen · 2 Schritte');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The line opens the sheet (Mo–So and the three biggest things) only when tapped.
    await line.getByRole('button', { name: 'Woche prüfen · 2 Schritte' }).click();
    await expect(page.getByRole('dialog', { name: 'Woche prüfen' })).toBeVisible();
    await page.keyboard.press('Escape');
    await line.getByRole('button', { name: 'Für diese Woche ausblenden' }).click();
    await expect(page.getByTestId('week-check-link')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Eintragen oder sagen', { exact: true })).toBeVisible();
    await expect(page.getByTestId('week-check-link')).toHaveCount(0);
    // Switched off: no line, the sheet stays in ⋯.
    await ready(page, '/settings/barrierefreiheit');
    await openMoreFocus(page);
    await page.getByRole('switch', { name: '„Woche prüfen“ am Montag' }).click();
    await ready(page, '/planner');
    await page.getByRole('button', { name: 'Weitere Optionen' }).click();
    await expect(page.getByRole('menuitem', { name: 'Woche prüfen' })).toBeVisible();
    await expect(page.getByTestId('week-check-link')).toHaveCount(0);
  });
});
