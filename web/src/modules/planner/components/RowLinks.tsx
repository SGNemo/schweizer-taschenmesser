import { useNavigate } from 'react-router';
import { fromLegacy, refKey, type EntityLink } from '@/core/entitylinks/types';
import { type PlannableEntry, useResolvedLinks } from '@/core/modules/contributions';
import type { ResolvedState } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Icon, type IconName, type RowMenuItem } from '@/ui';
import styles from '../routes/planner.module.css';

/**
 * A row's links and its main action (planner hub K1b, CONCEPT-DESIGN §4, CONCEPT-LINKS §1.4, L7). Display only:
 * nothing here writes – a chip leads to the linked thing, the action to the source's own step (a route), and an
 * external address opens only on a tap. Labels are rendered as text nodes only.
 */

export type RowLink = Omit<EntityLink, 'from'>;

/** At most this many chips stand in the row's one chip line; every link is in ⋯ under „Verknüpft“. */
export const CHIP_MAX = 2;

/** An in-app route (`/invoices?…`); anything else – an external or protocol-relative address – is never followed. */
export const isAppRoute = (to: string): boolean => to.startsWith('/') && !to.startsWith('//');

/**
 * The links of a thing: `links`, else the deprecated `link` read as `links[0]`. One per target; a reminder first
 * (it is why the row is urgent), the rest in the source's order.
 */
export function linksOfEntry(entry: Pick<PlannableEntry, 'links' | 'link'> | undefined): RowLink[] {
  if (!entry) return [];
  const all = entry.links ?? (entry.link ? [fromLegacy(entry.link)] : []);
  const seen = new Set<string>();
  const out: RowLink[] = [];
  for (const l of all) {
    const key = refKey(l.to);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  const rank = (l: RowLink) => (l.rel === 'dunning' ? 0 : 1);
  return out
    .map((l, i) => ({ l, i }))
    .sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i)
    .map((x) => x.l);
}

/** The chip's word: what the link is, from the row's side („Zur Mahnung“, „Aus Mail“, „Zur Rechnung“ …). */
export function linkWord(link: RowLink): string {
  const w = t.planner.links;
  if (link.rel === 'dunning') return w.dunning;
  switch (link.to.module) {
    case 'invoices':
      return w.invoice;
    case 'mail':
      return link.rel === 'origin' ? w.fromMail : t.planner.row.openMail;
    case 'notes':
      return t.planner.row.openNote;
    case 'calendar':
      return w.event;
    case 'todos':
      return w.todo;
    default:
      return w.other;
  }
}

const LINK_ICONS: Record<string, IconName> = {
  mail: 'mail',
  invoices: 'receipt',
  notes: 'note',
  calendar: 'calendar',
  todos: 'checklist',
};
const linkIcon = (link: RowLink): IconName => LINK_ICONS[link.to.module] ?? 'arrowRight';

/** The glyph of a row's main action, by the module its route leads into. */
const ACTION_ICONS: Record<string, IconName> = {
  invoices: 'wallet',
  lists: 'cart',
  subscriptions: 'circleMinus',
  vault: 'file',
  people: 'users',
};
export function actionIcon(to: string): IconName {
  const module = /^\/([a-z-]+)/.exec(to)?.[1] ?? '';
  return ACTION_ICONS[module] ?? 'arrowRight';
}

/** The label of the time, or the target's title of today when it is alive here. */
const labelOf = (link: RowLink, state: ResolvedState | undefined): string =>
  state?.state === 'alive' && state.title ? state.title : link.label;

/** What a link is on this device, in a form the chip and the menu share. */
interface LinkView {
  key: string;
  word: string;
  icon: IconName;
  /** The full accessible name (word, label, and the state where it is not plain „open“). */
  name: string;
  /** Loading: shown, not yet usable. */
  loading: boolean;
  /** Said, not offered: gone, or cannot be told here without a way out. */
  note?: string;
  /** In-app route of an alive target. */
  to?: string;
  /** External address (a mail thread outside this device's cache): opens only on a tap. */
  url?: string;
}

function viewOf(link: RowLink, state: ResolvedState | undefined): LinkView {
  const w = t.planner.links;
  const word = linkWord(link);
  const label = labelOf(link, state);
  const base = { key: refKey(link.to), word, icon: linkIcon(link) };
  if (state === undefined) return { ...base, name: w.name(word, label), loading: true };
  if (state.state === 'alive')
    return isAppRoute(state.to)
      ? { ...base, name: w.name(word, label), loading: false, to: state.to }
      : { ...base, name: w.stateName(word, label, w.gone), loading: false, note: w.gone };
  if (state.state === 'gone')
    return { ...base, name: w.stateName(word, label, w.gone), loading: false, note: w.gone };
  const url = state.url;
  return url
    ? { ...base, name: w.stateName(word, label, w.browser), loading: false, url }
    : { ...base, name: w.stateName(word, label, w.elsewhere), loading: false, note: w.elsewhere };
}

/** The links of a row and their live states (`undefined` while loading). */
export function useRowLinks(entry: Pick<PlannableEntry, 'links' | 'link'> | undefined) {
  const links = linksOfEntry(entry);
  const states = useResolvedLinks(links.map((l) => l.to));
  return links.map((l) => viewOf(l, states?.get(refKey(l.to))));
}

export type RowLinkViews = ReturnType<typeof useRowLinks>;

function useOpen() {
  const navigate = useNavigate();
  return (v: LinkView) => {
    if (v.to) void navigate(v.to);
    else if (v.url) void getPlatform().app.openUrl(v.url);
  };
}

/**
 * The row's one chip line: the first `CHIP_MAX` links, never wrapping (a long word ends in „…“, the full name is
 * the chip's accessible name and tooltip). The rest stand in ⋯ under „Verknüpft“.
 */
export function LinkChips({ views }: { views: RowLinkViews }) {
  const open = useOpen();
  if (views.length === 0) return null;
  return (
    <div role="group" className={styles.chipLine} aria-label={t.planner.links.group}>
      {views.slice(0, CHIP_MAX).map((v) => (
        <span key={v.key} className={styles.chipItem}>
          {v.note ? (
            <span className={`${styles.linkChip} ${styles.linkChipMuted}`} title={v.name}>
              <Icon name={v.icon} size={16} />
              <span className={styles.chipText}>
                {v.word}
                <span className={styles.chipNote}>{` · ${v.note}`}</span>
              </span>
            </span>
          ) : (
            <button
              type="button"
              className={styles.linkChip}
              aria-label={v.name}
              title={v.name}
              disabled={v.loading}
              data-link-chip
              onClick={() => open(v)}
            >
              {/* One glyph per chip: the way out (the browser) says more than the kind where it applies. */}
              <Icon name={v.url ? 'external' : v.icon} size={16} />
              <span className={styles.chipText}>{v.word}</span>
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/** Every link as a ⋯ entry, under the heading „Verknüpft“ („Verknüpft · 3“ once one line cannot hold them). */
export function useLinkMenu(views: RowLinkViews): RowMenuItem[] {
  const open = useOpen();
  const group =
    views.length > CHIP_MAX ? t.planner.links.groupCount(views.length) : t.planner.links.group;
  return views.map((v, i) => ({
    id: `link-${v.key}`,
    label: v.name,
    ...(i === 0 ? { group } : {}),
    ...(v.note || v.loading ? { disabled: true } : {}),
    onSelect: () => open(v),
  }));
}

/**
 * The lead slot's main action (L7): an outlined glyph, 44 px, that leads to the source's own step – „Bezahlt …“
 * opens the invoice's pay step, „Zur Liste“ the list. A route only: the planner writes nothing. The word is the
 * accessible name (with the thing's title) and the tooltip; it is also the first ⋯ entry (CONCEPT-A11Y 10).
 */
export function ActionLead({
  action,
  title,
}: {
  action: { label: string; to: string };
  title: string;
}) {
  const navigate = useNavigate();
  return (
    <span className={styles.lead}>
      <button
        type="button"
        className={styles.actionLead}
        aria-label={t.planner.links.actionName(action.label, title)}
        title={action.label}
        data-row-action
        onClick={() => {
          if (isAppRoute(action.to)) void navigate(action.to);
        }}
      >
        <span className={styles.actionGlyph} aria-hidden="true">
          <Icon name={actionIcon(action.to)} size={16} />
        </span>
      </button>
    </span>
  );
}

/** The action's word as the first ⋯ entry (same route as the lead). */
export function useActionMenu(action: { label: string; to: string } | undefined): RowMenuItem[] {
  const navigate = useNavigate();
  if (!action || !isAppRoute(action.to)) return [];
  return [{ id: 'action', label: action.label, onSelect: () => void navigate(action.to) }];
}

/**
 * The row's ⋯ in its order: the action's word, the day's steps („Verschieben …“, „Später“, „Dauer …“ …), the links
 * under „Verknüpft“, then the group „Mehr“ (the first entry that carries a heading).
 */
export function withLinks(
  menu: RowMenuItem[],
  action: RowMenuItem[],
  links: RowMenuItem[],
): RowMenuItem[] {
  const at = menu.findIndex((item) => item.group !== undefined);
  const split = at < 0 ? menu.length : at;
  return [...action, ...menu.slice(0, split), ...links, ...menu.slice(split)];
}
