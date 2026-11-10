# UI schärfen, Runde 6 – Liste und Plan (Vorschlag an Sven)

Quelle: [FINDINGS.md](FINDINGS.md) (S01–S09), [U-A](U-A-abbruch.md), [U-H](U-H-hierarchie.md), [U-K](U-K-kosmetik.md), Abgleich mit dem Reviewer in FINDINGS.md „Reviewer“. Sortierung: Svens Stellen zuerst, dann Abbruch-relevant, dann Hierarchie/Identität, dann Kosmetik. Stand je Fund nach den Merges: [STATUS.md](STATUS.md).

## Diese Runde (S und M, kein Vertrag) – nach Bereich = Umsetzer-Branch

| Bereich / Branch | Funde | Aufwand | Hinweis |
| --- | --- | --- | --- |
| `fix/ui6-ui` (**einziger `ui/`-Umsetzer**, läuft zuerst) | S02 Dialog-Identität · U07 `FileField` · U20 Kachel-Ausrichtung · U23b `GroupedList columns` Listen-Markup · U28 Raster (Segment 3 px, Kopf 36,8 px) · U34 Toolbar-Umbruch · U40 Widget-Links neutral · U43 Ghost-Einzug · U57 Wortumbruch (`hyphens` statt `anywhere`) | M+M+7 × S | S02 und U07 ändern `ui/`-Bausteine additiv → **Council vor dem PR**; alle anderen Umsetzer nutzen danach `FileField` und das neue Grid-Alignment |
| `fix/ui6-calendar-views` | S03 Monat als Zeilen · S04 Woche (Ganztags-Bereich begrenzen, Quellen-Filter) · U25 Handy-Toolbar | M+M+M | größtes Paket; Vorher/Nachher je Ansicht |
| `fix/ui6-calendar-small` | U05 Handy-Wochenliste · U08 rote Art-Badges · U15 doppeltes „Neuer Termin“ · U16 h2-Größen · U17 Bandhöhe Erinnerungen · U27a Chips im Termin-Dialog · U35 Raster fokussierbar · U58 Jahr-Monatsknöpfe 44 px | 8 × S | kann parallel zu `calendar-views` starten, andere Dateien (Agenda, Reminders, EventEditor) |
| `fix/ui6-layout` | U01 Layout-Shift (Band im Fallback, Slot-Breite) · U06 Einrichtung-Fußzeile sticky · U24 `fokus`-Kopf am Handy · U59 Einrichtung Benachrichtigungs-Schritt ein Primär | M+3 × S | U01 ist die größte Einzelwirkung („nichts springt beim Laden“) |
| `fix/ui6-home-settings` | U19 Übersichtsraster dicht · U39 leere Widgets niedriger · U49 „Jetzt wichtig“-Kante · U03 Kurzkarten-Umbruch · U31 Nav-Status · U54 Darstellung-Reiter/Werte · U55 Status-Kacheln Handy · U32 Bibliotheks-/Werkzeugkarten | M+7 × S | – |
| `fix/ui6-modules-plan` | U02 ToDos Teilschritt-Strich · U21 ToDos Handy-Zeilenaktion · U48 Board-Spalte/„Auf morgen“ · U26 Leerzustände mit Verb (ToDos, Gewohnheiten, Agenda, Rechnungen) · U09 Gewohnheiten Primäre · U10 Zeiterfassung leer · U30 Zeiterfassung-Widget · U47 Personen-Meta | 8 × S | – |
| `fix/ui6-modules-household-money` | S01 Vorräte-Stepper + Toolbar · U12 Listen Primäre + Trenner · U13 Finanzen Konten · U42 Finanzen Saldo/Kurve · U18 Abos rote Frist → warning · U56 Abos Probezeit-Badge · U44 Budgets Navigation/Chips · U14 Karten & Orte Primär je Reiter | 8 × S | S01 wartet auf U20 (Kachelhöhe) oder löst es lokal |
| `fix/ui6-modules-knowledge-system` | U22 Notizen Steuerzeilen · U04 Browser-Kacheln · U37 Browser-Kopfmarke · U23a Feeds-Serif · U50 Feeds-Widget · U33 Lesezeichen-Widget · U51 Musik-Doppelung · U52 Chat-Checkbox · U38 Chat-Beispiel im leeren Profil · U11 Downloads Primäre + BitTorrent-Block · U29 Downloads-Einrückung · U27b/U53 Unterlagen | M + 11 × S | – |

Reihenfolge (höchstens drei gleichzeitig): Welle 1 `ui`, `calendar-views`, `layout` · Welle 2 `home-settings`, `modules-plan`, `modules-household-money` · Welle 3 `calendar-small`, `modules-knowledge-system`. Jeder Umsetzer: Repro/Snapshot-Test zuerst, kleinster Fix, Tokens, keine neuen Varianten, Fokus-Checkliste, de/en, `.changes/`, CHATS-Zeile; `review loop` vor `file-pr`.

## Später

| Was | Grund | Wohin |
| --- | --- | --- |
| **U41 Kopfbandhöhen** (hohe Köpfe 200–292 px, kompakte 114–236 px statt 200/96 px; Inhalt skaliert in die Höhe) | betrifft 20 Modulköpfe und Entscheidungen aus den Identitätspaketen (ToDo-Fokuskarte, Finanz-Konten, Karten-Kacheln) – eigenes Paket mit Mockup und Stopp | `fix/ui6-head-heights` nach dieser Runde (Frage 4) |
| S05 Planer-Einstiege („In den Plan“ aus ToDos, Rechnungen …), S08 Board-Kästchen, S09 „Eintragen“ versetzt, T03 Spaltenhöhen | Sven: Planer wird gerade bearbeitet – nach dem Rest | Board-Notiz an den Planer-Chat (`modules/planner/**`) |
| S06 Haushalt/Wissen/Tresor, S07 Dieser PC | Konzept, neue Module/Rust-Pakete | [CONCEPTS-S06-S07.md](CONCEPTS-S06-S07.md), je Paket eigener Chat |
| T01 E-Mail (zweites Zahnrad, zwei Primäre), T02 Schnellerfassung (13 Chips), T05 Einrichtung Frage 3 (Textmenge) | Tabu-Bereiche | Board an `modules/mail/**`, `quickCapture/**`, `core/setup/**` |
| U07 Aufrufstellen in Werkzeugen (`tools/image`, `tools/pdf`), RecoveryScreen | nach dem Baustein, eigener kleiner PR | `fix/ui6-filefield-rest` |

## Antworten (2026-11-08, Sven)

1. S02 Dialog-Identität: **Kopfzone mit Modulfarbe, Icon-Plate und Signatur-Marke** (Council vor dem `ui`-PR; Entscheidungs-Bullet kommt mit dem PR nach `docs/decisions/ui-components.md`).
2. S03 Monatsansicht: **Zeilen statt Pillen** (Fläche nur für eigene Termine/heute, Wiederholungen gebündelt).
3. Umfang: **alle S und M, acht PRs in drei Wellen.**
4. U41 Kopfbandhöhen: **eigenes Paket danach** (`fix/ui6-head-heights`, Mockup + Stopp).

Start der Umsetzer nach dem Satz „Plan freigegeben“.

## Fragen an Sven (gestellt, beantwortet – siehe oben)

1. **S02 Dialog-Identität:** (a) Kopfzone mit Modulfarbe, Icon-Plate und Signatur-Marke, Hairline darunter – **empfohlen**; (b) nur Icon-Plate neben dem Titel; (c) lassen.
2. **S03 Monatsansicht:** (a) Einträge als Zeilen (Art-Punkt + Titel, Zeit gedämpft, Fläche nur für eigene Termine/heute), tägliche Wiederholungen als eine Zeile – **empfohlen**; (b) Pillen behalten, nur Limit 3 und Wiederholungen bündeln.
3. **Umfang:** (a) alle S und M wie oben in acht PRs, drei Wellen – **empfohlen**; (b) nur Svens Stellen + Abbruch-relevante (A) jetzt, Rest später.
4. **U41 Kopfbandhöhen:** (a) eigenes Paket nach dieser Runde mit Mockup und Stopp – **empfohlen** (20 Köpfe, berührt Identitätsentscheidungen); (b) jetzt mit in `fix/ui6-layout` (nur `height` statt Mindesthöhe, Inhalt wird beschnitten, wo er nicht passt); (c) lassen (Höhe darf dem Inhalt folgen – dann Regel in MODULE-IDENTITY anpassen).

U07 Dateifeld wird ohne Rückfrage als Baustein + alle elf Stellen umgesetzt (ein Baustein, ein Test); wenn du nur Tresor/Notizen/Backup willst, sag es im Freigabesatz.
