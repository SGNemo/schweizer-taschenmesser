/**
 * CSV for imports and exports (RFC 4180): quoted fields, doubled quotes, CRLF or LF, line breaks inside
 * quotes, optional BOM. German spreadsheets and banks use `;`, so the delimiter is detected by default.
 */

export type Delimiter = ',' | ';' | '\t';

const CANDIDATES: Delimiter[] = [';', ',', '\t'];

/** The delimiter that appears most often (outside quotes) in the first non-empty line. */
export function detectDelimiter(text: string): Delimiter {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const counts = new Map<Delimiter, number>(CANDIDATES.map((d) => [d, 0]));
  let quoted = false;
  let seen = false;
  for (const c of src) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (seen) break;
    } else if (!quoted) {
      seen = true;
      if (counts.has(c as Delimiter)) counts.set(c as Delimiter, counts.get(c as Delimiter)! + 1);
    }
  }
  let best: Delimiter = ',';
  let bestCount = 0;
  // Candidates are ordered by how unlikely they are to appear inside prose; ties keep the earlier one.
  for (const d of CANDIDATES) {
    const n = counts.get(d)!;
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

export function parseCsv(text: string, opts: { delimiter?: Delimiter } = {}): string[][] {
  const delimiter = opts.delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // drop a BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

export function toCsv(rows: readonly (readonly string[])[], delimiter: Delimiter = ','): string {
  const escape = (value: string) =>
    value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return rows.map((r) => r.map(escape).join(delimiter)).join('\r\n') + '\r\n';
}

/** Header names compare case-, space- and umlaut-insensitively ("Buchungstag" = " buchungstag "). */
export function normalizeHeader(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface CsvTable {
  header: string[];
  /** Rows as objects keyed by the normalized header. Short rows are padded with ''. */
  records: Record<string, string>[];
}

/** First row = header. Rows without any content are dropped by `parseCsv`. */
export function csvTable(text: string, opts: { delimiter?: Delimiter } = {}): CsvTable {
  const [head, ...body] = parseCsv(text, opts);
  if (!head) return { header: [], records: [] };
  const keys = head.map(normalizeHeader);
  return {
    header: head,
    records: body.map((cells) => {
      const record: Record<string, string> = {};
      keys.forEach((key, i) => {
        if (key && !(key in record)) record[key] = (cells[i] ?? '').trim();
      });
      return record;
    }),
  };
}
