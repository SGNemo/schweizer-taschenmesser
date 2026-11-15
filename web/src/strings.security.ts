import { defineBundle } from '@/core/i18n/bundle';

/**
 * Texts of the Sicherheit tab's own sections (settings round "Tiefe & Politur"): protection on this
 * device, who has access, the vault's clipboard time. Next to the feature instead of in `strings.ts`
 * (a hotspot). German and English only (es/fr/pt-BR are frozen).
 */
export const tSecurity = defineBundle(
  {
    cat: {
      title: 'Sicherheit',
      description: 'App-Sperre, Bildschirmschutz, Backups, Zugriffe, Tresor',
      keywords: [
        'Passwort',
        'Sperre',
        'Biometrie',
        'Auto-Lock',
        'Datenschutz',
        'Privatsphäre',
        'Screenshot',
        'Zugriff',
        'Geräte',
      ],
    },
    protect: {
      title: 'Schutz auf diesem Gerät',
      keywords: ['Backup', 'Verschlüsselung', 'Fehlerbericht', 'Diagnose'],
      screenKeywords: ['Bildschirmschutz', 'Screenshot', 'App-Wechsler'],
      screen: 'Bildschirmschutz',
      screenHint: 'Verhindert Screenshots und verbirgt Nemo in der Liste der offenen Apps',
      screenVault: 'Nur im Tresor',
      screenEverywhere: 'In der ganzen App',
      encryptedOnly: 'Nur verschlüsselte Backups',
      encryptedOnlyHint: 'Backups verlassen dieses Gerät nur mit Passwort',
      encryptedOnlyHelp:
        'Ein unverschlüsseltes Backup kann jeder lesen, der die Datei bekommt. Ist das an, bietet Nemo nur noch den verschlüsselten Export an.',
      report: 'Fehlerbericht ansehen',
      reportHint: 'Zeigt Wort für Wort, was ein Bericht enthält, bevor er gespeichert wird',
      reportOpen: 'Ansehen',
    },
    access: {
      title: 'Zugriff auf dieses Gerät',
      description: 'Wer und was gerade mit Nemo verbunden ist',
      keywords: [
        'Geräte',
        'Sitzungen',
        'gekoppelt',
        'Kopplung',
        'entfernen',
        'Zugänge',
        'Token',
        'Fernsteuerung',
      ],
      hint: 'Jede Zeile führt zur Stelle, an der du den Zugriff beendest. Hier wird nichts geändert.',
      manage: 'Verwalten',
      manageAria: (what: string) => `${what} verwalten`,
      sync: 'Sync',
      lan: 'Gekoppelte Geräte im Heimnetz',
      remote: 'Fernsteuerung',
      localApi: 'Lokale API',
      extension: 'Browser-Erweiterung',
      share: 'Teilen-Paare',
      off: 'Aus',
      none: 'Keine',
      devices: (n: number) => (n === 1 ? '1 Gerät' : `${n} Geräte`),
      remoteOn: (n: number) =>
        n === 1 ? 'An · 1 Gerät darf steuern' : `An · ${n} Geräte dürfen steuern`,
      tokens: (n: number) => (n === 1 ? 'An · 1 Zugang' : `An · ${n} Zugänge`),
      browsers: (n: number) =>
        n === 1 ? '1 Erweiterung gekoppelt' : `${n} Erweiterungen gekoppelt`,
      pairs: (n: number) => (n === 1 ? '1 Paar' : `${n} Paare`),
      loading: 'Wird gelesen …',
    },
    clipboard: {
      label: 'Kopiertes aus der Zwischenablage löschen',
      help: 'So lange bleibt ein kopiertes Passwort oder ein Code in der Zwischenablage. Hast du inzwischen etwas anderes kopiert, bleibt das unberührt.',
      s10: 'Nach 10 Sekunden',
      s30: 'Nach 30 Sekunden',
      s60: 'Nach 1 Minute',
      s120: 'Nach 2 Minuten',
      copied: (what: string, seconds: number) =>
        seconds < 60
          ? `${what} kopiert – wird nach ${seconds} s aus der Zwischenablage gelöscht.`
          : `${what} kopiert – wird nach ${seconds / 60} min aus der Zwischenablage gelöscht.`,
    },
  },
  {
    en: {
      cat: {
        title: 'Security',
        description: 'App lock, screen guard, backups, access, vault',
        keywords: [
          'Password',
          'Lock',
          'Biometrics',
          'Auto-lock',
          'Privacy',
          'Screenshot',
          'Access',
          'Devices',
        ],
      },
      protect: {
        title: 'Protection on this device',
        keywords: ['Backup', 'Encryption', 'Bug report', 'Diagnostics'],
        screenKeywords: ['Screen guard', 'Screenshot', 'App switcher'],
        screen: 'Screen guard',
        screenHint: 'Blocks screenshots and hides Nemo in the list of open apps',
        screenVault: 'Only in the vault',
        screenEverywhere: 'In the whole app',
        encryptedOnly: 'Encrypted backups only',
        encryptedOnlyHint: 'Backups leave this device only with a password',
        encryptedOnlyHelp:
          'Anyone who gets an unencrypted backup file can read it. With this on, Nemo only offers the encrypted export.',
        report: 'View a bug report',
        reportHint: 'Shows word for word what a report contains before it is saved',
        reportOpen: 'View',
      },
      access: {
        title: 'Access to this device',
        description: 'Who and what is connected to Nemo right now',
        keywords: [
          'Devices',
          'Sessions',
          'Paired',
          'Pairing',
          'Remove',
          'Access',
          'Token',
          'Remote control',
        ],
        hint: 'Each row leads to the place where you end that access. Nothing is changed here.',
        manage: 'Manage',
        manageAria: (what: string) => `Manage ${what}`,
        sync: 'Sync',
        lan: 'Paired devices on the home network',
        remote: 'Remote control',
        localApi: 'Local API',
        extension: 'Browser extension',
        share: 'Share pairs',
        off: 'Off',
        none: 'None',
        devices: (n: number) => (n === 1 ? '1 device' : `${n} devices`),
        remoteOn: (n: number) =>
          n === 1 ? 'On · 1 device may control' : `On · ${n} devices may control`,
        tokens: (n: number) => (n === 1 ? 'On · 1 access' : `On · ${n} accesses`),
        browsers: (n: number) => (n === 1 ? '1 extension paired' : `${n} extensions paired`),
        pairs: (n: number) => (n === 1 ? '1 pair' : `${n} pairs`),
        loading: 'Reading …',
      },
      clipboard: {
        label: 'Clear copied items from the clipboard',
        help: 'How long a copied password or code stays on the clipboard. If you copied something else meanwhile, that stays untouched.',
        s10: 'After 10 seconds',
        s30: 'After 30 seconds',
        s60: 'After 1 minute',
        s120: 'After 2 minutes',
        copied: (what: string, seconds: number) =>
          seconds < 60
            ? `${what} copied – cleared from the clipboard after ${seconds} s.`
            : `${what} copied – cleared from the clipboard after ${seconds / 60} min.`,
      },
    },
  },
);
