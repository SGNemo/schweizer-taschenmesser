# Modul- und Werkzeugplan – Nemo (Zielbild B, beschlossen 2026-10-01)

Herleitung und Begründung: [MODULE-REVIEW-2026-10-01.md](MODULE-REVIEW-2026-10-01.md). Umsetzung: [IMPLEMENTATION-PROMPT.md](IMPLEMENTATION-PROMPT.md). Status: **geändert** = Modul bleibt (ID gleich), **neu** = neue ID, **zusammengelegt** = Daten werden kopiert, **Gruppe** = nur UI, **stillgelegt** = unsichtbar, Tabellen bleiben bis Paket 6, **entfernt** = Code weg.

## Module (Ziel: 9 Nav-Einträge + „Dieser PC“ am Desktop)
| Nav-Eintrag | Modul-ID(s) | Umfang | Status | Prio | Paket |
|---|---|---|---|---|---|
| Kalender | `calendar` ← `reminders` | Termine mit `kind` (Termin/Erinnerung) und `notify`; Tab „Erinnerungen“; Benachrichtigungen; 8 Vorlagen; Monat/Woche/Tag; externe Kalender | zusammengelegt | hoch | 5 |
| ToDos | `todos` | Listen, Priorität, Fällig, Unteraufgaben, **Wiederholung**, **Irgendwann**, Abhaken im Widget | geändert | hoch | 2 (Widget), 5 (Wiederholung) |
| Geld | Gruppe `money`: `finance`, `invoices`, `subscriptions`, `budgets` | Tabs Übersicht · Buchungen · Rechnungen · Abos · Budgets · Konten; Abo-Erinnerungszeit als Setting; Abo-Kachel-Fix | Gruppe | hoch | 1 |
| Listen | Gruppe `household`: **`lists`** (neu, ← `shopping`, `packing`), `pantry` | Listenarten Einkauf / Packliste / Checkliste, Vorlagen; Vorräte als Tab unverändert | neu + zusammengelegt; `pantry` geändert | hoch | 1 (Gruppe), 3 (`lists`) |
| Notizen | `notes` ← Werkzeug `scratch` | fester „Zettel“ (id `scratch`, Widget), Checklisten im Text, Anheften, Suche, StartDataButton | geändert | hoch | 1 |
| Merkliste | `bookmarks` ← `launcher` | Arten + **Favorit** (Kacheln, Gruppen per Tag), Browser-Import, Teilen-Ziel | geändert, `launcher` zusammengelegt | hoch | 3 |
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
| `manifest.group {id, name, icon, order}` | 1 | ein Nav-Eintrag + Tab-Seite je Gruppe; Umleitung alter Pfade; Bibliothek eingerückt; optionales Gruppen-Widget |
| `manifest.retired: true` | 1 | Modul ohne Routen/Nav/Widget/KI/Import-API, Sammlungen bleiben im Schema; `exclusion.test` und `BLOCKED_MODULES` kennen den Zustand |
| Widget-Aktionen (`WidgetList` + `home/`) | 2 | abhaken, hinzufügen, Größe direkt im Widget |
| App-Migration `core/db/appMigrations.ts` | 3 | idempotente Vorwärtskopie (gleiche `id`, `updatedAt`-Vergleich), läuft nach DB-Öffnen, Sync-Pull, Backup-Import; Fixture-Tests mit 0.3.1-Backups |
| `event.notify` + Kalender-`notifications` | 5 | Termin-Benachrichtigungen (Voraussetzung Erinnerungen) |

## Pakete
| # | Name | Version | Breaking | Hängt ab von |
|---|---|---|---|---|
| 1 | Aufräumen (Gruppen, Stilllegen, Werkzeuge, Zettel, Dieser PC, Funde) | 0.4.0 | ja (Nachrichten, Habits, Zeiterfassung unsichtbar) | – |
| 2 | Übersicht-Aktionen (K1) | 0.4.x/0.5.0 | nein | 1 |
| 3 | Listen + Favoriten (+ Migrations-Runner) | 0.5.0 | ja | 1 |
| 4 | Unterlagen + Personen | 0.6.0 | ja | 3 |
| 5 | Zeit (Erinnerungen → Kalender, ToDo-Wiederholung) | 0.7.0 | ja | 3 |
| 6 | Tabellen entfernen | 0.9.0 / 1.0.0 | ja (alle Geräte ≥ 0.7) | 5 |
| 7 | Passwort-Health (S1) | nach 6 oder parallel ab 4 | nein | – |
Roadmap (ohne Termin): K3 Anhänge in Sync/Backup, M2 Kalender Drag/Resize, M3 Budget-Übertrag, Nachrichten als optionale Erweiterung, Timer ↔ Zeiterfassung (entfällt).
