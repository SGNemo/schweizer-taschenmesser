# Modul- und Werkzeug-Review – Nemo (Stand 2026-10-01, `develop` @ 41b7e06)

Zweck: gemeinsam entscheiden, was Nemo im Alltag braucht. Keine Code-Änderung; Ergebnis sind [MODULE-PLAN.md](MODULE-PLAN.md) und [IMPLEMENTATION-PROMPT.md](IMPLEMENTATION-PROMPT.md) (entstehen in Runde 3/4).
Quellen: alle `manifest.ts`, `schema.ts`, Registries, `home/`, `layout/`, `core/setup`, Build-Log (`npm run build`), Screenshots mit erfundenen Daten (Desktop 1920×1080, Mobil 412×915; Rezept unten). Laufende Arbeiten laut [CHATS.md](../CHATS.md): keine.

Legende Reife: **fertig** = alltagstauglich · **schmal** = funktioniert, Kernfunktionen fehlen für den Zweck · **ungeprüft** = nur per Fake/Linux getestet. Code = Zeilen ts/tsx/css (inkl. Tests) · Chunk = eigener Lazy-Chunk der Seite (kB roh).

## 1 · Zahlen
| | Anzahl | Code |
|---|---|---|
| Module (ohne `example`) | 23, davon 6 Standard-an, 2 nur Desktop | 25 000 Zeilen Web + 6 700 Zeilen Rust (disk-scan, system-info, Tauri-Wrapper) |
| Werkzeuge | 18 (6 Standard-an, 8 „Weitere“, 4 Entwickler) | 4 150 Zeilen |
| Connectors | 2 (Google OAuth, ICS-Abo) | 1 600 Zeilen |
| JS-Bundle | 3,95 MB roh / 2,16 MB gzip, 254 Precache-Einträge (5,3 MB) | größte Lazy-Chunks: zxcvbn-Wörterbücher de+common 1,32 MB (nur Accounts), pdf-lib 428 kB (nur PDF-Werkzeug), recharts 361 kB (Finanzen) |

Navigation heute: Desktop-Seitenleiste listet **alle** eingeschalteten Module (bei allen 21: eine Bildschirmhöhe reicht nicht); Mobil: 3 Module in der Leiste, Rest unter „Mehr“. Übersicht: ein Widget je Modul in Manifest-Reihenfolge, Layout synchronisiert (`_settings` `home`). Schnellerfassung: Freitext-Parser + 19 Modul-Aktionen.

## 2 · Inventar Module – Zweck, Funktionen, Daten
Spalte „Daten“: Sammlung `{Felder}`; alle synchronisiert außer markiert. „Verknüpft“ = Abhängigkeit zu anderen Modulen (Bus-Event, `public.ts`, Status-Abfrage).

| Modul | Zweck (ein Satz) | Funktionen | Daten | Verknüpft |
|---|---|---|---|---|
| **Kalender** (an) | Termine + Fälligkeiten aller Module in Monat/Woche/Tag | Wiederholung, mehrtägig, Ort → Karte, Agenda, ICS-Datei-Import, externe Kalender (Google/ICS, nur lesen) | `event {title, allDay, start/endDate, start/endTime, location, note, recurrence}`, `external` (dataApi aus) | Senke für Connectors; zeigt Items von 9 Modulen |
| **ToDos** (an) | Aufgaben in Listen | Listen, Priorität 0–3, Fällig, Unteraufgaben, Text-Import; Liste „Eingang“ auto | `list {name,color,order}`, `task {listId,title,done,priority,dueDate,parentId,note,order}` | Kalender-Items; Ziel von Teilen/Schnellerfassung |
| **Erinnerungen** (an) | Einmalige/wiederkehrende Erinnerungen mit Benachrichtigung | Wiederholung, aktiv/pausiert, 8 Vorlagen, Text-Import | `reminder {title,note,startDate,time,recurrence,active}` | Kalender-Items, Benachrichtigungen |
| **Finanzen** (an) | Konten, Buchungen, Monatsübersicht, „wirklich verfügbar“ | Konten, 10 Seed-Kategorien, Diagramme (recharts), CSV/CAMT-Import, Startsaldo | `account`, `category {name,kind}`, `transaction {accountId,categoryId,kind,amountMinor,date,payee,note}` | liest `invoices/public`, `subscriptions/public`; bucht auf `invoice.paid/unpaid` |
| **Rechnungen** (an, braucht Finanzen) | Offene Rechnungen mit Fälligkeit | Offen/bezahlt, „als bezahlt“ bucht Ausgabe, Mail-Scan, Formular | `invoice {payee,amountMinor,dueDate,status,paidAt,reference,note}` | Event an Finanzen; Kalender; Benachrichtigung |
| **Abos** (an) | Wiederkehrende Zahlungen, Kündigungsfrist, Summe/Monat+Jahr | Rhythmus, pausieren, Bank-/Mail-Erkennung | `subscription {name,amountMinor,recurrence,startDate,cancelNoticeDays,active,note}` | `public.ts` für Finanzen; Kalender (Abbuchung + Frist); Benachrichtigung |
| Merkliste | Links/Lesen/Sehen/Orte/Ideen merken | Arten, Tags, erledigt, Browser-HTML-Import, Teilen-Ziel | `item {title,url,kind,tags[],note,done}` | empfängt `bookmark.requested` (Nachrichten) |
| Notizen | Schnelle Textnotizen | Titel+Text, anheften, Suche | `note {title,body,pinned}` | Teilen-Ziel |
| Einkaufsliste | Abhak-Liste mit Mengen | „2 Milch“, Gekauftes entfernen, Text-Import | `item {name,quantity,done}` | empfängt `shopping.requested` (Vorräte) |
| Nachrichten | RSS/Atom-Schlagzeilen nach Themen | 9 Start-Feeds (ungeprüft), gelesen/gespeichert, Stummwörter, KI-Tagesüberblick | `feed {url,title,category,active}`, `article`/`feedstate` **lokal** | sendet `bookmark.requested`; **kein aiSchema** (bewusst) |
| Vorräte | Kühlschrank/Vorrat/TK mit Ablauf | Bestand ±, Mindestmenge, Ablaufwarnung, „Auf die Einkaufsliste“ | `item {name,place,count,minCount,expires,note}` | sendet `shopping.requested` (ohne Prüfung, ob Einkauf an) |
| Geburtstage | Jährlich im Kalender, Alter, WhatsApp-Gruß | Text-Import | `birthday {name,month,day,year?,note}` | Kalender; Benachrichtigung |
| Zeiterfassung | Zeit je Projekt per Timer oder nachtragen | Wochenübersicht, CSV-Stundenzettel, Projekte archivieren | `project {name,archived}`, `entry {projectId,date,minutes,note,startedAt}` | – |
| Habit-Tracker | Gewohnheiten an Wochentagen abhaken | Streak, Quote 30 Tage, Text-Import | `habit {name,weekdays[],archived}`, `check {habitId,date}` | – |
| Verträge & Garantien | Laufzeitende + Kündigungsfrist | Arten Vertrag/Versicherung/Garantie, Mail-Scan | `contract {name,kind,provider,start/endDate,noticeDays,note}` | Kalender; Benachrichtigung |
| Budgets & Sparziele (braucht Finanzen) | Monatslimit je Kategorie, Sparziele | Monatswechsel, Einzahlungen, Fortschritt | `budget {categoryId,monthlyLimitMinor}`, `goal {name,targetMinor,deadline,note}`, `deposit {goalId,amountMinor,date,note}` | liest `finance/public` |
| Packlisten | Reise-Checklisten | abhaken, zurücksetzen, als Vorlage kopieren | `list {name,note}`, `item {listId,name,packed,order}` | – |
| Dokumente (`vault`) | Wichtige Dokumente mit Ablaufdatum + Datei | Kategorien, Suche, Datei ≤ 10 MB **nur lokal** (`_blobs`) | `document {title,category,note,expiresOn,fileName,fileType,fileSize}` | Kalender; Benachrichtigung |
| Accounts | Passwort-Tresor (Argon2id/AES-256) | Generator, TOTP, Import/Export (Bitwarden …), Auto-Lock, Biometrie, Setup-Schritt | `vault {header}`, `entry {data}` – alles verschlüsselt | **vollständig ausgeschlossen** von KI, Suche, Import-API, Widget zeigt nur gesperrt/offen |
| Apps & Links | Kacheln für Dienste | Gruppen, 8 Presets | `link {title,url,group}` | kein aiSchema (bewusst) |
| Geschenkideen | Ideen je Person/Anlass | Status Idee/gekauft/verschenkt, Preis, Link | `idea {title,forWhom,occasion,date,priceCents,url,status,note}` | Kalender; kein aiSchema (bewusst, „Überraschung“) |
| Datenträger (Desktop) | Laufwerke, Scan, Treemap, Aufräumen | Rust-Scan, Papierkorb, Sperrliste, Duplikate | **keine Sammlung** (nur Arbeitsspeicher) | dataApi aus, kein aiSchema |
| Systeminfo (Desktop) | CPU/RAM/Akku/GPU/Netz/Top-Prozesse | nur Anzeige, 3-s-Takt | **keine Sammlung** | dataApi aus, kein aiSchema |
| `example` (nur Dev) | Generator-Vorlage | – | `entry` | sichtbar in `--mode e2e`-Builds (Bibliothek zeigt „Entwickler“) |

## 3 · Inventar Module – Technik, Reife, Probleme
Widget: jedes Modul genau eines (Pflicht laut `validateManifest`); Größe s, außer m bei Kalender, Budgets, Nachrichten. Setup-Schritt: nur Accounts (`accounts.vault`). Seeds = eingebaute Startdaten/Vorlagen (nicht die Screenshot-Fakes).

| Modul | Code / Tests (Zeilen) | Testdateien · E2E-Spec | Chunk kB | Seeds / Importer | Reife | Probleme / Auffälligkeiten |
|---|---|---|---|---|---|---|
| Kalender | 2 133 / 251 | 2 · core, connectors, a11y | 12,8 (+ Charts 0) | ICS-Datei, Mail-Scan | fertig | Beschreibung veraltet („später Rechnungen und Abos“); tägliche Erinnerungen fluten Monat/Woche (6 Zeilen pro Tag im Screenshot); Agenda-Spalte doppelt Übersicht-Widget; Drag/Resize fehlt (ROADMAP M2) |
| ToDos | 1 181 / 134 | 2 · core | 9,1 | Text; Liste „Eingang“ auto | fertig | keine Wiederholung, kein „Irgendwann“ (M1); Unteraufgaben im Datenmodell, in der Übersicht nicht sichtbar |
| Erinnerungen | 865 / 149 | 2 · notifications | 4,5 | 8 Vorlagen, Text | fertig | Kacheln mit redundantem Schalter-Text („Oma anrufen: Aktiv“); „Noch nicht aktiviert“-Banner dauerhaft, solange Benachrichtigungen aus |
| Finanzen | 2 335 / 322 | 3 · money | 15,4 + Charts 361 | Konto-Formular, Bank CSV/CAMT; Auto-Seed Konto + 10 Kategorien | fertig | nur EUR; keine Umbuchung/Split (M5); recharts ist der größte Modul-Chunk |
| Rechnungen | 891 / 120 | 1 · money | 5,5 | Formular, Mail | fertig | nach dem Bezahlen ist die Ausgabe nur über Finanzen sichtbar; `requires finance` informiert nur |
| Abos | 1 138 / 206 | 2 · money | 5,5 | Formular, Bank, Mail | fertig | **Layout-Fehler:** Kachel-Titel brechen buchstabenweise („Fitn/ess/stu/dio“) auf Desktop und Mobil; Erinnerungszeit fest 09:00 (andere Module haben Setting) |
| Merkliste | 697 / 118 | 2 · extras | 4,6 | HTML, Text | fertig | Filterzeile (Segment + Select + Suche + Tags) wirkt überladen für 6 Einträge |
| Notizen | 365 / 52 | 1 · extras | 2,6 | – (nur JSON) | schmal | nur Klartext, keine Checklisten/Markdown (M7); kein `StartDataButton` |
| Einkaufsliste | 404 / 84 | 2 · extras | 2,1 | Text | fertig | eine Liste, keine Läden/Abschnitte (M9) |
| Nachrichten | 1 470 / 317 | 1 · news | 9,5 | 9 Start-Feeds, URL-Formular | fertig (Feeds ungeprüft) | Icon gleich wie Notizen; 5 Bedienelemente in der Kopfzeile; in der PWA nur mit Sync-Server-Proxy |
| Vorräte | 645 / 103 | 1 · newmodules | 4,9 | – | fertig | Toast „sofern das Modul eingeschaltet ist“ statt Prüfung; kein StartDataButton |
| Geburtstage | 601 / 115 | 1 · extras | 3,1 | Text | fertig | ohne Jahr kein Alter (korrekt); keine Kontaktverknüpfung |
| Zeiterfassung | 942 / 195 | 1 · newmodules | 7,7 | – | fertig | keine Stundensätze/Beträge, keine Projektfarben (STATUS-Ideen); Timer getrennt vom Timer-Werkzeug |
| Habit-Tracker | 573 / 98 | 1 · extras | 4,0 | Text | schmal | nur 7-Tage-Streifen, keine Statistik/Jahresraster (M4); Wochentage beginnen beim heutigen Tag, nicht beim Wochenstart |
| Verträge | 637 / 104 | 1 · extras | 3,6 | Mail | schmal | kein Dokument/Beleg (M8), nur Text; Mail-Importer ohne StartDataButton auf der Seite |
| Budgets | 932 / 99 | 1 · money | 9,2 | – | schmal | kein Monatsübertrag, keine Regeln (M3); „352 % drüber“ als Hauptanzeige; kein StartDataButton |
| Packlisten | 529 / 86 | 1 · extras | 4,0 | – | fertig | keine Vorlagenbibliothek (nur Kopie) |
| Dokumente | 660 / 115 | 1 · extras | 4,7 | – | schmal | Dateien nicht in Sync/Backup (K3) – am zweiten Gerät „Datei nur auf einem anderen Gerät“; Icon gleich wie Accounts |
| Accounts | 3 653 / 1 182 | 8 · accounts, setup | 49,5 + zxcvbn 1,32 MB lazy | – (JSON blockiert) | fertig | größtes Modul; Mobil-Kopfzeile überladen (Suche winzig, 2 Buttons umbrechen); kein Passwort-Health/HIBP (S1) |
| Apps & Links | 510 / 88 | 1 · extras | 2,9 | 8 Presets | fertig | nur Link-Liste; Kacheln öffnen Browser, keine App-Erkennung |
| Geschenkideen | 565 / 90 | 1 · newmodules | 4,8 | – | fertig | keine Verknüpfung zu Geburtstagen (Datum wird manuell gepflegt) |
| Datenträger | 3 563 / 331 + Rust 3 967 | 4 · disk | 36,5 + 3,5 | – | ungeprüft (Windows) | Checkliste D1–D16 offen; größter Rust-Anteil |
| Systeminfo | 358 / 62 + Rust 351 | 1 · system | 3,9 | – | ungeprüft (Windows) | reine Anzeige |

Querschnitt: alle Module `version: 1`, Migrationsrahmen noch nie genutzt (gut für spätere Zusammenlegungen: erste echte Migration wäre neu). Deutsche Texte stehen in jedem Manifest statt in `strings.ts` (gegen `modules/CLAUDE.md`). Events `module.enabled/disabled` haben keinen Abonnenten.

## 4 · Inventar Werkzeuge
Alle öffnen im Werkzeug-Sheet (schmaler Dialog, auch auf 1920 px ≈ 350 px breit; erste Zeile ist immer der Knopf „Zurück zu den Werkzeugen“). Keine URL, nicht in der Befehlspalette (Ausnahme: Rechnen per Palette). Kein Werkzeug hat Setup-Schritt oder Tests gegen UI; `logic.test.ts` wo angegeben.

| Werkzeug | Gruppe · Standard | Funktion | Speichert | Code / Tests | Abhängigkeit | Befund |
|---|---|---|---|---|---|---|
| Rechner | Alltag · an | Ausdruck mit Klammern/%, Verlauf 12 | localStorage | 144 / 0 | `core/calc` | **doppelt** mit Paletten-Rechner (gleicher Parser) |
| Prozent & MwSt | Alltag · an | Prozentwert, Anteil, netto/brutto | – | 204 / 17 | – | drei Rechner untereinander, Ergebnis unauffällig („–“) |
| Währung | Alltag · an | EZB-Kurse (Frankfurter API) | localStorage Kurse | 205 / 38 | Netz | einziges Online-Werkzeug; offline ohne Cache nur Fehlertext |
| Timer & Stoppuhr | Alltag · an | Countdown, Stoppuhr mit Runden, Pomodoro | nur RAM (Reload = weg) | 406 / 73 | zustand | läuft bei geschlossenem Sheet weiter; **getrennt** von Zeiterfassungs-Timer |
| QR-Code | Alltag · an | erzeugen (SVG), lesen (Kamera, `BarcodeDetector`) | – | 334 / 46 | `qrcode-generator` | Lesen nur in Chromium-Browsern |
| Notizzettel | Alltag · an | ein Zettel, synchronisiert | `_settings tools.scratch` | 79 / 0 | – | **überschneidet** Notizen; widerspricht „Werkzeuge halten keine Daten“ |
| Einheiten | Weitere · aus | Länge, Gewicht, Temperatur, Volumen, Tempo | – | 188 / 26 | – | – |
| Kosten teilen | Weitere · aus | Betrag ÷ Personen + Trinkgeld | – | 135 / 20 | – | keine Verbindung zu Finanzen |
| Datumsrechner | Weitere · aus | Abstand, Tage addieren, KW | – | 166 / 24 | date-fns | – |
| Zeitzonen | Weitere · aus | Uhrzeit in bis zu 8 Zonen | localStorage | 447 / 94 | Intl | größtes Werkzeug nach PDF |
| Würfel & Zufall | Weitere · aus | Würfel, Münze, Zufallszahl, Auswahl | – | 224 / 35 | `core/crypto/random` | – |
| Text-Werkzeug | Weitere · aus | Zählen, Groß/Klein, Aufräumen, Sortieren, Blindtext | – | 342 / 81 | – | – |
| Bilder verkleinern | Weitere · aus | Skalieren, Zuschnitt, PNG/JPG/WebP | – | 385 / 54 | Canvas | nativer `Choose File`-Button ungestylt; kein HEIC |
| PDF-Werkzeug | Weitere · aus | Zusammenfügen, Seiten, Drehen | – | 505 / 96 | **pdf-lib 428 kB** | größter Werkzeug-Chunk; nativer Dateiwähler |
| Base64 & URL | Entwickler · aus | kodieren/dekodieren | – | 133 / 27 | – | |
| JSON | Entwickler · aus | prüfen, formatieren, verdichten | – | 101 / 20 | – | |
| UUID | Entwickler · aus | v4 erzeugen | – | 59 / 0 | – | Icon gleich wie Hash |
| Hash | Entwickler · aus | SHA-1/256/512 von Text | – | 99 / 17 | WebCrypto | keine Datei-Prüfsumme |

Profile des Einrichtungsassistenten schalten Werkzeuge mit: Alltag (Rechner, Timer, Einheiten, Datum, QR, Zettel), Finanzen (Rechner, Prozent, Währung, Teilen), Produktiv (Zettel, Timer, Rechner, Datum), Minimal (Rechner).

## 5 · Connectors
| Connector | Auth · Plattform | Liefert | Nutzer |
|---|---|---|---|
| Google | OAuth PKCE, eigener Client · nur Desktop | Kalender (nur lesen, Sync-Token), Gmail-Scan (Metadaten + Snippet, nie Body) → Vorschläge Rechnung/Abo/Termin/Vertrag | Kalender-Senke; Mail-Importer in Kalender, Rechnungen, Abos, Verträge |
| Kalender-Abo (ICS) | keine · überall | Abonnierte Kalender, Fenster −60/+400 Tage | Kalender-Senke; in der PWA nur über Sync-Server-Proxy |
Hintergrund-Sync alle 5 Min. (sichtbar), je Connector max. alle 30 Min. Google-Login auf Android fehlt (Termine kommen nur per Sync oder ICS).

## 6 · Überschneidungen
| Bereich | Was sich überlappt | Beobachtung |
|---|---|---|
| **Zeit / Fälligkeit** | Kalender-Termin · Erinnerung · ToDo mit Fälligkeit · Rechnung fällig · Abo-Abbuchung · Vertragsfrist · Vorrat läuft ab · Dokument läuft ab · Geburtstag · Geschenk-Anlass | 10 Module erzeugen Kalender-Items, 7 Benachrichtigungen; jedes mit eigener Settings-Logik (`remindDaysBefore/remindTime`, bei Abos fest). Ein „Erinnerung“-Datensatz ist faktisch ein Termin ohne Dauer mit Benachrichtigung; eine ToDo-Fälligkeit ohne Benachrichtigung. Nutzer muss vorab wählen: Termin, Erinnerung oder ToDo? |
| **Geld** | Finanzen · Rechnungen · Abos · Budgets · Verträge (Kosten fehlen dort) | Vier Module, drei `public.ts`-Brücken, ein Bus-Event. Finanzen rechnet „verfügbar“ bereits mit Rechnungen + Abos. Verträge kennen Laufzeit, aber keinen Preis; Abos kennen Preis + Kündigungsfrist – ein Handyvertrag passt in beide. |
| **Sammeln** | Merkliste (Links/Ideen) · Notizen · Notizzettel-Werkzeug · Nachrichten „für später“ (→ Merkliste) · Geschenkideen (Ideen je Person) · Apps & Links (Links als Kacheln) | Drei Orte für „einen Link merken“ (Merkliste, Apps & Links, Notiz); zwei für Freitext (Notizen, Notizzettel). |
| **Listen** | Einkaufsliste · Packlisten · ToDo-Listen · Vorräte (Bestand) | Drei Abhak-Listen mit demselben Grundmuster (`{name, done/packed}` + Eingabezeile); Packlisten haben zusätzlich Vorlage-Kopie, Vorräte Mengen/Orte. |
| **Personen** | Geburtstage · Geschenkideen (`forWhom` als Freitext) · Accounts | Keine Personen-Entität; „Anna“ in Geburtstagen und Geschenken ist nur gleichlautender Text. |
| **Timer** | Timer-Werkzeug (flüchtig) · Zeiterfassung-Timer (persistiert) | Zwei Start/Stopp-Uhren, verschiedene Zwecke, aber dieselbe Erwartung „Uhr läuft“. |
| **Rechner** | Rechner-Werkzeug · Paletten-Rechner | Gleicher Parser, zwei Oberflächen. Prozent/MwSt, Kosten teilen, Währung sind Spezialfälle desselben Rechners ohne Verbindung zu Finanzen. |
| **Desktop-Diagnose** | Datenträger · Systeminfo | Gleicher Plattform-Seam, gleiche Zielgruppe (PC-Pflege), keine Daten; Systeminfo ist 1/10 des Umfangs. |
| **Generatoren** | UUID · Hash · Würfel · Passwort-Generator (Accounts) | Gleicher CSPRNG; UUID/Hash/Base64/JSON sind reine Entwickler-Helfer in einer Alltags-App. |

## 7 · Lücken (nur beobachtet, keine Empfehlung)
- Kein Ort für Personen/Kontakte, obwohl 3 Module Personen referenzieren.
- Dateien (Dokumente, später Belege) verlassen das Gerät nicht (K3); Verträge/Rechnungen können keinen Beleg halten.
- Wiederholende Aufgaben nur über Erinnerungen, nicht in ToDos.
- Übersicht: Widgets sind reine Anzeige, jede Aktion verlässt die Startseite (K1); mit 21 Modulen passt auf Mobil ein Widget pro Bildschirm.
- Werkzeuge haben keine URLs, keine Paletten-Einträge, keine Tastaturkürzel; der Sheet-Dialog ist auf Desktop so schmal wie auf dem Handy.
- Keine Verknüpfung Geschenk ↔ Geburtstag, Vertrag ↔ Abo/Finanzen, Kosten teilen ↔ Buchung.
- Android: kein Google-Login, kein natives Teilen-Ziel in der APK.

## 8 · Funde (für Bericht, nicht nebenbei fixen)
1. Abo-Kacheln: Titel bricht buchstabenweise um (Desktop + Mobil, Screenshot `subscriptions`).
2. Kalender-Beschreibung veraltet („später Rechnungen und Abos“).
3. Vorräte → Einkaufsliste sendet ohne Prüfung, ob das Modul an ist (Nachrichten prüft).
4. Erinnerungszeit bei Abos fest 09:00, andere Module konfigurierbar.
5. Doppelte Icons: Nachrichten = Notizen (`note`), Dokumente = Accounts (`lock`); UUID = Hash.
6. `StartDataButton` fehlt auf 8 Modulseiten (Verträge trotz Mail-Importer, Notizen, Packlisten, Vorräte, Dokumente, Geschenke, Zeiterfassung, Budgets).
7. Setup-Text „Automatische Backups gibt es noch nicht“ widerspricht `AutoBackupCard`.
8. Profil „Produktiv“ nennt „Lesezeichen, Starter“ statt „Merkliste, Apps & Links“.
9. `example`-Modul erscheint in E2E-Builds in der Bibliothek (nur Vorschau-Builds, nicht Release).
10. Manifest-Texte, Settings-Labels und Benachrichtigungstexte liegen außerhalb von `strings.ts`.
11. Accounts mobil: Kopfzeile mit Suche + 2 Buttons bricht unschön.
12. `docs/product/` fehlt in `web/scripts/check-docs.mjs` `exemptDirs` → dieser Bericht erzeugt eine Budget-Warnung (CI nur Warnung). Vorschlag: Ordner wie `features/` ausnehmen (eine Zeile, gehört in den Umsetzungs-Prompt).

## 9 · Antworten Runde 1 (Sven, 2026-10-01) – Fakten
- **Genutzt (täglich/wöchentlich):** Zeit-Trio (Kalender, ToDos, Erinnerungen), Geld-Quartett (Finanzen, Rechnungen, Abos, Budgets), Listen & Sammeln (Merkliste, Notizen, Einkaufsliste, Vorräte, Packlisten). **Nicht gewählt:** Accounts, Dokumente, Verträge, Geburtstage, Geschenke, Zeiterfassung, Habits, Nachrichten, Apps & Links, Datenträger, Systeminfo (Annahme: selten/nie; je Modul in Runde 2 nachgefragt).
- **Liegt noch woanders, soll nach Nemo:** ein persistenter Notizzettel (Ersatz für Notepad), Browser-Favoriten, Personen/Kontakte, Belege/Dokumente/Fotos, Passwörter/2FA.
- **Nervt:** zu viele Module (Navigation, Übersicht), Übersicht ist nur Anzeige, Werkzeuge umständlich. *Nicht* als störend gewählt: die Vorab-Entscheidung Termin/Erinnerung/ToDo.
- **Zielgruppe:** Svens Alltag entscheidet, Nemo bleibt öffentlich nutzbar → Module bleiben zu-/abschaltbar, Zusammenlegungen nur mit sauberer Migration.

## 10 · Entschieden
- Zielgruppe: Alltag von Sven, öffentlich nutzbar (Runde 1).
- Zielbild **Variante B** (9 Nav-Einträge + „Dieser PC“), **C als erstes Paket** (Gruppen + Aufräumen ohne Migration) (Runde 2).
- **Entfernt wird nur Nachrichten** (mit Export). Habits, Zeiterfassung bleiben eingefroren (aus, keine Investition); Vorräte bleibt, als Tab in „Listen“ (Gruppe, keine Migration) (Runde 2).
- **Erinnerungen → Kalender** verschmelzen (Termin mit `notify`, Tab „Erinnerungen“), als letztes Verschmelzungspaket (Runde 2).
- **Werkzeuge 18 → 12** + Rahmen (breiter Dialog, Route, Palette, Kürzel); Notizzettel wird fester „Zettel“ in Notizen (Runde 2).

## Anhang · Screenshots reproduzieren
Repo-Skript deckt 19 Module ab; für diese Review wurde eine Kopie um Vorräte, Zeiterfassung, Geschenke, Dokumente, Apps & Links, Nachrichten und alle 18 Werkzeuge erweitert (nicht eingecheckt). Repo-Variante:
```
cd web && SCREENS_VIEWPORTS=1920x1080,412x915 npm run screenshots
SCREENS_DESKTOP=1 SCREENS_PAGES='^(system|disk)$' SCREENS_VIEWPORTS=1920x1080,412x915 npm run screenshots
```
Bilder dieser Runde: 50 Paare (Desktop links, Mobil rechts), per Chat geliefert; Ablage im Repo offen (Frage 6).

---

# Runde 2 · Bewertung und Vorschläge (2026-10-01)

Grundlage: Antworten aus Abschnitt 9. Skala Nutzen = für Svens Alltag (hoch/mittel/niedrig); Pflege = Code + Tests + Abhängigkeiten (niedrig < 700 Zeilen ohne Fremdbibliothek, hoch > 2 000 oder Netz/Rust); Bedienung = Schritte bis zur Kernaktion.

## 11 · Zwei Arten von Zusammenlegung (wichtig für jede Entscheidung)
| | **Gruppe** (UI-Ebene) | **Verschmelzung** (Datenebene) |
|---|---|---|
| Was passiert | Mehrere Module bekommen einen gemeinsamen Nav-Eintrag + Seite mit Tabs + ein Sammel-Widget; Modul-IDs, Tabellen, Sync, Backup, KI-Schema bleiben | Neue Sammlung, alte Daten werden kopiert, altes Modul verschwindet |
| Migration | keine | Pflicht (Kopie, nicht Verschiebung, s. u.) |
| Sync mit altem Handy | unverändert | Alte Version schreibt weiter in alte Tabellen → Übergangsregel nötig |
| Deaktivierbar | je Teilmodul weiter möglich | nur das Ganze |
| Versionssprung | MINOR | Breaking (0.x: MINOR mit Hinweis, sonst MAJOR) |
| Nötig im Code | `manifest.group` (neu), Nav/Router/Übersicht lesen Gruppen | Core-Migration (gibt es noch nicht: `manifest.migrations` ist nur modul-intern) |

Empfehlung: **Gruppe überall dort, wo die Datenmodelle verschieden bleiben** (Geld), **Verschmelzung nur, wo das Modell faktisch gleich ist oder ein neues Modell gebraucht wird** (Listen, Personen, Unterlagen). Migrationsregel für den Prompt: neue Tabelle anlegen, Daten kopieren, alte Tabelle **nicht** tombstonen (sonst löscht das alte Handy per Sync seine Daten), alte Tabelle versteckt bis zur übernächsten Version, dann entfernen.

## 12 · Bewertung Module
| Modul | Nutzen | Pflege | Bedienung | Überschn. | Reife | **Empfehlung** |
|---|---|---|---|---|---|---|
| Kalender | hoch | hoch | gut | Zeit | fertig | **behalten + erweitern:** Erinnerungen aufnehmen (Termin mit `notify`), Agenda-Spalte = Übersicht-Widget (eins davon weg), später Drag/Resize (M2) |
| ToDos | hoch | mittel | gut | Zeit | fertig | **behalten + erweitern:** Wiederholung + „Irgendwann“ (M1, `core/recurrence` vorhanden), optional `remindAt` |
| Erinnerungen | hoch | mittel | gut | Zeit (Kalender, ToDo) | fertig | **verschmelzen → Kalender** als Tab „Erinnerungen“: `event` bekommt `notify {minutesBefore}`; Erinnerung = Termin ohne Dauer mit `notify`. Gewinn: 1 Modul weniger, eine Wiederholungslogik, Benachrichtigung auch für Termine (fehlt heute!). Verlust: eigene Kachel-Seite. Risiko: Benachrichtigungs-Beitrag wandert in den Kalender (Tests `notifications.spec`). **Gegenposition:** du empfindest die Dreiteilung nicht als störend → dann als *Gruppe* „Zeit“ (Kalender, ToDos, Erinnerungen) ohne Migration |
| Finanzen | hoch | hoch | gut | Geld | fertig | **behalten,** Kern der Gruppe „Geld“ |
| Rechnungen | hoch | niedrig | sehr gut | Geld | fertig | **Gruppe „Geld“** (Tab); Daten bleiben |
| Abos | hoch | mittel | gut | Geld, Verträge | fertig | **Gruppe „Geld“** (Tab); Layout-Fehler fixen; Erinnerungszeit als Setting |
| Budgets | hoch | mittel | gut | Geld | schmal | **Gruppe „Geld“** (Tab); Übertrag + Regeln (M3) später |
| Merkliste | hoch | niedrig | mittel (viele Filter) | Sammeln | fertig | **behalten + erweitern:** Favoriten-Ansicht (Kacheln, Gruppen) übernimmt Apps & Links; Browser-HTML-Import existiert |
| Notizen | hoch | niedrig | sehr gut | Sammeln, Notizzettel | schmal | **behalten + erweitern:** fester „Zettel“ (eine angeheftete Schnellnotiz, Widget zeigt sie, Notepad-Ersatz), Checklisten (M7) |
| Einkaufsliste | hoch | niedrig | sehr gut | Listen | fertig | **verschmelzen → „Listen“** mit Packlisten: `list {name, kind: shopping|packing|checklist}`, `item {listId, name, quantity, done, order}`; Einkauf = Liste mit Mengen-Parser, Packliste = Liste mit „Zurücksetzen/Vorlage“ |
| Packlisten | mittel | niedrig | gut | Listen | fertig | **verschmelzen → „Listen“** (s. o.). Gewinn: 2 → 1 Modul, Vorlagen für alle Listenarten. Verlust: keiner sichtbar. Migration: `shopping_item` → Liste „Einkauf“, `packing_*` 1:1 |
| Vorräte | mittel | niedrig | gut | Listen (Einkauf) | fertig | **behalten (Gruppe „Haushalt“ mit Listen)** oder entfernen, wenn du es nicht pflegst – Nachfrage |
| Geburtstage | mittel | niedrig | sehr gut | Personen | fertig | **verschmelzen → „Personen“** (neu): `person {name, birthday?, note, tags}`; Geburtstags-Logik (Kalender, Alter, WhatsApp) bleibt als Funktion |
| Geschenkideen | niedrig | niedrig | gut | Personen | fertig | **verschmelzen → „Personen“**: `gift {personId, …}`; `forWhom` wird beim Migrieren per Namensabgleich zur Person. Deckt deinen Wunsch „Personen/Kontakte“ ohne drittes Modul |
| Verträge | mittel | niedrig | gut | Unterlagen, Abos | schmal | **verschmelzen → „Unterlagen“** mit Dokumente: `document {title, category, provider?, startDate?, endDate?, noticeDays?, note, file*}`; Vertrag = Dokument mit Laufzeit |
| Dokumente | mittel | niedrig | gut | Unterlagen | schmal | **verschmelzen → „Unterlagen“** (s. o.). Belege/Fotos brauchen zusätzlich Anhänge im Sync (K3, L) – eigenes Paket |
| Accounts | hoch (gewünscht) | hoch | gut | – | fertig | **behalten,** später Passwort-Health/HIBP (S1); mobile Kopfzeile fixen |
| Apps & Links | niedrig | niedrig | sehr gut | Sammeln | fertig | **auflösen → Merkliste** (Art „Favorit“, Gruppe = Tag, Kachelansicht). Migration 1:1 |
| Habits | niedrig (ungenutzt) | niedrig | gut | – | schmal | **behalten, einfrieren** (aus, keine Investition) – oder entfernen; isoliert, 573 Zeilen |
| Zeiterfassung | niedrig (ungenutzt) | mittel | gut | Timer-Werkzeug | fertig | **behalten, einfrieren** – oder entfernen; 942 Zeilen |
| Nachrichten | niedrig (ungenutzt) | hoch (Netz, Proxy, Hintergrunddienst, KI-Brief, ungeprüfte Feeds) | mittel | Merkliste | fertig | **entfernen** (→ Roadmap „optionale Erweiterung“). Ersparnis ≈ 1 470 Zeilen + `newsBrief` + Proxy-Pfad in der PWA. Gegenposition: einziges „Lese“-Modul für öffentliche Nutzer |
| Datenträger | mittel (PC) | hoch (Rust) | gut | PC | ungeprüft | **verschmelzen → „Dieser PC“** mit Systeminfo (Tabs Laufwerke / System); keine Daten, keine Migration |
| Systeminfo | niedrig | niedrig | sehr gut | PC | ungeprüft | **verschmelzen → „Dieser PC“** |

## 13 · Bewertung Werkzeuge
| Werkzeug | Nutzen | Empfehlung |
|---|---|---|
| Rechner, Prozent & MwSt, Kosten teilen | hoch | **zusammenlegen → ein „Rechner“** mit Modi (Ausdruck · Prozent/MwSt · Teilen); Paletten-Rechner bleibt (gleicher Parser). 3 Kacheln → 1 |
| Währung | mittel | behalten; Kursdatum anzeigen (T2) |
| Timer & Stoppuhr | hoch | behalten; optional „in Zeiterfassung buchen“ nur falls Zeiterfassung bleibt (T3) |
| QR-Code | mittel | behalten |
| Notizzettel | hoch (als Idee) | **entfernen → Notizen „Zettel“** (synchronisiert, durchsuchbar, Widget). Werkzeuge halten dann wieder keine Daten |
| Einheiten, Datumsrechner, Zeitzonen, Würfel, Text | mittel/niedrig | behalten (aus); keine Investition |
| Bilder verkleinern, PDF | mittel | behalten (aus); Dateiwähler als `Button` stylen |
| Base64, JSON, UUID, Hash | niedrig | **zusammenlegen → ein „Entwickler“-Werkzeug** mit Tabs. 4 Kacheln → 1 |
| Rahmen | – | **erweitern (S):** breiter Dialog ≥ 900 px, Route `/tools/<id>`, Paletten-Einträge „Werkzeug: …“, Kürzel; „Zurück“-Knopf in die Kopfzeile. Ergebnis: 18 → 12 Werkzeuge |

## 14 · Kürzungen (Funktionen, nicht Module)
| Was raus | Warum | Ersparnis |
|---|---|---|
| Kalender-Agenda-Spalte (Desktop) | doppelt „Heute & Morgen“ | wenig Code, viel Ruhe |
| Erinnerungs-Kacheln → Liste | Kachel + Schalter + redundanter Text | ca. 100 Zeilen CSS/TSX |
| Launcher-Presets, Nachrichten-Startpaket (ungeprüfte URLs) | Pflege unverifizierter Adressen | 2 Dateien + Manual-Tests N1 |
| KI-Tagesüberblick (`newsBrief`) | entfällt mit Nachrichten | ca. 150 Zeilen + Strings |
| Einrichtungs-Profile „Produktiv/Alltag/…“ | mit 9 statt 23 Modulen reicht die Bibliothek | ca. 200 Zeilen (Entscheidung) |

## 15 · Erweiterungen mit echtem Alltagsnutzen (aus ROADMAP, nichts Neues)
| Id | Was | Aufwand | Risiko | Paket-Idee |
|---|---|---|---|---|
| K1 | Übersicht: abhaken/hinzufügen direkt im Widget, Widgetgröße | M | niedrig | 2 |
| M7+ | Notizen: fester Zettel, Checklisten, Zettel-Widget | S–M | niedrig | 1 |
| I2-Teil | Favoriten: Browser-HTML-Import existiert; Kachelansicht + Gruppen | S | niedrig | 1 |
| M1 | ToDos: Wiederholung, Irgendwann | M | niedrig | 2 |
| Zeit | Termin-Benachrichtigung (`notify`) – Voraussetzung für Erinnerungen → Kalender | M | mittel | 2 |
| Personen | neues Modul aus Geburtstage + Geschenke | M | mittel (Migration, Namensabgleich) | 3 |
| Unterlagen | Verträge + Dokumente | S–M | mittel (Migration) | 3 |
| K3 | Anhänge in Sync/Backup (Belege, Fotos) | L | hoch | 4 (eigenes Paket) |
| S1 | Passwort-Health/HIBP | M | niedrig | 4 |
| D1 | Werkzeuge: Route, Palette, Kürzel, breiter Dialog | S | niedrig | 1 |

## 16 · Drei Gesamtvarianten
Nav = Einträge in Seitenleiste/„Mehr“; (PC) nur Desktop. Zahlen = Zeilen Web-Code, die wegfallen oder zusammenrücken (Schätzung aus Abschnitt 3).

### A · Minimal – 6 Nav-Einträge
Kalender (inkl. Erinnerungen, Geburtstage als Termin-Art) · ToDos · Geld (Gruppe) · Listen (Einkauf + Packlisten) · Sammlung (Notizen + Merkliste + Favoriten) · Accounts. Entfernt: Vorräte, Habits, Zeiterfassung, Nachrichten, Geschenke, Verträge, Dokumente, Apps & Links, Systeminfo; Datenträger bleibt als (PC).
Gewinn: Übersicht passt auf einen Mobil-Bildschirm, 8 000 Zeilen weniger. Verlust: Verträge/Dokumente/Personen fehlen – widerspricht deinen Wünschen (Belege, Personen). **Nicht empfohlen.**

### B · Fokussiert – 9 Nav-Einträge (+ PC) · **Empfehlung**
| Nav | Enthält | Art |
|---|---|---|
| Übersicht | Widgets mit Aktionen (K1) | – |
| Kalender | Termine + Erinnerungen (Tab) + Fälligkeiten | Verschmelzung |
| ToDos | Listen, Wiederholung | erweitert |
| Geld | Finanzen · Rechnungen · Abos · Budgets als Tabs | Gruppe |
| Listen | Einkauf · Packlisten · Checklisten (+ Vorräte als Tab, falls behalten) | Verschmelzung |
| Notizen | Notizen + fester Zettel | erweitert |
| Merkliste | Lesen/Sehen/Orte/Ideen + Favoriten-Kacheln | erweitert (nimmt Apps & Links auf) |
| Personen | Geburtstage + Geschenke | neu (Verschmelzung) |
| Unterlagen | Verträge + Dokumente (+ Belege später) | Verschmelzung |
| Accounts | Tresor | behalten |
| Dieser PC (PC) | Laufwerke · System | Verschmelzung |
Entfernt: Nachrichten; Habits und Zeiterfassung eingefroren (aus, bleiben für andere Nutzer) oder entfernt – deine Wahl. Mobil-Leiste: Übersicht, Kalender, ToDos, Geld, Mehr.
Gewinn: 23 → 11 Einträge, alle Wünsche aus Runde 1 abgedeckt, Geld ohne Migration. Verlust: 4 echte Migrationen (Erinnerungen, Listen, Personen, Unterlagen), Breaking-Version.

### C · Vollständig geordnet – 12 Nav-Einträge (+ PC), nur Gruppen
Zeit (Kalender, ToDos, Erinnerungen) · Geld (4) · Sammlung (Notizen, Merkliste, Apps & Links) · Haushalt (Einkauf, Vorräte, Packlisten) · Personen (Geburtstage, Geschenke) · Unterlagen (Verträge, Dokumente) · Accounts · Habits · Zeiterfassung · Nachrichten · Dieser PC.
Gewinn: keine einzige Migration, alles bleibt abschaltbar, in einem Paket machbar (nur `manifest.group` + Nav/Übersicht). Verlust: Datenmodelle bleiben zersplittert (Geschenk kennt Person weiter nur als Text, Erinnerung ≠ Termin, zwei Listen-Modelle), Code schrumpft nicht, Übersicht bleibt voll (ein Widget je Modul, außer Gruppen-Widgets kommen dazu).

### Empfehlung und Reihenfolge (Vorschau auf Runde 3)
B, aber **C als erstes Paket** (Gruppen-Mechanik, Nachrichten raus, Werkzeuge 18 → 12, Zettel + Favoriten) – das ist in einem Release ohne Migration machbar und bringt sofort Ruhe. Danach die Verschmelzungen von B in der Reihenfolge Listen (klein) → Unterlagen → Personen → Erinnerungen (größte Verhaltensänderung), jede als eigenes Paket mit eigener Migration und Übergangsregel für den Sync.

## 17 · Fragen Runde 2
Beantwortet, siehe Abschnitt 10.

---

# Runde 3 · Zielbild (2026-10-01)

Interne IDs bleiben, wo ein Modul weiterlebt (Tabellen = Sync-Vertrag). Neue Module bekommen neue IDs. „Kopie“ = App-Migration kopiert alte Zeilen in die neue Sammlung, alte Tabelle bleibt versteckt (Regel aus Abschnitt 11).

## 18 · Zielumfang je Modul
| Ziel-Modul (ID) | Aus | Rein | Raus | Datenmodell / Migration | Widget · Setup · Seeds · KI | Verknüpfungen |
|---|---|---|---|---|---|---|
| **Kalender** (`calendar`) | calendar + reminders | Tab „Erinnerungen“ (Liste der Termine mit `kind: reminder`), Benachrichtigung für jeden Termin, 8 Erinnerungs-Vorlagen als Importer | Agenda-Spalte Desktop (optional), Modul `reminders` | `event` + `kind: 'event' \| 'reminder'` (default event), `notify?: {minutesBefore, enabled}`. **Kopie** `reminders_reminder` → `calendar_event {kind:'reminder', allDay:false, startTime:time, notify:{minutesBefore:0, enabled:active}}`, gleiche `id` | Widget „Heute & Morgen“ (bleibt, zeigt Erinnerungen schon) · kein Setup · Vorlagen · aiSchema: `event` + kind/notify, `reminder` entfällt, Tier-1-Parser „erinnere mich“ → kind reminder | Benachrichtigungs-Beitrag wandert hierher; Schnellerfassung + Teilen schreiben `calendar`; Geburtstage kommen künftig aus Personen |
| **ToDos** (`todos`) | todos | Wiederholung (`recurrence?`, bei Erledigen nächste Instanz), „Irgendwann“ (`someday: boolean`), Widget-Abhaken (K1) | – | additiv, keine Migration | Widget „Offene ToDos“ mit Checkbox · – · Text · aiSchema + 2 Felder | – |
| **Geld** (Gruppe `money`: `finance`, `invoices`, `subscriptions`, `budgets`) | 4 Module | ein Nav-Eintrag, Seite mit Tabs Übersicht · Buchungen · Rechnungen · Abos · Budgets · Konten; `remindTime` für Abos; Abo-Kachel-Fix | nichts | **keine** (Gruppe) | 4 Widgets bleiben, optional Gruppen-Widget „Geld“ (Verfügbar, nächste Fälligkeiten) · – · wie heute · wie heute | `public.ts`-Brücken + `invoice.paid` bleiben |
| **Listen** (Gruppe `household`: neu `lists`, `pantry`) | shopping + packing (→ `lists`), pantry (Tab) | `lists`: Listenarten Einkauf (Mengen-Parser, „Gekauftes entfernen“), Packliste (Zurücksetzen, Vorlage), Checkliste; Vorräte als Tab unverändert | Module `shopping`, `packing` | `lists_list {name, kind: shopping\|packing\|checklist, note, order}`, `lists_item {listId, name, quantity?, done, order}`. **Kopie:** `shopping_item` → Liste `shopping-default` „Einkauf“; `packing_list/item` 1:1 (gleiche ids) | Widget „Listen“ (offene Einkäufe + Packfortschritt) + Vorräte-Widget · – · Text-Import Einkauf, Packlisten-Vorlagen (neu, klein) · aiSchema `list`,`item` ersetzt shopping/packing | `shopping.requested` (Vorräte) → `lists` abonniert; Schnellerfassung „Einkauf“ → `lists` |
| **Notizen** (`notes`) | notes + Notizzettel-Werkzeug | fester „Zettel“ (eine Notiz mit `id: 'scratch'`, immer oben, Widget zeigt sie), Checklisten `- [ ]` im Text, StartDataButton | Werkzeug `scratch` | `note` + `kind?: 'scratch'`. **Kopie** `_settings tools.scratch.text` → Notiz `scratch` (einmalig, idempotent) | Widget „Zettel + letzte Notizen“ · – · – · aiSchema unverändert | Teilen-Ziel bleibt |
| **Merkliste** (`bookmarks`) | bookmarks + launcher | Art „Favorit“ mit Kachelansicht und Gruppen (Tags), Browser-Import vorhanden | Modul `launcher`, 8 Presets | `item.kind` + `'favorite'`. **Kopie** `launcher_link` → `bookmarks_item {kind:'favorite', tags:[group]}` | Widget „Merkliste“ + Favoriten-Zeile · – · HTML, Text · aiSchema kind erweitert | `bookmark.requested` bleibt (Nachrichten fällt weg → nur noch Teilen) |
| **Personen** (neu `people`) | birthdays + gifts | Person mit Geburtstag, Notiz, Tags; Geschenke je Person; Alter, WhatsApp-Gruß, Kalender-Items, Erinnerung | Module `birthdays`, `gifts` | `people_person {name, birthday?: {month, day, year?}, note, tags}`, `people_gift {personId, title, occasion, date, priceCents, url, status, note}`. **Kopie:** birthday → person (gleiche id); gift → gift mit `personId` per Namensabgleich (trim, case-insensitive), sonst neue Person | Widget „Nächste Geburtstage · offene Geschenke“ · – · Text-Import Geburtstage · aiSchema nur `person` (Geschenke bleiben KI-unsichtbar, Überraschung) | Kalender-Items + Benachrichtigung wie Geburtstage heute |
| **Unterlagen** (`vault`, UI-Name neu) | vault + contracts | Dokument mit Laufzeit/Frist (Vertrag, Versicherung, Garantie), Datei optional; Fristen im Kalender + Erinnerung | Modul `contracts` | `document` + `category 'warranty'`, `provider?`, `startDate?`, `endDate?` (ersetzt `expiresOn`, Alias beim Lesen), `noticeDays?`. **Kopie** `contracts_contract` → `vault_document` (gleiche id) | Widget „Fristen & Ablauf“ · – · Mail-Scan (von Verträgen) + StartDataButton · aiSchema erweitert | Dateien weiter gerätelokal bis K3 |
| **Accounts** (`accounts`) | – | mobile Kopfzeile | – | – | unverändert, Setup-Schritt bleibt | ausgeschlossen wie heute |
| **Dieser PC** (`disk`, Desktop) | disk + system | Tabs Laufwerke · System | Modul `system` (UI); Rust-Crate `system-info` + Commands bleiben | keine Daten | Widget „Laufwerke + Auslastung“ · – · – · kein aiSchema, `dataApi: false` | `BLOCKED_MODULES`: `system` raus, `disk` bleibt |
| Habits (`habits`), Zeiterfassung (`timetrack`) | – | nichts (eingefroren) | – | – | unverändert, Standard aus | – |
| Nachrichten (`news`) | – | – | **ganzes Modul**, `core/ai/newsBrief.ts`, Startpaket, e2e `news.spec` | Export: Feeds im Backup (alte Tabellen), kein Import mehr | – | Proxy `/v1/proxy` bleibt (ICS) |

Nav-Ergebnis (B): Übersicht · Kalender · ToDos · Geld · Listen · Notizen · Merkliste · Personen · Unterlagen · Accounts · (Dieser PC) · Modul-Bibliothek · Einstellungen. Mobil: Übersicht, Kalender, ToDos, Geld, Mehr. Bibliothek zeigt Gruppen mit Teilmodulen (abschaltbar bleibt jedes Teilmodul).

## 19 · Zielumfang Werkzeuge (12)
| Werkzeug | Aus | Umfang |
|---|---|---|
| Rechner | calc + percent + split | Modi Ausdruck (Verlauf) · Prozent/MwSt · Teilen; Paletten-Rechner unverändert |
| Währung, Timer & Stoppuhr, QR-Code, Einheiten, Datumsrechner, Zeitzonen, Würfel & Zufall, Text, Bilder, PDF | 1:1 | unverändert; Dateiwähler als `Button` |
| Entwickler | base64 + json + uuid + hash | Tabs |
| Rahmen | – | Route `/tools/:id` (Sheet öffnet aus URL), Palette „Werkzeug: …“, Kürzel (z. B. `Strg+.`), Dialog bis 900 px, „Zurück“ in die Kopfzeile; `tools`-Settings migrieren alte IDs (percent/split → calc, base64/json/uuid/hash → dev, scratch entfällt) |

## 20 · Neue Core-Bausteine (einmalig, danach wiederverwendbar)
1. **`manifest.group`** `{id, name, icon, order}`: Nav zeigt Gruppe, Router hängt Teilmodul-Routen als Tabs unter `/<group>/…` (alte Pfade leiten um), Übersicht kann Gruppen-Widget anbieten, Bibliothek zeigt Teilmodule eingerückt. Teilmodule bleiben einzeln aktivierbar.
2. **App-Migration** (`core/db/appMigrations.ts`): Liste von idempotenten Schritten (Quelle, Ziel, Mapping), läuft nach dem Öffnen der DB und nach jedem Sync-Pull/Backup-Import, schreibt über `createRepo` (= synchronisiert), kopiert nur Zeilen, deren `id` im Ziel fehlt oder deren `updatedAt` neuer ist; alte Tabellen bleiben im Schema (versteckt), Entfernung frühestens zwei Minor-Versionen später. Fixture-Tests mit Backups aus 0.3.1.
3. **Tools-ID-Migration** in `core/tools/layout.ts` (`enabled/order` alte → neue IDs).

## 21 · Geprüfte Fakten zum Core (Grundlage für Migration und Risiken)
| Verhalten | Fundstelle | Folge für den Plan |
|---|---|---|
| Sync-Pull: Ops für unbekannte Tabellen werden **still übersprungen**, der Cursor läuft weiter – die Daten kommen nie wieder | `core/storage/dexie.ts:78-81`, `core/sync/engine.ts:117-120` | Eine stillgelegte Tabelle darf **nicht** aus dem Schema fallen, solange ein altes Gerät noch synchronisiert |
| Server nimmt jeden Tabellennamen an (Regex), keine Allow-Liste | `server/src/app.ts:77`, `store.ts:172-210` | Altes Handy schreibt weiter `reminders_reminder`; neuer Client muss das nach dem Pull „vorwärts kopieren“ |
| Dexie löscht beim Versionswechsel fehlende Stores **samt Daten**; nur eine Version deklariert | `core/db/db.ts:14`, Dexie `deleteRemovedTables` | Tabelle entfernen = lokaler Datenverlust ohne vorherige Kopie |
| `schema-upgrade.test.ts:111` verlangt, dass **jede historische Tabelle überlebt** | `core/db/schema-upgrade.test.ts` | Tabellen-Entfernung ist heute per Test verboten; Aufhebung ist eine bewusste Entscheidung (Frage 2) |
| Backup-Import überspringt unbekannte Tabellen (`skippedTables`); Export enthält `_settings`, `_modules`, alle synchronisierten Sammlungen | `core/backup/apply.ts:35-44`, `schema.ts:50-63` | Alte Backups bleiben nur vollständig einspielbar, wenn stillgelegte Tabellen bekannt bleiben |
| `remove` setzt Tombstone **und pusht** (andere Geräte löschen); `purge` nur für lokale Sammlungen | `core/db/repo.ts:144-177, 252-255` | Migration darf alte Zeilen nie per `remove` aufräumen |
| `manifest.migrations` nur eigene Sammlungen, pro Gerät, erst-gesehen = aktuell; keine App-Migration | `core/modules/migrate.ts`, `startup.ts:16-18` | App-Migration (Abschnitt 20.2) ist neu zu bauen; Vorbild: Lazy-Migration `home/layout.ts` (`LEGACY_DASHBOARD_SCOPE`, nie gelöscht) |
| Unbekannte Modul-IDs in `_modules`, Home-Layout, Tools-Settings werden ignoriert, nicht entfernt | `activation.ts:31-37`, `home/layout.ts:104-111` | Entfernen ist startsicher; alte Pfade (`/reminders`) landen auf NotFound → Umleitungen nötig |
| Benachrichtigungs-Beitrag: `NotificationSource(range) → DueNotification{key, at, title, body?, url?}` | `core/modules/types.ts:203-226`, `reminders/notifications.ts` | Kalender braucht `contributions.notifications` + `event.notify`; Wiederholung ist bereits ein gemeinsames Schema (`core/recurrence`) |
| Finanzen/Budgets haben Tabs per `?tab=` + `Segmented`; kein Gruppenkonzept in Router/Nav/Übersicht | `FinancePage.tsx:13-72`, `router.tsx:25-42`, `useNavItems.ts` | `manifest.group` ist Neubau in drei Dateien (Hotspots) |
| IDs fest verdrahtet in: `exclusion.test.ts:81-88` (Liste ohne aiSchema), `e2e/a11y.spec.ts` (MODULES/PAGES), `setup/profiles.ts` (+ Test), `core/ai/testing.ts:17`, `intent/parser.ts` (reminders), `quickCapture/targets/adapters.ts:50`, `dataapi.test.ts`, `moduleImporters.test.ts`, `contributions.test.ts`, e2e `modules/layout/extras/newmodules`, `screenshots/capture.spec.ts` | – | Checkliste für jedes Paket |
| Version 0.3.1; Pre-Release nur `alpha/beta/rc`; CHANGELOG 0.3.1 verspricht „keine Breaking Changes“; keine MAJOR-Regel dokumentiert | `package.json`, `core/update/semver.ts`, `CHANGELOG.md` | Breaking per `feat!:` kennzeichnen; MAJOR/MINOR ist Entscheidung (Frage 3) |

**Konsequenz – Stilllegungsregel (statt „Tabelle weg“):** Ein ersetztes Modul wird `retired`: keine Routen, Nav, Widgets, KI, Import-API, aber **Sammlungen bleiben im Schema**; die App-Migration kopiert vorwärts (beim Start, nach Sync-Pull, nach Backup-Import). Frühestens zwei Minor-Versionen später werden die Tabellen entfernt (dann `schema-upgrade.test` anpassen, Changelog-Hinweis „alle Geräte vorher aktualisieren“).

## 22 · Reihenfolge, Pakete, Abhängigkeiten
| Paket | Inhalt | Migration | Hängt ab von | Parallel möglich | Version |
|---|---|---|---|---|---|
| **1 Aufräumen** | `manifest.group` + Gruppe „Geld“ und „Listen“ (Einkauf, Packlisten, Vorräte als Tabs, Daten unverändert) · Nachrichten stilllegen (`retired`, Export-Hinweis) · Werkzeuge 18 → 12 + Rahmen · Notizen-Zettel (Kopie aus `tools.scratch`) · „Dieser PC“ (UI) · Funde 1–8, 11 · Umleitungen alter Pfade | nur Zettel (idempotent, eine Zeile) + Tools-IDs | – | – (berührt Hotspots Router/Nav/Settings: ein Chat) | 0.4.0, `feat!:` (Nachrichten) |
| **2 Übersicht-Aktionen (K1)** | Widget-Aktionen (abhaken, hinzufügen, Größe) generisch in `home/` + `WidgetList`; Module ToDos, Listen, Kalender ziehen nach | keine | 1 (Gruppen-Widgets) | ja, parallel zu 3 (andere Dateien: `home/`, Widgets) | 0.4.x / 0.5.0 |
| **3 Listen + Favoriten** | App-Migrations-Runner (20.2) · `lists` aus Einkauf + Packlisten · Favoriten in Merkliste aus Apps & Links · `shopping`, `packing`, `launcher` → `retired` | 3 Kopien, Fixture-Tests mit 0.3.1-Backups | 1 | zu 2 | 0.5.0, `feat!:` |
| **4 Unterlagen + Personen** | `vault` erweitern + Verträge-Kopie · `people` aus Geburtstage + Geschenke (Namensabgleich) · `contracts`, `birthdays`, `gifts` → `retired` | 3 Kopien | 3 (Runner) | zu 2 | 0.6.0, `feat!:` |
| **5 Zeit** | `event.notify` + Kalender-Benachrichtigungen · Erinnerungen-Kopie + Tab · Tier-1-Parser, Schnellerfassung, Teilen auf Kalender · ToDo-Wiederholung + Irgendwann · `reminders` → `retired` | 1 Kopie | 3 (Runner), 1 | nein (Kalender ist größtes Modul) | 0.7.0, `feat!:` |
| **6 Tabellen entfernen** | stillgelegte Tabellen aus dem Schema, `schema-upgrade.test` anpassen | Schema-Bump | alle Geräte ≥ 0.7 | – | 0.9.0 oder 1.0.0 |
| **Roadmap** | K3 Anhänge in Sync/Backup (Belege, Fotos) · S1 Passwort-Health · M2 Kalender Drag/Resize · M3 Budget-Übertrag · M4 Habits (eingefroren) · Zeiterfassung-Verknüpfung Timer | – | 4 (K3 braucht Unterlagen) | – | später |

Konflikt-Hotspots mit anderen Chats (CHATS.md: aktuell keine laufenden): Paket 1 berührt `router.tsx`, `useNavItems.ts`, `home/Home.tsx`, `core/modules/types.ts` (Manifest-Vertrag), `strings.ts`, `pages/Settings.tsx` – deshalb ein Chat, kein Parallelbetrieb mit Feature-Chats, bis Paket 1 gemergt ist. Pakete 3/4/5 berühren `core/db/schema*.json` (immer `db:bump` nach Merge von `develop` neu laufen lassen).

## 23 · Risiken
| Risiko | Wo | Gegenmaßnahme (wird harte Regel im Prompt) |
|---|---|---|
| Datenverlust lokal | Tabelle aus Schema → Dexie löscht Daten | Stilllegungsregel: Tabellen bleiben; Entfernung erst Paket 6 |
| Datenverlust über Sync | neuer Client überspringt Ops alter Tabellen | Tabellen bleiben; Vorwärtskopie nach jedem Pull; Tests mit `MemoryServer` (alt → neu) |
| Lösch-Lawine | Migration „räumt auf“ per `remove` → Tombstones auf allen Geräten | Kopie statt Verschiebung; nie `remove` auf Quell-Tabellen |
| Backup alt → App neu | unbekannte Tabellen werden übersprungen | Tabellen bleiben; Migration läuft nach Import; Fixture-Backups aus 0.3.1 im Repo |
| Doppelte Daten | Migration läuft auf jedem Gerät | gleiche `id` in Quelle und Ziel, `updatedAt`-Vergleich → idempotent; Geschenk-Personen per deterministischer id `person-<slug>` |
| Benachrichtigungen fallen aus | Scheduler-Cursor + `key` wechseln von `reminder:` auf `event:` | gleiche Key-Konvention beibehalten oder Cursor einmalig setzen; `notifications.spec` erweitern |
| KI/Import-API | aiSchema, Intent-Parser, Import-Format, lokale API-Rechte je Modul-ID, MCP-Doku | `privacy.test`, `AI-IMPORT.md` (muss `buildApiPrompt` gleichen), Rechte für stillgelegte IDs verweigern |
| Kompatibilität Handy auf alter Version | schreibt in stillgelegte Tabellen, sieht neue Sammlungen nicht | Übergangsfenster: 1 Minor; Update-Banner-Hinweis; CHANGELOG „Breaking“ je Paket |
| Versionsversprechen | CHANGELOG 0.3.1 „keine Breaking Changes“ | ab 0.4.0 ausdrücklich `feat!:`; Entscheidung MINOR-Kette vs. 1.0.0 (Frage 3) |
| Tests mit festen Listen | Abschnitt 21, letzte Zeile | Checkliste je Paket im Prompt; `exclusion.test` Liste pflegen (`retired` Module ohne aiSchema) |

## 24 · Fragen Runde 3
Siehe Chat; Antworten → Abschnitt 10.
