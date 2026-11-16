import { bus } from '@/core/events/bus';
import { getPlatform } from '@/core/platform';
import type { ExchangeEvent, ExchangeService, ExchangeSession } from '@/core/platform/types';
import { UNDO_KEEP_MS, expired, problemOf } from './logic';
import { now } from '@/core/time/now';
import { itemRepo } from './repo';
import { useExchangeView } from './state';

/**
 * The module's background work, started with the app (`contributions.services`):
 * * every device: cards older than 30 days and removed cards past the undo window are deleted for
 *   good (at start and every hour);
 * * the PC: received items and the devices' answers are taken over from the shell (when it says
 *   something changed, and every few seconds) – stored first, then confirmed;
 * * the phone: one session with the PC while the app is in front (opened at start, when the app
 *   comes back, every minute while there is none; pinged every 50 s), waiting cards go out on it.
 * Nothing of it reaches the assistant, the search or a log.
 */
const STATUS_EVERY_MS = 5_000;
const RETRY_EVERY_MS = 60_000;
const PING_EVERY_MS = 50_000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;

/** Errors that sending the same item again can never fix: the card says „Kam nicht an.“ */
const FINAL = new Set(['bad-item', 'bad-id', 'bad-kind', 'bad-peer', 'not-found']);

let session: ExchangeSession | null = null;
let opening = false;
/** Bumped by every `closed` event: an `open` that was overtaken by one keeps no dead session. */
let closings = 0;
let pulling: Promise<void> = Promise.resolve();

/**
 * Takes received items and answers over into the history (stored, then confirmed). One run at a
 * time: the shell hands out the same items until they are confirmed, so two runs side by side
 * would both store them.
 */
export function pull(ex: ExchangeService): Promise<void> {
  return serial(() => pullOnce(ex));
}

/** One queue for everything that reads a card's state and writes it back. */
function serial(work: () => Promise<void>): Promise<void> {
  const run = pulling.then(work);
  pulling = run.catch(() => undefined);
  return run;
}

async function pullOnce(ex: ExchangeService): Promise<void> {
  const { items, answers } = await ex.take();
  const keep: { peer: string; id: string }[] = [];
  for (const item of items) {
    // removed cards count too: a confirm that did not land must not bring one back
    const known = await itemRepo.table
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
    keep.push({ peer: item.peer, id: item.id });
  }
  for (const a of answers) await answered(a.id, a.state, a.peer);
  if (keep.length || answers.length) {
    await ex.confirm(
      keep,
      answers.map((a) => ({ peer: a.peer, id: a.id })),
    );
  }
}

async function answered(
  itemId: string,
  state: 'delivered' | 'full' | 'rejected',
  peer?: string,
): Promise<void> {
  const row = await itemRepo
    .active()
    .filter((r) => r.itemId === itemId && r.direction === 'out' && (!peer || r.peer === peer))
    .first();
  if (row && row.state !== state) await itemRepo.update(row.id, { state });
}

/**
 * `waiting` → `sent` only: an answer that came in meanwhile is never stepped back. Runs in the same
 * queue as taking answers over, so no answer lands between the check and the write.
 */
function markSent(rowId: string): Promise<void> {
  return serial(async () => {
    const row = await itemRepo.get(rowId);
    if (row?.state === 'waiting') await itemRepo.update(rowId, { state: 'sent' });
  });
}

/**
 * Sends a card that waits; on the PC it is queued, on the phone it goes into the open session. An
 * error the shell will always give for this item marks it `rejected`; any other leaves it waiting
 * for the next try.
 */
export async function deliver(ex: ExchangeService, rowId: string): Promise<void> {
  const row = await itemRepo.get(rowId);
  if (!row || row.direction !== 'out' || row.deletedAt) return;
  const item = { id: row.itemId, kind: row.kind, body: row.body };
  try {
    if (ex.side === 'pc') await ex.send(row.peer, item);
    else if (session) await session.send(item);
    else return; // stays `waiting`; it goes out with the next session
  } catch (e) {
    if (e instanceof Error && FINAL.has(e.message))
      await itemRepo.update(row.id, { state: 'rejected' });
    throw e;
  }
  await markSent(row.id);
}

/**
 * Cards that did not get a final answer yet go out (again): the phone's on a fresh session
 * (`sent` and `full` too: the PC stores an id once), the PC's `waiting` ones on its tick.
 */
async function resend(ex: ExchangeService, states: readonly string[]): Promise<void> {
  const open = await itemRepo
    .active()
    .filter((r) => r.direction === 'out' && states.includes(r.state))
    .toArray();
  for (const r of open) await deliver(ex, r.id).catch(() => undefined);
}

function onPhoneEvent(ex: ExchangeService, e: ExchangeEvent): void {
  if (e.type === 'received') void pull(ex);
  else if (e.type === 'answer') void serial(() => answered(e.id, e.state));
  else {
    session = null;
    closings += 1;
    const p = problemOf(e.reason, e.minutes);
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
  const before = closings;
  try {
    const opened = await ex.open((e) => onPhoneEvent(ex, e));
    // closed already, or the app went to the background while it connected: no session there
    if (closings !== before || document.visibilityState !== 'visible') {
      void opened.close();
      return;
    }
    session = opened;
    useExchangeView.setState({ open: true, problem: null, minutes: null });
    await pull(ex);
    await resend(ex, ['waiting', 'sent', 'full']);
  } catch (e) {
    session = null;
    const p = problemOf(e instanceof Error ? e.message : null);
    useExchangeView.setState({
      open: false,
      problem: p?.problem ?? 'unreachable',
      minutes: p?.minutes ?? null,
    });
  } finally {
    opening = false;
  }
}

/**
 * Deletes for good: cards past the retention, and removed own cards once their undo is over
 * (removed received cards stay as markers until they expire, so a late resend cannot revive them).
 */
export async function sweep(at = now()): Promise<void> {
  const gone = await itemRepo.table
    .filter(
      (r) => expired(r.createdAt, at) || (r.deletedAt !== null && at - r.deletedAt > UNDO_KEEP_MS),
    )
    .primaryKeys();
  if (gone.length) await itemRepo.purge(gone);
}

export async function refreshPc(ex: ExchangeService): Promise<void> {
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
  const sweeper = setInterval(() => void sweep().catch(() => undefined), SWEEP_EVERY_MS);
  const stops: (() => void)[] = [() => clearInterval(sweeper)];
  if (ex.side === 'pc') {
    const changed = () => {
      void pull(ex).catch(() => undefined);
      void refreshPc(ex);
      // queued while the hub was off or the outbox full: tried again (the shell keeps an id once)
      if (!resending) {
        resending = true;
        void resend(ex, ['waiting'])
          .catch(() => undefined)
          .finally(() => (resending = false));
      }
    };
    let resending = false;
    changed();
    stops.push(ex.onChanged(changed));
    // switching the module off switches the PC's exchange off too, so phones hear `exchange-off`
    // (narrowing: no dialog). Awaited before the module's state changes.
    stops.push(
      bus.on('module.disabling', async ({ moduleId }) => {
        if (moduleId === 'exchange') await ex.setEnabled(false).catch(() => undefined);
      }),
    );
    const timer = setInterval(changed, STATUS_EVERY_MS);
    stops.push(() => clearInterval(timer));
  } else {
    void connect(ex);
    const retry = setInterval(() => void connect(ex), RETRY_EVERY_MS);
    const ping = setInterval(() => {
      const current = session;
      current?.ping().catch(() => {
        // gone without a `closed` event: the next retry opens a fresh one
        if (session === current) session = null;
      });
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
