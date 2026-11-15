/**
 * Mail threads as link targets (`contributions.linkTarget`, docs/design/planner-hub/CONCEPT-LINKS.md §1.4). The
 * cache is device-local, so a thread that is not in it is not „gone“ but `elsewhere`: the link then offers the
 * provider's web mail (an address without any account, opened only on a tap). Reads the cache only, never the
 * network. The id is untrusted: only a plain provider id passes (`safeThreadId`), everything else is `gone`.
 */
import { listMailAccounts } from '@/core/mail/accounts';
import { mailThreadUrl, safeThreadId } from '@/core/mail/service';
import type { LinkTarget } from '@/core/modules/types';
import { openJson } from '@/core/crypto/aead';
import { getDeviceKey } from '@/core/secrets/deviceKey';
import { DEMO_ACCOUNT } from './cache';
import { threadRepo } from './repo';
import { threadMetaSchema, type CachedThread } from './schema';

/** The cached subject; empty when the row is sealed with a key this device no longer has (the link's label stands in). */
async function subjectOf(row: CachedThread & { id: string }): Promise<string> {
  if (row.demo) return row.demo.subject;
  if (!row.sealed) return '';
  try {
    return threadMetaSchema.parse(await openJson(await getDeviceKey(), row.id, row.sealed)).subject;
  } catch {
    return '';
  }
}

const target: LinkTarget = {
  async resolve(raw) {
    const id = safeThreadId(raw);
    if (!id) return { state: 'gone' };
    // The link knows no account: every mailbox of this device is probed by its row key `<accountKey>|<threadId>`
    // (a key read each, no scan). The route names the account that has the thread, because the mail page opens
    // `?open=` only inside the chosen account; the key is device-local and only ever part of this route.
    const keys = [...(await listMailAccounts()).map((a) => a.key), DEMO_ACCOUNT];
    for (const key of keys) {
      const row = await threadRepo.get(`${key}|${id}`);
      if (row)
        return {
          state: 'alive',
          title: await subjectOf(row),
          to: `/mail?account=${encodeURIComponent(key)}&open=${id}`,
        };
    }
    const url = mailThreadUrl(id);
    return { state: 'elsewhere', ...(url ? { url } : {}) };
  },
};

export default target;
