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
 * Reads date, time, priority and effort out of the line typed into "Neue Aufgabe …", using the
 * quick-capture rules. The text stays exactly as typed unless something was recognised, and a
 * repeating phrase is left alone: a ToDo here is a single one.
 */
export function readQuickAdd(text: string, now: Date): QuickAdd {
  const value = text.trim();
  const { fields } = parseCapture(`t ${value}`, { now });
  const found = fields.date || fields.priority || fields.estimateMin;
  if (!found || fields.recurrence || !fields.title) return { title: value };
  return {
    title: fields.title,
    ...(fields.date ? { dueDate: fields.date } : {}),
    ...(fields.time ? { time: fields.time, note: t.quickCapture.todoTimeNote(fields.time) } : {}),
    ...(fields.priority ? { priority: fields.priority } : {}),
    ...(fields.estimateMin ? { estimateMin: fields.estimateMin } : {}),
  };
}
