/**
 * Gmail as a `MailProvider` (scope `gmail.readonly`): labels, threads, search (Gmail syntax passed
 * through), full messages with MIME parsing, attachments. Read-only; nothing here writes to the mailbox.
 */
import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';
import type {
  ListRequest,
  MailAddress,
  MailAttachment,
  MailInlinePart,
  MailLabel,
  MailMessage,
  MailPage,
  MailProvider,
  MailThread,
  MailThreadSummary,
} from '@/core/mail/types';
import { googleGet, type GoogleResponse } from './http';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const PAGE = 25;
const PARALLEL = 5;

/** GET with one token refresh after a 401 (an access token can expire between two calls). */
async function gmailGet(
  ctx: ConnectorContext,
  path: string,
  params: Record<string, string | string[] | undefined> = {},
): Promise<GoogleResponse> {
  try {
    return await googleGet(ctx, `${API}${path}`, params);
  } catch (e) {
    if (!(e instanceof ConnectorError) || e.code !== 'expired') throw e;
    await ctx.accessToken({ refresh: true });
    return await googleGet(ctx, `${API}${path}`, params);
  }
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string');

/** Runs `fn` over `items` with at most `PARALLEL` calls at a time, keeping the order. */
async function mapLimited<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker));
  return out;
}

/* --------------------------------- addresses & MIME --------------------------------- */

export function parseAddress(raw: string): MailAddress {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw);
  if (m) return { name: m[1]!.trim() || undefined, email: m[2]!.trim() };
  return { email: raw.trim() };
}

/** Splits a header list on commas that are not inside quotes or angle brackets. */
export function parseAddressList(raw: string): MailAddress[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const ch of raw) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === '<') depth += 1;
    else if (!quoted && ch === '>') depth = Math.max(0, depth - 1);
    if (ch === ',' && !quoted && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map(parseAddress);
}

export function decodeBase64Url(data: string): Uint8Array {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function decodeText(data: string, contentType: string): string {
  const charset = /charset="?([^";\s]+)"?/i.exec(contentType)?.[1] ?? 'utf-8';
  const bytes = decodeBase64Url(data);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

const header = (part: Json, name: string): string => {
  const wanted = name.toLowerCase();
  for (const h of arr(part.headers)) {
    const o = obj(h);
    if (str(o.name).toLowerCase() === wanted) return str(o.value);
  }
  return '';
};

interface Walk {
  text: string[];
  html: string[];
  attachments: MailAttachment[];
  inline: MailInlinePart[];
}

function walk(part: Json, into: Walk): void {
  const mime = str(part.mimeType).toLowerCase();
  const body = obj(part.body);
  const filename = str(part.filename);
  const attachmentId = str(body.attachmentId);
  const contentId = header(part, 'Content-ID').replace(/^<|>$/g, '');
  const disposition = header(part, 'Content-Disposition').toLowerCase();
  const size = typeof body.size === 'number' ? body.size : 0;

  const sub = arr(part.parts);
  if (sub.length > 0) {
    for (const p of sub) walk(obj(p), into);
    return;
  }
  const isAttachment = disposition.startsWith('attachment') || filename !== '';
  if (
    attachmentId &&
    contentId &&
    mime.startsWith('image/') &&
    !disposition.startsWith('attachment')
  ) {
    into.inline.push({ contentId, mime, attachmentId, size });
    return;
  }
  if (attachmentId && (isAttachment || !mime.startsWith('text/'))) {
    into.attachments.push({
      id: attachmentId,
      filename: filename || 'attachment',
      mime: mime || 'application/octet-stream',
      size,
    });
    return;
  }
  const data = str(body.data);
  if (!data) return;
  if (mime === 'text/plain') into.text.push(decodeText(data, header(part, 'Content-Type')));
  else if (mime === 'text/html') into.html.push(decodeText(data, header(part, 'Content-Type')));
}

export function parseMessage(raw: unknown): MailMessage {
  const m = obj(raw);
  const payload = obj(m.payload);
  const into: Walk = { text: [], html: [], attachments: [], inline: [] };
  walk(payload, into);
  const labelIds = strs(m.labelIds);
  return {
    id: str(m.id),
    threadId: str(m.threadId),
    from: parseAddress(header(payload, 'From')),
    to: parseAddressList(header(payload, 'To')),
    cc: parseAddressList(header(payload, 'Cc')),
    subject: header(payload, 'Subject'),
    date: Number(m.internalDate) || 0,
    labelIds,
    unread: labelIds.includes('UNREAD'),
    text: into.text.length ? into.text.join('\n') : undefined,
    html: into.html.length ? into.html.join('\n') : undefined,
    attachments: into.attachments,
    inline: into.inline,
  };
}

function summarize(raw: unknown, snippetFallback = ''): MailThreadSummary {
  const t = obj(raw);
  const messages = arr(t.messages).map(obj);
  const last = messages[messages.length - 1] ?? {};
  const first = messages[0] ?? {};
  const lastPayload = obj(last.payload);
  const labelIds = [...new Set(messages.flatMap((m) => strs(m.labelIds)))];
  return {
    id: str(t.id),
    messageCount: messages.length,
    from: parseAddress(header(lastPayload, 'From')),
    subject: header(obj(first.payload), 'Subject'),
    snippet: str(last.snippet) || snippetFallback,
    date: Number(last.internalDate) || 0,
    unread: labelIds.includes('UNREAD'),
    labelIds,
    hasAttachment: false,
  };
}

/* ------------------------------------- provider ------------------------------------- */

export const gmailProvider: MailProvider = {
  async labels(ctx): Promise<MailLabel[]> {
    const list = arr(obj((await gmailGet(ctx, '/labels')).json).labels).map(obj);
    const base: MailLabel[] = list.map((l) => ({
      id: str(l.id),
      name: str(l.name),
      kind: str(l.type) === 'system' ? 'system' : 'user',
    }));
    // Unread counts: the inbox and the user's own labels (bounded; the other system labels are noise).
    const counted = base.filter((l) => l.id === 'INBOX' || l.kind === 'user').slice(0, 25);
    await mapLimited(counted, async (l) => {
      try {
        const detail = obj((await gmailGet(ctx, `/labels/${encodeURIComponent(l.id)}`)).json);
        if (typeof detail.threadsUnread === 'number') l.unread = detail.threadsUnread;
      } catch {
        // a label without a count is still a label
      }
    });
    return base;
  },

  async threads(ctx, req: ListRequest): Promise<MailPage> {
    const res = obj(
      (
        await gmailGet(ctx, '/threads', {
          q: req.query?.trim() || undefined,
          labelIds: req.labelIds,
          pageToken: req.pageToken,
          maxResults: String(req.max ?? PAGE),
        })
      ).json,
    );
    const ids = arr(res.threads).map(obj);
    const threads = await mapLimited(ids, async (t) => {
      const full = await gmailGet(ctx, `/threads/${encodeURIComponent(str(t.id))}`, {
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      });
      return summarize(full.json, str(t.snippet));
    });
    return { threads, nextPageToken: str(res.nextPageToken) || undefined };
  },

  async thread(ctx, id): Promise<MailThread> {
    const res = obj(
      (await gmailGet(ctx, `/threads/${encodeURIComponent(id)}`, { format: 'full' })).json,
    );
    return { id: str(res.id) || id, messages: arr(res.messages).map(parseMessage) };
  },

  async attachment(ctx, messageId, attachmentId): Promise<Uint8Array> {
    const res = obj(
      (
        await gmailGet(
          ctx,
          `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
        )
      ).json,
    );
    return decodeBase64Url(str(res.data));
  },

  async unread(ctx): Promise<number> {
    const res = obj((await gmailGet(ctx, '/labels/INBOX')).json);
    return typeof res.threadsUnread === 'number' ? res.threadsUnread : 0;
  },

  webUrl(threadId, email) {
    const user = email ? `?authuser=${encodeURIComponent(email)}` : '';
    return `https://mail.google.com/mail/${user}#all/${encodeURIComponent(threadId)}`;
  },
};
