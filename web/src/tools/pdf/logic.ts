/**
 * Page selections such as "1-3, 5, 8-" (1-based; an open end means "to the last page").
 * Returns the pages in the order given, without duplicates, or `undefined` when the text is empty,
 * malformed or names a page that does not exist.
 */
export function parseRanges(text: string, pageCount: number): number[] | undefined {
  const parts = text
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || pageCount < 1) return undefined;
  const out: number[] = [];
  const seen = new Set<number>();
  const add = (n: number) => {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  };
  for (const part of parts) {
    const single = /^(\d{1,5})$/.exec(part);
    const range = /^(\d{1,5})\s*[-–]\s*(\d{1,5})?$/.exec(part);
    if (single) {
      const n = Number(single[1]);
      if (n < 1 || n > pageCount) return undefined;
      add(n);
    } else if (range) {
      const from = Number(range[1]);
      const to = range[2] === undefined ? pageCount : Number(range[2]);
      if (from < 1 || to > pageCount || from > to) return undefined;
      for (let n = from; n <= to; n++) add(n);
    } else return undefined;
  }
  return out;
}

/** Every page of `1..count` that is not in `removed`, ascending. */
export function without(count: number, removed: readonly number[]): number[] {
  const gone = new Set(removed);
  return Array.from({ length: count }, (_, i) => i + 1).filter((n) => !gone.has(n));
}

/** `Vertrag.pdf` + `zusammengefuegt` → `Vertrag-zusammengefuegt.pdf` */
export function outName(name: string, suffix: string): string {
  const base = name.replace(/\.pdf$/i, '') || 'dokument';
  return `${base}-${suffix}.pdf`;
}

export type Rotation = 90 | 180 | 270;
