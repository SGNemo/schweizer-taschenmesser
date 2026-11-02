/**
 * Provider-neutral mailbox contract. Gmail implements it today (`connectors/google/gmail.ts`); an IMAP
 * connector could implement the same interface later. Everything here is plain data. Mail content never
 * goes to a cloud model (`core/ai` must not import this folder, pinned by `core/mail/isolation.test.ts`).
 */
import type { ConnectorContext } from '@/core/connectors/types';

export interface MailLabel {
  id: string;
  name: string;
  kind: 'system' | 'user';
  /** Unread messages carrying the label, when the service tells. */
  unread?: number;
}

export interface MailAttachment {
  /** Id to fetch the bytes with `MailProvider.attachment`. */
  id: string;
  filename: string;
  mime: string;
  size: number;
}

/** An image the mail body refers to as `cid:<contentId>`. */
export interface MailInlinePart {
  contentId: string;
  mime: string;
  attachmentId: string;
  size: number;
}

export interface MailAddress {
  name?: string;
  email: string;
}

export interface MailMessage {
  id: string;
  threadId: string;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  /** Epoch ms (the service's own timestamp). */
  date: number;
  labelIds: string[];
  unread: boolean;
  /** Plain-text part, if the mail has one. */
  text?: string;
  /** HTML part, if the mail has one. Untrusted: always run through `sanitizeMailHtml`. */
  html?: string;
  attachments: MailAttachment[];
  inline: MailInlinePart[];
}

export interface MailThreadSummary {
  id: string;
  messageCount: number;
  /** Sender of the newest message. */
  from: MailAddress;
  subject: string;
  snippet: string;
  /** Epoch ms of the newest message. */
  date: number;
  unread: boolean;
  labelIds: string[];
  hasAttachment: boolean;
}

export interface MailThread {
  id: string;
  messages: MailMessage[];
}

export interface MailPage {
  threads: MailThreadSummary[];
  nextPageToken?: string;
}

export interface ListRequest {
  /** Search text in the service's own syntax (Gmail: `from:x has:attachment`), passed through untouched. */
  query?: string;
  labelIds?: string[];
  pageToken?: string;
  /** Page size (default 25). */
  max?: number;
}

/** What a mail service has to offer. Every call gets the context of one account. */
export interface MailProvider {
  labels(ctx: ConnectorContext): Promise<MailLabel[]>;
  threads(ctx: ConnectorContext, req: ListRequest): Promise<MailPage>;
  thread(ctx: ConnectorContext, id: string): Promise<MailThread>;
  attachment(ctx: ConnectorContext, messageId: string, attachmentId: string): Promise<Uint8Array>;
  /** Unread threads in the inbox. */
  unread(ctx: ConnectorContext): Promise<number>;
  /** Link that opens the thread in the service's own web app. */
  webUrl?(threadId: string, email?: string): string;
}

/** One mailbox the user connected: a connector plus (for extra logins) the account id. */
export interface MailAccountRef {
  /** Stable key (`google`, `google#a1b2`): connector id plus `#accountId`. */
  key: string;
  connectorId: string;
  accountId?: string;
  /** Mail address when known, else a numbered placeholder is shown by the UI. */
  email?: string;
}

export type MailErrorCode = 'expired' | 'denied' | 'rate-limited' | 'network' | 'not-connected';
