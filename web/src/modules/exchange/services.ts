import { getPlatform } from '@/core/platform';
import type { ExchangeEvent, ExchangeService, ExchangeSession } from '@/core/platform/types';
import { expired, problemOf } from './logic';
import { itemRepo } from './repo';
import { useExchangeView } from './state';

/**
 * The module's background work, started with the app (`contributions.services`):
 * * every device: cards older than 30 days go;
 * * the PC: received items and the devices' answers are taken over from the shell (when it says
 *   something changed, and every few seconds) – stored first, then confirmed;
 * * the phone: one session with the PC while the app is in front (opened at start, when the app
 *   comes back, every minute while there is none; pinged every 50 s), waiting cards go out on it.
 * Nothing of it reaches the assistant, the search or a log.
 */
const STATUS_EVERY_MS = 5_000;
const RETRY_EVERY_MS = 60_000;
const PING_EVERY_MS = 50_000;

let session: ExchangeSession | null = null;
let opening = false;

/** Takes received items and answers over into the history (stored, then confirmed). */
export async function pull(ex: ExchangeService): Promise<void> {
  const { items, answers } = await ex.take();
  const keep: string[] = [];
  for (const item of items) {
    const known = await itemRepo
      .active()
      .filter((r) => r.itemId === item.id && r.peer === item.peer)
      .first();
    if (!known) {
      await itemRepo.create({
        peer: item.peer,
        itemId: item.id,
        direction: 'in',
        kind: item.kind,
        body: item.body,
        state: 'received',
        unseen: true,
      });
    }
    keep.push(item.id);
  }
  if (keep.length) await ex.confirm(keep);
  for (const a of answers) await answered(a.id, a.state);
}

async function answered(itemId: string, state: 'delivered' | 'full' | 'rejected'): Promise<void> {
  const row = await itemRepo
    .active()
    .filter((r) => r.itemId === itemId && r.direction === 'out')
    .first();
  if (row && row.state !== state) await itemRepo.update(row.id, { state });
}

/** Sends a card that waits; on the PC it is queued, on the phone it goes into the open session. */
export async function deliver(ex: ExchangeService, rowId: string): Promise<void> {
  const row = await itemRepo.get(rowId);
  if (!row || row.direction !== 'out' || row.deletedAt) return;
  const item = { id: row.itemId, kind: row.kind, body: row.body };
  if (ex.side === 'pc') {
    await ex.send(row.peer, item);
    await itemRepo.update(row.id, { state: 'sent' });
    return;
  }
  if (!session) return; // stays `waiting`; it goes out with the next session
  await session.send(item);
  await itemRepo.update(row.id, { state: 'sent' });
}

/** The phone's cards that did not get a final answer yet go out (again) on a fresh session. */
async function resend(ex: ExchangeService): Promise<void> {
  const open = await itemRepo
    .active()
    .filter((r) => r.direction === 'out' && ['waiting', 'sent', 'full'].includes(r.state))
    .toArray();
  for (const r of open) await deliver(ex, r.id).catch(() => undefined);
}

function onPhoneEvent(ex: ExchangeService, e: ExchangeEvent): void {
  if (e.type === 'received') void pull(ex);
  else if (e.type === 'answer') void answered(e.id, e.state);
  else {
    session = null;
    const p = problemOf(e.reason);
    useExchangeView.setState({
      open: false,
      problem: p?.problem ?? 'unreachable',
      minutes: p?.minutes ?? null,
    });
  }
}

export async function connect(ex: ExchangeService): Promise<void> {
  if (session || opening || document.visibilityState !== 'visible') return;
  opening = true;
  try {
    session = await ex.open((e) => onPhoneEvent(ex, e));
    useExchangeView.setState({ open: true, problem: null, minutes: null });
    await pull(ex);
    await resend(ex);
  } catch (e) {
    session = null;
    const p = problemOf(e instanceof Error ? e.message : null);
    useExchangeView.setState({ open: false, problem: p?.problem ?? 'unreachable', minutes: p?.minutes ?? null });
  } finally {
    opening = false;
  }
}

async function sweep(): Promise<void> {
  const old = await itemRepo
    .active()
    .filter((r) => expired(r.createdAt))
    .toArray();
  for (const r of old) await itemRepo.remove(r.id);
}

async function refreshPc(ex: ExchangeService): Promise<void> {
  try {
    useExchangeView.setState({ pc: await ex.status() });
  } catch {
    useExchangeView.setState({ pc: null });
  }
}

export default function start(): () => void {
  const ex = getPlatform().exchange;
  if (!ex.side) return () => undefined;
  void sweep().catch(() => undefined);
  const stops: (() => void)[] = [];
  if (ex.side === 'pc') {
    const changed = () => {
      void pull(ex).catch(() => undefined);
      void refreshPc(ex);
    };
    changed();
    stops.push(ex.onChanged(changed));
    const timer = setInterval(changed, STATUS_EVERY_MS);
    stops.push(() => clearInterval(timer));
  } else {
    void connect(ex);
    const retry = setInterval(() => void connect(ex), RETRY_EVERY_MS);
    const ping = setInterval(() => {
      if (session) session.ping().catch(() => undefined);
    }, PING_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void connect(ex);
      else if (session) {
        // in the background the app may be frozen: the session ends and opens again on return
        void session.close();
        session = null;
        useExchangeView.setState({ open: false });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    stops.push(() => {
      clearInterval(retry);
      clearInterval(ping);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }
  return () => stops.forEach((s) => s());
}
