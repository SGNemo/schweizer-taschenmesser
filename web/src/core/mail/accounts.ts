import { accountKey } from '@/core/connectors/context';
import { connectors } from '@/core/connectors/registry';
import { loadStatus } from '@/core/connectors/state';
import type { MailAccountRef } from './types';

const usable = (state: string) =>
  state === 'connected' || state === 'rate-limited' || state === 'error';

/**
 * The mailboxes the user connected: every account of every connector with a `mailbox` capability whose
 * "mail" feature is switched on. The first account comes first.
 */
export async function listMailAccounts(): Promise<MailAccountRef[]> {
  const out: MailAccountRef[] = [];
  for (const def of connectors.filter((c) => c.mailbox)) {
    const status = await loadStatus(def.id);
    if (!usable(status.state) && status.state !== 'expired') continue;
    if (status.features.includes('mail'))
      out.push({ key: def.id, connectorId: def.id, email: status.account });
    for (const a of status.accounts ?? [])
      if (a.features.includes('mail'))
        out.push({
          key: accountKey(def.id, a.id),
          connectorId: def.id,
          accountId: a.id,
          email: a.email,
        });
  }
  return out;
}
