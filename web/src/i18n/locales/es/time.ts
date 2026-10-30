import type { Strings } from '@/strings';

export const time: Strings['time'] = {
  weekdayAndDistance: (weekday: string, distance: string) => `${weekday}, ${distance}`,
  overdueSince: (days: number) => (days === 1 ? 'desde ayer' : `desde hace ${days} días`),
  atClock: (time: string) => `${time}`,
  startsFrom: (date: string, time: string) => `desde el ${date}, ${time}`,
};
