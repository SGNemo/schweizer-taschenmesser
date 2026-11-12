import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openMoreFocus, ready, showPreview } from './helpers';

/** Deterministic "today": Monday 2026-11-09, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T10:00:00'));
  await showPreview(page);
});

/** Enables the planner (preview) and the ToDos with a raw write into the module table, like the library would. */
async function enablePlanner(page: Page, extra: string[] = []) {
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
    ['todos', 'planner', ...extra],
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

/**
 * A day of the week. Beside the week list (wide page, 0b-4b) one day is open in the panel: the day is chosen in
 * the list first. On the phone the strip does that, and the tests there press it themselves.
 */
async function day(page: Page, date: string) {
  const row = page.getByTestId(`week-${date}`);
  if (await row.isVisible()) await row.click();
  return page.getByTestId(`day-${date}`);
}

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
    await expect(await day(page, '2026-11-10')).toContainText('Steuer · Teil 2/2');
    await expect(await day(page, '2026-11-09')).toContainText('Frist Do');
    await expect(page.getByTestId('planner-head')).toContainText('2 h 12 frei heute');
    // The week is one list of seven days with the picked day beside it (0b-4b); no row runs past its panel and
    // nothing scrolls sideways, from 1280 to 1920.
    const measure = () =>
      page.evaluate(() => {
        const main = document.querySelector('main')!;
        const week = document.querySelector('[aria-label="Wochenbrett"]')!;
        const rows = Array.from(document.querySelectorAll('[data-testid^="day-"] li'));
        return {
          days: week.querySelectorAll('[data-testid^="week-"]').length,
          main: main.scrollWidth - main.clientWidth,
          rows: rows.filter((li) => li.scrollWidth > li.clientWidth + 1).length,
        };
      });
    expect(await measure()).toEqual({ days: 7, main: 0, rows: 0 });
    for (const [width, height] of [
      [1600, 900],
      [1920, 1080],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect.poll(measure).toEqual({ days: 7, main: 0, rows: 0 });
    }
    // The reason sits behind „Warum hier?“ (a Thursday deadline is no pressure yet on Monday: placed by priority).
    await expect(today(page)).not.toContainText('neu, nach Priorität');
    await today(page).getByRole('button', { name: 'Aktionen für Steuer' }).first().click();
    await page.getByRole('menuitemcheckbox', { name: 'Warum hier?' }).click();
    await expect(today(page)).toContainText('neu, nach Priorität');
  });

  test('day titles break between words, never inside one or cut, from 1280 to 1920 (N01)', async ({
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
        for (const el of Array.from(
          document.querySelectorAll('[data-testid="day-2026-11-09"] li span[title]'),
        )) {
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
    await expect(today(page).locator('li span[title]')).toHaveCount(3);
    await expect.poll(broken).toEqual([]);
    // Also between the two: below 95rem of page width the board stays at four a row.
    for (const width of [1600, 1440, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(broken).toEqual([]);
    }
  });

  test('„Eintragen“ and ⋯ line up with the field; the hint sits under the row (S09, UI round 6)', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    const field = page.getByLabel('Eintragen oder sagen', { exact: true });
    await expect(field).toBeVisible();
    await expect(field).toHaveAccessibleDescription(/Ein ToDo entsteht/);
    const bottom = async (name: RegExp | string, exact = false) => {
      const box = await page.getByRole('button', { name, exact }).boundingBox();
      return box!.y + box!.height;
    };
    const input = await field.boundingBox();
    const inputBottom = input!.y + input!.height;
    expect(Math.abs((await bottom('Eintragen', true)) - inputBottom)).toBeLessThanOrEqual(2);
    expect(Math.abs((await bottom('Weitere Optionen', true)) - inputBottom)).toBeLessThanOrEqual(2);
    const hint = page.getByText(/Ein ToDo entsteht/).first();
    const hintBox = await hint.boundingBox();
    expect(hintBox!.y).toBeGreaterThanOrEqual(inputBottom - 1);
  });

  test('the entry row stays where it is while the head figure loads (U01)', async ({ page }) => {
    await enablePlanner(page);
    // Every frame from the first one: a jump between two frames is what a person sees (and what moved the row
    // under the measurements of the test above).
    await page.addInitScript(() => {
      const tops: number[] = [];
      (window as unknown as { __entryTops: number[] }).__entryTops = tops;
      const frame = () => {
        const row = document.querySelector('form[data-keep-visible]');
        if (row) {
          const top = Math.round(row.getBoundingClientRect().top);
          if (tops.at(-1) !== top) tops.push(top);
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await ready(page, '/planner');
    await expect(page.getByTestId('planner-head')).toContainText('frei');
    // the frame gives the figure's room back one second after the page arrived (`FIGURE_HOLD_MS`)
    await page.waitForTimeout(1200);
    const tops = await page.evaluate(
      () => (window as unknown as { __entryTops: number[] }).__entryTops,
    );
    expect(tops).toHaveLength(1);
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
    await expect(await day(page, '2026-11-10')).toContainText('Blogpost');
    await page.getByRole('button', { name: 'Rückgängig' }).last().click();
    await expect(page.getByTestId('planner-head')).not.toContainText('Heute ist frei.');
  });

  test('the ToDo page counts what the plan counts and has no „Alle auf heute“ (N02)', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/todos');
    await page.locator('[data-page-action]:visible, [data-testid="bottom-plus"]:visible').click();
    await page.getByRole('dialog').getByLabel('Titel').fill('Alte Sache gestern 60min');
    await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(page.getByRole('button', { name: /Alte Sache/ }).first()).toBeVisible();
    // Without the plan the overdue thing is on today.
    // The count of today is the head's figure, named by its context line ("heute · etwa 60 Min").
    await expect(page.getByTestId('today-count')).toHaveText('1');
    // Today off: the planner puts the overdue thing on Tuesday.
    await page.goto('/planner');
    await today(page)
      .getByRole('button', { name: /^Mo\.? 9\./ })
      .click();
    await page.getByRole('dialog').getByTestId('day-off').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('planner-head')).toContainText('Heute ist frei.');
    await expect(await day(page, '2026-11-10')).toContainText('Alte Sache');
    // The ToDo page follows: not in Heute, the head counts nothing for today, no „Alle auf heute“.
    await page.goto('/todos?view=today');
    // Nothing on today: the first row is there, the head shows no figure (no zero), the empty view says it once.
    await expect(page.getByTestId('today-card')).toBeAttached();
    await expect(page.getByTestId('today-count')).toHaveCount(0);
    await expect(page.getByTestId('todos-empty')).toContainText('Nichts zu tun');
    await expect(page.getByRole('button', { name: /Alte Sache/ })).toHaveCount(0);
    await page.goto('/todos');
    await expect(page.getByRole('button', { name: /Alte Sache/ }).first()).toBeVisible();
    // The list shows the task again, and the head still counts nothing for today (the plan put it on Tuesday).
    await expect(page.getByTestId('today-card')).toBeVisible();
    await expect(page.getByTestId('today-count')).toHaveCount(0);
    await expect(page.getByTestId('all-today')).toHaveCount(0);
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
    await expect(await day(page, '2026-11-10')).toContainText('Angebot');
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
    // N04: the page's ⋯ sits beside the field, not in a toolbar row of its own.
    await expect(
      page
        .locator('form')
        .filter({ has: page.getByLabel('Eintragen oder sagen', { exact: true }) })
        .getByRole('button', { name: 'Weitere Optionen' }),
    ).toBeVisible();
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
    await expect(await day(page, '2026-11-10')).toContainText('Steuer · Teil 2/2');
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
    const thursday = await day(page, '2026-11-12');
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

  test('with „KI abschalten“ the field and the preview work the same – rules only, not a single request', async ({
    page,
  }) => {
    await enablePlanner(page);
    // The master switch, as the settings do it (this device).
    await ready(page, '/settings/ki');
    await page.getByTestId('ai-off').click();
    await page.getByTestId('ai-off-confirm').click();
    await expect(page.getByTestId('ai-on')).toBeVisible();
    await ready(page, '/planner');
    await enter(page, 'Blogpost 90min');
    const friday = await day(page, '2026-11-13');
    await expect(friday).toContainText('frei von');
    const requests: string[] = [];
    const origin = new URL(page.url()).origin;
    page.on('request', (r) => {
      if (['fetch', 'xhr', 'websocket'].includes(r.resourceType()) || !r.url().startsWith(origin))
        requests.push(r.url());
    });
    const field = page.getByLabel('Eintragen oder sagen', { exact: true });
    // No hint of a model anywhere near the field.
    await expect(page.locator('form', { has: field })).not.toContainText('Modell');
    await field.fill('Freitag frei');
    await field.press('Enter');
    const preview = page.getByTestId('plan-preview');
    await expect(preview).toContainText('Fr ist frei.');
    await expect(preview).not.toContainText('Modell');
    await preview.getByRole('button', { name: 'Übernehmen' }).click();
    await expect(preview).toHaveCount(0);
    await expect(friday).not.toContainText('frei von');
    // A sentence the rules cannot read gets the calm line, no model, no ToDo.
    await field.fill('schieb das irgendwie');
    await field.press('Enter');
    await expect(page.getByTestId('plan-say')).toContainText('Ich kann: Tag frei');
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

/** One raw record into a module table (the envelope as `createRepo` would write it). */
async function put(page: Page, table: string, record: Record<string, unknown>) {
  await page.evaluate(
    ({ name, rec }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(name, 'readwrite');
          tx.objectStore(name).put({
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
            deletedAt: null,
            _f: {},
            ...rec,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { name: table, rec: record },
  );
}

/** Less time on weekdays (24 plannable minutes with the buffer), Saturday off: 240 minutes in the 14 days, a big thing overloads them. */
async function smallWeek(page: Page) {
  await ready(page, '/settings/module/planner');
  for (const [label, value] of [
    ['Verfügbare Zeit Mo–Fr (Minuten)', '30'],
    ['Verfügbare Zeit Samstag (Minuten)', '0'],
  ] as const) {
    const field = page.getByLabel(label, { exact: true });
    await field.fill(value);
    await field.blur();
    await expect(field).toHaveValue(value);
  }
}

/** The toast region (the header has a status line of its own). */
const toast = (page: Page) => page.getByRole('status').last();
const waitingHead = (page: Page) => page.locator('[data-group="wait"] h2');
/** The waiting group is folded by default („Kopf leer“ Q4 a): open it before reading what it holds. */
async function openWaiting(page: Page) {
  const toggle = waitingHead(page).getByRole('button');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}
const overload = (page: Page) => page.getByTestId('planner-overload');

test.describe('Planer (more sources, overload – package 3)', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'wide board only');
  });

  test('a note → „In den Plan“ → a row on the board with the way back to the note', async ({
    page,
  }) => {
    await enablePlanner(page, ['notes']);
    await put(page, 'notes_note', {
      id: 'n-vermieter',
      title: 'Vermieter antworten',
      body: 'Heizung, Termin',
      pinned: false,
      notebookId: null,
      order: 0,
    });
    await ready(page, '/notes');
    const row = page
      .locator('div, li, article')
      .filter({ has: page.getByRole('button', { name: /^Vermieter antworten/ }) })
      .filter({ has: page.getByRole('button', { name: 'Seite: weitere Aktionen' }) })
      .last();
    await row.getByRole('button', { name: 'Seite: weitere Aktionen' }).click();
    await page.getByRole('menuitem', { name: 'In den Plan' }).click();
    const sheet = page.getByRole('dialog', { name: 'In den Plan' });
    await sheet.getByRole('button', { name: '15 Min' }).click();
    await sheet.getByLabel('Priorität').selectOption({ label: 'Hoch' });
    await sheet.getByRole('button', { name: 'In den Plan' }).click();
    await expect(toast(page)).toContainText('Im Plan: Vermieter antworten · Mo');
    const [task] = await rows(page, 'todos_task');
    expect(task).toMatchObject({
      title: 'Vermieter antworten',
      estimateMin: 15,
      priority: 3,
      links: [{ kind: 'note', id: 'n-vermieter', label: 'Vermieter antworten' }],
    });
    await ready(page, '/planner');
    await expect(today(page)).toContainText('Vermieter antworten');
    await today(page).getByRole('button', { name: 'Aktionen für Vermieter antworten' }).click();
    await page.getByRole('menuitem', { name: 'Zur Notiz' }).click();
    await expect(page).toHaveURL(/\/notes/);
  });

  test('an invoice due Thursday is planned with its deadline; „Im Plan zeigen“ off takes it away', async ({
    page,
  }) => {
    await enablePlanner(page);
    await put(page, 'invoices_invoice', {
      id: 'inv-stadtwerke',
      payee: 'Stadtwerke',
      amountMinor: 8990,
      dueDate: '2026-11-12',
      status: 'open',
    });
    await ready(page, '/planner');
    // exact: the head's detail line names today's first thing too („Heute: Stadtwerke bezahlen. …“).
    const row = page.getByText('Stadtwerke bezahlen', { exact: true });
    await expect(row).toBeVisible();
    const day = page.locator('[data-testid^="day-"]', { hasText: 'Stadtwerke bezahlen' });
    await expect(day).toContainText('Frist Do');
    // Paying stays in Rechnungen: no tick, no „Erledigt“ in the row menu.
    await expect(day.getByRole('checkbox', { name: 'Stadtwerke bezahlen' })).toHaveCount(0);
    await day.getByRole('button', { name: 'Aktionen für Stadtwerke bezahlen' }).click();
    await expect(page.getByRole('menuitem', { name: 'Erledigt' })).toHaveCount(0);
    await page.getByRole('menuitemcheckbox', { name: 'Warum hier?' }).click();
    await expect(day).toContainText(/muss bis Do fertig sein|neu, nach Priorität/);
    await ready(page, '/settings/module/invoices');
    const sw = page.getByRole('switch', { name: 'Im Plan zeigen' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await ready(page, '/planner');
    await expect(page.getByLabel('Eintragen oder sagen', { exact: true })).toBeVisible();
    await expect(page.getByText('Stadtwerke bezahlen')).toHaveCount(0);
  });

  test('overflow 0 → above 0: one toast line; a second entry keeps quiet, the group head stays current', async ({
    page,
  }) => {
    await enablePlanner(page);
    await smallWeek(page);
    await ready(page, '/planner');
    await enter(page, 'Kurz 15min');
    await expect(toast(page)).toContainText('Eingetragen');
    await expect(toast(page)).not.toContainText('mehr zu tun');
    await enter(page, 'Umzug planen 5 Std');
    await expect(toast(page)).toContainText('mehr zu tun, als Zeit frei ist');
    await expect(toast(page).getByRole('button', { name: 'Rückgängig' })).toBeVisible();
    await expect(waitingHead(page)).toContainText('Wartet auf freie Zeit');
    // Folded, the head carries the count and the calming sentence; the hours wait inside.
    await expect(waitingHead(page)).toContainText('Nichts davon muss heute sein.');
    await expect(waitingHead(page)).not.toContainText('mehr zu tun');
    await openWaiting(page);
    await expect(overload(page)).toContainText('mehr zu tun, als Zeit frei ist');
    const first = await overload(page).innerText();
    await enter(page, 'Keller 1 Std');
    await expect(toast(page)).toContainText('Eingetragen');
    await expect(toast(page)).not.toContainText('mehr zu tun');
    await expect(overload(page)).not.toHaveText(first);
    await expect(overload(page)).toContainText('mehr zu tun, als Zeit frei ist');
  });

  test('switch `overloadToast` off → no toast line, the figure stays in the opened group', async ({
    page,
  }) => {
    await enablePlanner(page);
    await smallWeek(page);
    const sw = page.getByRole('switch', { name: 'Überlast im Hinweis nennen' });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await ready(page, '/planner');
    await enter(page, 'Umzug planen 5 Std');
    await expect(toast(page)).toContainText('Eingetragen');
    await expect(toast(page)).not.toContainText('mehr zu tun');
    await openWaiting(page);
    await expect(overload(page)).toContainText('mehr zu tun, als Zeit frei ist');
  });
});

test.describe('Planer (time windows, templates – package 5)', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'wide board only');
  });

  test('a window on the day sheet puts the sessions as blocks into the hour grid', async ({
    page,
  }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Blogpost 90min');
    await enter(page, 'Keller 30min');
    await expect(today(page)).toContainText('Keller');
    await today(page)
      .getByRole('button', { name: /^Mo\.? 9\./ })
      .click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('Ohne Zeitfenster');
    const form = sheet.getByTestId('day-window');
    await form.getByLabel('Von').fill('09:00');
    await form.getByLabel('Bis').fill('12:00');
    await form.getByRole('button', { name: 'Fenster setzen' }).click();
    await expect(sheet).toContainText('Zeitfenster 09:00–12:00 – nur an diesem Tag.');
    // Minutes stay the truth: the window changes nothing about what is planned.
    await expect(sheet.getByTestId('day-available')).toHaveText('4 h');
    await page.keyboard.press('Escape');
    // The week view is the hour grid from 1400 px. Both things were entered in the same (fixed) minute,
    // so their order is the id tie-break: the first starts at 09:00, the second after a pause.
    await page.setViewportSize({ width: 1600, height: 1000 });
    await ready(page, '/calendar?view=week&date=2026-11-09');
    const grid = page.getByRole('group', { name: 'Zeitraster' });
    const blog = grid.getByRole('button').filter({ hasText: 'Blogpost' });
    const cellar = grid.getByRole('button').filter({ hasText: 'Keller' });
    await expect(blog).toHaveText(/^(09:00|09:45) Blogpost$/);
    await expect(cellar).toHaveText(/^(09:00|10:45) Keller$/);
    expect(
      [await blog.textContent(), await cellar.textContent()].some((x) => x?.startsWith('09:00')),
    ).toBe(true);
    // Every session of Monday has a time: no summary chip for Monday (other days keep theirs).
    await expect(grid.getByRole('button').filter({ hasText: 'Plan · ' })).toHaveCount(0);
  });

  test('„Woche prüfen“ → „Krank“: today is free, one calm sentence, undo', async ({ page }) => {
    await enablePlanner(page);
    await ready(page, '/planner');
    await enter(page, 'Blogpost 90min');
    await page.getByRole('button', { name: 'Weitere Optionen' }).click();
    await page.getByRole('menuitem', { name: 'Woche prüfen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Woche prüfen' });
    await dialog
      .getByRole('group', { name: 'Vorlage für die Woche' })
      .getByRole('button', { name: 'Krank' })
      .click();
    await dialog.getByRole('button', { name: 'Passt so' }).click();
    await expect(page.getByText('Ruh dich aus – der Plan rückt ruhig weiter.')).toBeVisible();
    await expect(page.getByTestId('planner-head')).toContainText('Heute ist frei.');
    await expect(await day(page, '2026-11-10')).toContainText('Blogpost');
    await page.getByRole('button', { name: 'Rückgängig' }).last().click();
    await expect(page.getByTestId('planner-head')).not.toContainText('Heute ist frei.');
  });
});
