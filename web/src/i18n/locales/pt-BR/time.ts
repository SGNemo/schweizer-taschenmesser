import type { Strings } from '@/strings';

export const time: Strings['time'] = {
  weekdayAndDistance: (weekday: string, distance: string) => `${weekday}, ${distance}`,
  overdueOn: (day: string) => `venceu em ${day}`,
  atClock: (time: string) => `${time}`,
  startsFrom: (date: string, time: string) => `a partir de ${date}, ${time}`,
  duration: (h: number, m: number) => (h > 0 ? `${h} h ${m} min` : `${m} min`),
  durationCompact: (h: number, m: number) =>
    h > 0 ? (m > 0 ? `${h} h ${m}` : `${h} h`) : `${m} min`,
};
