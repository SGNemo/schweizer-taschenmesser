/**
 * The unlocked state of the vault, in memory only. Locking drops the key and every decrypted value;
 * nothing here is ever persisted or logged.
 */
import { create } from 'zustand';
import type { KeychainHeader } from '@/core/crypto';

export interface UnlockedSession {
  status: 'unlocked';
  vaultId: string;
  header: KeychainHeader;
  dek: CryptoKey;
}

export type Session = { status: 'locked' } | UnlockedSession;

export const useSession = create<{ session: Session }>(() => ({ session: { status: 'locked' } }));

export const getSession = (): Session => useSession.getState().session;
export const setSession = (session: Session): void => useSession.setState({ session });
export const isUnlocked = (): boolean => getSession().status === 'unlocked';
