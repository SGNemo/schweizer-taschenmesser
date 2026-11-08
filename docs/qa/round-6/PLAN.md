# UI schärfen, Runde 6 – Liste und Plan (Vorschlag an Sven)

Quelle: [FINDINGS.md](FINDINGS.md) (S01–S09), [U-A](U-A-abbruch.md), [U-H](U-H-hierarchie.md), [U-K](U-K-kosmetik.md), Abgleich mit dem Reviewer in FINDINGS.md „Reviewer“. Sortierung: Svens Stellen zuerst, dann Abbruch-relevant, dann Hierarchie/Identität, dann Kosmetik. Status wird in Phase 5 nachgetragen.

## Diese Runde (S und M, kein Vertrag) – nach Bereich = Umsetzer-Branch

| Bereich / Branch | Funde | Aufwand | Hinweis |
| --- | --- | --- | --- |
| `fix/ui6-ui` (**einziger `ui/`-Umsetzer**, läuft zuerst) | S02 Dialog-Identität · U07 `FileField` · U20 Kachel-Ausrichtung · U23b `GroupedList columns` Listen-Markup · U28 Raster (Segment 3 px, Kopf 36,8 px) · U34 Toolbar-Umbruch | M+M+S+S+S+S | S02 und U07 ändern `ui/`-Bausteine additiv → **Council vor dem PR**; alle anderen Umsetzer nutzen danach `FileField` und das neue Grid-Alignment |
| `fix/ui6-calendar-views` | S03 Monat als Zeilen · S04 Woche (Ganztags-Bereich begrenzen, Quellen-Filter) · U25 Handy-Toolbar | M+M+M | größtes Paket; Vorher/Nachher je Ansicht |
| `fix/ui6-calendar-small` | U05 Handy-Wochenliste · U08 rote Art-Badges · U15 doppeltes „Neuer Termin“ · U16 h2-Größen · U17 Bandhöhe Erinnerungen · U27a Chips im Termin-Dialog · U35 Raster fokussierbar | 7 × S | kann parallel zu `calendar-views` starten, andere Dateien (Agenda, Reminders, EventEditor) |
| `fix/ui6-layout` | U01 Layout-Shift (Band im Fallback, Slot-Breite) · U06 Einrichtung-Fußzeile sticky · U24 `fokus`-Kopf am Handy | M+S+S | U01 ist die größte Einzelwirkung („nichts springt beim Laden“) |
| `fix/ui6-home-settings` | U19 Übersichtsraster dicht · U03 Kurzkarten-Umbruch · U31 Nav-Status · U32 Bibliothekskarten-Fuß | M+S+S+S | – |
| `fix/ui6-modules-plan` | U02 ToDos Teilschritt-Strich · U21 ToDos Handy-Zeilenaktion · U26 Leerzustände mit Verb (ToDos, Gewohnheiten, Agenda-Text) · U09 Gewohnheiten Primäre · U10 Zeiterfassung leer · U30 Zeiterfassung-Widget | 6 × S | – |
| `fix/ui6-modules-household-money` | S01 Vorräte-Stepper · U12 Listen Primäre + Trenner · U13 Finanzen Konten · U18 Abos Akzent · U14 Karten & Orte Primär je Reiter | 5 × S | S01 wartet auf U20 (Kachelhöhe) oder löst es lokal |
| `fix/ui6-modules-knowledge-system` | U22 Notizen Steuerzeilen · U04 Browser-Kacheln · U23a Feeds-Serif · U33 Lesezeichen-Widget · U11 Downloads Primäre + BitTorrent-Block · U29 Downloads-Einrückung · U27b Unterlage-Dialog-Reihe | M + 6 × S | – |

Reihenfolge (höchstens drei gleichzeitig): Welle 1 `ui`, `calendar-views`, `layout` · Welle 2 `home-settings`, `modules-plan`, `modules-household-money` · Welle 3 `calendar-small`, `modules-knowledge-system`. Jeder Umsetzer: Repro/Snapshot-Test zuerst, kleinster Fix, Tokens, keine neuen Varianten, Fokus-Checkliste, de/en, `.changes/`, CHATS-Zeile; `review loop` vor `file-pr`.

## Später

| Was | Grund | Wohin |
| --- | --- | --- |
| S05 Planer-Einstiege („In den Plan“ aus ToDos, Rechnungen …), S08 Board-Kästchen, S09 „Eintragen“ versetzt, T03 Spaltenhöhen | Sven: Planer wird gerade bearbeitet – nach dem Rest | Board-Notiz an den Planer-Chat (`modules/planner/**`) |
| S06 Haushalt/Wissen/Tresor, S07 Dieser PC | Konzept, neue Module/Rust-Pakete | [CONCEPTS-S06-S07.md](CONCEPTS-S06-S07.md), je Paket eigener Chat |
| T01 E-Mail (zweites Zahnrad, zwei Primäre), T02 Schnellerfassung (13 Chips), T05 Einrichtung Frage 3 (Textmenge) | Tabu-Bereiche | Board an `modules/mail/**`, `quickCapture/**`, `core/setup/**` |
| U07 Aufrufstellen in Werkzeugen (`tools/image`, `tools/pdf`), RecoveryScreen | nach dem Baustein, eigener kleiner PR | `fix/ui6-filefield-rest` |

## Fragen an Sven (max. 4, Empfehlung zuerst)

1. **S02 Dialog-Identität:** (a) Kopfzone mit Modulfarbe, Icon-Plate und Signatur-Marke, Hairline darunter – **empfohlen**; (b) nur Icon-Plate neben dem Titel; (c) lassen.
2. **S03 Monatsansicht:** (a) Einträge als Zeilen (Art-Punkt + Titel, Zeit gedämpft, Fläche nur für eigene Termine/heute), tägliche Wiederholungen als eine Zeile – **empfohlen**; (b) Pillen behalten, nur Limit 3 und Wiederholungen bündeln.
3. **Umfang:** (a) alle S und M wie oben in acht PRs, drei Wellen – **empfohlen**; (b) nur Svens Stellen + Abbruch-relevante (A) jetzt, Rest später.
4. **U07 Dateifeld:** (a) Baustein `ui/FileField` + alle elf Stellen in dieser Runde – **empfohlen** (ein Baustein, ein Test); (b) nur Tresor, Notizen-Import, Backup jetzt.
