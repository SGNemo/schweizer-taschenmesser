/** Pure parts of the text compare: line diff (LCS), word diff inside changed lines, unified diff. */

/** Per side. Longer input gets a notice instead of a frozen page. */
export const MAX_CHARS = 20_000;

/** Table cells the LCS may fill. Beyond this the changed middle is shown as removed + added (still correct, not minimal). */
const MAX_CELLS = 4_000_000;
/** Same cap for the words of one changed line pair; above it the whole line counts as changed. */
const MAX_WORD_CELLS = 250_000;

export type DiffKind = 'same' | 'add' | 'del';

export interface Part {
  text: string;
  changed: boolean;
}

export interface DiffRow {
  kind: DiffKind;
  text: string;
  /** 1-based line numbers in the old / new text (absent on the side the line is not in). */
  oldNo?: number;
  newNo?: number;
  /** Word-level pieces of a changed line that has a partner on the other side. */
  parts?: Part[];
}

export interface DiffResult {
  rows: DiffRow[];
  /** Changed lines: per block of changes the larger of removed and added (a rewritten line counts once). */
  changed: number;
  /** The texts were too different for a minimal result. */
  rough: boolean;
}

export interface DiffOptions {
  ignoreWhitespace?: boolean;
}

export const isTooLong = (a: string, b: string): boolean =>
  a.length > MAX_CHARS || b.length > MAX_CHARS;

export function splitLines(text: string): string[] {
  return text === '' ? [] : text.replace(/\r\n?/g, '\n').split('\n');
}

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

type Op = 'same' | 'add' | 'del';

/** Edit script of two key lists by the longest common subsequence; `rough` when the table would be too big. */
function lcsScript(a: string[], b: string[], maxCells: number): { ops: Op[]; rough: boolean } {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const ops: Op[] = Array<Op>(start).fill('same');
  const n = endA - start;
  const m = endB - start;
  let rough = false;
  if (n === 0 || m === 0) {
    for (let i = 0; i < n; i++) ops.push('del');
    for (let j = 0; j < m; j++) ops.push('add');
  } else if ((n + 1) * (m + 1) > maxCells) {
    rough = true;
    for (let i = 0; i < n; i++) ops.push('del');
    for (let j = 0; j < m; j++) ops.push('add');
  } else {
    const w = m + 1;
    const table = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * w + j] =
          a[start + i] === b[start + j]
            ? table[(i + 1) * w + j + 1]! + 1
            : Math.max(table[(i + 1) * w + j]!, table[i * w + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[start + i] === b[start + j]) {
        ops.push('same');
        i++;
        j++;
      } else if (table[(i + 1) * w + j]! >= table[i * w + j + 1]!) {
        ops.push('del');
        i++;
      } else {
        ops.push('add');
        j++;
      }
    }
    while (i++ < n) ops.push('del');
    while (j++ < m) ops.push('add');
  }
  for (let k = endA; k < a.length; k++) ops.push('same');
  return { ops, rough };
}

const tokenize = (line: string): string[] => line.match(/\s+|\S+/g) ?? [];

/** Word pieces of an old and a new line; unchanged words stay unmarked. */
export function wordParts(
  oldLine: string,
  newLine: string,
  ignoreWhitespace = false,
): { old: Part[]; new: Part[] } {
  const ta = tokenize(oldLine);
  const tb = tokenize(newLine);
  const key = (tok: string) => (ignoreWhitespace && /^\s/.test(tok) ? ' ' : tok);
  const { ops, rough } = lcsScript(ta.map(key), tb.map(key), MAX_WORD_CELLS);
  if (rough)
    return { old: [{ text: oldLine, changed: true }], new: [{ text: newLine, changed: true }] };
  const oldParts: Part[] = [];
  const newParts: Part[] = [];
  const push = (list: Part[], text: string, changed: boolean) => {
    const last = list[list.length - 1];
    if (last && last.changed === changed) last.text += text;
    else list.push({ text, changed });
  };
  let i = 0;
  let j = 0;
  for (const op of ops) {
    if (op === 'same') {
      push(oldParts, ta[i++]!, false);
      push(newParts, tb[j++]!, false);
    } else if (op === 'del') push(oldParts, ta[i++]!, true);
    else push(newParts, tb[j++]!, true);
  }
  return { old: oldParts, new: newParts };
}

export function diffLines(before: string, after: string, options: DiffOptions = {}): DiffResult {
  const ignore = options.ignoreWhitespace ?? false;
  const a = splitLines(before);
  const b = splitLines(after);
  const key = (l: string) => (ignore ? squash(l) : l);
  const { ops, rough } = lcsScript(a.map(key), b.map(key), MAX_CELLS);

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let changed = 0;
  let k = 0;
  while (k < ops.length) {
    if (ops[k] === 'same') {
      // The new text is what is shown: with "ignore whitespace" the two sides may differ in blanks.
      rows.push({ kind: 'same', text: b[j]!, oldNo: ++i, newNo: ++j });
      k++;
      continue;
    }
    const dels: DiffRow[] = [];
    const adds: DiffRow[] = [];
    while (k < ops.length && ops[k] !== 'same') {
      if (ops[k] === 'del') dels.push({ kind: 'del', text: a[i]!, oldNo: ++i });
      else adds.push({ kind: 'add', text: b[j]!, newNo: ++j });
      k++;
    }
    const pairs = Math.min(dels.length, adds.length);
    for (let p = 0; p < pairs; p++) {
      const w = wordParts(dels[p]!.text, adds[p]!.text, ignore);
      dels[p]!.parts = w.old;
      adds[p]!.parts = w.new;
    }
    rows.push(...dels, ...adds);
    changed += Math.max(dels.length, adds.length);
  }
  return { rows, changed, rough };
}

/** Unified diff (`diff -u`) of the rows; empty string when nothing changed. */
export function toUnifiedDiff(rows: DiffRow[], context = 3): string {
  const changedAt = rows.flatMap((r, idx) => (r.kind === 'same' ? [] : [idx]));
  if (changedAt.length === 0) return '';
  // Hunks: changed rows plus `context` rows around them, merged when they touch.
  const ranges: [number, number][] = [];
  for (const idx of changedAt) {
    const from = Math.max(0, idx - context);
    const to = Math.min(rows.length - 1, idx + context);
    const last = ranges[ranges.length - 1];
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else ranges.push([from, to]);
  }
  const out = ['--- a', '+++ b'];
  for (const [from, to] of ranges) {
    const slice = rows.slice(from, to + 1);
    const oldCount = slice.filter((r) => r.kind !== 'add').length;
    const newCount = slice.filter((r) => r.kind !== 'del').length;
    const first = slice.find((r) => r.kind !== 'add');
    const firstNew = slice.find((r) => r.kind !== 'del');
    // An empty side starts "before" its line: the number of the line above (0 at the top).
    const oldStart = first ? first.oldNo! : lineBefore(rows, from, 'oldNo');
    const newStart = firstNew ? firstNew.newNo! : lineBefore(rows, from, 'newNo');
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const r of slice)
      out.push((r.kind === 'same' ? ' ' : r.kind === 'add' ? '+' : '-') + r.text);
  }
  return out.join('\n') + '\n';
}

function lineBefore(rows: DiffRow[], index: number, field: 'oldNo' | 'newNo'): number {
  for (let i = index - 1; i >= 0; i--) {
    const n = rows[i]![field];
    if (n !== undefined) return n;
  }
  return 0;
}
