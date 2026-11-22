import { useEffect, useState } from 'react';
import { dayName } from '@/core/plan/explain';
import type { PlanOp } from '@/core/plan/instructions';
import { formatDay } from '@/core/time/dates';
import { now, today } from '@/core/time/now';
import { kindsOf } from '@/quickCapture/ui/batch';
import { useCaptureTypes } from '@/quickCapture/ui/useCaptureTypes';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Chip, Chips, Dialog, TextArea } from '@/ui';
import { applyDaySetup } from '../actions';
import type { BoardDay } from '../board';
import {
  breakOps,
  clearSetupDraft,
  eventsFill,
  gainsTime,
  previewItems,
  previewTitles,
  readSetupDraft,
  SETUP_CHIPS,
  setupTasks,
  setupThings,
  writeSetupDraft,
  type SetupThing,
} from '../daySetup';
import { opLines } from '../say';
import { PlannerOffError, previewUser } from '../services';
import { dayEndLabel, dayEndOf } from '../settings';
import { noDayOf, PlanPreview, type PreviewData } from './PlanPreview';
import { compact } from './capacity';
import styles from '../routes/planner.module.css';

type Step = 1 | 2 | 3;

/** A chip's text: „keine Zeit“, „2 h“ … „ganzer Tag“ (figures through `core/i18n/format`). */
const chipLabel = (min: number) =>
  min === 0 ? t.planner.daySetup.noTime : min === 720 ? t.planner.day.wholeDay : compact(min);

/** The day ends the sheet offers (package 6): 23:00, midnight, none ('' clears the setting). */
const DAY_END_CHIPS = ['23:00', '00:00', ''] as const;

/**
 * „Tage einteilen“ (use case „Wochenende retten“, TARGET F1): one sheet in three steps – (1) „Was steht an?“,
 * one line per thing, (2) „Wie viel Zeit hast du?“, today and the next two days as rows of chips, (3) the
 * planner's preview of exactly that – and „Übernehmen“ writes it all as one undoable action. Time comes before
 * the distribution, so a Sunday given time takes things (W10). One primary button per step; opened only by the
 * person (welcome card, empty planner, planner ⋯), never by itself. Closing keeps the dump as a draft.
 */
export function DaySetup({
  days,
  titles,
  dayEnd = '',
  onClose,
}: {
  /** Today and the next two days of the board. */
  days: readonly BoardDay[];
  titles: Record<string, string>;
  /** The stored „Tagesende“ ('HH:mm', '' = none). */
  dayEnd?: string;
  onClose: () => void;
}) {
  const s = t.planner.daySetup;
  // The capture's targets on this device: the sheet reads a line exactly as a many-lines capture does (W23).
  // Until the module states are read every line would fall back to a ToDo: the preview waits for them.
  const { states, available, fitness, place, breaks } = useCaptureTypes();
  const [step, setStep] = useState<Step>(1);
  const [text, setText] = useState(readSetupDraft);
  // Set by the first keystroke: only typing renews the draft (a reopened sheet does not touch its age).
  const [edited, setEdited] = useState(false);
  // Chosen minutes per date; a day without a choice keeps what it has.
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<{ data: PreviewData; things: SetupThing[] }>();
  const [busy, setBusy] = useState(false);
  // „Tagesende festlegen“ (package 6): folded until tapped; a chip sets the one day end for every day on „Übernehmen“.
  const [dayEndOpen, setDayEndOpen] = useState(false);
  const [dayEndChoice, setDayEndChoice] = useState<string>();

  useEffect(() => {
    if (edited) writeSetupDraft(text);
  }, [text, edited]);

  const reshuffle = gainsTime(days, chosen);
  const changes = days
    .filter((d) => chosen[d.date] !== undefined && chosen[d.date] !== d.availableMin)
    .map((d) => ({ date: d.date, min: chosen[d.date]! }));
  const newDayEnd =
    dayEndChoice !== undefined && dayEndChoice !== dayEnd ? dayEndChoice : undefined;

  async function toPreview() {
    const things = setupThings(text, { available, fitness, place, breaks });
    const ops: PlanOp[] = [
      ...changes.map((c): PlanOp => ({ op: 'available', date: c.date, min: c.min })),
      // The last step is the same proposal as „Woche vorschlagen“ (package 6): the typed things and every thing
      // without a day – what „Übernehmen“ writes (`applyDaySetup` hands over the same). A day that gained time
      // hands over everything that is not „fest“ (W10).
      { op: 'replan', reshuffle } as const,
    ];
    setBusy(true);
    try {
      const breaks = breakOps(things, today());
      const out = await previewUser([...ops, ...breaks], previewItems(things, now()));
      const names = { ...previewTitles(things), ...out.titles, ...titles };
      const tasks = setupTasks(things).length;
      // What becomes what: when a line is neither a ToDo nor a break, the capture's own kinds line („ToDo 9 ·
      // Termin 1 · …“) instead of the count of things, never both. A break says itself below (never twice).
      const kinds = kindsOf(things.filter((th) => th.type !== 'break'));
      const lines = [
        ...(kinds.length > 1 || (kinds.length === 1 && !tasks)
          ? [t.quickCapture.multi.kinds(kinds)]
          : tasks
            ? [s.things(tasks)]
            : []),
        // A break says its own day and length, like its toast – never a sum.
        ...breaks.map((b) => t.planner.toast.asBreak(b.label, dayName(b.date), compact(b.min))),
        // The day lines only: „Vorschlag übernommen“ would say what the moves below already show.
        ...opLines(
          ops.filter((o) => o.op !== 'replan'),
          (key) => names[key] ?? key,
          today(),
        ),
        ...(newDayEnd === undefined
          ? []
          : [newDayEnd ? s.dayEndSet(dayEndLabel(newDayEnd)) : s.dayEndCleared]),
      ];
      // The same proposal as „Woche vorschlagen“ (package 6): its head, and what stays without a day.
      const noDay = noDayOf(out.result, (key) => names[key] ?? key).map((n) => ({
        ...n,
        tooLong: false,
      }));
      setPreview({
        data: {
          lines: [t.planner.preview.head, ...lines],
          diff: out.result.diff,
          ...(noDay.length ? { noDay } : {}),
        },
        things,
      });
      setStep(3);
    } catch (e) {
      if (!(e instanceof PlannerOffError)) throw e;
      useUiStore.getState().toast(t.planner.toast.off);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    // Nothing typed and no day changed: nothing to enter, no toast that says otherwise.
    // … and the proposal lays nothing (it now also takes what waited without a day: package 6).
    const proposes = preview.data.diff.added.length + preview.data.diff.moved.length > 0;
    if (
      preview.things.length === 0 &&
      changes.length === 0 &&
      !reshuffle &&
      newDayEnd === undefined &&
      !proposes
    ) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const ok = await applyDaySetup(
        changes,
        preview.things,
        days.map((d) => d.date),
        titles,
        reshuffle,
        newDayEnd,
        proposes,
      );
      if (ok) {
        setText('');
        clearSetupDraft();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (unitId: string) => {
    const key = unitId.slice(0, unitId.lastIndexOf('#'));
    return preview ? (previewTitles(preview.things)[key] ?? titles[key] ?? key) : key;
  };

  const footer =
    step === 1 ? (
      <Button variant="primary" onClick={() => setStep(2)} data-testid="day-setup-next">
        {s.next}
      </Button>
    ) : step === 2 ? (
      <>
        <Button variant="ghost" onClick={() => setStep(1)} disabled={busy}>
          {s.back}
        </Button>
        <Button variant="primary" onClick={() => void toPreview()} disabled={busy || !states}>
          {s.next}
        </Button>
      </>
    ) : undefined;

  return (
    <Dialog open onClose={onClose} title={s.title} footer={footer}>
      <div data-testid="day-setup">
        <p className={styles.capacity}>{s.stepOf(step)}</p>
        {step === 1 ? (
          <>
            <h3 className={styles.dayName}>{s.thingsTitle}</h3>
            <TextArea
              label={s.thingsLabel}
              hint={s.thingsHint}
              rows={6}
              value={text}
              onChange={(e) => {
                setEdited(true);
                setText(e.target.value);
              }}
              data-autofocus
            />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <h3 className={styles.dayName}>{s.timeTitle}</h3>
            <p className={styles.capacity}>{s.timeIntro}</p>
            {days.map((d) => {
              const value = chosen[d.date] ?? d.availableMin;
              const day = formatDay(d.date, 'EEEE');
              return (
                <div key={d.date} className={styles.setupDay} data-testid={`setup-${d.date}`}>
                  <span className={styles.setupDayName}>{formatDay(d.date, 'EEE, d. MMM')}</span>
                  <Chips label={s.timeOn(day)}>
                    {SETUP_CHIPS.map((min) => (
                      <Chip
                        key={min}
                        label={chipLabel(min)}
                        selected={value === min}
                        onClick={() => setChosen((c) => ({ ...c, [d.date]: min }))}
                      />
                    ))}
                  </Chips>
                  {(SETUP_CHIPS as readonly number[]).includes(value) ? null : (
                    <span className={styles.capacity}>{s.current(chipLabel(value))}</span>
                  )}
                  {eventsFill(d, value) ? (
                    <span className={styles.capacity}>{s.eventsFill}</span>
                  ) : null}
                </div>
              );
            })}
            <div className={styles.setupDay} data-testid="setup-day-end">
              <button
                type="button"
                className={styles.textLink}
                aria-expanded={dayEndOpen}
                onClick={() => setDayEndOpen((o) => !o)}
              >
                {s.dayEndLink}
              </button>
              {dayEndOpen ? (
                <>
                  <Chips label={s.dayEndLabel}>
                    {DAY_END_CHIPS.map((v) => (
                      <Chip
                        key={v || 'none'}
                        label={v ? dayEndLabel(v) : s.dayEndNone}
                        selected={(dayEndChoice ?? dayEnd) === v}
                        onClick={() => setDayEndChoice(v)}
                      />
                    ))}
                  </Chips>
                  <span className={styles.capacity}>
                    {(DAY_END_CHIPS as readonly string[]).includes(dayEndChoice ?? dayEnd) ||
                    !dayEndOf({ dayEnd })
                      ? s.dayEndHint
                      : `${s.current(dayEndLabel(dayEnd))} · ${s.dayEndHint}`}
                  </span>
                </>
              ) : null}
            </div>
          </>
        ) : null}
        {step === 3 && preview ? (
          <>
            <h3 className={styles.dayName}>{s.previewTitle}</h3>
            <PlanPreview
              data={preview.data}
              nameOf={nameOf}
              busy={busy}
              onApply={() => void apply()}
              onDiscard={() => setStep(2)}
              discardLabel={s.back}
            />
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
