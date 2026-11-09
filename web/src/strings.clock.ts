import { defineBundle } from '@/core/i18n/bundle';

/** Texts of the clock next to the logo (sidebar head, phone top bar) and its setting. */
export const tClock = defineBundle(
  {
    /** Accessible name of the `<time>` element. */
    label: 'Uhrzeit',
    /** Name of the link while the Uhr module is on: "Uhr öffnen, 14:07". */
    open: (time: string) => `Uhr öffnen, ${time}`,
    setting: 'Uhrzeit neben dem Logo',
    settingHint:
      'Zeigt die Uhrzeit oben links neben dem Nemo-Logo, auch wenn die Taskleiste verdeckt ist. Nur auf diesem Gerät.',
  },
  {
    en: {
      label: 'Time',
      open: (time: string) => `Open clock, ${time}`,
      setting: 'Time next to the logo',
      settingHint:
        'Shows the time at the top left next to the Nemo logo, even when the taskbar is covered. This device only.',
    },
  },
);
