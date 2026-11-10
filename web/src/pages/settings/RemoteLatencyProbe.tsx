import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getPlatform } from '@/core/platform';
import { tDev } from '@/strings.dev';
import { useUiStore } from '@/stores/ui';
import { Button } from '@/ui';
import {
  fits,
  GOAL_MS,
  invokeBudget,
  resultLine,
  spread,
  summarise,
  tripFloor,
  type Summary,
} from './remoteLatencyStats';
import settings from './settings.module.css';
import styles from './RemoteLatencyProbe.module.css';

/**
 * Dev-Preview only (mounted by `DeveloperSection`): what package 3 of the remote control wants
 * measured on a real phone before the touchpad page is built – the cost of one `invoke` per
 * pointer event, and the way to the PC.
 *
 * Nothing acts on the PC. The call per event is `send` for a session number that is never open:
 * the shell goes the way a real send goes (command, worker thread, session lookup) and answers
 * `closed` right before it would seal and write. Should that call ever get any other answer –
 * success, or another error, which would mean the shell got further – the
 * probe stops for good (until the app restarts). The action it carries is the mildest of the
 * fixed list, a mute toggle: calls already on their way then could still toggle it.
 *
 * Nothing is stored or logged, and no coordinate is read; the numbers live in this component
 * until it unmounts.
 */

/** Session numbers count up from 1; this one is never reached. */
const NO_SESSION = Number.MAX_SAFE_INTEGER;
/**
 * Opens per run; the first is the warm-up (it reads keys and wakes the Wi-Fi) and is not
 * counted. Few on purpose: the PC allows 20 first messages per address and minute, and the
 * phone's sync shares that budget – and only the fastest open is used.
 */
export const OPENS = 6;
const BETWEEN_OPENS_MS = 300;
export const PAUSE_MS = 60_000;
/** Samples kept per row; a minute at 120 Hz is far below. */
const KEEP = 20_000;
/** Calls on their way at once; an event beyond that is counted as an overlap and makes no call. */
const IN_FLIGHT_MAX = 8;

/** The short code the bridge puts into an error's message (`core/platform/tauri/remote.ts`). */
function codeOf(e: unknown): string {
  const raw = e instanceof Error ? e.message : e;
  return typeof raw === 'string' && /^[a-z-]{1,24}$/.test(raw) ? raw : 'other';
}

/**
 * Set when a probe call was not refused, and never cleared: until the app restarts, no probe
 * call is made again (clearing the measurement does not bring it back).
 */
let stopped = false;
/** When the next run of opens may start (`performance.now()`); kept across mounts. */
let nextRunAt = 0;

/** Tests only: in the app nothing clears the latch. */
export function resetProbeForTests() {
  if (import.meta.env.MODE !== 'test') return;
  stopped = false;
  nextRunAt = 0;
}

interface Samples {
  input: number[];
  invoke: number[];
  events: number;
  overlaps: number;
  inFlight: number;
  /** Time a finger was down, summed over the strokes; `downAt` = the running stroke. */
  strokeMs: number;
  downAt: number | undefined;
}

const empty = (): Samples => ({
  input: [],
  invoke: [],
  events: 0,
  overlaps: 0,
  inFlight: 0,
  strokeMs: 0,
  downAt: undefined,
});

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
  const samples = useRef<Samples>(empty());
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      // leaving the page ends a running series: a real session must not be replaced by a probe
      gone.current = true;
    };
  }, []);
  const [shown, setShown] = useState<Shown>({});
  const [open, setOpen] = useState<Summary | undefined>();
  const [failed, setFailed] = useState<Record<string, number>>({});
  const [leftOpen, setLeftOpen] = useState(0);
  const [progress, setProgress] = useState<number | undefined>();
  const [aborted, setAborted] = useState(stopped);
  const [pausing, setPausing] = useState(() => performance.now() < nextRunAt);
  useEffect(() => {
    if (!pausing) return;
    const timer = setTimeout(() => setPausing(false), Math.max(0, nextRunAt - performance.now()));
    return () => clearTimeout(timer);
  }, [pausing]);

  // only the phone app has the client; everywhere else the developer page stays as it is
  if (!remote.supported) return null;

  function refresh() {
    if (gone.current) return;
    const s = samples.current;
    const seconds = s.strokeMs / 1000;
    setShown({
      input: summarise(s.input),
      invoke: summarise(s.invoke),
      eventsPerSecond: seconds > 0.5 ? Math.round(s.events / seconds) : undefined,
      overlapPercent: s.events > 0 ? Math.round((s.overlaps / s.events) * 100) : undefined,
    });
  }

  function reset() {
    samples.current = empty();
    setShown({});
    setOpen(undefined);
    setFailed({});
    setLeftOpen(0);
  }

  function onDown() {
    samples.current.downAt ??= performance.now();
  }

  function onUp() {
    const s = samples.current;
    if (s.downAt !== undefined) s.strokeMs += performance.now() - s.downAt;
    s.downAt = undefined;
    refresh();
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    // `samples` is taken once: a call that settles after "clear" lands in the old, dropped set
    const s = samples.current;
    if (stopped || s.downAt === undefined || s.input.length >= KEEP) return;
    const now = performance.now();
    s.events += 1;
    s.input.push(now - e.timeStamp);
    if (s.inFlight > 0) s.overlaps += 1;
    if (s.inFlight >= IN_FLIGHT_MAX) return;
    s.inFlight += 1;
    const stop = () => {
      // stop for good: nothing may ever be sent from here
      stopped = true;
      if (!gone.current) setAborted(true);
    };
    remote
      .send(NO_SESSION, ['mute'])
      .then(stop, (e: unknown) => {
        // only "no such session" is the refusal before any write; any other answer means the
        // shell got further than it may
        if (codeOf(e) === 'closed') s.invoke.push(performance.now() - now);
        else stop();
      })
      .finally(() => {
        s.inFlight -= 1;
        // the last calls of a stroke settle after the finger is up
        if (s.inFlight === 0 && s.downAt === undefined && s === samples.current) refresh();
      });
  }

  async function measureOpens() {
    const times: number[] = [];
    const misses: Record<string, number> = {};
    let unclosed = 0;
    nextRunAt = performance.now() + PAUSE_MS;
    for (let i = 0; i < OPENS && !gone.current; i += 1) {
      setProgress(i);
      const start = performance.now();
      try {
        const opened = await remote.open('media', () => {});
        // the first open is the warm-up
        if (i > 0) times.push(performance.now() - start);
        await remote.close(opened.session).catch(() => {
          unclosed += 1;
        });
      } catch (e) {
        const code = codeOf(e);
        misses[code] = (misses[code] ?? 0) + 1;
      }
      await wait(BETWEEN_OPENS_MS);
    }
    // the minute counts from the last open (set at the start too, so a run that was left blocks)
    nextRunAt = performance.now() + PAUSE_MS;
    if (gone.current) return;
    setProgress(undefined);
    setPausing(true);
    setOpen(summarise(times));
    setFailed(misses);
    setLeftOpen(unclosed);
  }

  const t = tDev.latency;
  const line = (x?: Summary) => (x ? t.summary(x.n, x.p50, x.p95, x.max) : t.none);
  const ms = (x?: number) => (x === undefined ? t.none : t.ms(x));
  const budget = invokeBudget(open);
  const verdict = fits(shown.invoke, open);
  const failedTotal = Object.values(failed).reduce((a, b) => a + b, 0);
  const running = progress !== undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(resultLine({ ...shown, open, failed }));
      toast(t.copied);
    } catch {
      toast(t.copyFailed);
    }
  }

  return (
    <>
      <h3>{t.title}</h3>
      <p className={settings.muted}>{t.intro}</p>
      {aborted && <p role="alert">{t.aborted}</p>}
      <div
        className={styles.pad}
        data-testid="latency-pad"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {t.pad}
      </div>
      <p className={settings.muted}>{t.padHint}</p>
      <div className={settings.row}>
        <Button
          variant="secondary"
          disabled={running || pausing}
          onClick={() => void measureOpens()}
        >
          {running ? t.openBusy(progress + 1, OPENS) : t.open}
        </Button>
        <Button variant="ghost" disabled={running} onClick={reset}>
          {t.reset}
        </Button>
      </div>
      <p className={settings.muted}>{t.openHint}</p>
      {failedTotal > 0 && <p className={settings.muted}>{t.openFailed(failedTotal, OPENS)}</p>}
      {leftOpen > 0 && <p className={settings.muted}>{t.leftOpen}</p>}
      <dl className={styles.rows} data-testid="latency-result">
        <dt>{t.rows.invoke}</dt>
        <dd>{line(shown.invoke)}</dd>
        <dt>{t.rows.budget}</dt>
        <dd>
          {budget === undefined ? t.none : t.ms(budget)}
          {verdict !== undefined && ` · ${verdict ? t.fits : t.fitsNot}`}
        </dd>
        <dt>{t.rows.input}</dt>
        <dd>{line(shown.input)}</dd>
        <dt>{t.rows.rate}</dt>
        <dd>{shown.eventsPerSecond ?? t.none}</dd>
        <dt>{t.rows.overlap}</dt>
        <dd>{shown.overlapPercent === undefined ? t.none : `${shown.overlapPercent} %`}</dd>
        <dt>{t.rows.open}</dt>
        <dd>{line(open)}</dd>
        <dt>{t.rows.trip}</dt>
        <dd>{ms(tripFloor(open))}</dd>
        <dt>{t.rows.spread}</dt>
        <dd>{ms(spread(open))}</dd>
      </dl>
      <p className={settings.muted}>{t.readHint(GOAL_MS)}</p>
      <div className={settings.row}>
        <Button variant="secondary" disabled={!shown.invoke && !open} onClick={() => void copy()}>
          {t.copy}
        </Button>
      </div>
    </>
  );
}
