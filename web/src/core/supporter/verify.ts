import { normalizeCode, verifyCode, type SupporterTier } from '@nemo/supporter-codes';
import { ACCEPTED_KEYS } from './keys';

export type SupporterTierId = SupporterTier;

export interface SupporterInfo {
  tier: SupporterTier;
  /** '' = no name. */
  name: string;
  /** Issue date `YYYY-MM-DD`. */
  issued: string;
}

/** Offline check against the embedded public keys. No network, no detail on failure. */
export function checkCode(input: string): SupporterInfo | null {
  const r = verifyCode(input, ACCEPTED_KEYS);
  return r.ok ? { tier: r.tier, name: r.name, issued: r.issued } : null;
}

/** Canonical form of an accepted code, or null if it is not accepted by this app version. */
export function acceptCode(input: string): { code: string; info: SupporterInfo } | null {
  const info = checkCode(input);
  const code = info ? normalizeCode(input) : null;
  return info && code ? { code, info } : null;
}
