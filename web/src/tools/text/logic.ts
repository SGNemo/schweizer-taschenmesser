import { compareText } from '@/core/i18n/format';
export interface TextStats {
  chars: number;
  charsNoSpaces: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  /** Reading time in whole minutes at 200 words per minute (0 for an empty text). */
  minutes: number;
}

/** Counts of a text; an empty text is all zeros. Characters are counted as visible symbols, not UTF-16 units. */
export function countText(text: string): TextStats {
  if (text.length === 0) {
    return {
      chars: 0,
      charsNoSpaces: 0,
      words: 0,
      lines: 0,
      sentences: 0,
      paragraphs: 0,
      minutes: 0,
    };
  }
  const symbols = [...text];
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const sentences = (text.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…\s][^.!?…]*$/g) ?? []).filter((s) =>
    /[\p{L}\p{N}]/u.test(s),
  ).length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  return {
    chars: symbols.length,
    charsNoSpaces: symbols.filter((c) => !/\s/u.test(c)).length,
    words,
    lines: text.split(/\r\n|\r|\n/).length,
    sentences,
    paragraphs,
    minutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 200)),
  };
}

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence';

/** Changes the case of a German text (ß → SS when going to capitals is the browser's `de` rule). */
export function convertCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper':
      return text.toLocaleUpperCase('de');
    case 'lower':
      return text.toLocaleLowerCase('de');
    case 'title':
      return text
        .toLocaleLowerCase('de')
        .replace(
          /(^|[\s\-–—(„"'])(\p{L})/gu,
          (_, before: string, ch: string) => before + ch.toLocaleUpperCase('de'),
        );
    case 'sentence':
      return text
        .toLocaleLowerCase('de')
        .replace(
          /(^|[.!?…]\s+|\n\s*)(\p{L})/gu,
          (_, before: string, ch: string) => before + ch.toLocaleUpperCase('de'),
        );
  }
}

export interface TidyOptions {
  trimLines: boolean;
  collapseSpaces: boolean;
  dropEmptyLines: boolean;
}

/** Removes leading/trailing blanks, repeated spaces and empty lines, as chosen. */
export function tidy(text: string, o: TidyOptions): string {
  let lines = text.split(/\r\n|\r|\n/);
  if (o.trimLines) lines = lines.map((l) => l.trim());
  if (o.collapseSpaces) lines = lines.map((l) => l.replace(/[ \t]{2,}/g, ' '));
  if (o.dropEmptyLines) lines = lines.filter((l) => l.trim().length > 0);
  return lines.join('\n');
}

export function sortLines(text: string, descending: boolean): string {
  const sorted = text
    .split(/\r\n|\r|\n/)
    .sort((a, b) => compareText(a, b, { sensitivity: 'base' }));
  return (descending ? sorted.reverse() : sorted).join('\n');
}

const SENTENCES = [
  'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.',
  'At vero eos et accusam et justo duo dolores et ea rebum.',
  'Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.',
  'Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi.',
  'Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat.',
  'Nam liber tempor cum soluta nobis eleifend option congue nihil imperdiet doming id quod mazim placerat facer possim assum.',
];

/** Deterministic placeholder text: `paragraphs` paragraphs (1–20) of 3–5 sentences, the first starting with the classic line. */
export function lorem(paragraphs: number): string {
  const n = Math.min(20, Math.max(1, Math.trunc(paragraphs) || 1));
  const out: string[] = [];
  let k = 0;
  for (let p = 0; p < n; p++) {
    const count = 3 + (p % 3);
    const part: string[] = [];
    for (let i = 0; i < count; i++)
      part.push(SENTENCES[(k++ + (p === 0 ? 0 : 1)) % SENTENCES.length]!);
    out.push(part.join(' '));
  }
  return out.join('\n\n');
}
