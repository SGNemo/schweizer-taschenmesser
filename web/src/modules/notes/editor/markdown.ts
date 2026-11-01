/**
 * Pure helpers around the stored format: notes are Markdown text in `body`.
 * Old notes were plain text where one `\n` is one line; `plainToMarkdown` keeps every line.
 */

const FENCE = /^ {0,3}(```|~~~)/;
const BLOCK_START = /^ {0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||---+\s*$|\*\*\*+\s*$|<)/;

/**
 * Migration of a plain-text body: a single line break becomes a Markdown hard break (two spaces) so
 * "Milch\nBrot" stays two lines; blank lines, fenced code and lines that already are Markdown blocks
 * (headings, lists, quotes, tables) are left as they are. Idempotent.
 */
export function plainToMarkdown(body: string): string {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  let fenced = false;
  return lines
    .map((line, i) => {
      if (FENCE.test(line)) {
        fenced = !fenced;
        return line;
      }
      if (fenced) return line;
      const next = lines[i + 1];
      if (
        next === undefined ||
        line.trim() === '' ||
        next.trim() === '' ||
        / {2}$/.test(line) ||
        BLOCK_START.test(line) ||
        BLOCK_START.test(next) ||
        FENCE.test(next)
      )
        return line;
      return `${line}  `;
    })
    .join('\n');
}

/** Markdown without markers: list cards, search and the title fallback show text, not syntax. */
export function markdownToPlain(md: string): string {
  return md
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^ {0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/^ {0,3}>\s?/gm, '')
    .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/=={(?:accent|success|warning|danger|info)}/g, '')
    .replace(/(\*\*|__|~~|==|`)/g, '')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_]/g, '$1$2');
}

export function wordCount(md: string): number {
  const text = markdownToPlain(md).trim();
  return text ? text.split(/\s+/).length : 0;
}
