import { useEffect, useState } from 'react';
import { getLang } from '@/core/i18n/lang';
import type { PlanOp } from '@/core/plan/instructions';
import { formatDay } from '@/core/time/dates';
import { now, today } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Chip, Chips, Dialog, TextArea } from '@/ui';
import { applyDaySetup } from '../actions';
import type { BoardDay } from '../board';
import {
  clearSetupDraft,
  gainsTime,
  previewItems,
  previewTitles,
  readSetupDraft,
  SETUP_CHIPS,
  setupThings,
  writeSetupDraft,
  type SetupThing,
} from '../daySetup';
import { opLines } from '../say';
import { PlannerOffError, previewUser } from '../services';
import { PlanPreview, type PreviewData } from './PlanPreview';
import { compact } from './capacity';
import styles from '../routes/planner.module.css';

type Step = 1 | 2 | 3;

/** A chip's text: „keine Zeit“, „2 h“ … „ganzer Tag“ (figures through `core/i18n/format`). */
const chipLabel = (min: number) =>
  min === 0 ? t.planner.daySetup.noTime : min === 720 ? t.planner.day.wholeDay : compact(min);

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
  onClose,
}: {
  /** Today and the next two days of the board. */
  days: readonly BoardDay[];
  titles: Record<string, string>;
  onClose: () => void;
}) {
  const s = t.planner.daySetup;
  const [step, setStep] = useState<Step>(1);
  const [text, setText] = useState(readSetupDraft);
  // Set by the first keystroke: only typing renews the draft (a reopened sheet does not touch its age).
  const [edited, setEdited] = useState(false);
  // Chosen minutes per date; a day without a choice keeps what it has.
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<{ data: PreviewData; things: SetupThing[] }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (edited) writeSetupDraft(text);
  }, [text, edited]);

  const reshuffle = gainsTime(days, chosen);
  const changes = days
    .filter((d) => chosen[d.date] !== undefined && chosen[d.date] !== d.availableMin)
    .map((d) => ({ date: d.date, min: chosen[d.date]! }));

  async function toPreview() {
    const things = setupThings(text, today(), getLang() === 'de');
    const ops: PlanOp[] = [
      ...changes.map((c): PlanOp => ({ op: 'available', date: c.date, min: c.min })),
      ...(reshuffle ? [{ op: 'replan', reshuffle: true } as const] : []),
    ];
    setBusy(true);
    try {
      const out = await previewUser(ops, previewItems(things, now()));
      const names = { ...previewTitles(things), ...out.titles, ...titles };
      const lines = [
        ...(things.length ? [s.things(things.length)] : []),
        // The day lines only: „Neu verteilt“ would say what the moves below already show.
        ...opLines(
          ops.filter((o) => o.op !== 'replan'),
          (key) => names[key] ?? key,
          today(),
        ),
      ];
      setPreview({ data: { lines, diff: out.result.diff }, things });
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
    if (preview.things.length === 0 && changes.length === 0 && !reshuffle) {
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
        <Button variant="primary" onClick={() => void toPreview()} disabled={busy}>
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
                </div>
              );
            })}
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
