import type { Stored } from '@/core/db/types';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Badge, Button, DatedTimeline, EmptyState, type DatedRow } from '@/ui';
import { canRenew, deadlineRows, type DeadlineRow } from '../logic';
import type { VaultDocument } from '../schema';
import styles from '../routes/VaultPage.module.css';

type Doc = Stored<VaultDocument>;

/**
 * What a row's date is, in a word; the day itself stands at the start of the row. What is near or over carries the
 * word on a badge. The tone says "have a look" (warning, accent for a deadline this week), never "you failed": no red.
 */
function kindOf(r: DeadlineRow<Doc>) {
  const k = t.vault.timeline.kinds;
  if (r.state === 'expired') return <Badge tone="warning">{k.expired}</Badge>;
  if (r.state === 'missed') return k.missed;
  const label = r.kind === 'cancel' ? k.cancel : k.end;
  if (r.state === 'act-now') return <Badge tone="accent">{label}</Badge>;
  return r.state === 'soon' ? <Badge tone="warning">{label}</Badge> : label;
}

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
  const rows = deadlineRows(docs, day);
  if (rows.length === 0)
    return <EmptyState title={t.vault.timeline.empty} testId="vault-timeline-empty" />;
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
    kind: kindOf(r),
    end: canRenew(r.doc, r.state) ? (
      <Button size="sm" aria-label={t.vault.renewAria(r.doc.title)} onClick={() => onRenew(r.doc)}>
        {t.vault.renew}
      </Button>
    ) : undefined,
  }));
  return (
    <div data-testid="vault-timeline">
      <DatedTimeline label={t.vault.timeline.label} rows={dated} marker={t.vault.timeline.today} />
    </div>
  );
}
