# Modul- und Werkzeugplan – Nemo (Zielbild B, beschlossen 2026-10-01)

Herleitung und Begründung: [MODULE-REVIEW-2026-10-01.md](MODULE-REVIEW-2026-10-01.md). Umsetzung: [IMPLEMENTATION-PROMPT.md](IMPLEMENTATION-PROMPT.md). Status: **geändert** = Modul bleibt (ID gleich), **neu** = neue ID, **zusammengelegt** = Daten werden kopiert, **Gruppe** = nur UI, **stillgelegt** = unsichtbar, Tabellen bleiben bis Paket 6, **entfernt** = Code weg.

## Module (Ziel: 9 Nav-Einträge + „Dieser PC“ am Desktop)
| Nav-Eintrag | Modul-ID(s) | Umfang | Status | Prio | Paket |
|---|---|---|---|---|---|
| Kalender | `calendar` ← `reminders` | Termine mit `kind` (Termin/Erinnerung) und `notify`; Tab „Erinnerungen“; Benachrichtigungen; 8 Vorlagen; Monat/Woche/Tag; externe Kalender | zusammengelegt | hoch | 5 |
| ToDos | `todos` | Listen, Priorität, Fällig, Unteraufgaben, **Wiederholung**, **Irgendwann**, Abhaken im Widget | geändert | hoch | 2 (Widget), 5 (Wiederholung) |
| Geld | Bereich `money` (Design): `finance`, `invoices`, `subscriptions`, `budgets` | Bereichsseite mit Unterreitern (Design-PR 2); Abo-Erinnerungszeit als Setting; Abo-Kachel-Fix | Bereich | hoch | Design 2 (Bereich), 1 (Fixes) |
| Listen (Bereich Haushalt) | **`lists`** (neu, ← `shopping`, `packing`), `pantry` | Listenarten Einkauf / Packliste / Checkliste, Vorlagen; Vorräte unverändert im selben Bereich | neu + zusammengelegt; `pantry` geändert | hoch | 3 |
| Notizen | `notes` ← Werkzeug `scratch` | fester „Zettel“ (id `scratch`, Widget), Checklisten im Text, Anheften, Suche, StartDataButton | geändert | hoch | 1 |
| Merkliste | `bookmarks` ← `launcher` | Arten + **Lesezeichen** (Kacheln, Gruppen per Tag; Name offen, s. Review 25), Browser-Import, Teilen-Ziel | geändert, `launcher` zusammengelegt | hoch | 3 |
| Personen | **`people`** (neu) ← `birthdays`, `gifts` | Person (Geburtstag, Notiz, Tags), Geschenke je Person; Alter, WhatsApp, Kalender-Items, Erinnerung; Geschenke KI-unsichtbar | neu + zusammengelegt | mittel | 4 |
| Unterlagen | `vault` (UI-Name neu) ← `contracts` | Dokument mit Kategorie, Anbieter, Laufzeit, Kündigungsfrist, Datei (lokal bis K3); Fristen im Kalender + Erinnerung; Mail-Scan | geändert, `contracts` zusammengelegt | mittel | 4 |
| Accounts | `accounts` | unverändert; mobile Kopfzeile; später Passwort-Health | geändert (klein) | hoch | 1 (Fix), 7 (S1) |
| Dieser PC (Desktop) | `disk` ← `system` (UI) | Tabs Laufwerke · System; Rust unverändert | geändert, `system` entfernt (UI) | mittel | 1 |
| – | `news` | Modul, `core/ai/newsBrief.ts`, Startpaket, `e2e/news.spec.ts` | stillgelegt (Code weg, Tabellen bleiben bis 6) | – | 1 |
| – | `habits`, `timetrack` | ungenutzt; Daten bleiben exportierbar | stillgelegt | – | 1 |
| – | `reminders`, `shopping`, `packing`, `launcher`, `birthdays`, `gifts`, `contracts` | nach Kopie | stillgelegt | – | 3–5 |
| – | alle stillgelegten Tabellen | aus dem Schema, `schema-upgrade.test` anpassen | entfernt | – | 6 |
| – | `example` (Dev) | unverändert | – | – | – |

Nav mobil: Übersicht · Kalender · ToDos · Geld · Mehr. Bibliothek: Gruppen mit eingerückten Teilmodulen, jedes einzeln abschaltbar.

## Werkzeuge (Ziel: 12)
| Werkzeug | Aus | Status | Paket |
|---|---|---|---|
| Rechner (Modi Ausdruck · Prozent/MwSt · Teilen) | `calc`, `percent`, `split` | zusammengelegt (ID `calc`) | 1 |
| Entwickler (Tabs Base64/URL · JSON · UUID · Hash) | `base64`, `json`, `uuid`, `hash` | zusammengelegt (ID `dev`) | 1 |
| Notizzettel | `scratch` | entfernt → Notizen „Zettel“ | 1 |
| Währung, Timer & Stoppuhr, QR-Code, Einheiten, Datumsrechner, Zeitzonen, Würfel & Zufall, Text, Bilder, PDF | – | unverändert (Dateiwähler als Button) | 1 |
| Rahmen | – | Route `/tools/:id`, Palette, Kürzel, Dialog bis 900 px, „Zurück“ in Kopfzeile, Settings-ID-Migration | 1 |

## Neue Core-Bausteine
| Baustein | Paket | Zweck |
|---|---|---|
| `manifest.area` (Design-PR 2, nicht dieser Plan) | Design 2 | Bereiche Planen · Geld · Haushalt · Wissen · Tresor · System; ersetzt das hier zuvor geplante `manifest.group` (Review Abschnitt 25) |
| `manifest.retired: true` | 1 | Modul ohne Routen/Nav/Widget/KI/Import-API, Sammlungen bleiben im Schema; `exclusion.test` und `BLOCKED_MODULES` kennen den Zustand |
| Widget-Aktionen (`WidgetList` + `home/`) | Design 4 | abhaken, bezahlt, snoozen, Größe – liegt im Design-PR 4; Paket 2 dieses Plans entfällt |
| App-Migration `core/db/appMigrations.ts` | 3 | idempotente Vorwärtskopie (gleiche `id`, `updatedAt`-Vergleich), läuft nach DB-Öffnen, Sync-Pull, Backup-Import; Fixture-Tests mit 0.3.1-Backups |
| `event.notify` + Kalender-`notifications` | 5 | Termin-Benachrichtigungen (Voraussetzung Erinnerungen) |

## Pakete
| # | Name | Version | Breaking | Hängt ab von |
|---|---|---|---|---|
| D1, D2 | Design-PRs Tokens, Shell + Bereiche (`docs/design/IMPLEMENTATION-PROMPT.md`) | – | nein | – |
| 1 | Aufräumen (Stilllegen, Werkzeuge, Zettel, Dieser PC, Funde) | 0.4.0 | ja (Nachrichten, Habits, Zeiterfassung unsichtbar) | D2 |
| D3, D4 | Design-PRs Komponenten, Home (enthält die Übersicht-Aktionen; Paket 2 entfällt) | – | nein | D1, 1 |
| 3 | Listen + Lesezeichen (+ Migrations-Runner); neue Module im neuen Stil | 0.5.0 | ja | 1, D3 |
| 4 | Unterlagen + Personen (neuer Stil) | 0.6.0 | ja | 3 |
| D5a–5d | Design-Modul-PRs nur für bleibende Module (5b = Kalender, ToDos; 5c = Vorräte, Notizen, Merkliste; 5d ohne Systeminfo) | – | nein | D2, D3 |
| 5 | Zeit (Erinnerungen → Kalender, ToDo-Wiederholung) | 0.7.0 | ja | 3 |
| 6 | Tabellen entfernen | 0.9.0 / 1.0.0 | ja (alle Geräte ≥ 0.7) | 5 |
| 7 | Passwort-Health (S1) | nach 6 oder parallel ab 4 | nein | – |
Abgleich mit der Design-Spezifikation: Review Abschnitt 25.
Roadmap (ohne Termin): K3 Anhänge in Sync/Backup, M2 Kalender Drag/Resize, M3 Budget-Übertrag, Nachrichten als optionale Erweiterung, Timer ↔ Zeiterfassung (entfällt).
