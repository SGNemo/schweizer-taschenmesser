import { Fragment, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PlannableEntry } from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { dayName, partWord } from '@/core/plan/explain';
import { t } from '@/strings';
import { Checkbox, Icon, type IconName, ItemRow, type RowMenuItem, SensitiveValue } from '@/ui';
import { dueWas, type BoardRow, type WaitingRow } from '../board';
import { compact } from './capacity';
import {
  ActionLead,
  LinkChips,
  useActionMenu,
  useLinkMenu,
  useRowLinks,
  withLinks,
} from './RowLinks';
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
 * One planned thing – the same form for every source and every place (a day, „Frist vorbei“; planner hub R1,
 * K1b): a lead slot that is always filled (the tick where ticking is the source's own „Erledigt“, else the
 * source's main action as an outlined glyph – a route, the planner writes nothing – else the source's icon), the
 * title (it opens the thing in its module), a meta line in a fixed order, at most one line of link chips, the
 * duration and the ⋯ menu, which stays in sight and starts with the action's word.
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
  noDuration,
  was,
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
  /** A row of „Frist vorbei“: it takes no day time, so it shows none. */
  noDuration?: boolean;
  /** „Noch offen“: the day the row lies on, which has passed – said as „war Mo“, calm, never a tone. */
  was?: string;
}) {
  const navigate = useNavigate();
  // Ticked: the row fades while the source stores it, then leaves with the board's next reading.
  const [leaving, setLeaving] = useState(false);
  const entry = row.entry;
  const source = entry ? sourceOf(entry) : undefined;
  const action = onDone ? undefined : entry?.action;
  const links = useRowLinks(entry);
  const fullMenu = withLinks(menu, useActionMenu(action), useLinkMenu(links));
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

  const duration = row.approx ? t.planner.row.approx(compact(row.minutes)) : compact(row.minutes);
  const facts: ReactNode[] = [];
  // The source's icon stands once: in the meta beside its word, or in the lead slot when that has no control.
  const iconLead = !done && !action;
  if (source)
    facts.push(
      <span className={styles.source}>
        {iconLead ? null : <Icon name={source.icon} size={16} />}
        {source.word}
      </span>,
    );
  // A fixed block (S4, a training at 18:00): its time and „fest“ – it stands there, nothing moves it.
  if (row.fixed) {
    facts.push(<span>{`${row.fixed.from}–${row.fixed.to}`}</span>);
    facts.push(<span>{t.planner.row.fixed}</span>);
  } else if (row.pinned) facts.push(<span>{t.planner.row.fixed}</span>);
  if (was) facts.push(<span>{t.planner.open.was(dayName(was))}</span>);
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
      // A fixed block lies recessed with the day's appointments (CONCEPT-DESIGN §4); its tick stays.
      recessed={row.fixed ? true : undefined}
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
        ) : action ? (
          <ActionLead action={action} title={row.title} />
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
          {/* Phone: the duration closes the meta line, so the title has the row's width (the end slot is hidden). */}
          {noDuration ? null : (
            <span className={styles.metaDuration}>
              {facts.length > 0 ? <span aria-hidden="true">· </span> : null}
              {duration}
            </span>
          )}
          {whyOpen ? <span className={styles.reason}>{reason}</span> : null}
        </span>
      }
      below={links.length > 0 ? <LinkChips views={links} /> : undefined}
      end={noDuration ? undefined : <span className={styles.duration}>{duration}</span>}
      menu={fullMenu}
      menuLabel={t.planner.row.menu(row.title)}
      onSwipeRight={done}
      swipeRightLabel={t.planner.row.done}
      onSwipeLeft={row.fixed ? undefined : onLater}
      swipeLeftLabel={t.planner.row.later}
    />
  );
}

/**
 * A row of „Wartet auf freie Zeit“: the title, its reason behind „Warum hier?“, the minutes and ⋯ – plus the links
 * of the thing (K1b: chips and „Verknüpft“ in ⋯, which replaced the old hard-coded „Zur Notiz“ / „Zur Mail“).
 */
export function WaitRow({
  row,
  reason,
  why,
  menu,
}: {
  row: WaitingRow;
  reason: string;
  /** „Warum hier?“ is open for this row. */
  why: boolean;
  menu: RowMenuItem[];
}) {
  const links = useRowLinks(row.entry);
  const linkMenu = useLinkMenu(links);
  return (
    <ItemRow
      title={
        <span>
          {row.title}
          {row.of > 1 ? <Part k={row.k} of={row.of} /> : null}
        </span>
      }
      titleFull
      // The reason only behind „Warum hier?“, like on the board (U12). A row without a menu (no entry) keeps its
      // reason in sight.
      meta={why || !row.entry ? reason : undefined}
      below={links.length > 0 ? <LinkChips views={links} /> : undefined}
      end={<span className={styles.minutes}>{compact(row.minutes)}</span>}
      menu={withLinks(menu, [], linkMenu)}
      menuLabel={t.planner.row.menu(row.title)}
    />
  );
}
