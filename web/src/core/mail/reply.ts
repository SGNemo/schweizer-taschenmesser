/**
 * Starting points for "Antworten", "Allen antworten" and "Weiterleiten": the fields of the compose
 * window, filled from the mail. Pure; the quote header ("Am … schrieb …") comes in as text so it can be in
 * the user's language. Attachments are not forwarded along (the user adds them, so nothing travels unseen).
 */
import { formatAddress } from './address';
import type { MailAddress, MailMessage } from './types';

export interface ComposeFields {
  to: string;
  cc: string;
  subject: string;
  text: string;
  threadId?: string;
  inReplyTo?: { messageId: string; references: string };
}

const PREFIX = /^\s*((re|aw|fwd|fw|wg):\s*)+/i;
const withPrefix = (prefix: 'Re' | 'Fwd', subject: string): string =>
  `${prefix}: ${subject.replace(PREFIX, '').trim()}`;

const quoted = (text: string): string =>
  text
    .split(/\r?\n/)
    .map((l) => `> ${l}`)
    .join('\n');

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function replyFields(
  m: MailMessage,
  opts: { all: boolean; me?: string; quoteHeader: string; body: string },
): ComposeFields {
  const others = (list: MailAddress[]) =>
    list
      .filter((a) => !opts.me || !same(a.email, opts.me))
      .filter((a) => !same(a.email, m.from.email));
  return {
    to: formatAddress(m.from),
    cc: opts.all ? [...others(m.to), ...others(m.cc)].map(formatAddress).join(', ') : '',
    subject: withPrefix('Re', m.subject),
    text: `\n\n${opts.quoteHeader}\n${quoted(opts.body)}`,
    threadId: m.threadId,
    inReplyTo: m.rfcMessageId
      ? {
          messageId: m.rfcMessageId,
          references: [m.references, m.rfcMessageId].filter(Boolean).join(' '),
        }
      : undefined,
  };
}

export function forwardFields(
  m: MailMessage,
  opts: { header: string; body: string },
): ComposeFields {
  return {
    to: '',
    cc: '',
    subject: withPrefix('Fwd', m.subject),
    text: `\n\n${opts.header}\n${opts.body}`,
    threadId: undefined, // a forward starts its own conversation
  };
}
