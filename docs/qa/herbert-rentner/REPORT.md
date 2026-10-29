# QA-Bericht: Herbert (68, pensionierter Lehrer), Windows-PC, großer Monitor

| | |
|---|---|
| **Persona** | Herbert, 68, pensionierter Lehrer. Windows-PC mit großem Monitor, Maus und Tastatur. Altes Android, selten benutzt. |
| **Ziele** | Termine (Arzt, Familie), Rechnungen und Verträge mit Kündigungsfristen, Dokumente mit Ablauf (Pass, TÜV), Geburtstage, Passwörter, Notizen, PC aufräumen. |
| **Wesen** | Liest gern Anleitungen, wenig Geduld mit kleiner Schrift, Fachwörtern und Englisch. Misstrauisch bei Internet, Konto, KI, Berechtigungen. Angst, etwas Falsches zu löschen. |
| **Plattformen** | Desktop über den laufenden Dev-Build (Vite, Chromium auf Linux, 1920×1080, deutsches Gebietsschema, aber englische Browser-Systemtexte). Android nur als Viewport 412×915, kurz geprüft. Windows-exe **nicht** getestet. |
| **Build** | `develop` @ `4af432df` (29.10.2026, Version 1.0.0). Zwei Zustände: (1) frische App ohne Daten (`vite`, Einrichtung von vorn) und (2) Dev-Preview-Flavour mit Testdaten `medium` (`VITE_RELEASE_CHANNEL=dev`). Zusätzlich Produktions-Build (`vite build` + `preview`) für den Offline-Test. |
| **Datum / Dauer** | 29.10.2026, rund 3 Stunden (Schätzung). Ausschließlich erfundene Eingaben (Herbert K., „Augenarzt Dr. Weber“, „Zeitungsabo Heimatblatt“ …). |

## Kurzfazit

- **16 Fehler**: 0 blocker, 3 hoch, 1 mittel, 12 niedrig. **19 Verbesserungen** (5 mal hoch, 11 mal mittel, 3 mal niedrig).
- Die App überzeugt Herbert bei Unterlagen, Rechnungen, Personen, Tresor und Backup, auch weil sie ehrlich mit Datenschutz umgeht. Die Hürden liegen vorne (zu lange, KI-lastige Einrichtung, Schritt 3 hängt), in der Lesbarkeit (kleine Grauschrift) und an drei Stellen im Kern seines Alltags: Termine fehlen im Standard-Überblick, verpasste Kündigungsfristen bleiben unmarkiert, Unterlagen lassen sich ohne Rückfrage löschen.
- **Nicht getestet**: „Dieser PC“ (nur Windows-App), Windows-Tray und globale Tastenkürzel, native Benachrichtigungen und Dateidialoge, Sync mit zweitem Gerät, echtes Android-Gerät. Ich habe die Anleitungen dazu nur als Nutzer gelesen (README, Website-Texte, Installation, Modulübersicht).

## 1. Erster Eindruck (ca. 10 Minuten)

**Website/README gelesen.** Die Website-Texte („Alles Wichtige an einem Ort. Und nur bei dir.“, „Kein Konto“, „Kostenlos, kein Tracking“) beruhigen Herbert sofort. Er versteht: Kalender, Aufgaben, Geld, Passwörter, offline. Er stolpert über „ADHS“ (die Website nennt Fokus-Hilfen „für volle Köpfe“; er fragt sich, ob die App für ihn gedacht ist) und über die Installation („SmartScreen“, „Trotzdem ausführen“, „WebView2“, „APK“): Das ist richtig erklärt, klingt aber für einen vorsichtigen Menschen riskant. Ein Bild „so sieht die Warnung aus“ würde helfen. In der README steht „Die App-Oberfläche ist heute Deutsch; weitere Sprachen sind in Arbeit“, die App kennt aber schon fünf Sprachen. Veraltet.

**Start (frische App).** Die Übersicht zeigt oben die Karte „Willkommen bei Nemo“ mit einer Zeile in winziger Grauschrift: „Die Lesehilfe hebt Wortanfänge hervor … Einschalten / Nicht jetzt“. Herbert versteht nicht, was eine Lesehilfe ist, und liest den Satz zweimal. Darunter „Wetter: Stadt wählen · Später nicht mehr“. Rechts ist über die Hälfte der Fläche leer ([Bild](screenshots/01-erststart.png)).

**Einrichtung** (12 Schritte, ca. 8 Minuten): 1 Grundlagen · 2 Sync und Wiederherstellung · 3 Profil und Module · 4 Werkzeugkasten · 5 KI-Anbieter · 6 Konten verknüpfen (Google, Kalender-Abo, Spotify) · 7 Startdaten · 8 Import per KI · 9 Benachrichtigungen · 10 Backup und Updates · 11 Übersicht · 12 Nemo unterstützen. Herbert bricht nicht ab, weil es „Überspringen“ und ein X gibt, aber bei Schritt 3 hängt er (B01), bei 5, 6 und 8 hat er Angst (KI, Google-Konto, „Import per KI“). Beruhigend: „Nichts wird verbunden“, „Ich möchte keine KI nutzen“, „Alles ist optional“. Die Berechtigung „Benachrichtigungen“ wird erklärt („damit Erinnerungen dich erreichen“), mit Rückweg: gut.

## 2. Eigene Ziele: Szenarien mit Aktionszählung

Eine „Aktion“ ist ein Klick, eine Eingabe in ein Feld oder ein Tastendruck.

| Ziel | Weg | Aktionen | Hänger / Frage |
|---|---|---|---|
| Arzttermin eintragen | Kalender → „Neuer Termin“ → Titel, Datum, Uhrzeit, Ort, „1 Tag vorher“ → Speichern | 8 (Schnellerfassung: Neu → ein Satz → Speichern = 3) | Beim Speichern in einem anderen Monat keine sichtbare Bestätigung (V10). „Mehr Felder“ war leicht zu finden. |
| Rechnung erfassen | (Modul einschalten: Modul-Bibliothek → Schalter → „Überspringen“, 3 Aktionen) · Rechnungen → „Rechnung hinzufügen“ → Empfänger, Betrag, Fällig → Speichern | 6 + 3 | „Startdaten“-Fenster mit „JSON einfügen“ stört (Begriff). Betrag „0,00“ ohne €. |
| Vertrag mit Kündigungsfrist | Unterlagen → „Unterlage hinzufügen“ → Titel, Kategorie, Anbieter, Ende, Frist (Tage) → Speichern | 8 | „Tage vor Ende“ muss selbst gerechnet werden (V03). Ergebnis „Kündigen bis: Do., 31. Dez.“ korrekt. |
| Pass / TÜV | wie Vertrag, ohne Frist | 6 | Keine Kategorie „Fahrzeug“; Warnschwelle „Bald“ unklar (V16). |
| Geburtstag | Personen → „Person hinzufügen“ → Name, Geburtsdatum → Speichern | 5 | Sehr klar: „wird 12 · in 136 Tagen“. |
| Passwörter | Modul einschalten (3) · „Accounts“ → 2× Master-Passwort → „Tresor erstellen“ → „Zugang hinzufügen“ → 4 Felder → Speichern → anklicken | 13 | „Accounts“ statt „Passwörter“, Funkel-Symbol am Passwortfeld (V14). Nach jedem Neuladen wieder entsperren (richtig). |
| Notiz | Notizen → „Notiz hinzufügen“ → Titel, Text → Speichern | 5 | Lange Links ohne Leerzeichen sprengen die Karte (B06). |
| PC aufräumen | – | – | **Nicht testbar** (V08). |
| Sicherung erstellen | Einstellungen → Sync & Backup → Passwort → „Verschlüsselt exportieren“ | 4 | Dateiname `nemo-backup-2026-10-29.enc.json`, Speicherort wählt der Browser/Windows. |
| Sicherung zurückspielen | Datei wählen → Passwort → „Öffnen“ → „Backup prüfen“ → „Importieren“ | 6 | Funktioniert; Fachwörter (V09). |


Screenshots: [Termin](screenshots/41b-neuer-termin-de.png) · [Unterlage](screenshots/51-unterlage-dialog.png) · [Rechnung](screenshots/83-rechnung-dialog.png) · [Person](screenshots/82-person-gespeichert.png) · [Zugang](screenshots/75-zugang-hinzufuegen.png) · [Backup](screenshots/134-backup-vorschau.png).

## 3. Ein ganzer Tag (Dev-Daten, Uhr gesetzt)

- **07:45 Morgenüberblick:** „Jetzt wichtig: 2 ToDos heute fällig · Medikament nehmen heute um 08:00“, Karte „Heute“ mit „in 15 Min · 08:00 Medikament nehmen“. Im Standard fehlen aber Teammeeting und Friseur (V01). Nach „Mehr anzeigen“ ist alles da, sehr nützlich: Kontostand, fällige Rechnungen (Stadtwerke 87,40 € seit 12 Tagen), Geburtstage, Fristen.
- **Drei spontane Erfassungen** über „Neu“ (F2): „morgen 15 Uhr Zahnarzt Dr. Beispiel Kontrolle“ → Kalender, 30. Okt., 15:00 (richtig). „Hustenbonbons und Tee“ → Einkaufsliste. „Steuerunterlagen sortieren am Freitag“ → ToDo, 30. Okt. (richtig). Je 3 Aktionen, jeweils „Rückgängig“.
- **Erinnerung:** Die Glocke zeigt „12“ (alles „Gestern“); Herbert versteht „Weitere Erinnerungen · 3“ nicht (V12). Der Erinnerungs-Dialog („Zum Beginn“, „1 Tag vorher“) ist klar.
- **Ein Modul intensiv:** Unterlagen (19 Karten). Filter-Chips, Suche, Sortierung nach „Kündigen bis“. Positiv: Dateien bleiben lokal, das steht dabei. Negativ: B02, B03.
- **18:30 Abschluss:** „Tag abschließen · 3 Sachen sind noch offen · Auf morgen schieben“. Ruhig und verständlich.
- **Wie oft öffnet Herbert die App?** Realistisch 1× morgens (Termine, Fristen) und 1× abends (Rechnungen, Notizen); eine dritte Gelegenheit (Erfassen) wäre über F2 oder das Tray-Symbol, nicht getestet. Mit V01 (Termine sofort) wäre die Morgenroutine tragfähig.

## 4. Grenzen ausprobiert

| Versuch | Ergebnis |
|---|---|
| Langer Text (300 Zeichen, ein Wort; Notiztext mit 1.440 Zeichen und Leerzeichen) | Mit Leerzeichen sauber gekürzt „…“, ohne Leerzeichen sprengt die Karte die Seite (B06). |
| Viele Einträge (Testdaten `medium`: 19 Unterlagen, 40+ ToDos, Kalender mit 9 und mehr Einträgen pro Tag) | Liste und Kalender bleiben flüssig. Monatsansicht zeigt „+5 weitere“ und kürzt Titel bei 11 px (V05). |
| Abbrechen mittendrin (Esc, Klick daneben) | Verwirft Eingabe ohne Rückfrage (B04). Pflichtfeld leer: Browser-Hinweis („Please fill out this field“ – englisch dank Test-Browser). |
| Offline (Produktions-Build, Netz aus, Neuladen) | App lädt, Eingaben werden gespeichert. In der Dev-Variante (Vite) funktioniert Offline nicht, das ist normal. |
| Fenster klein ziehen (1024, 640, 412 px) | Kein waagerechtes Scrollen. Unter ca. 640 px wechselt das Layout zur Handy-Leiste unten. Umschalter im Kalender abgeschnitten (B07), Suchfeld bei 412 px winzig (B08). |
| Sprache wechseln (Deutsch ↔ English) | Wirkt sofort, keine deutschen Reste auf Übersicht, Einstellungen, Unterlagen. Das Passwort-Modul heißt auf Englisch „Passwords“, auf Deutsch „Accounts“ (V14). Spanisch/Französisch/Portugiesisch nicht angesehen. |
| Theme wechseln (Hell/Dunkel) | Dunkel sauber lesbar, Toast „Farbschema: Dunkel · Rückgängig“ ([Bild](screenshots/100-dunkel-kalender.png)). |
| Textgröße „Sehr groß“ | Seiten brechen nicht, Kalender kürzt stärker (V05, [Bild](screenshots/63-sehr-gross-kalender.png)). |
| Löschen und Wiederherstellen | Löschen von Unterlagen ohne Rückfrage/Rückgängig (B02). Schnellerfassung hat „Rückgängig“. Kein Papierkorb (V06). |
| Backup erstellen und einspielen | Funktioniert (19 Einträge inkl. Module, falsches Passwort wird erkannt). Nach Import wieder „Willkommen bei Nemo“ (B16). |
| Sync | Nicht getestet (kein zweites Gerät, Server nicht gestartet). |
| Uhrzeit setzen (07:45 / 18:30) | Morgen- und Abendansicht funktionieren (Playwright-Uhr). |

## 5. Unerwartete Wege

- **Einstellungen** (11 Gruppen): gut sortiert, hilfreiche Suche. Die Gruppe „Benachrichtigungen“ ist beschriftet unleserlich (B05). Das Fenster „KI abschalten“ fragt vor dem Löschen nach und wirkt sofort.
- **Modul-Bibliothek**: verständliche Karten, aber „Beispiel (Entwickler)“ und Schalter-Beschriftung (B12).
- **Werkzeugkasten**: Rechner, Währung, Timer, QR-Code (laut Karte). Über „Werkzeuge“ in der Kopfzeile erreichbar; dort nur vier Einträge plus „Werkzeuge verwalten“. Unauffällig, aber verständlich.
- **Hilfetexte**: das Fragezeichen neben „Lesen“ und im Tresor ist da; einen Eintrag „Hilfe/Anleitung“ habe ich in der App nicht gefunden (V19), auch „Über Nemo“ enthält keinen Link.
- **Fehlerdialoge**: Passwort-Mismatch klar („Die Passwörter stimmen nicht überein.“), falsches Backup-Passwort klar.

## Fehler

### B01 · Einrichtung Schritt 3: „Weiter“ nach Profilwahl gesperrt, der Grund liegt unsichtbar weit unten
- **Schwere:** hoch · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Einrichtung
- **Schritte:**
  1. Frische Installation öffnen, „Einrichtung starten“.
  2. Schritt 1 und 2 mit „Weiter“ bestätigen.
  3. In Schritt 3 auf „Alltag“ klicken.
- **Erwartet:** Entweder wird das Profil sofort übernommen, oder neben „Weiter“ steht, was fehlt.
- **Tatsächlich:** Sichtbar ändert sich nur der Knopf „Alltag“ (leicht grau). „Weiter“ wird ausgegraut. Die Box „Das ändert sich“ mit dem Pflicht-Häkchen „Ich habe die Änderungen geprüft …“ liegt erst nach etwa einem Bildschirm Scrollen. Kein Hinweis, warum nichts mehr geht.
- **Screenshot:** [03-setup-03b-nach-alltag.png](screenshots/03-setup-03b-nach-alltag.png) · [03-setup-03c-weiter-gesperrt.png](screenshots/03-setup-03c-weiter-gesperrt.png)
- **Für Herbert:** Herbert klickt „Alltag“, Weiter bleibt grau, er klickt mehrfach und denkt, die App hängt. Nur „Überspringen“ rettet ihn, dann hat er kein Profil.

### B02 · Unterlage löschen: sofort weg, keine Rückfrage, kein „Rückgängig“
- **Schwere:** hoch · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer (2 von 2 Versuchen) · **Bereich:** Unterlagen
- **Schritte:**
  1. Unterlagen öffnen (drei Testeinträge, z. B. „Reisepass Herbert“).
  2. Karte anklicken, im Fenster „Unterlage bearbeiten“ auf „Löschen“.
- **Erwartet:** Rückfrage oder eine Meldung mit „Rückgängig“ (wie bei der Schnellerfassung: „Gespeichert in ToDos · Rückgängig“).
- **Tatsächlich:** Die Unterlage ist sofort verschwunden. Nach 0,1 s, 0,6 s, 2,5 s und 5,5 s keine Meldung, kein Papierkorb in den Einstellungen (Suche „Papierkorb“ ohne Treffer). Hing eine Datei dran, ist sie auch weg und steht laut Hinweis nicht im Backup.
- **Screenshot:** [141-loeschen-frage.png](screenshots/141-loeschen-frage.png)
- **Für Herbert:** Herbert hat Angst, etwas Falsches zu löschen. Hier passiert es ohne Vorwarnung bei seinen wichtigsten Dokumenten (Pass, Vertrag). Der Löschen-Knopf sitzt im Bearbeiten-Fenster direkt neben „Abbrechen“ und „Speichern“.

### B03 · Verstrichene Kündigungsfrist wird nirgends als verpasst markiert
- **Schwere:** hoch · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer (in den Testdaten 5+ Verträge) · **Bereich:** Unterlagen / Übersicht
- **Schritte:**
  1. Dev-Build mit Testdaten (Stand: 29. Okt.) öffnen, Unterlagen.
  2. „Handyvertrag“ ansehen: „Ende: 19. Nov. 2026 · Kündigen bis: Di., 20. Okt.“.
  3. Auf der Übersicht das Widget „Fristen & Ablauf“ ansehen.
- **Erwartet:** Eine Frist, die vor neun Tagen endete, ist als verstrichen gekennzeichnet („Kündigungsfrist vorbei“) und fällt auf.
- **Tatsächlich:** Die Karte trägt nur den Chip „Bald“ (bezogen auf das Ende). „Kündigen bis“ steht als normaler Text. Das Widget „Fristen & Ablauf“ führt unter „abgelaufen“ nur die drei Dokumente mit verstrichenem Ende (Laptop Garantie, Rechtsschutz 21, Impfpass), keine verstrichene Kündigungsfrist. Auch „Wartungsvertrag Heizung“ (Kündigen bis 26. Aug.) und „Fitnessstudio“ (24. Okt.) sind betroffen.
- **Screenshot:** [20-unterlagen.png](screenshots/20-unterlagen.png) · [11-uebersicht-alle-widgets.png](screenshots/11-uebersicht-alle-widgets.png)
- **Für Herbert:** Das ist Herberts Hauptgrund für die App („Verträge mit Kündigungsfristen“). Er verlässt sich darauf, dass die App ihn warnt, bevor er in eine Vertragsverlängerung rutscht. Die Testdaten sind künstlich, die Logik darf trotzdem nicht stillschweigend sein.

### B04 · Esc oder Klick neben das Fenster verwirft getippten Text ohne Rückfrage
- **Schwere:** mittel · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Dialoge
- **Schritte:**
  1. Kalender → „Neuer Termin“.
  2. „Termin beim Notar wegen Erbschaft und Testament“ tippen.
  3. Esc drücken (oder neben das Fenster klicken).
- **Erwartet:** Rückfrage („Eingaben verwerfen?“) oder Entwurf bleibt erhalten.
- **Tatsächlich:** Fenster schließt, nichts gespeichert, beim erneuten Öffnen ist der Titel leer. Gilt für Esc und Klick auf den Hintergrund.
- **Screenshot:** [120-escape-mitten.png](screenshots/120-escape-mitten.png)
- **Für Herbert:** Herbert tippt langsam. Ein versehentlicher Klick daneben kostet ihn mehrere Minuten Arbeit.

### B05 · Seitenleiste der Einstellungen: „Benachrichtigungen“ überlappt „Nicht erlaubt“
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Einstellungen
- **Schritte:**
  1. Einstellungen öffnen (1920×1080).
- **Erwartet:** Beschriftung und Status stehen nebeneinander.
- **Tatsächlich:** Der Text „Nicht erlaubt“ liegt über dem Ende von „Benachrichtigungen“, beide unleserlich.
- **Screenshot:** [61-einst-darstellung.png](screenshots/61-einst-darstellung.png)
- **Für Herbert:** Herbert liest genau und hält das für einen Fehler der App, nicht für Absicht.

### B06 · Sehr langer Titel ohne Leerzeichen sprengt Karte und Seite
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Notizen
- **Schritte:**
  1. Notizen → „Notiz hinzufügen“.
  2. Titel: 300 mal „A“ (oder einen langen Link) einfügen, speichern.
- **Erwartet:** Titel wird umgebrochen oder mit „…“ gekürzt.
- **Tatsächlich:** Der Text läuft aus der Karte hinaus über den rechten Rand des Bildschirms.
- **Screenshot:** [121-lange-notiz.png](screenshots/121-lange-notiz.png)
- **Für Herbert:** Er fügt gern Links in Notizen ein; lange Adressen haben auch keine Leerzeichen.

### B07 · Schmales Fenster: Umschalter „Kalender | Erinnerungen“ abgeschnitten
- **Schwere:** niedrig · **Plattform:** Desktop, Fenster 640 px breit · **Häufigkeit:** immer · **Bereich:** Kalender
- **Schritte:**
  1. Fenster auf 640 px Breite ziehen, Kalender öffnen.
- **Erwartet:** Beide Schalter lesbar.
- **Tatsächlich:** Es steht nur „Kal“, der Rest ist abgeschnitten und stößt an „Erweitert“.
- **Screenshot:** [110-fenster-640-kalender.png](screenshots/110-fenster-640-kalender.png)
- **Für Herbert:** Herbert zieht Fenster gern halb groß neben ein anderes.

### B08 · Handy: Suchfeld nur noch ein kleines Oval mit „S“
- **Schwere:** niedrig · **Plattform:** Android-Viewport 412×915 · **Häufigkeit:** immer · **Bereich:** Übersicht / Suche
- **Schritte:**
  1. Viewport 412 px, Übersicht öffnen.
- **Erwartet:** Lupe oder lesbares Suchfeld.
- **Tatsächlich:** Ein winziges Oval mit abgeschnittenem Buchstaben „S“.
- **Screenshot:** [110-fenster-412-uebersicht.png](screenshots/110-fenster-412-uebersicht.png)
- **Für Herbert:** Herbert nutzt das Handy selten, würde das Oval aber nicht als Suche erkennen.

### B09 · Spotify-Karte trägt den Hinweistext der Kalender-Verbindung
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Einstellungen / Einrichtung
- **Schritte:**
  1. Einstellungen → Verbindungen (oder Einrichtung Schritt 6) → Karte „Spotify“.
- **Erwartet:** Hinweis passt zu Spotify.
- **Tatsächlich:** Unter Spotify steht: „… Auf dem Handy und im Browser kommen die Termine über die Synchronisierung oder über ein Kalender-Abo (ICS).“ Der Play-Knopf hat keine Beschriftung.
- **Screenshot:** [161-wetter.png](screenshots/161-wetter.png)
- **Für Herbert:** Herbert nimmt den Text wörtlich und wundert sich, was Spotify mit Terminen zu tun hat.

### B10 · Fokusring am Favoriten-Stern rechts angeschnitten
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Tastatur
- **Schritte:**
  1. Übersicht öffnen, 4× Tab drücken.
- **Erwartet:** Kompletter Fokusrahmen.
- **Tatsächlich:** Der Rahmen um den Stern („ToDos aus den Favoriten entfernen“) ist am rechten Rand der Seitenleiste abgeschnitten.
- **Screenshot:** [180-tab-fokus.png](screenshots/180-tab-fokus.png)
- **Für Herbert:** Herbert bedient viel mit Tab; Fokus ist sonst gut sichtbar.

### B11 · Zusammenfassung meldet übergangene Schritte als „Erledigt“
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Einrichtung
- **Schritte:**
  1. Einrichtung durchklicken, in den Schritten 5 bis 8 (KI, Konten, Startdaten, Import per KI) nur „Weiter“ drücken.
- **Erwartet:** „Übersprungen“ (wie bei Benachrichtigungen).
- **Tatsächlich:** Alle vier stehen als „Erledigt“. Zusätzlich „10 von 11 Schritten“ im Assistenten gegenüber „11 von 12“ auf der Übersicht.
- **Screenshot:** [04-nach-einrichtung.png](screenshots/04-nach-einrichtung.png)
- **Für Herbert:** Herbert glaubt dann, er habe Google oder KI eingerichtet, und wird misstrauisch.

### B12 · Schalter heißt „Kalender einschalten“, obwohl er bereits eingeschaltet ist
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Modul-Bibliothek
- **Schritte:**
  1. Modul-Bibliothek öffnen, Karte „Kalender“ ansehen.
- **Erwartet:** Beschriftung nennt den Zustand („Kalender: an“).
- **Tatsächlich:** Neben dem aktiven Schalter steht „Kalender einschalten“, neben ausgeschalteten das Gleiche.
- **Screenshot:** [30-modulbibliothek.png](screenshots/30-modulbibliothek.png)
- **Für Herbert:** Herbert weiß nicht, ob er klicken muss, um das Modul an- oder auszuschalten.

### B13 · Touch-Ziele unter 44 px
- **Schwere:** niedrig · **Plattform:** Android-Viewport 412×915 · **Häufigkeit:** immer · **Bereich:** Kalender / Handy
- **Schritte:**
  1. Viewport 412 px, Kalender → „Neuer Termin“ öffnen, Maße der Knöpfe messen.
- **Erwartet:** Mindestens 44 px (steht so in den Projektregeln).
- **Tatsächlich:** Tageskacheln im Mini-Kalender 32×32 px, Monat/Woche/Tag 38 px hoch, Umschalter „Kalender | Erinnerungen“ 38 px.
- **Screenshot:** [213-phone-termin-dialog.png](screenshots/213-phone-termin-dialog.png)
- **Für Herbert:** Herberts Finger sind nicht mehr so treffsicher.

### B14 · Lesehilfe wirkt nicht überall und zerlegt Wörter
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Lesehilfe
- **Schritte:**
  1. Einstellungen → Lesehilfe „An“.
  2. Einstellungen und Unterlagen ansehen.
- **Erwartet:** Einheitliche Hervorhebung.
- **Tatsächlich:** In den Einstellungen sind nur Wortanfänge fett („Sch|alter“, „Ko|pf“), auf der Seite Unterlagen ist kein Unterschied zu sehen (Attribut data-read-aid=25 ist gesetzt). Die Zeile „Lesehilfe: An · 40 % · Weich · 25 %“ ist ohne Erklärung.
- **Screenshot:** [193-lesehilfe-einstellung.png](screenshots/193-lesehilfe-einstellung.png) · [190b-lesehilfe-zoom.png](screenshots/190b-lesehilfe-zoom.png)
- **Für Herbert:** Herbert findet die halbfetten Wortfetzen eher störend als hilfreich.

### B15 · Name „für die Begrüßung auf der Übersicht“ – keine Begrüßung zu sehen
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer (nicht bestätigt, ob zeitabhängig) · **Bereich:** Übersicht
- **Schritte:**
  1. Name „Herbert“ in der Einrichtung eintragen.
  2. Übersicht ansehen (frisch, befüllt, nach Backup-Import).
- **Erwartet:** Eine Begrüßung mit Namen, wie die Einstellung verspricht.
- **Tatsächlich:** In der frischen App und im Import-Profil (beide mit Namen „Herbert“, Testzeit nachts) keine Begrüßung gesehen. Eventuell tageszeitabhängig, nicht weiter geprüft.
- **Screenshot:** [160-uebersicht-imp.png](screenshots/160-uebersicht-imp.png)
- **Für Herbert:** Das wäre für Herbert ein freundlicher Einstieg.

### B16 · Nach Backup-Import in leere App erscheint wieder „Willkommen bei Nemo – Einrichtung starten“
- **Schwere:** niedrig · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080) · **Häufigkeit:** immer · **Bereich:** Einrichtung / Backup
- **Schritte:**
  1. Verschlüsseltes Backup exportieren.
  2. In neuem, leerem Profil importieren („19 Einträge wiederhergestellt“).
  3. Übersicht öffnen.
- **Erwartet:** Keine Einrichtungs-Einladung, die Daten sind ja da.
- **Tatsächlich:** Die Willkommenskarte samt „Lesehilfe …“-Frage erscheint erneut.
- **Screenshot:** [160-uebersicht-imp.png](screenshots/160-uebersicht-imp.png)
- **Für Herbert:** Herbert fragt sich, ob die Wiederherstellung wirklich geklappt hat.

## Verbesserungen

### V01 · Morgenüberblick zeigt heutige Termine sofort
- **Nutzen für Herbert:** hoch · **Bereich:** Übersicht · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert öffnet die App morgens und will wissen: Arzt, Familie, Rechnungen?
- **Problem heute:** Die Übersicht startet im Modus „Nur das Wichtigste“: Auf 1920 px Breite steht links eine einzige Karte mit EINER Aufgabe („Urlaubsantrag einreichen“), rechts ist über 60 % der Fläche leer. Termine (Medikament 08:00, Teammeeting 10:00), „Jetzt wichtig“ und Rechnungen erscheinen erst nach „Mehr anzeigen · 16 Widgets“.
- **Vorschlag:** Heutige Termine und Fristen der nächsten 7 Tage standardmäßig oben zeigen (mit Uhrzeit, Ort). Die „eine Sache“ bleibt, aber darunter. Bei breitem Fenster zwei Spalten nutzen.
- **Screenshot:** [10-dev-uebersicht.png](screenshots/10-dev-uebersicht.png) · [11-uebersicht-alle-widgets.png](screenshots/11-uebersicht-alle-widgets.png)
- **Anregung (keine Kopie):** Apple Kalender „Heute“-Ansicht, Thunderbird Tagesansicht

### V02 · Profil „Papiere & Termine“ für Menschen wie Herbert
- **Nutzen für Herbert:** hoch · **Bereich:** Einrichtung · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert wählt in Schritt 3 ein Profil.
- **Problem heute:** „Alltag“ schaltet Finanzen, Rechnungen, Abos aus und lässt Unterlagen und Accounts aus. „Finanz-Fokus“ nennt „Verträge“, aber nicht Geburtstage oder Notizen. Er muss in einer Liste mit 15 Zeilen in kleiner Grauschrift 5 Schalter selbst umlegen (Finanzen, Rechnungen, Abos, Unterlagen, Accounts). Jede Karte zeigt den Namen doppelt („Alltag“ + Knopf „Alltag“).
- **Vorschlag:** Profil „Papiere, Termine, Rechnungen“ (Kalender, Unterlagen, Rechnungen, Abos, Personen, Notizen, Accounts) und einen Knopf „Auswählen“ statt Namensdoppelung. „Beispiel (Entwickler)“ aus der Liste für Nutzer ausblenden.
- **Screenshot:** [03-setup-03b-nach-alltag.png](screenshots/03-setup-03b-nach-alltag.png) · [03-setup-03c-weiter-gesperrt.png](screenshots/03-setup-03c-weiter-gesperrt.png)
- **Anregung (keine Kopie):** Notion-Onboarding „Wofür nutzt du …?“

### V03 · Kündigungsfrist in Monaten/Wochen eingeben, „Kündigen bis“ groß zeigen, früh erinnern
- **Nutzen für Herbert:** hoch · **Bereich:** Unterlagen / Abos · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Im Zeitungsabo steht „3 Monate zum Quartalsende“.
- **Problem heute:** Der Dialog verlangt „Kündigungsfrist (Tage vor Ende)“, im Abo-Dialog „Tage vor Abbuchung“ (nur unter „Mehr Felder“). Herbert muss Tage rechnen (3 Monate = 90?). Das Ergebnis „Kündigen bis: Do., 31. Dez.“ ist korrekt, aber klein im Kartentext. Eine Erinnerung davor richtet er nicht von selbst ein.
- **Vorschlag:** Auswahl „Tage / Wochen / Monate“, danach Vorschau „Kündigen bis 31.12.2026“. Standard-Erinnerung 14 Tage vor „Kündigen bis“, sichtbar als Chip auf der Karte („Kündigen in 12 Tagen“, „Frist verpasst“).
- **Screenshot:** [51-unterlage-dialog.png](screenshots/51-unterlage-dialog.png) · [240-abo-dialog.png](screenshots/240-abo-dialog.png) · [53-unterlagen-befuellt.png](screenshots/53-unterlagen-befuellt.png)
- **Anregung (keine Kopie):** Check24-Vertragsmanager

### V04 · „Nur lokal, ohne KI“ als allererste Wahl und sichtbar in der Kopfzeile
- **Nutzen für Herbert:** hoch · **Bereich:** Einrichtung / KI · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert hat Angst vor KI und Konten.
- **Problem heute:** „Mit KI eintragen“ (Funkel-Symbol) steht auf jeder Modulseite, in der Schnellerfassung und die Suche startet mit „Assistent fragen“. Die Option „Ich möchte keine KI nutzen“ erscheint erst in Schritt 5 von 12. Sie wirkt (Kalender, Suche, Schnellerfassung zeigen danach keine KI mehr, Test „KI abschalten“), aber bis dahin ist die Skepsis geweckt.
- **Vorschlag:** In Schritt 1 eine einzige Frage: „Soll Nemo KI-Funktionen zeigen? (Standard: nein)“. Die Schritte 5, 6 und 8 (KI, Konten, Import per KI) entfallen dann. Ein Hinweis in den Einstellungen „KI: aus“.
- **Screenshot:** [03-setup-01.png](screenshots/03-setup-01.png) · [251-einst-ki.png](screenshots/251-einst-ki.png) · [252-ki-abschalten-dialog.png](screenshots/252-ki-abschalten-dialog.png)
- **Anregung (keine Kopie):** Firefox „Standardmäßig keine KI“-Schalter

### V05 · Textgröße gleich in Schritt 1 abfragen, „Sehr groß“ wirklich groß machen
- **Nutzen für Herbert:** hoch · **Bereich:** Einrichtung / Darstellung · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert sitzt vor einem großen Monitor und liest ungern kleine Schrift.
- **Problem heute:** Die Einstellung existiert (Einstellungen → Darstellung → „Schrift & Lesen: Normal · Normal · Normal“ → Ändern → „Textgröße“), ist aber verschachtelt und die Zeile zeigt nur drei „Normal“ ohne Namen. Die Einrichtung fragt nicht danach.
- **Vorschlag:** Schritt 1: Textgröße mit Vorschauzeile („So groß ist die Schrift“). „Sehr groß“ ist nur etwa 20 % größer. Der Monatskalender kürzt bei „Sehr groß“ noch mehr („Garantie endet:…“); dort Wochenliste als Standard vorschlagen. Graue Nebentexte (ca. 12–13 px, z. B. Modulbeschreibungen, „Schritt 3 von 12“) ebenfalls mit skalieren.
- **Screenshot:** [61-einst-darstellung.png](screenshots/61-einst-darstellung.png) · [62-schrift-lesen.png](screenshots/62-schrift-lesen.png) · [63-sehr-gross-kalender.png](screenshots/63-sehr-gross-kalender.png) · [63-sehr-gross-uebersicht.png](screenshots/63-sehr-gross-uebersicht.png)
- **Anregung (keine Kopie):** Windows „Textgröße“ beim ersten Start, Firefox Reader-Ansicht

### V06 · Gelöschtes 30 Tage wiederherstellbar („Zuletzt gelöscht“)
- **Nutzen für Herbert:** mittel · **Bereich:** Allgemein · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert löscht aus Versehen oder ändert seine Meinung.
- **Problem heute:** Schnellerfassung bietet „Rückgängig“, Löschen von Unterlagen nicht. Es gibt keinen Papierkorb (Einstellungs-Suche „Papierkorb“ ohne Treffer).
- **Vorschlag:** Einheitlich: jede Löschung zeigt „Gelöscht · Rückgängig“ und landet 30 Tage in „Zuletzt gelöscht“ (lokal; vereinbar mit Local-First).
- **Screenshot:** [141-loeschen-frage.png](screenshots/141-loeschen-frage.png)
- **Anregung (keine Kopie):** Fotos-App „Zuletzt gelöscht“

### V07 · Suche: echte Treffer zuerst, „Assistent fragen“ nur wenn KI an
- **Nutzen für Herbert:** mittel · **Bereich:** Suche · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert tippt „Zahnarzt“ und drückt Enter.
- **Problem heute:** Erste, vorausgewählte Zeile ist „Assistent fragen: „Zahnarzt““ (KI-Symbol). Der Dialog heißt „Befehlspalette“, der Hinweis „Ctrl+K“ (nicht „Strg+K“).
- **Vorschlag:** Treffer vorauswählen, Assistent-Zeile ans Ende. Dialog „Suchen“, Hinweis „Strg+K“. (Die Trefferliste selbst ist gut: „Kalender · Termin“ pro Zeile.)
- **Screenshot:** [91-suche-zahnarzt.png](screenshots/91-suche-zahnarzt.png)
- **Anregung (keine Kopie):** Windows-Suche

### V08 · „Dieser PC“: Vorab erklären, was gelöscht wird und was nie
- **Nutzen für Herbert:** mittel · **Bereich:** Dieser PC · **Plattform:** Windows-App (nicht getestet)
- **Situation:** Herbert will den PC aufräumen und fürchtet, Falsches zu löschen.
- **Problem heute:** Ich konnte das Modul nicht testen (läuft nur in der Windows-App, nicht im Browser/Linux). Nutzertexte sind knapp: README „Platz analysieren, sicher aufräumen“, Handbuch „Laufwerke analysieren und aufräumen“. In der Modul-Bibliothek des Browsers fehlt die Karte komplett, so kann er sich vorab nicht informieren.
- **Vorschlag:** Karte „Dieser PC“ auch im Browser zeigen (mit Hinweis „nur Windows-App“), dazu ein Beispielbild und drei Sätze: „Zeigt zuerst nur an. Löschen geht in den Papierkorb. Systemordner sind gesperrt.“ Auf der Website nennen.
- **Screenshot:** –
- **Anregung (keine Kopie):** WinDirStat-Beschreibung, Windows „Speicheroptimierung“

### V09 · Sicherung in Alltagssprache und regelmäßige Erinnerung
- **Nutzen für Herbert:** mittel · **Bereich:** Backup · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert will seine Daten auf einen USB-Stick sichern und später zurückspielen.
- **Problem heute:** Das Backup funktioniert gut (Vorschau, Zusammenführen/Ersetzen, Sicherheitskopie vorher), aber die Seite ist voll Fachwörter: „Passphrase“, „Chiffretext“, „Argon2id“, „19 Einträge in 27 Tabellen“, „Backup prüfen“, „Importieren“. Die Seite „Sync & Backup“ beginnt mit Sync (Server, Token, Tailscale), nicht mit dem Backup.
- **Vorschlag:** Backup nach oben, Beschriftungen „Sicherung speichern“ / „Sicherung zurückspielen“. Schrittfolge „1 Datei wählen · 2 Passwort · 3 Prüfen · 4 Zurückspielen“. Optional Erinnerung alle 30 Tage („Letzte Sicherung: vor 45 Tagen“).
- **Screenshot:** [134-backup-vorschau.png](screenshots/134-backup-vorschau.png)
- **Anregung (keine Kopie):** Time Machine, Fritz!Box-Sicherung

### V10 · Nach „Speichern“ zeigen, wohin der Termin gegangen ist
- **Nutzen für Herbert:** mittel · **Bereich:** Kalender · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert trägt „Augenarzt 12. Nov.“ ein, der Kalender zeigt Oktober.
- **Problem heute:** Der Termin war gespeichert (geprüft im November). Das Fenster schließt, der Kalender bleibt im Oktober, ich habe keine Bestätigung erfasst.
- **Vorschlag:** Meldung „Augenarzt, Do. 12. Nov. 10:30 gespeichert · Anzeigen“ und Sprung in den Monat.
- **Screenshot:** [43-termin-gespeichert.png](screenshots/43-termin-gespeichert.png)
- **Anregung (keine Kopie):** Google Kalender „Termin erstellt · Ansehen“

### V11 · Kurzer Einrichtungsweg („in 3 Fragen fertig“)
- **Nutzen für Herbert:** mittel · **Bereich:** Einrichtung · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert will loslegen, nicht 12 Schritte lesen.
- **Problem heute:** 12 Schritte, davon 4 (KI-Anbieter, Konten verknüpfen mit Google/Spotify, Startdaten, Import per KI) für ihn Internet-, Konto- oder KI-Themen. Der Assistent lässt sich schließen (X) und überspringen, die Karte „Einrichtung 11 von 12“ bleibt aber auf der Übersicht.
- **Vorschlag:** Standardweg: Name, Textgröße, Module. Alles Weitere unter „Mehr einrichten“ gebündelt.
- **Screenshot:** [04-nach-einrichtung.png](screenshots/04-nach-einrichtung.png)
- **Anregung (keine Kopie):** Signal-Einrichtung

### V12 · Erinnerungsfenster: konkrete Titel, verständliche Knöpfe
- **Nutzen für Herbert:** mittel · **Bereich:** Erinnerungen · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert öffnet die Glocke (Zahl 12).
- **Problem heute:** Gruppen heißen „Weitere Erinnerungen · 3“, ohne dass man sieht, was drinsteckt. „Zufällige Erinnerung“ ist unklar. Alle Einträge „Gestern“ ohne Datum.
- **Vorschlag:** Gruppen mit den ersten zwei Titeln aufklappbar. „Zufällige Erinnerung“ erklären oder entfernen.
- **Screenshot:** [95-glocke.png](screenshots/95-glocke.png)
- **Anregung (keine Kopie):** iOS Mitteilungszentrale

### V13 · „Wartet noch“ konkret benennen
- **Nutzen für Herbert:** mittel · **Bereich:** Übersicht · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Rechnungen sind seit 12 Tagen offen.
- **Problem heute:** Die Übersicht fasst in einer winzigen grauen Zeile zusammen: „Wartet noch · 4 · 2 Rechnungen überfällig · Budget „Freizeit“ überschritten“. Die Namen stehen erst im aufgeklappten Zustand oder im Widget „Fällige Rechnungen“. Der ruhige Ton ist gut, die Schrift klein.
- **Vorschlag:** Zeile größer, mit Namen und Betrag („Stadtwerke 87,40 €, seit 12 Tagen“), weiter ohne Rot außer bei Geld.
- **Screenshot:** [11-uebersicht-alle-widgets.png](screenshots/11-uebersicht-alle-widgets.png)
- **Anregung (keine Kopie):** Banking-Apps „Fällig“-Liste

### V14 · „Passwörter“ statt „Accounts“, Generator erkennbar benennen
- **Nutzen für Herbert:** mittel · **Bereich:** Accounts (Tresor) · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert sucht, wo er Passwörter aufbewahrt.
- **Problem heute:** Der Menüpunkt heißt „Accounts“ (auf Englisch „Passwords“, also fehlt nur die deutsche Übersetzung), Knopf „Neues Passwort“ (ist der Generator, klingt nach „Master-Passwort ändern“). Neben dem Passwortfeld sitzt ein Funkel-Symbol, das sonst „KI“ bedeutet (Generator). Kopieren, Auge und „Öffnen“ sind reine Symbole. Formularfeld „Einmalcode (TOTP) – Base32 oder otpauth://-Link“ ist unverständlich.
- **Vorschlag:** „Passwörter“, „Passwort erzeugen“, Würfel-Symbol, Symbole mit Text beim Überfahren und auf Wunsch dauerhaft. Das TOTP-Feld erst unter „Mehr Felder“.
- **Screenshot:** [75-zugang-hinzufuegen.png](screenshots/75-zugang-hinzufuegen.png) · [76-zugang-details.png](screenshots/76-zugang-details.png)
- **Anregung (keine Kopie):** Bitwarden „Passwort generieren“

### V15 · Abo-Dialog: Datumsfeld statt 31-Tage-Raster
- **Nutzen für Herbert:** niedrig · **Bereich:** Abos · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert trägt „Zeitung, monatlich, 24,90 €“ ein.
- **Problem heute:** Der Dialog zeigt als erstes „Tag des Monats“ mit 31 Knöpfen plus „Letzter Tag“ und „Alle (Monate)“, die Kündigungsfrist steckt hinter „Mehr Felder“.
- **Vorschlag:** Feld „Nächste Abbuchung“ (Datum) und Auswahl „Monatlich“; Kündigungsfrist sichtbar.
- **Screenshot:** [240-abo-dialog.png](screenshots/240-abo-dialog.png)
- **Anregung (keine Kopie):** Rocket Money

### V16 · Vorlagen für typische Papiere (Pass, Führerschein, TÜV, Versicherung)
- **Nutzen für Herbert:** mittel · **Bereich:** Unterlagen · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert hat Pass, Personalausweis, Führerschein, TÜV, Hausrat- und Haftpflicht.
- **Problem heute:** Es gibt nur sieben Kategorien (Ausweise, Versicherung, Verträge, Garantien, Steuer, Gesundheit, Sonstiges). Das TÜV-Datum landet in „Sonstiges“. Der Chip „Bald“ folgt keiner erkennbaren Regel: „Waschmaschine Garantie“ (Ende in 45 Tagen) trägt „Bald“, „Zeitschriften-Abo 18“ (Ende in 33 Tagen) nicht; im eigenen Test hat der TÜV (37 Tage) „Bald“, der Reisepass (78 Tage) nicht.
- **Vorschlag:** Vorlagen „Reisepass (Erinnerung 6 Monate vorher)“, „TÜV (4 Wochen)“, Kategorie „Fahrzeug“, Schwelle für „Bald“ einstellbar.
- **Screenshot:** [53-unterlagen-befuellt.png](screenshots/53-unterlagen-befuellt.png)
- **Anregung (keine Kopie):** Wallet-Apps

### V17 · Zeilen in „Darstellung“ benennen, nicht nur Werte zeigen
- **Nutzen für Herbert:** niedrig · **Bereich:** Einstellungen · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert sucht die Schriftgröße.
- **Problem heute:** „Schrift & Lesen: Normal · Normal · Normal“, „Sonstiges: Breit · Nur das Wichtigste“, „Farben: Nemo-Orange · Standard · Mit Bedeutung“ sagen nicht, was „Normal“ ist. Die Einstellungs-Suche hilft allerdings (Schriftgröße → Textgröße gefunden).
- **Vorschlag:** „Textgröße: Normal · Zeilenabstand: Normal · Dichte: Normal“.
- **Screenshot:** [61-einst-darstellung.png](screenshots/61-einst-darstellung.png)
- **Anregung (keine Kopie):** macOS Systemeinstellungen

### V19 · Anleitung in der App verlinken
- **Nutzen für Herbert:** mittel · **Bereich:** Hilfe · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert liest gern Anleitungen und sucht nach „Hilfe“.
- **Problem heute:** In der Seitenleiste, der Kopfzeile und unter Einstellungen → „Über Nemo“ (Version, Build, Updates, Einrichtung, Unterstützen) gibt es keinen Eintrag „Hilfe“ oder „Anleitung“. Die Handbücher liegen nur im Repository (docs/user) und im Netz.
- **Vorschlag:** Eintrag „Hilfe und Anleitung“ in „Über Nemo“ und im Seitenmenü, öffnet eine mitgelieferte, offline lesbare Seite (Kapitel: Termine, Verträge, Passwörter, Sicherung).
- **Screenshot:** –
- **Anregung (keine Kopie):** Windows „Hilfe“ (F1)

### V18 · „Strg“ statt „Ctrl“, weniger Tab-Stopps in der Seitenleiste
- **Nutzen für Herbert:** niedrig · **Bereich:** Tastatur · **Plattform:** Desktop (Dev-Build im Browser, 1920×1080)
- **Situation:** Herbert bedient viel mit Tastatur.
- **Problem heute:** Hinweise zeigen „Ctrl+K“, im Fenster „Strg+Enter“; jede Favoriten-Zeile hat zwei Tab-Stopps (Link + Stern), so sind es ca. 25 Tab bis zum Inhalt. F2/F3/Strg+K funktionieren (gut).
- **Vorschlag:** Überall „Strg“; Stern per Kontextaktion statt eigenem Tab-Stopp; „Zum Inhalt springen“ beim ersten Tab sichtbar machen.
- **Screenshot:** [180-tab-fokus.png](screenshots/180-tab-fokus.png)
- **Anregung (keine Kopie):** Windows-Explorer

Keine dieser Vorschläge berührt Local-First, „kein Tracking“ oder die Fokus-Richtlinien. Zwei Wünsche von Herbert stehen in Spannung zu den Fokus-Grundsätzen und sind **nur als Nutzerwunsch** vermerkt: V13 (Rechnungen im Überblick deutlicher als „Wartet noch“) und V03 („Frist verpasst“ als deutliche Kennzeichnung). Beide lassen sich ohne Rot und ohne Schuldton lösen.

## Was gut ist (bitte nicht wegoptimieren)

1. Datenschutz-Ehrlichkeit: „Kein Konto, keine Cloud“, Wetter-Hinweis („nur der Ortsname geht an open-meteo.com“), „KI komplett abschalten“ entfernt wirklich alle KI-Knöpfe (Kalender, Suche, Schnellerfassung).
2. Tresor-Anlage: ehrliche Warnung („Master-Passwort kann nicht zurückgesetzt werden“), Stärke-Anzeige in Echtzeit, Meldung „Die Passwörter stimmen nicht überein.“, Sperre nach Neuladen.
3. Backup: verschlüsselt empfohlen, „Falsches Passwort – oder die Datei wurde verändert.“, Vorschau „Das passiert bei der Wiederherstellung“ mit Zahlen, „Zusammenführen“ als sicherer Standard, Sicherheitskopie vorher.
4. Schnell hinzufügen: „morgen 15 Uhr Zahnarzt“ wird richtig als Termin am 30. Okt. 15:00 erkannt, „am Freitag“ ebenfalls; danach „Gespeichert in Kalender · Rückgängig“.
5. Sprachwechsel (Deutsch ↔ English) wirkt sofort und lässt keine deutschen Reste zurück. Der Hinweistext zur Unterstützung („Du verpasst nichts“, „Nemo verarbeitet keine Zahlungsdaten“) ist druckfrei und vertrauensbildend.
6. Dialoge sind kurz (Termin, Rechnung, Person) mit Heute/Morgen/Nächste Woche und „Mehr Felder“ für den Rest.
7. Kalender: Agenda-Liste rechts neben dem Monat, Fristen und Kündigungsfristen stehen mit im Kalender.
8. Person-Eintrag: „Enkelin Lena · So., 14. März · wird 12 · in 136 Tagen“ ist genau, was Herbert wissen will.
9. Einstellungs-Suche findet Wörter wie „Schriftgröße“ und führt zur „Textgröße“; Textgröße, Zeilenabstand, Dichte, hell/dunkel vorhanden, dunkles Design sauber lesbar.
10. Ruhiger Ton: „Wartet noch“, „Eine Sache reicht“, „Tag abschließen · 3 Sachen sind noch offen · Auf morgen schieben“ (ab später Nachmittag), Fokus-Hilfen einzeln abschaltbar, „Esc verlässt den Bildschirm, die Runde läuft weiter“.
11. Offline: Der Produktions-Build lädt ohne Netz neu und speichert Eingaben („Gespeichert in ToDos“). Fokusring sichtbar, F2/F3/Strg+K funktionieren, Seite wird bei 412–1920 px nie waagerecht scrollbar, Handy-Dialoge als großes Bottom-Sheet.

## Verständnis

| Begriff / Symbol / Text | Was Herbert versteht und Vorschlag |
|---|---|
| Lesehilfe („hebt Wortanfänge hervor“) | Unklar, was das ist; erst nach dem Einschalten sichtbar. → „Hebt den Anfang jedes Wortes fett hervor, das erleichtert manchen das Lesen“ plus Vorschau. |
| „Wanduhrzeit“ (Einrichtung Schritt 1) | Fachwort. → „Uhrzeiten gelten für deinen Ort“. |
| „Widgets“, „Anheften…“, „Mehr anzeigen · 16 Widgets“ | Englisch/technisch. → „Bausteine“ bzw. „Karten“; „Anheften“ → „Karte hinzufügen“. |
| „Beispiel – Referenzmodul aus dem Generator“ (Modul-Bibliothek, Einrichtung) | Entwicklerbegriff, soll Herbert nicht sehen (er steht auch in der Seitenleiste der Dev-Daten). |
| „Accounts“, „TOTP“, „Base32“, „otpauth://“, „Argon2id, AES-256“ | Passwörter / „Zweiter Faktor (Einmalcode)“ / „sehr starke Verschlüsselung“. Argon2id schafft Vertrauen nur für Fachleute. |
| „JSON einfügen“, „Nemo-Format“, „Startdaten einrichten“, „Import per KI“ | Herbert weiß nicht, was JSON ist. → „Daten aus einer Datei übernehmen“; „Startdaten“ nur für das, was es ist (erste Einträge). |
| „Befehlspalette“ (Strg+K) | → „Suchen“. |
| „Zufällige Erinnerung“, „Weitere Erinnerungen · 3“ | Siehe V12. |
| „Wartet noch“, „Später nicht mehr“ (Wetter), „Auf morgen schieben“ | „Wartet noch“ versteht Herbert nach dem Ausprobieren, „Später nicht mehr“ klingt wie ein Widerspruch. → „Nicht mehr fragen“. |
| „Anfangen · 5 Min“, „Vorschlag: 3 kleine Schritte“, „Nächste eine Sache“ | Herbert erwartet, dass „Anfangen“ die Aufgabe öffnet; stattdessen startet sofort ein 5-Minuten-Zähler. Ob „Vorschlag“ ein Knopf oder KI ist, sieht man nicht. „Nächste eine Sache“ ist grammatisch falsch. |
| „Passphrase“, „Chiffretext“, „LAN“, „Tailscale“, „Tabellen“ (Backup/Sync) | Siehe V09. |
| Schalter „Erweitert“ in jedem Modul | Was wird erweitert? → „Mehr Felder anzeigen“ (dort schon so benannt). |
| Symbole: Funkel (KI und Passwort-Generator), Stern (Favorit), Glocke mit Zahl, Fisch im leeren Zustand | Der Fisch ist sympathisch. Funkel doppelt belegt (siehe V14). Stern: „zu Favoriten“ nur als Hinweis beim Überfahren. |
| Alle englischen Systemtexte im Browser (Datum „mm/dd/yyyy“, „Please fill out this field“, „Choose File“) | Kommen vom Browser dieses Tests (englisch), nicht von Nemo. In der deutschen Windows-App erwarte ich deutsche Texte; nicht bewertet, aber prüfen. |

## Tagesurteil

**Würde Herbert die App weiter benutzen? Ja, mit Vorbehalt.** Er würde sie auf dem Windows-PC ein bis zwei Mal am Tag öffnen, solange die Morgenansicht seine Termine ohne „Mehr anzeigen“ zeigt. Die Gründe dafür: Alles bleibt auf dem Gerät („kein Konto“ gefällt ihm), Unterlagen, Rechnungen und Geburtstage decken seinen Alltag ab, das Backup ist ehrlich und gründlich, und der Ton ist ruhig.

**Was ihn zögern lässt:** Die lange, KI-lastige Einrichtung mit dem hängenden Schritt 3; kleine graue Schrift trotz „Sehr groß“; Fachwörter („Accounts“, „JSON“, „Passphrase“, „Widgets“); und dass er seine Kündigungsfristen in Tagen ausrechnen muss.

**Der eine Grund zum Deinstallieren:** Verliert er durch einen Klick ein Dokument oder merkt er zu spät, dass eine Kündigungsfrist längst verstrichen war, ohne dass die App ihn gewarnt hat (B02, B03). Dann hält er sie für unzuverlässig und kehrt zu Zettel und Kalenderblatt zurück.

## Anhang: Testgrenzen und Umgebung

- Chromium (Playwright, Linux, headless) mit deutschem Gebietsschema, aber englischen Systemtexten (Datumsfeld, Pflichtfeld-Hinweis, „Choose File“). Das sind keine Nemo-Fehler; in der deutschen Windows-App erwarte ich deutsche Texte (bitte einmal prüfen).
- Der Dev-Build zeigt zusätzlich die Marke „Dev“, einen Hinweis „Dev-Preview …“ und die Karte „Beispiel“. Sie wurden nicht als Fehler gezählt, der Hinweis verdeckt aber im Dev-Build Teile der Übersicht.
- Alle Screenshots (verkleinert) stammen von erfundenen Daten. Keine echten Zugangsdaten.
- Testskripte und Rohnotizen liegen nicht im Repo (nur Bericht, Screenshots und `findings.json`).
