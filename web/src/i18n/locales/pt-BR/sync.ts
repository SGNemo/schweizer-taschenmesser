import type { Strings } from '@/strings';

export const sync: Strings['sync'] = {
  title: 'Synchronisation',
  intro:
    'Optional: gleiche deine Daten über deinen eigenen Sync-Server ab (im LAN oder über Tailscale). Ohne Server bleibt alles lokal auf diesem Gerät.',
  serverUrl: 'Server-Adresse',
  serverUrlHint: 'z. B. https://mein-pc.tailnet.ts.net',
  token: 'Zugangstoken',
  deviceName: 'Gerätename',
  deviceNameHint: 'So erscheint dieses Gerät in der Geräteliste.',
  deviceNames: { desktop: 'Windows-App', android: 'Android-Handy', web: 'Browser' } as Record<
    string,
    string
  >,
  encrypt: 'Ende-zu-Ende-Verschlüsselung',
  encryptHint:
    'Werte werden auf dem Gerät verschlüsselt, der Server sieht nur Chiffretext. Nur auf einem leeren Server möglich.',
  plainWarning:
    'Ohne Ende-zu-Ende-Verschlüsselung liegen deine Daten auf dem Server im Klartext. Nutze sie, wenn der Server nicht nur dir gehört oder nicht verschlüsselt gespeichert wird.',
  passphrase: 'Passphrase',
  passphraseHint:
    'Mindestens 8 Zeichen. Ohne die Passphrase sind die Daten nicht wiederherstellbar.',
  passphraseJoinHint: 'Nur nötig, wenn der Server verschlüsselt ist.',
  connect: 'Verbinden',
  connecting: 'Verbinde …',
  connected: (host: string) => `Verbunden mit ${host}`,
  encryptedBadge: 'Verschlüsselt',
  plainBadge: 'Unverschlüsselt',
  lastSync: 'Zuletzt synchronisiert',
  never: 'noch nicht',
  pending: (n: number) =>
    n === 0 ? 'Alles gesendet' : n === 1 ? '1 Änderung wartet' : `${n} Änderungen warten`,
  syncNow: 'Jetzt synchronisieren',
  disconnect: 'Trennen',
  signOut: 'Dieses Gerät abmelden',
  signOutHint:
    'Sperrt das Token dieses Geräts auf dem Server und trennt es. Deine lokalen Daten bleiben erhalten.',
  disconnectHint: 'Deine lokalen Daten bleiben erhalten; der Server wird nicht verändert.',
  state: { off: 'Aus', idle: 'Synchronisiert', syncing: 'Synchronisiere …', error: 'Fehler' },
  badge: (state: string) => `Synchronisation: ${state}`,
  detailsTitle: 'Status',
  lastResult: (pulled: number, pushed: number) =>
    `Zuletzt: ${pulled} empfangen, ${pushed} gesendet`,
  rejected: (n: number) =>
    `${n} empfangene Änderungen konnten nicht entschlüsselt werden und wurden übersprungen.`,
  failuresInRow: (n: number) => (n === 1 ? '1 Fehlversuch' : `${n} Fehlversuche in Folge`),
  serverSize: 'Daten auf dem Server',
  serverSizeValue: (records: number, kb: number) =>
    `${records} Einträge, ${kb < 1024 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`}`,
  devicesTitle: 'Geräte',
  devicesIntro:
    'Alle Geräte, die mit diesem Server synchronisieren. Ein gesperrtes Gerät kann nicht mehr synchronisieren; seine bereits gesendeten Daten bleiben erhalten.',
  devicesUnsupported:
    'Dieser Server kennt keine Geräteverwaltung (ältere Version). Aktualisiere den Server, um Geräte zu sperren.',
  deviceThis: 'dieses Gerät',
  deviceLastSeen: (when: string) => `Zuletzt aktiv: ${when}`,
  deviceNever: 'noch nie',
  deviceRevoked: (when: string) => `Gesperrt am ${when}`,
  deviceStale: (days: number) =>
    `Seit ${days} Tagen nicht aktiv. Sperre es, wenn du es nicht mehr nutzt: Sehr alte Geräte können gelöschte Einträge zurückbringen.`,
  deviceLock: 'Sperren',
  deviceLockTitle: (name: string) => `„${name}“ sperren?`,
  deviceLockText:
    'Das Gerät kann danach nicht mehr synchronisieren. Bereits gesendete Daten bleiben auf dem Server. Zum erneuten Verbinden braucht das Gerät das Server-Token.',
  deviceLocked: 'Gerät gesperrt.',
  deviceLockFailed: 'Das Gerät konnte nicht gesperrt werden.',
  deviceId: (id: string) => `Geräte-ID: ${id}`,
  rotateToken: 'Token dieses Geräts erneuern',
  rotated: 'Token erneuert.',
  conflictsTitle: 'Konflikte',
  conflictsIntro:
    'Wenn zwei Geräte dasselbe Feld gleichzeitig geändert haben, gewinnt die neuere Änderung. Der überschriebene Wert steht hier und lässt sich wiederherstellen.',
  conflictsNone: 'Keine offenen Konflikte.',
  conflictKept: {
    remote: 'Die Änderung eines anderen Geräts hat deine überschrieben.',
    local: 'Deine Änderung hat die eines anderen Geräts überschrieben.',
  } as Record<string, string>,
  conflictLost: 'Überschrieben',
  conflictNow: 'Jetzt gilt',
  conflictEmpty: '(leer)',
  conflictDeleted: '(gelöscht)',
  conflictTooLarge: 'Wert zu groß zum Aufbewahren',
  conflictRestore: 'Wiederherstellen',
  conflictDismiss: 'Verwerfen',
  conflictDismissAll: 'Alle verwerfen',
  conflictRestored: 'Wert wiederhergestellt.',
  conflictOutcome: {
    'already-current': 'Der Wert gilt bereits.',
    'record-gone': 'Der Eintrag existiert nicht mehr.',
    'not-restorable': 'Dieser Wert lässt sich nicht wiederherstellen.',
  } as Record<string, string>,
  errors: {
    network: 'Server nicht erreichbar.',
    revoked:
      'Dieses Gerät wurde gesperrt. Trenne es und verbinde es neu, wenn du es wieder zulassen willst.',
    'rate-limited': 'Zu viele Anfragen oder Fehlversuche – es wird automatisch erneut versucht.',
    unauthorized: 'Der Server hat das Token abgelehnt.',
    server: 'Der Server hat einen Fehler gemeldet.',
    decrypt: 'Entschlüsselung fehlgeschlagen – stimmt die Passphrase?',
    'no-key':
      'Die Daten auf dem Server sind verschlüsselt. Bitte trennen und neu mit Passphrase verbinden.',
    unsupported: 'Nicht unterstützt.',
    unknown: 'Unbekannter Fehler.',
  } as Record<string, string>,
  failures: {
    'invalid-url': 'Bitte eine gültige Adresse mit http:// oder https:// eingeben.',
    unreachable:
      'Server nicht erreichbar. Wird die App per HTTPS geöffnet, muss auch der Server per HTTPS erreichbar sein (z. B. mit „tailscale serve“).',
    unauthorized: 'Das Token wurde abgelehnt.',
    'passphrase-required': 'Dieser Server ist verschlüsselt. Bitte die Passphrase eingeben.',
    'passphrase-too-short': 'Die Passphrase braucht mindestens 8 Zeichen.',
    'wrong-passphrase': 'Falsche Passphrase.',
    'server-has-plain-data':
      'Auf dem Server liegen bereits unverschlüsselte Daten. Verschlüsselung ist nur auf einem leeren Server möglich.',
    revoked: 'Dieses Gerät ist auf dem Server gesperrt.',
    'rate-limited': 'Zu viele Fehlversuche. Bitte in einer Minute erneut versuchen.',
    'vault-outdated':
      'Der Server nutzt noch das alte Verschlüsselungsformat. Setze den Server zurück, um es neu aufzubauen.',
    'server-error': 'Der Server hat einen Fehler gemeldet.',
  } as Record<string, string>,
  resetServer: 'Server zurücksetzen und verschlüsselt neu aufbauen',
  resetTitle: 'Server zurücksetzen?',
  resetText:
    'Alle Daten auf dem Server werden gelöscht. Deine lokalen Daten bleiben erhalten und werden erneut hochgeladen; andere Geräte laden ihre Daten beim nächsten Sync ebenfalls wieder hoch.',
  resetConfirm: 'Zurücksetzen',
};
