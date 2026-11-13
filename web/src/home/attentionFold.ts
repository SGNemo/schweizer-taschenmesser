import type { AttentionCover, AttentionItem } from '@/core/modules/types';
import { TODAY_KEY, type HomeLayout } from './layout';

/** Key of the "Jetzt wichtig" strip in the layout's hidden list. */
export const ATTENTION_KEY = 'core:attention';
/** Key of the "Heute · Morgen · diese Woche" block: in `hidden` it is off, in `pinned` it also shows in the calm view. */
export const AGENDA_KEY = 'core:agenda';

export type HomeView = 'calm' | 'all';

/**
 * The agenda block is on the page: in the detailed view unless hidden, in the calm view only when pinned
 * ("Ruhig" = strip + "Heute" card + pins; the switch is in the overview's edit dialog).
 */
export const isAgendaVisible = (layout: HomeLayout, view: HomeView): boolean =>
  !layout.hidden.includes(AGENDA_KEY) && (view === 'all' || layout.pinned.includes(AGENDA_KEY));

/**
 * The one fold rule of "Jetzt wichtig": overdue / exceeded (`danger`) and due today (`due`) never fold,
 * everything else waits behind "Kann warten · n". The tone does not decide: `accent` and `warning` are
 * worn by things of the coming days too.
 */
export const neverFolds = (i: AttentionItem): boolean => i.tone === 'danger' || i.due === 'today';

/**
 * Splits ranked entries into the cards that show and the ones behind "Kann warten". Nothing is cut and
 * nothing is filled up: five overdue things are five cards, one is one. With `calm` off (the focus setting
 * "ruhiges Jetzt wichtig") every entry is a card.
 */
export function foldAttention(
  items: readonly AttentionItem[],
  calm: boolean,
): { visible: AttentionItem[]; waiting: AttentionItem[] } {
  if (!calm) return { visible: [...items], waiting: [] };
  return { visible: items.filter(neverFolds), waiting: items.filter((i) => !neverFolds(i)) };
}

/** The kind of an entry: its id up to the second colon (`budgets:warn:b1` → `budgets:warn`). */
const kindOf = (id: string): string => id.split(':').slice(0, 2).join(':');

/** At most this many phrases stand in the folded line; the rest shows when it is opened. */
export const FOLD_PHRASES = 2;

/**
 * The phrases of the folded line, in the order of the entries: entries with a `foldSummary` are counted per
 * kind ("2 Budgets fast aufgebraucht"), an entry without one speaks with its title. `more` says that
 * further phrases were left out.
 */
export function foldPhrases(
  waiting: readonly AttentionItem[],
  limit = FOLD_PHRASES,
): { phrases: string[]; more: boolean } {
  const groups = new Map<string, { n: number; first: AttentionItem }>();
  for (const i of waiting) {
    const key = i.foldSummary ? kindOf(i.id) : i.id;
    const g = groups.get(key);
    if (g) g.n += 1;
    else groups.set(key, { n: 1, first: i });
  }
  const all = [...groups.values()].map((g) => g.first.foldSummary?.(g.n) ?? g.first.title);
  return { phrases: all.slice(0, limit), more: all.length > limit };
}

/**
 * Ids the strip leaves out because a block on the same page lists the thing itself (the strip counts, the
 * cards list). Only the blocks' visibility is known here: the agenda (`isAgendaVisible`) covers `'agenda'`,
 * the "Heute" card covers `'today'` in the calm view – not the month card that stands in for it, and not in
 * the detailed view, where the card is one widget among many. What a block cuts off its own list is not
 * known (`home/` imports no module): an entry of today beyond that cut is left out here all the same, the
 * named price of the small version.
 * `available` = keys of the widgets that can be shown (module on, not hidden by the person).
 */
export function coveredIds(
  layout: HomeLayout,
  view: HomeView,
  items: readonly AttentionItem[],
  available: readonly string[] = [],
): Set<string> {
  const on: AttentionCover[] = [];
  if (isAgendaVisible(layout, view)) on.push('agenda');
  if (view === 'calm' && available.includes(TODAY_KEY)) on.push('today');
  return new Set(
    items.filter((i) => i.coveredBy?.some((c) => on.includes(c)) === true).map((i) => i.id),
  );
}
