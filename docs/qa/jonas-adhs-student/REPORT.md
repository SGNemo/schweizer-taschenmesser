# QA-Bericht: Jonas (19, Student, ADHS)

**Persona:** Jonas, 19, 2. Semester, ADHS-Diagnose. Handy und Laptop gleichberechtigt. Springt zwischen Aufgaben, vergisst Fristen, hat ständig Tabs offen, gibt überladene Tools nach zwei Tagen auf.
**Ziele:** Abgabefristen und Vorlesungen, ToDos in winzige Schritte, Fokus-Sessions, Finanzen (BAföG, Miete, Abos), Habits (Schlaf, Sport), Notizen.
**Plattformen:** Android-Handy per Playwright-Viewport 412×915 (Hauptplattform), Desktop 1366×800 und 320 px Breite kurz. Kein Emulator, keine Windows-App, kein Sync-Server (in der Umgebung nicht installiert).
**Build:** `develop` @ `4af432d`, Vite-Dev-Server. Frische Installation (Port 5174, leere DB) und Dev-Preview mit Testdaten (Port 5173, Seed-Größe wie beim Autofill, nicht von mir gewählt; ich habe `medium` nicht eigens umgestellt).
**Datum:** 2026-10-29. **Dauer:** eine längere Testsession (ca. 2 Stunden, ohne Pausen).

**Einschränkungen der Umgebung:** Headless-Chromium mit englischer Browser-Oberfläche (native Datumsfelder `mm/dd/yyyy`, Validierungsmeldung auf Englisch) und Zeitzone UTC. Offline-Neuladen ist im Dev-Server ohne Service Worker nicht prüfbar. Push, Android-Share, Tray, Widgets, Biometrie: nicht testbar. Das ist unten jeweils markiert.

---

## Fehler

Zählung: 0 Blocker, 1 hoch, 6 mittel, 3 niedrig.

### B1 · Suchfeld im Kopf schrumpft zur leeren Pille, sobald eine Fokus-Runde läuft · hoch
- **Schritte:** 1. Übersicht öffnen (Handy, 412 px). 2. „Anfangen · 5 Min" tippen, Fokus-Bildschirm mit „Verlassen" schließen. 3. Irgendeine Seite ansehen (Planen, Einstellungen, Kalender).
- **Erwartet:** Suchfeld mit Lupe und „Suchen" bleibt erkennbar, Timer-Chip daneben.
- **Tatsächlich:** Das Suchfeld ist nur noch eine schmale leere Pille links neben dem Timer-Chip, ohne Lupe, ohne Text. Man erkennt nicht, dass es ein Suchfeld ist.
- **Screenshot:** `screenshots/20-planen.png`, `screenshots/50-kalender.png`
- **Häufigkeit:** immer, sobald Timer-Chip da ist (auf der Dev-Preview zusätzlich der „Dev"-Chip, das verschärft es). **Plattform:** Handy.
- **Warum für Jonas hoch:** Der Timer-Chip ist genau das Wiedereinstiegs-Werkzeug. Wer ihn benutzt, verliert dafür die Suche, ohne zu merken warum.

### B2 · Neue Aufgabe landet ohne Datum unter „Ohne Datum" in der Liste „Haushalt" · mittel
- **Schritte:** 1. Planen → ToDos. 2. In „Neue Aufgabe …" tippen: „Hausarbeit Statistik abgeben morgen 23:59 Uhr". 3. „Hinzufügen".
- **Erwartet:** Frist „morgen 23:59" erkannt (wie in „Schnell hinzufügen"), oder zumindest Rückfrage; Aufgabe sichtbar bei den heutigen/anstehenden.
- **Tatsächlich:** Der ganze Satz bleibt Titel, kein Datum, Liste „Haushalt" (erste Liste, passt nicht zum Studium). Die Aufgabe steht ganz unten in „Ohne Datum" zwischen 8 Testeinträgen. Eine Abgabefrist, die in dieser Ansicht untergeht, ist der Kernfehler für Jonas.
- **Screenshot:** `screenshots/30-todo-added.png`, `screenshots/34-todo-detail.png`
- **Häufigkeit:** immer. **Plattform:** alle. (Das „Schnell hinzufügen"-Sheet parst Daten dagegen korrekt, die Eingabe wirkt also inkonsistent.)

### B3 · „Schnell hinzufügen" macht aus „… Freitag 12 Uhr abgeben" einen Kalendertermin · mittel
- **Schritte:** 1. „+" unten rechts. 2. Tippen: „Statistik Hausarbeit freitag 12 Uhr abgeben".
- **Erwartet:** Eine Abgabe ist eine Frist, also ToDo mit Fälligkeit.
- **Tatsächlich:** Vorausgewählt ist „Termin" (Kalender, Morgen 30. Okt., 12:00 Uhr). Wer nicht hinschaut, hat einen Termin statt einer Aufgabe. Datum und Uhrzeit selbst sind richtig erkannt.
- **Screenshot:** `screenshots/72-qc-c.png`
- **Häufigkeit:** immer mit diesem Satz. **Plattform:** alle.

### B4 · Fokus „Vorschlag: 3 kleine Schritte" liefert immer dieselben drei Platzhalter · mittel
- **Schritte:** 1. ToDo „Hausarbeit Statistik …" öffnen → „Fokus". 2. „Vorschlag: 3 kleine Schritte".
- **Erwartet:** Schritte, die zur Aufgabe passen, oder ehrlicher Hinweis, dass es eine Vorlage ist.
- **Tatsächlich:** „Öffnen und Überblick verschaffen / Den ersten Teil erledigen / Prüfen und abschließen". Die Schritte stehen danach als echte Unteraufgaben am ToDo (Liste zeigt „0/3") und bleiben dort, auch wenn Jonas nur mal probieren wollte. Zwar gibt es „Rückgängig", aber das sieht man nur kurz.
- **Screenshot:** `screenshots/41-fokus-vorschlag.png`, `screenshots/95-long-title.png`
- **Häufigkeit:** immer. **Plattform:** alle.

### B5 · Neue Fokus-Runde ersetzt eine laufende ohne Rückfrage · mittel
- **Schritte:** 1. „Anfangen" bei „Urlaubsantrag einreichen" (5 Min läuft), „Verlassen". 2. Anderes ToDo öffnen → „Fokus".
- **Erwartet:** Hinweis „Es läuft schon eine Runde" mit Wahl.
- **Tatsächlich:** Die zweite Runde (25:00) übernimmt still, der Timer-Chip springt von ~03:00 auf 25:00. Die erste Runde ist weg, ohne Meldung.
- **Screenshot:** `screenshots/40-fokus-new.png`
- **Häufigkeit:** einmal beobachtet und mit dem Chip-Verlauf bestätigt. **Plattform:** Handy.

### B6 · Einrichtungs-Zusammenfassung zeigt alles „Erledigt", obwohl nichts gewählt wurde · mittel
- **Schritte:** 1. Frische App → „Einrichtung starten". 2. Zwölfmal nur „Weiter" tippen (nichts auswählen).
- **Erwartet:** Schritte ohne Entscheidung als „Übersprungen" oder „Offen".
- **Tatsächlich:** „Grundlagen, Sync, Profil und Module, KI-Anbieter, Konten, Startdaten, Import per KI … Erledigt", nur „Benachrichtigungen" ist „Übersprungen". Danach zeigt die Übersicht „10 von 11 Schritten erledigt". Es wurde kein Profil gewählt, kein Modul aktiviert, keine Startdaten angelegt.
- **Screenshot:** `screenshots/03-setup-end.png`, `screenshots/03-setup-03.png`
- **Häufigkeit:** immer. **Plattform:** Handy.

### B7 · Angebot „Lesehilfe einschalten" auf der Willkommenskarte ist abgeschnitten · mittel
- **Schritte:** 1. Frische App öffnen (412 px).
- **Erwartet:** Text und Buttons „Einschalten" / „Nicht jetzt" sichtbar.
- **Tatsächlich:** Der Kartentext ist nach drei Zeilen mit „…" abgeschnitten, mitten im Satz („Du kannst das auch später in den Einstellungen…"). Die Lesehilfe-Zeile und ihre Buttons sind im Dokument vorhanden, aber nicht sichtbar. Man kann die Lesehilfe so nicht beim ersten Start einschalten.
- **Screenshot:** `screenshots/01-fresh-start.png`
- **Häufigkeit:** immer (frisch). **Plattform:** Handy.

### B8 · Dev-Toast liegt über den Fokus-Buttons · niedrig
- Auf dem Fokus-Bildschirm deckt der Dev-Preview-Hinweis „Fertig / Pause / +5 Min" teilweise ab; er kommt nach jedem Neuladen wieder. Nur Dev-Preview, aber im Test mehrfach im Weg. `screenshots/11-anfangen.png`

### B9 · Natives Browser-Feldformat und englische Validierung in deutscher Oberfläche · niedrig (unsicher)
- Datumsfelder zeigen `mm/dd/yyyy`, Uhrzeit „09:00 AM", Pflichtfeld-Meldung „Please fill out this field." in der deutschen App. Vermutlich Eigenheit des englischen Headless-Browsers, daher nicht verlässlich. Auf einem deutschen Handy bitte prüfen. `screenshots/53-termin-mehr.png`, `screenshots/102-empty-save.png`

### B10 · Backup-Import „Ersetzen" nicht eindeutig geprüft · niedrig (offen)
- Backup „Prüfen" funktioniert vorbildlich (Probe-Wiederherstellung, Zahlen je Modul). Ob „Ersetzen" im Test wirklich gewählt war, konnte ich nicht sicher feststellen: Der Marker-Eintrag nach dem Backup blieb erhalten (bei „Zusammenführen" richtig). Bitte gezielt nachtesten. `screenshots/97-backup-import.png`

---

## Verbesserungen

### V1 · Einrichtung auf drei Schritte kürzen · Nutzen: hoch
- **Situation:** Jonas startet die App am Handy zum ersten Mal und will „einfach loslegen".
- **Problem heute:** 12 Schritte (Sync, KI-Anbieter, Konten verknüpfen, Startdaten, Import per KI, Benachrichtigungen, Backup, Widgets, Supporter …). Mit „Weiter" ist man in 12 Taps durch und weiß danach nichts mehr. Schritt 4 zeigt „Entwickler-Werkzeuge anzeigen". Er bricht spätestens bei „KI-Anbieter" ab.
- **Vorschlag:** Vorne nur Name (optional), Profil, „Los". Alles andere als Checkliste später („Noch 3 Dinge, wenn du magst"). Das gibt es schon, nur steht es hinter dem Zwang.
- **Beispiel:** Viele Notiz-Apps fragen beim Start nur nach einem Thema.

### V2 · Habits-Modul (Schlaf, Sport) und Studi-Profil · Nutzen: hoch
- **Situation:** Jonas will Schlaf und Sport tracken, ohne Streaks.
- **Problem heute:** Es gibt kein Habit-Modul. Globale Suche nach „Schlaf" findet nur Merkliste-Artikel und „Schlafsack". Profile sind „Alltag / Finanz-Fokus / Produktiv / Minimal", keines passt zu Studium (Fristen, Vorlesungen, Geld).
- **Vorschlag:** Profil „Studium" (Kalender, ToDos, Finanzen, Notizen, Timer). Kleines Habit-Modul: „heute geschafft / heute nicht", kein Streak-Verlust, kein Rot.
- **Hinweis Grundsatz:** Streaks wären ein Verstoß gegen die Fokus-Richtlinien und sind hier ausdrücklich nicht gewünscht.

### V3 · Termin-Wiederholung mit Wochentagen (Stundenplan) · Nutzen: hoch
- **Situation:** Statistik-Vorlesung Mo und Mi, 10–12 Uhr.
- **Problem heute:** „Wiederholung" kennt nur Täglich / Wöchentlich / Monatlich / Jährlich. Für Mo+Mi braucht Jonas zwei Termine. Kein Semesterende („bis").
- **Vorschlag:** Wochentage antippbar, „bis Datum". Idealer: kleines „Semester-Raster".

### V4 · Frist-Erinnerung standardmäßig an, ruhig · Nutzen: hoch
- **Situation:** Jonas vergisst Fristen.
- **Problem heute:** Neuer Termin: „Benachrichtigen: Nicht benachrichtigen". Wer das Feld nicht öffnet („Mehr Felder"), wird nie erinnert. Push bei geschlossener App braucht laut Einstellungen einen eigenen Sync-Server, den ein Student nicht hat. Im Browser-Test stand „Blockiert – bitte in den Browser-Einstellungen erlauben".
- **Vorschlag:** Bei Terminen und ToDos mit Frist eine ruhige Standard-Erinnerung („1 Tag vorher") vorschlagen, abschaltbar. Auf der PWA klar sagen, was ohne Push passiert („Du wirst nur erinnert, wenn Nemo offen ist").

### V5 · Abgabe-Typ mit Teilfristen · Nutzen: hoch
- **Situation:** Hausarbeit in 10 Tagen.
- **Problem heute:** Eine Frist ist ein Datum; die „Unteraufgaben" haben keine eigenen Daten und die Platzhalter-Schritte (B4) helfen nicht.
- **Vorschlag:** Beim Anlegen einer Aufgabe mit Frist optional „In Etappen planen": Nemo teilt rückwärts auf (nur Vorschlag, per Hand änderbar). Alternativ gute lokale Schritt-Vorlagen je Stichwort („Hausarbeit", „Klausur", „Referat").

### V6 · „Fällig am" und „Geplant für" erklären · Nutzen: mittel
- Beide Felder im ToDo-Dialog; unklar, was wo wirkt. Kurzer Hinweis unter dem Feld oder nur ein Feld „Wann?" mit „Frist" als Option.

### V7 · Einnahmekategorien für Studierende · Nutzen: mittel
- Beim Eintragen von „BAföG-Amt 934 €" gibt es nur „Gehalt" und „Sonstige Einnahmen". Vorschlag: BAföG, Nebenjob, Eltern, Stipendium; „Wiederholen: Monatlich" gibt es schon (gut).

### V8 · Wiedereinstieg: „Wo war ich?" · Nutzen: mittel
- Nach „Verlassen" der Fokus-Runde läuft nur der Timer-Chip. Vorschlag: Auf der Übersicht eine ruhige Karte „Weiter mit: <Aufgabe>, noch 12 Min". Nur eine Karte, abschaltbar.

### V9 · Erinnerungs-Glocke entlasten · Nutzen: mittel
- Rotes Badge „12". Die Liste enthält „Gestern"-Einträge und „Noch offen: …" mehrfach, viele „Weitere Erinnerungen · 3". Für Jonas ist das ein Schuldenberg. Vorschlag: Nach 24 h automatisch als gelesen ablegen, Badge ohne Zahl, oder Badge nur für „heute".

### V10 · Ein Schalter „Ruhig starten" · Nutzen: mittel
- Reizarme Einstellungen sind verteilt: Stumm (Startseite der Einstellungen), Zock-Modus, Ruhezeit, „Höchstens pro Stunde", Lesehilfe, Dichte, 6× „Ändern". Vorschlag: Ein Preset „Ruhig" mit Vorschau, einzelne Regler darunter.

### V11 · Fokus-Länge direkt wählbar · Nutzen: niedrig
- „Anfangen · 5 Min" ist gut, aber 25 Min kommen nur aus der ToDo-Dauer („5 Min / 15 / 30 / 60"). Vorschlag: Ein Fokus-Sheet mit 5/15/25 zum Auswählen.

---

## Was gut ist (bitte nicht wegoptimieren)

1. **Übersicht mit „3 Dinge reichen für heute"** und genau einer hervorgehobenen Aufgabe: kein Überblick-Schock, `screenshots/10-filled-home.png`.
2. **„Anfangen · 5 Min"** startet sofort einen Fokus-Bildschirm mit großer Zahl, ohne Dialog.
3. **„Wartet noch" und „Neu planen"** statt roter Überfällig-Liste.
4. **„Schnell hinzufügen"** mit Beispiel „morgen 15 Uhr Zahnarzt", erkennt Datum und Uhrzeit korrekt und zeigt, was verstanden wurde, bevor man speichert.
5. **Rückgängig nach Löschen** („ToDo gelöscht. Rückgängig").
6. **Stumm / Zock-Modus** als schneller Ruheschalter.
7. **Ruhige Erinnerungen**: Ruhezeit 22–07, Maximum pro Stunde, „ToDos am Morgen".
8. **Timer-Chip im Kopf** zeigt eine laufende Runde auf jeder Seite (wenn nur das Suchfeld nicht litte, B1).
9. **Backup-Prüfung** mit Probe-Wiederherstellung, Anzahl je Modul und „Zusammenführen / Ersetzen"; Backup ohne Zugangsdaten.
10. **Dunkles Design und „Kompakt"** sauber, Sprache wechselt sofort und vollständig; kein horizontales Scrollen bei 320 px.

---

## Verständnis

| Begriff / Stelle | Was Jonas dachte | Vorschlag |
|---|---|---|
| „Zock-Modus" in Benachrichtigungen vs. „Stumm" auf der Einstellungs-Startseite | Zwei Schalter für dasselbe? | Einen Namen, ein Ort („Ruhe"). |
| „Gestaffelte Erinnerung", „Ruhig wiederholen: 30 min · 6×" | Was staffelt sich? Werde ich sechsmal genervt? | Ein Satz Beispiel pro Zeile; Standard „1×". |
| Buttons „Nächste Erinnerung" / „Zufällige Erinnerung" im Glocken-Fenster | Was macht „Zufällig"? | Entfernen oder erklären. |
| Kalender: „Kalender" + Schalter „Erweitert" | Welcher Kalender? Was wird erweitert? | „Erweitert" mit Untertitel. |
| Einrichtung „Feste Vorgaben: Zeitzone: UTC" | Warum UTC? (Container-Eigenheit, aber für Nutzer unklar) | Zeitzone mit Ort anzeigen. |
| „Wartet noch · 4" (Übersicht) vs. „Wartet noch 8" (ToDos) | Welche Zahl stimmt? | Zähler gleich definieren oder Quelle nennen. |
| Profilkarten: Titel „Alltag" und Button „Alltag" | Muss ich noch etwas tun? | Button „Wählen". |
| ToDo-Dauer-Chip „Offen / 5 Min / 15 …" | „Offen" = Status? | „Dauer: offen". |
| Einrichtung „Import per KI", „Konten verknüpfen", „Entwickler-Werkzeuge" | Brauche ich das als Student? | Nur auf Wunsch zeigen. |
| Leere Pille im Kopf (B1) | Was ist das? | Fix B1. |

---

## Tagesurteil

**Ein Tag mit Jonas (Handy):** Morgens Übersicht öffnen (1×, gut: eine Sache, „Anfangen"). Drei spontane Erfassungen („morgen 15 Uhr Zahnarzt", „Mensa-Karte aufladen", Hausarbeit-Frist) kosten je 3 Taps (+, tippen, Speichern); die Hausarbeit-Frist braucht über die ToDo-Liste dagegen 5 Aktionen und wird dann nicht mal erkannt (B2). Eine Erinnerung: Neuer Termin ohne „Mehr Felder" bekommt keine. Fokus-Block: 1 Tap bis Timer, brauchbar. BAföG als monatliche Einnahme: 6 Eingaben, gelingt. Abends gibt es keinen Tagesabschluss. Realistisch öffnet Jonas die App 5 bis 7 Mal, vor allem für „Neu".

**Würde Jonas sie weiter benutzen?** Bedingt ja, für ToDos, Fokus und Geld, weil die App ihn nicht anschreit. Sie verspricht „ADHS-Helfer", liefert aber kein Habit-Tracking, keinen Stundenplan und keine aktive Hilfe bei Fristen.

**Der eine Grund zum Deinstallieren:** Eine verpasste Hausarbeit-Frist, weil die Erinnerung nie kam (kein Push ohne eigenen Server, Termine standardmäßig ohne Erinnerung) und die Frist in „Ohne Datum" unterging.

**Ein-Satz-Urteil:** Ruhiges, ehrliches Grundgerüst, das Jonas behalten würde, wenn Fristen und Erinnerungen von allein funktionieren und die 12-Schritte-Einrichtung entfällt.
