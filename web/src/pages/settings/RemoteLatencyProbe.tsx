import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getPlatform } from '@/core/platform';
import { GOAL_MS, ourPart, resultLine, summarise, type Summary } from '@/core/remote/latencyStats';
import { tDev } from '@/strings.dev';
import { useUiStore } from '@/stores/ui';
import { Button } from '@/ui';
import settings from './settings.module.css';
import styles from './RemoteLatencyProbe.module.css';

/**
 * Dev-Preview only (mounted by `DeveloperSection`): what package 3 of the remote control wants
 * measured on a real phone before the touchpad page is built – the cost of one `invoke` per
 * pointer event, and the way to the PC.
 *
 * Nothing acts on the PC. The call per event is `send` for a session number that is never open:
 * the shell goes the whole way a real send goes (command, worker thread, session lookup) and
 * answers `closed` right before it would write. Should that call ever *not* be refused, the
 * probe stops at once.
 *
 * Nothing is stored or logged; the numbers live in this component until it unmounts.
 */

/** Session numbers count up from 1; this one is never reached. */
const NO_SESSION = Number.MAX_SAFE_INTEGER;
const OPENS = 10;
const BETWEEN_OPENS_MS = 300;
/** Samples kept per row; a minute of 120 Hz is far below. */
const KEEP = 20_000;

interface Shown {
  input?: Summary;
  invoke?: Summary;
  eventsPerSecond?: number;
  overlapPercent?: number;
}

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

export function RemoteLatencyProbe() {
  const toast = useUiStore((s) => s.toast);
  const remote = getPlatform().remote;
  const samples = useRef({
    input: [] as number[],
    invoke: [] as number[],
    events: 0,
    overlaps: 0,
    inFlight: 0,
    first: 0,
    last: 0,
    aborted: false,
  });
  const [shown, setShown] = useState<Shown>({});
  const [open, setOpen] = useState<Summary | undefined>();
  const [failed, setFailed] = useState(0);
  const [progress, setProgress] = useState<number | undefined>();
  const [aborted, setAborted] = useState(false);

  // only the phone app has the client; everywhere else the developer page stays as it is
  if (!remote.supported) return null;

  function refresh() {
    const s = samples.current;
    const seconds = (s.last - s.first) / 1000;
    setShown({
      input: summarise(s.input),
      invoke: summarise(s.invoke),
      eventsPerSecond: seconds > 0.5 ? Math.round(s.events / seconds) : undefined,
      overlapPercent: s.events > 0 ? Math.round((s.overlaps / s.events) * 100) : undefined,
    });
  }

  function reset() {
    samples.current = {
      input: [],
      invoke: [],
      events: 0,
      overlaps: 0,
      inFlight: 0,
      first: 0,
      last: 0,
      aborted: false,
    };
    setShown({});
    setOpen(undefined);
    setFailed(0);
    setAborted(false);
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = samples.current;
    if (s.aborted || s.input.length >= KEEP) return;
    const now = performance.now();
    if (s.events === 0) s.first = now;
    s.last = now;
    s.events += 1;
    s.input.push(now - e.timeStamp);
    if (s.inFlight > 0) s.overlaps += 1;
    s.inFlight += 1;
    remote
      .send(NO_SESSION, ['mute'])
      .then(
        () => {
          // not refused: stop, nothing may ever be sent from here
          s.aborted = true;
          setAborted(true);
        },
        () => s.invoke.push(performance.now() - now),
      )
      .finally(() => {
        s.inFlight -= 1;
      });
  }

  async function measureOpens() {
    const times: number[] = [];
    let misses = 0;
    for (let i = 0; i < OPENS; i += 1) {
      setProgress(i);
      const start = performance.now();
      try {
        const opened = await remote.open('media', () => {});
        times.push(performance.now() - start);
        await remote.close(opened.session).catch(() => {});
      } catch {
        misses += 1;
      }
      await wait(BETWEEN_OPENS_MS);
    }
    setProgress(undefined);
    setOpen(summarise(times));
    setFailed(misses);
  }

  const line = (x?: Summary) =>
    x ? tDev.latency.summary(x.n, x.p50, x.p95, x.max) : tDev.latency.none;
  const our = ourPart(shown.invoke, open);

  async function copy() {
    await navigator.clipboard.writeText(resultLine({ ...shown, open, failedOpens: failed }));
    toast(tDev.latency.copied);
  }

  return (
    <>
      <h3>{tDev.latency.title}</h3>
      <p className={settings.muted}>{tDev.latency.intro}</p>
      {aborted && <p role="alert">{tDev.latency.aborted}</p>}
      <div
        className={styles.pad}
        data-testid="latency-pad"
        onPointerMove={onMove}
        onPointerUp={refresh}
        onPointerCancel={refresh}
      >
        {tDev.latency.pad}
      </div>
      <p className={settings.muted}>{tDev.latency.padHint}</p>
      <div className={settings.row}>
        <Button
          variant="secondary"
          disabled={progress !== undefined}
          onClick={() => void measureOpens()}
        >
          {progress === undefined ? tDev.latency.open : tDev.latency.openBusy(progress + 1, OPENS)}
        </Button>
        <Button variant="ghost" onClick={reset}>
          {tDev.latency.reset}
        </Button>
      </div>
      <p className={settings.muted}>{tDev.latency.openHint}</p>
      {failed > 0 && <p className={settings.muted}>{tDev.latency.openFailed(failed)}</p>}
      <dl className={styles.rows} data-testid="latency-result">
        <dt>{tDev.latency.rows.input}</dt>
        <dd>{line(shown.input)}</dd>
        <dt>{tDev.latency.rows.invoke}</dt>
        <dd>{line(shown.invoke)}</dd>
        <dt>{tDev.latency.rows.rate}</dt>
        <dd>{shown.eventsPerSecond ?? tDev.latency.none}</dd>
        <dt>{tDev.latency.rows.overlap}</dt>
        <dd>
          {shown.overlapPercent === undefined ? tDev.latency.none : `${shown.overlapPercent} %`}
        </dd>
        <dt>{tDev.latency.rows.open}</dt>
        <dd>{line(open)}</dd>
        <dt>{tDev.latency.rows.our}</dt>
        <dd>{our === undefined ? tDev.latency.none : tDev.latency.ourValue(our, GOAL_MS)}</dd>
      </dl>
      <p className={settings.muted}>{tDev.latency.ourHint}</p>
      <div className={settings.row}>
        <Button variant="secondary" disabled={!shown.invoke && !open} onClick={() => void copy()}>
          {tDev.latency.copy}
        </Button>
      </div>
    </>
  );
}
