import type { Stored } from '@/core/db/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, DatedTimeline, EmptyState, type DatedRow } from '@/ui';
import { canRenew, deadlineRows } from '../logic';
import type { VaultDocument } from '../schema';
import { DeadlineKind } from './DeadlineKind';
import styles from './Deadlines.module.css';

type Doc = Stored<VaultDocument>;

/**
 * The "Fristen" view: every document with a date on one rail, what has run out above "Heute", what comes below
 * it. A title opens the document; "Verlängert" is the one action. Titles stay on this page: the overview's
 * widget and the calendar keep to counts.
 */
export function DeadlineTimeline({
  docs,
  day,
  current,
  onOpen,
  onRenew,
}: {
  docs: readonly Doc[];
  day: string;
  /** Id of the document shown in the panel beside the list. */
  current?: string;
  onOpen: (doc: Doc) => void;
  onRenew: (doc: Doc) => void;
}) {
  const { rows, older } = deadlineRows(docs, day);
  if (rows.length === 0)
    return (
      // Dated documents that all ran out long ago are not "no date": the title says what is true.
      <EmptyState
        title={older > 0 ? t.vault.timeline.noneAhead : t.vault.timeline.empty}
        testId="vault-timeline-empty"
      >
        <p>{older > 0 ? t.vault.timeline.older(older) : t.vault.timeline.emptyHint}</p>
      </EmptyState>
    );
  const dated: DatedRow[] = rows.map((r) => ({
    key: r.doc.id,
    when: formatDay(r.date, 'd. MMM yyyy'),
    past: r.date < day,
    title: (
      <button
        type="button"
        className={styles.timelineTitle}
        aria-current={current === r.doc.id ? 'true' : undefined}
        onClick={() => onOpen(r.doc)}
      >
        {r.doc.title}
      </button>
    ),
    kind: <DeadlineKind state={r.state} kind={r.kind} date={r.date} day={day} />,
    end: canRenew(r.doc, r.state, day) ? (
      <Button size="sm" aria-label={t.vault.renewAria(r.doc.title)} onClick={() => onRenew(r.doc)}>
        {t.vault.renew}
      </Button>
    ) : undefined,
  }));
  return (
    <div data-testid="vault-timeline">
      {/* The oldest first: what is hidden stands above the rail, where the past begins. */}
      {older > 0 ? <p className={styles.older}>{t.vault.timeline.older(older)}</p> : null}
      <DatedTimeline label={t.vault.timeline.label} rows={dated} marker={t.vault.timeline.today} />
    </div>
  );
}
