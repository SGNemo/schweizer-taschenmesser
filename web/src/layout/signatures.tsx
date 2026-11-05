import type { ComponentType } from 'react';
import { useCalendarItems } from '@/core/modules/contributions';
import type { SignatureId, SlotSize } from '@/core/modules/types';
import { dateTimeFormat } from '@/core/i18n/format';
import { formatDay, nowTime } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { tIdentity } from '@/strings.identity';
import { DayBlock, HourStrip, Signature } from '@/ui/identity';
import styles from './signatures.module.css';

/**
 * Today as the calendar's signature (`calendarLeaf`, slot L): the day number large, month, weekday and week, and
 * the hours of today filled where an appointment (any module's calendar contribution) lies. The one signature that
 * reads app data, so it lives in the shell, not in `@/ui/identity`.
 */
function TodayLeaf() {
  const day = today();
  const date = new Date(`${day}T12:00:00`);
  const items = useCalendarItems({ from: day, to: day });
  const timed = (items ?? []).filter((i) => !i.allDay && !i.done && !!i.time);
  return (
    <div className={styles.todayLeaf}>
      <DayBlock
        day={String(date.getDate())}
        month={dateTimeFormat({ month: 'long' }).format(date)}
        weekday={dateTimeFormat({ weekday: 'long' }).format(date)}
        week={tIdentity.get().head.week(formatDay(day, 'II'))}
      />
      <HourStrip
        events={timed.map((i) => ({ time: i.time!, endTime: i.endTime }))}
        now={nowTime()}
      />
    </div>
  );
}

/**
 * What the frame draws in the signature slot for each id while the page has not filled it (C08): the library's
 * block or mark for every id, and the data-aware leaf for the calendar.
 */
export const HEAD_SIGNATURES: Partial<Record<SignatureId, ComponentType<{ size: SlotSize }>>> = {
  calendarLeaf: TodayLeaf,
};

export function DefaultSignature({ id, size }: { id: SignatureId; size: SlotSize }) {
  const Own = HEAD_SIGNATURES[id];
  return Own ? <Own size={size} /> : <Signature id={id} size={size} />;
}
