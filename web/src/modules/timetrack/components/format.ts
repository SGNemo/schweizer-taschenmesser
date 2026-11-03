import { t } from '@/strings';

/** `3 Std 5 Min` / `45 Min` – the duration of a number of minutes, in the user's language. */
export const duration = (minutes: number): string =>
  t.timetrack.dur(Math.floor(minutes / 60), minutes % 60);
