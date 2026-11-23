import { useEffect, useMemo, useState } from 'react';
import { formatMinutes } from '@/core/i18n/format';
import { dayName } from '@/core/plan/explain';
import { formatDay } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, Segmented, TextArea } from '@/ui';
import { applyPaste, pasteKnown } from '../actions';
import { matchPaste, readPastedPlan, type Known, type PasteLine, type Place } from '../pastePlan';
import styles from './PasteDialog.module.css';

const placeKey = (p: Place) => (p.kind === 'day' ? p.date : p.kind === 'week' ? '~week' : '~later');
const dayLabel = (date: string) => `${dayName(date)} ${formatDay(date, 'd.')}`;
const placeLabel = (p: Place) =>
  p.kind === 'day'
    ? dayLabel(p.date)
    : p.kind === 'week'
      ? t.planner.paste.week
      : t.planner.paste.later;

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
    line.past ? p.wasPast : undefined,
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
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const [missingLater, setMissingLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const day = today();

  useEffect(() => {
    let live = true;
    void pasteKnown().then((k) => live && setKnown(k));
    return () => {
      live = false;
    };
  }, []);

  const plan = useMemo(() => readPastedPlan(text, day), [text, day]);
  const preview = useMemo(
    () => (known ? matchPaste(plan, known, day, past) : undefined),
    [plan, known, day, past],
  );
  const chosen = preview?.lines.filter((l) => !off.has(l.id)) ?? [];
  const toLater = missingLater ? (preview?.missing.filter((k) => k.canLater) ?? []) : [];
  const writes = chosen.filter((l) => l.change !== 'same').length + toLater.length;

  const groups = useMemo(() => {
    const out = new Map<string, { place: Place; lines: PasteLine[] }>();
    for (const line of preview?.lines ?? []) {
      const key = placeKey(line.to);
      if (!out.has(key)) out.set(key, { place: line.to, lines: [] });
      out.get(key)!.lines.push(line);
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
  }, [preview]);

  const apply = async () => {
    if (!preview || writes === 0) return;
    setBusy(true);
    const ok = await applyPaste(chosen, toLater, titles);
    setBusy(false);
    if (ok) onClose();
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
        {plan.skipped > 0 ? <p className={styles.note}>{p.skipped(plan.skipped)}</p> : null}
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
            <legend>{placeLabel(g.place)}</legend>
            <ul className={styles.list}>
              {g.lines.map((line) => (
                <li key={line.id}>
                  <Checkbox
                    label={line.title}
                    description={detailOf(line)}
                    tone="neutral"
                    checked={!off.has(line.id)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setOff((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(line.id);
                        else next.add(line.id);
                        return next;
                      });
                    }}
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
            {preview.missing.some((k) => k.canLater) ? (
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
