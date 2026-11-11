/**
 * Accessibility check of the built site (needs `npm run preview` or SITE_PREVIEW_URL): axe-core (WCAG 2.1 A + AA)
 * on every page at 360 and 1280, light and dark, plus what axe does not look at: text contrast inside the drawn
 * picture slots (role="img" hides them from axe), the size of stand-alone links and buttons (44 px; links inside a
 * sentence are exempt), horizontal overflow and the heading order. Exit 1 on any finding.
 *
 *   npm run a11y            SITE_PAGES=/,/module limits the pages
 */
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';

const base = process.env.SITE_PREVIEW_URL || 'http://localhost:4321';
const pages = (process.env.SITE_PAGES || '/,/module,/daten,/unterstuetzen,/install,/impressum,/datenschutz,/404,/en,/en/modules,/en/data,/en/support,/en/install,/en/imprint,/en/privacy').split(',');
const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' });
let findings = 0;
const report = (where, what) => { findings++; console.log(`${where}: ${what}`); };

for (const p of pages) {
  for (const width of [360, 1280]) {
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const where = `${p} ${width} ${scheme}`;
      await page.addScriptTag({ path: axePath });
      const axe = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }));
      for (const v of axe.violations) report(where, `axe ${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      const own = await page.evaluate(() => {
        const out = [];
        const lum = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rgba = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
        const over = (top, under) => { const a = top[3] / 255; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(255); };
        const bgOf = (el) => {
          const stack = [];
          for (let e = el; e; e = e.parentElement) stack.push(rgba(getComputedStyle(e).backgroundColor));
          return stack.reverse().reduce((under, top) => over(top, under), [255, 255, 255, 255]);
        };
        // 1 Contrast of the text inside the drawn slots and the diagram (axe skips role="img").
        for (const art of document.querySelectorAll('[role="img"]')) {
          const walker = document.createTreeWalker(art, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent.trim()) continue;
            const el = n.parentElement;
            const cs = getComputedStyle(el);
            const bg = bgOf(el);
            const fg = over(rgba(cs.color), bg);
            const [a, b] = [lum(fg), lum(bg)];
            const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            const size = parseFloat(cs.fontSize);
            const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
            if (ratio < (large ? 3 : 4.5)) out.push(`contrast ${ratio.toFixed(2)} in a drawing: "${n.textContent.trim().slice(0, 30)}"`);
          }
        }
        // 2 Target size: stand-alone links and buttons are at least 44 px high; a link inside a sentence is exempt.
        for (const el of document.querySelectorAll('a[href], button')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const inline = el.tagName === 'A' && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
          if (!inline && r.height < 43.5) out.push(`target ${Math.round(r.width)}x${Math.round(r.height)}: "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`);
        }
        // 3 No horizontal scrolling. 4 Headings descend one level at a time, one h1.
        if (document.documentElement.scrollWidth > innerWidth) out.push(`overflow: page is ${document.documentElement.scrollWidth} px wide`);
        const levels = [...document.querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1]));
        if (levels.filter((l) => l === 1).length !== 1) out.push(`headings: ${levels.filter((l) => l === 1).length} h1`);
        levels.forEach((l, i) => { if (i > 0 && l > levels[i - 1] + 1) out.push(`headings: h${levels[i - 1]} is followed by h${l}`); });
        return out;
      });
      for (const o of own) report(where, o);
      await page.close();
    }
  }
}
await browser.close();
console.log(`a11y: ${pages.length} pages x 2 widths x 2 themes, ${findings} findings`);
process.exit(findings ? 1 : 0);
