import type { AttentionSource } from '@/core/modules/types';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import calendarSource from './calendar';

/** The next appointment of today that has not started yet (accent). */
const source: AttentionSource = async ({ today }) => {
  const d = new Date(now());
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const items = await calendarSource({ from: today, to: today });
  const next = items
    .filter((i) => i.date === today && !i.allDay && i.time && i.time >= hhmm)
    .sort((a, b) => a.time!.localeCompare(b.time!))[0];
  return next
    ? [
        {
          id: 'calendar:next',
          tone: 'accent' as const,
          icon: 'calendar' as const,
          title: t.attention.eventNext(next.title),
          detail: t.attention.eventAt(next.time!),
          to: '/calendar',
          rank: 3,
        },
      ]
    : [];
};

export default source;
