# QA-Bericht: Mia (Familie, Haushalt, Termine)

## Kopf

- **Persona:** Mia, 45, Teilzeit im Büro, zwei Kinder (9 und 14). Sie organisiert Haushalt und Termine der ganzen Familie.
- **Geräte:** Android-Handy immer dabei, PC abends. Wenig Zeit am Stück, ständig unterbrochen, braucht alles mit einem Blick.
- **Ziele:** Familientermine, Einkauf, Vorräte, Putzplan, Geburtstage und Geschenke, Packlisten, Rechnungen, Kinderdokumente, Budget.
- **Plattformen:** Android-Handy simuliert über Chromium-Viewport 412×915 (Touch). Desktop über Viewport 1366×850. Kein echtes Gerät, keine Windows-exe, keine Tauri-Shell.
- **Build:** Dev-Build von `develop` (Vite-Dev-Server, Seed-Version 1.19). Frische Installation ohne Dev-Kanal, Dev-Preview mit Testdaten `medium` (480 Einträge), einmal `vite build` und `preview` für den Offline-Test. Lokaler Sync-Server aus `dev:all`.
- **Datum:** 2026-10-29. **Dauer:** etwa 2,5 Stunden Testzeit (Rollenspiel in Skripten, Screenshots geprüft).
- **Nicht getestet:** Push-Benachrichtigungen (Erlaubnis im Headless-Browser nicht erteilbar), Kamera, Teilen-Menü, Windows-/Android-Shell, ToDos im Detail (Putzplan nur über Schnellerfassung), Rechnung bezahlt markieren, Budget-Limits setzen, Unterlage mit Datei anhängen.

Screenshots: `docs/qa/mia-familie/screenshots/`. Maschinenlesbar: `findings.json`.

---

## Kurzfassung

Nemo ist als Handy-App für Einzelpersonen sehr nah an dem, was Mia braucht: Schnellerfassung per Satz, Vorräte, Einkauf, Geburtstage mit Geschenken. Für eine Familie fehlt der Kern: **keine Zuordnung zu Personen** (Termine, Aufgaben, Unterlagen), **keine flexiblen Wiederholungen** (alle 2 Wochen, Mo+Mi) und **Teilen mit dem Partner nur über einen selbst betriebenen Server**. Dazu kommen ein paar Stolperer im Alltag (zwei Kästchen pro Einkaufszeile, Profil „Alltag“ schaltet Rechnungen aus, keine kommenden Termine auf der Übersicht).

---

## Fehler

Schwere: blocker / hoch / mittel / niedrig. „Plattform“: M = Handy-Viewport, D = Desktop-Viewport.

### F01 · hoch · Zwei Kästchen pro Zeile in Einkaufs- und Packliste
- **Schritte:** 1. Haushalt → Listen → Einkauf. 2. „Milch“, „Brot“ eintragen. 3. Eine Zeile ansehen.
- **Erwartet:** Ein klares Kästchen zum Abhaken.
- **Tatsächlich:** Pro Zeile stehen zwei gleich aussehende Kästchen nebeneinander. Das linke ist „Auswählen“ (Mehrfachauswahl, Bar mit „1 ausgewählt / Abhaken / Löschen / Abbrechen“), das rechte ist das eigentliche Abhaken. Im Supermarkt mit einer Hand trifft Mia mit gutem Willen das falsche und landet in einem Auswahlmodus, den sie nicht kennt.
- **Screenshot:** `m11_list.png`
- **Häufigkeit:** immer. **Plattform:** M (Desktop nicht geprüft).

### F02 · hoch · Profil „Alltag“ passt nicht zum Alltag einer Familie
- **Schritte:** 1. Einrichtung starten → Schritt 3 „Profil und Module“. 2. „Alltag“ antippen. 3. Ganz nach unten zu „Das ändert sich“ scrollen.
- **Erwartet:** Alltag = Kalender, Listen, Vorräte, Personen, Rechnungen.
- **Tatsächlich:** „Alltag“ schaltet **Finanzen, Rechnungen und Abos ab** und enthält **Vorräte** und **Unterlagen** nicht. Die Folge steht erst nach einer langen Liste von 15 Modulen unten. Die Beschreibung der Karte („Kalender, Aufgaben, Erinnerungen, Einkauf, Notizen, Geburtstage“) erwähnt das Abschalten nicht. Mia hätte ohne genaues Lesen keine Rechnungen mehr.
- **Screenshot:** `m01_profile.png`, `m02_modules.png`
- **Häufigkeit:** immer. **Plattform:** M.

### F03 · mittel · „Weiter“ ist grau ohne Erklärung
- **Schritte:** 1. Wie F02, Profil „Alltag“ antippen. 2. „Weiter“ ansehen.
- **Erwartet:** Ein Hinweis, warum es nicht weitergeht.
- **Tatsächlich:** Der Hauptknopf „Weiter“ ist deaktiviert. Der Grund (ein Häkchen „Ich habe die Änderungen geprüft…“) steht ganz unten, außerhalb des Bildschirms. Ein Nutzer sucht den Fehler bei sich oder tippt wiederholt.
- **Screenshot:** `m02_modules.png`
- **Häufigkeit:** immer. **Plattform:** M.

### F04 · mittel · Willkommenskarte: Text abgeschnitten, Knöpfe „Einschalten / Nicht jetzt“ unsichtbar
- **Schritte:** 1. Frische Installation öffnen. 2. Karte „Willkommen bei Nemo“ ansehen.
- **Erwartet:** Voller Text. Die Frage zur Lesehilfe mit ihren zwei Knöpfen erkennbar.
- **Tatsächlich:** Der Text ist mitten im Satz mit „…“ gekürzt („Du kannst das auch später in den Einstellungen…“). Die Lesehilfe-Frage ist ebenfalls gekürzt. Ihre Knöpfe „Einschalten“ und „Nicht jetzt“ stehen im Text, sind aber abgeschnitten und nicht bedienbar.
- **Screenshot:** `f01.png`, `m53_offline.png`
- **Häufigkeit:** immer (Handy, 412 px). **Plattform:** M.

### F05 · mittel · Übersicht zeigt keine kommenden Termine
- **Schritte:** 1. Per Schnellerfassung „morgen 15 Uhr Zahnarzt Lena“ speichern. 2. Zur Übersicht. 3. Auch „Mehr anzeigen · 10 Widgets“ aufklappen.
- **Erwartet:** Der Termin von morgen ist auf der Übersicht zu sehen. Mia plant für „heute und morgen“.
- **Tatsächlich:** „Heute“ sagt „Noch nichts geplant“. In der frischen Standardansicht gibt es kein Termin-Widget, auch nicht unter „Mehr anzeigen“. Der Termin steht nur im Kalender. (Mit Testdaten erscheint ein Widget „Termine“, aber nur für heute.) Morgen und die Woche sieht Mia nirgends auf einen Blick.
- **Screenshot:** `m31_home_more.png`, `m09_after1.png`
- **Häufigkeit:** immer. **Plattform:** M, D.

### F06 · mittel · Schnellerfassung erkennt Wiederholung und Datum nur teilweise
- **Schritte:** 1. „+“ → Satz eintippen. 2. Chips unter dem Feld ansehen.
- **Ergebnisse:**
  - „jeden Dienstag 16 Uhr Fußball Max“ → Ziel **Erinnerungen** (Mia erwartet Termin im Kalender).
  - „alle zwei Wochen Mittwoch Schwimmen“ → Wiederholung nicht erkannt, Ziel ToDos.
  - „Klassenfahrt Geld einsammeln bis nächsten Freitag“ → „Morgen, 30. Okt.“ (heute ist Donnerstag; „nächsten Freitag“ meint hier eher den in einer Woche).
  - „Zahnarzt in 3 Tagen“ → Ziel ToDos statt Kalender.
- **Erwartet:** Regelmäßige Termine mit Uhrzeit landen im Kalender, „alle zwei Wochen“ wird verstanden, oder die App zeigt klar, was nicht verstanden wurde.
- **Tatsächlich:** siehe oben. Die Chips zeigen immerhin transparent, was verstanden wurde, das ist gut.
- **Screenshot:** `m25_parse_recur.png`
- **Häufigkeit:** immer. **Plattform:** M.

### F07 · mittel · Abgehakte Einträge springen sofort nach unten
- **Schritte:** 1. Einkaufsliste mit 5 Einträgen. 2. Oberste Zeile abhaken. 3. Sofort die zweite abhaken.
- **Erwartet:** Zeile bleibt, bis man die Liste verlässt oder „Gekauftes entfernen“ tippt.
- **Tatsächlich:** Die abgehakte Zeile rutscht ans Ende, die Liste verschiebt sich unter dem Finger. Beim zweiten Tippen trifft man schnell den falschen Eintrag. Es gibt „Rückgängig“ (gut), aber Mia merkt es erst danach.
- **Screenshot:** `m12_checked.png`
- **Häufigkeit:** immer. **Plattform:** M.

### F08 · niedrig · Lange Listeneinträge sind abgeschnitten und nicht lesbar
- **Schritte:** 1. Einkaufsliste. 2. Einen Satz mit über 150 Zeichen eintippen. 3. Ein langes Wort.
- **Tatsächlich:** Beides wird nach zwei Zeilen mit „…“ gekürzt. Der Rest ist ohne Bearbeiten nicht lesbar. Außerdem verdeckt der „+“-Knopf unten rechts den Löschknopf der letzten Zeile.
- **Screenshot:** `m51_longtext.png`
- **Häufigkeit:** immer. **Plattform:** M.

### F09 · niedrig · Sehr schmales Fenster (320 px): Suche und Umschalter kaputt
- **Schritte:** 1. Kalender öffnen. 2. Fenster auf 320 px verkleinern.
- **Tatsächlich:** Die Suche in der Kopfzeile wird zu einem leeren Oval ohne Symbol. Der Umschalter „Kalender / Erinnerungen“ ist abgeschnitten, „Erinnerungen“ nicht erreichbar.
- **Screenshot:** `d05_narrow_cal.png`
- **Häufigkeit:** immer. **Plattform:** D (kleines Fenster), kleine Handys.

### F10 · niedrig · Mitteilungen „Geändert.“ stapeln sich
- **Schritte:** 1. Vorräte → bei „Nudeln“ dreimal „−“ tippen.
- **Tatsächlich:** Zwei gleiche Mitteilungen „Geändert. · Rückgängig“ stehen übereinander. Der Text sagt nicht, was geändert wurde („Nudeln: 2 Stück“ wäre nützlich).
- **Screenshot:** `m29_zero.png`
- **Häufigkeit:** immer. **Plattform:** M.

### F11 · niedrig · Einrichtungs-Karte bleibt auf der Übersicht
- **Schritte:** 1. Einrichtung bis „Fertig“ durchgehen, Benachrichtigungen überspringen. 2. Zur Übersicht.
- **Tatsächlich:** Die Karte „Einrichtung · 10 von 11 Schritten erledigt“ mit „Einrichtung fortsetzen“ belegt weiter den ersten Platz der Übersicht, in blauem Balken (sonst orange). Im Verlauf der Einrichtung standen fünf gleich beschriftete Knöpfe „Einrichtung öffnen“ untereinander. „Ausblenden“ gibt es, aber ohne Hinweis, dass das ein Dauerzustand ist.
- **Screenshot:** `m06_home_empty.png`
- **Häufigkeit:** immer. **Plattform:** M.

### F12 · niedrig · Änderungen vom Partnergerät erscheinen verzögert, Status zeigt „0 empfangen“
- **Schritte:** 1. Gerät A (Mia) und Gerät B (Tom) mit demselben Sync-Server verbinden. 2. Auf B „Zahnpasta von Tom“ in den Einkauf. 3. Auf A öffnen, „Jetzt synchronisieren“.
- **Tatsächlich:** A zeigt „0 empfangen, 0 gesendet“ und den neuen Eintrag nicht. Auf dem Server steht „43 Einträge“. Später (nach erneutem Aufruf) waren „5 Artikel offen“ und beide Einträge da. Die Statuszahl („155 empfangen“ beim ersten Verbinden bei 41 Einträgen) ist für Laien nicht nachvollziehbar. Nicht eindeutig reproduziert, möglicherweise Testartefakt zweier Profile im selben Browser.
- **Screenshot:** `m46_sync_dev2.png`
- **Häufigkeit:** manchmal. **Plattform:** M.

### F13 · niedrig · Modul „Beispiel“ in der Modulauswahl
- **Schritte:** Einrichtung → Profil und Module → Liste ansehen.
- **Tatsächlich:** Ganz oben steht „Beispiel · Referenzmodul aus dem Generator: … Dient als Vorlage und Testträger.“ Für Nutzer ohne Bedeutung.
- **Screenshot:** `m02_modules.png`
- **Häufigkeit:** immer (frische Installation ohne Dev-Kanal). **Plattform:** M.

### F14 · niedrig · Profilkarten: Titel und Knopf heißen gleich, kein sichtbarer Zustand
- **Tatsächlich:** Auf jeder Karte steht „Alltag“ als Titel und „Alltag“ als Knopf. Nach dem Antippen wird der Knopf nur leicht grau. Welches Profil gilt, ist ohne Scrollen nach unten nicht zu erkennen.
- **Screenshot:** `m01_profile.png`

### F15 · niedrig · Vorräte: Filter klebt an der Überschrift
- **Tatsächlich:** Der Filter „Alle / Läuft bald ab / Nachkaufen“ hat keinen Abstand zur ersten Überschrift „Kühlschrank“.
- **Screenshot:** `m28_vorraete_list.png`

---

## Verbesserungen

### V01 · Nutzen hoch · Personen als Familienmitglieder: zuordnen und filtern
- **Situation:** „Zahnarzt Lena“, „Fußball Max“, „Impfpass Lena“. Mia will auf einen Blick sehen, wer wann wohin muss.
- **Problem heute:** Der Name steht nur im Titel. Es gibt in Terminformular, Aufgaben und Unterlagen kein Feld „Wer“, keine Farbe pro Person, keinen Filter. Das Modul „Personen“ kennt Lena, Max und Oma, aber nichts verweist darauf.
- **Vorschlag:** Optionales Feld „Für“ (eine oder mehrere Personen) bei Termin, ToDo und Unterlage, Farbpunkt je Person im Kalender, Filter „Nur Lena“.
- **Beispiel anderswo:** Familienkalender-Apps färben Termine pro Familienmitglied.

### V02 · Nutzen hoch · Wiederholungen für Familienalltag
- **Situation:** Training jeden Dienstag, Schwimmen alle zwei Wochen, Müll Mo+Do, Putzplan wöchentlich.
- **Problem heute:** Nur täglich, wöchentlich, monatlich, jährlich, versteckt hinter „Mehr Felder“. Keine Intervalle, keine mehreren Wochentage, kein Enddatum erkennbar.
- **Vorschlag:** „Alle N Wochen“, mehrere Wochentage, „bis Datum“, in Schnellerfassung erkennen („alle zwei Wochen“, „Mo und Mi“).

### V03 · Nutzen hoch · Einfaches Koppeln mit dem Partner ohne eigenen Server
- **Situation:** Tom soll die Einkaufsliste und den Familienkalender auf seinem Handy sehen.
- **Problem heute:** Sync braucht Server-Adresse, Zugangstoken, Docker oder Node, Tailscale, Passphrase. Mia kann das nicht einrichten und könnte es Tom nicht erklären. Ohne Sync bleibt jede Liste auf einem Gerät.
- **Vorschlag:** Geräte-zu-Geräte-Kopplung (QR-Code, direkt oder über ein verschlüsseltes Relay, das keine Daten lesen kann), Wizard „Mit Partner teilen“ mit drei Schritten, Teilen einzelner Listen statt aller Daten. Ein fester Cloud-Dienst widerspräche dem Grundsatz „keine Cloud-Pflicht“, ein Koppeln ohne Server tut es nicht.
- **Zusatz:** Die Standardeinstellung „Ende-zu-Ende-Verschlüsselung“ ist vorausgewählt und verlangt 12 Zeichen. Das Wort „Passphrase“ und „Token“ sind für Mia fremd.

### V04 · Nutzen hoch · Übersicht „Heute, Morgen, diese Woche“
- **Situation:** Morgens zwischen Tür und Angel: Wer muss wohin, was fehlt, was ist fällig?
- **Problem heute:** Siehe F05. Fällige oder überfällige Rechnungen stecken unter „Wartet noch · 4“, der Text ist abgeschnitten („Budget „Freize…“). Desktop-Übersicht zeigt nur eine Karte auf großer leerer Fläche.
- **Vorschlag:** Standard-Widget „Die nächsten Tage“ (heute, morgen, Rest der Woche) mit Personenfarben. Überfälliges Geld sichtbar statt eingeklappt.

### V05 · Nutzen hoch · Profil „Familie“ in der Einrichtung
- **Situation:** Mia will mit einem Tipp starten.
- **Problem heute:** „Alltag“ schaltet Geld-Module aus (F02), Vorräte und Unterlagen fehlen. Zwölf Schritte inklusive Sync, KI, Konten verknüpfen, „Import per KI“, „Startdaten“ sind für sie viel. Die meisten Schritte hat sie mit „Weiter“ übergangen.
- **Vorschlag:** Profil „Familie“ (Kalender, Listen, Vorräte, Personen, Unterlagen, Rechnungen, Budgets), Kurzstart mit 3 Schritten (Name, Profil, Fertig), alles andere später unter „Mehr einrichten“.

### V06 · Nutzen mittel · Packlisten-Vorlagen
- **Situation:** Urlaub in Italien, Schulranzen, Wochenendtrip mit Kindern.
- **Problem heute:** „Aus Vorlage“ bietet nur Morgenroutine, Abendroutine, Wochenplanung. Das Handbuch verspricht „Packlisten“. Packliste „0 von 5 gepackt“ mit „Alles zurücksetzen“ und „Als Vorlage kopieren“ ist sehr gut.
- **Vorschlag:** Mitgelieferte Vorlagen „Urlaub mit Kindern“, „Strand“, „Skifahren“, „Schulranzen“ mit Sektionen (Kleidung, Papiere, Medikamente) und Person pro Eintrag.

### V07 · Nutzen mittel · Einkauf: Mengen, Läden, Teilen als Text
- **Situation:** Drogerie und Supermarkt getrennt, Partner schreibt „bring Milch mit“.
- **Problem heute:** „Bananen 1 kg“ bleibt Text, „2 Brot“ wird zur Menge. Es gibt keine Kategorien nach Gang oder Laden, die Liste ist nach Eingabe sortiert. Kein Teilen der Liste als Text (zum Beispiel per WhatsApp), obwohl „Person per WhatsApp gratulieren“ existiert.
- **Vorschlag:** Optionale Gruppen (Obst, Kühlregal, Drogerie), Knopf „Als Text teilen“.

### V08 · Nutzen mittel · Unterlagen: Person, Ablauf-Hinweis, Datei-Sicherung
- **Situation:** Kinderreisepass Lena läuft im Dezember ab, Impfpass-Foto soll nicht verloren gehen.
- **Problem heute:** Unterlagen liegen unter „Mehr → Tresor“ (Mia sucht „Dokumente“). Das Formular hat „Anbieter“, aber kein „Für wen“. Dateien bleiben nur auf dem Gerät und sind weder im Sync noch im Backup. Der Hinweis dazu ist ehrlich, aber das Foto des Impfpasses ist damit bei einem Handyverlust weg.
- **Vorschlag:** Eigener Menüpunkt „Dokumente“ (Tresor bleibt Tresor), Feld „Für“, optional Dateien ins verschlüsselte Backup mit klarer Größenangabe.

### V09 · Nutzen mittel · Erinnerung als Standard bei Terminen
- **Situation:** Zahnarzt morgen um 15 Uhr.
- **Problem heute:** „Benachrichtigen“ steht standardmäßig auf „Nicht benachrichtigen“. Die Erlaubnis für Benachrichtigungen wurde im Setup abgelehnt, der Schritt bleibt „Übersprungen“. Mia merkt erst am Tag selbst, dass nichts erinnert.
- **Vorschlag:** Vorgabe „1 Stunde vorher“ bei Terminen mit Uhrzeit, einmaliger ruhiger Hinweis nach dem ersten Termin, wenn Erlaubnis fehlt. Muss abschaltbar bleiben (Fokus-Richtlinien).

### V10 · Nutzen mittel · Haushaltsaufgaben reihum verteilen
- **Situation:** Putzplan: Max Müll, Lena Spülmaschine, wöchentlich wechselnd.
- **Problem heute:** Wiederkehrende Aufgaben („Müll rausbringen jeden Montag“) landen als Erinnerung, ohne Person. Kein Wechsel, keine Sicht „Wer ist diese Woche dran?“. Nicht tief getestet.
- **Vorschlag:** Wiederholung mit Person und optionaler Rotation, Wochenansicht „Haushalt“.

### V11 · Nutzen mittel · Backup: verschlüsselt als erste Wahl
- **Situation:** Mia sichert die Daten der Kinder.
- **Problem heute:** Der Knopf „Backup herunterladen“ erzeugt eine Klartext-Datei mit allen Einträgen (JSON). Die verschlüsselte Variante wird „empfohlen“, steht aber darüber mit Passwortfeld und ist wegen „es gibt keine Rücksetzung“ abschreckend. Die Wiederherstellungsvorschau („Das passiert bei der Wiederherstellung: Listen: 12 neu …“) ist dagegen vorbildlich.
- **Vorschlag:** Verschlüsselt als Hauptknopf, Klartext als Nebenoption mit Warnung. Erinnerung nach 30 Tagen ohne Backup (ruhig, abschaltbar).

### V12 · Nutzen niedrig · Erste Hilfe bei leeren Listen
- **Problem heute:** Leere Einkaufsliste zeigt „Startdaten einrichten / Einrichtung öffnen“. Mia will nur „Milch“ eintragen, nicht Daten importieren.
- **Vorschlag:** Leerer Zustand sagt „Tippe oben, was du brauchst“, Startdaten nur in den Einstellungen.

### V13 · Nutzen niedrig · Kalender: weniger Rauschen für den Familienblick
- **Problem heute:** Mit Testdaten stehen Kündigungsfristen, Garantien und Abo-Daten gleichrangig neben Arztterminen, Einträge sind gekürzt („Garantie en…“).
- **Vorschlag:** Schalter oder Filter „Nur Termine“, Fristen dezenter.

---

## Was gut ist (bitte behalten)

1. **Schnellerfassung per Satz.** „morgen 15 Uhr Zahnarzt Lena“ wird zu Kalender, 30. Okt., 15:00, mit sichtbaren Chips und „Rückgängig“. Zwei Taps bis gespeichert.
2. **„3 Dinge reichen für heute.“** Die ruhige Übersicht mit einem Vorschlag und „Später“ ohne Schuldgefühl.
3. **Vorräte mit +/− und „Wird knapp“.** Menge auf 0 tippen, dann „Auf die Einkaufsliste“, und die Übersicht meldet „1 Vorrat geht zur Neige“.
4. **Packlisten mit Fortschritt.** „0 von 5 gepackt“, „Alles zurücksetzen“, „Als Vorlage kopieren“.
5. **Personen mit Geburtstagen.** „wird 9 · in 4 Tagen“, sortiert nach dem nächsten Geburtstag, Geschenkideen mit Preis, Link, Stand, „per WhatsApp gratulieren“.
6. **Lokaler Assistent.** „Was steht morgen an?“ antwortet sofort mit „Zahnarzt Lena“, Hinweis „Lokal · 0 Token“, ohne KI-Anbieter.
7. **Rückgängig statt Rückfrage.** Abhaken, Entfernen, Mengenänderung haben „Rückgängig“.
8. **Backup-Wiederherstellung mit Vorschau.** Klar, was dazukommt, ersetzt oder gelöscht wird, mit automatischer Sicherheitskopie.
9. **Sprachen, Dunkelmodus, Offline.** Wechsel auf Englisch übersetzt alles inklusive Widgets, dunkles Design lesbar, App lädt offline neu und nimmt Einträge an.
10. **Wiederholte Rechnungen.** „Wiederholen: Nie“ mit Hinweis „Wird die Rechnung bezahlt, entsteht die nächste automatisch.“

---

## Verständnis

| Begriff / Stelle | Problem für Mia | Vorschlag |
|---|---|---|
| „Tresor“ enthält Unterlagen | Sie sucht Impfpass unter „Dokumente“. Tresor klingt nach Passwörtern. | Bereich „Dokumente“, Passwörter separat „Tresor“ |
| „Erweitert“-Schalter bei jedem Modul | Unklar, was dahinter steckt, und ob sie ihn braucht. | Beschriftung „Mehr Felder anzeigen“ |
| „Mehr Felder“ im Terminformular | Wiederholung versteckt, obwohl häufig. | Wiederholung sichtbar machen |
| Doppelte Beschriftung „Kalender“ (Tab, Überschrift, Pille) | Wirkt wie ein Fehler. | Nur eine Ebene |
| „Zufällige Erinnerung“, „Nächste Erinnerung“ (Glocke) | Mia erwartet eine Liste der Erinnerungen. | Erklärtext oder Liste |
| „Lokal · 0 Token“ | „Token“ unbekannt. | „Lokal berechnet, nichts gesendet“ |
| Sync: Server, Zugangstoken, Tailscale, Passphrase | Kein Wort kennt sie. | Wizard „Mit Partner teilen“ |
| „Zusammenführen“ / „Ersetzen“ beim Import | Erklärtext hilft, aber „Ersetzen löscht“ ist knapp. | Ersetzen als Warnung gestalten |
| „Wartet noch · 4“ | Unklar, ob wichtig oder erledigt. | „4 weitere Hinweise“ |
| „Anheften…“, „Später nicht mehr“ (Wetter) | Nicht klar, was angeheftet wird bzw. was später nicht mehr passiert. | „Wetter ausblenden“ |
| „Eingang“ (Karte für eben gespeicherte Notiz) | Begriff unbekannt. | „Neu erfasst“ |
| „Ziel: Erinnerungen“ in Schnellerfassung | Sie versteht nicht, wohin der Eintrag geht. | „Wird gespeichert als: Erinnerung in …“ |
| „Startdaten einrichten“ in leeren Listen | Siehe V12. | siehe oben |
| Modulbeschreibung „Referenzmodul aus dem Generator“ | Entwicklerjargon. | Modul ausblenden |
| Datum im Browser als „mm/dd/yyyy“ | Im Test-Chromium englische Anzeige, auf deutschem Handy wahrscheinlich anders. | Nicht bewertet |
| Werkzeug-Symbol (Schraubenschlüssel) in der Kopfzeile | Erwartet Einstellungen, findet Rechner und QR. | Beschriftung „Werkzeuge“ auch auf dem Handy |

---

## Tagesurteil

**Würde Mia weitermachen?** Ja, aber nur für sich allein. Einkauf, Vorräte, Geburtstage und Schnellerfassung nutzt sie sofort und gern. Das ist reizarm und schnell. Für den Familienbetrieb reicht es nicht.

**Wie oft würde sie öffnen?** Morgens ein Blick auf die Übersicht (30 Sekunden), unterwegs zwei- bis dreimal Einkauf und eine Schnellerfassung, abends am PC Rechnungen und Termine. Etwa fünf bis sieben Öffnungen am Tag, solange die Einkaufsliste das Handy-Ziel bleibt.

**Der eine Grund zum Deinstallieren:** Tom sieht nichts davon. Ohne einfaches Teilen der Einkaufsliste und des Familienkalenders (ohne Server, Token und Tailscale) wird aus Nemo wieder Mias persönliche Notizen-App, und die Familie bleibt bei der WhatsApp-Gruppe. Dazu passt: Termine kennen keine Personen.

**Was die Persona einem Partner oder Kind erklären müsste:** die zwei Kästchen, „Tresor“ für Dokumente, wie man Tom auf das zweite Handy bekommt (das kann sie nicht).
