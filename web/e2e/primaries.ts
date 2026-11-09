import type { Page } from '@playwright/test';

/**
 * Visible filled primary actions inside `main` (their labels), measured like the UI round 6 tour
 * (`docs/qa/round-6/tools/round6.spec.ts`): a view has at most one (design-rules "primary einmal").
 */
export function primaryActions(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main button, main a'))
      .filter((el) => /(^|_| )primary(_|$| )/.test(String(el.className)))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      })
      .map((el) => (el.textContent ?? '').trim() || el.getAttribute('aria-label') || '?'),
  );
}
