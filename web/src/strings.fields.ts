import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the date and time fields and the detail panel of `@/ui` (Identity 4.0, package 0b-3). */
export const tFields = defineBundle(
  {
    pickDate: 'Kalender öffnen',
    invalidDate: 'Bitte ein Datum eingeben, zum Beispiel',
    invalidTime: 'Bitte eine Uhrzeit eingeben, zum Beispiel',
    /** A date field with a first allowed day (`DayField min`): the typed day lies before it. */
    tooEarly: (day: string) => `Frühestens am ${day}.`,
    /** Letters of the date placeholder ("TT.MM.JJJJ"). */
    letters: { day: 'T', month: 'M', year: 'J' },
    closeDetail: 'Details schließen',
  },
  {
    en: {
      pickDate: 'Open calendar',
      invalidDate: 'Please enter a date, for example',
      invalidTime: 'Please enter a time, for example',
      tooEarly: (day: string) => `No earlier than ${day}.`,
      letters: { day: 'D', month: 'M', year: 'Y' },
      closeDetail: 'Close details',
    },
  },
);
