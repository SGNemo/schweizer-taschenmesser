# QA-Bericht: Nemo aus Sicht von Priya

## Persona
- Priya, 41, selbstständige Beraterin; Windows-Laptop mit zwei Monitoren plus Android-Flaggschiff.
- Kommt von Notion, Todoist, Bitwarden und einer Banking-App; will Massenbearbeitung, Verknüpfungen, Export, Regeln, Tastenkürzel.
- Ziele: Zeiterfassung pro Kunde, Rechnungen und Budgets, Verträge und Garantien, Kalender mit vielen Terminen, Merkliste und Notizen, Passwort-Tresor mit Browser-Erweiterung, KI-Eintragen und KI-Chat mit eigenem Token.
- Würde den Sync-Server selbst einrichten, bewertet aber den Aufwand.
- Anspruchsvoll, schnell, Tastatur-Fan.

## Rahmen
- **Build:** `develop` @ `4af432d`, Version 1.0.0 (Dev-Build `VITE_RELEASE_CHANNEL=dev` mit Testdaten `medium`, danach `large`; stabiler Build per `npm run build && npm run preview` für die frische Installation; Sync-Server `server/` lokal, liefert die PWA mit aus).
- **Plattformen:** Desktop (Chromium headless, 1920×1080, 1440×900, 1280×720, 640×800), Handy-Viewport 412×915 mit Touch. **Nicht testbar:** die Windows-Exe, die Android-APK, die Brave-Erweiterung, das lokale KI-Modell, echte KI-Anbieter (Testumgebung ohne Internet), Benachrichtigungen (im Browser „Nicht erlaubt“), Biometrie, Spotify/Google.
- **Datum:** 29.10.2026. **Dauer:** rund 1 Std 15 Min aktive Testzeit (skriptgesteuerter Browser, kein echter Tagesablauf über viele Stunden).
- **Tiefe:** Gründlich geprüft: Einrichtung, Übersicht, Schnell-Erfassung, KI-Eintragen, ToDos, Finanzen und Kontoauszug-Import, Rechnungen, Unterlagen, Tresor-Oberfläche, Sync zwischen zwei Geräten, Backup/Wiederherstellung, Einstellungen, Tastenkürzel, Theme/Sprache, Offline. Nur überflogen: Notizen, Merkliste, Listen, Vorräte, Personen, Abos, Budgets (Screenshots und Übersicht-Widgets). KI-Chat nicht inhaltlich getestet.
- Alle Eingaben sind erfunden; Screenshots zeigen Testdaten.

## Kurzfassung
- **Fehler:** 1 hoch, 4 mittel, 15 niedrig (20 insgesamt). Nichts bricht die App; der größte Fund ist die zusammengequetschte ToDos-Seite am Desktop (B01).
- **Größte Lücken für Priya** (Verbesserungen, nicht Fehler): keine Zeiterfassung (V01), kein Kunden-Bezug über Module hinweg (V02), keine Ausgangsrechnungen (V03), kein Export je Modul (V04), keine Mehrfachauswahl (V05).
- **Szenario-Zählung (Klicks/Eingaben, geschätzt aus dem Test):** ToDo per „N“ oder „Neu“: 2–3 Schritte; Termin per Satz „morgen 15 Uhr Zahnarzt“: 3 Schritte (Neu, tippen, Enter); Rechnung von Hand: Neu → Chip „Rechnung“ → Empfänger, Betrag, Datum → Speichern (5–6); Sync mit zweitem Gerät: 4 Felder und 1 Klick je Gerät; Kontoauszug-Import: 6 Klicks bis zur Vorschau, weil der Weg über die Modul-Bibliothek führt; Zeit für einen Kunden erfassen: nicht möglich.

## Fehler
### B01 · ToDos-Seite am Desktop auf eine 240-px-Spalte gequetscht, Titel brechen Buchstabe für Buchstabe um

- **Schwere:** hoch · **Häufigkeit:** immer · **Plattform:** Desktop (1280–1920 px), stabiler Build und Dev-Build; Handy-Viewport unauffällig
- **Schritte:**
  1. Modul-Bibliothek → „ToDos einschalten“ (bzw. Dev-Build mit Testdaten), dann ToDos öffnen.
  2. Fenster 1440×900 oder 1920×1080.
  3. Zwei ToDos anlegen oder die überfälligen Einträge der Testdaten ansehen.
- **Erwartet:** Liste nutzt die Inhaltsbreite wie Kalender und Finanzen; Titel stehen lesbar in einer Zeile.
- **Tatsächlich:** Liste, Eingabefeld und „Wartet noch“-Karte sind nur 240 px breit, rechts bleibt über 1000 px leer. Das Eingabefeld zeigt „Neue Aufg…“, das Label „ToDo hinzufügen“ bricht um, überfällige Einträge zeigen je einen Buchstaben pro Zeile (neben „Auf heute“). Lange Titel werden nach zwei Zeilen mit „…“ abgeschnitten.
- **Screenshot:** [30-todos.png](screenshots/30-todos.png), [31-todos-1440.png](screenshots/31-todos-1440.png), [32-todos-stable.png](screenshots/32-todos-stable.png)

### B02 · Schnell hinzufügen: „Rechnung …“ und „… Ausgabe“ landen als ToDo, Betrag wird nicht erkannt, Endzeit und Priorität werden ignoriert

- **Schwere:** mittel · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. „Neu“ klicken.
  2. „Rechnung Hosting 49,90 fällig 5.11.“ tippen: Ziel steht auf „ToDos“, nur das Datum wird erkannt.
  3. „Kaffee 3,80 Ausgabe“ tippen: Ziel „ToDos“, kein Betrag.
  4. „Workshop Kunde Müller am 12.11. 14:00 bis 16:00“: Ziel „Kalender“, Datum und 14:00, aber das Ende 16:00 fehlt in der Vorschau.
  5. „Angebot an Kunde Schmidt schicken bis Freitag !hoch“: Datum stimmt, die Priorität „!hoch“ wird nicht erkannt.
- **Erwartet:** Das Wort „Rechnung“ bzw. „Ausgabe“ und eine Zahl mit € oder Komma wählen Rechnung bzw. Buchung mit Betrag; Endzeit und Priorität werden übernommen.
- **Tatsächlich:** Das Ziel muss von Hand umgeschaltet werden, und es ist nicht sichtbar, ob der Betrag beim Umschalten erhalten bleibt (nicht geprüft).
- **Screenshot:** [22-neu-menu.png](screenshots/22-neu-menu.png)

### B03 · „Mit KI eintragen“ macht aus einem Satz mit zwei Vorgängen einen einzigen Rechnungseintrag mit Fließtext im Empfängerfeld

- **Schwere:** mittel · **Häufigkeit:** immer · **Plattform:** Desktop (ohne KI-Anbieter, nur Regeln)
- **Schritte:**
  1. Finanzen → „Mit KI eintragen“.
  2. Eingeben: „Rechnung an Kunde Müller GmbH, Beratung Oktober, 2.400 € netto, fällig 15.11., außerdem Workshop mit Müller am 12.11. um 14 Uhr“.
  3. Enter, Vorschau lesen.
- **Erwartet:** Zwei Vorschläge (Rechnung, Termin) mit Empfänger „Müller GmbH“; „netto“ als Hinweis.
- **Tatsächlich:** Ein Vorschlag „Rechnung anlegen“, Empfänger = „Kunde Müller GmbH, Beratung Oktober, netto, fällig , außerdem Workshop mit Müller am 12.11.“. Der Termin geht verloren. Gut: Die Vorschau fängt es ab („Es wird erst etwas gespeichert, wenn du bestätigst“). Mit echtem Anbieter nicht prüfbar (kein Netz in der Testumgebung).
- **Screenshot:** [49-ki-eintragen-result.png](screenshots/49-ki-eintragen-result.png)

### B04 · Kontoauszug-Import verwirft den Auftraggeber/Empfänger und bietet weder Konto noch Kategorie in der Vorschau

- **Schwere:** mittel · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Modul-Bibliothek → Finanzen → „Startdaten einrichten“ → „Kontoauszug importieren“.
  2. Eine Semikolon-CSV mit Spalten Buchungstag;Wertstellung;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Betrag;Währung wählen (6 erfundene Zeilen).
- **Erwartet:** Titel enthält die Gegenpartei („Müller GmbH“), Vorschau zeigt Konto und vorgeschlagene Kategorie, Doppelte werden markiert.
- **Tatsächlich:** 6 Einträge werden erkannt (Beträge und Daten richtig), aber nur der Verwendungszweck erscheint („Rechnung 2026-041 Beratung Oktober“). „Müller GmbH“ ist nirgends zu sehen, keine Kategorie, keine Konto-Auswahl, kein Duplikat-Hinweis in der Vorschau.
- **Screenshot:** [102-bank-import-preview.png](screenshots/102-bank-import-preview.png)

### B05 · Verpasste Kündigungsfrist wird nicht als solche markiert: Vertrag mit „Kündigen bis“ in der Vergangenheit steht nur auf „Bald“

- **Schwere:** mittel · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Unterlagen öffnen (Testdaten, heute 29.10.).
  2. „Fitnessstudio · Ende: 7. Nov. 2026 · Kündigen bis: Sa., 24. Okt.“ ansehen.
  3. Ebenso „Handyvertrag · Kündigen bis 20. Okt.“, „Wartungsvertrag Heizung · Kündigen bis 26. Aug.“.
- **Erwartet:** Hinweis „Kündigungsfrist verpasst“ bzw. Sortierung/Status nach der Frist, nicht nur nach dem Vertragsende.
- **Tatsächlich:** Status „Bald“, Sortierung nach Ende. Wer Verträge wegen der Frist verwaltet, sieht die gerissene Frist nicht. Beim Wartungsvertrag lag die Frist 2 Monate zurück.
- **Screenshot:** [43-vault.png](screenshots/43-vault.png)

### B06 · Einrichtung: Fortschrittszahlen widersprechen sich und durchgeklickte Schritte gelten als „Erledigt“

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Einrichtung starten, alle 12 Schritte nur mit „Weiter“ durchgehen (nichts einrichten).
  2. Zusammenfassung und Übersicht-Karte ansehen.
- **Erwartet:** Zusammenfassung zeigt, was wirklich eingerichtet ist; Zahlen stimmen überein.
- **Tatsächlich:** Dialog: „Schritt x von 12“. Karte auf der Übersicht danach: „10 von 11 Schritten erledigt“. KI-Anbieter, Konten verknüpfen, Startdaten, Import per KI stehen auf „Erledigt“, obwohl nichts eingerichtet wurde. Nur der Schritt „Benachrichtigungen“ steht auf „Übersprungen“.
- **Screenshot:** [04-after-setup.png](screenshots/04-after-setup.png), [05-dashboard-fresh.png](screenshots/05-dashboard-fresh.png)

### B07 · Einrichtung Schritt 6: Beim Spotify-Block steht der Kalender-Hinweistext

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Einrichtung → Schritt 6 „Konten verknüpfen“.
  2. Unter „Spotify“ den Hinweis lesen.
- **Erwartet:** Hinweis zu Spotify (Anmeldung nur in der Windows-App).
- **Tatsächlich:** „… Auf dem Handy und im Browser kommen die Termine über die Synchronisierung oder über ein Kalender-Abo (ICS).“ – von Termine ist bei Spotify keine Rede.

### B08 · Profil „Finanz-Fokus“ schaltet ToDos, Timer und QR-Code aus; die Karte nennt das nicht

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Einrichtung → Schritt 3 → „Finanz-Fokus“ wählen.
  2. Liste „Das ändert sich“ lesen.
- **Erwartet:** Die Beschreibung auf der Karte nennt, was abgeschaltet wird, oder ein Profil schaltet nur ein.
- **Tatsächlich:** Karte: „Finanzen, Budgets, Abos, Rechnungen, Verträge – dazu Kalender und Erinnerungen.“ Erst darunter: „Wird deaktiviert: ToDos“ und „Werkzeuge aus: Timer & Stoppuhr, QR-Code“, dazu ein Pflicht-Häkchen. Außerdem trägt jede Karte den Profilnamen doppelt (Titel und gleichnamiger Button).
- **Screenshot:** [03-setup-profile.png](screenshots/03-setup-profile.png)

### B09 · Einstellungen: „Benachrichtigungen“ und „Nicht erlaubt“ überlappen in der Seitenleiste

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop 1440 px
- **Schritte:**
  1. Einstellungen öffnen, Fenster 1440×900.
- **Erwartet:** Beschriftung und Status stehen getrennt.
- **Tatsächlich:** „BenachrichtigungenNicht erlaubt“ läuft ineinander.
- **Screenshot:** [55-ki-add-claude.png](screenshots/55-ki-add-claude.png)

### B10 · Modul-Einstellungen zeigen unbeschriftete Rohwerte („Felder: Monat · 09:00 · 09:00“) und je Modul zwei gleiche Buttons „Startdaten einrichten“

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Einstellungen → Module (bzw. Zahnrad „Dieses Modul anpassen“).
  2. Die Zeilen von Kalender, Personen, Rechnungen, Unterlagen lesen.
- **Erwartet:** Jeder Wert mit Namen („Ansicht: Monat · Erinnerung 09:00“).
- **Tatsächlich:** „Felder: 0 · 09:00“ (Personen), „Felder: 30 · 14 · 09:00“ (Unterlagen), „Felder: 2 · 09:00“ (Rechnungen). Man weiß nicht, was 0, 2, 30, 14 bedeuten. „Startdaten einrichten“ steht doppelt je Modul.
- **Screenshot:** [99-module-settings-finance.png](screenshots/99-module-settings-finance.png)

### B11 · „Verbindung testen“ meldet nur „Test fehlgeschlagen: Nicht erreichbar“

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Einstellungen → KI → Anbieter „Claude (Anthropic)“ wählen, Schlüssel eintragen, Speichern.
  2. „Verbindung testen“, Hinweis „Verstanden“.
- **Erwartet:** Ursache unterscheiden: kein Netz / Schlüssel abgelehnt / Zertifikat / Browser blockiert.
- **Tatsächlich:** Eine Meldung für alles. Hinweis: In der Testumgebung gab es kein echtes Netz (Zertifikatsfehler im Proxy), echte Antworten eines Anbieters konnte ich nicht prüfen. Ein Test mit echtem Token fehlt daher im Bericht.
- **Screenshot:** [57-ki-test-result.png](screenshots/57-ki-test-result.png)

### B12 · Sync-Zähler passen nicht zur Erwartung: „Zuletzt: 6 empfangen, 0 gesendet“ nach dem Schreiben, „9 empfangen“ auf dem zweiten Gerät bei „2 Einträgen“ auf dem Server

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop, Handy-Viewport
- **Schritte:**
  1. Gerät A: Sync verbinden, ein ToDo anlegen, „Jetzt synchronisieren“.
  2. Gerät B verbinden.
- **Erwartet:** Zähler zeigen gesendete und empfangene Einträge nachvollziehbar.
- **Tatsächlich:** Gerät A meldet „6 empfangen, 0 gesendet“, obwohl es der Absender war; Server zeigt „2 Einträge“. Daten kamen auf B korrekt an. Zahlen sind nicht deutbar.
- **Screenshot:** [53-sync-connected.png](screenshots/53-sync-connected.png), [62-phone-synced.png](screenshots/62-phone-synced.png)

### B13 · Schwebender „+“-Knopf überdeckt Felder am unteren Rand von Formularen (Passphrase-Feld im Sync-Formular)

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Handy-Viewport 412×915
- **Schritte:**
  1. Handy-Viewport, Einstellungen → Sync & Backup, nach unten bis „Passphrase“ scrollen.
- **Erwartet:** Knopf verdeckt keine Eingabe.
- **Tatsächlich:** Der Knopf liegt auf dem rechten Ende des Passphrase-Feldes (Auge/Text).
- **Screenshot:** [61-phone-sync-section.png](screenshots/61-phone-sync-section.png)

### B14 · Kalender bei 640 px Breite: „Erinnerungen“ im Umschalter abgeschnitten („Remind…“)

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop-Fenster 640 px
- **Schritte:**
  1. Kalender, Fenster auf 640 px verkleinern (englische Oberfläche).
- **Erwartet:** Beschriftung vollständig.
- **Tatsächlich:** Segment-Beschriftung wird abgeschnitten, „Advanced“-Schalter rückt daneben.
- **Screenshot:** [93-narrow-640.png](screenshots/93-narrow-640.png)

### B15 · Bestätigungs-Toasts stapeln sich („ToDo hinzugefügt.“ doppelt) und verschwinden nicht von selbst

- **Schwere:** niedrig · **Häufigkeit:** manchmal · **Plattform:** Desktop
- **Schritte:**
  1. ToDos: zwei Aufgaben schnell hintereinander anlegen.
- **Erwartet:** Ein Toast, der sich selbst schließt oder ersetzt wird.
- **Tatsächlich:** Zwei gleiche Toasts übereinander, jeder mit „Schließen“.
- **Screenshot:** [32-todos-stable.png](screenshots/32-todos-stable.png)

### B16 · „Mit KI eintragen“ öffnet ein Fenster mit dem Titel „Befehlspalette“; ohne Anbieter trägt es per Regeln ein

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Finanzen → „Mit KI eintragen“.
- **Erwartet:** Fenstertitel passt zum Knopf; ohne Anbieter steht „ohne KI, Regeln“.
- **Tatsächlich:** Titel „Befehlspalette“, erste Zeile „Eintragen“, zweite „Mit KI fragen“. Erst im Ergebnis zeigt ein kleiner Chip „Regeln · 0 Token“, dass keine KI beteiligt war.
- **Screenshot:** [48-ki-eintragen.png](screenshots/48-ki-eintragen.png), [49-ki-eintragen-result.png](screenshots/49-ki-eintragen-result.png)

### B17 · Hinweis zur Lesehilfe: „Einschalten“ und „Nicht jetzt“ sehen aus wie Fließtext, nicht wie Knöpfe

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop
- **Schritte:**
  1. Frische Installation, Übersicht ansehen.
- **Erwartet:** Erkennbare Knöpfe.
- **Tatsächlich:** Beide Wörter stehen fett am Zeilenende ohne Rahmen; ebenso „Später nicht mehr“ beim Wetter.
- **Screenshot:** [01-fresh-start.png](screenshots/01-fresh-start.png)

### B18 · Englisch: überfällige Rechnung zeigt „for 12 days“ statt „12 days overdue“

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop, Englisch
- **Schritte:**
  1. Einstellungen → Allgemein → Language: English.
  2. Invoices öffnen.
- **Erwartet:** „12 days overdue“.
- **Tatsächlich:** „⚠ for 12 days“ – ohne „overdue“ unklar.
- **Screenshot:** [92-dark-english-invoices.png](screenshots/92-dark-english-invoices.png)

### B19 · README sagt „The app interface is German today; more languages are on the way“, die App hat fünf Sprachen

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** README/Website
- **Schritte:**
  1. README lesen.
  2. In der App Einstellungen → Allgemein → Sprache öffnen: Deutsch, English, Español, Français, Português (Brasil).
- **Erwartet:** README stimmt mit der App überein.
- **Tatsächlich:** Aussage veraltet; wirkt, als wäre Englisch nicht möglich.

### B20 · Konsolenfehler beim Start der frischen Installation: „Failed to load resource: net::ERR_CONNECTION_REFUSED“

- **Schwere:** niedrig · **Häufigkeit:** immer · **Plattform:** Desktop, stabiler Build
- **Schritte:**
  1. Frische Installation im Browser öffnen, Konsole ansehen (Playwright-Log).
- **Erwartet:** Keine Fehler ohne Verbindungswunsch.
- **Tatsächlich:** Ein fehlgeschlagener Netzwerkaufruf beim Start (Ursache nicht geklärt, vermutlich Update-/Kursabfrage; in der Testumgebung gibt es kein Internet). Für Nutzer nicht sichtbar.

## Verbesserungen
### V01 · Zeiterfassung pro Kunde und Projekt

- **Nutzen für Priya:** hoch
- **Situation:** Priya rechnet Beratung nach Stunden ab und will wissen, was sie diese Woche für wen gearbeitet hat.
- **Problem heute:** Es gibt kein Zeit-Modul. „Timer & Stoppuhr“ (F8) ist ein loses Werkzeug: keine Zuordnung zu Kunde oder ToDo, die gemessene Zeit wird nicht gespeichert. Die Modul-Bibliothek hat keinen Eintrag dafür.
- **Vorschlag:** Modul „Zeit“: Start/Stopp per Tastenkürzel, Kunde/Projekt/Tätigkeit, nachträgliche Einträge, Wochenübersicht, Summen, CSV-Export, Option „aus ToDo starten“. Läuft lokal; Dashboard-Widget „Heute erfasst“ ohne Druck (kein Ziel-Balken).
- **Anregung:** Toggl Track, Todoist-Integrationen

### V02 · Kunden/Projekte als gemeinsames Merkmal in allen Modulen

- **Nutzen für Priya:** hoch
- **Situation:** Zu „Müller GmbH“ gehören Termine, ToDos, Rechnungen, Verträge, Notizen und Zeiten; Priya will alles auf einen Blick.
- **Problem heute:** Es gibt Personen (nur Geburtstage/Geschenke) und je Modul eigene Kategorien. Verknüpfungen zwischen Einträgen verschiedener Module fehlen; die Module importieren sich bewusst nicht gegenseitig.
- **Vorschlag:** Ein „Kunde/Projekt“-Feld über die Modulgrenzen (über Events/Manifest-Beiträge), Kundenseite mit zugehörigen Einträgen, Filter „nur Kunde X“ in Kalender, ToDos, Finanzen, Unterlagen, Suche.
- **Anregung:** Notion Relations

### V03 · Ausgangsrechnungen (Rechnungen an Kunden) statt nur Eingangsrechnungen

- **Nutzen für Priya:** hoch
- **Situation:** Priya schreibt Rechnungen an Kunden und will Zahlungseingang und Überfälligkeit sehen.
- **Problem heute:** „Rechnungen“ meint Rechnungen, die man bezahlen muss („Empfänger“, „Als bezahlt markieren“ bucht eine Ausgabe, offene Summe wird vom „verfügbar“ abgezogen). Trägt sie dort Kundenrechnungen ein, rechnet Nemo ihr Geld ärmer statt reicher (aus Beschreibung und Anzeige abgeleitet, nicht mit eigener Buchung durchgespielt).
- **Vorschlag:** Richtung je Rechnung (zahlen / bekommen), Nummernkreis, Kunde, Netto/MwSt/Brutto, PDF-Erzeugung, Zahlungseingang bucht eine Einnahme, überfällige Forderungen im Widget „Jetzt wichtig“.
- **Anregung:** Lexoffice, Zervant

### V04 · CSV-/ICS-Export je Modul statt nur Gesamt-Backup

- **Nutzen für Priya:** hoch
- **Situation:** Priya gibt ihrer Steuerberaterin die Buchungen eines Quartals und wechselt Termine in andere Kalender.
- **Problem heute:** Export gibt es nur als Gesamt-Backup (JSON, auch verschlüsselt) und den Tresor als Bitwarden-CSV. Die Einstellungssuche nach „CSV“ und „Export“ findet nichts für Buchungen, ToDos oder Termine. Kalender-Abo ist nur Import.
- **Vorschlag:** In jeder Liste „Exportieren“ (CSV, bei Terminen ICS), mit Filter (Zeitraum, Kunde, Konto). Passt zu Local-First, Daten gehören dem Nutzer.
- **Anregung:** Todoist-Export, Google Takeout

### V05 · Mehrfachauswahl und Massenbearbeitung

- **Nutzen für Priya:** hoch
- **Situation:** Priya will 15 überfällige ToDos auf nächste Woche schieben oder 20 Buchungen einer Kategorie zuordnen.
- **Problem heute:** Zeilenmenüs gelten für einen Eintrag (ToDos: Später, Fällig am, Priorität, Duplizieren, Löschen; Buchungen: Kategorie, Löschen). Es gibt keine Checkboxen oder Shift-Klick. Einzige Sammelhilfe: „Neu planen“ bei überfälligen ToDos.
- **Vorschlag:** Mehrfachauswahl (Shift/Ctrl-Klick, Strg+A) mit Sammelaktionen: Datum, Priorität, Kategorie, Kunde, Löschen mit Rückgängig.
- **Anregung:** Todoist, Gmail

### V06 · Regeln für Kategorien beim Bankimport

- **Nutzen für Priya:** hoch
- **Situation:** Jeden Monat 80 Buchungen importieren; „Hosting AG“ ist immer „Betriebskosten“.
- **Problem heute:** Beim Import keine Kategorievorschläge und keine lernenden Regeln; Auftraggeber wird verworfen (B04).
- **Vorschlag:** Regeln „Empfänger enthält X → Kategorie Y / Kunde Z“, aus einer Korrektur ableitbar („Immer so zuordnen?“), Vorschau zeigt Treffer.
- **Anregung:** YNAB, Firefly III

### V07 · Kontoauszug-Import dort anbieten, wo man ihn sucht

- **Nutzen für Priya:** hoch
- **Situation:** Monatsanfang: Priya will den Auszug ihrer Bank einlesen.
- **Problem heute:** Der Import steckt unter Modul-Bibliothek → Finanzen → „Startdaten einrichten“ → „Kontoauszug importieren“ (vier Klicks, Bezeichnung „Startdaten“ passt nicht zu „jeden Monat“). Auf der Finanzen-Seite gibt es keinen Import-Knopf. Ohne Spaltenzuordnung, Konto-Wahl und Duplikatprüfung in der Vorschau.
- **Vorschlag:** Knopf „Kontoauszug importieren“ in Finanzen → Buchungen, Spaltenzuordnung merken, Konto wählen, bereits vorhandene Buchungen ausgrauen.
- **Anregung:** Firefly III Importer

### V08 · Tastenkürzel auffindbar und anpassbar machen

- **Nutzen für Priya:** mittel
- **Situation:** Priya arbeitet am Laptop mit zwei Monitoren fast ohne Maus.
- **Problem heute:** Die App kann viel (N neu erfassen, G dann P/G/A/W/T zu einem Bereich, J/K und Pfeile in Listen, E bearbeiten, Leertaste abhaken, / Liste durchsuchen, Strg+Z, Strg+K), aber nur durch Zufall mit „?“ zu finden: Einstellungen → Tastenkürzel zeigt nur die Funktionstasten F2–F10 (neu, suchen, Übersicht, Fokus, Werkzeuge, Einstellungen) und „T, dann …“. Die Buchstabenkürzel stehen dort nicht und lassen sich nicht umbelegen. „G, dann P“ öffnet den zuletzt benutzten Reiter des Bereichs, nicht gezielt den Kalender. Auf Laptops brauchen F-Tasten oft Fn.
- **Vorschlag:** Hinweis „? = Tastenkürzel“ im Kopf oder in der Suche, Buchstabenkürzel in den Einstellungen anzeigen und umbelegen (auch mit Strg/Alt), direktes Springen zu einem Modul („G, K“ für Kalender).
- **Anregung:** Todoist, Gmail, Linear

### V09 · Dateianhänge optional verschlüsselt in Sync und Backup

- **Nutzen für Priya:** hoch
- **Situation:** Verträge und Garantien als PDF am Laptop ablegen und unterwegs am Handy vorzeigen.
- **Problem heute:** „Dateien bleiben nur auf diesem Gerät“: nicht im Sync, nicht im Backup (Hinweis in Unterlagen). Handy zeigt „Datei nur auf einem anderen Gerät“. Wer das Backup einspielt, verliert die Anhänge, ohne dass das beim Export deutlich wird.
- **Vorschlag:** Schalter „Dateien mit synchronisieren“ (Ende-zu-Ende verschlüsselt, Größenlimit, Auswahl je Unterlage); im Backup optional als Archiv.
- **Anregung:** Bitwarden Anhänge (Premium)

### V10 · Browser-Erweiterung auch für Chrome, Edge und Firefox, ohne Entwicklermodus

- **Nutzen für Priya:** hoch
- **Situation:** Priya benutzt Bitwarden im Browser und will umsteigen.
- **Problem heute:** Laut Anleitung nur Brave, als entpackte Erweiterung im Entwicklermodus laden, nur mit laufender Desktop-App, nur Windows. Ich konnte die Erweiterung in der Testumgebung nicht ausführen.
- **Vorschlag:** Veröffentlichung im Chrome-Web-Store/Edge-Add-ons (signiert, automatische Updates), Chrome und Edge zuerst. Fortschritt ohne Cloud: Sicherheit bleibt (nur nativ).
- **Anregung:** Bitwarden

### V11 · Wiederholungen, Farben und Kundenzuordnung im Kalender

- **Nutzen für Priya:** mittel
- **Situation:** Termine „alle 14 Tage Dienstag“, Kundentermine farblich getrennt.
- **Problem heute:** Wiederholung nur täglich/wöchentlich/monatlich/jährlich, Ende und Ort hinter „Mehr Felder“, keine Terminfarbe/Kategorie. Monatsansicht schneidet Titel ab („18:00 Termin …“); Terminhäufung zeigt „+6 weitere“.
- **Vorschlag:** „Alle N Wochen“, Wochentage wählbar, Kategorien/Farben, Ende ohne Umweg im Hauptformular, Titel im Monatsfeld auf Wunsch zweizeilig.
- **Anregung:** Google Kalender

### V12 · Währung je Konto/Rechnung statt fest Euro

- **Nutzen für Priya:** mittel
- **Situation:** Zwei Kunden zahlen in CHF und USD.
- **Problem heute:** Einstellungen → Allgemein → Währung: „Fest eingestellt: Euro (€)“. Das Währungs-Werkzeug rechnet, speichert aber nichts.
- **Vorschlag:** Währung je Konto und je Rechnung, Kurs zum Buchungstag (EZB-Kurse sind schon als Werkzeug vorhanden).
- **Anregung:** Firefly III

### V13 · Übersicht für große Monitore und Kenner: alle Widgets, mehrspaltig, überfällige Rechnungen sichtbar

- **Nutzen für Priya:** mittel
- **Situation:** Morgens ein Blick auf 1920 px: was ist fällig, was kommt Geld, was steht an.
- **Problem heute:** Standard zeigt ein Widget („Heute“) auf halber Breite und „Mehr anzeigen · 16 Widgets“. Überfällige Rechnungen und das überschrittene Budget stehen eingeklappt unter „Wartet noch · 4“, während „Jetzt wichtig“ ein Medikament zeigt.
- **Vorschlag:** Option „Immer alle Widgets zeigen“ und Spaltenzahl; Rechnungen überfällig in „Jetzt wichtig“ wählbar. Ruhige Voreinstellung bleibt, die Option ist freiwillig.
- **Anregung:** Notion Dashboards

### V14 · KI-Zugang einmal einrichten und auf Geräten wiederverwenden

- **Nutzen für Priya:** mittel
- **Situation:** Eigener Claude-Schlüssel am Laptop und am Handy.
- **Problem heute:** Schlüssel nur auf dem Gerät, nicht synchronisiert, nicht im Backup: auf jedem Gerät neu eintragen. Standard-Kostenlimit: 2 US-Dollar pro Monat, ohne Hinweis beim Anlegen. Reihenfolge der Anbieter mit Pfeilen (kein Ziehen).
- **Vorschlag:** Optional verschlüsselter Schlüsseltransfer per QR/Datei zwischen eigenen Geräten. Widerspricht dem heutigen Grundsatz „Schlüssel nie synchronisiert“; als Wunsch notiert, nur mit eigenem Weg ohne Server. Kostenlimit beim Anlegen anzeigen.
- **Anregung:** Bitwarden-QR-Login

### V15 · Berufsprofil und Schnellstart in der Einrichtung

- **Nutzen für Priya:** mittel
- **Situation:** Priya will in unter 5 Minuten loslegen.
- **Problem heute:** 12 Schritte, davon etliche für Dinge, die sie nie nutzt (Spotify, Spracheingabe, Konten verknüpfen). Profile: Alltag, Finanz-Fokus, Produktiv, Minimal; keines für Selbstständige.
- **Vorschlag:** Oben „Schnell starten“ (Profil + Fertig); Profil „Selbstständig“ (Kalender, ToDos, Rechnungen, Finanzen, Unterlagen, Tresor, Notizen, Zeit).
- **Anregung:** Notion-Vorlagen

### V16 · Schnell hinzufügen: Betrag, Endzeit, Dauer, Priorität, #Kunde erkennen und beim Tippen farbig markieren

- **Nutzen für Priya:** mittel
- **Situation:** „Hosting 49,90 fällig 5.11.“, „Workshop Müller 12.11. 14–16 Uhr“.
- **Problem heute:** Siehe B02. Es ist nicht erkennbar, welcher Teil des Satzes verstanden wurde.
- **Vorschlag:** Erkannte Teile als Chips (Datum, Betrag, Prio, Kunde) mit Klick zum Ändern.
- **Anregung:** Todoist Quick Add

### V17 · KI-Einstellungen: Anbieter einrichten vor dem roten Abschalten-Kasten

- **Nutzen für Priya:** niedrig
- **Situation:** Erster KI-Besuch in den Einstellungen.
- **Problem heute:** Ganz oben steht „KI abschalten“ (rot), der Anbieter-Dialog erst weiter unten. Ein neuer Anbieter ist sofort „Aktiv“ und „Bezahlt“, bevor ein Schlüssel eingetragen ist.
- **Vorschlag:** Reihenfolge umdrehen; Abschalten nach unten.

### V18 · Erinnerungsliste: Gruppen „Weitere Erinnerungen · 4“ aufklappbar und Knöpfe beschriften

- **Nutzen für Priya:** niedrig
- **Situation:** Morgens 28 offene Erinnerungen abarbeiten.
- **Problem heute:** Zeilen „Weitere Erinnerungen · 12“ sind kein erkennbarer Inhalt; der Haken pro Zeile hat keine sichtbare Beschriftung; Sortierung zeigt zuerst das Älteste („Gestern 07:30“).
- **Vorschlag:** Gruppen aufklappbar, Beschriftung „Erledigt“, Sortierung nach Dringlichkeit wählbar.

## Was gut ist (bitte nicht wegoptimieren)
1. **Sync-Einrichtung ist leicht.** Server mit einer Umgebungsvariablen starten, in der App Adresse, Token, Gerätename, Passphrase eintragen, „Verbinden“. Der Server liefert die PWA gleich mit, die Adresse wird vorgeschlagen, Ende-zu-Ende ist vorausgewählt, eine Geräteliste mit „Sperren“ und ein Konflikt-Bereich sind da. Daten kamen auf dem zweiten (Handy-)Gerät sofort an.
2. **Backup und Wiederherstellung mit Vorschau.** „Das passiert bei der Wiederherstellung“ (neu/ersetzt/gelöscht), automatische Sicherheitskopie vorher, „Zusammenführen“ oder „Ersetzen“, verschlüsselter Export mit klarer Fehlermeldung („Falsches Passwort – oder die Datei wurde verändert“) und Mindestlängen-Hinweis.
3. **Schnell hinzufügen in Alltagssprache** („morgen 15 Uhr Zahnarzt“ → Kalender, Datum, Uhrzeit), mit Vorschau und „Strg+Enter öffnet das ganze Formular“. Nichts wird ohne Bestätigung gespeichert.
4. **Tastatur:** Strg+K, N, „G dann …“, J/K, E, Leertaste, „/“, Strg+Z, dazu „?“ als Übersicht und belegbare F-Tasten und „T, dann …“ für Werkzeuge. Für Priya ein Wechselgrund.
5. **Löschen mit Rückgängig** („ToDo gelöscht. Rückgängig“) und Strg+Z als Kürzel.
6. **Offline funktioniert**: Seite neu laden ohne Netz, ToDo anlegen, alles da (Service Worker).
7. **Tresor mit Bitwarden-CSV** (Import und Export), verschlüsseltem Export, Passwort ändern; Klartext-Export erfordert ein ausdrückliches Häkchen mit Warntext.
8. **KI-Datenschutz verständlich**: vor dem ersten Aufruf ein Hinweisfenster („Dein KI-Anbieter erhält gleich eine Anfrage“, was gesendet wird, Dritter mit eigenen Regeln), „KI komplett abschalten“, Limits je Anbieter, Verbrauchsanzeige, Vorschläge nur mit Bestätigung.
9. **Handy-Layout** ist sauber: untere Leiste, große Ziele, dieselben Daten, ToDos in voller Breite (anders als am Desktop, B01).
10. **Übersicht-Karten mit Kontext**: „11.343,09 € verfügbar“ unter dem Kontostand (nach offenen Rechnungen und Abos), „1.067,84 € offen · 2 überfällig“, Frist-Karte „3 abgelaufen · 9 bald“. Rot nur bei Überfälligem.
11. **Einstellungssuche** („Export“, „Zeit“, „Tastenkürzel“ führen zur richtigen Stelle), Dunkelmodus mit gutem Kontrast, fünf Sprachen, Zahlen- und Datumsformat getrennt von der Sprache.
12. **Kontoauszug-Import liest CSV und CAMT** mit Vorschau und Häkchen je Zeile; Beträge und Daten im deutschen Format stimmten bei sechs Testzeilen.

## Verständnis
- **„Wartet noch“** (ToDos und Übersicht) für überfällige Aufgaben. Klingt nach „warte auf jemanden“. Vorschlag: „Überfällig“ als sichtbare Bezeichnung, die freundliche Zeile darunter bleibt.
- **„Erweitert“-Schalter** (Kalender, Finanzen, Rechnungen). Priya weiß nicht, was er zeigt (in Finanzen kommt der Reiter „Kategorien“ hinzu, in Rechnungen „Mehr Felder“). Vorschlag: Untertitel oder Tooltip „zeigt Kategorien, mehr Felder“.
- **„Eingang“ / „Eingang sortieren“ / „1 Ding wartet auf einen Platz“** bei ToDos ohne Datum: unklar, was „Platz“ ist. Vorschlag: „Ohne Datum – jetzt einplanen“.
- **„Tresor“ (Bereich) – „Unterlagen“ – „Accounts“ – „Passwort-Tresor“**: Der Bereich heißt Tresor, das Passwortmodul heißt aber „Accounts“; die Übersicht-Karte „Passwort-Tresor“. Vorschlag: Modul „Passwörter“ nennen.
- **„Startdaten einrichten“** für Importe, die man jeden Monat braucht. Vorschlag: „Importieren“.
- **„Schema für KI kopieren“**: Priya versteht erst nach dem Lesen der Hilfe, dass sie das Schema in einen KI-Chat einfügen soll. Vorschlag: Kurzsatz „In deinen KI-Chat einfügen, Antwort hier zurückholen“.
- **„Ziel: ToDos“** (Chip im Schnell-Hinzufügen) und **„Regeln · 0 Token“**: nicht deutbar. Vorschlag: „Wird gespeichert in: ToDos“ und „ohne KI erkannt“.
- **„Felder: 0 · 09:00“** in den Modul-Einstellungen (B10).
- **„Zufällige Erinnerung“** und **„Weitere Erinnerungen · 4“** in der Erinnerungsliste: unklar, was passiert.
- **„Lesehilfe hebt Wortanfänge hervor“**: erst nach dem Einschalten sichtbar, was gemeint ist; Vorschau-Satz im Hinweis wäre klarer.
- **„Nur auf einem leeren Server möglich“** bei Ende-zu-Ende-Verschlüsselung, wenn man ein zweites Gerät verbindet: Priya muss raten, ob sie die Passphrase vom ersten Gerät wiederverwenden soll (es war so). Vorschlag: „Zweites Gerät? Gleiche Passphrase wie auf dem ersten eingeben.“
- **Symbole ohne Beschriftung**: Haken in der Erinnerungsliste, „…“ in ToDo-Zeilen. Tooltips ergänzen.
- **„Anheften…“** unten in der Übersicht: unklar, was angeheftet wird.
- Das **Modul „Beispiel“** erscheint im Dev-Build in der Seitenleiste (Wissen); im stabilen Build nicht, daher kein Fund.

## Tagesurteil
**Würde Priya die App weiter benutzen?** Als Ergänzung ja, als Arbeitswerkzeug noch nicht. Behalten würde sie Nemo für Passwörter und Verträge mit Kündigungsfristen, für Budgets, den privaten Kalender und die Merkliste. Der Datenschutz, die Tastatur und der selbst gehostete Sync überzeugen sie. Ihre Arbeit als Beraterin bildet Nemo aber nicht ab.

**Der eine Grund zum Deinstallieren (genauer: nicht zu wechseln):** Es gibt keine Zeiterfassung pro Kunde und keine Rechnungen *an* Kunden (V01, V03). Solange sie dafür Toggl, Notion oder Todoist weiterführen muss, bleibt Nemo die zweite App. Die gequetschte ToDos-Seite am Desktop (B01) würde sie am ersten Tag stören, wäre aber ein Fall für ein Update.

**Wie oft würde sie die App öffnen?** Morgens zur Übersicht und tagsüber für Schnell-Erfassung per Tastatur: etwa 5–10 Mal pro Tag, wenn Kunden, Zeit und Rechnungen darin lägen; ohne sie 1–2 Mal.

## Anhang
- Maschinenlesbar: [findings.json](findings.json) (20 Fehler, 18 Verbesserungen).
- Screenshots: [screenshots/](screenshots/).
- Testumgebung: Headless-Chromium über Playwright, Sync-Server lokal, kein Internet; Zeitzone UTC. Zeiten aus Dev-Server (Vite) sind nicht aussagekräftig; die Testdaten „groß“ (ca. 5.200 Buchungen, 550 Termine) luden in rund 8 s und blieben bedienbar.
