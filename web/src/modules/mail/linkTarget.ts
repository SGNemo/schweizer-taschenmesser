/**
 * Mail threads as link targets (`contributions.linkTarget`, docs/design/planner-hub/CONCEPT-LINKS.md §1.4). The
 * cache is device-local, so a thread that is not in it is not „gone“ but `elsewhere`: the link then offers the
 * provider's web mail (an address without any account, opened only on a tap). Reads the cache only, never the
 * network. The id is untrusted: only a plain provider id passes (`safeThreadId`), everything else is `gone`.
 */
import { mailThreadUrl, safeThreadId } from '@/core/mail/service';
import type { LinkTarget } from '@/core/modules/types';
import { openJson } from '@/core/crypto/aead';
import { getDeviceKey } from '@/core/secrets/deviceKey';
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
    // Any account of this device: the row id is `<accountKey>|<threadId>`, the link knows no account.
    const row = await threadRepo
      .active()
      .filter((r) => r.threadId === id)
      .first();
    if (!row) {
      const url = mailThreadUrl(id);
      return { state: 'elsewhere', ...(url ? { url } : {}) };
    }
    return { state: 'alive', title: await subjectOf(row), to: `/mail?open=${id}` };
  },
};

export default target;
