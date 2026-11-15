import { Fragment, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PlannableEntry } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { dayName, partWord } from '@/core/plan/explain';
import { t } from '@/strings';
import { Checkbox, Icon, type IconName, ItemRow, type RowMenuItem, SensitiveValue } from '@/ui';
import { dueWas, type BoardRow } from '../board';
import { compact } from './capacity';
import styles from '../routes/planner.module.css';

/** „Teil 1/2“ for the eye, „Teil 1 von 2“ for the screen reader. */
export function Part({ k, of }: { k: number; of: number }) {
  return (
    <>
      <span className={styles.part} aria-hidden="true">
        {` · ${t.planner.row.part(k + 1, of)}`}
      </span>
      <span className="sr-only">{` ${t.planner.row.partAria(k + 1, of)}`}</span>
    </>
  );
}

/** The source of a thing in a word and an icon („ToDo“, „Rechnung“ …); an unknown kind is named by its module. */
export function sourceOf(entry: Pick<PlannableEntry, 'kind' | 'moduleId'>): {
  word: string;
  icon: IconName;
} {
  const words: Record<string, string> = t.planner.src;
  const manifest = getManifest(entry.moduleId);
  return {
    word: words[entry.kind] ?? manifest?.name ?? entry.moduleId,
    icon: (manifest?.icon as IconName | undefined) ?? 'checklist',
  };
}

/** A detail line that names money („Mahnung · 92,40 € bis 20.11.“) follows „Werte ausblenden“. */
const MONEY = /\d\s?(€|\$|£|CHF)|(€|\$|£|CHF)\s?\d/;

/**
 * One planned thing of a day – the same form for every source (planner hub R1): a lead slot that is always filled
 * (the tick where the source takes one, else the source's icon), the title (it opens the thing in its module), a
 * meta line in a fixed order, the duration and the ⋯ menu, which stays in sight.
 */
export function ThingRow({
  row,
  next,
  reason,
  whyOpen,
  dueClock,
  menu,
  onDone,
  onLater,
}: {
  row: BoardRow;
  /** The first row of „Zuerst“: its title is strong. */
  next?: boolean;
  /** „Warum hier?“ in words; shown only while `whyOpen`. */
  reason: string;
  whyOpen: boolean;
  /** Now (epoch ms, read once a minute): „Frist So 18:00“ turns into „Frist war So 18:00“ once the hour has passed. */
  dueClock: number;
  menu: RowMenuItem[];
  /** The source takes a tick (ToDo, routine): one tap; undefined for an invoice or a cancellation. */
  onDone?: () => Promise<boolean>;
  onLater?: () => void;
}) {
  const navigate = useNavigate();
  // Ticked: the row fades while the source stores it, then leaves with the board's next reading.
  const [leaving, setLeaving] = useState(false);
  const entry = row.entry;
  const source = entry ? sourceOf(entry) : undefined;
  const done = onDone
    ? () => {
        if (leaving) return;
        setLeaving(true);
        // Nothing happened (the source said no): the row stays as it was.
        void onDone().then((ok) => {
          if (!ok) setLeaving(false);
        });
      }
    : undefined;

  const facts: ReactNode[] = [];
  if (source)
    facts.push(
      <span className={styles.source}>
        <Icon name={source.icon} size={16} />
        {source.word}
      </span>,
    );
  if (row.pinned) facts.push(<span>{t.planner.row.fixed}</span>);
  if (entry?.detail)
    facts.push(
      MONEY.test(entry.detail) ? (
        <SensitiveValue compact>{entry.detail}</SensitiveValue>
      ) : (
        <span>{entry.detail}</span>
      ),
    );
  // The part as plain text, only when set (package 4b; no colour carries it).
  if (row.item?.part) facts.push(<span>{partWord(row.item.part)}</span>);
  if (row.hardDue) {
    const when = row.hardDueTime
      ? `${dayName(row.hardDue)} ${row.hardDueTime}`
      : dayName(row.hardDue);
    // Late is said in words, in the tone of every other fact (never red, never a warning colour).
    facts.push(
      <span>{dueWas(row, dueClock) ? t.planner.row.dueWas(when) : t.planner.row.due(when)}</span>,
    );
  }

  return (
    <ItemRow
      controls="always"
      weight={next ? 'next' : undefined}
      className={leaving ? styles.leaving : undefined}
      lead={
        done ? (
          <span className={styles.lead}>
            <Checkbox
              tone="neutral"
              label={t.planner.row.doneName(row.title)}
              labelHidden
              data-row-tick
              checked={leaving}
              onChange={done}
            />
          </span>
        ) : (
          <span className={styles.lead} aria-hidden="true">
            <Icon name={source?.icon ?? 'checklist'} size={20} />
          </span>
        )
      }
      title={
        <span
          className={next ? styles.thingTitle : `${styles.thingTitle} ${styles.thingWeight}`}
          title={row.title}
        >
          {row.title}
          {row.of > 1 ? <Part k={row.k} of={row.of} /> : null}
        </span>
      }
      onOpen={entry ? () => void navigate(entry.to) : undefined}
      meta={
        <span className={styles.meta}>
          {facts.map((fact, i) => (
            <Fragment key={i}>
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              {fact}
            </Fragment>
          ))}
          {whyOpen ? <span className={styles.reason}>{reason}</span> : null}
        </span>
      }
      end={
        <span className={styles.duration}>
          {row.approx ? t.planner.row.approx(compact(row.minutes)) : compact(row.minutes)}
        </span>
      }
      menu={menu}
      menuLabel={t.planner.row.menu(row.title)}
      onSwipeRight={done}
      swipeRightLabel={t.planner.row.done}
      onSwipeLeft={onLater}
      swipeLeftLabel={t.planner.row.later}
    />
  );
}
