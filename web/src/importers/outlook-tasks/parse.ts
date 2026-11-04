/**
 * Tasks from Outlook / Microsoft To Do as CSV. Microsoft To Do itself has no export; its tasks sync
 * with Outlook, whose "Export to a file → CSV → Tasks" is the route. The column names depend on the
 * Outlook language, so headers are matched by alias lists (English and German, accents ignored).
 * Priority words, status words and date styles (`1/15/2026`, `15.01.2026`, `2026-01-15`) are read
 * tolerantly; whatever cannot be read is left out of the task, never guessed.
 */
import { csvTable, normalizeHeader, parseCsv, type CsvTable } from '@/core/io/csv';
import type { ImportedTask, ParsedTaskExport } from '@/core/io/taskImport';
import { pad2 } from '@/core/time/now';

const ALIASES = {
  title: ['subject', 'betreff', 'title', 'titel', 'task', 'aufgabe', 'asunto', 'objet', 'assunto'],
  due: ['due date', 'falligkeitsdatum', 'falligkeit', 'fallig am', 'fecha de vencimiento'],
  start: ['start date', 'anfangsdatum', 'startdatum', 'beginn'],
  status: ['status', 'estado', 'statut'],
  priority: ['priority', 'prioritat', 'prioridad', 'priorite', 'prioridade'],
  notes: ['notes', 'notizen', 'body', 'beschreibung', 'notas', 'description'],
  categories: ['categories', 'kategorien', 'categorias', 'categories'],
  completedOn: ['date completed', 'abschlussdatum', 'erledigt am', 'fecha de finalizacion'],
  percent: ['complete', '% complete', 'prozent abgeschlossen', '% abgeschlossen'],
} as const;

type Field = keyof typeof ALIASES;

function columns(table: CsvTable): Partial<Record<Field, string>> {
  const keys = new Set(Object.keys(table.records[0] ?? {}));
  const found: Partial<Record<Field, string>> = {};
  for (const [field, names] of Object.entries(ALIASES) as [Field, readonly string[]][]) {
    const hit = names.find((n) => keys.has(n));
    if (hit) found[field] = hit;
  }
  return found;
}

/** A header row that looks like an Outlook task export: a subject column plus due date, status or priority. */
export function isOutlookTasksCsv(text: string): boolean {
  const head = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const [header] = parseCsv(head);
  const keys = new Set((header ?? []).map(normalizeHeader));
  const has = (field: Field) => ALIASES[field].some((n) => keys.has(n));
  return has('title') && (has('due') || has('status') || has('priority')) && !keys.has('content');
}

/** Day-first when the file uses dots or any slash date has a first number above 12. */
function dayFirst(values: string[]): boolean {
  return values.some(
    (v) => /^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(v) || /^(1[3-9]|2\d|3[01])\/\d{1,2}\//.test(v),
  );
}

function toDay(raw: string, dayFirstOrder: boolean): string | undefined {
  const s = raw.trim();
  // Outlook writes "None"/"Keine"/"Not set" or the year 4501 for "no date".
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})\b/.exec(s);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])] as [number, number, number];
  else if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    [d, m] = dayFirstOrder ? [a, b] : [b, a];
    y = dmy[3]!.length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
  } else return undefined;
  if (y >= 4500 || y < 1900) return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return undefined;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

const plain = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();

function priorityOf(raw: string): 0 | 1 | 2 | 3 {
  const p = plain(raw);
  if (['2', 'high', 'hoch', 'alta', 'haute', 'elevada'].includes(p)) return 3;
  if (['1', 'normal', 'media', 'moyenne', 'medio'].includes(p)) return 0;
  if (['0', 'low', 'niedrig', 'baja', 'basse', 'baixa'].includes(p)) return 0;
  return 0;
}

const DONE_WORDS = [
  'completed',
  'erledigt',
  'abgeschlossen',
  'completada',
  'terminee',
  'concluida',
  'completado',
];

export function parseOutlookTasks(text: string, opts: { listName: string }): ParsedTaskExport {
  const table = csvTable(text.replace(/^\uFEFF/, ''));
  const col = columns(table);
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  if (!col.title) return { tasks, skipped: table.records.length };
  const dueValues = table.records.map((r) => (col.due ? (r[col.due] ?? '') : ''));
  const first = dayFirst([
    ...dueValues,
    ...table.records.map((r) => (col.completedOn ? (r[col.completedOn] ?? '') : '')),
  ]);
  table.records.forEach((row, i) => {
    const title = (row[col.title!] ?? '').trim();
    if (!title) {
      skipped++;
      return;
    }
    const status = plain(col.status ? (row[col.status] ?? '') : '');
    const percent = Number((col.percent ? row[col.percent] : '')?.replace(/[^\d.]/g, '') || 0);
    const done =
      DONE_WORDS.includes(status) ||
      percent >= 100 ||
      (col.completedOn !== undefined && toDay(row[col.completedOn] ?? '', first) !== undefined);
    const notes = (col.notes ? (row[col.notes] ?? '') : '').replace(/\r\n?/g, '\n').trim();
    const cats = (col.categories ? (row[col.categories] ?? '') : '')
      .split(/[;,]/)
      .map((c) => c.trim())
      .filter(Boolean);
    const task: ImportedTask = {
      key: `o${i}`,
      title,
      priority: priorityOf(col.priority ? (row[col.priority] ?? '') : ''),
      done,
      list: opts.listName,
    };
    const description = [
      notes,
      cats.length ? cats.map((c) => `#${c.replace(/\s+/g, '-')}`).join(' ') : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    if (description) task.description = description;
    const due = col.due ? toDay(row[col.due] ?? '', first) : undefined;
    if (due) task.due = due;
    tasks.push(task);
  });
  return { tasks, skipped };
}
