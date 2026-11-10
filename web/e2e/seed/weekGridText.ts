import type { Page } from '@playwright/test';

/**
 * Text faults of the hour grid's blocks (UI audit 2026-11, AE4), one line per fault: a line cut at the block's lower
 * edge, a word broken inside (a break after a hyphen is fine), a title that would be cut instead of ending in an
 * ellipsis, the time on a line of its own in a block of up to one hour, or a lane narrower than `MIN_LANE_REM` (4.5 rem,
 * `modules/calendar/views.ts`). An empty list means the grid is clean.
 */
export function weekGridTextFaults(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const faults: string[] = [];
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const col = document.querySelector<HTMLElement>('[data-date]');
    if (!col) return ['no hour grid'];
    const hour = col.getBoundingClientRect().height / 24;
    const blocks = document.querySelectorAll<HTMLElement>('[data-date] [class*="tgItem"]');
    if (!blocks.length) return ['no blocks'];
    for (const block of blocks) {
      const title = block.querySelector<HTMLElement>('[class*="tgTitle"]');
      const time = block.querySelector<HTMLElement>('[class*="tgTime"]');
      const name = (block.textContent ?? '').slice(0, 40);
      if (!title || !time) {
        faults.push(`${name}: no title or time element`);
        continue;
      }
      const box = block.getBoundingClientRect();
      const text = title.getBoundingClientRect();
      const style = getComputedStyle(title);
      const lines = text.height / parseFloat(style.lineHeight);
      if (Math.abs(lines - Math.round(lines)) > 0.05 || lines < 0.95)
        faults.push(`${name}: ${lines.toFixed(2)} lines (a line is cut)`);
      if (text.bottom > box.bottom + 0.5 || text.right > box.right + 0.5)
        faults.push(`${name}: the title leaves its block`);
      if (style.textOverflow !== 'ellipsis' || style.overflowWrap !== 'normal')
        faults.push(`${name}: a long word would be cut or broken, not end in an ellipsis`);
      if (box.width < 4.5 * rem - 5) faults.push(`${name}: lane of ${Math.round(box.width)} px`);
      const node = title.firstChild;
      if (node?.nodeType === Node.TEXT_NODE) {
        for (const word of (node.textContent ?? '').matchAll(/[^\s-]+-?/g)) {
          const range = document.createRange();
          range.setStart(node, word.index);
          range.setEnd(node, word.index + word[0].length);
          const tops = new Set(
            [...range.getClientRects()].filter((r) => r.width > 1).map((r) => Math.round(r.top)),
          );
          if (tops.size > 1) faults.push(`${name}: "${word[0]}" is broken inside the word`);
        }
      }
      const shown = time.getBoundingClientRect();
      const short = box.height <= hour;
      if (short && shown.width > 2 && Math.abs(shown.top - text.top) > 4)
        faults.push(`${name}: the time has a line of its own`);
    }
    return faults;
  });
}
