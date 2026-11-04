/**
 * Release-note Markdown (GitHub release body, `CHANGELOG.md` sections) → structure for display.
 * Never produces HTML: every value is plain text. The notes of a release carry German above and English
 * below, separated by `---`; the app language picks its block (all languages except German read English).
 */
export interface NoteItem {
  /** Area prefix such as "Kalender:" (the bold start of a line). */
  lead?: string;
  text: string;
}
export interface NoteBlock {
  heading?: string;
  /** A "breaking" block (data or format consequences), shown with the warning colour. */
  warning?: boolean;
  items: NoteItem[];
}
export interface ParsedNotes {
  /** From the `## [1.2.0] – 2026-11-10` line; `unreleased` for `## Unreleased`. */
  version?: string;
  date?: string;
  unreleased?: boolean;
  blocks: NoteBlock[];
}

const VERSION_RE =
  /^\[?v?(\d+\.\d+\.\d+[0-9A-Za-z.+-]*?)\]?(?:\s*[–—-]\s*(\d{4}-\d{2}-\d{2})|\s*\((\d{4}-\d{2}-\d{2})\))?(?:\s.*)?$/;
const WARNING_RE = /breaking|wichtig vor dem update|bruch/i;

/** Plain text of one Markdown line: links keep their text, code and emphasis markers go. */
const plain = (s: string): string =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .trim();

function pickLanguage(markdown: string, lang: string): string[] {
  const blocks: string[][] = [[]];
  for (const raw of markdown.split(/\r?\n/)) {
    if (/^\s*---+\s*$/.test(raw)) blocks.push([]);
    // The preview preamble ("> Dev-Preview … not a release") and release footers say nothing new.
    else if (!/^\s*>/.test(raw) && !/^\*\*Full changelog:\*\*/i.test(raw.trim()))
      blocks[blocks.length - 1]!.push(raw);
  }
  const filled = blocks.filter((b) => b.some((l) => l.trim() !== ''));
  if (filled.length >= 2) return lang === 'de' ? filled[0]! : filled[1]!;
  return filled[0] ?? [];
}

export function parseReleaseNotes(markdown: string, lang: string): ParsedNotes {
  const out: ParsedNotes = { blocks: [] };
  let block: NoteBlock | undefined;
  const open = (heading?: string): NoteBlock => {
    block = { ...(heading ? { heading } : {}), items: [] };
    if (heading && WARNING_RE.test(heading)) block.warning = true;
    out.blocks.push(block);
    return block;
  };
  for (const raw of pickLanguage(markdown, lang)) {
    const line = raw.trim();
    if (line === '') continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const text = plain(h[2]!);
      if (h[1]!.length <= 2) {
        if (/^(unreleased|unveröffentlicht)/i.test(text)) out.unreleased = true;
        else {
          const v = VERSION_RE.exec(text);
          if (v) {
            out.version = v[1];
            out.date = v[2] ?? v[3];
          }
        }
      } else open(text);
      continue;
    }
    const li = /^[-*+]\s+(.*)$/.exec(line);
    const body = plain(li ? li[1]! : line);
    if (body === '') continue;
    const lead = /^\*\*([^*]+)\*\*\s*(.*)$/.exec(body);
    const item: NoteItem =
      lead && lead[2]
        ? { lead: lead[1]!.trim(), text: lead[2].replace(/\*\*/g, '') }
        : { text: body.replace(/\*\*/g, '') };
    (block ?? open()).items.push(item);
  }
  out.blocks = out.blocks.filter((b) => b.items.length > 0);
  return out;
}
