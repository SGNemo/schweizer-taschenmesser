/**
 * German texts of the Dev-Preview tooling (test data). Kept out of `strings.ts` on purpose: only
 * dev-only code imports this file, so stable builds contain none of it (`core/seed/devFlag.test.ts`).
 */
export const tDev = {
  title: 'Entwickler',
  intro:
    'Nur in der Dev-Preview. Testdaten sind erfunden, bleiben auf diesem Gerät (kein Sync, kein Backup) und lassen sich jederzeit wieder entfernen.',
  load: {
    scale: 'Umfang',
    small: 'Klein (zum Ausprobieren)',
    medium: 'Mittel (Standard)',
    large: 'Groß (Performance, ca. 5.000 Buchungen)',
    button: 'Testdaten laden',
    busy: (done: number, total: number) => `Lade … ${done} von ${total}`,
    done: (n: number) => `Testdaten geladen (${n} Einträge).`,
    error: 'Testdaten konnten nicht geladen werden.',
  },
  remove: {
    button: 'Testdaten entfernen',
    hint: 'Entfernt nur die erzeugten Testdaten, deine eigenen Daten bleiben.',
    done: (n: number) => `${n} Testeinträge entfernt.`,
  },
  reset: {
    title: 'Alles zurücksetzen',
    hint: 'Löscht die komplette lokale Datenbank dieses Geräts (auch eigene Daten, Einstellungen, Schlüssel). Tippe zur Bestätigung ZURÜCKSETZEN.',
    phrase: 'ZURÜCKSETZEN',
    field: 'Bestätigung',
    button: 'Alles zurücksetzen',
  },
  sync: {
    label: 'Seed-Sync erlauben',
    hint: 'Standard aus: Testdaten gelangen nicht auf den Sync-Server. Wenn du das einschaltest, werden sie wie echte Daten übertragen. Beim Entfernen werden sie dann auch auf dem Server gelöscht.',
  },
  status: {
    title: 'Stand',
    version: 'Seed-Version',
    reference: 'Referenzdatum',
    scale: 'Umfang',
    none: 'Keine Testdaten geladen.',
    entries: 'Einträge',
    demoVault: (phrase: string) =>
      `Demo-Tresor (Modul Accounts): Passphrase „${phrase}“. Ein vorhandener Tresor wird nie überschrieben.`,
  },
  banner: {
    text: 'Testdaten geladen, entfernen unter Einstellungen → Entwickler.',
    open: 'Zu den Einstellungen',
    dismiss: 'Verstanden',
    label: 'Hinweis zu Testdaten',
  },
  palette: {
    load: 'Testdaten laden',
    remove: 'Testdaten entfernen',
    loaded: 'Testdaten geladen.',
    removed: 'Testdaten entfernt.',
  },
} as const;
