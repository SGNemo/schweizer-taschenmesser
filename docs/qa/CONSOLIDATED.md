# QA-Konsolidierung – sieben Personas, ein Bild

Stand 2026-10-29. Quelle: `docs/qa/<persona>/REPORT.md` + `findings.json` (Herbert, Jonas, Lena, Mia, Priya, Sofía, Tom), getestet auf `develop` @ `4af432d`. Maschinenlesbar: [consolidated.json](consolidated.json). Kein Code geändert.

**Lesehilfe:** Schwere/Nutzen hoch = 3, mittel = 2, niedrig = 1. Rang = Wert × Zahl der Personas, bei Fehlern +3, wenn eine Persona den Fund als ihren „einen Grund zum Deinstallieren“ nennt. Herkunfts-IDs in Klammern: H Herbert, J Jonas, L Lena, M Mia, P Priya, S Sofía, T Tom (`P-B07` = Priya, Fehler B07). Alles wurde nur im Browser/Viewport getestet, nie auf APK oder Windows-exe: Funde mit „prüfen“ brauchen ein Gerät.

## 1. Die fünf wichtigsten Funde

1. **Schmale Kopfzeile (B03):** 6 von 7 Personas; Suchfeld wird zum leeren Oval, Kalender-Umschalter abgeschnitten.
2. **Erinnerungen nur mit offener App oder Server-Push (B19):** Lena und Jonas würden deshalb deinstallieren. Erst auf dem Gerät prüfen: die Android-App plant Alarme selbst, die PWA nicht.
3. **Einrichtung mit 12 Schritten (V01):** 7 von 7 Personas wollen einen 3-Fragen-Weg; dazu widersprüchliche Fortschrittszahlen (B04) und Profile, die Module still abschalten (B06).
4. **Verpasste Kündigungsfrist und Löschen ohne Rückgängig bei Unterlagen (B08, B09):** Herbert – Vertrauensbruch bei Dingen, die Geld oder Papiere kosten.
5. **Doppelkästchen in der Einkaufsliste (B01)** und **README/Website „Oberfläche ist Deutsch“ (B15):** das eine bremst die meistgenutzte Handy-Funktion, das andere hält Sofía vom Download ab.

**Sicherheit/Vertrauen, zusammengefasst:** Kein Blocker, kein hoher Fund. Die Kernversprechen hielten im Test (kein Netz ohne Klick im Offline-Build, KI sieht keine Daten, Tresor verschlüsselt, manipulierte *verschlüsselte* Backups werden abgelehnt). Fünf mittlere Funde: Ollama-Probe im Setup (B21), Suchverlauf im Klartext (B23), Klartext-Backup ohne Prüfsumme (B24), Kalender-Abo-Prüfung (B26) und ein Verfügbarkeitsthema im Sync-Server (B33, **vertraulich**, Details nur in [Toms Bericht](tom-sysadmin/REPORT.md) F-05 und direkt an Sven).

## 2. Top-20-Fehler

| # | ID | Fehler | Personas | Schw. | Wert | Stand | Paket |
|---|---|---|---|---|---|---|---|
| 1 | B03 | Kopfzeile bricht bei schmaler Breite: Suchfeld wird leeres Oval, Kalender/Erinnerungen-Umschalter abgeschnitten (412 px mit laufender Fokus-Runde, 320–640 px sonst) | Jonas, Herbert, Lena, Mia, Priya, Sofía (6) | hoch | 18 | neu | P2 |
| 2 | B19 | Erinnerungen bei geschlossener App: der App-Text sagt, ohne Sync-Server-Push kommt nichts an; Fristen/Medikamente können unbemerkt ausbleiben ⚠ | Lena, Jonas, Sofía, Mia (4) | hoch | 15 | teilweise bekannt | P5 |
| 3 | B13 | Sprach- und Formatreste in fremder Oberfläche: deutsche Stärke-Hinweise und KI-Anbieter im spanischen Tresor/Assistenten, „KW 44“, „1.“ als Tag, „Octubre De“, deutsche Anführungszeichen, englischer Rechtstext, „06:00 Uhr“ in EN, „for 12 days“ statt „12 days overdue“, Diagnose-Vorschau | Sofía, Lena, Priya, Tom (4) | hoch | 12 | bekannt (Übersetzung maschinell, nicht geprüft: docs/i18n/README.md) | P3 |
| 4 | B04 | Einrichtung: Fortschrittszahlen widersprechen sich („Schritt x von 12“, „10 von 11 erledigt“), übersprungene Schritte zählen als „Erledigt“, Karte bleibt nach „Fertig“ mit mehreren gleichen Knöpfen | Herbert, Jonas, Lena, Mia, Priya (5) | mittel | 10 | neu (STATUS nennt nur „offene Kleinigkeiten“) | P1 |
| 5 | B01 | Einkaufs-/Packliste: zwei gleiche Kästchen pro Zeile (linkes wählt nur aus), Abgehaktes springt sofort ans Ende, lange Einträge abgeschnitten | Lena, Mia, Sofía (3) | hoch | 9 | neu | P2 |
| 6 | B08 | Verpasste Kündigungsfrist wird nirgends als verpasst markiert (Vertrag steht nur auf „Bald“; Übersicht zeigt es nicht) ⚠ | Herbert, Priya (2) | hoch | 9 | neu | P5 |
| 7 | B12 | Schnellerfassung/Inline-Add erkennt falsch: „… Freitag 12 Uhr abgeben“ wird Termin, „morgen 23:59 Uhr“ bleibt im Titel, Wiederholung/„nächsten Freitag“, Betrag/Endzeit/Priorität, „Rechnung …“ wird ToDo, verstümmelter Titel | Jonas, Mia, Priya, Tom (4) | mittel | 8 | neu (Trefferquote wird nur an Testsätzen gemessen) | P4 |
| 8 | B10 | Schwebender „+“-Knopf verdeckt Felder, Löschknöpfe und Inhalte am unteren Rand (Handy) | Lena, Mia, Priya, Sofía (4) | mittel | 8 | teilweise bekannt (STATUS: FAB → „+ Neu“ nur für Desktop ab 900 px, Entscheidung offen) | P2 |
| 9 | B02 | Willkommenskarte: Text abgeschnitten, Knöpfe „Einschalten / Nicht jetzt“ nicht sichtbar bzw. wie Fließtext (Lesehilfe-Angebot) | Jonas, Lena, Mia, Priya (4) | mittel | 8 | neu | P2 |
| 10 | B14 | Text abgeschnitten ohne Weg, ihn zu lesen: Einrichtungstexte mitten im Wort, lange Rechnungs-/Listen-/Notiztitel, Tresor-Detailspalte, Wörter ohne Leerzeichen | Herbert, Mia, Sofía, Tom (4) | mittel | 8 | neu | P2 |
| 11 | B21 | Datenschutz-Text und Verhalten laufen auseinander: Setup-Schritt „KI-Anbieter“ fragt ungefragt localhost:11434 ab (Konsolenfehler beim ersten Start) ⚠ | Tom, Priya (2) | mittel | 7 | bekannt als Best-Effort-Erkennung (STATUS), Text dazu fehlt | P1 |
| 12 | B09 | Unterlage löschen: sofort weg, weder Rückfrage noch „Rückgängig“; Esc/Klick daneben verwirft getippten Text ⚠ | Herbert (1) | hoch | 6 | neu | P5 |
| 13 | B15 | README und Website sagen „Oberfläche ist Deutsch, weitere Sprachen folgen“, die App hat fünf Sprachen; keine spanische/englische Seite | Sofía, Priya (2) | hoch | 6 | neu (README.md Zeile 26) | P3 |
| 14 | B05 | Einrichtung: „Weiter“ nach Profilwahl grau, Grund (Bestätigungshäkchen) liegt unsichtbar weit unten | Herbert, Mia (2) | hoch | 6 | neu | P1 |
| 15 | B06 | Profile schalten Module ab und sagen es nicht: „Alltag“ blendet Finanzen/Rechnungen/Abos aus, „Finanz-Fokus“ ToDos/Timer/QR; Profilkarten: Titel und Knopf heißen gleich, kein gewählt-Zustand | Mia, Priya (2) | hoch | 6 | neu | P1 |
| 16 | B18 | Übersicht: „Heute: noch nichts geplant“ trotz Erinnerung in „Jetzt wichtig“; keine kommenden Termine (morgen/Woche) im Standard | Lena, Mia, Herbert (3) | mittel | 6 | neu | P4 |
| 17 | B11 | Bestätigungs-Hinweise stapeln sich, verschwinden nicht von selbst, verdecken bis zu ein Fünftel des Handys und sagen nicht, was geändert wurde („Geändert.“) | Lena, Mia, Priya (3) | mittel | 6 | neu | P2 |
| 18 | B16 | Entwickler-Modul „Beispiel“ (Referenzmodul aus dem Generator) erscheint in Modul-Bibliothek/Einrichtung für Nutzer | Sofía, Tom, Mia, Herbert (4) | niedrig | 4 | neu; Priya sah es nur im Dev-Build, Tom im Stable-Build: Kanal prüfen | P1 |
| 19 | B17 | Modul-Einstellungen zeigen Werte ohne Beschriftung („Felder: Monat · 09:00 · 09:00“) und je Modul zwei gleiche „Startdaten einrichten“-Knöpfe; Sicherheitszeile des Tresors unlesbar | Priya, Sofía, Herbert, Tom (4) | niedrig | 4 | neu (nach der Modul-Faltung weiterhin sichtbar) | P3 |
| 20 | B20 | ToDos-Seite am Desktop (1280–1920 px) auf eine 240-px-Spalte gequetscht, Titel brechen buchstabenweise um | Priya (1) | hoch | 3 | neu; nur Priya, Herbert (1920 px) sah es nicht: Zustand (Testdaten „medium/large“, viele ToDos?) klären | P2 |

⚠ = „einer Grund zum Deinstallieren“ einer Persona. Notizen:
- **B03** (J-B1, H-B07, H-B08, L-B-07, M-F09, P-B14, S-B06): Sechs von sieben Personen, jede Seite betroffen.
- **B19** (L-B-02, J-Tagesurteil, S-Tag, M-V09): Test lief als PWA. Die Android-App plant Alarme selbst (docs/features/repeat-reminders.md): erst auf einem Gerät gegenprüfen, danach entweder Text für PWA ehrlicher machen oder Lücke schließen.
- **B13** (S-B01, S-B02, S-B08, S-B09, S-B10, S-B13, S-B14, S-B23, L-B-09, P-B18, T-V-10): Gehört zur Sprachrunde; Sofías Fundliste ist die Prüfliste.
- **B01** (L-B-01, M-F01, M-F07, M-F08, S-B07): Alltagsfunktion Nr. 1 auf dem Handy.
- **B08** (H-B03, P-B05): Herbert: der Grund zum Deinstallieren. Ton: „Frist vorbei am …“, nicht Rot-Alarm (Fokus-Texte).
- **B12** (J-B2, J-B3, M-F06, P-B02, T-F-10, L-V-06): Regelparser; keine KI nötig. Parser-Korpus um diese Sätze erweitern.
- **B10** (L-B-04, M-F08, P-B13, S-I13): Handy-Fall ist neu.
- **B21** (T-F-01, P-B20): Probe erst nach Klick oder im Rechtstext nennen. Tom: der zweite solche Fall mit externer Adresse = deinstalliert.
- **B09** (H-B02, H-B04): Widerspricht dem Grundsatz „Rückgängig überall“ – Lücke, kein Konzeptproblem. Lösung: Undo-Toast und Entwurf behalten, kein Bestätigungsdialog.
- **B15** (S-B03, P-B19): Sofía lädt deshalb nicht herunter. Reine Doku-/Website-Änderung, schnell.
- **B18** (L-B-05, M-F05, H-V01): Hängt mit Verbesserung V02 zusammen.
- **B16** (S-B22, T-F-11, M-F13, H-U04): Ein-Zeilen-Fix, wenn Kanal-Filter fehlt.
- **B20** (P-B01): Reproduktionsbedingung klären, bevor gefixt wird.

### Weitere Fehler (Rang 21+)

| ID | Fehler | Personas | Schw. | Stand | Paket |
|---|---|---|---|---|---|
| B25 | Native Datums-/Zeitfelder im US-Format („10/29/2026“, AM/PM, englische Validierung) in deutscher/spanischer Oberfläche | Jonas, Lena, Sofía, Herbert | niedrig | ungeprüft: vermutlich Test-Chromium; auf echtem Windows/Android prüfen, nicht gerankt | P3 |
| B32 | Sonstiges niedrig: Fokusring am Stern angeschnitten, Schalter „Kalender einschalten“ obwohl an, Touch-Ziele < 44 px im Kalender, Lesehilfe zerlegt Wörter, Namensfeld „für die Begrüßung“ ohne Begrüßung, „Willkommen“ nach Backup-Import in leere App, U+202E in Titeln, einmal doppelter Tresor-Eintrag, „Änderungen dieser Version“ leer, Konsolenwarnung „No routes matched“, Saldo/Balance/Disponible nebeneinander, doppeltes „Mañana“, Kurzbefehl-Hinweis auf dem Handy, Währungsrechner ohne Offline-Hinweis, Silencio/Modo juego, Dev-Toast | Herbert, Sofía, Tom, Jonas | niedrig | neu | P2/P3 nach Bereich |
| B07 | Spotify-Karte/-Schritt trägt den Kalender-Hinweistext | Herbert, Priya, Tom | niedrig | neu | P1 |
| B22 | Navigation der Einstellungen: „Benachrichtigungen“ überlappt „Nicht erlaubt“ | Herbert, Priya, Tom | niedrig | wahrscheinlich behoben durch #259 (nach dem getesteten Stand) – nachtesten | P2 |
| B30 | Sync-Anzeige: „0 empfangen“ trotz neuer Daten, Zähler passen nicht zur Erwartung; gesperrtes Gerät zeigt zusätzlich irreführenden „ältere Version“-Satz | Priya, Mia, Tom | niedrig | neu | P6 |
| B23 | Suchverlauf „Zuletzt benutzt“ liegt im Klartext in localStorage, ist nicht löschbar und übersteht „KI abschalten“ | Tom | mittel | neu | P6 |
| B24 | Klartext-Backup meldet manipulierte Dateien als „in Ordnung“ (keine Prüfsumme), Sicherheitskopie vor Wiederherstellung ist ein stiller Download | Tom | mittel | neu (verschlüsseltes Backup prüft) | P6 |
| B26 | Kalender-Abo: „Wird geprüft …“ endet nie; Adressprüfung lässt Ziele zu, die die Fehlermeldung nicht nennt (Details in Toms Bericht F-02) | Tom | mittel | neu | P6 |
| B27 | Fokus: „3 kleine Schritte“ liefert immer dieselben Platzhalter und speichert sie als Teilaufgaben; neue Runde ersetzt laufende ohne Rückfrage; neue Aufgabe landet in „Haushalt / Ohne Datum“ | Jonas | mittel | neu | P4 |
| B28 | Kontoauszug-Import verwirft Empfänger/Auftraggeber, keine Konto-/Kategoriewahl in der Vorschau; „Mit KI eintragen“ macht aus zwei Vorgängen einen Eintrag und heißt im Fenster „Befehlspalette“ | Priya | mittel | neu | P4 |
| B29 | Tresor: Stärke-Label widerspricht Knackzeit; Website-Feld lehnt „service.berlin.de“ ab | Sofía | mittel | neu (Tresor: nur UI-Texte/Validierung, Krypto unberührt) | P3 |
| B33 | Sync-Server: Verhalten des Anfragelimits bei Fehlversuchen (Verfügbarkeit, kein Datenzugriff). VERTRAULICH – Details nur in Toms Bericht F-05, Sven direkt informiert. | Tom | mittel | verwandt mit L1 im Launch-Review (lokale API) | Sven |
| B31 | Mehrtägiger Nachtdienst zeigt nur den Beginn („21:30“), kein Ende | Lena | niedrig | neu | P4 |

## 3. Top-20-Verbesserungen

| # | ID | Verbesserung | Personas | Nutzen | Wert | Stand | Paket |
|---|---|---|---|---|---|---|---|
| 1 | V01 | Kurzer Einrichtungsweg: 3 Fragen (Name, Profil inkl. „Familie“, „Papiere & Termine“, „Studium“, Beruf), Rest als spätere Checkliste; Experten-Weg „Rest später“ auf jedem Schritt; Textgröße und „Nur lokal, ohne KI“ als erste Wahl | Herbert, Jonas, Lena, Mia, Priya, Sofía, Tom (7) | hoch | 21 | neu | P1 |
| 2 | V02 | Begriffe und Texte vereinfachen: „Erweitert“ beschriften, Accounts → Passwörter, Widgets/Anheften → Karten, Befehlspalette → Suchen, Startdaten → Importieren, „Zufällige/Weitere Erinnerungen“, Passphrase/Chiffretext/Tailscale, Lesehilfe mit Vorschau | Herbert, Jonas, Lena, Mia, Priya, Sofía, Tom (7) | hoch | 21 | neu (Glossar docs/i18n/GLOSSARY.md anpassen) | P3 |
| 3 | V03 | Übersicht: Block „Heute · Morgen · diese Woche“ (Termine sofort, überfällig nicht eingeklappt); Dichte-Schalter Ruhig (Standard) / Ausführlich (mehrspaltig, alle Karten) | Herbert, Mia, Lena, Priya, Jonas (5) | hoch | 15 | neu (Zusammenspiel mit „ruhige Übersicht“ Paket 3) | P4 |
| 4 | V04 | Flexible Wiederholung im Kalender: alle N Wochen, mehrere Wochentage, Enddatum – sichtbar im Termin-Dialog und per Schnellerfassung; Schichtvorlagen mit festen Zeiten und Ende | Jonas, Lena, Mia, Priya (4) | hoch | 12 | Engine vorhanden (core/recurrence kennt interval + byWeekday), Oberfläche/Parser fehlen | P4 |
| 5 | V05 | Erinnerung verlässlich und ehrlich: beim Speichern eines Termins mit Uhrzeit ein Tipp „Erinnern: keine / 1 h / 1 Tag“, ruhiger Hinweis (abschaltbar) wenn Benachrichtigungen fehlen, Satz was die PWA ohne Push kann; Medikamenten-Erinnerung mit „genommen“-Antwort (ohne Statistik) | Jonas, Lena, Mia, Sofía (4) | hoch | 12 | neu (Benachrichtigungsgrenzen: docs/design/FOCUS-GUIDELINES.md) | P5 |
| 6 | V06 | Backup: „Verschlüsselt“ als Hauptknopf, Klartext als Nebenoption mit Prüfsumme; Alltagssprache; Erinnerung an Sicherung (ruhig, abschaltbar); Hinweis, dass Dokumentdateien nicht im Backup sind | Tom, Herbert, Mia, Sofía (4) | hoch | 12 | neu | P6 |
| 7 | V07 | KI-Knöpfe nur zeigen, wenn KI eingerichtet ist; „Mit KI eintragen“ heißt ohne Anbieter „Satz eintragen“; „Assistent fragen“ in der Suche nur bei KI an | Lena, Priya, Tom, Herbert, Sofía (5) | mittel | 10 | neu | P3 |
| 8 | V08 | Erinnerungsliste/Glocke: konkrete Titel statt „Weitere Erinnerungen · 3“, aufklappbar, Knöpfe beschriftet, alte „Gestern“-Erinnerungen räumen sich auf | Herbert, Jonas, Priya, Tom, Mia (5) | mittel | 10 | neu (Reiter bereits gefaltet) | P5 |
| 9 | V09 | Daten ohne eigenen Server koppeln: Partner/zweites Gerät per QR oder Datei, einzelne Listen teilen (Einkauf, Familienkalender); Server-Teil unter Erweitert | Mia, Sofía, Lena (3) | hoch | 9 | bekannt als Lücke (STATUS: Drive-Adapter nur Stub); Entwurf nötig | P6 |
| 10 | V10 | Ruhe in einem Begriff: „Zock-Modus“ + „Stumm“ → „Ruhe/Nicht stören“, optional an Schichten koppelbar, ein Preset „Ruhig starten“ | Jonas, Lena, Sofía, Tom (4) | mittel | 8 | neu (beide Funktionen existieren getrennt: #150, #180) | P5 |
| 11 | V11 | Vorlagen/Startlisten: Papiere (Pass, Führerschein, TÜV), deutsche Anbieter/Rechnungsarten, Packlisten (Urlaub mit Kindern, Schulranzen), Einkaufsvokabular | Herbert, Sofía, Mia, Lena (4) | mittel | 8 | neu | P3 |
| 12 | V12 | Kalender lesbarer: kompakte Woche bei leeren Tagen, Dienstart je Tag in der Monatsansicht, Filter „nur Termine“, Farben | Lena, Sofía, Mia, Priya (4) | mittel | 8 | neu | P4 |
| 13 | V13 | Finanzen: Einnahmen-Kategorien (BAföG, Nebenjob), Einnahmen/Ausgaben/Saldo nebeneinander, ein Wort für Saldo, Kontoauszug-Import dort anbieten, wo man ihn sucht, Kategorie-Regeln | Jonas, Lena, Sofía, Priya (4) | mittel | 8 | Kategorie-Regeln = ROADMAP M3 | P4 |
| 14 | V14 | Person/Kunde als Zuordnung über Module (Familienmitglied bzw. Kunde: Farbe, Filter, Feld „Für“) | Mia, Priya (2) | hoch | 6 | neu (Personen-Modul existiert) | P4 |
| 15 | V15 | Kündigungsfrist in Monaten/Wochen eingeben, „Kündigen bis“ groß zeigen, früh erinnern; Datumsfeld statt 31-Tage-Raster im Abo-Dialog | Herbert, Priya (2) | hoch | 6 | neu | P5 |
| 16 | V16 | Sprachen/Formate: Mexiko (es-MX) und Währung wählbar (je Konto/Rechnung), Website/README in den App-Sprachen mit passenden Screenshots | Sofía, Priya (2) | hoch | 6 | neu (ROADMAP T2 nennt Währungen nur im Rechner) | P3 |
| 17 | V17 | Schnellerfassung erweitern: Abo, Rechnung, Geburtstag, Betrag, Endzeit/Dauer, Priorität – als Vorschau-Chips, nicht als Dauer-Hervorhebung | Lena, Priya, Mia (3) | mittel | 6 | neu | P4 |
| 18 | V18 | Lesbarkeit: „Sehr groß“ wirklich groß (Grauschrift), Anleitung/Hilfe in der App verlinken, „Strg“ statt „Ctrl“, weniger Tab-Stopps in der Seitenleiste | Herbert, Priya (2) | mittel | 4 | neu | P3 |
| 19 | V19 | Einkauf: ganze Zeile antippen/wischen zum Abhaken, Papierkorb weg von der Daumenzone, Gruppen/Läden, „Als Text teilen“ | Lena, Mia (2) | mittel | 4 | neu (hängt an B01) | P2 |
| 20 | V20 | Gelöschtes 30 Tage wiederherstellbar („Zuletzt gelöscht“) – mit Löschknopf und Schalter, weil es Daten länger hält | Herbert (1) | hoch | 3 | bekannt: ROADMAP K4 (Papierkorb), nicht gebaut | P5 |

### Weitere Verbesserungen

| ID | Verbesserung | Personas | Nutzen | Stand | Paket |
|---|---|---|---|---|---|
| V21 | Verbindungsprotokoll in der App („was ging seit dem Start wohin“, nur Host/Anlass/Menge, nie Inhalt) plus optional „Netzwerk sperren“ | Tom | hoch | neu; passt zu Local-First | P6 |
| V22 | Schwaches Master-Passwort: zusätzliche Bestätigung und Mehrwort-Vorschlag (kein Zwang) | Tom | hoch | neu (nur UI, Krypto unberührt) | P6 |
| V23 | Suchverlauf abschaltbar/löschbar, KI-Fragen nie im Verlauf; http://-Warnung bei nicht-lokaler Sync-Adresse; Diagnose-Vorschau in App-Sprache | Tom | mittel | neu | P6 |
| V24 | Fokus: Länge direkt wählbar, echte Schrittvorlagen je Stichwort (lokal, ohne KI), „Weiter mit …“-Karte, Teilfristen für Abgaben, „Fällig am“ vs. „Geplant für“ erklären, Studium-Profil | Jonas | hoch | neu; Habits-Modul bleibt stillgelegt (siehe Liste) | P4 |
| V25 | Priya-Paket: CSV-/ICS-Export je Modul, Mehrfachauswahl/Massenbearbeitung, Tastenkürzel auffindbar/anpassbar, KI-Zugang geräteübergreifend, Erweiterung für Chrome/Edge/Firefox | Priya | mittel | Kürzel gebaut (docs/features/shortcuts.md, #214), ICS-Export = ROADMAP M2, Store/Firefox = STATUS offen | später |
| V26 | Anhänge (Unterlagen/Belege) optional verschlüsselt in Sync und Backup | Priya, Mia, Sofía | mittel | bekannt: ROADMAP K3, „nach Unterlagen“ | später |
| V27 | Passphrase-Wortliste in Spanisch, „Recibo/cuenta“-Wortwahl, Haushaltsaufgaben reihum, Tresor „Import, Export & Sicherheit“ aufteilen | Sofía, Mia, Tom | niedrig | neu | später |

Gleichstand auf Rang 20 (Wert 3: eine Persona, Nutzen hoch): V20, V21, V22. V20 steht in der Top 20, weil es eine bestehende Roadmap-Idee (K4) trägt; V21/V22 (Tom) folgen direkt dahinter und sind in P6 enthalten. Bei den Fehlern gilt dasselbe für Rang 20 (B20) gegenüber B07/B22.

## 4. Behalten (bitte nicht wegoptimieren)

| Was | Personas |
|---|---|
| Schnellerfassung per Satz mit Vorschau-Chips, „Datum angenommen“, Rückgängig | Herbert, Jonas, Lena, Mia, Priya, Sofía, Tom |
| Rückgängig statt Rückfrage (Abhaken, Löschen, Bezahlen) | Jonas, Lena, Mia, Priya, Sofía |
| Backup-Wiederherstellung: Vorschau, Zusammenführen/Ersetzen, Sicherheitskopie, verschlüsselt, Prüfsumme | Herbert, Jonas, Lena, Mia, Priya, Sofía, Tom |
| Ruhige Übersicht: „3 Dinge reichen“, „Jetzt wichtig“, kein Alarm-Rot, keine Schuldtexte | Herbert, Jonas, Lena, Mia, Sofía, Tom |
| Datenschutz-Ehrlichkeit und messbar gehaltene Versprechen (KI sieht keine Daten, offline null Anfragen), „KI abschalten“ | Herbert, Priya, Sofía, Tom |
| Offline mit Service Worker | Herbert, Lena, Mia, Priya, Tom |
| Sprachwechsel sofort, Dunkelmodus, kein waagerechtes Scrollen bis 320 px | Herbert, Jonas, Lena, Mia, Priya, Sofía, Tom |
| Tresor: ehrliche Warnung, Stärke live, gesperrt nach Neuladen, escaped Eingaben | Herbert, Priya, Sofía, Tom |
| „Anfangen · 5 Min“, „Wartet noch“/„Neu planen“, „Tag abschließen“ | Jonas, Herbert, Mia |
| Vorräte (+/−, „Wird knapp“), Packlisten mit Fortschritt, Personen mit Geburtstag und Geschenkideen | Mia, Herbert, Lena |
| Rechnungen gruppiert mit „seit 12 Tagen“, Abos mit Summe pro Monat/Jahr, „Kündigen bis“ | Lena, Sofía, Priya |
| Tastatur: Strg+K, N, G-dann, J/K, „?“ | Priya, Herbert |
| Sync-Einrichtung (E2E vorausgewählt, Geräteliste, Sperren) und Gerät zurücksetzen | Priya, Tom |
| „Stumm: 1 Stunde / Bis morgen“ | Jonas, Lena |
| Diagnose-Vorschau vor dem Senden; Regex-Tester mit Abbruch | Tom |
| Lokaler Assistent („Was steht morgen an?“, „Lokal“) | Mia |

## 5. Widersprüche zwischen Personas – und wie beides geht

| Thema | Wer will was | Vorschlag (beides möglich) |
|---|---|---|
| Mehr Erklärung vs. weniger Text | Herbert (liest Anleitungen, will Vorschau, Hilfe in der App) – Jonas, Lena, Tom (kurz, nicht ablenken) | Standard: ein Satz. Dahinter ein „?“ / „Mehr erfahren“, aufklappbar (Basis). Einstellung „Erklärungen: kurz / ausführlich“ unter Darstellung (Erweitert); Lesehilfe bekommt eine Vorschau. Abgeschnittenen Text immer aufklappbar (B14). |
| Ruhige vs. dichte Übersicht | Jonas, Lena, Mia, Sofía („3 Dinge“, 16 Widgets = 9400 px) – Herbert, Priya (Termine sofort, alles sichtbar, mehrspaltig) | Ein Schalter Ruhig (Standard) / Ausführlich. Beide Stufen zeigen „Heute · Morgen“ mit Terminen als einen Block; Ausführlich ergänzt Karten und Spalten ab 1280 px. Aus (Fokus-Checkliste 2). |
| „Wartet noch“: freundlich vs. eindeutig | Jonas, Herbert (gefällt) – Priya, Lena, Mia (unklar, „wer wartet worauf?“) | Wort bleibt; direkt darunter eine Zeile „überfällig, nicht dringend – Neu planen“ beim ersten Mal, Tooltip danach. Zahl in Übersicht und ToDos gleich definieren (Jonas). |
| Rückfrage vs. Rückgängig | Herbert (Angst, etwas zu löschen) – alle anderen (lieben Rückgängig) | Überall Undo-Toast, auch bei Unterlagen; zusätzlich „Zuletzt gelöscht“ (V20) und Entwurf behalten bei Esc. Keine Dialoge. |
| Erinnerung standardmäßig an vs. keine Hinweisflut | Jonas, Mia (Frist-Erinnerung von allein) – Jonas selbst (ruhig), Fokus-Richtlinien (soft, Standard aus) | Beim Speichern eines Termins mit Uhrzeit eine Zeile „Erinnern: keine · 1 h · 1 Tag“ (Vorgabe merkbar); fehlende Erlaubnis einmal ruhig melden, abschaltbar. |
| Einfach koppeln vs. selbst hosten | Mia, Sofía, Lena (kein Server) – Priya, Tom (eigener Server, Rate-Limit, http-Warnung) | Zwei Wege: Basis „Mit Partner teilen“ (QR/Datei, kein Server), Erweitert „Eigener Server“ mit den Sicherheitshinweisen von Tom. |
| Wenige vs. viele Erkennungsfelder in der Schnellerfassung | Priya (Betrag, Endzeit, #Kunde) – Jonas, Lena (kurz, ruhig), Tom (Parser darf Titel nicht zerstören) | Mehr erkennen, aber nur erkannte Teile als Chips zeigen; Titel unverändert lassen, wenn unsicher („Datum angenommen“). |
| KI sichtbar vs. verborgen | Herbert, Lena, Tom (keine KI, Knopf stört) – Priya (KI-Zugang einrichten, wiederverwenden) | KI-Knöpfe nur bei eingerichteter KI (V07); Einrichtung fragt „Nur lokal, ohne KI“ zuerst; Priyas Geräte-Übernahme später unter Erweitert. |

## 6. Verständnisprobleme (Texte und Icons)

Wortvorschläge gehen ins [Glossar](../i18n/GLOSSARY.md) und in alle fünf Sprachen (Paket P3).

| Stelle | Personas | Problem | Vorschlag |
|---|---|---|---|
| Schalter „Erweitert“ (jedes Modul) | Herbert, Jonas, Lena, Mia, Priya, Sofía | Unklar, was dazukommt | „Mehr Felder anzeigen“ mit Untertitel, was erscheint |
| Zufällige Erinnerung / Nächste Erinnerung / Weitere Erinnerungen · n | Herbert, Jonas, Lena, Mia, Priya, Tom | Erwartet eine Liste; unklar, was „zufällig“ tut | Knöpfe beschriften, konkrete Titel, aufklappbar |
| „Wartet noch“ (Übersicht, ToDos; zwei verschiedene Zahlen) | Jonas, Lena, Mia, Priya, Herbert | „Wer wartet worauf?“ | siehe Widerspruch 3 |
| Zock-Modus / Stumm / Modo juego / Silencio | Jonas, Lena, Sofía, Tom | Zwei Namen für dasselbe, „Zock“ klingt nach Spiel | Ein Name: „Ruhe“ (Nicht stören) |
| Accounts / Tresor / Passwort-Tresor / Unterlagen | Herbert, Lena, Priya, Mia, Sofía | Accounts = Benutzerkonto? Impfpass unter „Tresor“? | Modul „Passwörter“, Bereich „Unterlagen“ (nur Beschriftung, Modul-ID bleibt) |
| Startdaten einrichten | Herbert, Lena, Priya, Mia | Wirkt wie Pflicht, unklar was es tut | „Importieren“, kleiner, nur bei leerem Modul |
| Widgets, Anheften…, „Mehr anzeigen · 16 Widgets“ | Herbert, Mia, Priya | Englisch/technisch | „Karten“, „Karte hinzufügen“ |
| JSON einfügen / Nemo-Format / Schema für KI kopieren / Import per KI | Herbert, Priya, Sofía | Fachwort | „Daten aus einer Datei übernehmen“; Kurzsatz zur KI-Schleife |
| Passphrase, Chiffretext, LAN, Tailscale, Zugangstoken, Tabellen | Herbert, Lena, Mia, Tom | Für Nicht-Techniker unverständlich | Backup zuerst, Server unter Erweitert; Beispiel je Zeile |
| Wanduhrzeit, „Zeitzone: UTC“ (Einrichtung Schritt 1) | Herbert, Jonas, Lena | Fachwort / unplausibler Wert | „Uhrzeiten gelten für deinen Ort“, Ort anzeigen |
| Befehlspalette (Strg+K) | Herbert, Priya | Name sagt nichts | „Suchen“ |
| „Ziel: ToDos“, „Regeln · 0 Token“, „Lokal · 0 Token“ | Mia, Priya | „Token“ und „Ziel“ unbekannt | „Wird gespeichert in: ToDos“, „ohne KI erkannt“ |
| „Anfangen · 5 Min“, „Vorschlag: 3 kleine Schritte“, „Nächste eine Sache“ | Herbert, Jonas | Startet sofort einen Zähler; „Vorschlag“ unklar (KI?); Grammatik | Beschriftung „5-Minuten-Runde starten“; Grammatik korrigieren |
| „Fällig am“ vs. „Geplant für“; Dauer-Chip „Offen“ | Jonas | Unklar | Ein Satz Erklärung, „Dauer: offen“ |
| Lesehilfe „hebt Wortanfänge hervor“ | Herbert, Priya, Jonas | Erst nach dem Einschalten sichtbar | Vorschau-Satz im Angebot |
| Profilkarte: Titel und Knopf heißen gleich („Alltag“ / „Alltag“) | Jonas, Mia | Muss ich noch etwas tun? Kein gewählt-Zustand | Knopf „Wählen“, markierter Zustand |
| Doppeltes „Kalender“ (Tab, Überschrift, Pille), Kalender-Knopf „Erinnerungen“ ohne Anlegen | Lena, Mia, Sofía | Wirkt wie Fehler | Eine Ebene, „Offene Erinnerungen“ |
| „Eingang“ / „Platz“ bei ToDos ohne Datum | Mia, Priya | Unbekannter Begriff | „Ohne Datum – jetzt einplanen“, „Neu erfasst“ |
| „Später nicht mehr“ (Wetter), „Auf morgen schieben“ | Herbert, Mia | Widerspruch / unklar | „Nicht mehr fragen“, „Wetter ausblenden“ |
| „Mit KI eintragen“ ohne KI; Fenster „Befehlspalette“ | Lena, Priya, Tom, Herbert | Knopf dominiert, obwohl keine KI | siehe V07 |
| Symbole: Funkel (KI und Passwort-Generator), Stern, Glocke mit Zahl, „…“-Menü, Haken in Rechnungszeile, Schraubenschlüssel (Werkzeuge, Handy ohne Beschriftung) | Herbert, Sofía, Priya, Mia | Funkel doppelt belegt, Haken/„…“ ohne Text | Tooltip/Kurztext beim ersten Mal; Funkel nur für KI |
| Sicherheitszeile Tresor („Felder: 5 Minuten · Sofort …“), Modul-Einstellungen mit Rohwerten | Tom, Priya, Sofía, Herbert | Werte ohne Beschriftung | Ausschreiben („Sperrt nach 5 Min“) |
| Merkliste / Merkzettel / Lesezeichen; Despensa / Hogar / Compra | Lena, Sofía | Mehrere Wörter für Ähnliches | Ein Wort je Konzept (Glossar) |

## 7. Nicht umsetzen – Grund

Gegen Local-First, Datenschutz, „nichts hinter Bezahlung“, Fokus-Richtlinien oder getroffene Entscheidungen. Wo möglich steht die Alternative dabei.

| Vorschlag | Grund / Alternative |
|---|---|
| Schritte aus dem Aufgabentitel per KI vorschlagen (Jonas V5 als „KI“ gedacht) | AI-Privatsphäre: Assistent sieht nie Nutzerdaten (privacy.test.ts). Lokale Vorlagen je Stichwort sind erlaubt. |
| Erinnerung ungefragt für jeden Termin einschalten (Jonas V4, Mia V09 wörtlich) | Benachrichtigungsgrenzen der Fokus-Richtlinien: neue automatische Hinweise `soft` und standardmäßig aus. Stattdessen Ein-Tipp-Frage beim Speichern (V05). |
| Dauer-Abzeichen „nur lokal“ in der Kopfzeile (Herbert V04, Teil) | Reizlast (Checkliste 1 und 9). Stattdessen erste Wahl in der Einrichtung und Eintrag in Einstellungen → Verbindungen. |
| Live-Farbhervorhebung beim Tippen in der Schnellerfassung (Priya V16, Teil) | Reizlast; die Vorschau-Chips reichen. |
| „Alle Widgets mehrspaltig“ als Standard-Übersicht (Priya V13) | Standard bleibt ruhig („3 Dinge reichen“); nur als Schalter „Ausführlich“ (V03). |
| „Überfällig“ statt „Wartet noch“ als Standardwort (Priya) | Fokus-Textregel „sagen, was möglich ist“. Stattdessen Kurzerklärung unter der Überschrift; Geld bleibt „überfällig“ (rot nur dort). |
| Bestätigungsdialog beim Löschen von Unterlagen (Herbert B02 wörtlich) | Grundsatz „Rückgängig statt Rückfrage“; Undo-Toast plus Entwurf behalten (B09). |
| Habits-Modul zurückholen (Jonas V2) | Modul bewusst stillgelegt; Streak-Verlust nie (Fokus-Richtlinien). Prüfen, ob Routinen („n in Folge“ mit Pausentag) den Bedarf decken. |
| Medikamenten-Verlauf mit Quote/Serie (Lena V-05, Teil) | Schuld- und Gesundheitsdaten-Risiko; nur Bestätigung „genommen“, keine Statistik, kein Medizinprodukt-Anspruch. |
| Konto/Cloud bei einem Anbieter für das Teilen (Mia V03 „wie WhatsApp“) | ROADMAP „Explicitly not planned“: Cloud-Konten, Telemetrie. |

### Zurückgestellt – Entscheidung Sven nötig (kein Verstoß, aber Kurswechsel oder groß)

| Vorschlag | Warum nicht einfach bauen |
|---|---|
| Zeiterfassung pro Kunde, Ausgangsrechnungen (Priya V01, V03) | Zeiterfassung wurde im Modul-Review bewusst stillgelegt (docs/product/MODULE-PLAN.md); Freiberufler-Kern wäre ein Kurswechsel. Entscheidung Sven. |
| Feed-Reader/RSS (Sofía I04) | News wurde stillgelegt, ROADMAP: „news as an optional extension“; neue Netzwerkaufrufe und Reizlast. Entscheidung Sven. |
| Koppeln ohne eigenen Server (Mia V03, Sofía I03) | Richtung gut (QR/Datei/Nahbereich, ohne Anbieter-Konto), aber Sync-Hotspot und Protokollfrage: erst Entwurf (Phase 1), dann Entscheidung Sven. |
| Chrome Web Store / Firefox für die Erweiterung (Priya V10) | STATUS: Store-Entscheidung offen. |
| Anhänge im Sync/Backup (K3) | Groß, Format- und Verschlüsselungsrisiko, ROADMAP „nach Unterlagen“. |

Nicht beanstandet wurde im Sinne der Grundsätze: Tom V-01 (Verbindungsprotokoll, lokal, nie Inhalt), V-02 (Warnung, kein Zwang), Sofía I01 (es-MX), Mia V01 (Personen zuordnen).

## 8. Abgleich mit CHATS, STATUS und ROADMAP

- **CHATS.md:** Tabelle „Läuft gerade“ ist leer, offene PRs sind nur zwei Dependabot-PRs (#221, #190). Es gibt keinen Konflikt mit laufender Arbeit. Hotspots, die die Pakete berühren: `strings.ts` + Locale-Kataloge, `pages/Settings.tsx`, `layout/AppShell.tsx`, `core/notifications/policy.ts`, `core/sync/**`, `core/modules/types.ts`/`registry.ts`.
- **Seit dem getesteten Stand gemergt (Nachtest nötig):** #259 (Einstellungs-Navigation, vermutlich B22), #261–#263 (Verbindungs-Login/Opener), #268 (Wetter-Vorschau).
- **Schon bekannt oder vorbereitet:** Übersetzungen maschinell/ungeprüft (`docs/i18n/README.md`) → B13; FAB → „+ Neu“ nur Desktop (STATUS) → B10 teilweise; Ollama-Erkennung „Best-Effort“ (STATUS) → B21; Wiederholungs-Engine `core/recurrence` (Intervall, Wochentage) → V04 nur Oberfläche; Papierkorb K4, Anhänge K3, ICS-Export M2, Budget-Regeln M3 (ROADMAP) → V20, V26, V25, V13; Kürzel-Karte gebaut (#214) → V25; Android plant Alarme selbst (`docs/features/repeat-reminders.md`) → B19; Google-Drive-Adapter nur Stub → V09; Chrome-Store offen (STATUS) → V25.
- **Neu, in keinem Dokument:** Einrichtung auf 3 Fragen (V01), Heute·Morgen-Block (V03), Kopfzeile schmal (B03), Doppelkästchen (B01), Frist-Status „verpasst“ (B08), Undo/Entwurf bei Unterlagen (B09), README-Satz „German today“ (B15), Tresor-/Setup-Sprachreste (B13).
- **Bewusst anders entschieden (Modul-Review 2026-10-01):** Habits, Zeiterfassung, Nachrichten stillgelegt → Jonas V2, Priya V01, Sofía I04 nicht als Paket, sondern Entscheidung (Abschnitt 7).

## 9. Umsetzungs-Pakete

Sechs Pakete, je ein Chat, je eigener Branch und PR gegen `develop`; parallel möglich mit den Absprachen unten. Prompt-Skizzen im Format von [PROMPT-TEMPLATES](../PROMPT-TEMPLATES.md) (die Standardblöcke `git`, `hard-rules`, `knowledge`, `questions`, `closing`, `pr-text` stehen oben, nicht wiederholt).

| Paket | Thema | Deckt ab | Hotspots |
|---|---|---|---|
| P1 | Erster Start und Einrichtung (`feat/qa-first-run`) | V01, B04, B05, B06, B07, B16, B21 | strings.ts (Block setup) und alle vier Locale-Kataloge; core/setup/registry.ts (additive Helfer); ggf. core/modules/registry.ts, wenn Profile dort hängen → vorher Zeile in CHATS.md |
| P2 | Handy-Layout und Rückmeldung (`fix/qa-mobile-layout`) | B03, B01, B10, B02, B11, B14, B20, B22, V19 | layout/AppShell.tsx, pages/Settings.tsx (nur Navigation), ui/*; keine Token-Änderung (ui/tokens.css gesperrt, sonst Zeile anlegen) |
| P3 | Verständliche Sprache und Übersetzungen (`fix/qa-wording-i18n`) | V02, V07, V11, V16, V18, B13, B15, B17, B25, B29 | strings.ts und ALLE Locale-Kataloge: höchster Konflikt-Hotspot. Nur bestehende Werte ändern, neue Schlüssel nur im eigenen Block anhängen; nach P1/P2 starten oder `develop` täglich mergen |
| P4 | Übersicht, Kalender und Schnellerfassung (`feat/qa-today-calendar`) | V03, V04, V12, V13, V14, V17, V24, B12, B18, B27, B28, B31 | home/Widget-Registry, strings.ts (nur eigener Block), ggf. core/modules/types.ts (Zuordnung Person/Kunde → eigene Zeile, eine Chat zur Zeit) |
| P5 | Erinnerungen, Fristen und Löschsicherheit (`feat/qa-reminders-safety`) | B19, B08, B09, V05, V08, V10, V15, V20 | core/notifications/policy.ts (nur ein Chat), core/db (Tombstone-Lesezugriff additiv), ui/Dialog (Entwurf behalten, mit P2 absprechen) |
| P6 | Datenschutz, Backup und Koppeln (`feat/qa-privacy-backup`) | B23, B24, B26, B30, V06, V09 (nur Entwurf), V21, V22, V23 | core/sync/** gehört dem Sync-Chat: LWW-Regel unberührt, Koppeln ohne Server nur als Entwurf in docs/features; pages/Settings.tsx klein halten; Server-Fix F-05 nur nach Absprache mit Sven |

**Reihenfolge und Parallelität:** P1, P2, P5, P6 sind weitgehend dateifremd und gleichzeitig startbar. P3 ändert dieselben Textdateien wie P1/P2: entweder danach starten oder `develop` täglich mergen und nur bestehende Werte ändern. P4 und P5 berühren beide Kalender/Erinnerungen: Absprache über `scribble/BOARD.md` (P5 besitzt `core/notifications/policy.ts`, P4 besitzt `home/` und Parser). P2 und P5 teilen `ui/Dialog` (Entwurf behalten): P2 zuerst mergen. Jeder Chat legt seine Zeile in [CHATS.md](../CHATS.md) an.

### P1 · Erster Start und Einrichtung

```text
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch: feat/qa-first-run
Ziel: Erster Start und Einrichtung – Funde aus docs/qa/CONSOLIDATED.md (V01, B04, B05, B06, B07, B16, B21).
Umfang: core/setup/** (registry, Schritte, Profile), home-Willkommenskarte (nur Logik, Layout bei P2), Tests e2e/setup.spec.ts.
Hotspots: strings.ts (Block setup) und alle vier Locale-Kataloge; core/setup/registry.ts (additive Helfer); ggf. core/modules/registry.ts, wenn Profile dort hängen → vorher Zeile in CHATS.md.
Vorgehen: Phase 1: Plan + Messung (heutige Schrittzahl, Taps), Stopp bis „Plan freigegeben“. Danach: 3-Fragen-Weg mit „Rest später“ auf jedem Schritt; ehrlicher Fortschritt (übersprungen ≠ erledigt, eine Zahl); Profilkarten nennen, was sie abschalten; „Weiter“-Grund sichtbar; Spotify-Text; Modul „Beispiel“ nur im Dev-Kanal; Ollama-Probe (core/ai/detectOllama.ts) erst nach Klick (oder Rechtstext ergänzen).
Abnahme: Frische Installation: Übersicht nach ≤ 3 Fragen und ≤ 6 Taps; kein Netzwerkaufruf vor einem Klick (Playwright-Netzlog); Fokus-Checkliste in der PR-Beschreibung; `check:i18n`.
Nicht in diesem Paket: alles aus den Listen „Nicht umsetzen“ und „Zurückgestellt“ in docs/qa/CONSOLIDATED.md; Funde außerhalb des Umfangs in den PR-Text.
```

### P2 · Handy-Layout und Rückmeldung

```text
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch: fix/qa-mobile-layout
Ziel: Handy-Layout und Rückmeldung – Funde aus docs/qa/CONSOLIDATED.md (B03, B01, B10, B02, B11, B14, B20, B22, V19).
Umfang: layout/AppShell.tsx und Kopfzeile, ui/Toast* (Stapel, Text, Auto-Ausblenden), ui/Dialog, modules/lists (Zeile, Abhaken), home-Willkommenskarte, ToDos-Seite (Spaltenbreite), Playwright-Screenshots 412/320/640/1280.
Hotspots: layout/AppShell.tsx, pages/Settings.tsx (nur Navigation), ui/*; keine Token-Änderung (ui/tokens.css gesperrt, sonst Zeile anlegen).
Vorgehen: Kopfzeile bleibt bei 320–640 px und laufendem Fokus-Timer bedienbar (Suche als Symbol, Umschalter umbrechen); eine Abhak-Fläche pro Listenzeile, Abgehaktes bleibt kurz an Ort und Stelle (Rückgängig), lange Einträge umbrechen/aufklappbar; „+“ verdeckt nie ein Feld (Platz reservieren); Hinweise: max. einer sichtbar, sagen was geändert wurde, verschwinden selbst; Willkommenskarte vollständig sichtbar; Reproduktion von B20 zuerst.
Abnahme: Screenshot-Spec bei 412/320/640/1280 ohne Abschneiden, Touch-Ziele ≥ 44 px, kein horizontales Scrollen; e2e für Listen und Toasts.
Nicht in diesem Paket: alles aus den Listen „Nicht umsetzen“ und „Zurückgestellt“ in docs/qa/CONSOLIDATED.md; Funde außerhalb des Umfangs in den PR-Text.
```

### P3 · Verständliche Sprache und Übersetzungen

```text
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch: fix/qa-wording-i18n
Ziel: Verständliche Sprache und Übersetzungen – Funde aus docs/qa/CONSOLIDATED.md (V02, V07, V11, V16, V18, B13, B15, B17, B25, B29).
Umfang: strings.ts + locales/{en,es,fr,pt-BR}, docs/i18n/GLOSSARY.md, README.md/README.de.md, site/, Tresor-Texte (nur UI), core/i18n/format (es-MX, Monatsnamen, KW, Ordinalpunkt), KI-Knöpfe nur bei eingerichteter KI.
Hotspots: strings.ts und ALLE Locale-Kataloge: höchster Konflikt-Hotspot. Nur bestehende Werte ändern, neue Schlüssel nur im eigenen Block anhängen; nach P1/P2 starten oder `develop` täglich mergen.
Vorgehen: Wortliste aus „Verständnisprobleme“ umsetzen (Glossar zuerst), Sofías Fundliste als Prüfliste für es/en, README/Website-Satz „German today“ ersetzen, Datums-/Zeitfeld auf echtem Gerät prüfen statt vermuten; keine Krypto-Änderung am Tresor.
Abnahme: `check:i18n`, Glossar aktualisiert, Spanisch-Durchlauf (Tresor, Einrichtung, Kalender, Abos) ohne deutsche Reste, `check:readme`.
Nicht in diesem Paket: alles aus den Listen „Nicht umsetzen“ und „Zurückgestellt“ in docs/qa/CONSOLIDATED.md; Funde außerhalb des Umfangs in den PR-Text.
```

### P4 · Übersicht, Kalender und Schnellerfassung

```text
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch: feat/qa-today-calendar
Ziel: Übersicht, Kalender und Schnellerfassung – Funde aus docs/qa/CONSOLIDATED.md (V03, V04, V12, V13, V14, V17, V24, B12, B18, B27, B28, B31).
Umfang: home (Heute/Morgen-Block, Dichte-Schalter), calendar (Wiederholung sichtbar, Schichtvorlagen, Monatsansicht), quickCapture/parser (+ Testkorpus), todos (Inline-Add, Fokus-Schritte lokal), finance-Import-Vorschau.
Hotspots: home/Widget-Registry, strings.ts (nur eigener Block), ggf. core/modules/types.ts (Zuordnung Person/Kunde → eigene Zeile, eine Chat zur Zeit).
Vorgehen: Phase 1: Plan für Dichte-Schalter und Zuordnung Person/Kunde mit Stopp. Dann: Heute·Morgen-Block; Wiederholung „alle N Wochen, Mo–Fr, bis“ im Dialog und Parser; Parser-Testkorpus um alle gemeldeten Sätze erweitern (Trefferquote vorher/nachher); Fokus „3 Schritte“ nur mit lokalen Vorlagen.
Abnahme: Parser-Messung vorher/nachher, e2e Termin mit Wiederholung, Übersicht-Screenshots Ruhig/Ausführlich, `privacy.test.ts` grün.
Nicht in diesem Paket: alles aus den Listen „Nicht umsetzen“ und „Zurückgestellt“ in docs/qa/CONSOLIDATED.md; Funde außerhalb des Umfangs in den PR-Text.
```

### P5 · Erinnerungen, Fristen und Löschsicherheit

```text
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch: feat/qa-reminders-safety
Ziel: Erinnerungen, Fristen und Löschsicherheit – Funde aus docs/qa/CONSOLIDATED.md (B19, B08, B09, V05, V08, V10, V15, V20).
Umfang: core/notifications/policy.ts und ack, calendar/RemindersTab, subscriptions/Unterlagen (Frist-Status), Undo (core/undo) und Entwurf in Dialogen, „Zuletzt gelöscht“ (core/db tombstones, ROADMAP K4).
Hotspots: core/notifications/policy.ts (nur ein Chat), core/db (Tombstone-Lesezugriff additiv), ui/Dialog (Entwurf behalten, mit P2 absprechen).
Vorgehen: Phase 1: Gerätetest auf Android (Erinnerung, App wegwischen) und Plan; danach ein Satz „was die PWA ohne Push kann“, Ein-Tipp-Erinnerung beim Speichern, „Frist vorbei“-Status in Liste, Übersicht und Kalender (ruhiger Ton), Undo für Unterlagen, Entwurf bei Esc, „Ruhe“ als ein Begriff, „Zuletzt gelöscht“ mit Löschen-Knopf.
Abnahme: Neue Benachrichtigungsart `soft`, Schalter vorhanden, Standard aus; Unit-Tests für Frist-Status; Handtest-Zeile in MANUAL-TESTS.
Nicht in diesem Paket: alles aus den Listen „Nicht umsetzen“ und „Zurückgestellt“ in docs/qa/CONSOLIDATED.md; Funde außerhalb des Umfangs in den PR-Text.
```

### P6 · Datenschutz, Backup und Koppeln

```text
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch: feat/qa-privacy-backup
Ziel: Datenschutz, Backup und Koppeln – Funde aus docs/qa/CONSOLIDATED.md (B23, B24, B26, B30, V06, V09 (nur Entwurf), V21, V22, V23).
Umfang: Einstellungen → Verbindungen/Backup/Sync, core/backup (Prüfsumme Klartext), Suchverlauf, Kalender-Abo-Prüfung, Verbindungsprotokoll, Tresor-UI (Warnung schwaches Master-Passwort, keine Krypto-Änderung).
Hotspots: core/sync/** gehört dem Sync-Chat: LWW-Regel unberührt, Koppeln ohne Server nur als Entwurf in docs/features; pages/Settings.tsx klein halten; Server-Fix F-05 nur nach Absprache mit Sven.
Vorgehen: Phase 1: Entwurf „Mit Partner teilen“ (QR/Datei, kein Anbieter-Konto) und Verbindungsprotokoll, Stopp. Dann die kleinen Funde: Verlauf löschbar/abschaltbar, Klartext-Backup mit Prüfsumme und „Verschlüsselt“ zuerst, Warnung bei http://, Adressprüfung Kalender-Abo.
Abnahme: Netzwerk-Test (nichts ohne Klick), Backup-Fixtures 0.3.x weiter grün, negative-list-Test Diagnose, `exclusion.test.ts` unverändert grün.
Nicht in diesem Paket: alles aus den Listen „Nicht umsetzen“ und „Zurückgestellt“ in docs/qa/CONSOLIDATED.md; Funde außerhalb des Umfangs in den PR-Text.
```

## 10. Offene Entscheidungen für Sven (gebündelt, mit Empfehlung)

1. **Dichte-Schalter der Übersicht** (Ruhig/Ausführlich): Empfehlung ja, Standard Ruhig.
2. **Koppeln ohne eigenen Server** als Entwurf in P6: Empfehlung ja (QR/Datei), kein Anbieter-Konto.
3. **Zeiterfassung/Ausgangsrechnungen und RSS:** Empfehlung nicht jetzt; erst nach den Paketen, wenn die Zielgruppe Selbstständige sein soll.
4. **Erinnerung beim Speichern (V05)** statt Standard-Erinnerung: Empfehlung ja.

## 11. Grenzen der Auswertung

- Alle sieben Berichte stammen aus Browser/Viewport (kein echtes Gerät, keine exe/APK); Datumsformat (B25), Push (B19) und Touch-Ziele sind dort nicht belastbar.
- Die Gewichtung (Personas × Schwere) bevorzugt Funde, die viele Personas betreffen; seltene, aber schwere Funde (B09, B20, B33) sind durch die Notizen und den Deinstall-Zuschlag ausgeglichen.
- Die Zuordnung der Herkunfts-IDs ist von Hand erfolgt; die Originalberichte bleiben maßgeblich.
