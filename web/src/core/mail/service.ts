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
  MailLabel,
  MailPage,
  MailProvider,
  MailThread,
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

export function mailWebUrl(ref: MailAccountRef, threadId: string): string | undefined {
  return getConnector(ref.connectorId)?.mailbox?.webUrl?.(threadId, ref.email);
}
