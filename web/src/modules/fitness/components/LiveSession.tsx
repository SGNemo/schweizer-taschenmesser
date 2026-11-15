import { useRef, useState } from 'react';
import { useNow } from '@/core/focus/useNow';
import { formatMinutes } from '@/core/i18n/format';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Checkbox, Dialog, Form, Icon, IconButton, TextField } from '@/ui';
import { patternOf } from '../catalog';
import { setDetail } from '../data';
import {
  finishSet,
  liveSession,
  MAX_EXERCISES,
  MAX_SETS,
  nextSetDraft,
  restLeft,
  type LiveState,
} from '../live';
import { lastOf } from '../logic';
import { sessionRepo } from '../repo';
import type { Session, WorkSet } from '../schema';
import { CatalogPicker } from './CatalogPicker';
import { ExercisePicto } from './ExercisePicto';
import styles from '../fitness.module.css';

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const num = (s: string): number | undefined => {
  const v = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(v) && v >= 0 ? v : undefined;
};

/**
 * „Einheit starten“ (deep package 2): one exercise at a time with last time's values, „Satz fertig“
 * and a quiet rest timer. The session is written after every set (nothing before the first), and the
 * state is kept on this device, so closing the dialog or reloading never loses a set; „Einheit beenden“
 * stores the duration. Closing only hides it – the training list offers „Weiter“.
 */
export function LiveSession({
  state,
  sessions,
  restSec,
  own,
  onChange,
  onClose,
  onEnd,
}: {
  state: LiveState | undefined;
  /** Earlier sessions (last time's values). */
  sessions: readonly (Session & { id?: string })[];
  restSec: number;
  own: readonly string[];
  /** Every change; the page keeps it on this device (reload, app switch). */
  onChange: (s: LiveState) => void;
  /** Hides the dialog; the session keeps running. */
  onClose: () => void;
  onEnd: () => void;
}) {
  const l = t.fitness.live;
  return (
    <Dialog open={!!state} onClose={onClose} title={state?.title ?? l.title} size="roomy">
      {state ? (
        <Running
          state={state}
          sessions={sessions}
          restSec={restSec}
          own={own}
          onChange={onChange}
          onEnd={onEnd}
        />
      ) : null}
    </Dialog>
  );
}

function Running({
  state,
  sessions,
  restSec,
  own,
  onChange,
  onEnd,
}: {
  state: LiveState;
  sessions: readonly (Session & { id?: string })[];
  restSec: number;
  own: readonly string[];
  onChange: (s: LiveState) => void;
  onEnd: () => void;
}) {
  const l = t.fitness.live;
  const [picking, setPicking] = useState(false);
  const busy = useRef(false);
  const ticking = useNow(1000, !!state.restUntil);
  // The ticking clock is stale right after a set: never show more rest than is left now.
  const left = restLeft(state, Math.max(ticking, now()));
  const ex = state.exercises[state.index];
  const count = state.exercises.length;
  const partnerName = ex?.superset
    ? state.exercises[state.index + 1]?.name
    : state.index > 0 && state.exercises[state.index - 1]?.superset
      ? state.exercises[state.index - 1]?.name
      : undefined;

  // Last time's values come from earlier sessions, never from the one running now.
  const earlier = sessions.filter((s) => !state.sessionId || s.id !== state.sessionId);

  async function write(next: LiveState): Promise<LiveState> {
    const data: Session = liveSession(next, now());
    if (next.sessionId && (await sessionRepo.get(next.sessionId))) {
      // A plan that is started counts from now on, today.
      await sessionRepo.update(next.sessionId, { ...data, planned: undefined });
      return next;
    }
    // Never written yet, or deleted meanwhile (list, undo, another device): the sets are written anew.
    const created = await sessionRepo.create(data);
    return { ...next, sessionId: created.id };
  }

  async function done(set: WorkSet) {
    if (busy.current) return;
    busy.current = true;
    try {
      onChange(await write(finishSet(state, set, { now: now(), restSec })));
    } catch {
      useUiStore.getState().toast(l.failed);
    } finally {
      busy.current = false;
    }
  }

  async function end() {
    if (busy.current) return;
    busy.current = true;
    try {
      if (state.exercises.some((e) => e.log?.length)) {
        const data = liveSession(state, now());
        await write(state);
        useUiStore
          .getState()
          .toast(l.finished(formatMinutes(data.durationMin ?? 1, { compact: true })));
      } else useUiStore.getState().toast(l.nothing);
    } catch {
      useUiStore.getState().toast(l.failed);
    } finally {
      busy.current = false;
      // Ended either way: the sets written so far stay.
      onEnd();
    }
  }

  function add(name: string) {
    setPicking(false);
    onChange({ ...state, exercises: [...state.exercises, { name }], index: count });
  }

  const { restUntil: _r, ...noRest } = state;
  return (
    <div className={styles.live} data-testid="fitness-live">
      {ex ? (
        <>
          <div className={styles.liveNav}>
            <IconButton
              label={l.prev}
              disabled={state.index === 0}
              onClick={() => onChange({ ...state, index: state.index - 1 })}
            >
              <Icon name="chevronLeft" />
            </IconButton>
            <p className={styles.hint} aria-live="polite">
              {l.of(state.index + 1, count)}
            </p>
            <IconButton
              label={l.next}
              disabled={state.index >= count - 1}
              onClick={() => onChange({ ...state, index: state.index + 1 })}
            >
              <Icon name="chevronRight" />
            </IconButton>
          </div>
          <h3 className={styles.liveName}>
            <ExercisePicto pattern={patternOf(ex.name)} />
            {ex.name}
          </h3>
          {partnerName ? (
            <p className={styles.hint}>{t.fitness.form.supersetWith(partnerName)}</p>
          ) : null}
          {state.restUntil ? (
            <div className={styles.rest} data-testid="fitness-rest">
              {left > 0 ? (
                <>
                  <p className={styles.restTime}>
                    {l.rest} · {clock(left)}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={l.restMoreLabel}
                    onClick={() => onChange({ ...state, restUntil: state.restUntil! + 30_000 })}
                  >
                    {l.restMore}
                  </Button>
                </>
              ) : (
                <p className={styles.restTime} role="status">
                  {l.restOver}
                </p>
              )}
              <Button size="sm" variant="ghost" onClick={() => onChange(noRest)}>
                {l.restSkip}
              </Button>
            </div>
          ) : null}
          <p className={styles.groupLabel}>{l.sets}</p>
          {ex.log?.length ? (
            <ol className={styles.liveSets}>
              {ex.log.map((s, i) => (
                <li key={i}>{setDetail(s)}</li>
              ))}
            </ol>
          ) : (
            <p className={styles.hint}>{l.none}</p>
          )}
          <SetInput
            key={`${state.index}-${ex.log?.length ?? 0}`}
            draft={nextSetDraft(ex, lastOf(earlier, ex.name))}
            full={(ex.log?.length ?? 0) >= MAX_SETS}
            onDone={(set) => void done(set)}
          />
        </>
      ) : (
        <p className={styles.hint}>{l.pickFirst}</p>
      )}
      <div className={styles.chips}>
        {count < MAX_EXERCISES ? (
          <Button variant={ex ? 'secondary' : 'primary'} size="sm" onClick={() => setPicking(true)}>
            <Icon name="plus" size={16} />
            {l.addExercise}
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" onClick={() => void end()}>
          {l.finish}
        </Button>
      </div>
      <CatalogPicker open={picking} own={own} onPick={add} onClose={() => setPicking(false)} />
    </div>
  );
}

/** Reps, kg, warm-up and a note for the next set, offered with the last values. */
function SetInput({
  draft,
  full,
  onDone,
}: {
  draft: WorkSet;
  /** The exercise holds the most sets a row can keep. */
  full: boolean;
  onDone: (set: WorkSet) => void;
}) {
  const f = t.fitness.form;
  const [reps, setReps] = useState(draft.reps === undefined ? '' : String(draft.reps));
  const [weight, setWeight] = useState(draft.weightKg === undefined ? '' : String(draft.weightKg));
  const [warmup, setWarmup] = useState(false);
  const [note, setNote] = useState('');
  return (
    <Form
      onSubmit={() => {
        const r = num(reps);
        const w = num(weight);
        onDone({
          ...(r && r >= 1 ? { reps: Math.min(500, Math.round(r)) } : {}),
          ...(w !== undefined ? { weightKg: Math.min(1000, Math.round(w * 10) / 10) } : {}),
          ...(warmup ? { warmup: true as const } : {}),
          ...(note.trim() ? { note: note.trim().slice(0, 200) } : {}),
        });
      }}
    >
      <div className={styles.split}>
        <TextField
          label={f.reps}
          type="number"
          inputMode="numeric"
          min={1}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          data-autofocus
        />
        <TextField
          label={f.weight}
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>
      <Checkbox label={f.warmup} checked={warmup} onChange={(e) => setWarmup(e.target.checked)} />
      <TextField
        label={f.setNote}
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button type="submit" variant="primary" disabled={full}>
        {t.fitness.live.done}
      </Button>
    </Form>
  );
}
