/**
 * The planner shrunk to one topic (planner hub 2, package 11; hand-off 11 „Shrinking the planner to a topic“): the page's
 * device state (the filter and the last used topic, `_meta`) and the members of the shown topic, read once for the page.
 * `filterBoard` is pure: the sheet, the band, „Noch ohne Tag“ and „Noch offen“ show only members; a blocker stays when
 * its appointment is a member. Display only – the day's free time keeps counting the whole day (`free`, `planned` are
 * the board's own), nothing is written.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { getMeta } from '@/core/db/metaKv';
import { refKey } from '@/core/entitylinks/types';
import { plannedOf } from '../board';
import type { BoardData } from '../useBoard';
import { topicRepo } from '../repo';
import { TOPIC_FILTER_KEY, TOPIC_LAST_KEY, shownMembers } from '../topic';

/** The member a row's item key belongs to: that thing or one of its occurrences (CONCEPT §1.2 prefix rule). */
export function memberOf(members: ReadonlySet<string>): (itemKey: string) => string | undefined {
  return (itemKey) => {
    if (members.has(itemKey)) return itemKey;
    // `<module>:<id>:<occurrence>` → try each shorter prefix at a colon (an id may hold colons itself).
    for (let i = itemKey.lastIndexOf(':'); i > 0; i = itemKey.lastIndexOf(':', i - 1))
      if (members.has(itemKey.slice(0, i))) return itemKey.slice(0, i);
    return undefined;
  };
}

/** Whether a row's item key matches a member. */
export function matcher(members: ReadonlySet<string>): (itemKey: string) => boolean {
  const of = memberOf(members);
  return (itemKey) => of(itemKey) !== undefined;
}

/** The board as the filter shows it: only members (and member appointments' blockers). */
export function filterBoard(data: BoardData, members: ReadonlySet<string>): BoardData {
  const is = matcher(members);
  const days = (list: BoardData['board']['days']) =>
    list.map((d) => ({
      ...d,
      rows: d.rows.filter((r) => is(r.itemKey)),
      blockers: d.blockers.filter((b) => !!b.ref && members.has(refKey(b.ref))),
      hints: [],
    }));
  return {
    ...data,
    board: {
      ...data.board,
      days: days(data.board.days),
      waiting: data.board.waiting.filter((w) => is(w.itemKey)),
      late: data.board.late.filter((r) => is(r.itemKey)),
      lateFolded: data.board.lateFolded.filter((r) => is(r.itemKey)),
      open: data.board.open.filter((r) => is(r.itemKey)),
    },
    ...(data.view ? { view: days(data.view) } : {}),
  };
}

/**
 * The week band's tiles while a topic is shown: each bar's fill is the topic's planned minutes (as the engine counts,
 * a fixed row charged against the whole day's appointments); `free`, `over` and the rest stay the whole day's.
 */
export function topicBand(
  shown: BoardData['board']['days'],
  whole: BoardData['board']['days'],
): BoardData['board']['days'] {
  return shown.map((d) => ({
    ...d,
    planned: plannedOf(d.rows, whole.find((x) => x.date === d.date)?.blockers ?? []),
  }));
}

export interface TopicView {
  /** The shown topic (id and title), or none. A topic gone elsewhere ends the filter (no toast). */
  filter: { id: string; title: string } | undefined;
  /** The members of the shown topic (`refKey`s). */
  members: ReadonlySet<string> | undefined;
  /** The last used topic (T12), when it still exists. */
  last: { id: string; title: string } | undefined;
  /** Whether any topic exists (T3 is offered only then). */
  any: boolean;
}

export function useTopicView(): TopicView {
  const state = useLiveQuery(async () => {
    const [filterId, lastId, count] = await Promise.all([
      getMeta<string | null>(TOPIC_FILTER_KEY),
      getMeta<string | null>(TOPIC_LAST_KEY),
      topicRepo.active().count(),
    ]);
    const [filter, last] = await Promise.all([
      filterId ? topicRepo.get(filterId) : undefined,
      lastId ? topicRepo.get(lastId) : undefined,
    ]);
    const members = filter ? await shownMembers(filter.id) : undefined;
    return {
      filter: filter ? { id: filter.id, title: filter.title } : undefined,
      last: last ? { id: last.id, title: last.title } : undefined,
      members,
      any: count > 0,
    };
  }, []);
  return useMemo(
    () => state ?? { filter: undefined, members: undefined, last: undefined, any: false },
    [state],
  );
}
