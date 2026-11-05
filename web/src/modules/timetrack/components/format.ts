import { formatMinutes } from '@/core/i18n/format';

/** `3 Std 5 Min` / `45 Min` – the duration of a number of minutes, in the user's language (the long form of `formatMinutes`). */
export const duration = (minutes: number): string => formatMinutes(minutes);
