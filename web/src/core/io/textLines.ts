/** "One line = one entry" input: pasted lists from notes apps, chats or spreadsheets. */

const BULLET = /^\s*(?:[-*•▪◦–]|\d+[.)]|\[[ xX]?\]|☐|☑|✓|✔)\s+/;

export function parseLines(text: string, opts: { max?: number } = {}): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(BULLET, '').trim();
    if (line) out.push(line);
    if (opts.max && out.length >= opts.max) break;
  }
  return out;
}
