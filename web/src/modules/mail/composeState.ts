import { parseRecipients } from '@/core/mail/address';
import { ComposeError, MAX_MAIL_BYTES } from '@/core/mail/compose';
import type { ComposeFields } from '@/core/mail/reply';
import type { MailAddress, OutgoingAttachment, OutgoingMail } from '@/core/mail/types';

/** What the compose window holds: the fields as typed, attachments already read. */
export interface ComposeState extends ComposeFields {
  bcc: string;
  attachments: OutgoingAttachment[];
  /** The draft this was opened from (saved again, deleted after sending). */
  draftId?: string;
}

export const emptyCompose = (over: Partial<ComposeState> = {}): ComposeState => ({
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  text: '',
  attachments: [],
  ...over,
});

export type ComposeProblem =
  { code: 'no-recipient' | 'too-large' } | { code: 'bad-address'; invalid: string[] };

/** The typed fields as a mail, or what is wrong with them (nothing is sent either way). */
export function toOutgoing(s: ComposeState): { mail: OutgoingMail } | { problem: ComposeProblem } {
  const to = parseRecipients(s.to);
  const cc = parseRecipients(s.cc);
  const bcc = parseRecipients(s.bcc);
  const invalid = [...to.invalid, ...cc.invalid, ...bcc.invalid];
  if (invalid.length > 0) return { problem: { code: 'bad-address', invalid } };
  if (to.valid.length + cc.valid.length + bcc.valid.length === 0)
    return { problem: { code: 'no-recipient' } };
  const size = s.text.length + s.attachments.reduce((n, a) => n + a.data.length, 0);
  if (size > MAX_MAIL_BYTES) return { problem: { code: 'too-large' } };
  return {
    mail: {
      to: to.valid,
      cc: cc.valid,
      bcc: bcc.valid,
      subject: s.subject.trim(),
      text: s.text,
      attachments: s.attachments,
      threadId: s.threadId,
      inReplyTo: s.inReplyTo,
    },
  };
}

/** A draft needs no recipient yet: whatever parses is kept. */
export function toDraft(s: ComposeState): OutgoingMail | undefined {
  const lenient = (v: string): MailAddress[] => parseRecipients(v).valid;
  try {
    return {
      to: lenient(s.to),
      cc: lenient(s.cc),
      bcc: lenient(s.bcc),
      subject: s.subject.trim(),
      text: s.text,
      attachments: s.attachments,
      threadId: s.threadId,
      inReplyTo: s.inReplyTo,
    };
  } catch (e) {
    if (e instanceof ComposeError) return undefined;
    throw e;
  }
}
