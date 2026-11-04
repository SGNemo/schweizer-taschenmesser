/**
 * Change notes (`.changes/*.md`): parser, validation and the area list. Pure functions, erasable
 * TypeScript only, so the release scripts can run this file straight from Node.
 *
 * A file holds one or more entries; each entry is a `---` fenced block of `key: value` lines.
 */

export const TYPES = ['added', 'changed', 'fixed', 'removed', 'security', 'performance'] as const;
export type ChangeType = (typeof TYPES)[number];

export interface ChangeEntry {
  type: ChangeType;
  area: string;
  breaking: boolean;
  highlight: boolean;
  de: string;
  en: string;
  pr?: number;
}

type Label = { de: string; en: string };

/** Areas a note can belong to: every module and tool id, plus the app-wide topics. */
export const AREAS: Record<string, Label> = {
  app: { de: 'App', en: 'App' },
  home: { de: 'Übersicht', en: 'Home' },
  settings: { de: 'Einstellungen', en: 'Settings' },
  sync: { de: 'Sync', en: 'Sync' },
  ai: { de: 'KI', en: 'AI' },
  backup: { de: 'Backup', en: 'Backup' },
  accessibility: { de: 'Lesbarkeit', en: 'Readability' },
  automation: { de: 'Automatisierungen', en: 'Automations' },
  platform: { de: 'Installation', en: 'Installation' },
  accounts: { de: 'Tresor', en: 'Vault' },
  bookmarks: { de: 'Merkliste', en: 'Bookmarks' },
  browser: { de: 'Browser', en: 'Browser' },
  budgets: { de: 'Budgets', en: 'Budgets' },
  calendar: { de: 'Kalender', en: 'Calendar' },
  chat: { de: 'Chat', en: 'Chat' },
  disk: { de: 'Dieser PC', en: 'This PC' },
  downloads: { de: 'Downloads', en: 'Downloads' },
  example: { de: 'Beispiel', en: 'Example' },
  feeds: { de: 'Feeds', en: 'Feeds' },
  finance: { de: 'Finanzen', en: 'Finance' },
  habits: { de: 'Gewohnheiten', en: 'Habits' },
  invoices: { de: 'Rechnungen', en: 'Invoices' },
  lists: { de: 'Listen', en: 'Lists' },
  mail: { de: 'Mail', en: 'Mail' },
  maps: { de: 'Karten', en: 'Maps' },
  music: { de: 'Musik', en: 'Music' },
  notes: { de: 'Notizen', en: 'Notes' },
  pantry: { de: 'Vorrat', en: 'Pantry' },
  people: { de: 'Personen', en: 'People' },
  subscriptions: { de: 'Abos', en: 'Subscriptions' },
  timetrack: { de: 'Zeiterfassung', en: 'Time tracking' },
  todos: { de: 'Todos', en: 'Todos' },
  vault: { de: 'Tresor', en: 'Vault' },
  weather: { de: 'Wetter', en: 'Weather' },
  tools: { de: 'Werkzeuge', en: 'Tools' },
};

export const MAX_SENTENCE = 200;

const KEYS = new Set(['type', 'area', 'breaking', 'highlight', 'de', 'en', 'pr']);

export interface ParseResult {
  entries: ChangeEntry[];
  errors: string[];
}

const unquote = (v: string): string => {
  const s = v.trim();
  return s.length >= 2 && /^(["']).*\1$/.test(s) ? s.slice(1, -1) : s;
};

/** Splits a file into `---` fenced blocks; text outside the blocks is ignored (free comments). */
function blocks(text: string): string[][] {
  const out: string[][] = [];
  let cur: string[] | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '---') {
      if (cur) {
        out.push(cur);
        cur = undefined;
      } else cur = [];
    } else cur?.push(line);
  }
  if (cur) out.push([...cur, '\u0000unterminated']);
  return out;
}

/** Parses and validates one file. `file` only labels the error messages. */
export function parseChangeFile(
  text: string,
  file = 'note',
  areas: Record<string, Label> = AREAS,
): ParseResult {
  const errors: string[] = [];
  const entries: ChangeEntry[] = [];
  const found = blocks(text);
  if (found.length === 0)
    errors.push(`${file}: no entry (--- fenced block with type, area, de, en)`);
  found.forEach((lines, i) => {
    const at = `${file} #${i + 1}`;
    if (lines.includes('\u0000unterminated')) return void errors.push(`${at}: missing closing ---`);
    const kv: Record<string, string> = {};
    for (const line of lines) {
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      const m = /^([a-z]+):\s*(.*)$/.exec(line);
      if (!m || !KEYS.has(m[1]!)) {
        errors.push(`${at}: unknown or malformed line "${line.trim()}"`);
        continue;
      }
      kv[m[1]!] = unquote(m[2]!);
    }
    const bool = (k: string): boolean | undefined => {
      const v = kv[k];
      if (v === undefined || v === '') return false;
      if (v === 'true') return true;
      if (v === 'false') return false;
      errors.push(`${at}: ${k} must be true or false`);
      return undefined;
    };
    const type = kv.type as ChangeType | undefined;
    if (!type || !(TYPES as readonly string[]).includes(type))
      errors.push(`${at}: type must be one of ${TYPES.join(', ')}`);
    if (!kv.area || !areas[kv.area]) errors.push(`${at}: unknown area "${kv.area ?? ''}"`);
    for (const lang of ['de', 'en'] as const) {
      const s = kv[lang];
      if (!s) errors.push(`${at}: ${lang} is missing`);
      else if (s.length > MAX_SENTENCE)
        errors.push(
          `${at}: ${lang} is ${s.length} characters (max ${MAX_SENTENCE}), one short sentence`,
        );
      else if (/\n/.test(s)) errors.push(`${at}: ${lang} must be one line`);
    }
    let pr: number | undefined;
    if (kv.pr) {
      pr = Number(kv.pr.replace(/^#/, ''));
      if (!Number.isInteger(pr) || pr <= 0) {
        errors.push(`${at}: pr must be a number`);
        pr = undefined;
      }
    }
    const breaking = bool('breaking');
    const highlight = bool('highlight');
    if (errors.some((e) => e.startsWith(at))) return;
    entries.push({
      type: type!,
      area: kv.area!,
      breaking: breaking!,
      highlight: highlight!,
      de: kv.de!,
      en: kv.en!,
      ...(pr ? { pr } : {}),
    });
  });
  return { entries, errors };
}

/** Serialises entries to the file format (used by `npm run change`). */
export function formatChangeFile(entries: ChangeEntry[]): string {
  return entries
    .map((e) =>
      [
        '---',
        `type: ${e.type}`,
        `area: ${e.area}`,
        `breaking: ${e.breaking}`,
        ...(e.highlight ? ['highlight: true'] : []),
        ...(e.pr ? [`pr: ${e.pr}`] : []),
        `de: ${e.de}`,
        `en: ${e.en}`,
        '---',
        '',
      ].join('\n'),
    )
    .join('\n');
}
