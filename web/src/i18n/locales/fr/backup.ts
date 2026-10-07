import type { Strings } from '@/strings';

export const backup: Strings['backup'] = {
  title: 'Backup',
  intro:
    'Sichere alle Daten als Datei oder spiele ein Backup wieder ein. Zugangsdaten (Sync-Token, Schlüssel) sind nie im Backup enthalten.',
  export: 'Backup herunterladen',
  exported: 'Backup heruntergeladen.',
  file: 'Backup-Datei',
  mode: 'Wiederherstellung',
  merge: 'Zusammenführen',
  mergeHint: 'Es geht nichts verloren; bei Konflikten gewinnt die jeweils neuere Änderung.',
  replace: 'Ersetzen',
  replaceHint: 'Das Backup wird zum Stand: Einträge, die nicht im Backup sind, werden gelöscht.',
  doImport: 'Importieren',
  contains: (records: number, tables: number) => `${records} Einträge in ${tables} Tabellen`,
  confirmTitle: 'Backup ersetzen?',
  confirmText:
    'Alle Einträge, die nicht im Backup stehen, werden gelöscht – auch auf anderen Geräten, sobald sie synchronisieren.',
  done: (records: number, removed: number) =>
    removed > 0
      ? `${records} Einträge wiederhergestellt, ${removed} entfernt.`
      : `${records} Einträge wiederhergestellt.`,
  encryptedExport: 'Verschlüsselt exportieren',
  encryptedExported: 'Verschlüsseltes Backup heruntergeladen.',
  exportHint:
    'Empfohlen: verschlüsselt exportieren (Argon2id, AES-256). Das normale Backup enthält alle Einträge im Klartext.',
  exportPassphrase: 'Passwort für das Backup',
  exportPassphraseHint:
    'Mindestens 8 Zeichen. Ohne dieses Passwort lässt sich das Backup nicht öffnen – es gibt keine Rücksetzung.',
  passphraseTooShort: 'Das Passwort braucht mindestens 8 Zeichen.',
  openPassphrase: 'Passwort des Backups',
  unlock: 'Öffnen',
  verify: 'Backup prüfen',
  verifyHint:
    'Prüft die Datei und spielt sie zur Probe in eine temporäre Datenbank ein. Deine Daten bleiben unberührt.',
  verifying: 'Prüfe …',
  verifyOk: 'Das Backup ist in Ordnung und lässt sich wiederherstellen.',
  verifyFailed: 'Das Backup ist nicht in Ordnung.',
  verifyExported: (when: string) => `Erstellt am ${when}`,
  verifyTotals: (records: number, tombstones: number) =>
    `${records} Einträge, ${tombstones} gelöschte Markierungen`,
  skippedOnRestore: (n: number) =>
    n === 1
      ? '1 Tabelle der Datei kennt diese App-Version nicht mehr (z. B. alte Module wie Einkauf, Packlisten oder Habits) und wird nicht wiederhergestellt.'
      : `${n} Tabellen der Datei kennt diese App-Version nicht mehr (z. B. alte Module wie Einkauf, Packlisten oder Habits) und werden nicht wiederhergestellt.`,
  verifySkipped: (n: number) =>
    `${n} Tabellen stammen aus einer anderen App-Version und werden übersprungen.`,
  steps: {
    format: 'Dateiformat',
    checksum: 'Prüfsumme (SHA-256)',
    decrypt: 'Entschlüsselung',
    structure: 'Inhalt gültig',
    restore: 'Probe-Wiederherstellung',
    counts: 'Anzahl je Modul stimmt',
  } as Record<string, string>,
  stepStatus: { ok: 'ok', failed: 'Fehler', skipped: '–' } as Record<string, string>,
  core: 'Einstellungen',
  previewTitle: 'Das passiert bei der Wiederherstellung',
  previewRow: (module: string, added: number, replaced: number, removed: number) =>
    `${module}: ${added} neu, ${replaced} ersetzt${removed > 0 ? `, ${removed} gelöscht` : ''}`,
  previewTotals: (added: number, replaced: number, removed: number) =>
    `Gesamt: ${added} kommen dazu, ${replaced} werden ersetzt, ${removed} werden gelöscht.`,
  previewNothing: 'Es ändert sich nichts.',
  safetyNote:
    'Vorher legt die App automatisch eine Sicherheitskopie deiner aktuellen Daten an. Bricht etwas ab, bleibt alles unverändert.',
  restoring: 'Stelle wieder her …',
  autoTitle: 'Automatische Backups',
  autoIntro:
    'Die App sichert regelmäßig verschlüsselt in ihren Datenordner und behält die neuesten Kopien. Das Passwort liegt im Schlüsselspeicher des Geräts.',
  autoUnsupported: 'Automatische Backups gibt es nur in der installierten App (Windows, Android).',
  autoEnable: 'Automatisch sichern',
  autoInterval: 'Rhythmus',
  autoDaily: 'Täglich',
  autoWeekly: 'Wöchentlich',
  autoKeep: 'Anzahl Kopien',
  autoPassphrase: 'Passwort für automatische Backups',
  autoPassphraseSet: 'Passwort gespeichert. Neues Passwort eingeben, um es zu ersetzen.',
  autoPassphraseHint:
    'Mindestens 8 Zeichen. Notiere es dir: Ohne das Passwort lassen sich die Kopien nicht öffnen.',
  autoSavePassphrase: 'Passwort speichern',
  autoRunNow: 'Jetzt sichern',
  autoLast: 'Letztes Backup',
  autoNever: 'noch keins',
  autoLastFailed: 'Das letzte Backup ist fehlgeschlagen.',
  autoNeedPassphrase: 'Lege zuerst ein Passwort fest.',
  autoCreated: 'Backup angelegt.',
  autoFiles: 'Vorhandene Kopien',
  autoNoFiles: 'Noch keine Kopien.',
  autoUse: 'Öffnen',
  autoSaveAs: 'Speichern unter …',
  errors: {
    'not-json': 'Die Datei ist keine gültige JSON-Datei.',
    'wrong-format': 'Das ist keine Nemo-Backup-Datei.',
    'newer-version': 'Das Backup stammt aus einer neueren App-Version.',
    invalid: 'Die Backup-Datei ist beschädigt.',
    'passphrase-required': 'Dieses Backup ist verschlüsselt. Gib das Passwort ein.',
    'wrong-passphrase': 'Falsches Passwort – oder die Datei wurde verändert.',
    'checksum-mismatch': 'Die Prüfsumme stimmt nicht: Die Datei ist beschädigt oder unvollständig.',
    'restore-failed': 'Die Probe-Wiederherstellung ist fehlgeschlagen.',
    'count-mismatch': 'Nach der Probe-Wiederherstellung fehlen Einträge.',
    'safety-failed': 'Die Sicherheitskopie konnte nicht angelegt werden. Es wurde nichts geändert.',
    'safety-cancelled':
      'Ohne Sicherheitskopie wird nicht wiederhergestellt. Es wurde nichts geändert.',
    'restore-error': 'Die Wiederherstellung ist fehlgeschlagen. Es wurde nichts geändert.',
  } as Record<string, string>,
};
