import { Fragment, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PlannableEntry } from '@/core/modules/contributions';
import type { PileGroup } from '@/core/modules/pile';
import type { PileArea } from '@/core/modules/types';
import { PlanPanelHost } from '@/core/modules/PlanPanelHost';
import { getManifest } from '@/core/modules/registry';
import { dayName, partWord } from '@/core/plan/explain';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Checkbox, Icon, type IconName, ItemRow, type RowMenuItem, SensitiveValue } from '@/ui';
import { dueWas, type BoardRow, type WaitingRow } from '../board';
import { compact } from './capacity';
import {
  ActionLead,
  LinkChips,
  PanelLinks,
  type RowLinkViews,
  useActionMenu,
  useLinkMenu,
  useRowLinks,
  withLinks,
} from './RowLinks';
import { compartmentId, RowCompartment } from './RowCompartment';
import { carrierOf } from './carrier';
import { PilePanel } from './PilePanel';
import { usePileOf, type PileData } from './pileContext';
import { useMeasured } from './measureShown';
import { stepsFact, useRoutineMenu, useStepsFoot, type StepsFoot } from './steps';
import styles from '../routes/planner.module.css';

/**
 * The row opens instead of jumping (planner hub 2, package 4a): the title toggles the compartment, „Ganz öffnen“ in it
 * is the old jump. Left out while „Zeilen aufklappen“ is off (the title opens the thing as before) and in a selection.
 */
export interface RowExpand {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** X4 „Aus dem Plan nehmen“ for a thing that is gone (the planner's own undoable „Nicht planen“). */
  onTakeOut?: () => void;
}

/** The title's disclosure (COPY X1) and the compartment under the row while it is open. */
function expandParts(
  expand: RowExpand | undefined,
  entry: PlannableEntry | undefined,
  unitId: string,
  title: string,
  links: RowLinkViews,
  part?: { k: number; of: number },
  pile?: ReturnType<typeof usePileOf>,
  stepsFoot?: StepsFoot,
) {
  if (!expand || !entry) return undefined;
  const id = compartmentId(unitId);
  // The compartment's name: a thing in parts says which part, as its title does (the button's name is what it shows).
  const named =
    part && part.of > 1 ? `${title}, ${t.planner.row.partAria(part.k + 1, part.of)}` : title;
  const carrier = expand.open ? carrierOf(entry) : undefined;
  return {
    disclosure: {
      open: expand.open,
      controls: id,
      hint: expand.open ? t.planner.panel.collapseHint : t.planner.panel.expandHint,
    },
    onOpen: expand.onToggle,
    compartment: expand.open ? (
      <RowCompartment id={id} label={named} onClose={expand.onClose}>
        {pile ? (
          pile.group && pile.data ? (
            <PilePanel group={pile.group} entries={pile.data.entries} />
          ) : null
        ) : (
          <PlanPanelHost
            moduleId={entry.moduleId}
            id={entry.id}
            to={entry.to}
            {...(expand.onTakeOut ? { onTakeOut: expand.onTakeOut } : {})}
            {...(carrier ? { carrier } : {})}
            {...(stepsFoot ? { steps: stepsFoot } : {})}
            detail={
              entry.detail ? (
                MONEY.test(entry.detail) ? (
                  <SensitiveValue compact>{entry.detail}</SensitiveValue>
                ) : (
                  entry.detail
                )
              ) : undefined
            }
            links={links.length > 0 ? <PanelLinks views={links} /> : undefined}
          />
        )}
      </RowCompartment>
    ) : undefined,
  };
}

/** A pile's lead: the area's glyph (money: the invoices glyph, mail: the mail glyph), never a tick or a button. */
const PILE_GLYPH: Record<PileArea, IconName> = { money: 'receipt', mail: 'mail' };

/** The facts of a pile row: P3 parts (desktop), P12 „{n} Dinge“ (phone), P4 late money, the earliest deadline. */
function pileFacts(group: PileGroup, data: PileData | undefined, dueClock: number): ReactNode[] {
  const parts = group.parts.flatMap(({ pile, members }) => {
    const n = members.length + Math.max(0, pile.count);
    return n > 0 ? [pile.label(n)] : [];
  });
  const members = group.parts.flatMap((p) => p.members);
  const late = data ? members.filter((k) => data.lateKeys.has(k)).length : 0;
  // The earliest deadline still ahead (late money is said by P4).
  const ahead = data
    ? members
        .map((k) => data.entries.get(k)?.due)
        .filter((d): d is { date: string; hard: boolean } => !!d?.hard && d.date >= data.today)
        .map((d) => d.date)
        .sort()[0]
    : group.due;
  const out: ReactNode[] = [];
  if (parts.length > 0)
    out.push(
      <>
        <span className={styles.pileWide}>
          {parts.map((p, i) => (
            <Fragment key={i}>
              {i > 0 ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>
                </>
              ) : null}
              {p}
            </Fragment>
          ))}
        </span>
        <span className={styles.pileNarrow}>{t.planner.pile.things(group.count)}</span>
      </>,
    );
  // Desktop: P4 and the next deadline; phone: P4, else the deadline (hand-off 02 „1920 / 412“) – one fact, so the
  // phone's hidden part takes its separator along.
  const when = ahead ? dayName(ahead) : undefined;
  const due = when
    ? dueWas({ hardDue: ahead }, dueClock)
      ? t.planner.row.dueWas(when)
      : t.planner.row.due(when)
    : undefined;
  if (late > 0)
    out.push(
      <span>
        {t.planner.pile.late(late)}
        {due ? (
          <span className={styles.pileWide}>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {due}
          </span>
        ) : null}
      </span>,
    );
  else if (due) out.push(<span>{due}</span>);
  return out;
}

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
export const MONEY = /\d\s?(€|\$|£|CHF)|(€|\$|£|CHF)\s?\d/;

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
  lock,
  onMove,
  onTakeOff,
  select,
  draggable,
  expand,
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
  /** The lock („fest“) in one tap; left out where the row cannot be locked (a fixed block, „Frist vorbei“). */
  lock?: { locked: boolean; onToggle: () => void };
  /**
   * „Noch offen“ (package 3): a move button in place of the ⋯ menu – two taps to a day, also on the phone. With it
   * the row has no ⋯ at all.
   */
  onMove?: () => void;
  /** „Vom Tag nehmen“, offered on a thing open for more than 14 days. */
  onTakeOff?: () => void;
  /** „Auswählen“: the row is a choice of the selection (a checkbox in front, no tick). */
  select?: { selected: boolean; onChange: (selected: boolean) => void };
  /** The row can be dragged onto a day and moved with `M` (package 5; the page's `useDragMove` acts). */
  draggable?: boolean;
  /** „Zeilen aufklappen“ (package 4a): the title opens the compartment; not in a selection. */
  expand?: RowExpand;
}) {
  const navigate = useNavigate();
  // Ticked: the row fades while the source stores it, then leaves with the board's next reading.
  const [leaving, setLeaving] = useState(false);
  const entry = row.entry;
  const source = entry ? sourceOf(entry) : undefined;
  const action = onDone ? undefined : entry?.action;
  const links = useRowLinks(entry);
  const pile = usePileOf(entry);
  // The foot only exists in an open compartment: its lookups run only there.
  const stepsFoot = useStepsFoot(
    entry,
    row.unitId,
    useRoutineMenu(expand?.open ? entry : undefined),
  );
  const opens = expandParts(
    select ? undefined : expand,
    entry,
    row.unitId,
    row.title,
    links,
    row,
    pile,
    stepsFoot,
  );
  const linkedMenu = withLinks(menu, useActionMenu(action), useLinkMenu(links));
  // „Noch offen“: the row's steps are on the row itself – no ⋯.
  const fullMenu = onMove ? [] : linkedMenu;
  const done =
    onDone && !select
      ? () => {
          if (leaving) return;
          setLeaving(true);
          // Nothing happened (the source said no): the row stays as it was.
          void onDone().then((ok) => {
            if (!ok) setLeaving(false);
          });
        }
      : undefined;

  // Z1 (package 8): a length taken from measured time says so until it is set by hand; the phone shows the minutes alone
  // and keeps the whole text for a screen reader.
  const measured = useMeasured(row.item, row.entry?.durationMin, row.minutes);
  const duration = measured ? (
    <>
      <span aria-hidden="true">
        {compact(row.minutes)}
        <span className={styles.asLast}>{` · ${t.planner.measure.asLast}`}</span>
      </span>
      <span className="sr-only">{t.planner.measure.asLastFull(compact(row.minutes))}</span>
    </>
  ) : row.approx ? (
    t.planner.row.approx(compact(row.minutes))
  ) : (
    compact(row.minutes)
  );
  const facts: ReactNode[] = [];
  // Direction A: the row is one line – title, chips, minutes, lock, ⋯. The source is no fact of the meta any more (the
  // row's name and its lead say it); the meta holds only what is particular to this thing (a deadline, „war Mo“ …).
  // A fixed block (S4, a training at 18:00): its time alone – „fest“ means the lock only (CONCEPT-COPY, R12).
  if (row.fixed) facts.push(<span>{`${row.fixed.from}–${row.fixed.to}`}</span>);
  // Without the lock control (a row of „Frist vorbei“) the state is said in the meta; with it, the control says it.
  else if (row.pinned && !lock)
    facts.push(<span className={styles.chipFest}>{t.planner.row.fixed}</span>);
  if (was) facts.push(<span>{t.planner.open.was(dayName(was))}</span>);
  // A pile (package 2): its parts (P3), late money (P4), the earliest deadline; on the phone P12 „{n} Dinge“ instead
  // of the parts. Muted text like every fact – never a badge, never a colour.
  const idle = !!pile && !pile.group?.alive;
  if (pile?.group && !idle) facts.push(...pileFacts(pile.group, pile.data, dueClock));
  if (entry?.detail)
    facts.push(
      MONEY.test(entry.detail) ? (
        <SensitiveValue compact>{entry.detail}</SensitiveValue>
      ) : (
        <span>{entry.detail}</span>
      ),
    );
  // B1 (package 5a): „5 Schritte“, „1 von 5“ – plain text, no bar.
  const stepsWord = stepsFact(entry);
  if (stepsWord) facts.push(<span>{stepsWord}</span>);
  // The part as plain text, only when set (package 4b; no colour carries it).
  if (row.item?.part) facts.push(<span>{partWord(row.item.part)}</span>);
  if (row.hardDue && !pile) {
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
      rowKey={row.itemKey}
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
            <Icon name={pile ? PILE_GLYPH[pile.area] : (source?.icon ?? 'checklist')} size={20} />
          </span>
        )
      }
      title={
        <span
          className={next ? styles.thingTitle : `${styles.thingTitle} ${styles.thingWeight}`}
          title={row.title}
          data-drag-unit={draggable && !select ? row.unitId : undefined}
        >
          {idle ? (
            // P9: nothing waits – drawn like a done row (struck, the words say it too).
            <span className={styles.pileIdle}>
              <s>{row.title}</s>
              {` · ${t.planner.pile.nothing}`}
            </span>
          ) : (
            row.title
          )}
          {row.of > 1 ? <Part k={row.k} of={row.of} /> : null}
        </span>
      }
      onOpen={opens ? opens.onOpen : entry ? () => void navigate(entry.to) : undefined}
      {...(opens ? { disclosure: opens.disclosure } : {})}
      meta={
        facts.length === 0 && !whyOpen ? (
          // Only the phone shows the minutes in the meta (its end slot is hidden).
          // The phone: „fest“ under the title (its row's end holds minutes, lock and ⋯ on one line).
          row.pinned && lock && !row.fixed ? (
            <span className={`${styles.meta} ${styles.metaPhoneOnly}`}>
              <span className={styles.chipFest}>{t.planner.row.fixed}</span>
            </span>
          ) : undefined
        ) : (
          <span className={styles.meta}>
            {facts.map((fact, i) => (
              <Fragment key={i}>
                {i > 0 ? <span aria-hidden="true">·</span> : null}
                {i > 0 && pile ? <span className="sr-only">, </span> : null}
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
        )
      }
      below={links.length > 0 ? <LinkChips views={links} /> : undefined}
      end={
        noDuration ? undefined : (
          <span className={styles.endFacts}>
            {/* „fest“ as a pill before the minutes (direction A); the lock control beside it says it too. */}
            {row.pinned && lock && !row.fixed ? (
              <span className={styles.chipFest}>{t.planner.row.fixed}</span>
            ) : null}
            <span className={styles.duration}>{duration}</span>
          </span>
        )
      }
      selectable={select ? true : undefined}
      // K11 (use case „Tag kippt“): the box says which thing it ticks – the title here is a button.
      selectName={select ? row.title : undefined}
      selected={select?.selected}
      onSelectChange={select ? (on) => select.onChange(on) : undefined}
      actions={
        lock || onMove || onTakeOff ? (
          <>
            {onTakeOff && !select ? (
              <button
                type="button"
                className={styles.textLink}
                aria-label={t.planner.open.takeOffName(row.title)}
                onClick={onTakeOff}
              >
                {t.planner.open.takeOff}
              </button>
            ) : null}
            {lock && !row.fixed && !select ? (
              <button
                type="button"
                className={lock.locked ? `${styles.lock} ${styles.lockOn}` : styles.lock}
                aria-pressed={lock.locked}
                aria-label={t.planner.row.lockName(row.title)}
                title={t.planner.row.lockName(row.title)}
                data-testid="row-lock"
                onClick={lock.onToggle}
              >
                {/* The state in a word stands as the pill „fest“ before the minutes, never in colour alone. */}
                <Icon name={lock.locked ? 'lock' : 'unlock'} size={16} />
              </button>
            ) : null}
            {onMove && !select ? (
              <button
                type="button"
                className={styles.lock}
                aria-label={t.planner.row.moveTitle(row.title)}
                title={t.planner.row.moveTitle(row.title)}
                data-row-move
                onClick={onMove}
              >
                <Icon name="calendar" size={16} />
              </button>
            ) : null}
          </>
        ) : undefined
      }
      menu={fullMenu}
      menuLabel={t.planner.row.menu(row.title)}
      onSwipeRight={done}
      swipeRightLabel={t.planner.row.done}
      onSwipeLeft={row.fixed ? undefined : onLater}
      swipeLeftLabel={t.planner.row.later}
    >
      {opens?.compartment}
    </ItemRow>
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
  chip,
  draggable,
  expand,
}: {
  row: WaitingRow;
  reason: string;
  /** „Warum hier?“ is open for this row. */
  why: boolean;
  menu: RowMenuItem[];
  /** „Vorschlag: Do · Frist Fr · Übernehmen“ or „In ToDos: Mo 16.“: one fact and at most one step. */
  chip?: ReactNode;
  /** The row can be dragged onto a day and moved with `M` (package 5). */
  draggable?: boolean;
  /** „Zeilen aufklappen“ (package 4a): the title opens the compartment. */
  expand?: RowExpand;
}) {
  const links = useRowLinks(row.entry);
  const linkMenu = useLinkMenu(links);
  const pile = usePileOf(row.entry);
  const stepsFoot = useStepsFoot(
    row.entry,
    row.unitId,
    useRoutineMenu(expand?.open ? row.entry : undefined),
  );
  const opens = expandParts(expand, row.entry, row.unitId, row.title, links, row, pile, stepsFoot);
  const stepsWord = stepsFact(row.entry);
  // A pile (package 2): the area's glyph in front, its parts in the meta (a pile with nothing to do is no row here).
  const pileMeta = pile?.group ? pileFacts(pile.group, pile.data, now()) : undefined;
  return (
    <ItemRow
      // `?item=<rowKey>` finds it here too: the page opens the folded group and focuses it (package 10b).
      rowKey={row.itemKey}
      {...(pile
        ? {
            lead: (
              <span className={styles.lead} aria-hidden="true">
                <Icon name={PILE_GLYPH[pile.area]} size={20} />
              </span>
            ),
          }
        : {})}
      title={
        <span data-drag-unit={draggable ? row.unitId : undefined}>
          {row.title}
          {row.of > 1 ? <Part k={row.k} of={row.of} /> : null}
        </span>
      }
      titleFull
      {...(opens ? { onOpen: opens.onOpen, disclosure: opens.disclosure } : {})}
      // The reason only behind „Warum hier?“, like on the board (U12). A row without a menu (no entry) keeps its
      // reason in sight.
      meta={
        why || !row.entry ? (
          reason
        ) : stepsWord && !pile ? (
          <span className={styles.meta}>{stepsWord}</span>
        ) : pileMeta?.length ? (
          <span className={styles.meta}>
            {pileMeta.map((fact, i) => (
              <Fragment key={i}>
                {i > 0 ? <span aria-hidden="true">·</span> : null}
                {fact}
              </Fragment>
            ))}
          </span>
        ) : undefined
      }
      below={
        chip || links.length > 0 ? (
          <>
            {chip}
            {links.length > 0 ? <LinkChips views={links} /> : null}
          </>
        ) : undefined
      }
      end={<span className={styles.minutes}>{compact(row.minutes)}</span>}
      menu={withLinks(menu, [], linkMenu)}
      menuLabel={t.planner.row.menu(row.title)}
    >
      {opens?.compartment}
    </ItemRow>
  );
}

/**
 * „In ToDos: Do · Hierher legen“ (CONCEPT-MIGRATION §4): a date set in ToDos that the plan does not hold, shown muted on
 * that day. Derived, never stored, counts for no load; one tap lays the thing there.
 */
export function TodoHintRow({
  title,
  date,
  onPlace,
}: {
  title: string;
  date: string;
  onPlace: () => void;
}) {
  return (
    <ItemRow
      className={styles.hintMuted}
      // Direction A: a muted row with a dashed circle – a thing the ToDos date here, not laid by the plan.
      lead={
        <span className={styles.lead} aria-hidden="true">
          <span className={styles.dashedTick} />
        </span>
      }
      title={<span className={styles.thingTitle}>{title}</span>}
      // The phone hides the end slot: there the chip stands in the meta line.
      meta={
        <span className={`${styles.meta} ${styles.metaPhoneOnly}`}>
          <span className={styles.chipHint}>{t.planner.chips.inTodos(dayName(date))}</span>
        </span>
      }
      end={
        <span className={styles.endFacts}>
          <span className={styles.chipHint}>{t.planner.chips.inTodos(dayName(date))}</span>
        </span>
      }
      controls="always"
      actions={
        <button
          type="button"
          className={styles.textLink}
          aria-label={t.planner.chips.placeName(title, dayName(date))}
          onClick={onPlace}
          data-testid="todo-hint-place"
        >
          {t.planner.chips.place}
        </button>
      }
    />
  );
}
