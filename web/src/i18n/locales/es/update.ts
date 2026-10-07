import type { Strings } from '@/strings';

export const update: Strings['update'] = {
  title: 'App-Updates',
  available: (version: string) => `Update verfügbar (v${version})`,
  beta: 'Beta',
  whatsNew: 'Was ist neu?',
  updateNow: 'Jetzt aktualisieren',
  later: 'Später',
  backingUp: 'Sicherungskopie deiner Daten wird angelegt …',
  downloading: 'Update wird heruntergeladen …',
  downloadingPercent: (pct: number) => `Update wird heruntergeladen … ${pct} %`,
  handover: 'Fast fertig – die App startet gleich neu bzw. Android öffnet die Installation.',
  needsPermission:
    'Android braucht noch deine Erlaubnis, Apps aus dieser Quelle zu installieren. Aktiviere den Schalter in den Einstellungen und tippe danach erneut auf „Jetzt aktualisieren“.',
  retry: 'Erneut versuchen',
  errors: {
    'check-failed': 'Die Suche nach Updates ist fehlgeschlagen. Bist du online?',
    'backup-failed':
      'Die Sicherungskopie konnte nicht angelegt werden – das Update wurde deshalb nicht gestartet.',
    'install-failed': 'Das Update konnte nicht installiert werden.',
    'folder-not-writable':
      'Die Programmdatei liegt in einem Ordner, in den die App nicht schreiben darf (schreibgeschützt oder ohne Berechtigung). Verschiebe die Programmdatei in einen normalen Ordner, z. B. in deinen Benutzerordner, und versuche es erneut.',
    'signature-invalid':
      'Die Signatur des Updates ist ungültig – es wurde deshalb nicht installiert.',
  } as Record<string, string>,
  settings: {
    intro:
      'Die installierte App prüft auf GitHub, ob es eine neue Version gibt. Vor jedem Update legt sie automatisch eine Sicherungskopie deiner Daten an.',
    version: 'Installierte Version',
    channel: 'Update-Kanal',
    channelStable: 'Stabil',
    channelBeta: 'Beta (auch Vorabversionen)',
    auto: 'Automatisch nach Updates suchen',
    autoHint: 'Höchstens einmal täglich, beim Start der App.',
    checkNow: 'Jetzt prüfen',
    checking: 'Suche nach Updates …',
    upToDate: 'Du hast die neueste Version.',
    browserHint:
      'Im Browser aktualisiert sich die App selbst (Hinweis oben nach dem Laden einer neuen Version).',
    channelDev: 'Dev-Preview (jeder Stand von develop)',
    devHelp:
      'Dev-Previews sind ungetestete Zwischenstände. Diese App ist getrennt von der stabilen Nemo-App und hat eigene Daten: Übertrage Daten per Sync oder Backup. Vor jedem Update wird automatisch eine Sicherungskopie angelegt. Zurück zur stabilen Version geht nur durch Installieren der stabilen App.',
    devVersion: (version: string, sha: string) => `Dev-Preview ${version}${sha ? ` (${sha})` : ''}`,
  },
};
