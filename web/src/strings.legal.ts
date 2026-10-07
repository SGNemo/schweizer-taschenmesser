import { defineBundle } from '@/core/i18n/bundle';

/**
 * Legal texts (imprint, privacy notices, licences, one-time third-party notices, chat/Google hints), German + English.
 * Source of the data flows: `docs/legal/DATA-FLOWS.md` (ids pinned by `core/legal/legal.test.ts`). Not legal advice.
 */
export const tLegal = defineBundle(
  {
    title: 'Rechtliches',
    imprint: {
      title: 'Rechtliches: Impressum und Kontakt',
      intro: 'Anbieter dieser App und Kontakt für Fragen, auch zum Datenschutz.',
      name: 'Anbieter',
      address: 'Anschrift',
      email: 'E-Mail',
      vatId: 'Umsatzsteuer-ID',
      open: 'Diese Angaben sind noch nicht ausgefüllt.',
      note: 'Nemo ist ein privates, kostenloses Open-Source-Projekt. Unterstützung ist freiwillig und schaltet keine Funktion frei.',
      website: 'Website mit Impressum und Datenschutzerklärung',
    },
    privacy: {
      title: 'Rechtliches: Datenschutzhinweise',
      intro:
        'Nemo hat kein Konto und keinen Server des Betreibers, der Daten der App erhält. Alles liegt auf deinem Gerät. Hier steht, was es wann verlässt: nichts davon passiert ohne dein Einrichten oder deinen Klick, außer der Update-Abfrage und dem Währungsrechner (siehe dort).',
      what: 'Was',
      to: 'An wen',
      when: 'Wann',
      rights:
        'Der Betreiber erhält über die App keine personenbezogenen Daten. Verarbeitet er Daten selbst (Supporter-Dienst, Website), gelten die Hinweise auf der Website. Für alle anderen Empfänger gelten deren eigene Datenschutzregeln. Fragen und Auskunftswünsche an die Kontaktadresse oben.',
    },
    flows: {
      local: {
        title: 'Lokale Speicherung',
        what: 'Alle Einträge, Einstellungen und Zugangsdaten. Schlüssel (API-Schlüssel, Anmeldedaten) liegen im Schlüsselspeicher des Geräts, nicht in der Datenbank.',
        to: 'Niemand. Die Daten bleiben auf diesem Gerät (Browser-Datenbank bzw. Datenordner der App).',
        when: 'Immer. Es gibt kein Konto und keinen Dienst des Betreibers, der Daten der App erhält.',
      },
      sync: {
        title: 'Sync mit deinem eigenen Server',
        what: 'Änderungen deiner Einträge und Einstellungen (Sammlung, Eintrags-Id, Feldname, Zeitstempel, Wert). Mit Passphrase werden die Werte Ende-zu-Ende verschlüsselt; Sammlung, Id, Feld und Zeitstempel bleiben für den Server lesbar. Zugangsdaten, Schlüssel und lokale Stände werden nie übertragen.',
        to: 'Der Server, dessen Adresse du selbst einträgst und betreibst. Kein Dienst des Betreibers von Nemo.',
        when: 'Nur nach dem Verbinden unter Sync & Backup: beim Start, etwa jede Minute, bei Änderungen.',
      },
      push: {
        title: 'Web-Push-Erinnerungen (optional)',
        what: 'Titel, Text und Link der Erinnerungen der nächsten zwei Wochen sowie die Push-Adresse deines Browsers. Mit Passphrase verschlüsselt.',
        to: 'Dein Sync-Server und von dort der Push-Dienst deines Browser-Herstellers (z. B. Google, Mozilla, Apple, Microsoft).',
        when: 'Nur wenn du Push-Erinnerungen einschaltest.',
      },
      ics: {
        title: 'Kalender-Abo (iCal-Adresse)',
        what: 'Eine Abfrage der geheimen iCal-Adresse, die du einträgst. Im Browser läuft sie über deinen Sync-Server, in der Windows- und Android-App direkt. Die geholten Termine werden als Einträge gespeichert (und synchronisiert, wenn du Sync nutzt).',
        to: 'Der Anbieter deines Kalenders; im Browser zusätzlich dein eigener Sync-Server.',
        when: 'Nur wenn du ein Abo einträgst; danach etwa alle 30 Minuten.',
      },
      update: {
        title: 'Update-Abfrage bei GitHub',
        what: 'Eine einfache Abfrage der Versionsdatei und, bei einem Update, der Download. Es werden keine Daten aus der App mitgeschickt; GitHub sieht deine IP-Adresse und die üblichen Verbindungsdaten.',
        to: 'GitHub (github.com, api.github.com). Nur Windows- und Android-App; die Web-App aktualisiert sich selbst.',
        when: 'Beim Start und beim Zurückkehren in die App, höchstens einmal pro Tag. Abschaltbar unter Updates → „Automatisch nach Updates suchen“. Updates sind signiert und werden geprüft.',
      },
      'ai-cloud': {
        title: 'KI-Anbieter (Cloud)',
        what: 'Deine Frage oder dein Satz, das heutige Datum und eine kurze Beschreibung der Felder der aktiven Module (Namen und Typen, keine Inhalte), dazu dein API-Schlüssel im Kopf der Anfrage. Nie deine Einträge. Im Chat geht der Chat-Text an den Anbieter, und Daten aus der App nur, wenn du sie dort nach Vorschau mit „Mit Daten senden“ freigibst. Was du in eine Frage schreibst, geht mit.',
        to: 'Der Anbieter, den du selbst einrichtest (z. B. Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, Mistral oder eine eigene Adresse). Kostenlose Tarife können Eingaben zum Training nutzen; das steht an der Karte des Anbieters.',
        when: 'Nur wenn du einen Anbieter mit Schlüssel eingerichtet hast und die KI eine Anfrage nicht lokal beantworten kann. Alles aus: Einstellungen → KI → „KI abschalten“. Ollama und das eingebaute Modell laufen lokal.',
      },
      'ai-model': {
        title: 'Download des eingebauten Modells (Windows)',
        what: 'Eine Abfrage der Modelldatei, die du vorher bestätigst. Es werden keine Daten aus der App mitgeschickt. Das Modell läuft danach vollständig auf dem Gerät.',
        to: 'Hugging Face (huggingface.co und dessen Download-Server).',
        when: 'Nur nach deiner Bestätigung unter Einstellungen → KI.',
      },
      google: {
        title: 'Google-Verbindung (Windows)',
        what: 'Anmeldung bei Google mit deiner eigenen OAuth-Anwendung (nur Lesen). Kalender: Termine der gewählten Kalender, ab 60 Tage zurück bis 400 Tage voraus. E-Mail: nur auf deinen Klick Absender, Betreff, Datum und Abmelde-Kopfzeile passender Mails, nie der Inhalt. Berechtigungen: calendar.readonly und gmail.readonly, je nach Auswahl.',
        to: 'Google (accounts.google.com, oauth2.googleapis.com, www.googleapis.com, gmail.googleapis.com). Der Betreiber von Nemo erhält nichts.',
        when: 'Nur nach dem Verbinden. Kalender-Abgleich im Hintergrund etwa alle 30 Minuten. Trennen widerruft den Zugriff. Das Zugriffs-Token läuft ab, wenn dein Google-Projekt im Status „Testing“ ist (nach 7 Tagen): dann „Neu anmelden“.',
      },
      supporter: {
        title: 'Supporter-Code und Ko-fi',
        what: 'In der App nichts: der Code wird nur auf dem Gerät geprüft (ohne Netz). Wer über Ko-fi unterstützt, gibt Ko-fi seine Daten; ein kleiner Dienst des Betreibers erhält von Ko-fi die Benachrichtigung (u. a. Betrag und E-Mail-Adresse), verschickt den Code per E-Mail und speichert nur Prüfwerte statt Klartext.',
        to: 'Ko-fi (Zahlung), der Dienst des Betreibers auf Cloudflare Workers und der Mailversand Resend. Die App selbst sendet nichts.',
        when: 'Nur wenn du freiwillig über Ko-fi unterstützt oder auf „Code erneut senden“ klickst. Der Code wird mit deinen Einstellungen synchronisiert, wenn du Sync nutzt.',
      },
      currency: {
        title: 'Währungsrechner',
        what: 'Eine Abfrage der Euro-Wechselkurse ohne Daten aus der App. Die Kurse werden auf dem Gerät zwischengespeichert.',
        to: 'frankfurter.dev (öffentliche Kurse der Europäischen Zentralbank).',
        when: 'Beim Öffnen des Werkzeugs „Währung“.',
      },
      ip: {
        title: 'Öffentliche IP anzeigen (Windows)',
        what: 'Eine Abfrage deiner öffentlichen IP-Adresse. Das Ergebnis wird nur angezeigt.',
        to: 'api.ipify.org.',
        when: 'Nur auf Klick im Modul „Festplatte“.',
      },
      links: {
        title: 'Links in den Browser',
        what: 'Beim Öffnen eines Links (z. B. Kartensuche eines Ortes, WhatsApp-Text für einen Geburtstag, Lesezeichen) übergibt die App die Adresse an deinen Browser; die App selbst lädt nichts.',
        to: 'Das Ziel des Links, z. B. Google Maps oder WhatsApp.',
        when: 'Nur auf deinen Klick.',
      },
    },
    licenses: {
      title: 'Rechtliches: Lizenzen',
      app: 'Nemo steht unter der MIT-Lizenz. Der Quellcode ist öffentlich auf GitHub.',
      appLicense: 'Lizenztext lesen',
      groups: {
        npm: 'Web-Bibliotheken (npm)',
        cargo: 'Bibliotheken der Windows- und Android-App (Cargo)',
        gradle: 'Android-Bibliotheken (Gradle)',
        assets: 'Schriften und Icons',
        models: 'KI-Modelle (werden nur auf Wunsch geladen)',
      },
      count: (n: number) => `${n} Einträge`,
      loading: 'Wird geladen …',
      failed: 'Die Liste konnte nicht geladen werden.',
      note: 'Die Liste wird beim Build aus den Sperrdateien erzeugt und geprüft; unbekannte oder nicht erlaubte Lizenzen brechen den Build ab.',
    },
    notices: {
      ok: 'Verstanden',
      more: 'Nachlesen: Einstellungen → Über Nemo → Rechtliches.',
      'cloud-ai': {
        title: 'Dein KI-Anbieter erhält gleich eine Anfrage',
        body: [
          'Nemo schickt jetzt eine Anfrage an den Anbieter, den du eingerichtet hast. Gesendet werden dein Satz, das heutige Datum und die Feldnamen der Module, nie deine Einträge. Im Chat geht der Chat-Text mit.',
          'Der Anbieter ist ein Dritter mit eigenen Datenschutzregeln. Manche kostenlosen Tarife nutzen Eingaben zum Training. Schreibe deshalb keine Geheimnisse in eine Frage.',
        ],
      },
      'connector-google': {
        title: 'Du verbindest ein Google-Konto',
        body: [
          'Nemo liest mit deiner eigenen Google-Anwendung nur: Kalender (calendar.readonly) und/oder die Köpfe von E-Mails (gmail.readonly), je nach Auswahl. Die Daten gehen von Google direkt an dieses Gerät, nicht an den Betreiber von Nemo.',
          'Google verarbeitet die Anmeldung nach eigenen Regeln. Steht dein Google-Projekt auf „Testing“, läuft die Anmeldung nach 7 Tagen ab; dann hilft „Neu anmelden“. Trennen widerruft den Zugriff.',
        ],
      },
      'connector-ics': {
        title: 'Dein Kalender-Abo wird regelmäßig abgefragt',
        body: [
          'Nemo ruft die iCal-Adresse etwa alle 30 Minuten ab. Solche Adressen sind oft geheime Links: trage sie nur ein, wenn du dem Anbieter vertraust.',
          'Im Browser läuft die Abfrage über deinen eigenen Sync-Server. Die Termine werden als Einträge gespeichert und mit synchronisiert, wenn du Sync nutzt.',
        ],
      },
      supporter: {
        title: 'Unterstützer-Bereich',
        body: [
          'Unterstützung ist freiwillig, nichts in Nemo hängt an einer Zahlung. Der Code wird nur auf diesem Gerät geprüft.',
          'Die Zahlung läuft bei Ko-fi, einem Drittanbieter mit eigenen Datenschutzregeln. Die E-Mail mit dem Code verschickt ein kleiner Dienst des Betreibers über Resend. Nutzt du Sync, wandert der Code mit deinen Einstellungen auf deinen Server.',
        ],
      },
    },
    googleTesting:
      'Ist dein Google-Projekt im Status „Testing“, läuft die Anmeldung nach 7 Tagen ab, und nur eingetragene Testnutzer (höchstens 100) dürfen sich anmelden. Dann steht hier „Abgelaufen“, und „Neu anmelden“ genügt. Auf Dauer hilft der Status „In Produktion“.',
    chat: {
      cloudHint:
        'Solange kein lokales Modell antwortet, verlässt der Text dieses Chats das Gerät und geht an deinen Anbieter.',
      offHint: 'Soll gar nichts das Gerät verlassen?',
      offAction: 'KI abschalten …',
    },
  },
  {
    title: 'Legal',
    imprint: {
      title: 'Legal: imprint and contact',
      intro: 'Who provides this app, and whom to contact with questions, including about privacy.',
      name: 'Provider',
      address: 'Address',
      email: 'Email',
      vatId: 'VAT ID',
      open: 'These details have not been filled in yet.',
      note: 'Nemo is a private, free, open-source project. Support is voluntary and unlocks no feature.',
      website: 'Website with imprint and privacy policy',
    },
    privacy: {
      title: 'Legal: privacy notices',
      intro:
        'Nemo has no account and no server run by its maintainer that receives data from the app. Everything stays on your device. Here is what leaves it, when: none of it happens without your setting it up or clicking, except the update check and the currency tool (see there).',
      what: 'What',
      to: 'To whom',
      when: 'When',
      rights:
        'The maintainer receives no personal data through the app. Where the maintainer processes data (supporter service, website), the notices on the website apply. All other recipients are covered by their own privacy rules. Questions and access requests: use the contact address above.',
    },
    flows: {
      local: {
        title: 'Local storage',
        what: 'All entries, settings and credentials. Keys (API keys, sign-in data) are kept in the device keystore, not in the database.',
        to: 'Nobody. The data stays on this device (browser database or the app data folder).',
        when: 'Always. There is no account and no service run by the maintainer that receives app data.',
      },
      sync: {
        title: 'Sync with your own server',
        what: 'Changes to your entries and settings (collection, entry id, field name, timestamp, value). With a passphrase the values are end-to-end encrypted; collection, id, field and timestamp stay readable for the server. Credentials, keys and local state are never transferred.',
        to: 'The server whose address you enter and run yourself. Not a service run by the maintainer of Nemo.',
        when: 'Only after you connect it under Sync & backup: at start, about every minute, and on changes.',
      },
      push: {
        title: 'Web push reminders (optional)',
        what: 'Title, text and link of the reminders for the next two weeks, plus your browser push address. Encrypted when you use a passphrase.',
        to: 'Your sync server and, from there, your browser vendor’s push service (e.g. Google, Mozilla, Apple, Microsoft).',
        when: 'Only if you turn push reminders on.',
      },
      ics: {
        title: 'Calendar subscription (iCal address)',
        what: 'A request to the secret iCal address you enter. In the browser it goes through your sync server, in the Windows and Android apps directly. The fetched events are stored as entries (and synced if you use sync).',
        to: 'Your calendar provider; in the browser also your own sync server.',
        when: 'Only if you add a subscription; then about every 30 minutes.',
      },
      update: {
        title: 'Update check at GitHub',
        what: 'A plain request for the version file and, for an update, the download. No data from the app is sent; GitHub sees your IP address and the usual connection data.',
        to: 'GitHub (github.com, api.github.com). Windows and Android apps only; the web app updates itself.',
        when: 'At start and when you return to the app, at most once a day. Can be switched off under Updates → “Automatisch nach Updates suchen” (check for updates automatically). Updates are signed and verified.',
      },
      'ai-cloud': {
        title: 'AI provider (cloud)',
        what: 'Your question or sentence, today’s date and a short description of the fields of the active modules (names and types, no contents), plus your API key in the request header. Never your entries. In chat, the chat text goes to the provider, and app data only if you release it there after a preview with “Mit Daten senden” (send with data). Whatever you write in a question goes with it.',
        to: 'The provider you set up yourself (e.g. Anthropic, OpenAI, Google Gemini, Groq, OpenRouter, Mistral or a custom address). Free tiers may use inputs for training; this is shown on the provider’s card.',
        when: 'Only if you have set up a provider with a key and the AI cannot answer a request locally. Everything off: Settings → AI → “KI abschalten” (switch AI off). Ollama and the built-in model run locally.',
      },
      'ai-model': {
        title: 'Download of the built-in model (Windows)',
        what: 'A request for the model file, which you confirm first. No data from the app is sent. Afterwards the model runs entirely on the device.',
        to: 'Hugging Face (huggingface.co and its download servers).',
        when: 'Only after your confirmation under Settings → AI.',
      },
      google: {
        title: 'Google connection (Windows)',
        what: 'Sign-in to Google with your own OAuth application (read only). Calendar: events of the chosen calendars, from 60 days back to 400 days ahead. Email: only when you click, sender, subject, date and unsubscribe header of matching mails, never the content. Permissions: calendar.readonly and gmail.readonly, depending on your choice.',
        to: 'Google (accounts.google.com, oauth2.googleapis.com, www.googleapis.com, gmail.googleapis.com). The maintainer of Nemo receives nothing.',
        when: 'Only after connecting. Calendar sync in the background about every 30 minutes. Disconnecting revokes access. The access token expires if your Google project is in “Testing” status (after 7 days): then use “Neu anmelden” (sign in again).',
      },
      supporter: {
        title: 'Supporter code and Ko-fi',
        what: 'In the app, nothing: the code is only checked on the device (offline). Whoever supports via Ko-fi gives Ko-fi their data; a small service run by the maintainer receives the notification from Ko-fi (among other things amount and email address), sends the code by email and stores only check values instead of plain text.',
        to: 'Ko-fi (payment), the maintainer’s service on Cloudflare Workers and the mail provider Resend. The app itself sends nothing.',
        when: 'Only if you support voluntarily via Ko-fi or click “Code erneut senden” (resend code). The code is synced with your settings if you use sync.',
      },
      currency: {
        title: 'Currency tool',
        what: 'A request for the euro exchange rates without any data from the app. The rates are cached on the device.',
        to: 'frankfurter.dev (public rates of the European Central Bank).',
        when: 'When you open the “Währung” (currency) tool.',
      },
      ip: {
        title: 'Show public IP (Windows)',
        what: 'A request for your public IP address. The result is only displayed.',
        to: 'api.ipify.org.',
        when: 'Only when you click, in the “Festplatte” (disk) module.',
      },
      links: {
        title: 'Links to the browser',
        what: 'When you open a link (e.g. a map search for a place, a WhatsApp text for a birthday, a bookmark), the app hands the address to your browser; the app itself loads nothing.',
        to: 'The target of the link, e.g. Google Maps or WhatsApp.',
        when: 'Only when you click.',
      },
    },
    licenses: {
      title: 'Legal: licences',
      app: 'Nemo is licensed under the MIT licence. The source code is public on GitHub.',
      appLicense: 'Read the licence text',
      groups: {
        npm: 'Web libraries (npm)',
        cargo: 'Libraries of the Windows and Android app (Cargo)',
        gradle: 'Android libraries (Gradle)',
        assets: 'Fonts and icons',
        models: 'AI models (downloaded only on request)',
      },
      count: (n: number) => `${n} entries`,
      loading: 'Loading …',
      failed: 'The list could not be loaded.',
      note: 'The list is generated from the lock files at build time and checked; an unknown or disallowed licence stops the build.',
    },
    notices: {
      ok: 'Understood',
      more: 'Read more: Settings → About Nemo → Legal.',
      'cloud-ai': {
        title: 'Your AI provider is about to receive a request',
        body: [
          'Nemo is now sending a request to the provider you set up. It contains your sentence, today’s date and the field names of the modules, never your entries. In chat the chat text goes along.',
          'The provider is a third party with its own privacy rules. Some free tiers use inputs for training. So do not write secrets into a question.',
        ],
      },
      'connector-google': {
        title: 'You are connecting a Google account',
        body: [
          'With your own Google application, Nemo only reads: calendar (calendar.readonly) and/or email headers (gmail.readonly), depending on your choice. The data goes from Google straight to this device, not to the maintainer of Nemo.',
          'Google processes the sign-in under its own rules. If your Google project is in “Testing” status, the sign-in expires after 7 days; “Sign in again” fixes that. Disconnecting revokes access.',
        ],
      },
      'connector-ics': {
        title: 'Your calendar subscription will be fetched regularly',
        body: [
          'Nemo fetches the iCal address about every 30 minutes. Such addresses are often secret links: only enter one if you trust the provider.',
          'In the browser the request goes through your own sync server. The events are stored as entries and synced too if you use sync.',
        ],
      },
      supporter: {
        title: 'Supporter area',
        body: [
          'Support is voluntary, nothing in Nemo depends on a payment. The code is only checked on this device.',
          'Payment runs through Ko-fi, a third party with its own privacy rules. The email with the code is sent by a small service run by the maintainer via Resend. If you use sync, the code travels with your settings to your server.',
        ],
      },
    },
    googleTesting:
      'If your Google project is in “Testing” status, the sign-in expires after 7 days, and only listed test users (at most 100) can sign in. Then “Abgelaufen” (expired) is shown here, and “Neu anmelden” (sign in again) is enough. In the long run, “In Produktion” (in production) status helps.',
    chat: {
      cloudHint:
        'Unless a local model answers, the text of this chat leaves the device and goes to your provider.',
      offHint: 'Should nothing leave the device at all?',
      offAction: 'Switch AI off …',
    },
  },
);
