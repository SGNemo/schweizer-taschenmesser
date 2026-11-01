/**
 * Splits captured text into single entries before each one goes through `parseCapture` unchanged.
 * Pure and deterministic, relative imports only (see `isolation.test.ts`).
 *
 * - Lines always split; list markers (`-`, `*`, `•`, `1.`, `2)`) are dropped when there are
 *   several lines. A line starting with a date ("3. Oktober …") keeps its number.
 * - Inside one line, sentence ends (`. ! ?`), commas and semicolons split, plus an "und" after the
 *   last comma ("A, B und C"). This happens only when every part reads as an entry of its own:
 *   two words or more, one of them not a date/time word. Otherwise the line stays one entry.
 *   So "Mo, Mi und Fr", "Brot, Milch und Eier kaufen", "Zahnarzt Freitag, 9 Uhr" stay whole.
 * - Never a separator: commas between digits ("12,50", "um 9, 30 Min"), anything in brackets or
 *   inside a link, a period after a digit ("bis 31.12.") or after a short abbreviation ("Dr.").
 * - Parts shorter than 3 characters and empty lines are dropped.
 *
 * When unsure it does not split: a wrong split makes several entries out of one thought, a missed
 * split only leaves one entry with a longer title.
 */

/** Words that only say when (or connect), never what: a part made only of these is no entry. */
const WHEN_WORDS = new Set(
  (
    'um am an ab bis im in von vom zum zur für und oder dann danach noch ' +
    'uhr min mins minute minuten std stunde stunden h tag tage ' +
    'heute morgen übermorgen gestern abend abends früh morgens mittag mittags nachmittag nachmittags ' +
    'vormittag vormittags nacht nachts woche wochen wochenende monat monate monats jahr jahre ' +
    'nächste nächsten nächster nächstes kommende kommenden diese diesen dieser jeden jede jedes jeder ' +
    'alle täglich wöchentlich monatlich jährlich halb viertel nach vor ' +
    'montag dienstag mittwoch donnerstag freitag samstag sonntag mo di mi do fr sa so ' +
    'januar februar märz april mai juni juli august september oktober november dezember ' +
    'jan feb mär apr jun jul aug sep sept okt nov dez'
  ).split(' '),
);

/** Lower-case words that end with a period without ending a sentence. */
const ABBREVIATIONS = new Set(['evtl', 'inkl', 'exkl', 'bzgl', 'ggfs', 'zzgl', 'abzgl', 'tägl']);

const MONTH_START = /^(jan|feb|mär|maer|apr|mai|jun|jul|aug|sep|okt|nov|dez)/i;

/** A list marker at the start of a line: "-", "*", "•", "–", "·", "1.", "2)". */
const BULLET = /^(?:[-*•–·]|\d{1,2}[.)])\s+/;

function stripBullet(line: string): string {
  const m = BULLET.exec(line);
  if (!m) return line;
  const rest = line.slice(m[0].length);
  // "3. Oktober Zahnarzt" is a date, not item 3 of a list.
  if (/^\d/.test(m[0]) && MONTH_START.test(rest)) return line;
  return rest.trim();
}

/** Spans no separator may fall into: brackets and links. */
function protectedSpans(text: string): boolean[] {
  const inside = new Array<boolean>(text.length).fill(false);
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    if (depth > 0) inside[i] = true;
    if ((c === ')' || c === ']') && depth > 0) depth--;
  }
  for (const m of text.matchAll(/(?:https?:\/\/|www\.)\S+/gi)) {
    for (let i = m.index; i < m.index + m[0].length; i++) inside[i] = true;
  }
  return inside;
}

const prevChar = (s: string, i: number) => s.slice(0, i).trimEnd().slice(-1);
const nextChar = (s: string, i: number) =>
  s
    .slice(i + 1)
    .trimStart()
    .charAt(0);
const isDigit = (c: string) => c >= '0' && c <= '9';

/** Cuts `text` at the given indices (the separator character itself is dropped). */
function cutAt(text: string, cuts: number[], width = 1): string[] {
  const parts: string[] = [];
  let from = 0;
  for (const i of cuts) {
    parts.push(text.slice(from, i));
    from = i + width;
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim());
}

function sentenceCuts(line: string, inside: boolean[]): number[] {
  const cuts: number[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i]!;
    if ((c !== '.' && c !== '!' && c !== '?') || inside[i] || !/\s/.test(line[i + 1]!)) continue;
    if (c === '.') {
      const word = /([\p{L}]+)$/u.exec(line.slice(0, i))?.[1] ?? '';
      // After a digit ("31.12.", "3."), "..." or a short word ("Dr.", "z. B.") it is no sentence end.
      if (word.length < 4 || ABBREVIATIONS.has(word.toLowerCase()) || line[i - 1] === '.') continue;
    }
    cuts.push(i);
  }
  return cuts;
}

function commaCuts(sentence: string, inside: boolean[]): number[] {
  const cuts: number[] = [];
  for (let i = 0; i < sentence.length; i++) {
    const c = sentence[i];
    if ((c !== ',' && c !== ';') || inside[i]) continue;
    // "12,50 €", "1.234,56", "um 9, 30 Min": a comma between numbers belongs to them.
    if (isDigit(prevChar(sentence, i)) && isDigit(nextChar(sentence, i))) continue;
    cuts.push(i);
  }
  return cuts;
}

/** Two words or more, one of them about *what* (not only when). */
export function readsAsEntry(part: string): boolean {
  const words = part
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}!]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (part.length < 3 || words.length < 2) return false;
  return words.some(
    (w) => /^\p{L}{2,}/u.test(w) && !WHEN_WORDS.has(w.toLowerCase()) && !w.startsWith('!'),
  );
}

const allEntries = (parts: string[]) => parts.length > 1 && parts.every(readsAsEntry);

/** One sentence: split at commas (and an "und" after the last one) only when every part is an entry. */
function splitSentence(sentence: string): string[] {
  const cuts = commaCuts(sentence, protectedSpans(sentence));
  if (cuts.length === 0) return [sentence];
  const parts = cutAt(sentence, cuts);
  const last = parts[parts.length - 1]!;
  const und = [...last.matchAll(/\s+und\s+/gi)];
  if (und.length > 0) {
    const tail: string[] = [];
    let from = 0;
    for (const m of und) {
      tail.push(last.slice(from, m.index).trim());
      from = m.index + m[0].length;
    }
    tail.push(last.slice(from).trim());
    const withUnd = [...parts.slice(0, -1), ...tail];
    if (allEntries(withUnd)) return withUnd;
  }
  return allEntries(parts) ? parts : [sentence];
}

function splitLine(line: string): string[] {
  const cuts = sentenceCuts(line, protectedSpans(line));
  const sentences = cuts.length > 0 ? cutAt(line, cuts) : [line];
  // Sentence ends count only when every sentence is an entry; else the whole line is one.
  const usable = sentences.length > 1 && sentences.every(readsAsEntry) ? sentences : [line];
  return usable.flatMap(splitSentence);
}

/**
 * The entries in `text`, in order. One plain line comes back as exactly that line (trimmed), so
 * a single entry is read the same as before; the caller treats fewer than two parts as one entry.
 */
export function splitCapture(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const many = lines.length > 1;
  const parts = lines
    .map((l) => (many ? stripBullet(l) : l))
    .flatMap(splitLine)
    .map((p) => p.replace(/[,;]+$/, '').trim())
    .filter((p) => p.length >= 3);
  // "Milch kaufen. Oma anrufen." → no stray period on the last entry (but "bis 31.12." keeps it).
  return parts.length > 1 ? parts.map((p) => p.replace(/(\p{L}{4,})\.$/u, '$1')) : parts;
}
