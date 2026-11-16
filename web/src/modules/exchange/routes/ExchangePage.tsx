import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { dateTimeFormat } from '@/core/i18n/format';
import { getPlatform } from '@/core/platform';
import type { ExchangeDevice, ExchangeService } from '@/core/platform/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  Checkbox,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  SelectField,
  TextArea,
} from '@/ui';
import { bodyOf, fits, hostOf, kindOf, newItemId, openable } from '../logic';
import { now } from '@/core/time/now';
import { itemRepo } from '../repo';
import { deliver, refreshPc } from '../services';
import { useExchangeView } from '../state';
import styles from '../exchange.module.css';

type Stored = NonNullable<Awaited<ReturnType<typeof itemRepo.get>>>;

/** On the phone every card is with the one paired PC; its outgoing cards name it so. */
const PHONE_PEER = 'pc';

/**
 * Device exchange: one conversation with a paired device (cards, newest at the bottom), a field
 * to send a note or a link. No read receipts, no typing indicator, no counters in the head.
 */
export default function ExchangePage() {
  const ex = getPlatform().exchange;
  return (
    <>
      <PageHeader title={t.exchange.meta.name} />
      {ex.side === 'pc' ? <PcView ex={ex} /> : null}
      {ex.side === 'phone' ? <PhoneView ex={ex} /> : null}
      {ex.side === null ? <EmptyState title={t.exchange.unsupported} /> : null}
    </>
  );
}

function PcView({ ex }: { ex: ExchangeService }) {
  const pc = useExchangeView((s) => s.pc);
  const granted = (pc?.devices ?? []).filter((d) => d.on);
  const [chosen, setChosen] = useState<string | null>(null);
  const device = granted.find((d) => d.id === chosen) ?? granted[0];

  if (!pc) return null;
  if (!pc.running) {
    return (
      <EmptyState title={t.exchange.pc.hubOff}>
        <Link to={settingsPath('sync', 'sync')}>{t.exchange.pc.hubOn}</Link>
      </EmptyState>
    );
  }
  if (pc.devices.length === 0) {
    return (
      <EmptyState title={t.exchange.pc.notPaired}>
        <Link to={settingsPath('sync', 'sync')}>{t.exchange.pc.pair}</Link>
      </EmptyState>
    );
  }
  if (!pc.enabled || !device) return <Setup ex={ex} devices={pc.devices} enabled={pc.enabled} />;
  return (
    <>
      {granted.length > 1 ? (
        <SelectField
          label={t.exchange.pc.device}
          value={device.id}
          onChange={(e) => setChosen(e.target.value)}
        >
          {granted.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name || t.exchange.peer.phone}
            </option>
          ))}
        </SelectField>
      ) : null}
      <ul className={styles.devices}>
        {pc.devices.map((d) => (
          <DeviceLine key={d.id} ex={ex} device={d} />
        ))}
      </ul>
      <Conversation ex={ex} peer={device.id} side="pc" />
    </>
  );
}

/** First run at the PC: which devices may exchange. Preselected only when exactly one is paired. */
function Setup({
  ex,
  devices,
  enabled,
}: {
  ex: ExchangeService;
  devices: ExchangeDevice[];
  enabled: boolean;
}) {
  const [picked, setPicked] = useState<string[]>(() =>
    devices.length === 1 ? devices.map((d) => d.id) : devices.filter((d) => d.on).map((d) => d.id),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fmt = useMemo(() => dateTimeFormat({ dateStyle: 'medium' }), []);

  async function turnOn() {
    setBusy(true);
    setProblem(null);
    try {
      if (!enabled) await ex.setEnabled(true);
      for (const id of picked) {
        const d = devices.find((x) => x.id === id);
        if (d && (!d.on || d.paused)) await ex.setDevice(id, true, false);
      }
      await refreshPc(ex);
    } catch (e) {
      setProblem(widenProblem(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="exchange-setup">
      <h2 id="exchange-setup">{t.exchange.pc.setupTitle}</h2>
      <p>{t.exchange.pc.setupLead}</p>
      <ul className={styles.devices}>
        {devices.map((d) => (
          <li key={d.id}>
            <Checkbox
              label={d.name || t.exchange.peer.phone}
              description={
                d.lastSeen
                  ? t.exchange.pc.lastSeen(fmt.format(new Date(d.lastSeen * 1000)))
                  : undefined
              }
              checked={picked.includes(d.id)}
              onChange={(e) =>
                setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))
              }
            />
          </li>
        ))}
      </ul>
      <p className={styles.note}>{t.exchange.pc.setupHint}</p>
      <Button
        variant="primary"
        disabled={busy || picked.length === 0}
        onClick={() => void turnOn()}
      >
        {t.exchange.pc.setupButton}
      </Button>
      {problem ? (
        <p role="status" className={styles.note}>
          {problem}
        </p>
      ) : null}
    </section>
  );
}

/** Why widening failed, as a calm line. */
function widenProblem(e: unknown): string {
  const code = e instanceof Error ? e.message : '';
  return code === 'cancelled'
    ? t.exchange.pc.cancelled
    : code === 'busy-controlled'
      ? t.exchange.pc.busyControlled
      : t.exchange.pc.failed;
}

/**
 * One paired device at the PC: its state and the one thing to do with it. Switching on and
 * resuming widen what it may do, so the shell asks in a native dialog; pausing never asks.
 */
function DeviceLine({ ex, device }: { ex: ExchangeService; device: ExchangeDevice }) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = device.name || t.exchange.peer.phone;
  const state = !device.on
    ? t.exchange.pc.deviceOff
    : device.paused
      ? t.exchange.pc.paused
      : device.connected
        ? t.exchange.reach.connected
        : t.exchange.reach.away;
  const [label, on, paused] = !device.on
    ? [t.exchange.pc.enable, true, false]
    : device.paused
      ? [t.exchange.pc.resume, true, false]
      : [t.exchange.pc.pause, true, true];

  function act() {
    setBusy(true);
    setProblem(null);
    void ex
      .setDevice(device.id, on, paused)
      .then(() => refreshPc(ex))
      .catch((e: unknown) => setProblem(widenProblem(e)))
      .finally(() => setBusy(false));
  }

  return (
    <li className={styles.device}>
      <span className={styles.note}>
        {name} · {state}
        <span role="status">{problem ? ` ${problem}` : null}</span>
      </span>
      <Button variant="secondary" disabled={busy} onClick={act}>
        {label}
      </Button>
    </li>
  );
}

function PhoneView({ ex }: { ex: ExchangeService }) {
  const { problem, minutes } = useExchangeView();
  if (problem === 'notPaired') {
    return (
      <EmptyState title={t.exchange.phone.notPaired}>
        <Link to={settingsPath('sync', 'sync')}>{t.exchange.phone.pair}</Link>
      </EmptyState>
    );
  }
  const line =
    problem === 'exchangeOff'
      ? t.exchange.phone.exchangeOff
      : problem === 'notGranted'
        ? t.exchange.phone.notGranted
        : problem === 'paused'
          ? t.exchange.phone.paused
          : problem === 'limit'
            ? t.exchange.phone.limit(minutes ?? 60)
            : null;
  return (
    <>
      {line ? (
        <p className={styles.note} role="status">
          {line}
        </p>
      ) : null}
      <Conversation ex={ex} peer={PHONE_PEER} side="phone" />
    </>
  );
}

function Conversation({
  ex,
  peer,
  side,
}: {
  ex: ExchangeService;
  peer: string;
  side: 'pc' | 'phone';
}) {
  const rows = useLiveQuery(
    async () =>
      (
        await itemRepo
          .active()
          .filter((r) => side === 'phone' || r.peer === peer)
          .sortBy('createdAt')
      ).slice(-300),
    [peer, side],
  );
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // what is on screen is seen: the widget's „neu“ clears
  useEffect(() => {
    for (const r of rows ?? []) if (r.unseen) void itemRepo.update(r.id, { unseen: false });
  }, [rows]);

  async function send() {
    if (!text.trim() || sending) return;
    const kind = kindOf(text);
    const body = bodyOf(text, kind);
    setProblem(null);
    if (!fits(body)) {
      setProblem(t.exchange.compose.tooLong);
      return;
    }
    setSending(true);
    try {
      const row = await itemRepo.create({
        peer,
        itemId: newItemId(),
        direction: 'out',
        kind,
        body,
        state: 'waiting',
        unseen: false,
      });
      setText('');
      // on the PC it is queued now; on the phone it goes into the open session (or waits)
      await deliver(ex, row.id).catch(() => undefined);
    } catch {
      setProblem(t.exchange.compose.failed);
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (side === 'pc' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <>
      {rows && rows.length === 0 ? <EmptyState title={t.exchange.empty} /> : null}
      {/* only once the cards are there: an empty log that fills up would read them all aloud */}
      {rows ? (
        <div key={peer} role="log" aria-relevant="additions">
          <ul className={styles.list}>
            {rows.map((r) => (
              <Card key={r.id} row={r} side={side} />
            ))}
          </ul>
        </div>
      ) : null}
      {rows && rows.length > 0 ? <p className={styles.footer}>{t.exchange.footer}</p> : null}
      <div className={styles.compose}>
        <div className={styles.composeField}>
          <TextArea
            label={t.exchange.compose.label}
            placeholder={t.exchange.compose.placeholder}
            value={text}
            rows={2}
            onChange={(e) => {
              setText(e.target.value);
              if (problem) setProblem(null);
            }}
            onKeyDown={onKey}
          />
        </div>
        <Button variant="primary" disabled={!text.trim() || sending} onClick={() => void send()}>
          {t.exchange.compose.send}
        </Button>
      </div>
      {problem ? (
        <p role="status" className={styles.note}>
          {problem}
        </p>
      ) : null}
    </>
  );
}

function stateLine(row: Stored, side: 'pc' | 'phone'): string | null {
  switch (row.state) {
    case 'waiting':
      return side === 'pc' ? t.exchange.state.waitingPc : t.exchange.state.waitingPhone;
    case 'sent':
      return side === 'pc' ? t.exchange.state.waitingPc : t.exchange.state.sent;
    case 'delivered':
      return t.exchange.state.delivered;
    case 'full':
      return side === 'pc' ? t.exchange.state.fullPhone : t.exchange.state.fullPc;
    case 'rejected':
      return t.exchange.state.rejected;
    default:
      return null;
  }
}

function Card({ row, side }: { row: Stored; side: 'pc' | 'phone' }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 3000);
    return () => clearTimeout(timer);
  }, [copied]);
  const time = useMemo(() => {
    const at = new Date(row.createdAt);
    // cards stay 30 days: one from an earlier day says which
    const sameDay = at.toDateString() === new Date(now()).toDateString();
    return dateTimeFormat(
      sameDay
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    ).format(at);
  }, [row.createdAt]);
  const from =
    row.direction === 'out'
      ? t.exchange.from.you
      : side === 'pc'
        ? t.exchange.from.phone
        : t.exchange.from.pc;
  const state = row.direction === 'out' ? stateLine(row, side) : null;
  return (
    <li className={`${styles.card} ${row.direction === 'out' ? styles.out : styles.in}`}>
      <span className={styles.meta}>
        {from} · {t.exchange.kind[row.kind]} · {time}
      </span>
      {row.kind === 'link' ? (
        <>
          <span className={styles.host}>{hostOf(row.body)}</span>
          <span className={styles.link}>{row.body}</span>
        </>
      ) : (
        <p className={styles.body}>{row.body}</p>
      )}
      {state ? <span className={styles.meta}>{state}</span> : null}
      <div className={styles.actions}>
        {openable(row) ? (
          <Button
            variant="secondary"
            onClick={() => void getPlatform().app.openUrl(row.body)}
            aria-label={`${t.exchange.actions.open}: ${hostOf(row.body)}`}
          >
            {t.exchange.actions.open}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onClick={() =>
            void getPlatform()
              .clipboard.writeText(row.body)
              .then(() => setCopied('yes'))
              .catch(() => setCopied('no'))
          }
        >
          {copied === 'yes'
            ? t.exchange.actions.copied
            : copied === 'no'
              ? t.exchange.actions.copyFailed
              : t.exchange.actions.copy}
        </Button>
        <IconButton
          label={t.exchange.actions.remove}
          onClick={() => void deleteWithUndo(() => itemRepo.remove(row.id))}
        >
          <Icon name="trash" />
        </IconButton>
      </div>
    </li>
  );
}
