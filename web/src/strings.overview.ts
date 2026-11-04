import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the overview's head (identity v3): the greeting, every UI language. */
export const tOverview = defineBundle(
  {
    /** By the local hour: calm wording, no exclamation, no name; the night greeting is neutral. */
    greeting: { morning: 'Guten Morgen', day: 'Guten Tag', evening: 'Guten Abend', night: 'Hallo' },
    weatherAria: (text: string) => `Wetter: ${text}`,
  },
  {
    en: {
      greeting: {
        morning: 'Good morning',
        day: 'Good afternoon',
        evening: 'Good evening',
        night: 'Hello',
      },
      weatherAria: (text: string) => `Weather: ${text}`,
    },
    es: {
      greeting: {
        morning: 'Buenos días',
        day: 'Buenas tardes',
        evening: 'Buenas noches',
        night: 'Hola',
      },
      weatherAria: (text: string) => `Tiempo: ${text}`,
    },
    fr: {
      greeting: {
        morning: 'Bonjour',
        day: 'Bon après-midi',
        evening: 'Bonsoir',
        night: 'Bonsoir',
      },
      weatherAria: (text: string) => `Météo : ${text}`,
    },
    'pt-BR': {
      greeting: { morning: 'Bom dia', day: 'Boa tarde', evening: 'Boa noite', night: 'Olá' },
      weatherAria: (text: string) => `Clima: ${text}`,
    },
  },
);

export type DayPart = keyof ReturnType<typeof tOverview.get>['greeting'];

/** The part of the day of a local hour (0–23): 5–10 morning, 11–16 day, 17–21 evening, otherwise night. */
export const dayPart = (hour: number): DayPart =>
  hour >= 5 && hour < 11
    ? 'morning'
    : hour >= 11 && hour < 17
      ? 'day'
      : hour >= 17 && hour < 22
        ? 'evening'
        : 'night';
