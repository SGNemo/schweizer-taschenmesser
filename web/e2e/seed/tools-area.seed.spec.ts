import { expect, type Page } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { openToolbox } from '../helpers';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * The tools after package 0b-E, part E-2 of UI audit 2026-11 (rules 1 and 2 of Identity 4.0): `/tools` has the title
 * line (≤ 120 px on the desktop, ≤ 144 px on the phone), the tool page and Einstellungen → Werkzeugkasten show the
 * same row, a tool that is off carries one control (its switch), nothing in `main` has a frame or a shadow, and no
 * tool in the tools panel draws a shadow (tone steps; the one frame that stays is the persona's stamp).
 */
const LISTS = ['/tools', '/settings/werkzeuge'] as const;
const HEAD_MAX = { desktop: 120, phone: 144 } as const;

interface Row {
  name: string;
  on: boolean;
  controls: number;
  height: number;
}

/** Runs in the page: the tool rows of the list (`tool-<id>` on the tool page, `tools--<id>` in the settings). */
function readRows(): Row[] {
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  return Array.from(
    document.querySelectorAll<HTMLElement>('main [data-testid^="tool-"], main [id^="tools--"]'),
  )
    .filter(shown)
    .map((row) => {
      const sw = row.querySelector('[role="switch"]');
      return {
        name: (row.textContent ?? '').trim().slice(0, 24),
        on: sw?.getAttribute('aria-checked') === 'true',
        controls: Array.from(row.querySelectorAll('button, a[href], [role="switch"]')).filter(shown)
          .length,
        height: Math.round(row.getBoundingClientRect().height),
      };
    });
}

/** Runs in the page: elements inside the open tools panel with a blurred or offset shadow, or a full frame. */
function readPanel(): { shadows: string[]; frames: string[] } {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  const shadows: string[] = [];
  const frames: string[] = [];
  if (!dialog) return { shadows, frames };
  for (const el of Array.from(dialog.querySelectorAll<HTMLElement>('*'))) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') continue;
    const name = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
    // A ring (`0 0 0 n`, inset or not) is no shadow; anything blurred or offset is.
    if (s.boxShadow !== 'none') {
      const parts = s.boxShadow.split(/,(?![^(]*\))/);
      if (
        parts.some(
          (p) => !/(^|\s)0px 0px 0px /.test(p.replace(/rgba?\([^)]*\)|color\([^)]*\)/g, '')),
        )
      )
        shadows.push(name);
    }
    const w = s.borderTopWidth;
    if (
      parseFloat(w) > 0 &&
      [s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].every((x) => x === w) &&
      s.borderTopStyle === 'solid' &&
      !el.matches('input, select, textarea, button')
    )
      frames.push(name);
  }
  return { shadows, frames };
}

async function check(page: Page, phone: boolean) {
  await startSeeded(page, { phone });
  // Every tool on, so the panel lists all of them and both lists show the row of a tool that is on.
  await openPage(page, '/tools');
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
  const total = await page.locator('main [data-testid^="tool-"]').count();
  expect(total, 'tools on the tool page').toBeGreaterThanOrEqual(10);
  // One tool stays off: the row of a tool that is off is part of the promise.
  const off = page.locator('main [data-testid^="tool-"] [role="switch"][aria-checked="false"]');
  while ((await off.count()) > 1) {
    await off.first().click();
    await page.waitForTimeout(150);
  }

  for (const path of LISTS) {
    await openPage(page, path);
    await page.waitForTimeout(700);
    const m = surfaceMetrics(await page.evaluate(measurePage));
    expect.soft(m.borders, `${path}: framed elements in main`).toBe(0);
    expect.soft(m.shadows, `${path}: shadows in main`).toBe(0);
    const rows = await page.evaluate(readRows);
    expect.soft(rows.length, `${path}: tool rows`).toBe(total);
    for (const r of rows) {
      // Off: the switch alone. On: at most the grip, "Öffnen", the menu and the switch.
      if (!r.on) expect.soft(r.controls, `${path}: "${r.name}" is off`).toBe(1);
      else expect.soft(r.controls, `${path}: "${r.name}" is on`).toBeLessThanOrEqual(4);
      expect
        .soft(r.height, `${path}: "${r.name}" row height`)
        .toBeGreaterThanOrEqual(phone ? 48 : 44);
    }
    expect
      .soft(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `${path}: the page scrolls sideways`,
      )
      .toBe(false);
  }

  await openPage(page, '/tools');
  const head = await page.getByTestId('tools-head').boundingBox();
  expect(head, 'the tool page has its title line').not.toBeNull();
  expect(head!.height, 'head of the tool page').toBeLessThanOrEqual(
    phone ? HEAD_MAX.phone : HEAD_MAX.desktop,
  );
  await expect(page.locator('main h1')).toHaveCount(1);

  // Every tool in the panel: no shadow; the only frame is the persona's stamp.
  await page.goto('/');
  const dialog = await openToolbox(page);
  const names = await dialog
    .getByRole('navigation')
    .first()
    .getByRole('button')
    .evaluateAll((els) =>
      els.map((e) => (e.getAttribute('aria-label') ?? (e as HTMLElement).innerText).trim()),
    );
  let opened = 0;
  for (let i = 0; i < names.length; i++) {
    const list = await openToolbox(page);
    const button = list.getByRole('navigation').first().getByRole('button').nth(i);
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click();
    await page.waitForTimeout(350);
    const p = await page.evaluate(readPanel);
    expect.soft(p.shadows, `${names[i]}: shadows in the panel`).toEqual([]);
    expect
      .soft(p.frames.length, `${names[i]}: frames in the panel (${p.frames.join(', ')})`)
      .toBeLessThanOrEqual(1);
    opened += 1;
  }
  expect(opened, 'tools opened in the panel').toBeGreaterThanOrEqual(10);
}

test.describe('tools on tone steps (Identity 4.0, package 0b-E part E-2)', () => {
  test.setTimeout(240_000);

  test.describe('desktop', () => {
    test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
    test('tool page, Werkzeugkasten and every tool: one row, no frames, no shadows', async ({
      page,
    }) => {
      await check(page, false);
    });
  });

  test.describe('phone', () => {
    test.use({
      viewport: PHONE,
      isMobile: true,
      hasTouch: true,
      seeded: { scale: 'medium', preview: true },
    });
    test('tool page, Werkzeugkasten and every tool: one row, no frames, no shadows', async ({
      page,
    }) => {
      await check(page, true);
    });
  });
});
