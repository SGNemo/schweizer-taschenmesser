import { expect, test, type Page } from '@playwright/test';

/**
 * Layout check for long texts: every language, plus pseudo text (German source about 40 % longer,
 * accented, in ⟦ ⟧; the English catalog is swapped for it in e2e builds only, `core/i18n/catalogs.ts`).
 * The main views must survive at phone and desktop width: no sideways page scroll and no text cut
 * off by a box that hides its overflow without an ellipsis.
 */

const VIEWS = [
  '/',
  '/todos',
  '/calendar',
  '/finance',
  '/library',
  '/tools',
  '/settings/allgemein',
  '/settings/darstellung',
  '/settings/sync',
];
const WIDTHS = [360, 1280];
const LANGS = ['pseudo', 'de', 'en', 'es', 'fr', 'pt-BR'] as const;

interface Problem {
  kind: 'page-scroll' | 'clipped';
  where: string;
  text: string;
}

async function findProblems(page: Page): Promise<Problem[]> {
  return page.evaluate(() => {
    const out: Problem[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 1)
      out.push({ kind: 'page-scroll', where: `${doc.scrollWidth}px`, text: '' });
    const describe = (el: Element) =>
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : '') +
      (el.getAttribute('data-testid') ? `[data-testid=${el.getAttribute('data-testid')}]` : '') +
      (el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '');
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      const ownText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!ownText) continue;
      const style = getComputedStyle(el);
      const hides = ['hidden', 'clip'].includes(style.overflowX);
      if (!hides || style.textOverflow === 'ellipsis') continue;
      // Visually hidden helpers (sr-only) are 1 px boxes by design.
      if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)
        out.push({ kind: 'clipped', where: describe(el), text: ownText.slice(0, 60) });
    }
    return out;
  });
}

for (const lang of LANGS)
  for (const width of WIDTHS) {
    test(`${lang}: main views keep their layout at ${width} px`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop-chrome', 'widths are set explicitly');
      await page.addInitScript((l) => {
        if (l === 'pseudo') localStorage.setItem('__tmPseudo', '1');
        localStorage.setItem('tm-lang', l === 'pseudo' ? 'en' : l);
      }, lang);
      await page.setViewportSize({ width, height: 800 });
      const problems: string[] = [];
      for (const view of VIEWS) {
        await page.goto(view);
        await expect(page.locator('main h1')).toBeVisible();
        if (lang === 'pseudo') await expect(page.locator('main h1')).toContainText('⟦');
        for (const p of await findProblems(page))
          problems.push(`${view} ${p.kind} ${p.where} "${p.text}"`);
      }
      expect(problems).toEqual([]);
    });
  }
