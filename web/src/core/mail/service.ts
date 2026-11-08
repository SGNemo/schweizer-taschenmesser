/**
 * Network side of the mail module: resolves an account to its connector's `MailProvider` and context.
 * Errors keep their `ConnectorError` code (`expired`, `denied` = scope missing, `rate-limited`, `network`);
 * for the first account the connector status is updated like everywhere else, so Settings shows
 * "Neu anmelden" when the token is gone.
 */
import { createContext } from '@/core/connectors/context';
import { getConnector } from '@/core/connectors/registry';
import { failureStatus } from '@/core/connectors/service';
import { saveStatus } from '@/core/connectors/state';
import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';
import type {
  ListRequest,
  MailAccountRef,
  MailDraftRef,
  MailFeature,
  MailLabel,
  MailPage,
  MailProvider,
  MailThread,
  OutgoingMail,
  ThreadChange,
} from './types';

function resolve(ref: MailAccountRef): { provider: MailProvider; ctx: ConnectorContext } {
  const def = getConnector(ref.connectorId);
  if (!def?.mailbox) throw new ConnectorError('unsupported', 'no mailbox');
  return { provider: def.mailbox, ctx: createContext(def, undefined, ref.accountId) };
}

async function call<T>(
  ref: MailAccountRef,
  fn: (p: MailProvider, ctx: ConnectorContext) => Promise<T>,
): Promise<T> {
  const { provider, ctx } = resolve(ref);
  try {
    return await fn(provider, ctx);
  } catch (e) {
    if (
      !ref.accountId &&
      e instanceof ConnectorError &&
      (e.code === 'expired' || e.code === 'rate-limited')
    )
      await saveStatus(ref.connectorId, failureStatus(e));
    throw e;
  }
}

export const mailLabels = (ref: MailAccountRef): Promise<MailLabel[]> =>
  call(ref, (p, ctx) => p.labels(ctx));
export const mailThreads = (ref: MailAccountRef, req: ListRequest): Promise<MailPage> =>
  call(ref, (p, ctx) => p.threads(ctx, req));
export const mailThread = (ref: MailAccountRef, id: string): Promise<MailThread> =>
  call(ref, (p, ctx) => p.thread(ctx, id));
export const mailAttachment = (
  ref: MailAccountRef,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> => call(ref, (p, ctx) => p.attachment(ctx, messageId, attachmentId));
export const mailUnread = (ref: MailAccountRef): Promise<number> =>
  call(ref, (p, ctx) => p.unread(ctx));

/**
 * Address that opens the thread in the provider's web mail. `forStorage`: for anything saved into an
 * entry (note, bookmark URL) – without the account's mail address (`?authuser=`), so no address lands
 * in synced data, backups or the data API (U17); the browser then opens the signed-in account.
 * „In Gmail öffnen“ keeps the account.
 */
export function mailWebUrl(
  ref: MailAccountRef,
  threadId: string,
  opts: { forStorage?: boolean } = {},
): string | undefined {
  return getConnector(ref.connectorId)?.mailbox?.webUrl?.(
    threadId,
    opts.forStorage ? undefined : ref.email,
  );
}

/* ---------------------------------- write side (opt-in) ---------------------------------- */

/** Did the user switch this permission on for the account? (Set at login: the token carries its scope.) */
export const hasFeature = (ref: MailAccountRef, feature: MailFeature): boolean =>
  ref.features?.includes(feature) ?? false;

/**
 * Every write goes through here: no call leaves for an account whose permission is off (`denied`, which
 * the UI explains), and none for a provider that cannot do it (`unsupported`). The callers in `modules/mail`
 * only run after the user confirmed.
 */
async function write<T>(
  ref: MailAccountRef,
  feature: MailFeature,
  fn: (p: MailProvider, ctx: ConnectorContext) => Promise<T> | undefined,
): Promise<T> {
  if (!hasFeature(ref, feature)) throw new ConnectorError('denied', 'permission is off');
  return call(ref, async (p, ctx) => {
    const run = fn(p, ctx);
    if (!run) throw new ConnectorError('unsupported', 'not offered by this mailbox');
    return run;
  });
}

export const mailModify = (
  ref: MailAccountRef,
  threadId: string,
  change: ThreadChange,
): Promise<void> => write(ref, 'mail-modify', (p, ctx) => p.modify?.(ctx, threadId, change));
export const mailTrash = (ref: MailAccountRef, threadId: string): Promise<void> =>
  write(ref, 'mail-modify', (p, ctx) => p.trash?.(ctx, threadId));
export const mailUntrash = (ref: MailAccountRef, threadId: string): Promise<void> =>
  write(ref, 'mail-modify', (p, ctx) => p.untrash?.(ctx, threadId));
export const mailSend = (
  ref: MailAccountRef,
  mail: OutgoingMail,
): Promise<{ id: string; threadId: string }> =>
  write(ref, 'mail-send', (p, ctx) => p.send?.(ctx, mail));
export const mailSaveDraft = (
  ref: MailAccountRef,
  mail: OutgoingMail,
  draftId?: string,
): Promise<MailDraftRef> =>
  write(ref, 'mail-modify', (p, ctx) => p.saveDraft?.(ctx, mail, draftId));
export const mailDeleteDraft = (ref: MailAccountRef, draftId: string): Promise<void> =>
  write(ref, 'mail-modify', (p, ctx) => p.deleteDraft?.(ctx, draftId));
export const mailDrafts = (ref: MailAccountRef): Promise<MailDraftRef[]> =>
  call(ref, async (p, ctx) => (p.drafts ? p.drafts(ctx) : []));
