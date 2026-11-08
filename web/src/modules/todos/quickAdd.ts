import { parseCapture } from '@/quickCapture/parser';
import { t } from '@/strings';

export interface QuickAdd {
  title: string;
  dueDate?: string;
  /** 'HH:mm'; ToDos have no time field, it goes into the note like in the quick capture. */
  time?: string;
  priority?: 1 | 2 | 3;
  estimateMin?: number;
  note?: string;
}

/**
 * Words the capture parser reads as a type hint and takes out of the title ("Rechnung", "Aufgabe",
 * "Geburtstag" …). Here the type is fixed (a ToDo), so they are part of the title (A05, round 5):
 * they are swapped for placeholders before parsing and put back afterwards.
 */
const TYPE_WORDS =
  /(?<![\p{L}\d])(rechnung|aufgabe|to-?do|task|merke|geburtstage?|ausgaben?|ausgegeben|einnahmen?|einkaufs?liste)(?![\p{L}\d])/giu;
const MARK = (i: number) => `qzx${String.fromCharCode(97 + (i % 26))}${Math.floor(i / 26)}q`;
const MARK_RE = /qzx([a-z])(\d+)q/gi;

function protect(text: string): { text: string; words: string[] } {
  const words: string[] = [];
  const out = text.replace(TYPE_WORDS, (w) => MARK(words.push(w) - 1));
  return { text: out, words };
}

function restore(title: string, words: readonly string[]): string {
  const out = title.replace(
    MARK_RE,
    (_, l: string, n: string) => words[Number(n) * 26 + (l.toLowerCase().charCodeAt(0) - 97)] ?? '',
  );
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Reads date, time, priority and effort out of the line typed into "Neue Aufgabe …", using the
 * quick-capture rules. The text stays exactly as typed unless something was recognised, and a
 * repeating phrase is left alone: a ToDo here is a single one.
 */
export function readQuickAdd(text: string, now: Date): QuickAdd {
  const value = text.trim();
  const kept = protect(value);
  const { fields } = parseCapture(`t ${kept.text}`, { now });
  const found = fields.date || fields.priority || fields.estimateMin;
  if (!found || fields.recurrence || !fields.title) return { title: value };
  return {
    title: restore(fields.title, kept.words),
    ...(fields.date ? { dueDate: fields.date } : {}),
    ...(fields.time ? { time: fields.time, note: t.quickCapture.todoTimeNote(fields.time) } : {}),
    ...(fields.priority ? { priority: fields.priority } : {}),
    ...(fields.estimateMin ? { estimateMin: fields.estimateMin } : {}),
  };
}
