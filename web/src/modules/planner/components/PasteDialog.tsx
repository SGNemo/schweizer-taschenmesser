import { useEffect, useMemo, useState } from 'react';
import { formatMinutes } from '@/core/i18n/format';
import { dayName } from '@/core/plan/explain';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, Segmented, TextArea } from '@/ui';
import { applyPaste, pasteKnown } from '../actions';
import {
  goalDays,
  matchPaste,
  readPastedPlan,
  type Known,
  type PasteLine,
  type Place,
} from '../pastePlan';
import styles from './PasteDialog.module.css';

/** Days first in date order, then this week, then later: the plan reads from now on, not from what is put off. */
const placeKey = (p: Place) =>
  p.kind === 'day' ? `0:${p.date}` : p.kind === 'week' ? '1:week' : '2:later';
const dayLabel = (date: string) => `${dayName(date)} ${formatDay(date, 'd.')}`;
/** A group's name: „Heute · Sa 28.“ and „Morgen · So 29.“ as the planner says them, other days by name and date. */
const placeLabel = (p: Place, day: string) =>
  p.kind === 'day'
    ? p.date === day
      ? t.planner.paste.today(dayLabel(p.date))
      : p.date === addDaysStr(day, 1)
        ? t.planner.paste.tomorrow(dayLabel(p.date))
        : dayLabel(p.date)
    : p.kind === 'week'
      ? t.planner.paste.week
      : t.planner.paste.later;

/** A „fest“ thing that would move: off until he ticks it (a chat does not know the lock). */
const offByDefault = (line: PasteLine) => line.known?.locked === true && line.change === 'move';

/** The quiet second line of a preview line: new, stays, or where it was – plus the effort read from the text. */
function detailOf(line: PasteLine): string {
  const p = t.planner.paste;
  const from = line.known?.place;
  const what =
    line.change === 'new'
      ? p.isNew
      : line.change === 'same'
        ? p.stays
        : from?.kind === 'day'
          ? p.from(dayLabel(from.date))
          : from?.kind === 'later'
            ? p.fromLater
            : p.fromWeek;
  return [
    what,
    line.known?.fixed
      ? p.fixedTime
      : line.known?.locked
        ? offByDefault(line)
          ? p.fixedMove
          : p.fixed
        : undefined,
    // The effort is read for a new thing only (a known one keeps its own).
    line.change === 'new' && line.minutes
      ? p.minutes(formatMinutes(line.minutes, { compact: true }))
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * „Plan einfügen“ (use case „Tag kippt“, TARGET §3): a finished plan from outside – text with day headings or the
 * ToDos' JSON – read on this device, shown as a preview grouped by target with a box per line, „Übernehmen“ as one
 * action with one undo. The same title is the same thing: it moves instead of being doubled. Closing changes nothing.
 */
export function PasteDialog({
  initial,
  goals,
  titles,
  onClose,
}: {
  /** Text pasted into the planner's field: the preview shows at once. */
  initial: string;
  /** The goals stored on the days in view (date → goal), so the preview knows what a goal line would change. */
  goals: Readonly<Record<string, string>>;
  titles: Record<string, string>;
  onClose: () => void;
}) {
  const p = t.planner.paste;
  const [text, setText] = useState(initial);
  // What the plan holds; `null`: it could not be read – then nothing is matched against nothing (no doubles).
  const [known, setKnown] = useState<Known[] | null>();
  const [past, setPast] = useState<'today' | 'none'>('none');
  // The lines whose box he flipped against its default (keyed by thing, so editing the text keeps them).
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const [missingLater, setMissingLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // The paste's goal line (P2): on by default, for the days the paste names (else today).
  const [goalOn, setGoalOn] = useState(true);
  const day = today();

  useEffect(() => {
    let live = true;
    void pasteKnown().then(
      (k) => live && setKnown(k),
      () => live && setKnown(null),
    );
    return () => {
      live = false;
    };
  }, []);

  const plan = useMemo(() => readPastedPlan(text, day), [text, day]);
  const preview = useMemo(
    () => (known ? matchPaste(plan, known, day, past) : undefined),
    [plan, known, day, past],
  );
  const ticked = (line: PasteLine) => offByDefault(line) === flipped.has(line.id);
  const chosen = preview?.lines.filter(ticked) ?? [];
  // „fest“ things stay out of the box; it is offered when every other missing thing can go to later.
  const movable = preview?.missing.filter((k) => !k.locked) ?? [];
  const laterOk = movable.length > 0 && movable.every((k) => k.canLater);
  const missingKey = preview?.missing.map((k) => k.key).join('|') ?? '';
  // The box was ticked for the things he saw: a different set unticks it.
  const [boxFor, setBoxFor] = useState(missingKey);
  if (boxFor !== missingKey) {
    setBoxFor(missingKey);
    setMissingLater(false);
  }
  const toLater = missingLater && laterOk ? movable : [];
  const goalDates = goalDays(plan, day, past);
  // The goal line counts as a change only on days whose goal differs (the same paste twice changes nothing).
  const goalNew = goalDates.some((d) => (goals[d] ?? '') !== plan.goal);
  const goal =
    plan.goal && goalOn && preview && plan.things.length > 0
      ? { text: plan.goal, dates: goalDates }
      : undefined;
  const writes =
    chosen.filter((l) => l.change !== 'same').length + toLater.length + (goal && goalNew ? 1 : 0);

  const groups = useMemo(() => {
    const out = new Map<string, { place: Place; lines: PasteLine[] }>();
    for (const line of preview?.lines ?? []) {
      const key = placeKey(line.to);
      if (!out.has(key)) out.set(key, { place: line.to, lines: [] });
      out.get(key)!.lines.push(line);
    }
    return [...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, g]) => g);
  }, [preview]);

  const apply = async () => {
    if (!preview || writes === 0) return;
    setBusy(true);
    setFailed(false);
    try {
      // Read the plan again right before writing: what a sync or another tab changed meanwhile counts – a thing that
      // became „fest“ is left out unless he ticked it, a missing thing goes to later only if it still is one he saw.
      const fresh = await pasteKnown();
      const now = matchPaste(plan, fresh, day, past);
      const ids = new Set(chosen.map((l) => l.id));
      const lines = now.lines.filter((l) => ids.has(l.id) && ticked(l));
      const seen = new Set(toLater.map((k) => k.key));
      const later = now.missing.filter((k) => seen.has(k.key) && !k.locked && k.canLater);
      // Written – or nothing was left to write (a sync or a goal outside the view had it already): done either way.
      // Nothing left to write (a sync or another tab did it): say so, then close.
      if (!(await applyPaste(lines, later, titles, goal)))
        useUiStore.getState().toast(t.planner.paste.nothing);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  // One live region, always there; its text changes (a region mounted with its text is often not read out).
  const status =
    known === null
      ? p.readFailed
      : failed
        ? p.failed
        : text.trim() && known === undefined
          ? p.reading
          : text.trim() && plan.things.length === 0
            ? p.empty
            : preview && plan.things.length > 0 && writes === 0
              ? preview.lines.some((l) => l.change !== 'same') || movable.length > 0
                ? p.nothingTicked
                : p.nothing
              : '';

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>
        {t.actions.cancel}
      </Button>
      <Button
        variant="primary"
        disabled={!preview || writes === 0 || busy}
        onClick={() => void apply()}
      >
        {p.apply}
      </Button>
    </>
  );

  return (
    <Dialog open onClose={onClose} title={p.title} footer={footer} askAfterTyping>
      <div className={styles.body} data-testid="paste-plan">
        <TextArea
          label={p.label}
          hint={p.hint}
          value={text}
          rows={initial ? 4 : 8}
          onChange={(e) => {
            setText(e.target.value);
            setFailed(false);
          }}
          data-autofocus={initial ? undefined : true}
        />
        {/* Mounted always (a live region inserted with its text is often not read out); empty, it takes no room. */}
        <p className={status ? styles.note : 'sr-only'} role="status">
          {status}
        </p>
        {plan.format === 'text' && plan.skipped > 0 && plan.things.length > 0 ? (
          <p className={styles.note}>{p.skipped}</p>
        ) : null}
        {preview?.hasPast ? (
          <Segmented
            label={p.past}
            value={past}
            options={[
              { value: 'none', label: p.pastNone },
              { value: 'today', label: p.pastToday },
            ]}
            onChange={setPast}
          />
        ) : null}
        {plan.goal && preview && plan.things.length > 0 ? (
          <Checkbox
            label={t.planner.goal.paste(plan.goal, goalDates.map(dayLabel).join(', '))}
            checked={goalOn}
            onChange={(e) => setGoalOn(e.target.checked)}
          />
        ) : null}
        {groups.map((g) => (
          <fieldset key={placeKey(g.place)} className={styles.group}>
            <legend>{placeLabel(g.place, day)}</legend>
            {g.place.kind === 'later' ? <p className={styles.note}>{p.laterHint}</p> : null}
            <ul className={styles.list}>
              {g.lines.map((line) => (
                <li key={line.id}>
                  <Checkbox
                    label={line.title}
                    description={detailOf(line)}
                    tone="neutral"
                    checked={ticked(line)}
                    onChange={() =>
                      setFlipped((prev) => {
                        const next = new Set(prev);
                        if (next.has(line.id)) next.delete(line.id);
                        else next.add(line.id);
                        return next;
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
        {preview && preview.missing.length > 0 ? (
          <fieldset className={styles.group} data-testid="paste-missing">
            <legend>{p.missing}</legend>
            <p className={styles.note}>{p.missingHint}</p>
            <ul className={styles.plain}>
              {preview.missing.map((k) => (
                <li key={k.key}>
                  {[
                    k.title,
                    k.place.kind === 'day' ? dayLabel(k.place.date) : '',
                    k.locked ? p.fixed : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </li>
              ))}
            </ul>
            {laterOk ? (
              <Checkbox
                label={p.missingLater}
                checked={missingLater}
                onChange={(e) => setMissingLater(e.target.checked)}
              />
            ) : null}
          </fieldset>
        ) : null}
      </div>
    </Dialog>
  );
}
