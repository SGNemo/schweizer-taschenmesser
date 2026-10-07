import type { Strings } from '@/strings';

export const connectors: Strings['connectors'] = {
  title: 'Verbindungen',
  intro:
    'Hole Termine und Vorschläge aus Diensten ein, die du schon nutzt. Alles wird nur gelesen.',
  statusLabel: 'Status',
  status: {
    disconnected: 'Nicht verbunden',
    connected: 'Verbunden',
    expired: 'Abgelaufen',
    'rate-limited': 'Pausiert',
    error: 'Fehler',
  } as Record<string, string>,
  lastSync: (when: string) => `Zuletzt abgeglichen: ${when}`,
  events: (n: number) => (n === 1 ? '1 Termin übernommen' : `${n} Termine übernommen`),
  connect: 'Verbinden',
  reconnect: 'Neu anmelden',
  cancelLogin: 'Anmeldung abbrechen',
  connecting: 'Warte auf die Anmeldung im Browser …',
  disconnect: 'Trennen',
  syncNow: 'Jetzt abgleichen',
  syncing: 'Wird abgeglichen …',
  syncDone: (added: number, updated: number, removed: number) =>
    `Fertig: ${added} neu, ${updated} geändert, ${removed} entfernt.`,
  desktopOnly:
    'Die Anmeldung funktioniert nur in der Windows-App. Auf dem Handy und im Browser kommen die Termine über die Synchronisierung oder über ein Kalender-Abo (ICS).',
  features: 'Was soll gelesen werden?',
  calendars: 'Kalender',
  calendarsHint: 'Nur die angehakten Kalender werden übernommen.',
  disconnectTitle: (name: string) => `${name} trennen?`,
  disconnectBody:
    'Der Zugriff wird beim Dienst widerrufen und die gespeicherten Anmeldedaten werden von diesem Gerät gelöscht.',
  keepData: 'Übernommene Termine behalten',
  deleteData: 'Übernommene Termine löschen',
  client: {
    title: 'Eigene Google-Anwendung',
    intro:
      'Für die Anmeldung brauchst du eine eigene „OAuth-Client-ID“ (Typ Desktop-App) aus der Google Cloud Console. Die Anleitung steht in der docs/MANUAL-TESTS.md unter „Anleitungen für Sven“.',
    id: 'Client-ID',
    secret: 'Client-Secret',
    secretHint: 'Google verlangt es auch bei Desktop-Apps; es gilt dort nicht als vertraulich.',
    save: 'Speichern',
    saved: 'Zugangsdaten gespeichert.',
    missing: 'Trage zuerst die Client-ID ein.',
  },
  scan: {
    title: 'E-Mails durchsuchen',
    intro:
      'Die App liest von den letzten Mails nur Absender, Betreff, Datum und die Vorschauzeile und sucht darin lokal nach Rechnungen, Abos, Terminen und Verträgen. Gespeichert wird erst, was du in der Vorschau bestätigst; der Mailtext selbst wird nie gespeichert und nie an eine KI geschickt.',
    period: 'Zeitraum',
    months: (n: number) => (n === 1 ? 'Letzter Monat' : `Letzte ${n} Monate`),
    start: 'Mails lesen',
    reading: (done: number, total: number) => `Es werden Mails gelesen … ${done} von ${total}`,
    summary: (n: number, months: number) =>
      `${n} Mails aus den letzten ${months === 1 ? 'Monat' : `${months} Monaten`} gelesen (Absender, Betreff, Datum, Vorschauzeile).`,
    notConnected:
      'Verbinde zuerst Google unter Einstellungen → Verbindungen und schalte „E-Mails“ ein.',
    none: 'In diesen Mails wurde nichts Passendes erkannt.',
  },
  ics: {
    listLabel: 'Kalender-Abos',
    name: 'Name (optional)',
    defaultName: (n: number) => `Kalender ${n}`,
    url: 'Adresse des Kalenders',
    urlHint:
      'z. B. bei Google Kalender: Einstellungen → Kalender → Integrieren → „Geheime Adresse im iCal-Format“. Gib sie nicht weiter.',
    add: 'Kalender hinzufügen',
    checking: 'Wird geprüft …',
    remove: (name: string) => `Kalender „${name}“ entfernen`,
    badUrl: 'Das ist keine gültige Adresse (https://… oder webcal://…).',
    notACalendar: 'Unter dieser Adresse liegt kein Kalender.',
    unreachable: 'Die Adresse ist nicht erreichbar.',
    noProxy:
      'Im Browser braucht das den Sync-Server (Einstellungen → Synchronisierung), weil Kalender-Dienste den Abruf aus dem Browser blockieren.',
  },
  google: {
    name: 'Google',
    description:
      'Kalender lesen und E-Mails nach Rechnungen, Abos, Terminen und Verträgen durchsuchen. Nur lesend.',
    calendarFeature: 'Kalender',
    calendarFeatureHint: 'Termine aus deinen Google-Kalendern anzeigen.',
    mailFeature: 'E-Mails',
    mailFeatureHint: 'Auf Knopfdruck nach Rechnungen, Abos, Terminen und Verträgen suchen.',
  },
};
