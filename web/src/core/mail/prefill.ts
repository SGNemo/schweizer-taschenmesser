/**
 * Prefill for "create from this mail": turns one mail into the text the capture sheet reads (and the
 * extra fields it saves along). Pure and local – the recognition is `heuristics.ts`; nothing leaves
 * the device. The user always sees the result in the capture sheet before anything is saved.
 */
import { addDaysStr, pad2 } from '@/core/time/dates';
import { plainText } from '@/core/io/feed';
import { analyzeMessage, senderName } from './heuristics';
import type { MailMessage } from './types';

export type MailLinkType = 'invoice' | 'event' | 'todo' | 'reminder' | 'bookmark' | 'note';

/** Order of the "create from this mail" menu. */
export const MAIL_LINK_TYPES: readonly MailLinkType[] = [
  'invoice',
  'event',
  'todo',
  'reminder',
  'bookmark',
  'note',
];

export interface MailPrefill {
  type: MailLinkType;
  /** What the capture sheet starts with (one line; the parser reads date, time and amount from it). */
  text: string;
  /** Fields saved along with the entry, merged over the parsed ones. */
  extra: { note?: string; url?: string };
  /** The plain-text excerpt the user may add to a note (not part of `extra` unless chosen). */
  excerpt?: string;
}

const EXCERPT_CHARS = 400;

/** 'YYYY-MM-DD' → '15.11.2026' (a form every language of the parser reads). */
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const money = (cents: number) => `${Math.floor(cents / 100)},${pad2(cents % 100)} €`;
const cleanSubject = (s: string) => s.replace(/^\s*((re|aw|fwd|wg):\s*)+/i, '').trim();

/** The mail as plain text (text part, else the HTML stripped), capped. */
export function mailText(m: Pick<MailMessage, 'text' | 'html'>, limit = 4000): string {
  const raw = m.text ?? (m.html ? plainText(m.html, limit) : '');
  return raw.replace(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * @param link   address that opens the mail (`MailProvider.webUrl`), stored in the entry; absent for sample mail.
 * @param today  'YYYY-MM-DD' (the reminder starts tomorrow).
 * @param withExcerpt  copy the first lines of the mail into a note (off unless the user ticks it).
 */
export function mailPrefill(
  type: MailLinkType,
  m: Pick<MailMessage, 'id' | 'from' | 'subject' | 'date' | 'text' | 'html'>,
  opts: { link?: string; today: string; withExcerpt?: boolean },
): MailPrefill {
  const subject = cleanSubject(m.subject);
  const sender = senderName(m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email);
  const body = mailText(m);
  const excerpt = body
    ? body.slice(0, EXCERPT_CHARS) + (body.length > EXCERPT_CHARS ? ' …' : '')
    : undefined;
  const found = analyzeMessage({
    id: m.id,
    from: sender,
    subject,
    snippet: body.slice(0, 1500),
    dateMs: m.date,
    bulk: false,
  });
  const link = opts.link;
  const base = { type, extra: {} as MailPrefill['extra'], excerpt };

  switch (type) {
    case 'invoice': {
      const amount = found?.amountMinor;
      const due = found?.kind === 'invoice' ? found.date : undefined;
      return {
        ...base,
        text: [
          found?.kind === 'invoice' ? found.title : sender,
          amount ? money(amount) : '',
          due ? dmy(due) : '',
        ]
          .filter(Boolean)
          .join(' '),
        extra: link ? { note: link } : {},
      };
    }
    case 'event': {
      const when = found?.kind === 'event' ? found : undefined;
      return {
        ...base,
        text: [subject || sender, when?.date ? dmy(when.date) : '', when?.time ?? '']
          .filter(Boolean)
          .join(' '),
        extra: link ? { note: link } : {},
      };
    }
    case 'reminder':
      return {
        ...base,
        text: `${subject || sender} ${dmy(addDaysStr(opts.today, 1))} 09:00`,
        extra: link ? { note: link } : {},
      };
    case 'bookmark':
      return { ...base, text: subject || sender, extra: link ? { url: link } : {} };
    case 'note':
      return {
        ...base,
        text: subject || sender,
        extra: {
          note:
            [link, opts.withExcerpt ? excerpt : undefined].filter(Boolean).join('\n\n') ||
            undefined,
        },
      };
    case 'todo':
    default:
      return { ...base, text: subject || sender, extra: link ? { note: link } : {} };
  }
}
