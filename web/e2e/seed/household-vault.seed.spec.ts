import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * Household and vault after package 0b-5 of UI audit 2026-11 (Listen, Vorräte, Fitness, Unterlagen, Passwörter; rules
 * 1, 4 and 5 of Identity 4.0): surfaces are tone steps (no framed element and no shadow in `main`; the two signature
 * blocks `vault-doc` and `pantry-label` keep their frame and frame nothing inside), the views are `Tabs`, the head
 * holds one filled action, the first content starts at y ≤ 220 px on the phone, rows are at least 48 px high on the
 * phone and 44 px on the desktop, and nothing runs out sideways. The passwords page is measured locked and open; it
 * never carries a reading-aid mark (`[data-rs]`), and neither does the documents page. Further cases: the documents
 * page is master–detail on a wide window and stays readable on a 1280-px laptop, the add field of a list is its last
 * row, and the entry dialog of the passwords keeps its foot on screen on the phone (finding B10).
 *
 * `HV_SHOTS=<dir>` also writes a picture of every first screen in both themes (for the pull request).
 */
const PAGES = ['/lists', '/pantry', '/fitness', '/vault', '/accounts'] as const;
type Path = (typeof PAGES)[number];
const CONTENT_Y_PHONE = 220;
const SHOTS = process.env.HV_SHOTS;
/** Demo vault of the test data (`modules/accounts/seed.ts`). */
const DEMO_PASSPHRASE = 'nemo-demo-tresor'; // gitleaks:allow
/** The framed blocks that stay, and the page each lies on. */
const BLOCK: Partial<Record<Path, string>> = { '/vault': 'vault-doc', '/pantry': 'pantry-label' };
/** Pages whose views are tabs in the head. */
const TABBED: readonly Path[] = ['/lists', '/pantry', '/fitness', '/vault'];

interface Read {
  /** Top of the first thing of the page below the head (viewport px). */
  contentY: number | null;
  headHeight: number;
  /** Filled buttons of the head's action zone. */
  primaries: string[];
  /** Every visible control of the head's action zone. */
  headControls: string[];
  tabs: number;
  segmentedInTabs: number;
  /** Filled buttons anywhere in `main` (head included). */
  filled: number;
  rowHeights: number[];
  sideways: boolean;
  titleCut: boolean;
  /** Reading-aid marks on the page. */
  readMarks: number;
  /** Signature blocks: id and whether the element has a name a screen reader can say (its row's title). */
  blocks: { id: string; named: boolean }[];
}

/** Runs in the page. */
function read(): Read {
  const main = document.querySelector('main')!;
  const head = document.querySelector<HTMLElement>('[data-testid="module-frame"]');
  const headBox = head?.getBoundingClientRect();
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  let contentY: number | null = null;
  for (const el of Array.from(main.querySelectorAll<HTMLElement>('*'))) {
    if (head?.contains(el) || !shown(el)) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const ownText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
    );
    if (!ownText && !el.matches('button, input, select, svg')) continue;
    const top = el.getBoundingClientRect().top;
    if (headBox && top < headBox.bottom - 1) continue;
    if (contentY === null || top < contentY) contentY = Math.round(top);
  }
  const actions = head?.querySelector('[data-testid="module-actions"]');
  // The gear ("Dieses Modul anpassen") is the shell's, not the page's.
  const controls = Array.from(actions?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])
    .filter(shown)
    .filter((el) => !/Modul anpassen/.test(el.getAttribute('aria-label') ?? ''));
  const name = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
  const tabsRow = head?.querySelector('[data-slot="tabs"]');
  const h1 = head?.querySelector('h1');
  return {
    contentY,
    headHeight: Math.round(headBox?.height ?? 0),
    primaries: controls.filter((c) => c.getAttribute('data-variant') === 'primary').map(name),
    headControls: controls.map(name),
    tabs: tabsRow?.querySelectorAll('nav button, nav a').length ?? 0,
    segmentedInTabs: tabsRow?.querySelectorAll('[role="group"] [aria-pressed]').length ?? 0,
    filled: Array.from(main.querySelectorAll('[data-variant="primary"]')).filter(shown).length,
    rowHeights: Array.from(main.querySelectorAll<HTMLElement>('[data-row]'))
      .filter(shown)
      .slice(0, 12)
      .map((el) => Math.round((el.closest('li') ?? el).getBoundingClientRect().height)),
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    titleCut: !!h1 && h1.scrollWidth > h1.clientWidth,
    readMarks: document.querySelectorAll('[data-rs]').length,
    blocks: Array.from(main.querySelectorAll('[data-signature-block]')).map((el) => ({
      id: el.getAttribute('data-signature-block') ?? '',
      named: (el.querySelector('[data-row]')?.textContent ?? '').trim() !== '',
    })),
  };
}

async function closeNotice(page: Page) {
  // The Dev-Preview notice would lie over the picture.
  const notice = page.getByRole('button', { name: 'Schließen', exact: true });
  if (await notice.count()) await notice.first().click();
}

async function unlock(page: Page) {
  await page.getByLabel('Master-Passwort', { exact: true }).fill(DEMO_PASSPHRASE);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('vault-door')).toHaveAttribute('data-state', 'open', {
    timeout: 30_000,
  });
}

async function check(page: Page, phone: boolean, theme: string) {
  await startSeeded(page, { phone });
  const seen: Record<string, unknown> = {};
  const shot = async (name: string) => {
    if (!SHOTS) return;
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({
      path: join(SHOTS, `${phone ? 'phone' : 'desktop'}-${theme}-${name}.png`),
    });
  };
  for (const path of PAGES) {
    await openPage(page, path);
    await closeNotice(page);
    // Live queries settle.
    await page.waitForTimeout(600);
    if (path === '/accounts') {
      // Locked: the door, the field, nothing of the content; no mark of the reading aid.
      const locked = await page.evaluate(read);
      await shot('accounts-locked');
      expect.soft(locked.readMarks, '/accounts locked: reading-aid marks').toBe(0);
      expect.soft(locked.sideways, '/accounts locked: no sideways overflow').toBe(false);
      await expect.soft(page.locator('main [data-row]'), 'locked: no entry row').toHaveCount(0);
      await unlock(page);
      await page.waitForTimeout(400);
    }
    const r = await page.evaluate(read);
    const m = surfaceMetrics(await page.evaluate(measurePage));
    seen[path] = {
      contentY: r.contentY,
      head: r.headHeight,
      borders: m.borders,
      shadows: m.shadows,
      coloured: m.colouredAboveFold,
      blocks: m.signatureBlocks,
      controls: r.headControls,
      rows: r.rowHeights.slice(0, 3),
    };
    await shot(path.slice(1));
    // Rule 1: tone steps. A signature block's own frame is not counted; nothing inside it is framed.
    expect.soft(m.borders, `${path}: framed elements in main`).toBe(0);
    expect.soft(m.shadows, `${path}: shadows in main`).toBe(0);
    const ids = [...new Set(r.blocks.map((b) => b.id))];
    expect.soft(ids, `${path}: signature blocks`).toEqual(BLOCK[path] ? [BLOCK[path]] : []);
    expect
      .soft(r.blocks.filter((b) => !b.named).length, `${path}: a signature block without its title`)
      .toBe(0);
    // Rule 2/4: tabs for the views, one filled action.
    expect.soft(r.segmentedInTabs, `${path}: a Segmented in the row of the tabs`).toBe(0);
    if (TABBED.includes(path))
      expect.soft(r.tabs, `${path}: the views are tabs`).toBeGreaterThanOrEqual(2);
    expect.soft(r.filled, `${path}: filled buttons on the page`).toBeLessThanOrEqual(1);
    if (phone) {
      expect.soft(r.headControls, `${path}: the phone's head holds no action`).toEqual([]);
      // The plus is the page's action; on the passwords page it stays the plain capture (the vault is no target of
      // the plus: `modules/accounts/__tests__/exclusion.test.ts`).
      await expect
        .soft(page.getByTestId('bottom-plus'), `${path}: the plus`)
        .toHaveAccessibleName(path === '/accounts' ? 'Neu eintragen' : /\S+ eintragen$/);
      // Rule 5: the page starts on the first screen (the open passwords page starts with its search field).
      expect.soft(r.contentY, `${path}: first content below the head`).not.toBeNull();
      expect
        .soft(r.contentY ?? 9999, `${path}: content starts at y ≤ ${CONTENT_Y_PHONE} px`)
        .toBeLessThanOrEqual(CONTENT_Y_PHONE);
    } else {
      expect.soft(r.primaries, `${path}: exactly one filled action in the head`).toHaveLength(1);
      // The filled action and the "⋯" menu; the passwords page also keeps "Jetzt sperren" in sight.
      expect
        .soft(r.headControls.length, `${path}: ${r.headControls.join(' | ')}`)
        .toBeLessThanOrEqual(path === '/accounts' ? 3 : 2);
      await expect
        .soft(page.locator('[data-testid="module-actions"] [role="switch"]'), `${path}: no switch`)
        .toHaveCount(0);
    }
    expect.soft(r.sideways, `${path}: no sideways overflow`).toBe(false);
    expect.soft(r.titleCut, `${path}: the h1 is cut`).toBe(false);
    // Rule 5: 48 px rows on the phone, 44 px on the desktop (a row may be taller, never lower).
    for (const h of r.rowHeights)
      expect.soft(h, `${path}: row height`).toBeGreaterThanOrEqual(phone ? 48 : 44);
    // The vault pages never carry a mark of the reading aid.
    if (path === '/vault' || path === '/accounts')
      expect.soft(r.readMarks, `${path}: reading-aid marks`).toBe(0);
  }
  console.log(`household+vault ${phone ? 'phone' : 'desktop'} ${theme}: ${JSON.stringify(seen)}`);
}

for (const theme of SHOTS ? (['light', 'dark'] as const) : (['light'] as const)) {
  test.describe(`household and vault on tone steps (Identity 4.0, package 0b-5), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(180_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('five pages: no frames but the signature blocks, tabs, one action', async ({ page }) => {
        await check(page, false, theme);
      });
    });

    test.describe('phone', () => {
      test.use({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        seeded: { scale: 'medium', preview: true },
      });
      test('five pages: content from y ≤ 220 px, the plus is the action', async ({ page }) => {
        await check(page, true, theme);
      });
    });
  });
}

test.describe('documents: master–detail', () => {
  test.describe('wide window', () => {
    test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
    test('a folder shows in the panel, "Bearbeiten" opens its dialog', async ({ page }) => {
      await startSeeded(page);
      await openPage(page, '/vault');
      const panel = page.getByTestId('document-detail');
      // The first folder is shown from the start and marked in the list.
      await expect(panel).toBeVisible();
      await expect(page.locator('main [aria-current="true"]')).toHaveCount(1);
      await page.locator('main [data-row]', { hasText: 'Handyvertrag' }).first().click();
      await expect(panel.getByRole('heading', { name: 'Handyvertrag' })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await panel.getByRole('button', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('dialog', { name: 'Unterlage bearbeiten' })).toBeVisible();
      // The privacy sentence stays on screen beside the panel.
      await expect(page.getByTestId('vault-local')).toBeVisible();
    });
  });

  test.describe('1280-px laptop', () => {
    test.use({
      viewport: { width: 1280, height: 720 },
      seeded: { scale: 'medium', desktop: true, preview: true },
    });
    test('titles keep their room beside the panel, nothing runs out sideways', async ({ page }) => {
      await startSeeded(page);
      await openPage(page, '/vault');
      await page.waitForTimeout(400);
      const seen = await page.evaluate(() => ({
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        // Width of the narrowest folder title: a title squeezed to a few letters per line is far below this.
        narrowest: Math.min(
          ...Array.from(document.querySelectorAll('main [data-signature-block] [data-row]')).map(
            (el) => el.getBoundingClientRect().width,
          ),
        ),
      }));
      expect(seen.sideways).toBe(false);
      expect(seen.narrowest).toBeGreaterThanOrEqual(160);
    });
  });
});

test.describe('lists: the add field is the last row', () => {
  test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });
  test('the field lies below the rows; `?new=1` leads to it, typing and Enter adds', async ({
    page,
  }) => {
    await startSeeded(page);
    await openPage(page, '/lists?new=1');
    const field = page.getByTestId('lists-add').getByRole('textbox').first();
    const below = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('main [data-row]'));
      const add = document.querySelector('[data-testid="lists-add"]')!;
      const last = rows[rows.length - 1]!;
      return add.getBoundingClientRect().top >= last.getBoundingClientRect().bottom - 1;
    });
    expect(below, 'the add row lies below the last row').toBe(true);
    await expect(field).toBeFocused();
    // The head's one action is a new list, not a second way to add an item.
    await expect(page.locator('[data-page-action]')).toHaveText(/Neue Liste/);
    await page.keyboard.type('Zimt');
    await page.keyboard.press('Enter');
    await expect(page.locator('main [data-row]', { hasText: 'Zimt' })).toBeVisible();
  });
});

test.describe('passwords on the phone: the entry dialog keeps its foot (B10)', () => {
  test.use({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    seeded: { scale: 'small', preview: true },
  });
  test('"Speichern" stays on screen while the fields scroll', async ({ page }) => {
    await startSeeded(page, { phone: true });
    await openPage(page, '/accounts');
    await closeNotice(page);
    await unlock(page);
    await page.getByRole('button', { name: 'Zugang hinzufügen' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Zugang hinzufügen' });
    await expect(dialog).toBeVisible();
    const foot = dialog.locator('[data-form-actions]');
    await expect(foot).toHaveCSS('position', 'sticky');
    const save = dialog.getByRole('button', { name: 'Speichern' });
    for (const top of [0, 9999]) {
      await dialog.evaluate((el, y) => el.scrollTo(0, y), top);
      const box = (await save.boundingBox())!;
      expect(box.y, `"Speichern" on screen at scroll ${top}`).toBeGreaterThan(0);
      expect(box.y + box.height, `"Speichern" on screen at scroll ${top}`).toBeLessThanOrEqual(
        PHONE.height,
      );
    }
    // Nothing of the form is marked by the reading aid.
    expect(await page.locator('[data-rs]').count()).toBe(0);
  });
});
