// German page texts (primary language). Keep sentences short and calm (docs/design/FOCUS-GUIDELINES.md).
export const de = {
  lang: "de",
  htmlLang: "de",
  siteName: "Nemo",
  meta: {
    title: "Nemo – die ruhige Alltags-App für PC und Android",
    description:
      "Kalender, Aufgaben, Finanzen und Passwörter in einer App für Windows und Android. Deine Daten bleiben bei dir, ohne Konto und ohne Cloud. Open Source, kostenlos.",
  },
  nav: {
    modules: "Module",
    data: "Deine Daten",
    install: "Installieren",
    support: "Unterstützen",
    github: "GitHub",
  },
  theme: {
    toDark: "Dunkles Design einschalten",
    toLight: "Helles Design einschalten",
  },
  langSwitch: {
    label: "Sprache",
    de: "Deutsch",
    en: "English",
    es: "Español",
    fr: "Français",
    "pt-BR": "Português (Brasil)",
    short: { de: "DE", en: "EN", es: "ES", fr: "FR", "pt-BR": "PT" },
  },
  a11y: {
    mainNav: "Hauptnavigation",
    footerNav: "Fußzeile",
    glance: "Auf einen Blick",
  },
  ogLocale: "de_DE",
  skip: "Zum Inhalt springen",
  download: {
    windows: "Für Windows herunterladen",
    android: "Für Android herunterladen",
    windowsSub: "Portable",
    androidSub: "APK",
    version: (v: string, d: string) => `Version ${v} vom ${d}`,
    warn: "Windows und Android fragen beim ersten Start nach. Das ist im Moment normal.",
    guide: "Schritt für Schritt installieren",
    allReleases: "Alle Versionen",
  },
  // The one sentence about ADHD: honest, further down the page, never a headline (docs/design/site/RETHINK.md).
  honest:
    "Nemo ist mit ADHS im Blick entwickelt und hilft beim Anfangen und Dranbleiben. Es ist keine Behandlung und verspricht keine. Jede Hilfe lässt sich einzeln abschalten.",
  // Start page (components/Home.astro). Tone: show, short scenes. Alt texts describe the drawing in a slot and say
  // that it is drawn; when an app picture fills the slot, the alt text gets rewritten (docs/design/site/SLOTS.md).
  home: {
    h1: "Eine Sache zuerst.",
    lead: "Nemo ist eine ruhige App für das, was im Alltag anfällt: Termine, Aufgaben, Geld, Listen, Passwörter. Sie zeigt dir, was jetzt dran ist. Der Rest wartet.",
    sub: "Für Windows und Android. Ohne Konto. Deine Daten bleiben auf deinem Gerät.",
    now: {
      alt: "Skizze der Karte „Jetzt dran“: eine Aufgabe, darunter der Knopf „Anfangen, 5 Min“ und die Wege „Später“ und „Etwas anderes“. Dahinter zwei eingeklappte Zeilen mit „Wartet noch“. Gezeichnet, kein Bild aus der App.",
      label: "Jetzt dran",
      task: "Steuer: Belege heraussuchen",
      start: "Anfangen, 5 Min",
      later: "Später",
      other: "Etwas anderes",
      waiting: "Wartet noch",
    },
    day: {
      h: "Ein Tag mit Nemo",
      intro: "Ein erfundener Tag. Die Funktionen gibt es.",
      plan: {
        time: "07:40",
        h: "Was ist heute?",
        p: "Die Übersicht zeigt, was jetzt wichtig ist, und den Plan für heute. Mehr nicht.",
        alt: "Skizze des Tagesplans: drei Zeilen mit Uhrzeit und Titel, 08:00 Medikament nehmen, 10:00 Teammeeting, 13:00 Friseur. Gezeichnet, kein Bild aus der App.",
        rows: [
          ["08:00", "Medikament nehmen"],
          ["10:00", "Teammeeting"],
          ["13:00", "Friseur"],
        ],
      },
      focus: {
        time: "10:15",
        h: "Anfangen",
        p: "Fokus-Modus: eine Aufgabe, ihre Schritte, ein Ring-Timer mit weichem Ende. Alles andere ist ausgeblendet.",
        alt: "Skizze des Fokus-Modus: ein Ring, zu zwei Dritteln gefüllt, daneben drei Schritte, der erste abgehakt. Gezeichnet, kein Bild aus der App.",
        ring: "16:40",
        steps: ["Ordner holen", "Belege sortieren", "Liste abhaken"],
      },
      capture: {
        time: "13:05",
        h: "Kurz notiert",
        p: "Du tippst „morgen 15 Uhr Zahnarzt“. Nemo erkennt Termin und Datum auf deinem Gerät, ohne Netz.",
        alt: "Skizze der Schnellerfassung: ein Eingabefeld mit „morgen 15 Uhr Zahnarzt“, darunter der erkannte Eintrag: Termin, morgen, 15:00. Gezeichnet, kein Bild aus der App.",
        input: "morgen 15 Uhr Zahnarzt",
        kind: "Termin",
        what: "Zahnarzt",
        when: "morgen, 15:00",
      },
      money: {
        time: "18:30",
        h: "Was geht ab?",
        p: "Konten, Rechnungen, Abos und Budgets nebeneinander: was da ist, was abgeht, was fällig wird.",
        alt: "Skizze der Budgets: drei Balken für Wohnen, Essen und Freizeit, unterschiedlich weit gefüllt. Gezeichnet, kein Bild aus der App.",
        bars: ["Wohnen", "Essen", "Freizeit"],
      },
      night: {
        time: "22:00",
        h: "Ruhe",
        p: "Nachts bleibt es still. Tagsüber kommen höchstens drei Erinnerungen pro Stunde. Beides stellst du selbst ein.",
      },
    },
    data: {
      h: "Und es bleibt bei dir",
      lead: "Kein Konto, kein Nemo-Server. Was die App trotzdem ins Netz schickt, steht hier. Nichts davon geht an das Projekt. Deine Einträge verlassen das Gerät nur, wenn du es selbst auslöst: per Sync zu deinem eigenen Server oder als Daten, die du einer KI-Frage mitgibst.",
      link: "Alle Verbindungen, und wie du nachprüfst",
    },
    inside: {
      h: "Du schaltest ein, was du brauchst",
      intro: (areas: number, modules: number) => `${areas} Bereiche, ${modules} Module. Am Anfang ist nur das Nötigste an.`,
      link: "Alle Module ansehen",
    },
    get: { h: "Ausprobieren", p: "Kostenlos, keine Premium-Stufe." },
  },
  // The ledger "what goes online": `short` rows on the start page, all rows on the data page. Source of every row:
  // docs/user/security.md ("Externe Dienste ohne Nutzerdaten") and the privacy page; change them together.
  ledger: {
    caption: "Verbindungen, die die App aufbaut",
    head: ["Wann", "Wohin", "Was", "Schalter"],
    rows: [
      { short: true, when: "Update-Abfrage, höchstens einmal am Tag", where: "GitHub", what: "Die Anfrage nach der Versionsdatei. GitHub sieht deine IP-Adresse.", off: "Einstellungen → Updates" },
      { short: true, when: "Wetter, nachdem du einen Ort gewählt hast", where: "open-meteo.com", what: "Der Ortsname beim Suchen, danach die auf etwa 1 km gerundete Position.", off: "Einstellungen → Verbindungen → Wetter" },
      { short: true, when: "Währungsrechner öffnen", where: "frankfurter.dev", what: "Die Anfrage nach den Kursen.", off: "Nur beim Öffnen" },
      { short: false, when: "Klick auf „Öffentliche IP abfragen“", where: "api.ipify.org", what: "Die Anfrage.", off: "Nur auf Klick" },
      { short: false, when: "Lokales KI-Modell laden", where: "huggingface.co", what: "Der Download. Die Prüfsumme wird kontrolliert.", off: "Nur nach deiner Bestätigung" },
      { short: false, when: "Feeds und Kalender-Abos", where: "Die Adressen, die du einträgst", what: "Der Abruf der Adresse.", off: "Aus, bis du eine einträgst" },
      { short: false, when: "Google und Spotify", where: "Google, Spotify", what: "Google: Kalender und E-Mail-Köpfe lesen. Spotify: was gerade läuft und ein paar Steuerbefehle.", off: "Aus, bis du die Verbindung einrichtest" },
      { short: true, when: "KI-Assistent", where: "Anbieter deiner Wahl", what: "Deine Frage, das Datum, die Feldnamen der Module.", off: "Aus, bis du einen Schlüssel hinterlegst" },
      { short: true, when: "Sync", where: "Dein eigener Server", what: "Deine Daten, auf Wunsch Ende-zu-Ende verschlüsselt.", off: "Aus, bis du ihn einrichtest" },
    ],
    never: "Nie:",
    neverText: "Einträge, Beträge, Namen oder Passwörter an das Projekt. Es gibt keinen Nemo-Server, kein Konto, keine Telemetrie, keine Werbung.",
  },
  // Page /module (components/ModulesPage.astro): the catalogue from the app, shipped modules only.
  modules: {
    title: "Module",
    description: "Alle Module von Nemo nach Bereich: Planen, Geld, Haushalt, Wissen, Tresor und System. Du schaltest ein, was du brauchst.",
    h1: "Du schaltest ein, was du brauchst.",
    lead: (areas: number, modules: number) =>
      `${modules} Module in ${areas} Bereichen. Am Anfang ist nur das Nötigste an. Den Rest holst du dir in der Modul-Bibliothek, wenn du ihn brauchst.`,
    areas: {
      plan: "Der Tag, die Woche, die Leute.",
      money: "Konten, Rechnungen, Abos, Budgets.",
      household: "Einkaufen und Vorräte.",
      knowledge: "Lesen, schreiben, merken.",
      vault: "Verschlüsselt, nur hier.",
      system: "Was dein Gerät gerade tut.",
    },
    only: {
      windows: "nur Windows-App",
      android: "nur Android-App",
      both: "nur Windows- und Android-App",
    },
    on: "am Anfang an",
    library: {
      alt: "Skizze der Modul-Bibliothek: drei Zeilen mit Modulname und Schalter. Kalender und Finanzen sind an, Vorräte ist aus. Gezeichnet, kein Bild aus der App.",
      title: "Modul-Bibliothek",
      rows: [
        ["sky", "Kalender", "an"],
        ["teal", "Finanzen", "an"],
        ["fern", "Vorräte", "aus"],
      ],
    },
    note: "Die Liste wird aus der App selbst erzeugt.",
  },
  // Page /daten (components/DataPage.astro).
  dataPage: {
    title: "Was ins Netz geht",
    description: "Jede Verbindung, die Nemo aufbaut, mit Ziel, Inhalt und Schalter. Deine Einträge bleiben auf deinem Gerät.",
    h1: "Was ins Netz geht.",
    lead: "Deine Einträge bleiben auf deinem Gerät. Hier steht jede Verbindung, die Nemo aufbaut, und wo du sie abschaltest.",
    schema: {
      alt: "Schema: Innerhalb einer Linie mit der Aufschrift „Bei dir“ stehen dein PC, dein Handy und, gestrichelt, dein eigener Server. Außerhalb, unter „Internet“, stehen Update-Abfrage, Wetter und KI, jede mit dem Hinweis, wie sie ausgeschaltet ist oder wird.",
      inside: "Bei dir",
      pc: ["Dein PC", "alle Daten, Tresor verschlüsselt"],
      phone: ["Dein Handy", "mit Sync dieselben Daten"],
      server: ["Dein eigener Server", "nur wenn du willst"],
      sync: "Sync",
      outside: "Internet",
      lines: [
        ["Update-Abfrage", "abschaltbar"],
        ["Wetter", "abschaltbar"],
        ["KI", "aus, bis du sie einschaltest"],
      ],
    },
    table: { h: "Jede Verbindung", intro: "Außer deiner IP-Adresse und der Anfrage selbst wird dabei nichts übertragen, wenn die Zeile nichts anderes sagt." },
    ai: {
      h: "Die KI sieht deine Einträge nicht",
      p: [
        "Der Assistent schickt deine Frage, das Datum und die Feldnamen der eingeschalteten Module. Mehr nicht.",
        "Zwei Ausnahmen löst nur du aus. Du kannst einer Frage Daten eines Moduls mitgeben; die App zeigt vorher genau, was mitgeht. Und über die lokale Import-Schnittstelle kannst du einer KI auf deinem PC Leserechte für einzelne Module geben.",
        "Der Passwort-Tresor ist für KI, Suche und Import unsichtbar.",
      ],
    },
    check: {
      h: "Prüf es selbst",
      intro: "Du musst das nicht glauben. Das hier kannst du selbst nachsehen.",
      items: [
        ["Quellcode", "Offen, MIT-Lizenz. Jede Zeile der App liegt auf GitHub."],
        ["Updates", "Mit dem Schlüssel des Projekts signiert und vor dem Einspielen geprüft."],
        ["Windows-Datei", "Ohne gekauftes Zertifikat. Deshalb fragt SmartScreen beim ersten Start nach."],
      ],
      sums: "Prüfsummen (SHA-256)",
      sumsHint: "Aus dem GitHub-Release. Stimmt die Summe mit deiner Datei überein, ist es die Datei, die das Projekt gebaut hat.",
      source: "Quellcode auf GitHub",
      docs: "Sicherheit und Datenschutz, ausführlich",
      site: "Datenschutzerklärung dieser Website",
    },
  },
  // Page /unterstuetzen (components/SupportPage.astro).
  supportPage: {
    title: "Unterstützen",
    description: "Nemo bleibt kostenlos. Wer mag, gibt einmalig etwas über Ko-fi und bekommt als Dank ein Abzeichen und fünf Farbthemen.",
    h1: "Nemo bleibt kostenlos.",
    lead: "Es gibt keine Premium-Stufe und keine Werbung. Alle Funktionen bleiben für alle offen.",
    give: {
      h: "Wenn du etwas geben magst",
      p: "Du gibst einmalig etwas über Ko-fi. Als Dank bekommst du einen Supporter-Code: ein „Danke“-Abzeichen und fünf Farbthemen.",
      button: "Auf Ko-fi unterstützen",
      note: "Ko-fi ist ein externer Anbieter; bezahlt wird nur dort.",
    },
    themes: { h: "Die fünf Farbthemen", label: "Farbthemen für Unterstützer" },
    code: {
      h: "Der Code",
      p: "Der Code wird nur auf deinem Gerät geprüft, ohne Netz. Er schaltet Farben und das Abzeichen frei, keine Funktion.",
      link: "Wie der Supporter-Code funktioniert",
    },
  },
  // Step-by-step page /install (components/InstallGuide.astro). Button labels are the exact wording of
  // Windows 11 and Samsung One UI in German; `ui` marks the word to tap, `text` explains the step.
  installPage: {
    title: "Installieren, Schritt für Schritt",
    description:
      "Nemo auf Windows und Android installieren: was die Warnungen von Windows SmartScreen und Android bedeuten, welche Knöpfe du drückst und wie du die Datei prüfst.",
    lead: "Windows und Android warnen beim ersten Start. Das ist bei Nemo im Moment normal. Hier steht, warum, und genau welche Knöpfe du drückst.",
    downloads: {
      title: "Herunterladen",
      stable: "Stabile Version",
      dev: "Dev-Preview (ungetestet)",
      devHint:
        "Die Dev-Preview ist eine eigene App „Nemo Dev“ mit eigenen Daten. Sie läuft neben der stabilen App und ersetzt sie nicht.",
    },
    why: {
      title: "Warum warnt dein Gerät?",
      text: "Nemo ist ein kleines Open-Source-Projekt. Die Windows-Datei ist nicht mit einem gekauften Code-Signing-Zertifikat unterschrieben, und die Android-App kommt nicht aus dem Play Store. Deshalb kennen Windows und Android den Herausgeber nicht und fragen nach. Die Warnung ist berechtigt: Sie gilt für jede Datei aus dem Netz, die dein Gerät nicht kennt. Installiere nur, was du von dieser Seite oder vom GitHub-Release hast.",
      signed:
        "Was trotzdem signiert ist: Updates in der App sind mit dem Schlüssel des Projekts unterschrieben und werden vor dem Einspielen geprüft. Die Android-App ist mit einem festen Schlüssel signiert; Android nimmt Updates nur mit demselben Schlüssel an.",
    },
    check: {
      title: "Datei prüfen (optional)",
      text: "Jede Datei hat im GitHub-Release eine SHA-256-Prüfsumme. Stimmt sie mit deiner Datei überein, ist es genau die Datei, die das Projekt gebaut hat.",
      windows:
        "Windows: PowerShell im Download-Ordner öffnen und eingeben (Dev-Preview: Nemo-Portable-dev.exe):",
      android:
        "Android: eine Prüfsummen-App oder später am PC mit demselben Befehl.",
      stable: "Prüfsummen der stabilen Version",
      dev: "Prüfsummen der Dev-Preview",
    },
    windows: {
      title: "Windows 11 und 10",
      steps: [
        {
          text: "Datei herunterladen. Meldet Edge „wird nicht häufig heruntergeladen“, auf die drei Punkte klicken, dann",
          ui: ["Beibehalten", "Mehr anzeigen", "Trotzdem beibehalten"],
        },
        {
          text: "Datei im Download-Ordner doppelt anklicken. Es erscheint „Der Computer wurde durch Windows geschützt“. Unter dem Text auf",
          ui: ["Weitere Informationen"],
        },
        {
          text: "Jetzt steht dort „Herausgeber: Unbekannter Herausgeber“. Prüfe, dass die App „Nemo-Portable.exe“ oder „Nemo-Portable-dev.exe“ heißt, dann",
          ui: ["Trotzdem ausführen"],
        },
        {
          text: "Nemo startet. Die Frage kommt nur beim ersten Start dieser Datei.",
          ui: [],
        },
      ],
      sac: "Steht dort stattdessen „Intelligente App-Steuerung“ (Smart App Control) und es gibt keinen Knopf „Trotzdem ausführen“: Diese Schutzfunktion lässt unsignierte Apps gar nicht zu. Wir raten davon ab, sie für Nemo auszuschalten: Sie schützt alle Apps. Nimm dann lieber die Android-App oder warte auf eine signierte Version.",
      webview:
        "Nemo braucht WebView2. Windows 10 und 11 haben es fast immer schon; fehlt es, zeigt Windows einen Hinweis mit Link.",
    },
    android: {
      title: "Android (Samsung, One UI)",
      steps: [
        {
          text: "APK im Browser herunterladen. Fragt Chrome, ob du die Datei behalten willst:",
          ui: ["Trotzdem herunterladen"],
        },
        {
          text: "Benachrichtigung „Download abgeschlossen“ antippen oder die Datei unter „Eigene Dateien → Downloads“ öffnen.",
          ui: [],
        },
        {
          text: "Android sagt, dass dein Telefon keine unbekannten Apps aus dieser Quelle installieren darf. Tippe auf",
          ui: ["Einstellungen"],
        },
        {
          text: "Den Schalter für den Browser oder die Dateien-App einschalten:",
          ui: ["Von dieser Quelle zulassen"],
        },
        { text: "Mit „Zurück“ zur Installation, dann", ui: ["Installieren"] },
        {
          text: "Fragt Google Play Protect nach, ist das dieselbe Warnung wie oben: Die App kommt nicht aus dem Play Store. Wähle „App scannen“; wenn danach „Trotzdem installieren“ erscheint, entscheidest du.",
          ui: [],
        },
      ],
      autoBlocker:
        "Kommt die Meldung „Von der automatischen Blockierung blockiert“: Auf neueren Samsung-Geräten verhindert diese Funktion Apps außerhalb der Stores. Einstellungen → Sicherheit und Datenschutz → Automatische Blockierung → aus, Nemo installieren, danach wieder einschalten. Solange sie an ist, kann Nemo auch seine eigenen Updates nicht installieren.",
      after:
        "Danach kannst du „Von dieser Quelle zulassen“ für den Browser wieder ausschalten. Beim ersten Update aus der App fragt Android einmal, ob Nemo Updates installieren darf.",
    },
    firstStart: {
      title: "Beim ersten Start",
      items: [
        "Nemo öffnet sich in der Sprache deines Systems, Deutsch oder Englisch (andere Sprachen: Englisch). Ändern kannst du sie in den Einstellungen.",
        "Die Dev-Preview zeigt oben ein Schild „Dev“ und kurz einen Hinweis darauf. Das ist kein Fehler, nur das Zeichen, dass du die Vorschau nutzt.",
        "Beim ersten Start fragt die Dev-Preview: „Einrichtung starten“ oder „Mit Testdaten ansehen“ (erfundene Beispiele zum Ausprobieren; rote Karten wie „Rechnungen überfällig“ gehören dann dazu). Entfernen: Einstellungen → Entwickler → „Testdaten entfernen“.",
        "Die stabile Version startet leer und fragt, ob du sie Schritt für Schritt einrichten willst. Jeder Schritt lässt sich überspringen.",
        "Kein Konto, keine Anmeldung. Gibt es ein Update, zeigt die App es an; du entscheidest, wann es kommt.",
      ],
    },
    help: "Hängst du irgendwo fest? Schreib, an welchem Schritt, ein Bildschirmfoto hilft.",
    helpLink: "Frage auf GitHub stellen",
    back: "Zur Startseite",
  },
  footer: {
    github: "GitHub",
    releases: "Releases",
    changelog: "Änderungen",
    roadmap: "Roadmap",
    privacy: "Datenschutz",
    imprint: "Impressum",
    license: "MIT-Lizenz",
  },
  legal: {
    imprintTitle: "Impressum",
    privacyTitle: "Datenschutzerklärung",
    back: "Zur Startseite",
  },
  notFound: {
    title: "Seite nicht gefunden",
    text: "Diese Adresse gibt es nicht.",
    back: "Zur Startseite",
  },
} as const;
