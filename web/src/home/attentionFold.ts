import type { AttentionCover, AttentionItem } from '@/core/modules/types';
import type { HomeViewChoice } from '@/stores/ui';
import type { HomeLayout } from './layout';

/** Key of the "Jetzt wichtig" strip in the layout's hidden list. */
export const ATTENTION_KEY = 'core:attention';
/** Key of the "Heute · Morgen · diese Woche" block: in `hidden` it is off, in `pinned` it also shows in the calm view. */
export const AGENDA_KEY = 'core:agenda';

export type HomeView = HomeViewChoice;

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

/** At most this many phrases stand in the folded line; the rest shows when it is opened. */
export const FOLD_PHRASES = 2;

/**
 * The phrases of the folded line, in the order of the entries: entries with a `foldSummary` are counted per
 * summary ("2 Budgets fast aufgebraucht"), an entry without one speaks with its title. `more` says that
 * further phrases were left out.
 */
export function foldPhrases(
  waiting: readonly AttentionItem[],
  limit = FOLD_PHRASES,
): { phrases: string[]; more: boolean } {
  const groups = new Map<string, { n: number; first: AttentionItem }>();
  for (const i of waiting) {
    // One kind = one summary: two modules that say the same ("Abo mit neuem Preis") are counted together.
    const key = i.foldSummary ? `summary:${i.foldSummary(1)}` : i.id;
    const g = groups.get(key);
    if (g) g.n += 1;
    else groups.set(key, { n: 1, first: i });
  }
  const all = [...groups.values()].map((g) => g.first.foldSummary?.(g.n) ?? g.first.title);
  return { phrases: all.slice(0, limit), more: all.length > limit };
}

/**
 * The blocks on the page that list single things themselves: the agenda when it is shown, else the "Heute" card when
 * it is on the page and lists something (it then names the day's appointments, `todos/widgets/NextWidget`). One rule
 * for the strip (`coveredIds`) and the card (`OverviewBlocksContext`), so they never disagree.
 * `cardShown` = the "Heute" card is among the cards drawn and not switched to its "off" hint.
 */
export function activeCovers(
  layout: HomeLayout,
  view: HomeView,
  cardShown: boolean,
): AttentionCover[] {
  if (isAgendaVisible(layout, view)) return ['agenda'];
  return cardShown ? ['today'] : [];
}

/**
 * Ids the strip leaves out because a block on the same page lists the thing itself (the strip counts, the blocks
 * list). Only visibility is known here, not what a block cuts off its own list (`home/` imports no module): an entry
 * of today beyond that cut is left out all the same, the named price of the small version.
 */
export function coveredIds(
  covers: readonly AttentionCover[],
  items: readonly AttentionItem[],
): Set<string> {
  return new Set(
    items.filter((i) => i.coveredBy?.some((c) => covers.includes(c)) === true).map((i) => i.id),
  );
}
