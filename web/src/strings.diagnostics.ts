import { defineBundle } from '@/core/i18n/bundle';

/** Texts of diagnostics, bug report, error cards and recovery (German + English). */
export const tDiag = defineBundle(
  {
    title: 'Diagnose und Fehler melden',
    export: {
      label: 'Diagnose exportieren',
      description:
        'Zeigt zuerst genau, was in der Datei steht, und speichert sie erst nach deiner Bestätigung. Ohne Einträge, Tresor, Schlüssel, Server-Adressen und Pfade mit Benutzernamen. Die App sendet nichts.',
      previewTitle: 'Diagnose-Datei ansehen',
      previewHint: 'Das ist der komplette Inhalt der Datei. Prüfe ihn, bevor du speicherst.',
      save: 'Speichern',
      cancel: 'Schließen',
      saved: 'Diagnose gespeichert.',
      loading: 'Wird erstellt …',
    },
    report: {
      label: 'Fehler melden',
      description:
        'Öffnet ein vorausgefülltes GitHub-Formular im Browser. Hänge die Diagnose-Datei an, wenn du magst. Die App überträgt selbst nichts.',
      mail: 'Per Mail melden',
      mailSubject: 'Nemo: Fehlerbericht',
      mailIntro: 'Bitte beschreibe kurz das Problem und hänge die Diagnose-Datei an.',
      stepsPlaceholder:
        '1. …\n2. …\n(Bitte die Diagnose-Datei anhängen: Einstellungen → Über Nemo → Diagnose exportieren)',
      paletteCommand: 'Fehler melden',
      keywords: ['Bug', 'Problem', 'Diagnose', 'Fehlerbericht'],
    },
    card: {
      title: (name: string) => `${name} hat ein Problem`,
      body: 'Dieser Bereich konnte nicht angezeigt werden. Der Rest der App läuft weiter, deine Daten sind nicht betroffen.',
      retry: 'Erneut versuchen',
      disable: 'Modul deaktivieren',
      disabled: 'Modul deaktiviert. Du kannst es in den Einstellungen wieder einschalten.',
      report: 'Fehler melden',
    },
  },
  {
    title: 'Diagnostics and bug reports',
    export: {
      label: 'Export diagnostics',
      description:
        'Shows exactly what is in the file first and only saves it after you confirm. No entries, vault, keys, server addresses or paths with user names. The app sends nothing.',
      previewTitle: 'Review diagnostics file',
      previewHint: 'This is the complete content of the file. Check it before you save.',
      save: 'Save',
      cancel: 'Close',
      saved: 'Diagnostics saved.',
      loading: 'Preparing …',
    },
    report: {
      label: 'Report a bug',
      description:
        'Opens a prefilled GitHub form in your browser. Attach the diagnostics file if you like. The app transmits nothing itself.',
      mail: 'Report by e-mail',
      mailSubject: 'Nemo: bug report',
      mailIntro: 'Please describe the problem briefly and attach the diagnostics file.',
      stepsPlaceholder:
        '1. …\n2. …\n(Please attach the diagnostics file: Settings → About Nemo → Export diagnostics)',
      paletteCommand: 'Report a bug',
      keywords: ['Bug', 'Problem', 'Diagnostics', 'Report'],
    },
    card: {
      title: (name: string) => `${name} ran into a problem`,
      body: 'This area could not be shown. The rest of the app keeps running and your data is not affected.',
      retry: 'Try again',
      disable: 'Disable module',
      disabled: 'Module disabled. You can switch it back on in Settings.',
      report: 'Report a bug',
    },
  },
);
