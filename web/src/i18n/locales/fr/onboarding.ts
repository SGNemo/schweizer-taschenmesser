import type { Strings } from '@/strings';

export const onboarding: Strings['onboarding'] = {
  button: 'Startdaten einrichten',
  title: (module: string) => `Startdaten: ${module}`,
  chooseIntro:
    'Woher sollen die ersten Einträge kommen? Nichts wird gespeichert, bevor du die Vorschau bestätigt hast.',
  skip: 'Überspringen',
  skipHint: 'Später erreichst du den Assistenten wieder über die Einstellungen des Moduls.',
  back: 'Zurück',
  preview: 'Vorschau anzeigen',
  parsing: 'Wird gelesen …',
  chooseFile: 'Datei wählen …',
  fileChosen: (name: string) => `Datei: ${name}`,
  textLabel: 'Eine Zeile = ein Eintrag',
  pickTemplates: 'Vorschläge auswählen',
  noInput: 'Bitte gib etwas ein.',
  nothingFound: 'Es wurden keine Einträge erkannt.',
  fileTooLarge: 'Die Datei ist zu groß (höchstens 10 MB).',
  readError: 'Die Datei konnte nicht gelesen werden.',
  previewTitle: 'Vorschau',
  previewIntro:
    'Hier siehst du, was gespeichert würde. Entferne das Häkchen bei Einträgen, die du nicht willst.',
  found: (n: number) => (n === 1 ? '1 Eintrag erkannt' : `${n} Einträge erkannt`),
  selectAll: 'Alle auswählen',
  selectNone: 'Keine auswählen',
  duplicate: 'Schon vorhanden',
  change: 'Änderung',
  unchanged: 'Keine Änderung',
  invalid: 'Nicht importierbar',
  importN: (n: number) => (n === 1 ? '1 Eintrag importieren' : `${n} Einträge importieren`),
  importing: 'Wird gespeichert …',
  imported: (n: number) =>
    n === 1 ? '1 Eintrag wurde importiert.' : `${n} Einträge wurden importiert.`,
  undo: 'Import rückgängig machen',
  undone: (removed: number, kept: number) =>
    kept > 0
      ? `${removed} Einträge entfernt. ${kept} wurden inzwischen bearbeitet und bleiben erhalten.`
      : `${removed} Einträge entfernt.`,
  close: 'Schließen',
  recent: 'Zuletzt importiert',
  recentEntry: (source: string, n: number, date: string) => `${source} · ${n} Einträge · ${date}`,
  recentUndone: 'rückgängig gemacht',
  errors: {
    'unknown-collection': 'Der Import passt nicht zu diesem Modul.',
    'nothing-selected': 'Nichts ausgewählt.',
    fallback: 'Das hat nicht geklappt.',
  } as Record<string, string>,
  add: 'Hinzufügen',
  required: 'Bitte ausfüllen.',

  mail: {
    hint: 'Nur mit verbundenem Google-Konto (Einstellungen → Verbindungen). Vorschläge kommen aus Absender, Betreff, Datum und Vorschauzeile; du bestätigst jeden einzelnen.',
    invoices: 'Rechnungen aus E-Mails erkennen',
    subscriptions: 'Abos aus E-Mails erkennen',
    contracts: 'Verträge aus E-Mails erkennen',
    calendar: 'Termine und Tickets aus E-Mails erkennen',
    source: (url: string) => `Aus einer E-Mail erkannt: ${url}`,
    dueUnclear: 'Fälligkeit nicht erkannt – bitte prüfen',
    startUnclear: 'Abbuchungstermin geschätzt – bitte prüfen',
    noAmount: (n: number) =>
      n === 1
        ? '1 Rechnung ohne erkennbaren Betrag wurde übersprungen.'
        : `${n} Rechnungen ohne erkennbaren Betrag wurden übersprungen.`,
    noEnd: 'Vertragsende nicht erkannt',
    notice: (days: number) => `Kündigungsfrist ${days} Tage`,
  },
  ics: {
    exdate: (n: number) =>
      `${n} wiederkehrende Termine hatten Ausnahmetage (einzelne ausgelassene Tage); diese Ausnahmen werden nicht übernommen.`,
    rruleUnsupported: (n: number) =>
      `${n} Termine haben eine Wiederholung, die diese App nicht kennt; sie werden als einzelner Termin importiert.`,
    override: (n: number) => `${n} geänderte Einzeltermine einer Serie wurden übersprungen.`,
    cancelled: (n: number) => `${n} abgesagte Termine wurden übersprungen.`,
    invalid: (n: number) => `${n} Termine ohne gültiges Datum wurden übersprungen.`,
  },
  lines: (skipped: number) =>
    skipped === 1 ? '1 Zeile wurde nicht erkannt.' : `${skipped} Zeilen wurden nicht erkannt.`,
  calendar: {
    ics: 'Kalenderdatei (.ics)',
    icsHint:
      'Exportiere deinen Kalender (z. B. Google Kalender, Outlook, Thunderbird) als .ics-Datei und wähle sie hier aus.',
  },
  todos: {
    text: 'Aufgaben einfügen',
    textHint:
      'Füge eine Liste aus einer Notiz-App oder einer Nachricht ein: eine Zeile pro Aufgabe.',
    placeholder: 'Steuerunterlagen sortieren\nZahnarzt anrufen\nFahrrad reparieren',
    list: 'In diese Liste',
  },
  reminders: {
    textDetail: 'heute, 09:00 Uhr',
    templates: 'Vorlagen für typische Erinnerungen',
    templatesHint:
      'Wähle aus, woran dich die App erinnern soll. Zeiten und Tage kannst du danach ändern.',
    text: 'Erinnerungen einfügen',
    textHint:
      'Eine Zeile pro Erinnerung; sie gilt ab heute um 09:00 Uhr und kann danach angepasst werden.',
    placeholder: 'Reifen wechseln\nGeschenk für Mama besorgen',
    rent: ['Miete überweisen', 'jeden Monat am 1.'],
    trash: ['Mülltonne rausstellen', 'jede Woche, Sonntag 19:00 – Wochentag danach anpassen'],
    insurance: [
      'Kfz-Versicherung vergleichen',
      'jedes Jahr am 1. November (Wechselfrist meist 30.11.)',
    ],
    energy: ['Strom- und Gasvertrag prüfen', 'jedes Jahr am 1. September'],
    tax: ['Steuerunterlagen sammeln', 'jedes Jahr am 1. Juni'],
    dentist: ['Zahnarzt-Vorsorge vereinbaren', 'alle 6 Monate'],
    smoke: ['Rauchmelder testen', 'jedes Jahr am 1. Januar'],
    statements: ['Kontoauszüge prüfen', 'jeden Monat am 1.'],
  },
  finance: {
    account: 'Konto mit Startsaldo anlegen',
    accountHint: 'Für ein weiteres Konto. Das vorhandene Konto änderst du unter Finanzen → Konten.',
    name: 'Kontoname',
    balance: 'Kontostand heute',
    balanceHint: 'z. B. 1.234,56 – bei einem Minus mit „-“.',
    badBalance: 'Bitte einen Betrag wie 1.234,56 eingeben.',
    bank: 'Kontoauszug importieren (CSV oder CAMT)',
    bankHint:
      'Im Online-Banking unter Umsätze exportieren (z. B. „CSV-CAMT“ oder „CAMT“) und die Datei hier auswählen. Die Datei wird nur auf diesem Gerät gelesen.',
    bankAccount: 'Buchen auf Konto',
    noAccounts: 'Lege zuerst ein Konto an.',
    bankFormat:
      'Das Dateiformat wurde nicht erkannt. Erwartet wird eine CSV-Datei mit Buchungstag und Betrag oder eine CAMT-Datei (XML).',
    bankSkipped: (n: number) =>
      n === 1
        ? '1 Zeile ohne gültiges Datum oder Betrag wurde übersprungen.'
        : `${n} Zeilen ohne gültiges Datum oder Betrag wurden übersprungen.`,
    bankTruncated: (n: number) => `Es werden nur die ersten ${n} Buchungen angezeigt.`,
  },
  invoices: {
    form: 'Offene Rechnung erfassen',
    payee: 'Rechnungssteller',
    amount: 'Betrag',
    due: 'Fällig am',
    reference: 'Referenz (optional)',
    badAmount: 'Bitte einen Betrag wie 49,90 eingeben.',
    badDate: 'Bitte ein Datum wie 15.03.2026 eingeben.',
  },
  subscriptions: {
    form: 'Abo erfassen',
    name: 'Name',
    amount: 'Preis pro Abbuchung',
    rhythm: 'Rhythmus',
    monthly: 'monatlich',
    quarterly: 'vierteljährlich',
    yearly: 'jährlich',
    next: 'Nächste Abbuchung am',
    notice: 'Kündigungsfrist in Tagen (optional)',
    badAmount: 'Bitte einen Betrag wie 9,99 eingeben.',
    badDate: 'Bitte ein Datum wie 15.03.2026 eingeben.',
    badNotice: 'Bitte eine ganze Zahl eingeben.',
    bank: 'Abos im Kontoauszug erkennen',
    bankHint:
      'Wähle einen Kontoauszug (CSV oder CAMT, am besten ein Jahr). Die App sucht regelmäßige Abbuchungen mit gleichem Betrag und schlägt sie als Abo vor. Die Datei wird nur auf diesem Gerät gelesen.',
    bankFormat:
      'Das Dateiformat wurde nicht erkannt. Erwartet wird eine CSV-Datei mit Buchungstag und Betrag oder eine CAMT-Datei (XML).',
    bankNone:
      'Es wurden keine regelmäßigen Abbuchungen gefunden. Für die Erkennung braucht es mindestens drei gleiche Abbuchungen im ähnlichen Abstand.',
    seen: (n: number, last: string) => `${n} Abbuchungen, zuletzt am ${last}`,
  },
  bookmarks: {
    html: 'Browser-Lesezeichen (HTML)',
    htmlHint:
      'Exportiere die Lesezeichen in deinem Browser als HTML-Datei (Chrome/Edge: Lesezeichen-Manager → ⋮ → Lesezeichen exportieren). Ordnernamen werden zu Schlagwörtern.',
    text: 'Links einfügen',
    textHint: 'Eine Zeile pro Link, optional mit Titel davor.',
    placeholder: 'https://example.org/artikel\nSchöne Wanderung https://example.org/wandern',
  },
  birthdays: {
    text: 'Geburtstage einfügen',
    textHint: 'Eine Zeile pro Person: Name und Datum, mit oder ohne Jahr.',
    placeholder: 'Anna Beispiel 15.03.1985\nOnkel Max 02.11.\n24.12. Oma',
  },
  lists: {
    text: 'Einkaufsliste einfügen',
    textHint: 'Eine Zeile pro Artikel, Mengen wie „2 Milch“ werden erkannt.',
    placeholder: '2 Milch\nBrot\n500 g Mehl',
    templates: 'Packlisten-Vorlagen',
    templatesHint: 'Fertige Listen für typische Reisen; du kannst sie danach ändern.',
    packingKind: 'Packliste',
    weekend: {
      name: 'Wochenendtrip',
      note: 'Zwei Nächte, Zug und Handgepäck',
      items: [
        'Zahnbürste',
        'Ladekabel',
        'Regenjacke',
        'Wechselkleidung',
        'Bahnticket',
        'Kopfhörer',
        'Sonnenbrille',
        'Buch',
      ],
    },
    camping: {
      name: 'Camping',
      note: 'Drei Tage am See',
      items: [
        'Zelt',
        'Schlafsack',
        'Isomatte',
        'Campingkocher',
        'Stirnlampe',
        'Mückenschutz',
        'Wasserkanister',
        'Taschenmesser',
        'Müllbeutel',
        'Sonnencreme',
      ],
    },
    beach: {
      name: 'Strandurlaub',
      note: '',
      items: ['Badesachen', 'Strandtuch', 'Flip-Flops', 'Sonnenhut', 'Reisepass', 'Reiseapotheke'],
    },
    ski: {
      name: 'Skiwochenende',
      note: '',
      items: [
        'Skijacke',
        'Handschuhe',
        'Skibrille',
        'Thermounterwäsche',
        'Skipass',
        'Lippenpflege',
      ],
    },
  },
};
