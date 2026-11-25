/**
 * „Los“ in step mode (planner hub 2, package 5a; hand-off 05 „Los“, A11Y „Los“): the thing's title small (B4), **only
 * the next open step** large, B5 „Fertig · weiter“ (the one filled button; on the last open step B23 „Fertig“), B6
 * „Überspringen“, B7 „Pause“ (while paused the built „Weiter“). No ring, no clock, no list of the other steps.
 *
 * Every step tick is the planner's `markStep` – its own `act`, one undo entry, toast B26. B23 finishes the step and ticks
 * the thing in one `act` (`finishSteps`) and returns to the plan. Skipped steps and the pause live in this tab's session
 * storage, so a reload keeps the round where it was; an explicit „Los“ (`STEPS_FRESH`) starts it fresh. The steps' own
 * state is the source's. Focus lands on the filled button on arrival and after each step. Keys: Enter is the focused
 * button's own activation; S and P only while focus is on one of the stage's buttons (WCAG 2.1.4); Esc is the page's.
 *
 * Measured duration (package 8): each step's minutes run from when it was shown (or the step before was ticked or
 * skipped), a pause shifts that start; „Fertig · weiter“ / „Fertig“ records them under the step's title in its own act.
 */
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { PlannableEntry } from '@/core/modules/contributions';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button } from '@/ui';
import { now } from '@/core/time/now';
import { finishSteps, markStep } from '../actions';
import { titleKey } from '../measure';
import styles from '../routes/focus.module.css';

interface Kept {
  skipped: string[];
  paused: boolean;
  /** When the current step began (epoch ms; a pause shifts it): its measured minutes run from here. */
  since?: number;
  /** When the pause began. */
  pausedAt?: number;
}
const stamp = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const keyOf = (unitId: string) => `tm-plan-steps:${unitId}`;
function readKept(unitId: string): Kept {
  try {
    const raw = sessionStorage.getItem(keyOf(unitId));
    const v = raw ? (JSON.parse(raw) as Partial<Kept>) : {};
    return {
      skipped: Array.isArray(v.skipped) ? v.skipped.filter((s) => typeof s === 'string') : [],
      paused: v.paused === true,
      ...(stamp(v.since) !== undefined ? { since: stamp(v.since)! } : {}),
      ...(stamp(v.pausedAt) !== undefined ? { pausedAt: stamp(v.pausedAt)! } : {}),
    };
  } catch {
    return { skipped: [], paused: false };
  }
}
function writeKept(unitId: string, kept: Kept | undefined) {
  try {
    if (kept) sessionStorage.setItem(keyOf(unitId), JSON.stringify(kept));
    else sessionStorage.removeItem(keyOf(unitId));
  } catch {
    // Storage blocked: the round still works, it only forgets its skips on a reload.
  }
}
const fresh = (): Kept => ({ skipped: [], paused: false, since: now() });

export function StepStage({
  entry,
  unitId,
  title,
  titles,
  header,
}: {
  entry: PlannableEntry;
  unitId: string;
  title: string;
  titles: Record<string, string>;
  /** The page's corner („Verlassen“, as built). */
  header: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isFresh = (location.state as { stepsFresh?: boolean } | null)?.stepsFresh === true;
  const [kept, setKeptState] = useState<Kept>(() => {
    if (!isFresh) {
      const read = readKept(unitId);
      return read.since === undefined ? { ...read, since: now() } : read;
    }
    writeKept(unitId, undefined);
    return fresh();
  });
  // The fresh mark is read once: dropped from the history entry, so a reload keeps the round.
  useEffect(() => {
    if (isFresh)
      void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [isFresh, navigate, location.pathname, location.search]);
  const [busy, setBusy] = useState(false);
  // The step a tick is running for: a held Enter never ticks the same step twice before the next one shows. `busy`
  // covers the tick in flight; this covers the moment after it, until new step data arrives (any re-read frees it –
  // safe, a step already done writes nothing), or a failed tick.
  const ticked = useRef<string | undefined>(undefined);
  useEffect(() => {
    ticked.current = undefined;
  }, [entry.steps]);
  const setKept = (next: Kept) => {
    setKeptState(next);
    writeKept(unitId, next);
  };
  const steps = entry.steps ?? [];
  const open = steps.filter((s) => !s.done);
  const skipped = new Set(kept.skipped);
  const current = open.find((s) => !skipped.has(s.id));
  const last = open.length === 1 && current !== undefined;
  const k = current ? steps.findIndex((s) => s.id === current.id) + 1 : 0;

  // Everything done (also through the panel or another device): back to the plan.
  const allDone = steps.length > 0 && open.length === 0;
  useEffect(() => {
    if (!allDone) return;
    writeKept(unitId, undefined);
    void navigate('/planner');
  }, [allDone, navigate, unitId]);

  // The step change, said politely (B24); the first step is the page's heading anyway.
  const [said, setSaid] = useState('');
  const shown = useRef(current?.id);
  useEffect(() => {
    if (!current || shown.current === current.id) return;
    shown.current = current.id;
    setSaid(t.planner.steps.announce(k, steps.length, current.title));
  }, [current, k, steps.length]);

  const actions = useRef<HTMLDivElement>(null);
  const focusFirst = () => actions.current?.querySelector<HTMLButtonElement>('button')?.focus();
  // On arrival (after the shell has moved focus to the page) and on the B10 screen: the filled button.
  const screen = current ? 'step' : 'skipped';
  useEffect(() => {
    actions.current?.querySelector<HTMLButtonElement>('button')?.focus();
    // Back from B10, the step is said again even if it is the one said last.
    if (screen === 'skipped') shown.current = undefined;
  }, [screen]);
  async function done() {
    if (!current || busy || kept.paused || ticked.current === current.id) return;
    ticked.current = current.id;
    setBusy(true);
    const at = now();
    const ran = {
      key: titleKey(current.title),
      minutes: kept.since === undefined ? 0 : (at - kept.since) / 60_000,
    };
    try {
      if (last) {
        if (!(await finishSteps(entry, current.id, titles, ran))) ticked.current = undefined;
        else {
          writeKept(unitId, undefined);
          void navigate('/planner');
        }
        return;
      }
      if (await markStep(entry, current.id, true, titles, ran)) setKept({ ...kept, since: at });
      else ticked.current = undefined;
    } catch (err) {
      // Said without claiming nothing changed (a step written before a later failure stays); trying again is safe –
      // a step already in that state writes nothing.
      ticked.current = undefined;
      console.error('[planner] step tick failed', err);
      useUiStore.getState().toast(t.planner.steps.failed);
    } finally {
      setBusy(false);
      focusFirst();
    }
  }
  const skip = () =>
    current &&
    !kept.paused &&
    setKept({ ...kept, skipped: [...kept.skipped, current.id], since: now() });
  const pause = () => {
    if (!current) return; // B10 has no pause
    const at = now();
    if (kept.paused) {
      // The pause is not the step's time: its start moves on by the paused stretch.
      const { pausedAt, ...rest } = kept;
      const since = kept.since === undefined ? at : kept.since + (at - (pausedAt ?? at));
      setKept({ ...rest, paused: false, since });
    } else setKept({ ...kept, paused: true, pausedAt: at });
    // Said too: focus stays on the same button, only its state changes.
    setSaid(kept.paused ? t.planner.steps.resumed : t.planner.steps.paused);
  };
  // S and P only on the stage's buttons: never in a text field, never globally.
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      skip();
    } else if (key === 'p') {
      e.preventDefault();
      pause();
    }
  };

  if (allDone) return null;
  // One live region for both screens (B24), at the same place in each, so it stays mounted; on B10 it says the
  // question (focus lands on „Jetzt“, the heading is not read).
  const status = (
    <p className="sr-only" role="status" aria-live="polite">
      {current ? said : t.planner.steps.skipped(open.length)}
    </p>
  );
  if (!current)
    return (
      // Only skipped steps are left (B10): walk them now, or keep them open for later.
      <section className={styles.page} aria-labelledby="step-eyebrow">
        {header}
        {status}
        <p id="step-eyebrow" className={styles.eyebrow}>
          {title}
        </p>
        <h1 className={styles.title}>{t.planner.steps.skipped(open.length)}</h1>
        <div ref={actions} className={`${styles.actions} ${styles.stepActions}`}>
          <Button variant="primary" onClick={() => setKept({ ...kept, skipped: [], since: now() })}>
            {t.planner.steps.now}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              // „Später“ keeps them open – not skipped: the next „Los“ walks them again.
              writeKept(unitId, undefined);
              void navigate('/planner');
            }}
          >
            {t.planner.steps.later}
          </Button>
        </div>
      </section>
    );

  return (
    <section className={styles.page} aria-labelledby="step-eyebrow">
      {header}
      {status}
      <p id="step-eyebrow" className={styles.eyebrow}>
        {t.planner.steps.eyebrow(title, k, steps.length)}
      </p>
      <h1 key={current.id} className={`${styles.title} ${styles.stepTitle} ${styles.fadeIn}`}>
        {current.title}
      </h1>
      <div ref={actions} className={`${styles.actions} ${styles.stepActions}`} onKeyDown={onKeys}>
        <Button
          variant="primary"
          aria-busy={busy}
          // Paused: still focusable (P resumes from here), it only does nothing.
          aria-disabled={busy || kept.paused}
          onClick={() => void done()}
        >
          {last ? t.planner.steps.finish : t.planner.steps.next}
        </Button>
        <Button variant="ghost" aria-disabled={kept.paused} onClick={skip}>
          {t.planner.steps.skip}
        </Button>
        <Button variant="ghost" onClick={pause}>
          {kept.paused ? t.focus.mode.resume : t.planner.steps.pause}
        </Button>
      </div>
      {kept.paused ? <p className={styles.paused}>{t.planner.steps.paused}</p> : null}
      <p className={styles.keys}>{t.planner.steps.keys}</p>
    </section>
  );
}
