// Texts of the three draft directions (rethink round, docs/design/site/RETHINK.md), German and English.
// Each direction has its own tone: A tells (whole sentences), B states (facts, figures), C shows (short scenes).
// Every claim is one the current site or docs/user/security.md already makes; nothing about preview modules.
export type Dir = 'a' | 'b' | 'c';

const shared = {
  de: {
    windows: 'Für Windows herunterladen',
    android: 'Für Android herunterladen',
    windowsSub: 'Portable',
    androidSub: 'APK',
    version: (v: string, d: string) => `Version ${v} vom ${d}`,
    warn: 'Windows und Android fragen beim ersten Start nach. Das ist im Moment normal.',
    guide: 'Schritt für Schritt installieren',
    drawn: 'Gezeichnet, kein Bild aus der App.',
    honest:
      'Nemo ist mit ADHS im Blick entwickelt und hilft beim Anfangen und Dranbleiben. Es ist keine Behandlung und verspricht keine. Jede Hilfe lässt sich einzeln abschalten.',
    kofi: 'Auf Ko-fi unterstützen',
    only: { windows: 'nur Windows', android: 'nur Android', both: 'nur Windows und Android' },
  },
  en: {
    windows: 'Download for Windows',
    android: 'Download for Android',
    windowsSub: 'Portable',
    androidSub: 'APK',
    version: (v: string, d: string) => `Version ${v}, ${d}`,
    warn: 'Windows and Android ask before the first start. For now that is normal.',
    guide: 'Install step by step',
    drawn: 'Drawn, not a picture of the app.',
    honest:
      'Nemo is built with ADHD in mind and helps with starting and keeping going. It is not a treatment and does not promise one. Every aid can be switched off on its own.',
    kofi: 'Support on Ko-fi',
    only: { windows: 'Windows only', android: 'Android only', both: 'Windows and Android only' },
  },
} as const;

const a = {
  de: {
    title: 'Nemo – Entwurf A „Brief“',
    nav: [
      ['Was drin ist', '#drin'],
      ['Wo es liegt', '#liegt'],
      ['Wie es spricht', '#spricht'],
      ['Ausprobieren', '#laden'],
    ],
    kicker: 'Für Windows und Android. Kostenlos, Open Source.',
    h1: 'Dein Alltag in einer App.',
    h1Accent: 'Und die bleibt bei dir.',
    lead: 'Termine, Aufgaben, Geld, Einkaufszettel und Passwörter liegen meist in fünf Apps bei fünf Anbietern. Nemo legt sie in eine ruhige App auf deinem PC und deinem Handy. Ohne Konto, ohne Cloud.',
    day: {
      alt: 'Ein gesetzter Tageszettel: oben hervorgehoben die eine Sache, die jetzt dran ist, darunter je eine Zeile aus Planen, Geld, Haushalt, Wissen und Tresor. Gezeichnet, kein Bild aus der App.',
      nowLabel: 'Jetzt dran',
      now: 'Steuer: Belege heraussuchen',
      nowMeta: 'erster Schritt, 5 Min',
      rows: [
        ['plan', 'Planen', 'Di 10:00 Zahnarzt'],
        ['money', 'Geld', 'Miete, fällig am 1.'],
        ['household', 'Haushalt', 'Milch, Brot, Batterien'],
        ['knowledge', 'Wissen', 'Idee fürs Wochenende'],
        ['vault', 'Tresor', 'Zugang Finanzamt ••••••••'],
      ],
      caption: 'Erfundenes Beispiel. Hier steht später ein Bild der Übersicht.',
    },
    drin: {
      h: 'Was drin ist',
      p: (areas: number, modules: number) =>
        `${areas} Bereiche, ${modules} Module. Am Anfang ist nur das Nötigste eingeschaltet. Den Rest holst du dir aus der Modul-Bibliothek, wenn du ihn brauchst.`,
    },
    liegt: {
      h: 'Wo es liegt',
      p: [
        'Auf deinem Gerät. Nemo hat keinen Server, auf dem deine Einträge landen könnten, und kein Konto, das dir jemand sperren könnte.',
        'Sollen PC und Handy denselben Stand haben, gleichst du sie über einen kleinen Server ab, den du selbst betreibst. Du musst nicht.',
        'Die KI-Hilfe ist aus, bis du sie einschaltest. Dann gehen deine Frage, das Datum und die Feldnamen der Module an den Anbieter, den du wählst. Einträge, Beträge, Namen und Passwörter nie.',
      ],
      link: 'Was ins Netz geht, im Einzelnen',
    },
    spricht: {
      h: 'Wie es mit dir spricht',
      p: [
        'Das merkt man an dem, was fehlt: keine Zähler, die jeden Tag wachsen, keine Serien, die verloren gehen, kein „schon wieder“.',
        'Die Übersicht zeigt eine Sache, die jetzt dran ist, mit dem ersten Schritt und einer Dauer. Der Rest wartet eingeklappt.',
      ],
      alt: 'Zwei Wortpaare, gesetzt wie in einem Korrekturabzug: „Überfällig seit 12 Tagen“ ist durchgestrichen, daneben steht „Wartet noch“. „Planen“ ist durchgestrichen, daneben steht „Anfangen, 5 Min“. Gezeichnet, kein Bild aus der App.',
      pairs: [
        ['Überfällig seit 12 Tagen', 'Wartet noch'],
        ['Planen', 'Anfangen, 5 Min'],
      ],
      not: 'nicht',
      but: 'sondern',
      caption: 'Hier steht später ein Bild der Karte „Jetzt dran“.',
    },
    kostet: {
      h: 'Was es kostet',
      p: 'Nichts. Es gibt keine Premium-Stufe und keine Werbung. Wer mag, gibt einmalig etwas über Ko-fi und bekommt als Dank ein Abzeichen und fünf Farbthemen. Alle Funktionen bleiben für alle offen.',
    },
    laden: { h: 'Ausprobieren' },
  },
  en: {
    title: 'Nemo – draft A “Letter”',
    nav: [
      ['What is inside', '#drin'],
      ['Where it lives', '#liegt'],
      ['How it talks', '#spricht'],
      ['Try it', '#laden'],
    ],
    kicker: 'For Windows and Android. Free, open source.',
    h1: 'Your everyday in one app.',
    h1Accent: 'And it stays with you.',
    lead: 'Appointments, tasks, money, shopping lists and passwords usually sit in five apps at five companies. Nemo puts them into one calm app on your PC and your phone. No account, no cloud.',
    day: {
      alt: 'A typeset note for one day: on top, set apart, the one thing to do now; below it one line each from Plan, Money, Household, Knowledge and Vault. Drawn, not a picture of the app.',
      nowLabel: 'Up now',
      now: 'Taxes: find the receipts',
      nowMeta: 'first step, 5 min',
      rows: [
        ['plan', 'Plan', 'Tue 10:00 dentist'],
        ['money', 'Money', 'Rent, due on the 1st'],
        ['household', 'Household', 'Milk, bread, batteries'],
        ['knowledge', 'Knowledge', 'Idea for the weekend'],
        ['vault', 'Vault', 'Tax office login ••••••••'],
      ],
      caption: 'Invented example. A picture of the overview goes here later.',
    },
    drin: {
      h: 'What is inside',
      p: (areas: number, modules: number) =>
        `${areas} areas, ${modules} modules. Only the essentials are on at the start. You fetch the rest from the module library when you need it.`,
    },
    liegt: {
      h: 'Where it lives',
      p: [
        'On your device. Nemo has no server your entries could end up on, and no account anyone could lock.',
        'If PC and phone should hold the same data, you sync them through a small server you run yourself. You do not have to.',
        'The AI help is off until you switch it on. Then your question, the date and the field names of the modules go to the provider you choose. Entries, amounts, names and passwords never do.',
      ],
      link: 'What goes online, in detail',
    },
    spricht: {
      h: 'How it talks to you',
      p: [
        'You notice it in what is missing: no counters that grow every day, no streaks to lose, no “again”.',
        'The overview shows one thing to do now, with its first step and a duration. The rest waits, folded away.',
      ],
      alt: 'Two pairs of words, set like a proof sheet: “Overdue for 12 days” is struck through, next to it “Still waiting”. “Plan” is struck through, next to it “Start, 5 min”. Drawn, not a picture of the app.',
      pairs: [
        ['Overdue for 12 days', 'Still waiting'],
        ['Plan', 'Start, 5 min'],
      ],
      not: 'not',
      but: 'but',
      caption: 'A picture of the “Up now” card goes here later.',
    },
    kostet: {
      h: 'What it costs',
      p: 'Nothing. There is no premium tier and no advertising. If you like, give once through Ko-fi and get a badge and five colour themes as a thank-you. Every feature stays open to everyone.',
    },
    laden: { h: 'Try it' },
  },
} as const;

const b = {
  de: {
    title: 'Nemo – Entwurf B „Nachweis“',
    nav: [
      ['Was ins Netz geht', '#netz'],
      ['Die App', '#app'],
      ['Selbst prüfen', '#pruefen'],
      ['Installieren', '#installieren'],
    ],
    kicker: 'Alltags-App für Windows und Android',
    h1: 'Deine Daten bleiben auf deinem Gerät.',
    lead: 'Nemo ist Kalender, Aufgaben, Finanzen und Passwort-Tresor in einer App. Ohne Konto, ohne Nemo-Server. Was die App trotzdem ins Netz schickt, steht unten, Zeile für Zeile.',
    files: { get: 'Herunterladen', windowsNote: 'Windows 10 und 11', androidNote: 'Android' },
    schema: {
      alt: 'Schema: Innerhalb einer Linie mit der Aufschrift „Bei dir“ stehen dein PC, dein Handy und, gestrichelt, dein eigener Server. Außerhalb der Linie, unter „Internet“, stehen drei Verbindungen: Update-Check, Wetter und KI, jede mit dem Hinweis, wie sie ausgeschaltet ist oder wird. Gezeichnet, kein Bild aus der App.',
      inside: 'Bei dir',
      pc: ['Dein PC', 'alle Daten, Tresor verschlüsselt'],
      phone: ['Dein Handy', 'dieselben Daten, offline'],
      server: ['Dein eigener Server', 'nur wenn du willst'],
      sync: 'Sync',
      outside: 'Internet',
      lines: [
        ['Update-Check', 'abschaltbar'],
        ['Wetter', 'abschaltbar'],
        ['KI', 'aus, bis du sie einschaltest'],
      ],
    },
    netz: {
      h: 'Was ins Netz geht',
      intro: 'Die häufigsten Fälle. Nichts davon enthält deine Einträge.',
      head: ['Wann', 'Wohin', 'Was', 'Schalter'],
      rows: [
        ['Einmal täglich: Update-Check', 'GitHub', 'Die Anfrage. GitHub sieht deine IP-Adresse.', 'Einstellungen → Updates'],
        ['Wetter, nachdem du einen Ort gewählt hast', 'open-meteo.com', 'Der Ortsname beim Suchen, danach die auf etwa 1 km gerundete Position.', 'Einstellungen → Verbindungen → Wetter'],
        ['Währungsrechner öffnen', 'frankfurter.dev', 'Die Anfrage nach den Kursen.', 'Nur beim Öffnen'],
        ['KI-Assistent', 'Anbieter deiner Wahl', 'Deine Frage, das Datum, die Feldnamen der Module.', 'Aus, bis du einen Schlüssel hinterlegst'],
        ['Sync', 'Dein eigener Server', 'Deine Daten, auf Wunsch Ende-zu-Ende verschlüsselt.', 'Aus, bis du ihn einrichtest'],
      ],
      never: 'Nie:',
      neverText: 'Einträge, Beträge, Namen oder Passwörter an das Projekt. Es gibt keinen Nemo-Server, kein Konto, keine Telemetrie, keine Werbung.',
      link: 'Vollständige Liste aller Verbindungen',
    },
    pruefen: {
      h: 'Prüf es selbst',
      intro: 'Du musst das nicht glauben. Das hier kannst du selbst nachsehen.',
      items: [
        ['Quellcode', 'Offen, MIT-Lizenz. Jede Zeile der App liegt auf GitHub.'],
        ['Updates', 'Mit dem Schlüssel des Projekts signiert und vor dem Einspielen geprüft.'],
        ['Windows-Datei', 'Ohne gekauftes Zertifikat. Deshalb fragt SmartScreen beim ersten Start nach.'],
      ],
      sums: 'Prüfsummen (SHA-256)',
      sumsHint: 'Aus dem GitHub-Release. Stimmt die Summe mit deiner Datei überein, ist es die Datei, die das Projekt gebaut hat.',
      source: 'Quellcode auf GitHub',
    },
    app: {
      h: 'Was die App ist',
      intro: (areas: number, modules: number) => `${areas} Bereiche, ${modules} Module. Du schaltest ein, was du brauchst.`,
      alt: 'Sechs Flächen nebeneinander, eine je Bereich: Planen, Geld, Haushalt, Wissen, Tresor, System. Jede trägt das Muster ihres Bereichs und einen Farbpunkt. Gezeichnet, kein Bild aus der App.',
      head: ['Bereich', 'Module'],
      caption: 'Hier stehen später Bilder aus der App.',
    },
    ruhig: {
      h: 'Ruhig gebaut',
      items: [
        'Die Übersicht zeigt eine Sache, die jetzt dran ist, mit erstem Schritt und Dauer.',
        'Fokus-Modus: eine Aufgabe, ihre Schritte, ein Ring-Timer.',
        'Höchstens drei Erinnerungen pro Stunde, Ruhezeiten nachts. Beides einstellbar.',
        '„Wartet noch“ statt „überfällig seit 12 Tagen“. Keine Serien, die verloren gehen.',
      ],
    },
    install: {
      h: 'Installieren',
      steps: [
        'Datei laden. Windows: eine exe, keine Installation. Android: eine APK.',
        'Windows und Android fragen nach, weil sie den Herausgeber nicht kennen. Die Anleitung zeigt jeden Knopf.',
        'Starten. Kein Konto, keine Anmeldung.',
      ],
    },
    kosten: 'Kostenlos, keine Premium-Stufe. Wer mag, gibt einmalig etwas über Ko-fi.',
  },
  en: {
    title: 'Nemo – draft B “Proof”',
    nav: [
      ['What goes online', '#netz'],
      ['The app', '#app'],
      ['Check it yourself', '#pruefen'],
      ['Install', '#installieren'],
    ],
    kicker: 'Everyday app for Windows and Android',
    h1: 'Your data stays on your device.',
    lead: 'Nemo is calendar, tasks, finances and a password vault in one app. No account, no Nemo server. What the app still sends online is listed below, line by line.',
    files: { get: 'Download', windowsNote: 'Windows 10 and 11', androidNote: 'Android' },
    schema: {
      alt: 'Diagram: inside a line labelled “With you” are your PC, your phone and, dashed, your own server. Outside the line, under “Internet”, are three connections: update check, weather and AI, each with a note on how it is or gets switched off. Drawn, not a picture of the app.',
      inside: 'With you',
      pc: ['Your PC', 'all data, vault encrypted'],
      phone: ['Your phone', 'the same data, offline'],
      server: ['Your own server', 'only if you want'],
      sync: 'Sync',
      outside: 'Internet',
      lines: [
        ['Update check', 'can be switched off'],
        ['Weather', 'can be switched off'],
        ['AI', 'off until you switch it on'],
      ],
    },
    netz: {
      h: 'What goes online',
      intro: 'The most common cases. None of them contains your entries.',
      head: ['When', 'Where to', 'What', 'Switch'],
      rows: [
        ['Once a day: update check', 'GitHub', 'The request. GitHub sees your IP address.', 'Settings → Updates'],
        ['Weather, after you chose a place', 'open-meteo.com', 'The place name while searching, then the position rounded to about 1 km.', 'Settings → Connections → Weather'],
        ['Opening the currency converter', 'frankfurter.dev', 'The request for the rates.', 'Only when opened'],
        ['AI assistant', 'A provider you choose', 'Your question, the date, the field names of the modules.', 'Off until you store a key'],
        ['Sync', 'Your own server', 'Your data, end-to-end encrypted if you want.', 'Off until you set it up'],
      ],
      never: 'Never:',
      neverText: 'entries, amounts, names or passwords to the project. There is no Nemo server, no account, no telemetry, no advertising.',
      link: 'Full list of all connections',
    },
    pruefen: {
      h: 'Check it yourself',
      intro: 'You do not have to take this on trust. You can look these up yourself.',
      items: [
        ['Source code', 'Open, MIT licence. Every line of the app is on GitHub.'],
        ['Updates', 'Signed with the project key and verified before they are applied.'],
        ['Windows file', 'No purchased certificate. That is why SmartScreen asks before the first start.'],
      ],
      sums: 'Checksums (SHA-256)',
      sumsHint: 'From the GitHub release. If the sum matches your file, it is the file the project built.',
      source: 'Source code on GitHub',
    },
    app: {
      h: 'What the app is',
      intro: (areas: number, modules: number) => `${areas} areas, ${modules} modules. You switch on what you need.`,
      alt: 'Six panels side by side, one per area: Plan, Money, Household, Knowledge, Vault, System. Each carries the pattern of its area and a colour dot. Drawn, not a picture of the app.',
      head: ['Area', 'Modules'],
      caption: 'Pictures of the app go here later.',
    },
    ruhig: {
      h: 'Built to be calm',
      items: [
        'The overview shows one thing to do now, with its first step and a duration.',
        'Focus mode: one task, its steps, a ring timer.',
        'At most three reminders an hour, quiet hours at night. Both adjustable.',
        '“Still waiting” instead of “overdue for 12 days”. No streaks to lose.',
      ],
    },
    install: {
      h: 'Install',
      steps: [
        'Get the file. Windows: one exe, no installation. Android: one APK.',
        'Windows and Android ask, because they do not know the publisher. The guide shows every button.',
        'Start. No account, no sign-in.',
      ],
    },
    kosten: 'Free, no premium tier. If you like, give once through Ko-fi.',
  },
} as const;

const c = {
  de: {
    title: 'Nemo – Entwurf C „Ein Tag“',
    nav: [
      ['Ein Tag', '#tag'],
      ['Deine Daten', '#daten'],
      ['Was drin ist', '#drin'],
      ['Ausprobieren', '#laden'],
    ],
    h1: 'Eine Sache zuerst.',
    lead: 'Nemo ist eine ruhige App für das, was im Alltag anfällt: Termine, Aufgaben, Geld, Listen, Passwörter. Sie zeigt dir, was jetzt dran ist. Der Rest wartet.',
    sub: 'Für Windows und Android. Ohne Konto. Deine Daten bleiben auf deinem Gerät.',
    now: {
      alt: 'Skizze der Karte „Jetzt dran“: eine Aufgabe, darunter der Knopf „Anfangen, 5 Min“ und die Wege „Später“ und „Etwas anderes“. Dahinter zwei eingeklappte Zeilen mit „Wartet noch“. Gezeichnet, kein Bild aus der App.',
      label: 'Jetzt dran',
      task: 'Steuer: Belege heraussuchen',
      start: 'Anfangen, 5 Min',
      later: 'Später',
      other: 'Etwas anderes',
      waiting: 'Wartet noch',
    },
    day: {
      h: 'Ein Tag mit Nemo',
      intro: 'Ein erfundener Tag. Die Funktionen gibt es.',
      moments: [
        {
          slot: 'c-morning',
          time: '07:40',
          h: 'Was ist heute?',
          p: 'Die Übersicht zeigt, was jetzt wichtig ist, und den Plan für heute. Mehr nicht.',
          alt: 'Skizze des Tagesplans: drei Zeilen mit Uhrzeit und Titel, 08:00 Medikament nehmen, 10:00 Teammeeting, 13:00 Friseur. Gezeichnet, kein Bild aus der App.',
        },
        {
          slot: 'c-focus',
          time: '10:15',
          h: 'Anfangen',
          p: 'Fokus-Modus: eine Aufgabe, ihre Schritte, ein Ring-Timer mit weichem Ende. Alles andere ist ausgeblendet.',
          alt: 'Skizze des Fokus-Modus: ein Ring, zu zwei Dritteln gefüllt, daneben drei Schritte, der erste abgehakt. Gezeichnet, kein Bild aus der App.',
        },
        {
          slot: 'c-capture',
          time: '13:05',
          h: 'Kurz notiert',
          p: 'Du tippst „morgen 15 Uhr Zahnarzt“. Nemo erkennt Termin und Datum auf deinem Gerät, ohne Netz.',
          alt: 'Skizze der Schnellerfassung: ein Eingabefeld mit „morgen 15 Uhr Zahnarzt“, darunter der erkannte Eintrag: Termin, morgen, 15:00. Gezeichnet, kein Bild aus der App.',
        },
        {
          slot: 'c-money',
          time: '18:30',
          h: 'Was geht ab?',
          p: 'Konten, Rechnungen, Abos und Budgets nebeneinander: was da ist, was abgeht, was fällig wird.',
          alt: 'Skizze der Finanzen: drei Balken für Budgets, Wohnen, Essen und Freizeit, unterschiedlich weit gefüllt. Gezeichnet, kein Bild aus der App.',
        },
      ],
      plan: [
        ['08:00', 'Medikament nehmen'],
        ['10:00', 'Teammeeting'],
        ['13:00', 'Friseur'],
      ],
      steps: ['Ordner holen', 'Belege sortieren', 'Liste abhaken'],
      ring: '16:40',
      capture: { input: 'morgen 15 Uhr Zahnarzt', kind: 'Termin', when: 'morgen, 15:00', what: 'Zahnarzt' },
      budgets: [
        ['Wohnen', 'w4'],
        ['Essen', 'w3'],
        ['Freizeit', 'w2'],
      ],
      night: {
        time: '22:00',
        h: 'Ruhe',
        p: 'Nachts bleibt es still. Tagsüber kommen höchstens drei Erinnerungen pro Stunde. Beides stellst du selbst ein.',
      },
    },
    data: {
      h: 'Und es bleibt bei dir',
      items: [
        ['Kein Konto', 'Nemo fragt nicht nach E-Mail oder Namen.'],
        ['Auf deinem Gerät', 'Alle Daten liegen auf PC und Handy, der Tresor verschlüsselt.'],
        ['Abgleich, wenn du willst', 'Über einen kleinen Server, den du selbst betreibst.'],
        ['KI nur auf Wunsch', 'Sie bekommt deine Frage, nie deine Einträge.'],
      ],
      link: 'Was ins Netz geht',
    },
    drin: {
      h: 'Du schaltest ein, was du brauchst',
      intro: (areas: number, modules: number) => `${areas} Bereiche, ${modules} Module. Am Anfang ist nur das Nötigste an.`,
    },
    laden: {
      h: 'Ausprobieren',
      p: 'Kostenlos, keine Premium-Stufe. Wer mag, gibt einmalig etwas über Ko-fi.',
    },
  },
  en: {
    title: 'Nemo – draft C “One day”',
    nav: [
      ['One day', '#tag'],
      ['Your data', '#daten'],
      ['What is inside', '#drin'],
      ['Try it', '#laden'],
    ],
    h1: 'One thing first.',
    lead: 'Nemo is a calm app for what everyday life brings: appointments, tasks, money, lists, passwords. It shows you what to do now. The rest waits.',
    sub: 'For Windows and Android. No account. Your data stays on your device.',
    now: {
      alt: 'Sketch of the “Up now” card: one task, below it the button “Start, 5 min” and the ways out “Later” and “Something else”. Behind it two folded rows saying “Still waiting”. Drawn, not a picture of the app.',
      label: 'Up now',
      task: 'Taxes: find the receipts',
      start: 'Start, 5 min',
      later: 'Later',
      other: 'Something else',
      waiting: 'Still waiting',
    },
    day: {
      h: 'One day with Nemo',
      intro: 'An invented day. The features exist.',
      moments: [
        {
          slot: 'c-morning',
          time: '07:40',
          h: 'What is today?',
          p: 'The overview shows what matters now and the plan for today. Nothing more.',
          alt: 'Sketch of the plan for the day: three rows with time and title, 08:00 take medication, 10:00 team meeting, 13:00 hairdresser. Drawn, not a picture of the app.',
        },
        {
          slot: 'c-focus',
          time: '10:15',
          h: 'Start',
          p: 'Focus mode: one task, its steps, a ring timer with a soft end. Everything else is hidden.',
          alt: 'Sketch of the focus mode: a ring, two thirds full, next to it three steps, the first ticked. Drawn, not a picture of the app.',
        },
        {
          slot: 'c-capture',
          time: '13:05',
          h: 'Noted quickly',
          p: 'You type “morgen 15 Uhr Zahnarzt” (German phrases for now). Nemo recognises the appointment and the date on your device, without the network.',
          alt: 'Sketch of the quick capture: an input field with the German phrase “morgen 15 Uhr Zahnarzt”, below it the recognised entry: appointment, tomorrow, 15:00. Drawn, not a picture of the app.',
        },
        {
          slot: 'c-money',
          time: '18:30',
          h: 'What goes out?',
          p: 'Accounts, invoices, subscriptions and budgets side by side: what is there, what goes out, what is due.',
          alt: 'Sketch of the finances: three bars for budgets, housing, food and leisure, filled to different lengths. Drawn, not a picture of the app.',
        },
      ],
      plan: [
        ['08:00', 'Take medication'],
        ['10:00', 'Team meeting'],
        ['13:00', 'Hairdresser'],
      ],
      steps: ['Get the folder', 'Sort the receipts', 'Tick the list'],
      ring: '16:40',
      capture: { input: 'morgen 15 Uhr Zahnarzt', kind: 'Appointment', when: 'tomorrow, 15:00', what: 'Zahnarzt' },
      budgets: [
        ['Housing', 'w4'],
        ['Food', 'w3'],
        ['Leisure', 'w2'],
      ],
      night: {
        time: '22:00',
        h: 'Quiet',
        p: 'At night it stays silent. During the day at most three reminders an hour arrive. You set both yourself.',
      },
    },
    data: {
      h: 'And it stays with you',
      items: [
        ['No account', 'Nemo does not ask for an email or a name.'],
        ['On your device', 'All data lives on PC and phone, the vault encrypted.'],
        ['Sync if you want', 'Through a small server you run yourself.'],
        ['AI only on request', 'It gets your question, never your entries.'],
      ],
      link: 'What goes online',
    },
    drin: {
      h: 'You switch on what you need',
      intro: (areas: number, modules: number) => `${areas} areas, ${modules} modules. Only the essentials are on at the start.`,
    },
    laden: {
      h: 'Try it',
      p: 'Free, no premium tier. If you like, give once through Ko-fi.',
    },
  },
} as const;

export const copy = { a, b, c } as const;
export const common = shared;
