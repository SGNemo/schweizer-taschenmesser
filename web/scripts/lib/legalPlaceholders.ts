/** Open placeholders in the files that carry the maintainer's legal details (`[[NAME]]`, site: `[PLATZHALTER: …]`). */
export const OPEN_PATTERNS: readonly RegExp[] = [
  /\[\[[A-Z0-9_]+\]\]/g,
  /\[(?:PLATZHALTER|PLACEHOLDER):[^\]]*\]/g,
];

export interface PlaceholderHit {
  file: string;
  line: number;
  text: string;
}

export function findOpenPlaceholders(file: string, content: string): PlaceholderHit[] {
  const hits: PlaceholderHit[] = [];
  content.split(/\r?\n/).forEach((line, i) => {
    // Comment lines that only explain the format are not open placeholders.
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
    for (const re of OPEN_PATTERNS) {
      for (const m of line.matchAll(new RegExp(re.source, 'g'))) {
        hits.push({ file, line: i + 1, text: m[0] });
      }
    }
  });
  return hits;
}
