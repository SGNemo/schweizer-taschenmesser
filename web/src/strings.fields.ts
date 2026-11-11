import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the date and time fields and the detail panel of `@/ui` (Identity 4.0, package 0b-3). */
export const tFields = defineBundle(
  {
    pickDate: 'Kalender öffnen',
    invalidDate: 'Bitte ein Datum eingeben, zum Beispiel',
    invalidTime: 'Bitte eine Uhrzeit eingeben, zum Beispiel',
    /** Letters of the date placeholder ("TT.MM.JJJJ"). */
    letters: { day: 'T', month: 'M', year: 'J' },
    detail: 'Details',
    closeDetail: 'Details schließen',
    /** Head figure of a page without anything to count (the important part comes first). */
    nothingOpen: 'Nichts offen',
  },
  {
    en: {
      pickDate: 'Open calendar',
      invalidDate: 'Please enter a date, for example',
      invalidTime: 'Please enter a time, for example',
      letters: { day: 'D', month: 'M', year: 'Y' },
      detail: 'Details',
      closeDetail: 'Close details',
      nothingOpen: 'Nothing open',
    },
  },
);
