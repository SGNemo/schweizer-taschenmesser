import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { entryRepo } from './repo';
import { useSession } from './session';
import {
  decryptRow,
  isReadable,
  readHeader,
  type DecryptedEntry,
  type HeaderState,
  type UndecryptableEntry,
} from './vault';

export const useHeaderState = (): HeaderState | undefined => useLiveQuery(() => readHeader(), []);

export interface VaultEntries {
  entries: DecryptedEntry[];
  broken: UndecryptableEntry[];
}

/**
 * The decrypted entries while the vault is unlocked. The plaintext lives only in this component
 * state; locking (session change) clears it immediately.
 */
export function useEntries(): VaultEntries | undefined {
  const rows = useLiveQuery(() => entryRepo.active().toArray(), []);
  const session = useSession((s) => s.session);
  const [state, setState] = useState<VaultEntries>();

  useEffect(() => {
    if (session.status !== 'unlocked' || !rows) return;
    let cancelled = false;
    void Promise.all(rows.map((r) => decryptRow(r, session))).then((all) => {
      if (cancelled) return;
      setState({
        entries: all.filter(isReadable),
        broken: all.filter((e): e is UndecryptableEntry => !isReadable(e)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [rows, session]);

  // Derived, not reset in an effect: once the session is locked nothing is handed out (and the page
  // unmounts this hook's owner, dropping the plaintext state with it).
  return session.status === 'unlocked' ? state : undefined;
}
