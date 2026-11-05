import { notDeleted } from '@/core/db/repo';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { t } from '@/strings';
import { today } from '@/core/time/dates';
import { tDeadline } from '@/strings.deadline';
import { cancelDeadline, endOf } from './logic';
import { documentRepo } from './repo';

/** Which end wording a category takes (see `t.vault.endsOn`): one calendar entry per day and wording. */
const endKind = (category: string) =>
  category === 'warranty'
    ? 'warranty'
    : category === 'contract' || category === 'insurance'
      ? 'contract'
      : 'other';

/**
 * The ends of documents/terms/warranties and, where there is a notice period, the cancellation deadlines – as counts
 * per day ("Vertragsende: 2 Unterlagen"), never a document title: the same items feed the overview agenda, which
 * promises no title on the overview (C04). The titles are one tap away in the module.
 */
const source: CalendarSource = async (range) => {
  const all = (await documentRepo.table.filter(notDeleted).toArray()).filter((d) => endOf(d));
  const inRange = (d: string | undefined): d is string => !!d && d >= range.from && d <= range.to;
  const groups = new Map<
    string,
    { date: string; kind: string; label: (n: string) => string; n: number; doc: string }
  >();
  const add = (
    key: string,
    date: string,
    kind: string,
    doc: string,
    label: (n: string) => string,
  ) => {
    const g = groups.get(key);
    if (g) g.n += 1;
    else groups.set(key, { date, kind, label, n: 1, doc });
  };
  for (const d of all) {
    const end = endOf(d);
    if (inRange(end)) {
      const k = endKind(d.category);
      add(`${end}:end:${k}`, end, 'end', d.id, (n) => t.vault.endsOn(n, d.category));
    }
    const deadline = cancelDeadline(d);
    if (inRange(deadline)) {
      const missed = deadline < today() && !!end && end >= today();
      add(`${deadline}:cancel:${missed ? 'missed' : 'open'}`, deadline, 'cancel', d.id, (n) =>
        missed ? tDeadline.get().missedCalendar(n) : t.vault.cancelBy(n),
      );
    }
  }
  return [...groups.entries()].map(([id, g]): CalendarItem => ({
    id,
    source: 'vault',
    kind: g.kind,
    title: g.label(t.vault.docCount(g.n)),
    date: g.date,
    allDay: true,
    // One document: straight to it; several: the list.
    to: g.n === 1 ? `/vault?open=${g.doc}` : '/vault',
  }));
};

export default source;
