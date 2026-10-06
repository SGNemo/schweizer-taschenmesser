// German page texts (primary language). Keep sentences short and calm (docs/design/FOCUS-GUIDELINES.md).
export const de = {
  lang: 'de',
  htmlLang: 'de',
  siteName: 'Nemo',
  meta: {
    title: 'Nemo – die ruhige Alltags-App für PC und Android',
    description:
      'Kalender, Aufgaben, Finanzen und Passwörter in einer App für Windows und Android. Deine Daten bleiben bei dir, ohne Konto und ohne Cloud. Open Source, kostenlos.',
  },
  nav: { features: 'Funktionen', install: 'Installation', support: 'Unterstützen', github: 'GitHub' },
  theme: { toDark: 'Dunkles Design einschalten', toLight: 'Helles Design einschalten' },
  langSwitch: { label: 'Sprache', de: 'Deutsch', en: 'English', short: { de: 'DE', en: 'EN' } },
  skip: 'Zum Inhalt springen',
  hero: {
    title: 'Eine ruhige Alltags-App, die deine Daten bei dir lässt.',
    lead: 'Kalender, Aufgaben, Finanzen und Passwörter in einer App für PC und Android. Ohne Konto, ohne Cloud.',
    windows: 'Windows herunterladen',
    windowsSub: 'Portable',
    android: 'Android herunterladen',
    androidSub: 'APK',
    facts: ['Open Source', 'kostenlos', 'keine Cloud'],
    version: (v: string, d: string) => `Version ${v} vom ${d}`,
    fallbackVersion: 'Neueste Version',
    checksums: 'Prüfsummen (SHA-256) anzeigen',
    checksumsHint: 'Die Prüfsumme stammt aus dem GitHub-Release. Vergleiche sie nach dem Download, wenn du sichergehen willst.',
    allReleases: 'Alle Versionen und Änderungen',
    screenshotAlt:
      'Nemo-Übersicht mit erfundenen Beispieldaten: Seitenleiste mit Modulen, Karten für heutige Termine, Aufgaben, Kontostand und fällige Rechnungen',
  },
  features: {
    eyebrow: 'Was Nemo kann',
    title: 'Die Dinge des Alltags, an einem Ort.',
    items: [
      { icon: 'calendar', title: 'Kalender', text: 'Termine, Erinnerungen und Fristen anderer Module in einer Woche.' },
      { icon: 'tasks', title: 'Aufgaben', text: 'Listen, Unteraufgaben, Wiederholung und ein „Irgendwann“.' },
      { icon: 'wallet', title: 'Finanzen & Abos', text: 'Konten, Buchungen, Rechnungen und Abos, auch per Kontoauszug-Import.' },
      { icon: 'bell', title: 'Erinnerungen', text: 'Ruhig und auf Wunsch gebündelt, auch bei geschlossener App.' },
      { icon: 'key', title: 'Passwort-Tresor', text: 'Verschlüsselt auf dem Gerät, mit TOTP und Generator. Für KI unsichtbar.' },
      { icon: 'chat', title: 'Nachrichten', text: 'Ein ruhiger Chat mit lokalem Modell oder einem Anbieter deiner Wahl.' },
      { icon: 'drive', title: 'PC aufräumen', text: 'Platz analysieren und sicher aufräumen, immer erst in den Papierkorb.' },
      { icon: 'sparkles', title: 'KI, nur wenn du willst', text: 'Fragen beantworten, ohne deine Daten zu senden. Offline möglich.' },
    ],
  },
  why: {
    eyebrow: 'Warum Nemo',
    title: 'Gemacht für Tage, an denen vieles gleichzeitig ruft.',
    items: [
      {
        title: 'Deine Daten bleiben bei dir',
        text: 'Alles liegt auf deinem Gerät. Kein Konto, kein Server von uns. Sync nur, wenn du ihn selbst betreibst.',
      },
      {
        title: 'Ruhig und klar',
        text: 'Eine Hauptaktion pro Ansicht, wenig Farbe, keine Streaks und kein Druck. Mit ADHS im Blick entwickelt.',
      },
      {
        title: 'KI optional, auch offline',
        text: 'Der Assistent sieht nie deine Einträge, nur deine Frage. Mit lokalem Modell auch ganz ohne Internet.',
      },
    ],
  },
  install: {
    eyebrow: 'Installation',
    title: 'In einer Minute startklar.',
    windows: {
      summary: 'Windows: eine Datei, keine Installation',
      text: 'Datei starten, fertig. Beim ersten Mal fragt SmartScreen nach: „Weitere Informationen“ → „Trotzdem ausführen“. Die exe hat kein gekauftes Zertifikat; Updates sind trotzdem signiert und werden vor dem Einspielen geprüft. Voraussetzung ist WebView2, auf Windows 10 und 11 meist vorhanden.',
    },
    android: {
      summary: 'Android: APK installieren',
      text: 'APK öffnen und „Aus dieser Quelle zulassen“ für den Browser oder Dateimanager erlauben. Spätere Updates lädt die App selbst und prüft die Prüfsumme; Android akzeptiert nur APKs mit demselben Signaturschlüssel.',
    },
    updates: {
      summary: 'Updates kommen in der App',
      text: 'Einstellungen → App-Updates. Vor jedem Update legt Nemo eine Sicherungskopie an und prüft die Signatur des Projekts. Du entscheidest, wann.',
    },
    dev: {
      summary: 'Dev-Preview (ungetestet)',
      text: 'Nach jedem Stand des Entwicklungszweigs entsteht automatisch eine Vorschau. Das ist eine eigene App „Nemo Dev“ mit eigenen Daten, ungetestet und nicht für den Alltag gedacht. Sie ersetzt die stabile App nicht.',
      windows: 'Dev-Preview für Windows',
      android: 'Dev-Preview für Android',
    },
    more: 'Ausführliche Anleitung',
  },
  support: {
    eyebrow: 'Unterstützen',
    title: 'Nemo bleibt kostenlos.',
    text: 'Wer mag, gibt einmalig etwas über Ko-fi. Als Dank gibt es einen Supporter-Code für ein „Danke“-Abzeichen und zusätzliche Farbthemen. Alle Funktionen bleiben für alle offen, ohne Konto und ohne Tracking.',
    button: 'Auf Ko-fi unterstützen',
    note: 'Ko-fi ist ein externer Anbieter; bezahlt wird nur dort.',
  },
  footer: {
    github: 'GitHub',
    releases: 'Releases',
    changelog: 'Änderungen',
    roadmap: 'Roadmap',
    privacy: 'Datenschutz',
    imprint: 'Impressum',
    license: 'MIT-Lizenz',
  },
  legal: {
    imprintTitle: 'Impressum',
    privacyTitle: 'Datenschutzerklärung',
    back: 'Zur Startseite',
  },
  notFound: { title: 'Seite nicht gefunden', text: 'Diese Adresse gibt es nicht.', back: 'Zur Startseite' },
} as const;
