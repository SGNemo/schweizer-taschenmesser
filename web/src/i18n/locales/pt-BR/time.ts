import type { Strings } from '@/strings';

export const time: Strings['time'] = {
  weekdayAndDistance: (weekday: string, distance: string) => `${weekday}, ${distance}`,
  overdueSince: (days: number) => (days === 1 ? 'desde ontem' : `há ${days} dias`),
  atClock: (time: string) => `${time}`,
  startsFrom: (date: string, time: string) => `a partir de ${date}, ${time}`,
};
