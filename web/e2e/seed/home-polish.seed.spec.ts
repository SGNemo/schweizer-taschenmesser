import { expect, type Page } from '@playwright/test';
import { bootDev, test } from './helpers';
import { DESKTOP, PHONE, startSeeded } from './guards';

/**
 * Overview polish (round "Tiefe", `fix/home-polish`), measured on the seeded Dev-Preview with every module on, in the
 * detailed view: every row of cards is flush (same top, same bottom), the signature mark ends where the card's content
 * ends and stands on the title's line, a context line breaks only between its parts, the notiz paper's rules sit under
 * the text instead of crossing it, a due list never breaks a name into single syllables, and an empty widget is one
 * quiet line without the fish.
 */
async function openDetailed(page: Page, phone: boolean) {
  await page.addInitScript(() => localStorage.setItem('tm-home-view', 'all'));
  await startSeeded(page, { phone });
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  const grid = page.getByTestId('home-grid');
  await expect(grid).not.toHaveAttribute('data-settling', { timeout: 15_000 });
  await expect(grid.locator('[class*="skeleton"]')).toHaveCount(0, { timeout: 15_000 });
  return grid;
}

test.describe('overview polish – desktop 1920', () => {
  test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });

  test('rows are flush: cards that start on one line end on one line', async ({ page }) => {
    const grid = await openDetailed(page, false);
    const ragged = () =>
      grid.evaluate((g) => {
        const rows = new Map<number, { id: string | null; end: number }[]>();
        for (const c of Array.from(g.children)) {
          const r = c.getBoundingClientRect();
          const key = Math.round(r.top);
          rows.set(key, [
            ...(rows.get(key) ?? []),
            { id: c.getAttribute('data-testid'), end: Math.round(r.bottom) },
          ]);
        }
        return [...rows.values()]
          .filter((row) => row.length > 1)
          .filter(
            (row) => Math.max(...row.map((x) => x.end)) - Math.min(...row.map((x) => x.end)) > 1,
          )
          .map((row) => row.map((x) => `${x.id}:${x.end}`).join(' '));
      });
    await expect.poll(ragged, { timeout: 10_000 }).toEqual([]);
    // And the card's own surface fills its cell (the frame, not only the cell, is flush).
    const unfilled = await grid.evaluate((g) =>
      Array.from(g.children)
        .filter((c) => {
          const card = c.querySelector(':scope > section');
          return (
            card &&
            Math.abs(card.getBoundingClientRect().bottom - c.getBoundingClientRect().bottom) > 1
          );
        })
        .map((c) => c.getAttribute('data-testid')),
    );
    expect(unfilled).toEqual([]);
  });

  test('the signature mark ends where the content ends and stands on the title line', async ({
    page,
  }) => {
    const grid = await openDetailed(page, false);
    const off = await grid.evaluate((g) =>
      Array.from(g.children).flatMap((c) => {
        const mark = c.querySelector('[data-testid="signature-mark"]');
        const head = mark?.parentElement;
        const title = c.querySelector('h2');
        if (!mark || !head || !title) return [];
        const m = mark.getBoundingClientRect();
        const h = head.getBoundingClientRect();
        const t = title.getBoundingClientRect();
        const right = Math.round(h.right - m.right);
        const mid = Math.round((m.top + m.bottom) / 2 - (t.top + t.bottom) / 2);
        return right > 1 || Math.abs(mid) > 1
          ? [`${c.getAttribute('data-testid')} right ${right} mid ${mid}`]
          : [];
      }),
    );
    expect(off).toEqual([]);
  });

  test('a context line breaks between its parts, never inside one', async ({ page }) => {
    const grid = await openDetailed(page, false);
    // "Diesen Monat" has two parts ("Noch fällig … · Ausgegeben …"); the balance card's line is one sentence since the
    // finance polish (#998).
    const month = grid.getByTestId('widget-finance:month');
    await expect(month).toBeVisible();
    const parts = await month.evaluate((card) => {
      const spans = Array.from(
        card.querySelectorAll('[data-body="kennzahl"] p:last-of-type > span'),
      );
      return {
        count: spans.length,
        split: spans.filter((x) => x.getClientRects().length > 1).length,
      };
    });
    // The seeded line has several parts; each is one box that never breaks across lines.
    expect(parts.count).toBeGreaterThan(1);
    expect(parts.split).toBe(0);
  });

  test('the notiz paper: every rule lies under a text line, none crosses one', async ({ page }) => {
    const grid = await openDetailed(page, false);
    const notiz = grid.locator('[data-body="notiz"]').first();
    await expect(notiz).toBeVisible();
    const misfit = await notiz.evaluate((box) => {
      // One rule is 1.5 rem (the paper's line); every text box must sit on that grid from the content's top.
      const line = 1.5 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      const top = box.getBoundingClientRect().top + parseFloat(getComputedStyle(box).paddingTop);
      // Every text box starts on a rule boundary and is a whole number of rules high.
      return Array.from(box.querySelectorAll(':scope > p, :scope > ul > li'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => {
          const start = (r.top - top) / line;
          const rows = r.height / line;
          return (
            Math.abs(start - Math.round(start)) > 0.05 || Math.abs(rows - Math.round(rows)) > 0.05
          );
        }).length;
    });
    expect(misfit).toBe(0);
  });
});

test.describe('overview polish – phone 412', () => {
  test.use({ viewport: PHONE, seeded: { scale: 'medium', preview: true } });

  test('a due list never breaks a name into single syllables', async ({ page }) => {
    const grid = await openDetailed(page, true);
    const due = grid.getByTestId('widget-invoices:due');
    await expect(due).toBeVisible();
    const tall = await due.evaluate((card) =>
      Array.from(card.querySelectorAll('li')).flatMap((li) => {
        const title = li.firstElementChild as HTMLElement | null;
        if (!title) return [];
        const lh = parseFloat(getComputedStyle(title).lineHeight);
        const lines = Math.round(title.getBoundingClientRect().height / lh);
        return lines > 2 ? [`${title.textContent} ${lines}`] : [];
      }),
    );
    expect(tall).toEqual([]);
  });
});

test.describe('overview polish – empty app 1920', () => {
  test.use({ viewport: DESKTOP });

  test('an empty widget is one quiet line: no fish', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tm-home-view', 'all');
      localStorage.setItem('tm-show-preview', '1');
      localStorage.setItem('__tmPlatformKind', 'desktop');
    });
    await bootDev(page);
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    const empty = page.locator('[data-testid="home-grid"] > [data-empty]');
    await expect(empty.first()).toBeVisible({ timeout: 15_000 });
    // Inside the empty state (`WidgetBody`'s `data-empty` box) nothing is drawn but the line and its link.
    const fish = await empty.evaluateAll(
      (cards) =>
        cards.filter((c) =>
          Array.from(c.querySelectorAll(':scope [data-empty] svg')).some(
            (svg) => svg.getBoundingClientRect().width > 0,
          ),
        ).length,
    );
    expect(fish).toBe(0);
  });
});
