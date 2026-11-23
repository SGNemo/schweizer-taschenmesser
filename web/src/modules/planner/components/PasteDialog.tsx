import { useEffect, useMemo, useState } from 'react';
import { formatMinutes } from '@/core/i18n/format';
import { dayName } from '@/core/plan/explain';
import { formatDay } from '@/core/time/dates';
import { addDaysStr } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, Segmented, TextArea } from '@/ui';
import { applyPaste, pasteKnown } from '../actions';
import { matchPaste, readPastedPlan, type Known, type PasteLine, type Place } from '../pastePlan';
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

/** A „fest“ thing that would leave its day: off until he ticks it (a chat does not know the lock). */
const offByDefault = (line: PasteLine) =>
  line.known?.locked === true && line.change === 'move' && line.to.kind !== 'day';

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
    line.known?.locked ? p.fixed : undefined,
    line.minutes ? p.minutes(formatMinutes(line.minutes, { compact: true })) : undefined,
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
  titles,
  onClose,
}: {
  /** Text pasted into the planner's field: the preview shows at once. */
  initial: string;
  titles: Record<string, string>;
  onClose: () => void;
}) {
  const p = t.planner.paste;
  const [text, setText] = useState(initial);
  const [known, setKnown] = useState<Known[]>();
  const [past, setPast] = useState<'today' | 'none'>('none');
  // The lines whose box he flipped against its default (keyed by thing, so editing the text keeps them).
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const [missingLater, setMissingLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const day = today();

  useEffect(() => {
    let live = true;
    void pasteKnown()
      .catch(() => [])
      .then((k) => live && setKnown(k));
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
  // Offered only when every missing thing can go there (the box then says exactly what it does).
  const laterOk = !!preview?.missing.length && preview.missing.every((k) => k.canLater);
  const toLater = missingLater && laterOk ? preview.missing : [];
  const writes = chosen.filter((l) => l.change !== 'same').length + toLater.length;

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
    try {
      if (await applyPaste(chosen, toLater, titles)) onClose();
    } finally {
      setBusy(false);
    }
  };

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
          onChange={(e) => setText(e.target.value)}
          data-autofocus={initial ? undefined : true}
        />
        {text.trim() && plan.things.length === 0 ? (
          <p className={styles.note} role="status">
            {p.empty}
          </p>
        ) : null}
        {text.trim() && !known ? (
          <p className={styles.note} role="status">
            {p.reading}
          </p>
        ) : null}
        {plan.skipped > 0 && plan.things.length > 0 ? (
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
        {groups.map((g) => (
          <fieldset key={placeKey(g.place)} className={styles.group}>
            <legend>{placeLabel(g.place, day)}</legend>
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
                  {k.title}
                  {k.place.kind === 'day' ? ` · ${dayLabel(k.place.date)}` : ''}
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
        {preview && plan.things.length > 0 && writes === 0 ? (
          <p className={styles.note} role="status">
            {p.nothing}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
