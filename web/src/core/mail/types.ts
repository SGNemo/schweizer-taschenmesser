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
  /** The `Message-ID` and `References` headers, for replies that stay in the conversation. */
  rfcMessageId?: string;
  references?: string;
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
  /** The sender is a person (header logic, `isPersonalMail`); absent when the provider cannot tell. */
  personal?: boolean;
  /** Provider id of the newest message (an invoice read from the row is keyed on it); absent when unknown. */
  lastMessageId?: string;
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

/** What changes on a thread: label ids to add and to remove (read/unread = `UNREAD`, archive = `INBOX`). */
export interface ThreadChange {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface OutgoingAttachment {
  filename: string;
  mime: string;
  data: Uint8Array;
}

/** A mail the user wrote: plain text, optional attachments. Built into the wire format by `compose.ts`. */
export interface OutgoingMail {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  text: string;
  attachments: OutgoingAttachment[];
  /** A reply or forward stays in this thread; replies also name the message they answer. */
  threadId?: string;
  inReplyTo?: { messageId: string; references: string };
}

/** A saved draft (`id`) and the message that holds its content. */
export interface MailDraftRef {
  id: string;
  messageId: string;
}

/** What a mail service has to offer. Every call gets the context of one account. */
export interface MailProvider {
  labels(ctx: ConnectorContext): Promise<MailLabel[]>;
  threads(ctx: ConnectorContext, req: ListRequest): Promise<MailPage>;
  thread(ctx: ConnectorContext, id: string): Promise<MailThread>;
  attachment(ctx: ConnectorContext, messageId: string, attachmentId: string): Promise<Uint8Array>;
  /** Unread threads in the inbox. */
  unread(ctx: ConnectorContext): Promise<number>;
  /**
   * Write side, opt-in (separate permission per account, see `MailFeature`): every one of these is only
   * called after the user confirmed in the UI (`modules/mail`), never on its own.
   */
  /** Adds/removes labels on every message of a thread (mark read/unread, archive, label). */
  modify?(ctx: ConnectorContext, threadId: string, change: ThreadChange): Promise<void>;
  /** Moves a thread to the trash (recoverable for 30 days at the service) and back. */
  trash?(ctx: ConnectorContext, threadId: string): Promise<void>;
  untrash?(ctx: ConnectorContext, threadId: string): Promise<void>;
  /** Sends a mail; resolves with the ids of the sent message. */
  send?(ctx: ConnectorContext, mail: OutgoingMail): Promise<{ id: string; threadId: string }>;
  /** Saves a new draft or replaces the content of an existing one. */
  saveDraft?(ctx: ConnectorContext, mail: OutgoingMail, draftId?: string): Promise<MailDraftRef>;
  deleteDraft?(ctx: ConnectorContext, draftId: string): Promise<void>;
  /** The drafts of the mailbox, to find the draft that holds a message. */
  drafts?(ctx: ConnectorContext): Promise<MailDraftRef[]>;
  /** Link that opens the thread in the service's own web app. */
  webUrl?(threadId: string, email?: string): string;
}

/** One mailbox the user connected: a connector plus (for extra logins) the account id. */
export interface MailAccountRef {
  /** Stable key (`google`, `google#a1b2`): connector id plus `#accountId`. */
  key: string;
  /** Connector features the user switched on for this login (`mail`, `mail-modify`, `mail-send`). */
  features?: string[];
  connectorId: string;
  accountId?: string;
  /** Mail address when known, else a numbered placeholder is shown by the UI. */
  email?: string;
}

export type MailErrorCode = 'expired' | 'denied' | 'rate-limited' | 'network' | 'not-connected';

/** The extra permissions of a mailbox, each switched on on its own in Settings → Verbindungen. */
export type MailFeature = 'mail-modify' | 'mail-send';
