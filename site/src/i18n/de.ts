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
    features: "Funktionen",
    privacy: "Datenschutz",
    install: "Installation",
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
  hero: {
    title: "Alles Wichtige an einem Ort.",
    titleAccent: "Und nur bei dir.",
    lead: "Nemo bündelt Kalender, Aufgaben, Geld und Passwörter in einer ruhigen App für PC und Android. Ohne Konto, ohne Cloud.",
    windows: "Für Windows",
    windowsSub: "Portable",
    android: "Für Android",
    androidSub: "APK",
    trust: ["Open Source, MIT", "Kein Konto", "Kostenlos, kein Tracking"],
    version: (v: string, d: string) => `Version ${v} · ${d}`,
    fallbackVersion: "Neueste Version",
    allReleases: "Alle Versionen",
    checksums: "Prüfsummen",
    checksumsTitle: "Prüfsummen (SHA-256)",
    checksumsHint:
      "Die Prüfsumme stammt aus dem GitHub-Release. Vergleiche sie nach dem Download, wenn du sichergehen willst.",
    screenshotAlt:
      "Nemo-Übersicht mit erfundenen Beispieldaten: „Jetzt wichtig“, „Wartet noch“, die Karte „Jetzt dran“ mit erstem Schritt und der Plan für heute",
    phoneAlt: "Dieselbe Übersicht auf dem Handy",
  },
  features: {
    eyebrow: "Was Nemo kann",
    title: "Die Dinge des Alltags, an einem Ort.",
    items: [
      {
        icon: "calendar",
        shot: "home",
        title: "Übersicht",
        text: "Heute zuerst: was jetzt wichtig ist, eine Sache, die dran ist, und drei Dinge für heute.",
        alt: "Übersicht mit „Jetzt wichtig“ und „Jetzt dran“",
      },
      {
        icon: "calendar",
        shot: "calendar",
        title: "Kalender",
        text: "Termine, Erinnerungen und Fristen aller Module in einer Woche, mit Agenda.",
        alt: "Kalender in der Wochenansicht mit Agenda",
      },
      {
        icon: "tasks",
        shot: "todos",
        title: "Aufgaben",
        text: "Listen, Irgendwann, „Neu planen“ statt Rot. Ein erster Schritt statt einer langen Liste.",
        alt: "ToDo-Listen mit „Wartet noch“ und „Neu planen“",
      },
      {
        icon: "wallet",
        shot: "finance",
        title: "Geld und Abos",
        text: "Konten, Rechnungen, Abos und Budgets, auch per Kontoauszug-Import.",
        alt: "Finanzübersicht mit verfügbarem Betrag, Einnahmen und Ausgaben",
      },
      {
        icon: "key",
        shot: "vault",
        title: "Tresor",
        text: "Passwörter mit TOTP und Generator, Unterlagen mit Ablaufdatum. Verschlüsselt, für KI unsichtbar.",
        alt: "Entsperrter Tresor mit Demo-Zugängen",
      },
      {
        icon: "bell",
        shot: "reminders",
        title: "Erinnerungen",
        text: "Gebündelt, mit Ruhezeiten und „Später“, auch bei geschlossener App.",
        alt: "Erinnerungen mit Schaltern und nächstem Zeitpunkt",
      },
    ],
    more: "Außerdem: Notizen, Listen, Merkliste, Vorräte, Personen, Gewohnheiten, Zeiterfassung, Wetter, PC aufräumen, ein Chat mit lokalem Modell (Vorschau). KI nur, wenn du willst. Die App gibt es auf Deutsch und Englisch.",
    // Area blocks and module cards (identity v3, docs/design/site/ROUND-4-IDENTITY-V3.md).
    intro: (n: number, a: number) =>
      `${n} Module in ${a} Bereichen. Jedes hat seine Farbe, du schaltest nur ein, was du brauchst.`,
    count: (n: number) => (n === 1 ? "1 Modul" : `${n} Module`),
    areas: {
      plan: "Der Tag, die Woche, die Leute.",
      money: "Konten, Rechnungen, Abos, Budgets.",
      household: "Einkaufen und Vorräte.",
      knowledge: "Lesen, schreiben, merken.",
      vault: "Verschlüsselt, nur hier.",
      system: "Was dein Gerät gerade tut.",
    },
    // Planner highlight above the areas (shot: planner-*.png, name and state from the catalogue).
    planner: {
      text: "Du trägst ein, was ansteht, der Planer verteilt es auf deine freie Zeit – offline, ohne Konto.",
      alt: "Planer am Handy: freie Zeit heute, die Woche als Balken und der Tag mit seinen Terminen",
      altDesktop:
        "Planer am Desktop: freie Zeit heute, die Woche als Balken und sieben Tage nebeneinander mit Terminen und ToDos",
    },
    modules: {
      summary: (n: number) => `Alle ${n} Module`,
      status: {
        default: "standardmäßig an",
        optional: "optional",
        preview: "Vorschau",
      },
      only: {
        windows: "nur Windows-App",
        android: "nur Android-App",
        both: "nur Windows- und Android-App",
      },
      hint: "Vorschau-Module bleiben versteckt, bis „In Arbeit anzeigen“ an ist (Einstellungen → Darstellung). Die Liste wird aus der App selbst erzeugt.",
    },
  },
  heads: {
    eyebrow: "Jedes Modul hat seine Form",
    note: "Jede Modulseite beginnt mit einem Kopf in einer von neun Formen und in der Farbe des Moduls. So siehst du auf einen Blick, wo du bist.",
    names: {
      kennzahl: "Kennzahl",
      zeit: "Zeit",
      fortschritt: "Fortschritt",
      cover: "Cover",
      himmel: "Himmel",
      regal: "Regal",
      tresor: "Tresor",
      schreib: "Papier",
      fokus: "Fokus",
    },
  },
  data: {
    eyebrow: "Deine Daten bleiben bei dir",
    title: "Dein PC, dein Handy, dein Server. Sonst niemand.",
    nodes: [
      {
        icon: "pc",
        title: "Dein PC",
        text: "Alle Daten liegen hier, verschlüsselter Tresor inklusive.",
      },
      {
        icon: "server",
        title: "Dein eigener Server",
        text: "Ein kleines Programm bei dir zu Hause oder auf deinem Webspace.",
      },
      {
        icon: "phone",
        title: "Dein Handy",
        text: "Dieselben Daten, offline nutzbar.",
      },
    ],
    links: ["Sync, nur wenn du willst", "Sync"],
    ai: "Cloud-KI, nur auf Wunsch.",
    aiText: "Mit lokalem Modell ganz ohne Internet.",
    sent: "Gesendet:",
    sentText: "deine Frage, das Datum, die Feldnamen der Module.",
    never: "Nie gesendet:",
    neverText: "Einträge, Beträge, Namen, Passwörter.",
  },
  focus: {
    eyebrow: "Gemacht für volle Köpfe",
    title: "Weniger auf dem Bildschirm, damit Anfangen leichter fällt.",
    items: [
      {
        icon: "target",
        title: "Eine Sache zuerst",
        text: "Die Übersicht zeigt, was jetzt dran ist, mit erstem Schritt und Dauer. Der Rest wartet eingeklappt.",
      },
      {
        icon: "timer",
        title: "Fokus-Modus",
        text: "Eine Aufgabe, ihre Schritte, ein Ring-Timer mit weichem Ende. Alles andere ist ausgeblendet.",
      },
      {
        icon: "bell",
        title: "Ruhige Erinnerungen",
        text: "Höchstens drei pro Stunde, Ruhezeiten nachts, „Später“ mit sinnvollen Optionen.",
      },
      {
        icon: "leaf",
        title: "Kein Druck",
        text: "„Wartet noch“ statt „überfällig seit 12 Tagen“. Keine Streaks, die verloren gehen, kein Zähler, der wächst.",
      },
    ],
    honest:
      "Nemo ist mit ADHS im Blick entwickelt und hilft beim Anfangen und Dranbleiben. Es ist keine Behandlung und verspricht keine. Jede Hilfe lässt sich einzeln abschalten.",
    shotAlt:
      "Ausschnitt der Übersicht: die Karte „Jetzt dran“ mit „Anfangen · 5 Min“, „Später“ und „Etwas anderes“",
    phoneAlt:
      "Die Übersicht auf dem Handy: „Jetzt wichtig“ und die Karte „Jetzt dran“ mit erstem Schritt und Dauer",
  },
  compare: {
    eyebrow: "Vergleich",
    title: "Nemo neben üblichen Apps.",
    head: ["Merkmal", "Nemo", "Übliche Apps"],
    rows: [
      ["Wo die Daten liegen", "Auf deinem Gerät", "Auf Servern des Anbieters"],
      ["Konto", "Keins nötig", "Pflicht, meist mit E-Mail"],
      ["Preis", "Kostenlos, keine Premium-Stufe", "Abo oder Werbung"],
      ["Quellcode", "Offen, MIT-Lizenz", "Geschlossen"],
      [
        "Abgleich zwischen Geräten",
        "Über deinen eigenen Server, optional",
        "Über die Cloud des Anbieters, immer",
      ],
    ],
  },
  install: {
    eyebrow: "Installation",
    title: "In einer Minute startklar.",
    windows: {
      summary: "Windows: eine Datei, keine Installation",
      text: "Datei starten, fertig. Beim ersten Mal fragt SmartScreen nach: „Weitere Informationen“ → „Trotzdem ausführen“. Die exe hat kein gekauftes Zertifikat; Updates sind trotzdem signiert und werden vor dem Einspielen geprüft. Voraussetzung ist WebView2, auf Windows 10 und 11 meist vorhanden.",
    },
    android: {
      summary: "Android: APK installieren",
      text: "APK öffnen und „Von dieser Quelle zulassen“ für den Browser oder Dateimanager erlauben. Spätere Updates lädt die App selbst und prüft die Prüfsumme; Android akzeptiert nur APKs mit demselben Signaturschlüssel.",
    },
    updates: {
      summary: "Updates kommen in der App",
      text: "Einstellungen → App-Updates. Vor jedem Update legt Nemo eine Sicherungskopie an und prüft die Signatur des Projekts. Du entscheidest, wann.",
    },
    dev: {
      summary: "Dev-Preview (ungetestet)",
      text: "Nach jedem Stand des Entwicklungszweigs entsteht automatisch eine Vorschau. Das ist eine eigene App „Nemo Dev“ mit eigenen Daten, ungetestet und nicht für den Alltag gedacht. Sie ersetzt die stabile App nicht.",
      windows: "Dev-Preview für Windows",
      android: "Dev-Preview für Android",
    },
    steps: "Schritt für Schritt, mit den Warnungen von Windows und Android",
    more: "Ausführliche Anleitung",
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
  support: {
    eyebrow: "Unterstützen",
    title: "Nemo bleibt kostenlos.",
    text: "Wer mag, gibt einmalig etwas über Ko-fi. Als Dank gibt es einen Supporter-Code für ein „Danke“-Abzeichen und fünf Farbthemen. Alle Funktionen bleiben für alle offen.",
    button: "Auf Ko-fi unterstützen",
    note: "Ko-fi ist ein externer Anbieter; bezahlt wird nur dort.",
    themes: "Farbthemen für Unterstützer",
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
