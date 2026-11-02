import { now } from '@/core/time/now';

/**
 * A new vault entry that a tool hands over to the password vault (the anonymous persona tool: "Im Tresor
 * speichern"). It lives **only in memory** and is never written anywhere: not into the URL, not into
 * localStorage, sessionStorage or the database, not into a log. The vault form reads it once, and it
 * expires after a few minutes if the vault stays locked. A reload or closing the app drops it.
 *
 * Lives in `core` because tools may not import modules and modules may not import tools; both only meet here.
 */
export interface VaultEntryHandoff {
  title: string;
  username: string;
  password: string;
  notes: string;
}

/** How long an offered entry waits (the vault may still be locked). */
export const HANDOFF_TTL_MS = 5 * 60_000;

/** Query flag that tells the vault page a handoff is waiting (the flag carries no data). */
export const HANDOFF_PARAM = 'handoff';

let slot: { value: VaultEntryHandoff; expires: number } | undefined;
let version = 0;

/** Offers an entry; a second offer replaces the first. */
export function offerVaultEntry(value: VaultEntryHandoff): void {
  version++;
  slot = { value: { ...value }, expires: now() + HANDOFF_TTL_MS };
}

/** Reads the waiting entry without removing it (safe to call twice, e.g. in a state initializer). */
export function peekVaultEntry(): VaultEntryHandoff | undefined {
  if (slot && slot.expires <= now()) slot = undefined;
  return slot ? { ...slot.value } : undefined;
}

/** Forgets the waiting entry (after the form has taken it, or when the user leaves). */
export function clearVaultEntry(): void {
  slot = undefined;
}

/** Counts offers, so a page that is already open can tell a new offer from one it has already taken. */
export const vaultEntryVersion = (): number => version;
