/**
 * The send window. A mail the user confirmed does not leave at once: it waits `SEND_WINDOW_MS` here, with
 * "Zurückziehen" and "Jetzt senden" in `PendingSendBar`. Withdrawing sends nothing and hands the text back
 * to the compose window. The wait lives in memory only: closing the app during it sends nothing.
 */
import { create } from 'zustand';
import { mailDeleteDraft, mailSend, hasFeature } from '@/core/mail/service';
import { ConnectorError } from '@/core/connectors/types';
import type { MailAccountRef, MailErrorCode } from '@/core/mail/types';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { toOutgoing, type ComposeState } from './composeState';

export const SEND_WINDOW_MS = 10_000;

export interface PendingSend {
  id: number;
  account: MailAccountRef;
  state: ComposeState;
  /** Short text for the bar ("Anna, ben@…"). */
  to: string;
  endsAt: number;
  phase: 'waiting' | 'sending' | 'failed';
  error?: MailErrorCode;
}

interface Store {
  items: PendingSend[];
}

export const usePendingSends = create<Store>(() => ({ items: [] }));

const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 0;

const patch = (id: number, over: Partial<PendingSend>) =>
  usePendingSends.setState((s) => ({
    items: s.items.map((i) => (i.id === id ? { ...i, ...over } : i)),
  }));
const remove = (id: number) =>
  usePendingSends.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }));

const codeOf = (e: unknown): MailErrorCode =>
  e instanceof ConnectorError &&
  (e.code === 'expired' || e.code === 'denied' || e.code === 'rate-limited')
    ? e.code
    : 'network';

/** Starts the wait. Only reached from the confirmation step of the compose window. */
export function queueSend(
  account: MailAccountRef,
  state: ComposeState,
  windowMs = SEND_WINDOW_MS,
): number | undefined {
  const built = toOutgoing(state);
  if ('problem' in built || !hasFeature(account, 'mail-send')) return undefined;
  const id = ++nextId;
  const to = [...built.mail.to, ...built.mail.cc, ...built.mail.bcc]
    .map((a) => a.name || a.email)
    .join(', ');
  usePendingSends.setState((s) => ({
    items: [...s.items, { id, account, state, to, endsAt: now() + windowMs, phase: 'waiting' }],
  }));
  timers.set(
    id,
    setTimeout(() => void run(id), windowMs),
  );
  return id;
}

async function run(id: number): Promise<void> {
  timers.delete(id);
  const item = usePendingSends.getState().items.find((i) => i.id === id);
  if (!item || item.phase === 'sending') return;
  const built = toOutgoing(item.state);
  if ('problem' in built) return remove(id);
  patch(id, { phase: 'sending', error: undefined });
  try {
    await mailSend(item.account, built.mail);
  } catch (e) {
    patch(id, { phase: 'failed', error: codeOf(e) });
    return;
  }
  remove(id);
  useUiStore.getState().toast(t.mail.write.pending.sent);
  // A draft that was sent is not needed any more (only possible with the manage permission).
  if (item.state.draftId && hasFeature(item.account, 'mail-modify'))
    await mailDeleteDraft(item.account, item.state.draftId).catch(() => undefined);
}

/** "Jetzt senden" (and "Erneut versuchen"): no more waiting. */
export function sendNow(id: number): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  void run(id);
}

/** "Zurückziehen": nothing was sent; the text goes back to the caller to reopen the compose window. */
export function withdraw(id: number): ComposeState | undefined {
  const item = usePendingSends.getState().items.find((i) => i.id === id);
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  remove(id);
  return item?.state;
}

/** Test helper: forget everything. */
export function resetPendingSends(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  usePendingSends.setState({ items: [] });
}
