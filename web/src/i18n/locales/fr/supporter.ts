import type { Strings } from '@/strings';

export const supporter: Strings['supporter'] = {
  tier: { kaffee: 'Kaffee', kuchen: 'Kuchen', developer: 'Entwickler' },
  section: {
    title: 'Supporter',
    keywords: ['Spende', 'Unterstützen', 'Kaffee', 'Danke', 'Code', 'Ko-fi'],
    intro:
      'Nemo ist kostenlos und bleibt es: Alle Funktionen stehen allen offen. Wenn dir die App gefällt, kannst du freiwillig etwas beitragen, jeder Betrag hilft. Als kleines Dankeschön gibt es rein kosmetische Extras: ein „Danke“-Abzeichen und zusätzliche Farbthemen.',
    donate: 'Freiwillig unterstützen',
    donateHint:
      'Öffnet die Zahlungsseite im Browser. Bezahlt wird nur dort, Nemo verarbeitet keine Zahlungsdaten.',
    codeLabel: 'Supporter-Code',
    codeHint:
      'Den Code bekommst du nach der Spende automatisch per Mail. Füge ihn hier ein, geprüft wird nur auf diesem Gerät.',
    codePlaceholder: 'NEMO1-…',
    paste: 'Einfügen',
    pasteFailed: 'Einfügen war nicht möglich. Füge den Code direkt ins Feld ein.',
    save: 'Code übernehmen',
    invalid: 'Dieser Code passt leider nicht. Bitte prüfe, ob er vollständig kopiert wurde.',
    accepted: 'Danke! Der Code wurde übernommen.',
    statusTitle: 'Dein Status',
    tierLabel: 'Stufe',
    nameLabel: 'Name',
    issuedLabel: 'Ausgestellt am',
    notSupporter: 'Noch kein Code eingegeben. Das ist völlig in Ordnung, nichts fehlt dir.',
    remove: 'Code entfernen',
    removed: 'Code entfernt. Du kannst ihn jederzeit wieder eingeben.',
    unrecognised:
      'Ein gespeicherter Code wird von dieser App-Version nicht erkannt. Aktualisiere die App oder gib den Code erneut ein.',
    sidebarBadge: 'Danke-Abzeichen in der Seitenleiste',
    sidebarBadgeHint: 'Zeigt dezent die Stufe unter dem Logo.',
    noMail: 'Nichts erhalten? Schau auch im Spam-Ordner nach.',
    resend: 'Code erneut senden',
    contact: 'Kontakt aufnehmen',
    linkOpen: 'Öffnen',
  },
  aboutRow: {
    label: 'Nemo unterstützen',
    description: 'Freiwillig, mit kosmetischen Extras als Dankeschön.',
    open: 'Mehr erfahren',
  },
  badge: {
    thanks: 'Danke',
    thanksName: (name: string) => `Danke, ${name}`,
  },
  palette: {
    label: 'Farbthema',
    hintSupporter: 'Rein optisch, jederzeit zurück zum Standard.',
    hintLocked:
      'Zusätzliche Farbthemen sind ein kleines Dankeschön für Unterstützer. Ausprobieren geht trotzdem: Ein Klick zeigt das Thema 30 Sekunden lang.',
    standard: 'Standard',
    names: {
      korallenriff: 'Korallenriff',
      tiefsee: 'Tiefsee',
      sand: 'Sand',
      nordlicht: 'Nordlicht',
      monochrom: 'Monochrom',
    },
    choose: (name: string) => `Farbthema ${name} wählen`,
    tryOut: (name: string) => `Farbthema ${name} 30 Sekunden ansehen`,
    locked: 'Für Unterstützer',
    previewing: (name: string) => `Vorschau: ${name}`,
    previewEnd: 'Vorschau beenden',
    accentFollows: 'Das Farbthema legt die Akzentfarbe fest.',
  },
  logo: {
    label: 'Logo in Themenfarbe',
    hint: 'Der Fisch übernimmt die Akzentfarbe.',
    hintLocked: 'Für Unterstützer.',
  },
};
/** Labels of AI actions and collections as the write preview shows them (the schema sent to the model stays German). */
