/** Small layout building blocks shared by the module pages (headers, filters, lists, forms). */
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/strings';
import { useSubmitOnce } from '@/core/forms/submitOnce';
import { useHeroControls, useHeroTargets } from '@/core/shell/heroContext';
import { usePageAction } from '@/core/shell/pageAction';
import { Button } from './Button';
import { Checkbox } from './Fields';
import { ListSurface } from './ListSurface';
import { ReadableText } from './ReadableText';
import { RowMenu, type RowMenuItem } from './RowMenu';
import { useSwipeRow } from './useSwipeRow';
import { useMediaQuery } from './useMediaQuery';
import { usePageWidthAtLeast } from './pageWidth';
import styles from './Patterns.module.css';

/** `views` = the switch between the sub-views of the page: `Tabs` (Identity 4.0). `Segmented` is for filters only. */
/**
 * The page title (h1). Inside a module page it renders into the title row of the module head (`layout/AreaFrame`),
 * anywhere else where it is called. Pages that lay out their own header use this instead of a bare `<h1>`.
 */
export function PageTitle({ title, spacer = false }: { title: string; spacer?: boolean }) {
  const hero = useHeroTargets();
  const controls = useHeroControls();
  // The frame's eyebrow reads the title from here, never from the DOM.
  useEffect(() => {
    controls?.setTitle(title);
    return () => controls?.setTitle(undefined);
  }, [controls, title]);
  const heading = <h1>{title}</h1>;
  if (!hero) return heading;
  return (
    <>
      {/* The title left its flex row (a header with actions): this keeps the actions where they were, on the right. */}
      {spacer ? <span className={styles.titleSpacer} aria-hidden="true" /> : null}
      {hero.title ? createPortal(heading, hero.title) : null}
    </>
  );
}

/**
 * The header actions with their last two kept as one group (U34): the primary action and the "⋯" menu after it wrap
 * together on a phone, so the menu never stands alone in a row of its own. Callers pass the primary action and the
 * "⋯" menu as the last two direct children. The tree is the same for any number of children, so the primary
 * button never remounts when the menu appears or goes (focus returns to it after a dialog).
 */
function headerActions(children: ReactNode): ReactNode {
  const items = Children.toArray(children);
  return (
    <>
      {items.slice(0, -2)}
      <span className={styles.headerGroup}>{items.slice(-2)}</span>
    </>
  );
}

/** Below this the shell is the phone layout: bottom bar with the plus, no action in the head (same as the CSS). */
export const PHONE_QUERY = '(max-width: 899px)';

/**
 * The one action of a module page (Identity 4.0, rule 4), a child of `PageHeader`: on the desktop the one filled
 * button in the head's title row; on the phone it renders nothing and is the plus in the bottom bar instead, which
 * shows `short` (the thing it adds, a noun) and is named "<short> eintragen". Outside a shell (dialogs, tests) it is
 * the button where it is called. `variant="secondary"` while an empty state owns the filled button of the view.
 */
export function PageAction({
  short,
  onClick,
  disabled,
  variant = 'primary',
  'aria-label': ariaLabel,
  testId,
  children,
}: {
  short: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  'aria-label'?: string;
  testId?: string;
  children: ReactNode;
}) {
  const inShell = !!useHeroControls();
  const phone = useMediaQuery(PHONE_QUERY);
  usePageAction({ short, onClick, disabled }, inShell);
  if (inShell && phone) return null;
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      data-page-action
    >
      {children}
    </Button>
  );
}

/**
 * Title, views and actions of a page. Inside the module frame (Identity 4.0) the title is the h1 of the head's title
 * row, `views` (the `Tabs` of the page) lie at the head's lower edge, and the actions (`children`, with the one
 * `PageAction`) sit in the title row on the desktop; on the phone the head has no action, so what is left of them
 * stays as a row in the page. Without a shell everything renders in place.
 */
export function PageHeader({
  title,
  views,
  besideContent = false,
  children,
}: {
  title: string;
  views?: ReactNode;
  /**
   * Phone only: what is left of the actions (the "⋯" menu) takes no row of its own but sits at the right edge of the
   * page's first row, so the content starts right under the head (Identity 4.0, rule 5: content from y ≤ 220 px).
   * For pages whose first row is short and starts at the left (a month switch, a group heading, one line of text).
   */
  besideContent?: boolean;
  children?: ReactNode;
}) {
  const hero = useHeroTargets();
  const phone = useMediaQuery(PHONE_QUERY);
  if (hero) {
    const inHead = !phone;
    return (
      <>
        <PageTitle title={title} />
        {views && hero.tabs ? createPortal(views, hero.tabs) : null}
        {children && inHead ? (hero.actions ? createPortal(children, hero.actions) : null) : null}
        {children && !inHead ? (
          <div
            className={styles.header}
            data-in-head="true"
            data-beside-content={besideContent ? 'true' : undefined}
          >
            <div className={styles.headerEnd}>{headerActions(children)}</div>
          </div>
        ) : null}
      </>
    );
  }
  return (
    <div className={styles.header}>
      <PageTitle title={title} />
      {views ? <div className={styles.headerViews}>{views}</div> : null}
      {children ? headerActions(children) : null}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>;
}

/** A filter inside a view (period, status, sort). The views of a page are `Tabs`, never a `Segmented` (Identity 4.0). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const labels = options.map((o) => o.label).join('|');
  // The edge fade of the phone's row says "more to the right", so it is drawn only while the row overflows
  // (`.segment[data-overflow]`); on a row that fits it faded the last option for nothing.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const mark = () => {
      el.dataset.overflow = el.scrollWidth > el.clientWidth + 1 ? 'true' : 'false';
    };
    mark();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mark);
    ro.observe(el);
    return () => ro.disconnect();
    // The labels decide the row's width (a language switch changes them without resizing the box).
  }, [labels]);
  return (
    <div ref={box} className={styles.segment} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

/** Two or three form fields side by side. */
export function Split({ children }: { children: ReactNode }) {
  return <div className={styles.split}>{children}</div>;
}

/** An editor form. When `onSubmit` returns a promise, submits are ignored until it has settled (no double save). */
export function Form({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: () => void | Promise<unknown>;
}) {
  const submit = useSubmitOnce(onSubmit);
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {children}
    </form>
  );
}

/**
 * Footer of an editor form: `start` (e.g. delete) on the left, `children` (cancel/save) on the right. In a dialog on
 * the phone it is the fixed foot of the sheet: it stays at the lower edge while the fields scroll.
 */
export function FormActions({ start, children }: { start?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.formActions} data-form-actions="">
      {start ?? <span />}
      <span className={styles.formActionsEnd}>{children}</span>
    </div>
  );
}

/**
 * The one list pattern. `layout="list"` (default) lays flat rows on one `ListSurface` (a raised tone, hairlines
 * between the rows); `layout="grid"` turns the same rows into tiles once the page is wide enough (Links, tools).
 */
export function ItemList({
  children,
  label,
  layout = 'list',
}: {
  children: ReactNode;
  label?: string;
  layout?: 'list' | 'grid';
}) {
  if (layout === 'grid')
    return (
      <ul className={`${styles.list} ${styles.grid}`} aria-label={label}>
        {children}
      </ul>
    );
  return (
    <ListSurface className={`${styles.list} ${styles.rows}`} label={label}>
      {children}
    </ListSurface>
  );
}

/** Meta that reads like a sentence (a note excerpt, a description) gets the reading aid; short facts ("Fällig am …") do not. */
function isTeaser(meta: string): boolean {
  return meta.split(/\s+/).length >= 5;
}

/**
 * A row: optional selection box and `lead`, a main button (title + meta lines, opens the editor),
 * trailing `end` content and `actions` that appear on hover/focus. `data-row` marks the main
 * element for keyboard navigation; put `data-row-edit` / `data-row-tick` on an element inside
 * the row to give the E and Space shortcuts something to press.
 */
export function ItemRow({
  title,
  titleFull,
  meta,
  onOpen,
  href,
  lead,
  end,
  actions,
  menu,
  menuLabel,
  selectable,
  selected,
  current,
  onSelectChange,
  done,
  tone,
  onSwipeRight,
  swipeRightLabel,
  onSwipeLeft,
  swipeLeftLabel,
  className,
  signatureBlock,
  children,
}: {
  title: ReactNode;
  /** Wrap a long title in full instead of ending it in "…" after two lines (lists the user reads and ticks). */
  titleFull?: boolean;
  meta?: ReactNode;
  onOpen?: () => void;
  /** An external address: the main element is a link (new tab, `noreferrer noopener`) instead of a button; `onOpen` is then unused. */
  href?: string;
  lead?: ReactNode;
  end?: ReactNode;
  /** Row actions (icon buttons); shown on hover/focus, always on devices without hover. */
  actions?: ReactNode;
  /** Overflow menu ("⋯"); also opens on right-click and long press. Entries are shortcuts: each one stays reachable in the edit dialog. */
  menu?: RowMenuItem[];
  menuLabel?: string;
  /** Shows a checkbox on the left; `onSelectChange` also reports a Shift-click for ranges. */
  selectable?: boolean;
  selected?: boolean;
  /**
   * Master–detail: this row's entry is the one shown in the detail panel (`aria-current` on the row's button; a
   * sunken tone and a heavier title, no accent).
   */
  current?: boolean;
  onSelectChange?: (selected: boolean, extend: boolean) => void;
  /** Done entries are struck through and quiet. */
  done?: boolean;
  /** Urgency stripe at the left edge (overdue = danger, today = accent). Always pair it with text or a badge in the row. */
  tone?: 'overdue' | 'today';
  /** Touch swipes (phone): right = done/paid, left = move/snooze; the labels name the revealed action. */
  onSwipeRight?: () => void;
  swipeRightLabel?: string;
  onSwipeLeft?: () => void;
  swipeLeftLabel?: string;
  className?: string;
  /**
   * Marks the row as one of the framed signature blocks (`data-signature-block`). Every value is listed in
   * `web/scripts/baselines/signature-blocks.json`; the stimulus budget counts them per page (docs/howto/ci.md).
   */
  signatureBlock?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span
        className={titleFull ? `${styles.title} ${styles.titleFull}` : styles.title}
        title={typeof title === 'string' ? title : undefined}
      >
        {typeof title === 'string' ? <ReadableText text={title} kind="list" /> : title}
      </span>
      {meta ? (
        <span className={styles.muted} title={typeof meta === 'string' ? meta : undefined}>
          {typeof meta === 'string' && isTeaser(meta) ? (
            <ReadableText text={meta} kind="list" />
          ) : (
            meta
          )}
        </span>
      ) : null}
    </>
  );
  const swipe = useSwipeRow({ onSwipeRight, onSwipeLeft });
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <li
      onContextMenu={
        menu?.length
          ? (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
          : undefined
      }
      data-tone={tone}
      data-signature-block={signatureBlock}
      className={[
        styles.item,
        swipe.enabled ? styles.swipeable : '',
        selected ? styles.selected : '',
        current ? styles.current : '',
        done ? styles.done : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {swipe.enabled && swipe.dx !== 0 ? (
        <div
          className={`${styles.reveal} ${swipe.dx > 0 ? styles.revealRight : styles.revealLeft}`}
          aria-hidden="true"
        >
          {swipe.dx > 0 ? swipeRightLabel : swipeLeftLabel}
        </div>
      ) : null}
      <div className={styles.row} style={swipe.style} {...swipe.bind}>
        {selectable ? (
          <Checkbox
            label={t.ui.selectRow}
            labelHidden
            checked={!!selected}
            onChange={() => undefined}
            onClick={(e) => onSelectChange?.(!selected, e.shiftKey)}
          />
        ) : null}
        {lead}
        {href ? (
          <a className={styles.main} data-row href={href} target="_blank" rel="noreferrer noopener">
            {body}
          </a>
        ) : onOpen ? (
          <button
            type="button"
            className={styles.main}
            data-row
            aria-current={current ? 'true' : undefined}
            onClick={onOpen}
          >
            {body}
          </button>
        ) : (
          <div className={`${styles.main} ${styles.static}`} data-row tabIndex={-1}>
            {body}
          </div>
        )}
        {end}
        {actions || menu?.length ? (
          <div
            className={`${styles.actions} ${menuOpen ? styles.actionsOpen : ''}`}
            data-row-actions
          >
            {actions}
            {menu?.length ? (
              <RowMenu
                label={menuLabel ?? t.ui.rowMenu}
                items={menu}
                open={menuOpen}
                onOpenChange={setMenuOpen}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {children}
    </li>
  );
}

/** Window width from which a page can afford a side panel when it is not inside a page container (dialogs, tests). */
export const SPLIT_QUERY = '(min-width: 1200px)';

/**
 * Page width (rem) from which master–detail opens its panel: the main column keeps about 32 rem next to a 22 rem aside. At the 16 px
 * root that is 896 px of page, so a 1280 px window with the full sidebar still gets the panel, a 1200 px one does not.
 */
export const SPLIT_PAGE_REM = 56;

/**
 * True while the page is wide enough for a `SplitView` panel. Inside a page container it follows the room the page really has
 * (`SPLIT_PAGE_REM`; the sidebar, the rail and a narrow window all count); with an explicit `query`, or outside a page container,
 * it follows the window (`SPLIT_QUERY`).
 */
export function useSplitView(query?: string): boolean {
  const viewport = useMediaQuery(query ?? SPLIT_QUERY);
  const page = usePageWidthAtLeast(SPLIT_PAGE_REM);
  return query === undefined && page !== undefined ? page : viewport;
}

/**
 * Main content plus a side panel. With `enabled` false only the main content renders, so the
 * panel is a structural decision (never merely hidden, never a duplicate in the DOM).
 */
export function SplitView({
  children,
  aside,
  asideLabel,
  enabled,
}: {
  children: ReactNode;
  aside: ReactNode;
  asideLabel: string;
  enabled: boolean;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <div className={styles.splitView}>
      <div className={styles.splitMain}>{children}</div>
      <aside className={styles.splitAside} aria-label={asideLabel}>
        {/* Absolutely positioned so the panel never makes the row taller than the main content. */}
        <div className={styles.splitAsideInner}>{aside}</div>
      </aside>
    </div>
  );
}

export function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return onClick ? (
    <button type="button" className={styles.chip} aria-pressed={selected} onClick={onClick}>
      {label}
    </button>
  ) : (
    <span className={styles.chip}>{label}</span>
  );
}

export function Chips({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className={styles.chips} role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}

export function Progress({
  value,
  max,
  label,
  over,
  tone,
}: {
  value: number;
  max: number;
  label: string;
  over?: boolean;
  /** Colours the bar for a level (warning / danger) when it is not an overrun. */
  tone?: 'warning' | 'danger';
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className={[
          styles.progressBar,
          over || tone === 'danger' ? styles.progressOver : '',
          tone === 'warning' ? styles.progressWarn : '',
        ].join(' ')}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}

export const patternStyles = styles;
