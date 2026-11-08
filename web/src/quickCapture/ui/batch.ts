import { formatMoney } from '@/core/money';
import type { CaptureFields, CaptureType } from '../parser';
import { targetFor } from '../targets';

/** One line of a many-lines capture as it will be saved. */
export interface BatchRow {
  type?: CaptureType;
  fields: CaptureFields;
  /** The line would have been a booking: it is saved as a ToDo and offers „Als Ausgabe buchen“. */
  booking?: 'expense' | 'income';
}

const books = (type: CaptureType | undefined) => !!type && !!targetFor(type).requiresConfirm;

/** The targets a line of a batch may pick: never one that books money. */
export const batchTypes = (available: readonly CaptureType[]): CaptureType[] =>
  available.filter((a) => !books(a));

/**
 * A batch never books (decisions/features.md, „Kopf leer“ Q1 a): a line that would be a booking –
 * read from its words, forced by `$`, or a ToDo picked by hand for such a line – becomes a ToDo with
 * the amount in its title (nothing is lost) and remembers that it can still be booked on its own.
 * Every other line is kept exactly as it was read. Without the ToDos module the line has no target
 * and the person picks one (never a booking).
 */
export function batchRow(
  type: CaptureType | undefined,
  fields: CaptureFields,
  available: readonly CaptureType[],
  parsedType?: CaptureType,
  /** The title is the line as typed (inbox fallback): it already holds the amount. */
  asTyped = false,
): BatchRow {
  const money = books(type) || (type === 'todo' && books(parsedType) && !!fields.amountMinor);
  if (!money) return { type, fields };
  // The chip only where a booking can be made; the amount stays in the title either way.
  const bookable = !!parsedType && books(parsedType) && available.includes(parsedType);
  const amount =
    fields.amountMinor && !asTyped ? formatMoney(fields.amountMinor, fields.currency) : '';
  return {
    type: available.includes('todo') ? 'todo' : undefined,
    fields: {
      title: [fields.title, amount].filter(Boolean).join(' · '),
      ...(fields.note ? { note: fields.note } : {}),
      ...(fields.link ? { link: fields.link } : {}),
    },
    ...(bookable || (books(type) && available.includes(type!))
      ? { booking: fields.kind === 'income' ? 'income' : 'expense' }
      : {}),
  };
}

/**
 * The text without one entry, after it was booked on its own: its line goes, or – when the line held
 * several entries („A, B und C“) – only that part of it.
 */
export function withoutPart(text: string, part: string): string {
  const lines = text.split('\n');
  // The whole line first (list markers aside), so a shorter part never cuts into another line.
  const bare = (l: string) => l.replace(/^\s*(?:[-*•–·]|\d+[.)])\s+/u, '').trim();
  const whole = lines.findIndex((l) => bare(l) === part);
  if (whole >= 0) {
    lines.splice(whole, 1);
    return lines.join('\n');
  }
  const i = lines.findIndex((l) => l.includes(part));
  if (i < 0) return text;
  const rest = lines[i]!.replace(part, '')
    .replace(/^[\s,;.\-–*•·]+|[\s,;]+$/gu, '')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/,\s*und\s*$|^und\s+/i, '')
    .trim();
  if (rest.length < 3) lines.splice(i, 1);
  else lines[i] = rest;
  return lines.join('\n');
}
