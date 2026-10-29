import type { Strings } from '@/strings';

export const time: Strings['time'] = {
  weekdayAndDistance: (weekday: string, distance: string) => `${weekday}, ${distance}`,
  overdueSince: (days: number) => (days === 1 ? 'overdue since yesterday' : `${days} days overdue`),
  atClock: (time: string) => `${time}`,
  startsFrom: (date: string, time: string) => `from ${date}, ${time}`,
};
