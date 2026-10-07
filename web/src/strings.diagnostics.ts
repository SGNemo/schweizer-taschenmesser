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
    recovery: {
      title: 'Die Datenbank lässt sich nicht öffnen',
      intro:
        'Nemo konnte die lokalen Daten auf diesem Gerät nicht lesen. Es wurde nichts gelöscht. Bevor etwas verändert wird, sicherst du eine Kopie des defekten Stands.',
      details: 'Technische Angabe',
      repair: 'Datenbank reparieren',
      repairHint: 'Öffnet die Datenbank neu und leert nur Tabellen, die nicht lesbar sind.',
      repairDone: 'Repariert. Die App startet neu.',
      repairFailed:
        'Das ließ sich nicht reparieren. Spiele ein Backup ein oder starte neu mit leerer Datenbank.',
      restore: 'Backup einspielen',
      restoreHint:
        'Wähle eine Backup-Datei. Der defekte Stand wird vorher gesichert und dann ersetzt.',
      passphrase: 'Passwort der Backup-Datei',
      errors: {
        unreadable: 'Das ist keine Nemo-Backup-Datei.',
        'passphrase-required': 'Diese Datei ist verschlüsselt. Gib das Passwort ein.',
        'wrong-passphrase': 'Das Passwort passt nicht.',
        cancelled: 'Abgebrochen. Es wurde nichts verändert.',
        failed: 'Das Einspielen ist fehlgeschlagen.',
      },
      reset: 'Mit leerer Datenbank neu starten',
      resetHint:
        'Zuerst wird eine Kopie des defekten Stands gesichert. Danach beginnt Nemo ohne Daten.',
      resetTitle: 'Mit leerer Datenbank neu starten',
      resetWarning:
        'Alle lokalen Daten auf diesem Gerät werden ersetzt (die Kopie bleibt erhalten). Tippe zur Bestätigung NEU STARTEN.',
      resetPhrase: 'NEU STARTEN',
      resetConfirm: 'Neu starten',
      copyCancelled: 'Ohne gesicherte Kopie wird nichts verändert.',
      report: 'Fehler melden',
    },
    fatal: {
      title: 'Nemo ist auf ein Problem gestoßen',
      body: 'Die App konnte nicht weiterlaufen. Deine Daten wurden nicht verändert.',
      reload: 'Neu laden',
      safeMode: 'Im Sicheren Modus starten',
      safeHint: 'Startet mit allen Modulen aus. Beim nächsten normalen Start ist alles wieder da.',
    },
    safe: {
      banner: 'Sicherer Modus: Alle Module sind aus. Es wurde nichts verändert.',
      leave: 'Normal neu starten',
      leaveForced: 'Beende Nemo und starte es ohne --safe-mode.',
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
    recovery: {
      title: 'The database cannot be opened',
      intro:
        'Nemo could not read the local data on this device. Nothing has been deleted. Before anything is changed you keep a copy of the defective state.',
      details: 'Technical detail',
      repair: 'Repair database',
      repairHint: 'Reopens the database and only empties tables that cannot be read.',
      repairDone: 'Repaired. The app restarts.',
      repairFailed:
        'This could not be repaired. Restore a backup or start again with an empty database.',
      restore: 'Restore a backup',
      restoreHint: 'Choose a backup file. The defective state is saved first and then replaced.',
      passphrase: 'Password of the backup file',
      errors: {
        unreadable: 'This is not a Nemo backup file.',
        'passphrase-required': 'This file is encrypted. Enter the password.',
        'wrong-passphrase': 'The password does not match.',
        cancelled: 'Cancelled. Nothing was changed.',
        failed: 'Restoring failed.',
      },
      reset: 'Start again with an empty database',
      resetHint: 'A copy of the defective state is saved first. Then Nemo starts without data.',
      resetTitle: 'Start again with an empty database',
      resetWarning:
        'All local data on this device is replaced (the copy is kept). Type RESTART to confirm.',
      resetPhrase: 'RESTART',
      resetConfirm: 'Start again',
      copyCancelled: 'Nothing is changed without a saved copy.',
      report: 'Report a bug',
    },
    fatal: {
      title: 'Nemo ran into a problem',
      body: 'The app could not continue. Your data has not been changed.',
      reload: 'Reload',
      safeMode: 'Start in safe mode',
      safeHint: 'Starts with all modules off. The next normal start brings everything back.',
    },
    safe: {
      banner: 'Safe mode: all modules are off. Nothing was changed.',
      leave: 'Restart normally',
      leaveForced: 'Quit Nemo and start it without --safe-mode.',
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
