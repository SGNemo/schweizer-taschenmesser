import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev } from '../seed/helpers';

/**
 * UI round 6, part 2: the setup assistant step by step (empty app, desktop + phone, dark + light).
 * Usage: SCREENS_DIR=.screens/round6 npx playwright test -c playwright.round6.config.ts round6-setup
 */
const OUT = process.env.SCREENS_DIR ?? '.screens/round6';
const VPS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '412x915', width: 412, height: 915, mobile: true },
];

for (const vp of VPS)
  for (const scheme of ['dark', 'light'] as const) {
    test(`setup ${vp.name} ${scheme}`, async ({ browser }) => {
      test.setTimeout(0);
      const dir = `${OUT}/${vp.name}-${scheme}/setup`;
      mkdirSync(dir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: !!vp.mobile,
        hasTouch: !!vp.mobile,
        deviceScaleFactor: 1,
        colorScheme: scheme,
      });
      const page = await context.newPage();
      await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
      await page.addInitScript(
        (isDesktop) => {
          localStorage.setItem('tm-show-preview', '1');
          if (isDesktop) localStorage.setItem('__tmPlatformKind', 'desktop');
        },
        !vp.mobile,
      );
      await bootDev(page);
      await page.goto('/settings/einrichtung');
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(800);
      const notice = page.getByRole('button', { name: 'Schließen', exact: true });
      if (await notice.count()) await notice.first().click().catch(() => {});
      await page.screenshot({ path: `${dir}/settings-einrichtung.png`, fullPage: !!vp.mobile });
      const facts: Record<string, unknown> = {};
      const start = page.getByRole('button', { name: /Einrichtung starten|Fortsetzen|starten/i }).first();
      facts.startFound = await start.count();
      if (!(await start.count())) {
        const link = page.getByRole('link', { name: /Einrichtung starten|Fortsetzen/i }).first();
        facts.startLink = await link.count();
        if (await link.count()) await link.click();
      } else await start.click();
      await page.waitForTimeout(900);
      for (let step = 0; step < 16; step++) {
        const name = `${dir}/step-${String(step).padStart(2, '0')}.png`;
        await page.screenshot({ path: name, fullPage: !!vp.mobile });
        const info = await page.evaluate(() => {
          const dlg = document.querySelector('dialog[open], [role="dialog"]') as HTMLElement | null;
          const root = dlg ?? document.getElementById('main') ?? document.body;
          const h = root.querySelector('h1, h2');
          const prim = Array.from(root.querySelectorAll<HTMLElement>('button, a')).filter((b) =>
            /(^|_| )primary(_|$| )/.test(String(b.className)),
          );
          const doc = document.documentElement;
          return {
            url: location.pathname,
            title: h?.textContent?.trim().slice(0, 80) ?? null,
            primaries: prim.map((p) => p.innerText.trim().slice(0, 40)),
            overflow: doc.scrollWidth - doc.clientWidth,
            progress: Array.from(root.querySelectorAll<HTMLElement>('[role="progressbar"], progress'))
              .map((p) => p.getAttribute('aria-valuenow') ?? p.getAttribute('value'))
              .join(','),
          };
        });
        facts[`step-${step}`] = info;
        const next = page
          .getByRole('button', { name: /^(Weiter|Überspringen|Fertig|Los geht’s|Los geht's|Später|Nicht jetzt)$/ })
          .first();
        if (!(await next.count()) || !(await next.isVisible().catch(() => false))) break;
        const label = await next.innerText();
        await next.click().catch(() => {});
        await page.waitForTimeout(700);
        if (/Fertig/.test(label)) {
          await page.screenshot({ path: `${dir}/step-${String(step + 1).padStart(2, '0')}-done.png` });
          break;
        }
      }
      writeFileSync(`${dir}/facts.json`, JSON.stringify(facts, null, 2));
      await context.close();
    });
  }
