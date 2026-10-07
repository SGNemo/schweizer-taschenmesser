import type { Strings } from '@/strings';

export const about: Strings['about'] = {
  title: 'Über Nemo',
  tagline: 'Modulare, lokale Alltags-App',
  version: 'Version',
  build: 'Build',
  commit: 'Commit',
  channel: 'Kanal',
  channelStable: 'Stable',
  channelDev: 'Dev-Preview',
  platform: 'Plattform',
  platforms: { web: 'Browser', desktop: 'Windows-App', android: 'Android-App' },
  install: 'Installationsart',
  installKinds: {
    portable: 'Portable (Ordner mit Daten)',
    installed: 'Installiert',
    apk: 'Android-App (APK)',
    pwa: 'Installierte Web-App (PWA)',
    browser: 'Browser-Tab',
  },
  dataDir: 'Datenordner',
  openDataDir: 'Ordner öffnen',
  openDataDirFailed: 'Der Ordner konnte nicht geöffnet werden.',
  license: 'Lizenz',
  licenseValue: 'MIT-Lizenz',
  updates: {
    title: 'Updates und Änderungen',
    lastCheck: 'Letzte Prüfung',
    never: 'Noch nie',
    browser: 'Im Browser aktualisiert sich die App selbst.',
    current: 'Änderungen dieser Version',
    available: (version: string) => `Änderungen in Version ${version}`,
    none: 'Zu dieser Version gibt es keine Angaben.',
  },
  packages: 'Verwendete Bibliotheken',
  links: {
    title: 'Links',
    open: 'Öffnen',
    repo: 'Quellcode auf GitHub',
    releases: 'Versionen und Downloads',
    docs: 'Dokumentation',
    bugs: 'Fehler melden',
  },
  diagnostics: {
    title: 'Diagnose',
    label: 'Diagnose exportieren',
    description:
      'Speichert eine Datei mit Version, Plattform, aktiven Modulen und den letzten Fehlermeldungen (gekürzt). Ohne Einträge, Einstellungen und Schlüssel.',
    saved: 'Diagnose gespeichert.',
  },
  reset: {
    title: 'Gerät zurücksetzen',
    label: 'Alle Daten auf diesem Gerät löschen',
    description:
      'Löscht Einträge, Einstellungen und Schlüssel auf diesem Gerät. Daten auf dem Sync-Server und Backup-Dateien bleiben bestehen.',
    dialogTitle: 'Alle Daten auf diesem Gerät löschen?',
    warning:
      'Das lässt sich nicht rückgängig machen. Lege vorher ein Backup an (Sync & Backup), wenn du die Daten noch brauchst.',
    confirm: 'Endgültig löschen',
  },
  licenses: 'Lizenzhinweise',
  licenseList: [
    'Schrift „Inter“ – SIL Open Font License 1.1, © The Inter Project Authors.',
    'Schriftzug „Nemo“ (Logo) in „Nunito“ – SIL Open Font License 1.1, © The Nunito Project Authors.',
    'Icons „Lucide“ – ISC-Lizenz, © Lucide Contributors.',
    'Das Nemo-Logo (Clownfisch) ist eine eigene Zeichnung dieses Projekts.',
  ],
};
