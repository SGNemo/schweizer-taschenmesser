import { dayName } from '@/core/plan/explain';
import type { MoveReason, PlanDiff } from '@/core/plan/types';
import { t } from '@/strings';
import { Button, GroupedList, ItemList, ItemRow, type GroupedListGroup } from '@/ui';
import styles from '../routes/planner.module.css';

export interface PreviewData {
  /** What the sentence asks for, one calm line each („Do ist frei.“). */
  lines: string[];
  /** Where the reading came from when it was not the rules („Vom lokalen Modell gelesen – bitte prüfen.“). */
  note?: string;
  diff: PlanDiff;
}

/** The cause of a move in the preview: who took the room, the part it follows, or the day's time. */
function cause(
  m: { reason: MoveReason; by?: string[] },
  nameOf: (unitId: string) => string,
): string | undefined {
  const r = t.planner.reasons;
  switch (m.reason) {
    case 'bumped':
      return r.bumped(m.by?.length ? m.by.map(nameOf).join(', ') : r.others);
    case 'after-part':
      return r['after-part'](m.by?.[0] ? nameOf(m.by[0]) : r.others);
    case 'capacity':
      return r.capacity;
    case 'pulled':
      return t.planner.preview.earlier;
    case 'carried':
      return t.planner.preview.later;
    case 'done':
      return undefined;
  }
}

/**
 * The preview before any write (CONCEPT §6c): what the sentence asks for, then the diff – moved (with
 * the cause), new, waits – and „Übernehmen“ / „Verwerfen“. Nothing is stored until „Übernehmen“; the
 * toast after it carries the undo. Opened only by the user's own sentence or ⋯ action.
 */
export function PlanPreview({
  data,
  nameOf,
  busy,
  onApply,
  onDiscard,
}: {
  data: PreviewData;
  nameOf: (unitId: string) => string;
  busy?: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const p = t.planner.preview;
  const moved = data.diff.moved;
  const added = data.diff.added;
  const waits = data.diff.removed.filter((r) => r.reason !== 'done');
  const groups: GroupedListGroup[] = [
    ...(moved.length
      ? [
          {
            id: 'moved',
            label: p.moved,
            count: moved.length,
            children: (
              <ItemList>
                {moved.map((m) => (
                  <ItemRow
                    key={m.id}
                    title={nameOf(m.id)}
                    titleFull
                    meta={[p.move(dayName(m.from), dayName(m.to)), cause(m, nameOf)]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                ))}
              </ItemList>
            ),
          },
        ]
      : []),
    ...(added.length
      ? [
          {
            id: 'added',
            label: p.added,
            count: added.length,
            children: (
              <ItemList>
                {added.map((a) => (
                  <ItemRow key={a.id} title={nameOf(a.id)} titleFull meta={dayName(a.to)} />
                ))}
              </ItemList>
            ),
          },
        ]
      : []),
    ...(waits.length
      ? [
          {
            id: 'waits',
            label: p.waits,
            count: waits.length,
            children: (
              <ItemList>
                {waits.map((w) => (
                  <ItemRow
                    key={w.id}
                    title={nameOf(w.id)}
                    titleFull
                    meta={[p.from(dayName(w.from)), cause(w, nameOf)].filter(Boolean).join(' · ')}
                  />
                ))}
              </ItemList>
            ),
          },
        ]
      : []),
  ];
  return (
    <section className={styles.preview} aria-label={p.label} data-testid="plan-preview">
      {data.note ? <p className={styles.previewNote}>{data.note}</p> : null}
      {data.lines.map((line) => (
        <p key={line} className={styles.previewLine}>
          {line}
        </p>
      ))}
      {groups.length > 0 ? (
        <GroupedList listId="planner-preview" groups={groups} />
      ) : (
        <p className={styles.capacity}>{p.nothing}</p>
      )}
      <div className={styles.previewActions}>
        <Button variant="primary" onClick={onApply} disabled={busy} data-autofocus>
          {p.apply}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={busy}>
          {p.discard}
        </Button>
      </div>
    </section>
  );
}
