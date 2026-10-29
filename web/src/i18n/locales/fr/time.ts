import type { Strings } from '@/strings';

export const time: Strings['time'] = {
  weekdayAndDistance: (weekday: string, distance: string) => `${weekday}, ${distance}`,
  overdueSince: (days: number) => (days === 1 ? 'depuis hier' : `depuis ${days} jours`),
  atClock: (time: string) => `${time}`,
  startsFrom: (date: string, time: string) => `à partir du ${date}, ${time}`,
};
