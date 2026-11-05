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
export interface NoteSection {
  /** From `## Build 687` (Dev-Preview text: the changes that came with that build). */
  build?: number;
  /** From the `## [1.2.0] – 2026-11-10` line. */
  version?: string;
  date?: string;
  /** `## Unreleased`: open notes without a known build. */
  unreleased?: boolean;
  blocks: NoteBlock[];
}
export interface ParsedNotes extends NoteSection {
  /** One section per `##` heading (a release body has one, the Dev-Preview text one per build). */
  sections: NoteSection[];
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
  const sections: NoteSection[] = [];
  let section: NoteSection | undefined;
  let block: NoteBlock | undefined;
  const startSection = (): NoteSection => {
    // A heading right after an empty section (the title line of a release body) belongs to it; a section
    // that already is a build, version or "unreleased" stays (an empty `## Build 730` is its own row).
    if (
      section &&
      section.blocks.length === 0 &&
      section.build === undefined &&
      section.version === undefined &&
      !section.unreleased
    )
      return section;
    section = { blocks: [] };
    sections.push(section);
    block = undefined;
    return section;
  };
  const open = (heading?: string): NoteBlock => {
    const target = section ?? startSection();
    block = { ...(heading ? { heading } : {}), items: [] };
    if (heading && WARNING_RE.test(heading)) block.warning = true;
    target.blocks.push(block);
    return block;
  };
  for (const raw of pickLanguage(markdown, lang)) {
    const line = raw.trim();
    if (line === '') continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const text = plain(h[2]!);
      if (h[1]!.length <= 2) {
        const target = startSection();
        const b = /^build\s+(\d+)$/i.exec(text);
        if (b) target.build = Number(b[1]);
        else if (/^(unreleased|unveröffentlicht)/i.test(text)) target.unreleased = true;
        else {
          const v = VERSION_RE.exec(text);
          if (v) {
            target.version = v[1];
            target.date = v[2] ?? v[3];
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
  const kept = sections
    .map((x) => ({ ...x, blocks: x.blocks.filter((b) => b.items.length > 0) }))
    .filter((x) => x.blocks.length > 0 || x.build !== undefined);
  const first = kept[0] ?? sections[0];
  return {
    ...(first?.build ? { build: first.build } : {}),
    ...(first?.version ? { version: first.version, date: first.date } : {}),
    ...(first?.unreleased ? { unreleased: true } : {}),
    blocks: kept.flatMap((x) => x.blocks),
    sections: kept,
  };
}
