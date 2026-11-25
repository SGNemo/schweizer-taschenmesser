/**
 * „Los“ in step mode (planner hub 2, package 5a; hand-off 05 „Los“, A11Y „Los“): the thing's title small (B4), **only
 * the next open step** large, B5 „Fertig · weiter“ (the one filled button; on the last open step B23 „Fertig“), B6
 * „Überspringen“, B7 „Pause“ (while paused the built „Weiter“). No ring, no clock, no list of the other steps.
 *
 * Every step tick is the planner's `markStep` – its own `act`, one undo entry, toast B26. B23 finishes the step and ticks
 * the thing in one `act` (`finishSteps`) and returns to the plan. Skipped steps and the pause live in this tab's session
 * storage, so a reload keeps the round where it was; the steps' own state is the source's. Keys: Enter is the focused
 * button's own activation; S and P only while focus is on one of the stage's buttons (WCAG 2.1.4); Esc is the page's.
 */
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PlannableEntry } from '@/core/modules/contributions';
import { t } from '@/strings';
import { Button } from '@/ui';
import { finishSteps, markStep } from '../actions';
import styles from '../routes/focus.module.css';

interface Kept {
  skipped: string[];
  paused: boolean;
}
const keyOf = (unitId: string) => `tm-plan-steps:${unitId}`;
function readKept(unitId: string): Kept {
  try {
    const raw = sessionStorage.getItem(keyOf(unitId));
    const v = raw ? (JSON.parse(raw) as Partial<Kept>) : {};
    return {
      skipped: Array.isArray(v.skipped) ? v.skipped.filter((s) => typeof s === 'string') : [],
      paused: v.paused === true,
    };
  } catch {
    return { skipped: [], paused: false };
  }
}
function writeKept(unitId: string, kept: Kept) {
  try {
    sessionStorage.setItem(keyOf(unitId), JSON.stringify(kept));
  } catch {
    // Storage blocked: the round still works, it only forgets its skips on a reload.
  }
}

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
  const [kept, setKeptState] = useState<Kept>(() => readKept(unitId));
  const [busy, setBusy] = useState(false);
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
    if (allDone) void navigate('/planner');
  }, [allDone, navigate]);

  // The step change, said politely (B24); the first step is the page's heading anyway.
  const [said, setSaid] = useState('');
  const shown = useRef(current?.id);
  useEffect(() => {
    if (!current || shown.current === current.id) return;
    shown.current = current.id;
    setSaid(t.planner.steps.announce(k, steps.length, current.title));
  }, [current, k, steps.length]);

  const actions = useRef<HTMLDivElement>(null);
  async function done() {
    if (!current || busy || kept.paused) return;
    setBusy(true);
    try {
      if (last) {
        await finishSteps(entry, current.id, titles);
        writeKept(unitId, { skipped: [], paused: false });
        void navigate('/planner');
        return;
      }
      await markStep(entry, current.id, true, titles);
    } finally {
      setBusy(false);
      actions.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }
  const skip = () =>
    current && !kept.paused && setKept({ ...kept, skipped: [...kept.skipped, current.id] });
  const pause = () => setKept({ ...kept, paused: !kept.paused });
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
  if (!current)
    return (
      // Only skipped steps are left (B10): walk them now, or keep them open for later.
      <section className={styles.page} aria-labelledby="step-eyebrow">
        {header}
        <p id="step-eyebrow" className={styles.eyebrow}>
          {title}
        </p>
        <h1 className={styles.title}>{t.planner.steps.skipped(open.length)}</h1>
        <div className={`${styles.actions} ${styles.stepActions}`}>
          <Button
            variant="primary"
            data-autofocus
            onClick={() => setKept({ ...kept, skipped: [] })}
          >
            {t.planner.steps.now}
          </Button>
          <Button variant="ghost" onClick={() => void navigate('/planner')}>
            {t.planner.steps.later}
          </Button>
        </div>
      </section>
    );

  return (
    <section className={styles.page} aria-labelledby="step-eyebrow">
      {header}
      <p id="step-eyebrow" className={styles.eyebrow}>
        {t.planner.steps.eyebrow(title, k, steps.length)}
      </p>
      <h1 key={current.id} className={`${styles.title} ${styles.stepTitle} ${styles.fadeIn}`}>
        {current.title}
      </h1>
      <div ref={actions} className={`${styles.actions} ${styles.stepActions}`} onKeyDown={onKeys}>
        <Button
          variant="primary"
          data-autofocus
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
      <p className={styles.keys}>{t.planner.steps.keys}</p>
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </section>
  );
}
