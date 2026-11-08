# Person C – Funde (Erstkontakt-Runde 5)

Persona: [PERSONA.md](PERSONA.md). Branch `feat/demo-c`, Basis `develop` @ `47dfe57` (2026-11-08). Lauf mit `npm run dev:all` (Dev-Preview-Variante: leeres Profil füllt sich mit Testdaten), Playwright-Chromium als Samsung-Handy: 412×915, Touch, Android-UA, `de-DE`, Europe/Berlin, hell und dunkel. Zwei Starts: **Testprofil** (frisches Profil, Testdaten laden automatisch, keine Einrichtung) und **leeres Profil mit Einrichtungsassistent** (`localStorage['tm-seed-autofilled']='1'`). Touch-Ziele mit `elementFromPoint` gemessen (echte Trefferfläche, nicht nur die Optik). Screenshots: [shots/](shots/) (nur erfundene Testdaten).

**Schwere:** Abbrecher = er legt die App weg · Stolperstein = er stockt, schafft es aber · Kosmetik.

## Zahlen vorher / nachher

| Aufgabe | Vorher | Nachher |
|---|---|---|
| 1 · Drei Dinge in 10 s, eins mit Uhrzeit | 2 Taps (+ „Schließen“ auf dem Dev-Preview-Hinweis, der das „+“ verdeckt), ≈ 1,9 s ohne Tippen; Satzanfang scrollt aus dem Feld | 2 Taps, ≈ 1,0 s ohne Tippen; ganzer Satz sichtbar; Feldbeispiel zeigt „zwei Dinge in einer Zeile“ |
| 2 · Erinnerung setzen, App zu, sie kommt | 2 Taps; **keine Rückfrage nach Benachrichtigungen**, auf dem frischen Handy kommt nichts | 2 Taps + 1× „Zulassen“ im System-Dialog; nach „Nein“ sagt der Hinweis ruhig, wo es geht (mit Rückgängig) |
| 3 · Ausgabe + „noch offen diesen Monat“ | „Tanken 62,40“ → **ToDo** (still falsch); mit „€“ 3 Taps (+, Speichern, Buchen); „noch offen“ nur als kleine Zeile unter Geld → Finanzen | „Tanken 62,40“ → Ausgabe, 3 Taps; „noch offen“ unverändert (an demo-b) |
| Halber Satz, App vom System beendet | Text weg | Text wieder da (bis 30 Min, nur auf dem Gerät) |
| Touch-Ziel „Ruhig / Ausführlich“ | 38 px Trefferfläche | 44 px |

Erster Start bis erste erledigte Aufgabe (Testprofil): vorher ≈ 4 Taps (Hinweis schließen, +, Speichern) und ≈ 15 s mit Tippen; nachher gleich viele Taps. Der verdeckende Hinweis (C06) liegt bei demo-a / install-first-run.

## Funde

| Id | Schritt | Erwartet / Ist (in seinen Worten) | Schwere | Datei:Zeile | Fix | Aufw. | Status |
|---|---|---|---|---|---|---|---|
| C01 | Aufgabe 2 | „Ich stell mir 'ne Erinnerung, mach zu – und es kommt nix? Dann brauch ich das nicht.“ Eine Erinnerung aus der Schnellerfassung fragt nie nach Benachrichtigungen. Mit Testprofil (ohne Einrichtung) fragen nur der Termin-Dialog und die Einstellungen. Auf Android 13+ kommt dann keine Erinnerung. | **Abbrecher** | `web/src/quickCapture/ui/announceSaved.ts`, `ui/alertPermission.ts` | Die erste gespeicherte Erinnerung fragt einmal je Gerät (nie wieder, auch nicht nach Wegwischen). Bleibt es aus, sagt die Gespeichert-Meldung kurz, wo es geht (Einstellungen bzw. Handy-Einstellungen bei „blockiert“); Rückgängig bleibt, Schalter „Hinweis, wenn Benachrichtigungen aus sind“. Nach „Ja“ werden die Android-Wecker sofort neu geplant. | S | gefixt (Tests: `alertPermission.test.ts`, `announceSaved.test.ts`, e2e `capture-phone.spec.ts`) |
| C02 | Aufgabe 3 | „Tanken 62,40 – das ist doch klar 'ne Ausgabe.“ Ist: ToDo „Tanken 62,40“. Ohne €-Zeichen wurde kein Betrag erkannt. | Stolperstein | `web/src/quickCapture/parser/index.ts:66`, `:212` | Betrag mit genau zwei Nachkommastellen am Anfang oder Ende = Ausgabe. „Version 1,25 testen“, „Arbeitszeit 7,5“ bleiben Text. | S | gefixt (`parser/round5c.test.ts`) |
| C03 | Aufgabe 1 | „Zahnarzt Do 14 Uhr – wieso steht der heute drin?“ Ist: Titel „Zahnarzt Do“, Datum heute. | Stolperstein (falscher Termin = Vertrauen weg) | `web/src/quickCapture/parser/index.ts:62` | Mo–So zählen nach „am“ oder direkt vor einer Uhrzeit mit „Uhr“ oder Doppelpunkt. „So ein Mist“, „Fr. Müller“, „Do it yourself“ bleiben Text. Wie bei „Donnerstag“: nie heute. | S | gefixt (`parser/round5c.test.ts`) |
| C04 | Störung: Hintergrund | „Halb getippt, Kunde kommt, zurück – alles weg.“ Wenn Android die App beendet, ist der Text der Schnellerfassung verloren. | Stolperstein | `web/src/quickCapture/ui/CaptureForm.tsx:88`, `ui/draft.ts` | Das Blatt in der App hält den Text auf dem Gerät, bis es geschlossen, gespeichert oder 30 Min alt ist (wie der Absturz-Entwurf der Notizen). Teilen-Seite und Desktop-Fenster bleiben wie bisher. | S | gefixt (`CaptureForm.test.tsx` C04, e2e) |
| C05 | Aufgabe 1 | „Wo ist der Anfang von meinem Satz?“ Das Feld ist eine Zeile hoch; ein umgebrochener Satz scrollt seinen Anfang weg (412 px). | Kosmetik | `web/src/quickCapture/ui/CaptureForm.module.css:90` | `field-sizing: content`, höchstens 6 Zeilen | S | gefixt (e2e `capture-phone.spec.ts`) |
| C06 | Erster Start | „Wo trag ich was ein?“ Der Dev-Preview-Hinweis (unten, ohne Zeitlimit) liegt genau über dem „+“. Das Erste, was er sehen soll, ist verdeckt. | Stolperstein | `web/src/ui/Misc.tsx:119` (Toaster), Dev-Preview-Hinweis | Hinweise am Handy über dem „+“ oder Dev-Preview-Satz ins Testdaten-Banner | S | Board an demo-a + install-first-run |
| C07 | Aufgabe 3 | „Speichern – und dann nochmal Buchen? Wieso fragt der zweimal?“ Finanzeinträge aus der Schnellerfassung brauchen den Bestätigungsschritt. | Stolperstein | `web/src/quickCapture/targets/adapters.ts:125` | Entscheidung (features.md, Komfort-Paket 2) – nicht geändert; Frage an Sven | – | Board an demo-b, Frage im PR |
| C08 | Aufgabe 1 | „Kann ich da auch mehrere Sachen reinschreiben?“ Das Feldbeispiel zeigt nur einen Termin. | Kosmetik („würde ihn freuen“) | `web/src/strings.ts` `quickCapture.placeholder` | Beispiel „Tanken 62,40, morgen 9 Uhr Kunde anrufen“; ein Test hält es lesbar für den Parser | S | gefixt (`parser/round5c.test.ts` C08) |
| C09 | Übersicht | „Ich wollt auf Ruhig, jetzt ist alles voll.“ Der Umschalter „Ruhig / Ausführlich“ trifft nur auf 38 px; laut Kommentar sollte er 44 px haben, das Polster nahm aber keine Taps an. | Stolperstein | `web/src/ui/Patterns.module.css:74` | Trefferstreifen `::after` über das Polster, Optik gleich | S | gefixt (e2e `touch-hit-phone.spec.ts`) |
| C10 | Aufgabe 3 | „Was kommt diesen Monat noch?“ Antwort nur als kleine Zeile „offene Rechnungen −… · Abos bis Monatsende −…“ unter Geld → Finanzen; auf der Übersicht nichts. | Stolperstein | `web/src/modules/finance/**` | Karte „Diesen Monat“ (demo-b plant sie) | M | Board an demo-b |
| C11 | Erster Start (Testprofil) | „Steht nix an? Im Kalender ist doch alles voll.“ Während die Testdaten laden, zeigt die Übersicht „In den nächsten Tagen steht nichts an“ und kein „Jetzt wichtig“. Das bleibt so (gemessen nach 3/6/10/15 s), bis man neu lädt. | Stolperstein | `web/src/home/*`, `web/src/core/seed/dev.ts:377` | Übersicht nach dem Auto-Füllen neu laden lassen | S–M | Board (home/seed, nicht beansprucht), Follow-up |
| C12 | Leerer Start | „Zwei Fragen auf einmal, vier Knöpfe – Später.“ Die Willkommenskarte fragt Lesehilfe und Einrichtung gleichzeitig; Fokus-Hilfen werden nicht angeboten. | Stolperstein | `web/src/layout/setup/WelcomeCard.tsx` | Eine Frage zur Zeit, Fokus-Angebot als normales Angebot für alle | S | Board an demo-a (Wünsche) |
| C13 | Störung: Undo nach Neustart | Gelöschtes ToDo, App neu gestartet: Rückgängig ist weg, kein „Zuletzt gelöscht“. | Stolperstein | – | bekannt: V20 / ROADMAP K4 | L | bekannt, nicht neu |
| C14 | Aufgabe 2 (PWA) | Als Web-App kommen Erinnerungen bei geschlossener App nur mit Push-Server. | (Abbrecher in der PWA) | – | bekannt: B19. Für C: die APK schicken (Nachricht) | – | bekannt, nicht neu |
| C15 | Aufgabe 3 | „Mittag 8,50“ → Termin 12:00 „8,50“ („Mittagessen 8,50“ geht). Umgekehrt: „Zug 7,45“ ohne Zeitwort wird Ausgabe 7,45 € (mit „um 7,45“ nicht) – die Vorschau zeigt es vor dem Speichern | Kosmetik | `web/src/quickCapture/parser/index.ts` | Mahlzeit-Wort vor Betrag nicht als Uhrzeit lesen | S | offen (selten) |

## Störungen (Tester-Modus) – Ergebnis

| Versuch | Ergebnis |
|---|---|
| Doppeltipp auf Speichern | 1 Eintrag (Knopf sperrt während des Speicherns) |
| Zurück-Geste mitten im Dialog | „Entwurf verwerfen?“ mit „Weiter bearbeiten“ / „Verwerfen“ – nichts verloren ([shot](shots/before-6-back-gesture.png)) |
| App in den Hintergrund / beendet, mitten in der Eingabe | vorher Text weg → **C04**, nachher wieder da |
| Leere Eingabe | Speichern gesperrt; Enter → „Bitte gib etwas ein.“ |
| 500 Zeichen + Emoji | gespeichert, Liste ohne waagerechtes Scrollen (412 px) |
| Zehnmal schnell hinzufügen | 10 Einträge, höchstens 3 Hinweise gleichzeitig |
| Undo nach Löschen nach Neustart | nicht möglich → C13 (bekannt) |
| Offline ein/aus, drehen | nicht im Browser-Lauf gemessen; Service Worker und Drehen auf dem Gerät prüfen (MANUAL-TESTS) |
| `<script>`, `<img onerror>` in Schnellerfassung und `/share?title=` | als Text angezeigt, nichts ausgeführt |
| `'; DROP TABLE x;--` | Text bleibt Text (IndexedDB, kein SQL); „;“ trennt in zwei Einträge, Vorschau zeigt es vorher |
| `/../../etc/passwd`, `%2e%2e`, `/todos/%00` | „Seite nicht gefunden“ |
| `/notes/..%2f..%2fsettings`, `/example`, `/accounts` (Modul aus) | Weiterleitung in die Modul-Bibliothek |
| `/settings/<3000 Zeichen>` | „Diese Kategorie gibt es nicht.“ |
| `/calendar?date=../../x`, `9999-99-99` | Kalender auf heute |
| URL-Parameter mit 20 000 Zeichen | Vite-Dev-Server antwortet 431 (nur Dev-Server, kein App-Fehler) |

## Urteil in seinen Worten (simuliert aus der Persona – C hat die App noch nicht gesehen)
„Reintippen geht schnell: drei Sachen in einer Zeile, und das Ding versteht ‚Do 14 Uhr' und ‚Tanken 62,40'. Kaputt gekriegt hab ich nur, dass die Erinnerung nicht nach der Erlaubnis gefragt hat und mein halber Satz weg war – beides ist jetzt drin. Ich behalt's erst mal, wenn mir die Erinnerung morgen früh wirklich kommt, und ‚was ist diesen Monat noch offen' will ich auf der Startseite sehen.“
