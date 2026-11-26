/**
 * The appointment links of the rows (planner hub 2, package 9): which thing was made „vor“ / „nach“ which appointment
 * (`before` / `after` in the link store, written by the field's own action). One indexed read for all ToDo rows,
 * the appointments resolved through calendar's `linkTarget`. Display only: the chip A4 on the row and its place next to
 * the blocker in its day – never an input of a run, never a move.
 */
import { createContext, useContext, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { linksFrom } from '@/core/entitylinks';
import { refKey, type EntityRef } from '@/core/entitylinks/types';
import { useResolvedLinks, type PlannableEntry } from '@/core/modules/contributions';
import { t } from '@/strings';
import { itemKeyOf } from '../repo';

export interface AppointmentLink {
  rel: 'before' | 'after';
  /** The appointment (the event). */
  to: EntityRef;
  /** The occurrence's day the link was made for (`EntityLink.on`); absent = the whole event. */
  on?: string;
  /** A4 „vor Friseur“, or X3 when the appointment is gone. */
  text: string;
}

/** Which modules' things carry such links: what the field makes (ToDos). */
const FROM = 'todos';

export function useAppointmentLinks(
  entries: ReadonlyMap<string, Pick<PlannableEntry, 'moduleId' | 'id'>> | undefined,
): ReadonlyMap<string, AppointmentLink> {
  const refs = useMemo(
    () =>
      [
        ...new Set(
          [...(entries?.values() ?? [])].filter((e) => e.moduleId === FROM).map((e) => e.id),
        ),
      ]
        .sort()
        .map((id) => ({ module: FROM, id })),
    [entries],
  );
  const key = refs.map((r) => r.id).join('|');
  const links = useLiveQuery(() => linksFrom(refs, ['before', 'after']), [key]);
  const targets = useMemo(() => {
    const seen = new Map<string, EntityRef>();
    for (const l of links ?? []) seen.set(refKey(l.to), l.to);
    return [...seen.values()].sort((a, b) => refKey(a).localeCompare(refKey(b)));
  }, [links]);
  const states = useResolvedLinks(targets);
  return useMemo(() => {
    const out = new Map<string, AppointmentLink>();
    // One per thing: the same order on every device (relation, appointment, day).
    const sorted = [...(links ?? [])].sort((a, b) =>
      `${a.rel}|${refKey(a.to)}|${a.on ?? ''}`.localeCompare(
        `${b.rel}|${refKey(b.to)}|${b.on ?? ''}`,
      ),
    );
    for (const l of sorted) {
      const key = itemKeyOf(l.from.module, l.from.id);
      if (out.has(key) || (l.rel !== 'before' && l.rel !== 'after')) continue;
      const state = states?.get(refKey(l.to));
      const title = state?.state === 'alive' ? state.title : l.label;
      const a = t.planner.appointment;
      out.set(key, {
        rel: l.rel,
        to: l.to,
        ...(l.on ? { on: l.on } : {}),
        text:
          state?.state === 'gone'
            ? t.planner.panel.gone
            : (l.rel === 'before' ? a.rowBefore : a.rowAfter)(title),
      });
    }
    return out;
  }, [links, states]);
}

export const AppointmentLinks = createContext<ReadonlyMap<string, AppointmentLink>>(new Map());

export const useAppointmentLink = (itemKey: string): AppointmentLink | undefined =>
  useContext(AppointmentLinks).get(itemKey);
