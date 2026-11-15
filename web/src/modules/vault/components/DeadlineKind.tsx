import { daysBetween } from '@/core/time/dates';
import { t } from '@/strings';
import { Badge } from '@/ui';
import type { DateKind, Status } from '../logic';

/**
 * What a document's next date is, in words: the one vocabulary of "Fristen" and "Ablage". What is near or over
 * says so in its own words on a badge (never by the colour alone); a deadline within a week says the day
 * ("endet in 3 Tagen"). The tone says "have a look" (warning, accent for a deadline this week), never "you
 * failed": no red. The words name the deadline, not an order to cancel.
 */
export function DeadlineKind({
  state,
  kind,
  date,
  day,
  folder = false,
}: {
  state: Status;
  /** What `date` is: the last day to cancel, or the end. */
  kind: DateKind;
  date: string;
  day: string;
  /**
   * On a folder of "Ablage": nothing while the date is far away, and nothing for a passed deadline (the folder's
   * small print says "Frist vorbei am …"). The rail names every date.
   */
  folder?: boolean;
}) {
  const k = t.vault.timeline.kinds;
  if (state === 'expired') return <Badge tone="warning">{k.expired}</Badge>;
  if (state === 'missed') return folder ? null : <>{k.missed}</>;
  if (state === 'act-now') return <Badge tone="accent">{k.cancelIn(daysBetween(day, date))}</Badge>;
  if (state === 'soon')
    return <Badge tone="warning">{kind === 'cancel' ? k.cancelSoon : k.endSoon}</Badge>;
  return folder ? null : <>{kind === 'cancel' ? k.cancel : k.end}</>;
}
