/**
 * The preview line K1 under the planner's field (package 3, hand-off 03): „Wird: Rechnung · Stadtwerke · 80,00 € · Frist
 * Fr 4. Dez.“ and the quiet button K3 „Als Aufgabe eintragen“. Shown only for a sure reading (`fieldKind`); Enter stores
 * what it says. The visual line follows every keystroke; the polite live region speaks once the line has stood still for
 * 400 ms, and only when the kind changed – never per keystroke.
 */
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/core/money';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Icon, SensitiveValue, type IconName } from '@/ui';
import type { FieldKind, FieldKindName } from '../fieldKind';
import styles from '../routes/planner.module.css';

/** The kind's module glyph (as its manifest names it). */
const GLYPH: Record<FieldKindName, IconName> = {
  invoice: 'receipt',
  list: 'cart',
  event: 'calendar',
  note: 'note',
  bookmark: 'bookmark',
  steps: 'checklist',
};

/** At most three names on the line, then K6 „+ n“. */
const NAMES_SHOWN = 3;
const SPOKEN_AFTER_MS = 400;

const day = (date: string) => formatDay(date, 'EEE d. MMM');

/** The read parts after the kind word, as plain text (the amount on its own, for `SensitiveValue`). */
function partsOf(r: FieldKind): { before: string[]; amount?: string; after: string[] } {
  switch (r.kind) {
    case 'invoice':
      return {
        before: [r.fields.title],
        amount: formatMoney(r.fields.amountMinor ?? 0),
        after: r.deadline ? [t.planner.kinds.deadline(day(r.deadline))] : [],
      };
    case 'list': {
      const shown = r.names.slice(0, NAMES_SHOWN).join(', ');
      const more = r.names.length - NAMES_SHOWN;
      return { before: [more > 0 ? `${shown} ${t.planner.kinds.more(more)}` : shown], after: [] };
    }
    case 'event':
      return { before: [r.fields.title, day(r.fields.date!), r.fields.time!], after: [] };
    case 'note':
      return { before: [r.title], after: [] };
    case 'bookmark':
      return { before: [r.host], after: [] };
    case 'steps':
      return { before: [r.title, t.planner.kinds.stepCount(r.steps.length)], after: [] };
  }
}

/** The line as one sentence for the live region (the amount left out: a screen reader reads aloud). */
export const spokenLine = (r: FieldKind): string => {
  const p = partsOf(r);
  return [
    t.planner.kinds.becomes,
    [t.planner.kinds.name[r.kind], ...p.before, ...p.after].join(' · '),
  ].join(' ');
};

export function KindPreview({
  reading,
  onAsTask,
  id,
}: {
  reading: FieldKind;
  /** K3: the line becomes a plain ToDo. */
  onAsTask: () => void;
  id?: string;
}) {
  const p = partsOf(reading);
  const sep = <span className={styles.kindSep}> · </span>;
  return (
    <div className={styles.kindLine} id={id} data-testid="planner-kind">
      <span className={styles.kindText}>
        <span className={styles.kindGlyph}>
          <Icon name={GLYPH[reading.kind]} size={16} />
        </span>
        <span className={styles.kindLead}>{t.planner.kinds.becomes}</span>{' '}
        <strong className={styles.kindName}>{t.planner.kinds.name[reading.kind]}</strong>
        {p.before.map((part, i) => (
          <span key={`b${i}`}>
            {sep}
            {part}
          </span>
        ))}
        {p.amount !== undefined ? (
          <span>
            {sep}
            <SensitiveValue compact>{p.amount}</SensitiveValue>
          </span>
        ) : null}
        {p.after.map((part, i) => (
          <span key={`a${i}`}>
            {sep}
            {part}
          </span>
        ))}
      </span>
      <Button
        variant="ghost"
        className={styles.kindAsTask}
        onClick={onAsTask}
        aria-keyshortcuts="Alt+Enter"
      >
        {t.planner.kinds.asTask}
      </Button>
    </div>
  );
}

/**
 * The polite announcement of the line: once per change of kind (or its disappearance), after the typing paused. Always
 * mounted, so a screen reader hears the change.
 */
export function KindAnnouncer({ reading }: { reading: FieldKind | undefined }) {
  const [said, setSaid] = useState('');
  const last = useRef<FieldKindName | undefined>(undefined);
  const kind = reading?.kind;
  const sentence = reading ? spokenLine(reading) : '';
  // Every change of the line (each keystroke that changes it) starts the pause anew.
  const stamp = reading ? JSON.stringify(reading) : '';
  useEffect(() => {
    if (kind === last.current) return;
    const timer = setTimeout(() => {
      last.current = kind;
      setSaid(sentence);
    }, SPOKEN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [kind, sentence, stamp]);
  return (
    <p className="sr-only" role="status" aria-live="polite" data-testid="planner-kind-said">
      {said}
    </p>
  );
}
