import type { Strings } from '@/strings';

export const localApi: Strings['localApi'] = {
  title: 'KI-Zugriff',
  intro:
    'Eine lokale Schnittstelle, über die eine KI auf diesem Computer (z. B. Claude Code, Claude Desktop) Daten in deine Module schreiben und – wenn du es erlaubst – lesen kann. Sie ist nur von diesem Computer aus erreichbar.',
  unsupported:
    'Die Schnittstelle gibt es nur in der Windows-App. Im Browser und auf Android nutzt du „JSON einfügen“ unter Startdaten.',
  enable: 'Lokale Schnittstelle aktivieren',
  enableHint: 'Standardmäßig aus',
  port: 'Port',
  portHint: 'Zwischen 1024 und 65535. Standard: 47631.',
  portInvalid: 'Bitte einen Port zwischen 1024 und 65535 angeben.',
  applyPort: 'Port übernehmen',
  statusLabel: 'Status',
  status: {
    off: 'Aus',
    starting: 'Wird gestartet …',
    running: (port: number) => `Läuft auf http://127.0.0.1:${port}`,
    unsupported: 'Nicht verfügbar',
  } as Record<string, string | ((port: number) => string)>,
  startErrors: {
    'port-in-use': 'Der Port ist schon belegt. Wähle einen anderen.',
    'port-denied': 'Dieser Port darf nicht benutzt werden. Wähle einen anderen.',
    'listen-failed': 'Die Schnittstelle konnte nicht gestartet werden.',
  } as Record<string, string>,
  copyPrompt: 'Anleitung für KI kopieren',
  copyPromptHint:
    'Fertiger Text für dein KI-Werkzeug (Adresse, Ablauf, Regeln) – ohne Schlüssel und ohne deine Daten. Mehr in docs/AI-IMPORT.md.',
  promptCopied: 'Anleitung kopiert. Den Schlüssel gibst du der KI getrennt.',
  tokens: 'Zugänge',
  noTokens: 'Noch kein Zugang angelegt. Ohne Zugang ist nichts erreichbar.',
  newToken: 'Zugang anlegen',
  tokenName: 'Name',
  tokenNameHint: 'Wofür? Zum Beispiel „Claude Code“.',
  expiry: 'Gültig',
  expiryDays: (n: number) => (n === 365 ? '1 Jahr' : `${n} Tage`),
  expiryNever: 'Unbegrenzt',
  rights: 'Rechte pro Modul',
  rightsHint:
    'Standard ist: nichts. „Lesen“ zeigt der KI deine Einträge – was sie liest, verarbeitet ihr Anbieter.',
  read: 'Lesen',
  write: 'Schreiben',
  noModules: 'Kein passendes Modul eingeschaltet.',
  autoCommit: 'Automatisch übernehmen',
  autoCommitWarning:
    'Achtung: Importe dieses Zugangs werden ohne deine Bestätigung gespeichert. Rückgängig machen bleibt möglich.',
  create: 'Anlegen',
  nameMissing: 'Bitte einen Namen angeben.',
  rightsMissing: 'Bitte mindestens ein Recht vergeben.',
  shownOnce: 'Dein neuer Zugangsschlüssel – er wird nur jetzt angezeigt:',
  shownOnceHint:
    'Trage ihn in dein KI-Werkzeug ein (als Bearer-Token). Die App speichert nur eine Prüfsumme; verlierst du ihn, lege einen neuen an.',
  copy: 'Kopieren',
  copied: 'Kopiert. Die Zwischenablage wird nach einer Minute geleert.',
  done: 'Fertig',
  revoke: 'Widerrufen',
  revokeConfirm: (name: string) =>
    `Zugang „${name}“ widerrufen? Die KI kann sich damit sofort nicht mehr anmelden.`,
  revoked: 'Zugang widerrufen.',
  renew: 'Neu erzeugen',
  renewConfirm: (name: string) =>
    `Für „${name}“ einen neuen Schlüssel erzeugen? Der alte gilt sofort nicht mehr.`,
  created: (date: string) => `Angelegt ${date}`,
  expires: (date: string) => `gültig bis ${date}`,
  expired: 'Abgelaufen',
  never: 'unbegrenzt gültig',
  lastUsed: (date: string) => `zuletzt benutzt ${date}`,
  unused: 'noch nie benutzt',
  rightsSummary: (read: boolean, write: boolean) =>
    [read ? 'lesen' : '', write ? 'schreiben' : ''].filter(Boolean).join(' + '),
  imports: 'Importe über die Schnittstelle',
  noImports: 'Noch keine.',
  importState: {
    pending: 'wartet auf Bestätigung',
    committed: (n: number) => (n === 1 ? '1 Eintrag übernommen' : `${n} Einträge übernommen`),
    rejected: 'abgelehnt',
    undone: 'rückgängig gemacht',
  },
  log: 'Letzte Zugriffe',
  noLog: 'Noch keine Zugriffe.',
  clearLog: 'Liste leeren',
  errors: {
    disabled: 'Die Schnittstelle ist ausgeschaltet.',
    'token-invalid': 'Der Zugang ist ungültig, abgelaufen oder widerrufen.',
    'not-found': 'Diese Adresse gibt es nicht.',
    'unknown-module': 'Dieses Modul gibt es nicht oder der Zugang hat keine Rechte dafür.',
    forbidden: 'Für diese Aktion fehlt dem Zugang das Recht.',
    'bad-collection': 'Bitte eine gültige Sammlung (collection) angeben.',
    'bad-limit': 'limit muss eine ganze Zahl von 1 bis 200 sein.',
    'bad-cursor': 'Ungültiger cursor.',
    'bad-query': 'Suchtext zu lang.',
    'bad-body': 'Der Inhalt ist kein gültiger Import.',
    'unknown-batch': 'Diesen Import gibt es nicht (oder er gehört zu einem anderen Zugang).',
    'not-pending': 'Der Import wartet nicht mehr auf Bestätigung.',
    'confirmation-required':
      'Dieser Import muss in der App bestätigt werden (Zugang ohne „Automatisch übernehmen“ oder er ändert vorhandene Einträge).',
    'too-many-pending':
      'Zu viele Importe warten auf Bestätigung. Bitte zuerst in der App bestätigen oder ablehnen.',
    'idempotency-conflict':
      'Dieser Idempotency-Key wurde schon für einen anderen Inhalt verwendet.',
    internal: 'Interner Fehler.',
  } as Record<string, string>,
  pendingText:
    'Der Import wartet auf Bestätigung in der App. Der Nutzer sieht eine Vorschau und entscheidet je Eintrag.',
};
