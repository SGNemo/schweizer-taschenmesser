# Messungen – UI-Audit 2026-11 und Abnahme 0b-8

Drei Teile: **Nachher – Abnahme 0b-8** (Vorher → Nachher, 2026-11-14), **Nachher – volle Tabellen** und **Vorher – Audit 2026-11** (die Tabellen des Audits, unverändert). Bewertung der Checkliste und Klickwege: [REPORT „Abnahme 0b-8“](REPORT.md#abnahme-0b-8-2026-11-14).

## Nachher – Abnahme 0b-8 (2026-11-14)

- **Stand:** `develop` 34c2de10c (alle Pakete bis 0b-7, 0b-E, 0b-R, die Modul-Pakete und die 0b-8-Themen B, C1–C6, D gemergt), 29 Module (neu: Uhr erstmals, Routinen, Gerätestatus). Seed `medium`, alle Module an, Desktop posiert als Windows-App wie im Audit. Acht Läufe: 1920×1080 und 412×915, hell und dunkel, Seed und leer.
- **Werkzeug korrigiert** ([tools/audit-tour.spec.ts](tools/audit-tour.spec.ts), Zeile 39 der 0b-8-Liste): Animationen ohne Kappung bei 10; `__cls` vor jedem Modul-Dialog und der Schnellerfassung auf 0 (vorher nur vor Palette und Werkzeug-Panel); Uhr, Routinen und Gerätestatus in der Tour; Haupt-Dialog über „<Ding> eintragen“; Chroma-Maß neben der Sättigung; nach dem Council: Tonstufen zählen in „getönt“ als neutral, Handy-Dialoge und Handy-Schnellerfassung über das Plus der Bottom-Bar, Kopf über `main [data-head]`, Fremd-Anfragen und WebSockets gesperrt. **Kopf px:** der Messpunkt des Audits (`[data-size]`) fand den 4.0-Kopf nicht; die Kopfhöhen der Desktop-Modulseiten stammen aus einem zweiten Durchgang mit `main [data-head]`. **Handy (Seed, hell und dunkel)** ist mit dem korrigierten Werkzeug ein zweites Mal gelaufen; die Handy-Zahlen hier stammen aus diesem Lauf. Vergleich: [tools/compare.mjs](tools/compare.mjs).
- **Nicht vergleichbar:** „Inhalt ab y“ des Audits auf Bibliothek, Werkzeugen und Einstellungen (93/169/174) maß Elemente in der Kopfkarte – dort steht „n/v“, und diese Seiten fehlen in den Medianen. **„getönt“ dunkel:** mit der Sättigung des Audits nicht lesbar (Desktop 281 → 573, hell 65; der Tonstufen-Abgleich des Werkzeugs änderte am Handy nichts – Lauf 1 und 2 beide 458 –, ungeprüft, ob er greift; die Quelle ist nicht verfolgt) – es zählt der helle Wert (Spalte „nachher hell“, alle Seiten). **Messlücken:** Tour nur auf Deutsch; Desktop-Dialoge im Lauf vor der Korrektur.
- **„Farbe Fläche“ im Dunkeln:** die Sättigung (max − min) / max wertet die leicht kühlen Grautöne des dunklen Themes als Farbe; deshalb steigt die Summe dunkel (870 → 995), während Chroma (max − min) / 255 hell und dunkel gleich zählt (Desktop 243 / 254, Handy 100 / 99, Tabelle „Sättigung vs. Chroma“). Antwort auf Svens Frage 1 zu #796: Chroma trägt in beiden Themes; Vorschlag für die Ratsche als Follow-up.
- **Layout-Sprung (Befund, eigener Fix-PR):** Wetter 0,62 (Desktop) / 0,86 (Handy) beim ersten Öffnen – der Hinweis über dem Kopf kommt nach den Daten und schiebt Kopf und Seite um 140–160 px; Listen 0,32 / 0,64 – die Zeilen erscheinen nach dem Eintragen-Feld; Chat am Handy (leer) 0,10 / 0,11 – ein Block erscheint über dem Verlauf. Nicht in jedem Lauf (Wetter: Desktop hell, Handy hell und dunkel; Listen: Desktop hell, Handy hell; Chat: Handy leer, hell und dunkel), in einer eigenen Nachmessung je Theme bestätigt. Musik am Handy hell 0,12 in einem Lauf. Handy-Werte aus dem zweiten Lauf; der erste Handy-Lauf (ohne Dialoge) ist verworfen. **Handy-Dialoge:** 18 über das Plus, dazu Notizen und Wetter über ihren Knopf; alle ohne Sprung, Unterlage und Fitness 805 px hoch bei 915 px Fenster, Termin 784, Routine 744. Sonst keine Seite mit CLS ≥ 0,05; Dialoge, Palette, Werkzeug-Panel und Schnellerfassung 0.
- **axe:** in allen acht Läufen keine Verletzung „serious“/„critical“. **Überlauf:** keiner.
- **Bewegung:** auf jeder Seite genau eine Animation (`pageCrossfade` beim Seitenwechsel); die Einblendung je Zeile (`itemIn`) ist weg. Die Einrichtungsschritte melden `transition: all` mit 0,01 ms (Reduced-Motion-Wert, keine sichtbare Bewegung).
- **Rahmen:** nur noch in den zwei Signatur-Blöcken (Vorräte 14, Unterlagen 34) und je einer auf Einstellungen → Sync, Verbindungen, Entwickler, Über und Übersicht „Ausführlich“, dazu einer in der Schnellerfassung. **Schatten:** einer (Wetter-Bühne).

### Kurzfassung vorher → nachher

| Lauf | Kennzahl | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Farbe Text | Farbe Fläche | Verläufe | Schriftgrößen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop 1920 dunkel, Seed | Median (Seiten in beiden Läufen) | 35 → 30 | 16 → 8 | 543 → 258 | 163 → 84 | 4 → 1 | 17 → 20 | 2 → 0 | 7 |
| Desktop 1920 dunkel, Seed | Summe | 1715 → 1487 | 809 → 477 | – | – | 204 → 86 | 870 → 995 | 110 → 32 | 339 → 338 |
| Handy 412 dunkel, Seed | Median (Seiten in beiden Läufen) | 14 | 11 → 8 | 642 → 282 | 208 → 96 | 2 → 1 | 5 → 6 | 2 → 0 | 7 |
| Handy 412 dunkel, Seed | Summe | 638 → 722 | 490 → 449 | – | – | 103 → 45 | 313 → 375 | 83 → 22 | 290 → 310 |
| Desktop 1920 dunkel, leer | Median (Seiten in beiden Läufen) | 18 → 12 | 14 → 7 | 415 → 256 | 163 → 84 | 2 → 1 | 10 → 6 | 2 → 0 | 6 |
| Desktop 1920 dunkel, leer | Summe | 1183 → 861 | 729 → 386 | – | – | 160 → 56 | 604 → 646 | 77 → 11 | 290 |

### Reizlast vorher → nachher – Desktop 1920 dunkel, Seed

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Farbe Text | Farbe Fläche | Verläufe | Schriftgrößen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 147 → 163 | 25 → 16 | 506 → 262 | 241 → 117 | 10 → 4 | 104 → 28 | 2 → 0 | 8 → 6 |
| planner | 48 → 19 | 20 → 6 | 559 → 158 | 211 → 69 | 4 → 2 | 20 → 13 | 2 → 0 | 8 → 7 |
| todos | 59 → 66 | 21 → 16 | 589 → 202 | 240 → 117 | 2 → 4 | 16 → 33 | 2 → 0 | 8 |
| habits | 22 → 20 | 14 → 8 | 436 → 232 | 231 → 117 | 2 | 3 → 5 | 2 → 0 | 7 |
| timetrack | 19 → 14 | 18 → 12 | 460 → 325 | 233 → 117 | 2 | 10 → 12 | 2 → 0 | 6 → 7 |
| weather | 11 → 3 | 11 → 3 | 105 | 304 → 174 | 5 | 21 → 46 | 5 → 4 | 9 |
| maps | 39 → 31 | 23 → 15 | 671 → 366 | 274 → 117 | 2 | 16 → 28 | 2 → 0 | 8 → 5 |
| people | 64 → 48 | 16 → 11 | 479 → 266 | 146 → 117 | 2 → 3 | 4 → 8 | 26 → 17 | 7 → 9 |
| fitness | 23 | 16 → 13 | 546 → 250 | 233 → 117 | 2 | 3 → 9 | 2 → 0 | 8 → 7 |
| finance | 28 | 21 → 14 | 687 → 304 | 292 → 117 | 9 → 2 | 6 → 35 | 4 → 1 | 9 → 8 |
| invoices | 37 → 32 | 16 → 11 | 415 → 250 | 146 → 117 | 5 | 13 → 21 | 2 → 0 | 9 → 8 |
| subscriptions | 33 → 30 | 9 → 3 | 491 → 196 | 261 → 69 | 4 | 26 → 13 | 4 → 0 | 8 → 7 |
| budgets | 18 → 13 | 12 → 7 | 502 → 258 | 233 → 117 | 3 | 25 → 13 | 2 → 0 | 6 → 7 |
| lists | 36 → 47 | 21 → 11 | 714 → 303 | 237 → 117 | 2 | 8 → 16 | 2 → 0 | 8 → 6 |
| pantry | 49 → 54 | 11 → 6 | 543 → 243 | 233 → 117 | 6 | 23 | 2 → 0 | 9 → 8 |
| bookmarks | 48 → 55 | 15 → 7 | 574 → 306 | 249 → 117 | 2 | 4 → 3 | 2 → 0 | 9 → 6 |
| notes | 35 → 31 | 35 → 31 | – | 142 → 69 | 2 → 1 | 13 → 12 | 2 → 0 | 8 |
| chat | 13 → 6 | 12 → 5 | 368 → 154 | 163 → 69 | 1 | 9 → 5 | 2 → 0 | 5 → 6 |
| browser | 28 → 22 | 16 → 11 | 554 → 484 | 118 → 69 | 0 | 2 → 14 | 1 → 0 | 7 |
| feeds | 26 → 18 | 14 → 6 | 634 → 202 | 233 → 69 | 1 | 11 → 5 | 2 → 0 | 9 → 6 |
| mail | 27 → 31 | 20 → 14 | 710 → 461 | 141 → 69 | 1 → 0 | 5 → 11 | 1 → 0 | 9 → 7 |
| music | 26 → 19 | 24 → 17 | 599 → 491 | 363 → 132 | 0 → 1 | 7 → 2 | 2 → 1 | 6 → 7 |
| vault | 35 → 40 | 17 → 13 | 634 → 355 | 233 → 117 | 13 → 11 | 25 → 33 | 2 → 0 | 9 → 7 |
| accounts | 5 → 3 | 5 → 3 | – | 141 → 69 | 1 → 0 | 3 | 2 → 0 | 5 |
| disk | 10 → 9 | 4 → 2 | 502 → 265 | 238 → 117 | 3 → 2 | 2 → 5 | 1 → 0 | 9 |
| downloads | 18 → 16 | 10 → 8 | 415 → 256 | 165 → 69 | 2 → 1 | 7 | 1 → 0 | 5 → 7 |
| clock | neu 14 | neu 14 | – | neu 69 | neu 1 | neu 3 | neu 0 | neu 6 |
| routines | neu 12 | neu 6 | neu 250 | neu 117 | neu 2 | neu 3 | neu 0 | neu 7 |
| device | neu 8 | neu 1 | neu 154 | neu 69 | neu 0 | neu 1 | neu 0 | neu 5 |
| library | 17 → 20 | 6 | n/v → 93 | 223 | 1 → 0 | 56 → 70 | 3 | 7 |
| library-vault | 4 | 4 | n/v → 145 | 133 | 0 | 11 → 13 | 2 → 1 | 6 |
| tools | 24 → 23 | 4 | n/v → 185 | 207 → 84 | 1 → 0 | 22 → 19 | 1 → 0 | 7 → 5 |
| settings | 36 → 34 | 12 | n/v → 93 | 368 → 200 | 4 → 0 | 19 → 26 | 1 | 6 → 5 |
| settings-einrichtung | 35 → 25 | 19 → 8 | n/v → 294 | 133 → 84 | 5 → 1 | 19 → 20 | 2 → 1 | 7 → 8 |
| settings-allgemein | 45 → 37 | 18 → 9 | n/v → 265 | 133 → 84 | 5 → 1 | 17 → 20 | 1 → 0 | 6 → 7 |
| settings-darstellung | 67 → 58 | 46 → 36 | n/v → 265 | 133 → 84 | 22 → 5 | 34 → 56 | 1 → 0 | 6 → 7 |
| settings-barrierefreiheit | 42 → 39 | 23 → 19 | n/v → 357 | 133 → 84 | 9 → 0 | 18 → 27 | 1 → 0 | 7 → 8 |
| settings-module | 47 → 33 | 13 → 2 | n/v → 357 | 133 → 84 | 5 → 0 | 35 → 33 | 1 → 0 | 7 → 8 |
| settings-werkzeuge | 64 → 41 | 48 → 24 | n/v → 357 | 133 → 84 | 4 → 0 | 30 → 33 | 1 → 0 | 6 → 7 |
| settings-benachrichtigungen | 44 → 35 | 23 → 13 | n/v → 331 | 133 → 84 | 8 → 1 | 20 → 29 | 1 → 0 | 7 → 8 |
| settings-sicherheit | 41 → 31 | 25 → 14 | n/v → 331 | 133 → 84 | 7 → 0 | 17 → 22 | 1 → 0 | 5 → 6 |
| settings-sync | 32 → 24 | 16 → 7 | n/v → 331 | 133 → 84 | 4 → 0 | 18 → 22 | 1 → 0 | 7 → 8 |
| settings-ki | 40 → 31 | 16 → 6 | n/v → 265 | 133 → 84 | 6 → 2 | 20 → 25 | 1 → 0 | 7 → 8 |
| settings-verbindungen | 38 → 31 | 14 → 5 | n/v → 265 | 133 → 84 | 4 → 1 | 17 → 25 | 1 → 0 | 7 → 8 |
| settings-schnellerfassung | 33 → 23 | 17 → 6 | n/v → 294 | 133 → 84 | 4 → 0 | 18 → 24 | 1 → 0 | 8 → 9 |
| settings-updates | 29 → 19 | 13 → 2 | n/v → 331 | 133 → 84 | 4 → 0 | 17 → 20 | 1 → 0 | 6 → 7 |
| settings-entwickler | 34 → 24 | 18 → 7 | n/v → 331 | 133 → 84 | 5 → 1 | 17 → 19 | 1 → 0 | 7 → 8 |
| settings-ueber | 42 → 32 | 13 → 2 | n/v → 265 | 133 → 84 | 5 → 2 | 17 → 19 | 1 → 0 | 5 → 7 |
| settings-module-finance | 38 → 28 | 21 → 10 | n/v → 326 | 173 → 108 | 5 → 0 | 20 → 24 | 2 → 0 | 5 → 6 |
| übersicht-ruhig | 25 → 22 | 8 → 7 | 240 → 221 | – | 5 → 2 | 14 → 12 | 3 | 5 |
| übersicht-ausführlich | 34 → 32 | 6 → 5 | 240 → 221 | 72 | 5 → 2 | 28 → 34 | 3 → 0 | 6 |

### Reizlast vorher → nachher – Handy 412 dunkel, Seed

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Farbe Text | Farbe Fläche | Verläufe | Schriftgrößen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 53 → 58 | 25 → 23 | 569 → 334 | 200 → 141 | 3 → 2 | 53 → 21 | 2 → 0 | 7 → 6 |
| planner | 21 → 27 | 20 → 21 | 778 → 328 | 268 → 93 | 1 → 2 | 17 → 14 | 2 → 0 | 7 → 8 |
| todos | 36 → 46 | 21 → 19 | 584 → 218 | 243 → 141 | 2 → 1 | 11 → 17 | 2 → 0 | 7 |
| habits | 22 → 21 | 14 → 13 | 533 → 266 | 280 → 141 | 2 → 1 | 3 → 2 | 2 → 0 | 6 → 7 |
| timetrack | 19 → 18 | 18 → 17 | 572 → 345 | 297 → 141 | 2 | 10 | 2 → 0 | 6 → 7 |
| weather | 11 | 11 | 105 | 336 → 278 | 1 | 8 → 33 | 5 → 4 | 9 |
| maps | 27 → 38 | 23 → 22 | 846 → 434 | 349 → 141 | 2 → 1 | 10 → 26 | 2 → 0 | 8 |
| people | 24 → 31 | 16 → 13 | 554 → 282 | 169 → 141 | 2 → 1 | 4 → 2 | 6 → 9 | 7 → 8 |
| fitness | 18 → 19 | 13 → 12 | 632 → 266 | 271 → 141 | 2 → 1 | 3 → 5 | 2 → 0 | 7 → 8 |
| finance | 16 → 12 | 16 → 12 | 834 → 343 | 344 → 141 | 6 → 1 | 3 → 6 | 3 → 1 | 9 → 6 |
| invoices | 18 → 26 | 14 → 11 | 687 → 266 | 314 → 141 | 5 → 4 | 5 → 10 | 2 → 0 | 8 |
| subscriptions | 15 → 14 | 9 → 5 | 523 → 234 | 244 → 93 | 3 | 8 → 11 | 4 → 0 | 8 |
| budgets | 14 | 12 → 9 | 681 → 274 | 364 → 141 | 3 → 2 | 15 → 10 | 2 → 0 | 6 |
| lists | 21 → 27 | 19 → 12 | 858 → 342 | 308 → 141 | 2 → 1 | 7 → 9 | 2 → 0 | 7 → 8 |
| pantry | 20 → 29 | 11 → 8 | 642 → 259 | 280 → 141 | 5 → 4 | 14 → 13 | 2 → 0 | 8 |
| bookmarks | 23 → 31 | 13 → 10 | 661 → 322 | 288 → 141 | 2 → 1 | 4 → 2 | 2 → 0 | 8 |
| notes | 27 | 27 | – | 133 → 93 | 2 → 0 | 11 → 8 | 2 → 0 | 6 |
| chat | 11 → 9 | 10 → 8 | 356 → 174 | 159 → 93 | 1 | 9 → 4 | 2 → 0 | 5 → 7 |
| feeds | 17 → 21 | 11 → 9 | 690 → 278 | 306 → 93 | 1 → 0 | 11 → 4 | 2 → 0 | 9 → 8 |
| music | 22 → 23 | 22 → 21 | 710 → 603 | 208 → 204 | 0 → 1 | 5 → 2 | 2 → 1 | 6 → 7 |
| vault | 18 → 19 | 17 → 13 | 817 → 396 | 307 → 141 | 1 → 4 | 13 → 10 | 2 → 0 | 7 → 8 |
| accounts | 5 → 4 | 5 → 4 | – | 141 → 93 | 1 → 0 | 3 | 2 → 0 | 5 → 6 |
| clock | neu 21 | neu 21 | – | neu 93 | neu 0 | neu 2 | neu 0 | neu 8 |
| routines | neu 14 | neu 8 | neu 266 | neu 141 | neu 1 | neu 2 | neu 0 | neu 8 |
| device | neu 6 | neu 0 | neu 130 | neu 49 | neu 0 | neu 1 | neu 0 | neu 5 |
| library | 9 | 6 | n/v → 93 | 232 | 1 → 0 | 6 | 1 | 7 |
| library-vault | 4 | 4 | n/v → 145 | 209 | 0 | 11 → 13 | 2 → 1 | 6 |
| tools | 8 → 13 | 4 | n/v → 217 | 212 → 120 | 1 → 0 | 6 → 10 | 1 → 0 | 7 → 5 |
| settings | 19 → 10 | 12 → 1 | n/v → 169 | 338 → 248 | 4 → 0 | 1 → 8 | 1 | 5 |
| settings-einrichtung | 6 → 8 | 6 → 8 | n/v → 306 | 137 → 96 | 2 → 1 | 3 → 2 | 2 → 1 | 7 → 8 |
| settings-allgemein | 7 | 7 | n/v → 319 | 113 → 72 | 2 → 0 | 0 → 2 | 1 → 0 | 5 → 6 |
| settings-darstellung | 19 → 26 | 19 → 26 | n/v → 319 | 113 → 72 | 14 → 4 | 12 → 27 | 1 → 0 | 6 → 7 |
| settings-barrierefreiheit | 9 → 11 | 9 → 11 | n/v → 390 | 113 → 72 | 3 → 0 | 1 → 4 | 1 → 0 | 6 → 7 |
| settings-module | 7 → 9 | 3 | n/v → 368 | 113 → 72 | 2 → 0 | 4 → 7 | 1 → 0 | 7 → 8 |
| settings-werkzeuge | 14 → 15 | 14 → 15 | n/v → 368 | 113 → 72 | 1 → 0 | 7 | 1 → 0 | 6 → 7 |
| settings-benachrichtigungen | 6 | 6 | n/v → 319 | 113 → 72 | 3 → 1 | 3 → 6 | 1 → 0 | 7 → 8 |
| settings-sicherheit | 7 → 8 | 7 → 8 | n/v → 319 | 137 → 72 | 3 → 0 | 0 → 2 | 1 → 0 | 5 → 6 |
| settings-sync | 5 | 5 | n/v → 319 | 113 → 72 | 1 → 0 | 2 → 3 | 1 → 0 | 7 → 8 |
| settings-ki | 6 | 6 | n/v → 319 | 113 → 72 | 3 → 1 | 3 → 6 | 1 → 0 | 7 → 8 |
| settings-verbindungen | 3 | 3 | n/v → 380 | 113 → 72 | 1 → 0 | 0 → 6 | 1 → 0 | 7 → 8 |
| settings-schnellerfassung | 5 → 6 | 5 → 6 | n/v → 282 | 113 → 72 | 1 → 0 | 1 → 5 | 1 → 0 | 7 → 8 |
| settings-updates | 3 | 3 | n/v → 319 | 113 → 72 | 1 → 0 | 1 → 2 | 1 → 0 | 6 → 7 |
| settings-entwickler | 6 → 7 | 6 → 7 | n/v → 319 | 113 → 72 | 2 → 1 | 1 → 2 | 1 → 0 | 6 → 7 |
| settings-ueber | 3 | 3 | n/v → 290 | 113 → 72 | 2 → 1 | 1 | 1 → 0 | 5 → 6 |
| settings-module-finance | 5 → 8 | 5 → 8 | n/v → 314 | 249 → 96 | 1 → 0 | 4 → 6 | 2 → 0 | 5 → 6 |
| übersicht-ruhig | 14 → 15 | 5 | 365 → 284 | – | 3 → 1 | 9 → 11 | 3 | 5 |
| übersicht-ausführlich | 15 | 5 → 4 | 365 → 240 | 72 | 3 → 1 | 10 → 17 | 3 → 0 | 5 |

### Reizlast vorher → nachher – Desktop 1920 dunkel, leer

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Farbe Text | Farbe Fläche | Verläufe | Schriftgrößen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 58 → 49 | 23 → 14 | 551 → 262 | 286 → 117 | 5 → 3 | 17 → 7 | 2 → 0 | 7 |
| planner | 19 → 12 | 19 → 5 | neu 404 | 211 → 69 | 1 → 0 | 10 → 4 | 2 → 0 | 8 → 7 |
| todos | 19 → 10 | 19 → 10 | – | 180 → 117 | 1 → 2 | 5 → 2 | 2 → 0 | 7 → 4 |
| habits | 15 → 7 | 15 → 7 | – | 200 → 117 | 2 | 3 → 2 | 2 → 0 | 4 |
| timetrack | 15 → 7 | 15 → 7 | – | 233 → 117 | 2 | 3 → 2 | 2 → 0 | 6 |
| weather | 11 → 3 | 11 → 3 | – | 200 → 174 | 1 | 3 → 2 | 5 → 4 | 4 |
| maps | 14 → 6 | 14 → 6 | – | 233 → 117 | 2 | 4 → 2 | 2 → 0 | 6 |
| people | 13 → 6 | 13 → 6 | – | 140 → 117 | 1 → 2 | 4 → 3 | 2 → 0 | 5 → 4 |
| fitness | 10 → 7 | 10 → 7 | – | 206 → 117 | 2 | 3 → 2 | 2 → 0 | 7 → 5 |
| finance | 14 → 7 | 14 → 7 | 660 → – | 292 → 117 | 5 → 2 | 3 → 2 | 3 → 0 | 8 → 6 |
| invoices | 13 → 7 | 13 → 7 | – | 140 → 117 | 2 | 4 → 2 | 2 → 0 | 7 → 5 |
| subscriptions | 9 → 4 | 9 → 4 | – | 213 → 69 | 1 | 4 → 2 | 2 → 0 | 7 → 4 |
| budgets | 12 → 8 | 12 → 8 | – | 213 → 117 | 2 | 4 → 2 | 2 → 0 | 4 |
| lists | 14 → 6 | 14 → 6 | – | 233 → 117 | 2 | 6 → 3 | 2 → 0 | 7 → 6 |
| pantry | 11 → 7 | 11 → 7 | – | 205 → 117 | 2 | 8 → 2 | 2 → 0 | 5 → 4 |
| bookmarks | 14 → 6 | 14 → 6 | – | 249 → 117 | 2 | 4 → 2 | 2 → 0 | 5 → 4 |
| notes | 21 → 17 | 21 → 17 | – | 142 → 69 | 2 → 1 | 4 → 6 | 2 → 0 | 6 → 8 |
| chat | 12 → 5 | 12 → 5 | 368 → 154 | 163 → 69 | 1 | 9 → 4 | 2 → 0 | 5 → 6 |
| browser | 17 → 10 | 17 → 10 | – | 118 → 69 | 0 | 2 → 1 | 1 → 0 | 6 |
| feeds | 10 → 4 | 10 → 4 | – | 231 → 69 | 1 | 10 → 2 | 2 → 0 | 4 |
| mail | 10 → 3 | 10 → 3 | – | 141 → 69 | 1 → 0 | 3 → 1 | 1 → 0 | 4 |
| music | 10 → 3 | 10 → 3 | – | 213 → 132 | 1 | 4 → 2 | 2 → 1 | 4 |
| vault | 15 → 6 | 15 → 6 | – | 205 → 117 | 1 → 2 | 13 → 2 | 2 → 0 | 7 → 5 |
| accounts | 7 → 5 | 7 → 5 | – | 141 → 69 | 1 | 3 → 2 | 2 → 0 | 4 |
| disk | 10 → 9 | 4 → 2 | 502 → 265 | 238 → 117 | 3 → 2 | 2 → 5 | 1 → 0 | 9 |
| downloads | 18 → 16 | 10 → 8 | 415 → 256 | 165 → 69 | 2 → 1 | 7 | 1 → 0 | 5 → 7 |
| clock | neu 3 | neu 3 | – | neu 69 | neu 1 | neu 2 | neu 0 | neu 6 |
| routines | neu 6 | neu 6 | – | neu 117 | neu 2 | neu 2 | neu 0 | neu 4 |
| device | neu 8 | neu 1 | neu 154 | neu 69 | neu 0 | neu 1 | neu 0 | neu 5 |
| library | 17 → 20 | 6 | n/v → 93 | 223 | 1 → 0 | 56 → 70 | 3 | 7 |
| library-vault | 4 | 4 | n/v → 145 | 133 | 0 | 11 → 13 | 2 → 1 | 6 |
| tools | 24 → 23 | 4 | n/v → 185 | 207 → 84 | 1 → 0 | 22 → 19 | 1 → 0 | 7 → 5 |
| settings | 36 → 34 | 12 | n/v → 93 | 368 → 200 | 4 → 0 | 19 → 26 | 1 | 6 → 5 |
| settings-einrichtung | 35 → 25 | 19 → 8 | n/v → 294 | 133 → 84 | 5 → 1 | 20 → 21 | 2 → 1 | 7 → 8 |
| settings-allgemein | 45 → 37 | 18 → 9 | n/v → 265 | 133 → 84 | 5 → 1 | 17 → 20 | 1 → 0 | 6 → 7 |
| settings-darstellung | 67 → 58 | 46 → 36 | n/v → 265 | 133 → 84 | 22 → 5 | 34 → 56 | 1 → 0 | 6 → 7 |
| settings-barrierefreiheit | 42 → 39 | 23 → 19 | n/v → 357 | 133 → 84 | 9 → 0 | 18 → 27 | 1 → 0 | 7 → 8 |
| settings-module | 47 → 33 | 13 → 2 | n/v → 357 | 133 → 84 | 5 → 0 | 35 → 33 | 1 → 0 | 7 → 8 |
| settings-werkzeuge | 64 → 41 | 48 → 24 | n/v → 357 | 133 → 84 | 4 → 0 | 30 → 33 | 1 → 0 | 6 → 7 |
| settings-benachrichtigungen | 44 → 35 | 23 → 13 | n/v → 331 | 133 → 84 | 8 → 1 | 20 → 29 | 1 → 0 | 7 → 8 |
| settings-sicherheit | 41 → 31 | 25 → 14 | n/v → 331 | 133 → 84 | 7 → 0 | 17 → 22 | 1 → 0 | 5 → 6 |
| settings-sync | 32 → 24 | 16 → 7 | n/v → 331 | 133 → 84 | 4 → 0 | 18 → 22 | 1 → 0 | 7 → 8 |
| settings-ki | 40 → 31 | 16 → 6 | n/v → 265 | 133 → 84 | 6 → 2 | 20 → 25 | 1 → 0 | 7 → 8 |
| settings-verbindungen | 38 → 31 | 14 → 5 | n/v → 265 | 133 → 84 | 4 → 1 | 17 → 25 | 1 → 0 | 7 → 8 |
| settings-schnellerfassung | 33 → 23 | 17 → 6 | n/v → 294 | 133 → 84 | 4 → 0 | 18 → 24 | 1 → 0 | 8 → 9 |
| settings-updates | 29 → 19 | 13 → 2 | n/v → 331 | 133 → 84 | 4 → 0 | 17 → 20 | 1 → 0 | 6 → 7 |
| settings-entwickler | 34 → 24 | 18 → 7 | n/v → 331 | 133 → 84 | 5 → 2 | 17 → 20 | 1 → 0 | 7 → 8 |
| settings-ueber | 42 → 32 | 13 → 2 | n/v → 265 | 133 → 84 | 5 → 2 | 17 → 19 | 1 → 0 | 5 → 7 |
| settings-module-finance | 38 → 28 | 21 → 10 | n/v → 326 | 173 → 108 | 5 → 0 | 20 → 24 | 2 → 0 | 5 → 6 |
| übersicht-ruhig | 13 → 12 | 10 → 9 | 216 → 197 | – | 3 → 1 | 3 → 6 | 0 | 5 → 4 |
| übersicht-ausführlich | 27 | 8 | 216 → 197 | 48 | 3 → 1 | 16 → 19 | 0 | 5 → 6 |

### Flächen und Bewegung vorher → nachher – 1920 dunkel, Seed

Animationen vorher bei 10 gekappt (`≥ 10`), nachher ohne Kappung.

| Seite | Rahmen (rundum) | Schatten | getönt | --surface-2 | Animationen |
| --- | --- | --- | --- | --- | --- |
| calendar | 37 → 0 | 4 → 0 | 3 | 11 → 9 | 1 |
| planner | 0 | 12 → 0 | 1 → 5 | 21 → 6 | ≥ 10 → 1 |
| todos | 1 → 0 | 12 → 0 | 6 → 47 | 47 → 50 | ≥ 10 → 1 |
| habits | 4 → 0 | 2 → 0 | 1 → 3 | 6 → 7 | 1 |
| timetrack | 0 | 3 → 0 | 1 → 3 | 2 → 4 | 2 → 1 |
| weather | 1 → 0 | 28 → 1 | 14 → 40 | 2 → 1 | 1 |
| maps | 0 | 3 → 0 | 6 → 9 | 12 → 9 | 9 → 1 |
| people | 0 | 30 → 0 | 2 → 5 | 32 → 33 | ≥ 10 → 1 |
| fitness | 0 | 30 → 0 | 1 → 28 | 4 → 2 | ≥ 10 → 1 |
| finance | 0 | 25 → 0 | 1 → 38 | 25 → 22 | ≥ 10 → 1 |
| invoices | 0 | 5 → 0 | 4 → 12 | 11 → 10 | 8 → 1 |
| subscriptions | 15 → 0 | 2 → 0 | 16 → 10 | 15 → 21 | ≥ 10 → 1 |
| budgets | 3 → 0 | 8 → 0 | 11 → 6 | 5 → 4 | 7 → 1 |
| lists | 0 | 2 → 0 | 1 → 14 | 18 | ≥ 10 → 1 |
| pantry | 28 → 14 | 2 → 0 | 1 → 6 | 52 → 50 | ≥ 10 → 1 |
| bookmarks | 0 | 6 → 0 | 2 → 1 | 35 → 34 | ≥ 10 → 1 |
| notes | 1 → 0 | 2 → 0 | 2 → 3 | 20 | 1 |
| chat | 0 | 3 → 0 | 2 | 1 | 1 |
| browser | 1 → 0 | 2 → 0 | 1 → 7 | 9 | 7 → 1 |
| feeds | 1 → 0 | 2 → 0 | 2 → 3 | 8 | 1 |
| mail | 2 → 0 | 5 → 0 | 2 → 12 | 11 | 8 → 1 |
| music | 0 | 6 → 0 | 5 → 1 | 6 | 1 |
| vault | 34 | 1 → 0 | 1 → 35 | 1 → 2 | ≥ 10 → 1 |
| accounts | 0 | 0 | 2 → 1 | 1 | 1 |
| disk | 0 | 6 → 0 | 1 → 4 | 1 → 0 | 1 |
| downloads | 0 | 3 → 0 | 3 → 2 | 10 → 9 | 4 → 1 |
| clock | neu 0 | neu 0 | neu 1 | neu 13 | neu 1 |
| routines | neu 0 | neu 0 | neu 1 | neu 2 | neu 1 |
| device | neu 0 | neu 0 | neu 0 | neu 0 | neu 1 |
| library | 6 → 0 | 28 → 0 | 78 → 83 | 26 → 28 | 1 |
| library-vault | 0 | 3 → 0 | 1 → 3 | 1 | 1 |
| tools | 3 → 0 | 18 → 0 | 34 → 19 | 21 → 16 | 1 |
| settings | 9 → 0 | 5 → 0 | 1 → 6 | 4 → 0 | 1 |
| settings-einrichtung | 1 → 0 | 5 → 0 | 2 | 5 → 1 | 1 |
| settings-allgemein | 10 → 0 | 6 → 0 | 2 → 3 | 16 → 0 | 1 |
| settings-darstellung | 2 → 0 | 14 → 0 | 12 → 23 | 40 → 29 | 1 |
| settings-barrierefreiheit | 0 | 13 → 0 | 2 → 10 | 21 → 9 | 1 |
| settings-module | 24 → 0 | 5 → 0 | 1 → 2 | 4 → 1 | 1 |
| settings-werkzeuge | 0 | 5 → 0 | 1 | 64 → 20 | 1 |
| settings-benachrichtigungen | 4 → 0 | 14 → 0 | 3 → 15 | 14 → 3 | 1 |
| settings-sicherheit | 0 | 7 → 0 | 1 → 3 | 8 → 2 | 1 |
| settings-sync | 2 → 1 | 9 → 0 | 2 → 7 | 4 → 0 | 1 |
| settings-ki | 2 → 0 | 7 → 0 | 3 → 7 | 6 → 0 | 1 |
| settings-verbindungen | 4 → 1 | 11 → 0 | 3 → 14 | 11 → 3 | 1 |
| settings-schnellerfassung | 4 → 0 | 6 → 0 | 1 → 6 | 5 → 1 | 1 |
| settings-updates | 0 | 9 → 0 | 1 → 5 | 4 → 0 | 1 |
| settings-entwickler | 1 | 6 → 0 | 1 → 2 | 5 → 1 | 1 |
| settings-ueber | 2 → 1 | 5 → 0 | 3 → 4 | 6 → 1 | 1 |
| settings-module-finance | 2 → 0 | 6 → 0 | 2 → 4 | 6 → 1 | 1 |
| übersicht-ruhig | 0 | 9 → 0 | 1 → 5 | 4 → 3 | 1 |
| übersicht-ausführlich | 1 | 41 → 0 | 34 → 49 | 36 → 38 | 1 |

| Größe | Summe vorher → nachher (dunkel) | Seiten > 0 vorher → nachher | nachher hell (alle Seiten) |
| --- | --- | --- | --- |
| Rahmen (rundum) | 205 → 53 | 28 → 7 | 53 |
| Schatten | 436 → 1 | 47 → 1 | 1 |
| getönt | 281 → 573 | 48 | 65 |
| --surface-2 | 677 → 505 | 48 → 42 | 520 |
| Animationen | 176 → 48 | 48 | 51 |

### Handy: Zeilenhöhen vorher → nachher – 412 dunkel, Seed

| Seite | Zeilen vorher (n · Median · min–max) | nachher |
| --- | --- | --- |
| calendar | – | – |
| planner | 5 · 57 · 56–57 | 5 · 57 · 56–57 |
| todos | 42 · 59 · 56–210 | 42 · 59 · 56–202 |
| habits | – | – |
| timetrack | 1 · 56 · 56–56 | 1 · 56 · 56–56 |
| weather | – | – |
| maps | 8 · 57 · 56–78 | 8 · 57 · 56–78 |
| people | 28 · 104 · 82–104 | 28 · 57 · 57–78 |
| fitness | 29 · 77 · 56–119 | 29 · 77 · 56–119 |
| finance | – | – |
| invoices | 7 · 130 · 103–176 | 7 · 58 · 56–81 |
| subscriptions | 9 · 155 · 81–181 | 9 · 57 · 56–78 |
| budgets | – | – |
| lists | 14 · 57 · 56–109 | 14 · 57 · 56–109 |
| pantry | 14 · 98 · 76–126 | 14 · 98 · 76–126 |
| bookmarks | 31 · 83 · 57–104 | 31 · 83 · 57–104 |
| notes | – | – |
| chat | – | 1 · 59 · 59–59 |
| feeds | 6 · 50 · 50–50 | 6 · 57 · 56–57 |
| music | – | – |
| vault | 34 · 106 · 84–150 | 34 · 106 · 84–150 |
| accounts | – | – |
| clock | – | – |
| routines | – | 3 · 78 · 77–78 |
| device | – | – |
| library | – | – |
| library-vault | – | – |
| tools | – | – |
| settings | – | – |
| settings-einrichtung | – | – |
| settings-allgemein | – | – |
| settings-darstellung | – | – |
| settings-barrierefreiheit | – | – |
| settings-module | – | – |
| settings-werkzeuge | – | – |
| settings-benachrichtigungen | – | – |
| settings-sicherheit | – | – |
| settings-sync | – | – |
| settings-ki | – | – |
| settings-verbindungen | – | – |
| settings-schnellerfassung | – | – |
| settings-updates | – | – |
| settings-entwickler | – | – |
| settings-ueber | – | – |
| settings-module-finance | – | – |
| übersicht-ruhig | – | – |
| übersicht-ausführlich | – | – |

### Farbe über dem Falz: Sättigung vs. Chroma, hell und dunkel (Seed)

Sättigung = (max − min) / max > 0,12 (Fläche) bzw. > 0,25 (Text), wie im Audit; Chroma = (max − min) / 255 > 0,10, Tonstufen `--surface-raised`/`-sunken` neutral. Summen über alle Seiten.

| Gerät | Größe | hell | dunkel |
| --- | --- | --- | --- |
| Desktop | Fläche Sättigung | 235 | 1002 |
| Desktop | Fläche Chroma | 243 | 254 |
| Desktop | Text Sättigung | 60 | 89 |
| Desktop | Text Chroma | 60 | 60 |
| Handy | Fläche Sättigung | 99 | 380 |
| Handy | Fläche Chroma | 100 | 99 |
| Handy | Text Sättigung | 38 | 46 |
| Handy | Text Chroma | 38 | 38 |

## Nachher – volle Tabellen (0b-8)

Definitionen (aus `audit-tour.spec.ts` `measure()`, je Ansicht im Element `#main`, also ohne Seitenleiste und Topbar): **Aktionen** = sichtbare button/a[href]/input/select/textarea/[role=button|tab|switch|checkbox|menuitem], deren Box im ersten Bildschirm liegt (Oberkante über der Fensterhöhe, Unterkante über 0); **Chrome** = davon ohne Vorfahren li/[data-row]/table/[role=gridcell|grid]/article/Widget/dialog (also Navigation, Toolbars, Kopf) – gezählt über den ganzen Falz, nicht nur oberhalb des Inhalts; **Inhalt ab y** = kleinste Oberkante (> 60 px) eines sichtbaren Listen-/Tabellen-/Raster-/Artikel-/Widget-/Karten-/Canvas-Elements in `#main`, das nicht in nav/[role=tablist]/dialog/aside/Kopfband liegt (fehlt, wenn die Seite keines hat); **Kopf px** = Höhe des ersten `[data-size]`-Elements (Kopfband bzw. Kopfkarte); **Primär** = Knöpfe/Links mit Klasse `primary`; **Farbe Text/Icon/Fläche** = Elemente über dem Falz, deren Text-/Icon-/Hintergrundfarbe nicht eine der neutralen Tinten (--text, --text-muted, --text-3, --text-on-tint bzw. --bg, --surface, --surface-2) ist und Sättigung > 0,25 (Text/Icon) bzw. > 0,12 (Fläche); `color(srgb …)`-Werte aus `color-mix()` werden geparst; **Verläufe** = Elemente mit `background-image: …gradient` (Kopfband, Bank-Karten, Avatar-Ringe); **Wörter/Zeichen** = Textknoten sichtbarer Elemente über dem Falz; **Schriftgrößen/Gewichte** = verschiedene Werte an Textblättern über dem Falz; **Abstandswerte** = verschiedene gap/rowGap/paddingTop/paddingLeft-Werte sichtbarer Elemente (erste 2 500); **Rahmen** = gleiche Breite > 0 und `solid` auf allen vier Seiten mit sichtbarer Farbe (Alpha > 0,05), Element ≥ 40×24 px, keine input/select/textarea/button; **Ring** = `box-shadow`, dessen Segmente alle ohne Versatz und ohne Weichzeichnung sind (0 0 0 n px, inset oder nicht); **Schatten** = jeder andere `box-shadow` (ein inset mit Weichzeichnung zählt als Schatten); **getönt** = Hintergrund weder --bg/--surface/--surface-2 noch transparent, Sättigung > 0,12 (ohne button/input/select/tab); **neutrale Füllungen** = dasselbe ohne Sättigung (Hover, Bahnen, Scrims; nur in den facts); **--surface-2** separat; **Zeilen** = `[data-row]`-Elemente, Höhe des umschließenden `li` (sonst des Elements), Median/min/max; **CLS** = laufende Summe aller `layout-shift`-Einträge ohne kürzliche Eingabe seit `page.goto` der Ansicht (bei Reiter-Ansichten kumuliert seit dem Laden der Seite); Flächen-/Zeilen-/Bewegungs-Zählung über die ganze Seite, nicht nur den Falz, aber höchstens die ersten 6 000 Elemente von `#main` (`all.slice(0, 6000)`); **Inhalt ab y** schließt nur das Modul-Kopfband (`module-frame`) aus – auf Bibliothek, Werkzeugen und Einstellungen (93/169/174) liegen die gemessenen Elemente in der Kopfkarte; **Animationen** = Elemente mit `animationName ≠ none` (auch beendete Einblendungen), seit 0b-8 ohne Kappung (im Audit auf 10 gekappt); **CLS** bei Dialogen seit 0b-8 nur der Dialog (vor jedem Modul-Dialog, der Schnellerfassung, Palette und Werkzeug-Panel auf 0 gesetzt); **Kopf px** seit 0b-8 = Höhe von `main [data-head]` (4.0-Kopf), sonst wie oben; **Chroma** (nur in den facts und in der Vorher/Nachher-Tabelle) = (max − min) / 255 > 0,10, Tonstufen neutral. Seed = Testdaten „medium“, alle Module an; Desktop posiert als Windows-App in Linux-Headless-Chromium.

### Reizlast über dem Falz – 1920x1080-dark, seed

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 163 | 16 | 262 | 117 | 1 | 4 | 28 | 0 | 2 | 614 | 3630 | 6 | 4 | 0 |
| planner | 19 | 6 | 158 | 69 | 1 | 2 | 13 | 0 | 1 | 164 | 743 | 7 | 4 | 0 |
| todos | 66 | 16 | 202 | 117 | 1 | 4 | 33 | 0 | 2 | 160 | 908 | 8 | 4 | 0 |
| habits | 20 | 8 | 232 | 117 | 1 | 2 | 5 | 0 | 2 | 73 | 347 | 7 | 4 | 0 |
| timetrack | 14 | 12 | 325 | 117 | 1 | 2 | 12 | 0 | 2 | 47 | 270 | 7 | 4 | 0.00 |
| weather | 3 | 3 | 105 | 174 | 0 | 5 | 46 | 4 | 5 | 263 | 1335 | 9 | 5 | 0 |
| maps | 31 | 15 | 366 | 117 | 1 | 2 | 28 | 0 | 2 | 69 | 508 | 5 | 4 | 0 |
| people | 48 | 11 | 266 | 117 | 1 | 3 | 8 | 17 | 2 | 291 | 1395 | 9 | 4 | 0.00 |
| fitness | 23 | 13 | 250 | 117 | 1 | 2 | 9 | 0 | 9 | 167 | 654 | 7 | 4 | 0.00 |
| finance | 28 | 14 | 304 | 117 | 1 | 2 | 35 | 1 | 9 | 182 | 1121 | 8 | 4 | 0.00 |
| invoices | 32 | 11 | 250 | 117 | 1 | 5 | 21 | 0 | 5 | 177 | 1099 | 8 | 4 | 0 |
| subscriptions | 30 | 3 | 196 | 69 | 1 | 4 | 13 | 0 | 4 | 233 | 1230 | 7 | 4 | 0.00 |
| budgets | 13 | 7 | 258 | 117 | 1 | 3 | 13 | 0 | 2 | 97 | 398 | 7 | 4 | 0 |
| lists | 47 | 11 | 303 | 117 | 1 | 2 | 16 | 0 | 2 | 83 | 413 | 6 | 4 | 0 |
| pantry | 54 | 6 | 243 | 117 | 1 | 6 | 23 | 0 | 2 | 128 | 652 | 8 | 4 | 0 |
| bookmarks | 55 | 7 | 306 | 117 | 1 | 2 | 3 | 0 | 2 | 198 | 1300 | 6 | 4 | 0 |
| notes | 31 | 31 | – | 69 | 1 | 1 | 12 | 0 | 5 | 162 | 1121 | 8 | 3 | 0.00 |
| chat | 6 | 5 | 154 | 69 | 1 | 1 | 5 | 0 | 1 | 42 | 306 | 6 | 3 | 0 |
| browser | 22 | 11 | 484 | 69 | 0 | 0 | 14 | 0 | 0 | 59 | 561 | 7 | 4 | 0.02 |
| feeds | 18 | 6 | 202 | 69 | 1 | 1 | 5 | 0 | 2 | 35 | 305 | 6 | 4 | 0 |
| mail | 31 | 14 | 461 | 69 | 0 | 0 | 11 | 0 | 1 | 177 | 1104 | 7 | 4 | 0 |
| music | 19 | 17 | 491 | 132 | 0 | 1 | 2 | 1 | 1 | 34 | 232 | 7 | 3 | 0 |
| vault | 40 | 13 | 355 | 117 | 1 | 11 | 33 | 0 | 2 | 398 | 2309 | 7 | 4 | 0.00 |
| accounts | 3 | 3 | – | 69 | 1 | 0 | 3 | 0 | 0 | 14 | 110 | 5 | 4 | 0 |
| disk | 9 | 2 | 265 | 117 | 0 | 2 | 5 | 0 | 1 | 184 | 1057 | 9 | 4 | 0 |
| downloads | 16 | 8 | 256 | 69 | 1 | 1 | 7 | 0 | 1 | 82 | 536 | 7 | 4 | 0 |
| clock | 14 | 14 | – | 69 | 1 | 1 | 3 | 0 | 2 | 55 | 271 | 6 | 4 | 0.00 |
| routines | 12 | 6 | 250 | 117 | 1 | 2 | 3 | 0 | 1 | 53 | 275 | 7 | 4 | 0 |
| device | 8 | 1 | 154 | 69 | 0 | 0 | 1 | 0 | 1 | 87 | 557 | 5 | 3 | 0 |
| library | 20 | 6 | 93 | 223 | 0 | 0 | 70 | 3 | 10 | 190 | 1333 | 7 | 3 | 0 |
| library-vault | 4 | 4 | 145 | 133 | 0 | 0 | 13 | 1 | 1 | 53 | 379 | 6 | 3 | 0 |
| tools | 23 | 4 | 185 | 84 | 0 | 0 | 19 | 0 | 12 | 205 | 1527 | 5 | 3 | 0 |
| settings | 34 | 12 | 93 | 200 | 0 | 0 | 26 | 1 | 11 | 115 | 801 | 5 | 3 | 0 |
| settings-einrichtung | 25 | 8 | 294 | 84 | 1 | 1 | 20 | 1 | 11 | 100 | 724 | 8 | 3 | 0 |
| settings-allgemein | 37 | 9 | 265 | 84 | 0 | 1 | 20 | 0 | 11 | 190 | 1331 | 7 | 3 | 0 |
| settings-darstellung | 58 | 36 | 265 | 84 | 0 | 5 | 56 | 0 | 11 | 473 | 3103 | 7 | 4 | 0 |
| settings-barrierefreiheit | 39 | 19 | 357 | 84 | 0 | 0 | 27 | 0 | 11 | 246 | 1668 | 8 | 3 | 0 |
| settings-module | 33 | 2 | 357 | 84 | 0 | 0 | 33 | 0 | 24 | 119 | 901 | 8 | 3 | 0 |
| settings-werkzeuge | 41 | 24 | 357 | 84 | 0 | 0 | 33 | 0 | 22 | 219 | 1660 | 7 | 3 | 0 |
| settings-benachrichtigungen | 35 | 13 | 331 | 84 | 1 | 1 | 29 | 0 | 11 | 182 | 1287 | 8 | 3 | 0 |
| settings-sicherheit | 31 | 14 | 331 | 84 | 0 | 0 | 22 | 0 | 11 | 276 | 2017 | 6 | 3 | 0 |
| settings-sync | 24 | 7 | 331 | 84 | 0 | 0 | 22 | 0 | 11 | 156 | 1122 | 8 | 3 | 0 |
| settings-ki | 31 | 6 | 265 | 84 | 0 | 2 | 25 | 0 | 11 | 205 | 1451 | 8 | 3 | 0 |
| settings-verbindungen | 31 | 5 | 265 | 84 | 0 | 1 | 25 | 0 | 11 | 178 | 1292 | 8 | 3 | 0 |
| settings-schnellerfassung | 23 | 6 | 294 | 84 | 0 | 0 | 24 | 0 | 11 | 172 | 1104 | 9 | 3 | 0 |
| settings-updates | 19 | 2 | 331 | 84 | 0 | 0 | 20 | 0 | 11 | 234 | 1715 | 7 | 4 | 0 |
| settings-entwickler | 24 | 7 | 331 | 84 | 1 | 1 | 19 | 0 | 11 | 211 | 1478 | 8 | 3 | 0 |
| settings-ueber | 32 | 2 | 265 | 84 | 0 | 2 | 19 | 0 | 12 | 176 | 1343 | 7 | 4 | 0 |
| settings-module-finance | 28 | 10 | 326 | 108 | 0 | 0 | 24 | 0 | 11 | 182 | 1317 | 6 | 3 | 0 |
| übersicht-ruhig | 22 | 7 | 221 | – | 1 | 2 | 12 | 3 | 4 | 102 | 567 | 5 | 4 | 0 |
| übersicht-ausführlich | 32 | 5 | 221 | 72 | 1 | 2 | 34 | 0 | 6 | 180 | 937 | 6 | 4 | 0 |

### Reizlast über dem Falz – 412x915-dark, seed

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 58 | 23 | 334 | 141 | 0 | 2 | 21 | 0 | 1 | 97 | 296 | 6 | 3 | 0.00 |
| planner | 27 | 21 | 328 | 93 | 1 | 2 | 14 | 0 | 1 | 128 | 656 | 8 | 4 | 0 |
| todos | 46 | 19 | 218 | 141 | 0 | 1 | 17 | 0 | 1 | 100 | 585 | 7 | 4 | 0.00 |
| habits | 21 | 13 | 266 | 141 | 0 | 1 | 2 | 0 | 1 | 47 | 273 | 7 | 4 | 0 |
| timetrack | 18 | 17 | 345 | 141 | 1 | 2 | 10 | 0 | 2 | 39 | 240 | 7 | 4 | 0 |
| weather | 11 | 11 | 105 | 278 | 0 | 1 | 33 | 4 | 4 | 217 | 1040 | 9 | 5 | 0.86 |
| maps | 38 | 22 | 434 | 141 | 0 | 1 | 26 | 0 | 1 | 78 | 569 | 8 | 4 | 0.03 |
| people | 31 | 13 | 282 | 141 | 0 | 1 | 2 | 9 | 1 | 157 | 746 | 8 | 4 | 0 |
| fitness | 19 | 12 | 266 | 141 | 0 | 1 | 5 | 0 | 6 | 127 | 508 | 8 | 4 | 0 |
| finance | 12 | 12 | 343 | 141 | 0 | 1 | 6 | 1 | 1 | 72 | 401 | 6 | 4 | 0 |
| invoices | 26 | 11 | 266 | 141 | 0 | 4 | 10 | 0 | 4 | 87 | 499 | 8 | 4 | 0.00 |
| subscriptions | 14 | 5 | 234 | 93 | 0 | 3 | 11 | 0 | 3 | 117 | 617 | 8 | 3 | 0 |
| budgets | 14 | 9 | 274 | 141 | 0 | 2 | 10 | 0 | 1 | 87 | 368 | 6 | 4 | 0.00 |
| lists | 27 | 12 | 342 | 141 | 0 | 1 | 9 | 0 | 1 | 61 | 305 | 8 | 4 | 0 |
| pantry | 29 | 8 | 259 | 141 | 0 | 4 | 13 | 0 | 1 | 74 | 369 | 8 | 4 | 0 |
| bookmarks | 31 | 10 | 322 | 141 | 0 | 1 | 2 | 0 | 1 | 100 | 658 | 8 | 4 | 0 |
| notes | 27 | 27 | – | 93 | 0 | 0 | 8 | 0 | 4 | 126 | 863 | 6 | 3 | 0 |
| chat | 9 | 8 | 174 | 93 | 1 | 1 | 4 | 0 | 1 | 45 | 326 | 7 | 3 | 0 |
| feeds | 21 | 9 | 278 | 93 | 0 | 0 | 4 | 0 | 1 | 38 | 321 | 8 | 4 | 0 |
| music | 23 | 21 | 603 | 204 | 0 | 1 | 2 | 1 | 1 | 30 | 203 | 7 | 3 | 0.03 |
| vault | 19 | 13 | 396 | 141 | 0 | 4 | 10 | 0 | 1 | 95 | 590 | 8 | 4 | 0 |
| accounts | 4 | 4 | – | 93 | 1 | 0 | 3 | 0 | 0 | 16 | 130 | 6 | 4 | 0 |
| clock | 21 | 21 | – | 93 | 0 | 0 | 2 | 0 | 1 | 64 | 332 | 8 | 4 | 0 |
| routines | 14 | 8 | 266 | 141 | 0 | 1 | 2 | 0 | 0 | 55 | 286 | 8 | 4 | 0 |
| device | 6 | 0 | 130 | 49 | 0 | 0 | 1 | 0 | 1 | 64 | 404 | 5 | 3 | 0 |
| library | 9 | 6 | 93 | 232 | 0 | 0 | 6 | 1 | 3 | 95 | 647 | 7 | 3 | 0 |
| library-vault | 4 | 4 | 145 | 209 | 0 | 0 | 13 | 1 | 1 | 53 | 379 | 6 | 3 | 0 |
| tools | 13 | 4 | 217 | 120 | 0 | 0 | 10 | 0 | 5 | 102 | 688 | 5 | 3 | 0 |
| settings | 10 | 1 | 169 | 248 | 0 | 0 | 8 | 1 | 6 | 66 | 537 | 5 | 2 | 0 |
| settings-einrichtung | 8 | 8 | 306 | 96 | 1 | 1 | 2 | 1 | 0 | 43 | 318 | 8 | 3 | 0 |
| settings-allgemein | 7 | 7 | 319 | 72 | 0 | 0 | 2 | 0 | 0 | 79 | 518 | 6 | 3 | 0 |
| settings-darstellung | 26 | 26 | 319 | 72 | 0 | 4 | 27 | 0 | 0 | 299 | 1954 | 7 | 4 | 0 |
| settings-barrierefreiheit | 11 | 11 | 390 | 72 | 0 | 0 | 4 | 0 | 0 | 114 | 808 | 7 | 3 | 0 |
| settings-module | 9 | 3 | 368 | 72 | 0 | 0 | 7 | 0 | 6 | 64 | 512 | 8 | 3 | 0 |
| settings-werkzeuge | 15 | 15 | 368 | 72 | 0 | 0 | 7 | 0 | 4 | 90 | 648 | 7 | 3 | 0 |
| settings-benachrichtigungen | 6 | 6 | 319 | 72 | 1 | 1 | 6 | 0 | 0 | 87 | 612 | 8 | 3 | 0 |
| settings-sicherheit | 8 | 8 | 319 | 72 | 0 | 0 | 2 | 0 | 0 | 126 | 908 | 6 | 3 | 0 |
| settings-sync | 5 | 5 | 319 | 72 | 0 | 0 | 3 | 0 | 0 | 83 | 593 | 8 | 3 | 0 |
| settings-ki | 6 | 6 | 319 | 72 | 0 | 1 | 6 | 0 | 0 | 119 | 837 | 8 | 3 | 0 |
| settings-verbindungen | 3 | 3 | 380 | 72 | 0 | 0 | 6 | 0 | 0 | 94 | 684 | 8 | 2 | 0 |
| settings-schnellerfassung | 6 | 6 | 282 | 72 | 0 | 0 | 5 | 0 | 0 | 96 | 593 | 8 | 3 | 0 |
| settings-updates | 3 | 3 | 319 | 72 | 0 | 0 | 2 | 0 | 0 | 100 | 696 | 7 | 3 | 0 |
| settings-entwickler | 7 | 7 | 319 | 72 | 1 | 1 | 2 | 0 | 0 | 83 | 595 | 7 | 3 | 0 |
| settings-ueber | 3 | 3 | 290 | 72 | 0 | 1 | 1 | 0 | 1 | 45 | 355 | 6 | 4 | 0 |
| settings-module-finance | 8 | 8 | 314 | 96 | 0 | 0 | 6 | 0 | 0 | 133 | 966 | 6 | 3 | 0 |
| übersicht-ruhig | 15 | 5 | 284 | – | 0 | 1 | 11 | 3 | 4 | 77 | 424 | 5 | 4 | 0 |
| übersicht-ausführlich | 15 | 4 | 240 | 72 | 0 | 1 | 17 | 0 | 3 | 79 | 460 | 5 | 4 | 0 |

### Reizlast über dem Falz – 1920x1080-dark, empty

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 49 | 14 | 262 | 117 | 1 | 3 | 7 | 0 | 2 | 77 | 257 | 7 | 4 | 0.00 |
| planner | 12 | 5 | 404 | 69 | 1 | 0 | 4 | 0 | 1 | 123 | 482 | 7 | 4 | 0 |
| todos | 10 | 10 | – | 117 | 1 | 2 | 2 | 0 | 1 | 18 | 109 | 4 | 2 | 0.00 |
| habits | 7 | 7 | – | 117 | 1 | 2 | 2 | 0 | 1 | 13 | 106 | 4 | 2 | 0 |
| timetrack | 7 | 7 | – | 117 | 1 | 2 | 2 | 0 | 1 | 28 | 172 | 6 | 4 | 0 |
| weather | 3 | 3 | – | 174 | 1 | 1 | 2 | 4 | 1 | 27 | 170 | 4 | 3 | 0 |
| maps | 6 | 6 | – | 117 | 1 | 2 | 2 | 0 | 2 | 20 | 107 | 6 | 4 | 0.00 |
| people | 6 | 6 | – | 117 | 1 | 2 | 3 | 0 | 1 | 13 | 96 | 4 | 2 | 0 |
| fitness | 7 | 7 | – | 117 | 1 | 2 | 2 | 0 | 1 | 28 | 199 | 5 | 4 | 0.00 |
| finance | 7 | 7 | – | 117 | 1 | 2 | 2 | 0 | 1 | 20 | 125 | 6 | 4 | 0 |
| invoices | 7 | 7 | – | 117 | 1 | 2 | 2 | 0 | 1 | 16 | 109 | 5 | 4 | 0 |
| subscriptions | 4 | 4 | – | 69 | 1 | 1 | 2 | 0 | 1 | 10 | 57 | 4 | 2 | 0 |
| budgets | 8 | 8 | – | 117 | 1 | 2 | 2 | 0 | 1 | 25 | 167 | 4 | 2 | 0 |
| lists | 6 | 6 | – | 117 | 1 | 2 | 3 | 0 | 2 | 17 | 107 | 6 | 4 | 0.00 |
| pantry | 7 | 7 | – | 117 | 1 | 2 | 2 | 0 | 1 | 23 | 155 | 4 | 2 | 0 |
| bookmarks | 6 | 6 | – | 117 | 1 | 2 | 2 | 0 | 1 | 11 | 95 | 4 | 2 | 0 |
| notes | 17 | 17 | – | 69 | 1 | 1 | 6 | 0 | 1 | 28 | 188 | 8 | 3 | 0.00 |
| chat | 5 | 5 | 154 | 69 | 1 | 1 | 4 | 0 | 1 | 48 | 335 | 6 | 3 | 0 |
| browser | 10 | 10 | – | 69 | 0 | 0 | 1 | 0 | 0 | 32 | 231 | 6 | 3 | 0 |
| feeds | 4 | 4 | – | 69 | 1 | 1 | 2 | 0 | 1 | 20 | 127 | 4 | 3 | 0.00 |
| mail | 3 | 3 | – | 69 | 0 | 0 | 1 | 0 | 1 | 30 | 219 | 4 | 3 | 0.00 |
| music | 3 | 3 | – | 132 | 1 | 1 | 2 | 1 | 1 | 28 | 196 | 4 | 3 | 0 |
| vault | 6 | 6 | – | 117 | 1 | 2 | 2 | 0 | 1 | 27 | 192 | 5 | 3 | 0.00 |
| accounts | 5 | 5 | – | 69 | 1 | 1 | 2 | 0 | 0 | 47 | 394 | 4 | 3 | 0 |
| disk | 9 | 2 | 265 | 117 | 0 | 2 | 5 | 0 | 1 | 184 | 1057 | 9 | 4 | 0 |
| downloads | 16 | 8 | 256 | 69 | 1 | 1 | 7 | 0 | 1 | 82 | 536 | 7 | 4 | 0.00 |
| clock | 3 | 3 | – | 69 | 1 | 1 | 2 | 0 | 1 | 16 | 82 | 6 | 4 | 0 |
| routines | 6 | 6 | – | 117 | 1 | 2 | 2 | 0 | 0 | 14 | 94 | 4 | 2 | 0.00 |
| device | 8 | 1 | 154 | 69 | 0 | 0 | 1 | 0 | 1 | 87 | 557 | 5 | 3 | 0 |
| library | 20 | 6 | 93 | 223 | 0 | 0 | 70 | 3 | 10 | 190 | 1333 | 7 | 3 | 0 |
| library-vault | 4 | 4 | 145 | 133 | 0 | 0 | 13 | 1 | 1 | 53 | 379 | 6 | 3 | 0 |
| tools | 23 | 4 | 185 | 84 | 0 | 0 | 19 | 0 | 12 | 205 | 1527 | 5 | 3 | 0 |
| settings | 34 | 12 | 93 | 200 | 0 | 0 | 26 | 1 | 11 | 113 | 794 | 5 | 3 | 0.00 |
| settings-einrichtung | 25 | 8 | 294 | 84 | 1 | 1 | 21 | 1 | 11 | 103 | 746 | 8 | 3 | 0 |
| settings-allgemein | 37 | 9 | 265 | 84 | 0 | 1 | 20 | 0 | 11 | 188 | 1324 | 7 | 3 | 0 |
| settings-darstellung | 58 | 36 | 265 | 84 | 0 | 5 | 56 | 0 | 11 | 471 | 3096 | 7 | 4 | 0 |
| settings-barrierefreiheit | 39 | 19 | 357 | 84 | 0 | 0 | 27 | 0 | 11 | 244 | 1661 | 8 | 3 | 0 |
| settings-module | 33 | 2 | 357 | 84 | 0 | 0 | 33 | 0 | 24 | 117 | 894 | 8 | 3 | 0 |
| settings-werkzeuge | 41 | 24 | 357 | 84 | 0 | 0 | 33 | 0 | 22 | 217 | 1653 | 7 | 3 | 0 |
| settings-benachrichtigungen | 35 | 13 | 331 | 84 | 1 | 1 | 29 | 0 | 11 | 180 | 1280 | 8 | 3 | 0 |
| settings-sicherheit | 31 | 14 | 331 | 84 | 0 | 0 | 22 | 0 | 11 | 274 | 2010 | 6 | 3 | 0 |
| settings-sync | 24 | 7 | 331 | 84 | 0 | 0 | 22 | 0 | 11 | 154 | 1115 | 8 | 3 | 0 |
| settings-ki | 31 | 6 | 265 | 84 | 0 | 2 | 25 | 0 | 11 | 203 | 1444 | 8 | 3 | 0 |
| settings-verbindungen | 31 | 5 | 265 | 84 | 0 | 1 | 25 | 0 | 11 | 176 | 1285 | 8 | 3 | 0 |
| settings-schnellerfassung | 23 | 6 | 294 | 84 | 0 | 0 | 24 | 0 | 11 | 170 | 1097 | 9 | 3 | 0 |
| settings-updates | 19 | 2 | 331 | 84 | 0 | 0 | 20 | 0 | 11 | 232 | 1708 | 7 | 4 | 0 |
| settings-entwickler | 24 | 7 | 331 | 84 | 1 | 2 | 20 | 0 | 11 | 181 | 1384 | 8 | 3 | 0 |
| settings-ueber | 32 | 2 | 265 | 84 | 0 | 2 | 19 | 0 | 12 | 174 | 1336 | 7 | 4 | 0 |
| settings-module-finance | 28 | 10 | 326 | 108 | 0 | 0 | 24 | 0 | 11 | 180 | 1310 | 6 | 3 | 0 |
| übersicht-ruhig | 12 | 9 | 197 | – | 1 | 1 | 6 | 0 | 1 | 75 | 490 | 4 | 3 | 0 |
| übersicht-ausführlich | 27 | 8 | 197 | 48 | 1 | 1 | 19 | 0 | 7 | 131 | 841 | 6 | 4 | 0 |

### Köpfe und Typografie – 1920 dunkel, Seed

| Seite | Kopf px | Größenklasse | h1 Größe/Gewicht/Schrift | h2/h3-Varianten | Zeilen (n · Median · min–max) | Abstandswerte | Icons (px/stroke) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 117 | standard | 28px/600/Inter Variable | 2 | – | 9 | 18px/1.75×4 |
| planner | 69 | standard | 28px/600/Inter Variable | 1 | 12 · 49 · 48–49 | 7 | 18px/1.75×7, 16px/1.75×1 |
| todos | 117 | standard | 28px/600/Inter Variable | 2 | 42 · 51 · 44–140 | 8 | 18px/1.75×46, 16px/1.75×5, 20px/1.5×1 |
| habits | 117 | standard | 28px/600/Inter Variable | 2 | 4 · 97 · 96–97 | 6 | 18px/1.75×8, 72px/-×4, 20px/1.5×1 |
| timetrack | 117 | standard | 28px/600/Inter Variable | 1 | 1 · 48 · 48–48 | 7 | 18px/1.75×5, 16px/1.75×4, 80px/-×1, 20px/1.5×1 |
| weather | 174 | stage | 28px/600/Inter Variable | 2 | – | 7 | 22px/1.5×24, 14px/1.75×8, 20px/1.5×7, 18px/1.75×4 |
| maps | 117 | standard | 28px/600/Inter Variable | 0 | 8 · 49 · 48–49 | 6 | 18px/1.75×11, 20px/1.5×8 |
| people | 117 | standard | 28px/600/Inter Variable | 2 | 29 · 49 · 48–96 | 7 | 18px/1.75×33, 20px/1.5×1, 16px/1.75×1 |
| fitness | 117 | standard | 28px/600/Inter Variable | 1 | 29 · 48 · 48–49 | 6 | 24px/-×29, 16px/1.75×28, 18px/1.75×4 |
| finance | 117 | standard | 28px/600/Inter Variable | 2 | 18 · 48 · 48–49 | 7 | 18px/1.75×22, 16px/1.75×18, 1038px/-×3 |
| invoices | 117 | standard | 28px/600/Inter Variable | 2 | 7 · 49 · 48–49 | 7 | 18px/1.75×11, 16px/1.75×3, 14px/1.75×2, 20px/1.5×1 |
| subscriptions | 69 | standard | 28px/600/Inter Variable | 0 | 9 · 49 · 48–52 | 8 | 18px/1.75×13, 14px/1.75×2 |
| budgets | 117 | standard | 28px/600/Inter Variable | 0 | – | 6 | 18px/1.75×4 |
| lists | 117 | standard | 28px/600/Inter Variable | 1 | 14 · 45 · 44–45 | 6 | 20px/1.5×14, 18px/1.75×4, 16px/1.75×4 |
| pantry | 117 | standard | 28px/600/Inter Variable | 1 | 14 · 104 · 76–126 | 6 | 16px/1.75×28, 18px/1.75×10 |
| bookmarks | 117 | standard | 28px/600/Inter Variable | 1 | 31 · 49 · 48–49 | 6 | 18px/1.75×35, 16px/1.75×1 |
| notes | 69 | standard | 28px/600/Inter Variable | 1 | – | 6 | 18px/1.75×18, 14px/1.75×6, 16px/1.75×4, 20px/1.5×3 |
| chat | 69 | standard | 28px/600/Inter Variable | 1 | 1 · 44 · 44–44 | 7 | 18px/1.75×3 |
| browser | 69 | standard | 28px/600/Inter Variable | 2 | 5 · 49 · 48–49 | 6 | 20px/1.5×7, 18px/1.75×2 |
| feeds | 69 | standard | 28px/600/Inter Variable | 1 | 6 · 49 · 48–49 | 6 | 18px/1.75×10, 16px/1.75×3 |
| mail | 69 | standard | 28px/600/Inter Variable | 1 | 7 · 70 · 69–159 | 6 | 18px/1.75×9, 16px/1.75×4, 20px/1.5×1 |
| music | 132 | stage | 28px/600/Inter Variable | 2 | – | 8 | 18px/1.75×6, 20px/1.5×3, 28px/1.5×3, 22px/1.5×2 |
| vault | 117 | standard | 28px/600/Inter Variable | 0 | 34 · 129 · 106–150 | 6 | 18px/1.75×4, 16px/1.75×1 |
| accounts | 69 | standard | 28px/600/Inter Variable | 0 | – | 5 | 18px/1.75×3, 32px/1.5×1 |
| disk | 117 | standard | 28px/600/Inter Variable | 2 | – | 7 | 18px/1.75×4, 16px/1.75×4, 72px/-×3 |
| downloads | 69 | standard | 28px/600/Inter Variable | 1 | 3 · 77 · 76–99 | 6 | 20px/1.5×8, 18px/1.75×7 |
| clock | 69 | standard | 28px/600/Inter Variable | 0 | – | 6 | 18px/1.75×9, 20px/1.5×6, 16px/1.75×6 |
| routines | 117 | standard | 28px/600/Inter Variable | 1 | 3 · 49 · 48–49 | 6 | 18px/1.75×4, 16px/1.75×1 |
| device | 69 | standard | 28px/600/Inter Variable | 0 | – | 6 | 20px/1.5×7, 18px/1.75×1 |
| library | 223 | hero | 32px/600/Inter Variable | 1 | – | 8 | 26px/1.5×29, 16px/1.75×1, 18px/1.75×1 |
| library-vault | 133 | compact | 20px/600/Inter Variable | 0 | – | 8 | 20px/1.5×1, 16px/1.75×1 |
| tools | 84 | title | 28px/600/Inter Variable | 1 | – | 7 | 26px/1.5×16, 18px/1.75×4, 20px/1.5×1 |
| settings | 200 | hero | 32px/600/Inter Variable | 1 | – | 6 | 20px/1.5×22, 16px/1.75×1, 18px/1.75×1 |
| settings-einrichtung | 84 | title | 28px/600/Inter Variable | 1 | – | 8 | 20px/1.5×17, 14px/1.75×1 |
| settings-allgemein | 84 | title | 28px/600/Inter Variable | 1 | – | 9 | 20px/1.5×17, 18px/1.75×2, 14px/1.75×1 |
| settings-darstellung | 84 | title | 28px/600/Inter Variable | 1 | – | 8 | 20px/1.5×17, 14px/1.75×1, 18px/1.75×1 |
| settings-barrierefreiheit | 84 | title | 28px/600/Inter Variable | 1 | – | 8 | 20px/1.5×17, 14px/1.75×1, 18px/1.75×1 |
| settings-module | 84 | title | 28px/600/Inter Variable | 2 | – | 6 | 20px/1.5×43, 14px/1.75×1 |
| settings-werkzeuge | 84 | title | 28px/600/Inter Variable | 1 | – | 8 | 20px/1.5×37, 18px/1.75×5, 14px/1.75×1 |
| settings-benachrichtigungen | 84 | title | 28px/600/Inter Variable | 3 | – | 8 | 20px/1.5×17, 14px/1.75×1 |
| settings-sicherheit | 84 | title | 28px/600/Inter Variable | 1 | – | 8 | 20px/1.5×17, 18px/1.75×2, 14px/1.75×1 |
| settings-sync | 84 | title | 28px/600/Inter Variable | 3 | – | 9 | 20px/1.5×17, 14px/1.75×1, 18px/1.75×1, 22px/1.5×1 |
| settings-ki | 84 | title | 28px/600/Inter Variable | 2 | – | 8 | 20px/1.5×17, 18px/1.75×6, 14px/1.75×1, 22px/1.5×1 |
| settings-verbindungen | 84 | title | 28px/600/Inter Variable | 4 | – | 9 | 20px/1.5×17, 18px/1.75×3, 22px/1.5×3, 14px/1.75×1 |
| settings-schnellerfassung | 84 | title | 28px/600/Inter Variable | 1 | – | 8 | 20px/1.5×17, 18px/1.75×2, 14px/1.75×1 |
| settings-updates | 84 | title | 28px/600/Inter Variable | 3 | – | 6 | 20px/1.5×17, 14px/1.75×1, 18px/1.75×1 |
| settings-entwickler | 84 | title | 28px/600/Inter Variable | 3 | – | 8 | 20px/1.5×17, 18px/1.75×2, 14px/1.75×1 |
| settings-ueber | 84 | title | 28px/600/Inter Variable | 2 | – | 9 | 20px/1.5×17, 14px/1.75×2, 80px/34×1 |
| settings-module-finance | 108 | title | 28px/600/Inter Variable | 1 | – | 8 | 20px/1.5×17, 14px/1.75×2 |
| overview-calm | – | – | 28px/600/Inter Variable | 2 | – | 6 | 18px/1.75×7, 16px/1.75×3, 22px/1.5×1 |
| overview-all | 72 | md | 28px/600/Inter Variable | 3 | – | 6 | 16px/1.75×67, 18px/1.75×43, 22px/1.5×37, 72px/-×4 |

### Flächen: Rahmen vs. Schatten vs. Tönung – 1920 dunkel, Seed

| Seite | Rahmen (rundum) | Ringe | Schatten | getönt | neutrale Füllungen | --surface-2 | Verläufe | Radien (px×n) | Animationen | Transitions (Eigenschaft×n) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 0 | 0 | 0 | 3 | 1 | 9 | 0 | 8px×166, 999px×26, 12px×2, 20px×1, 16px×1 | 1 | transform×6 |
| planner | 0 | 0 | 0 | 5 | 0 | 6 | 0 | 8px×14, 12px×4, 16px×3 | 1 | transform×13 |
| todos | 0 | 0 | 0 | 47 | 1 | 50 | 0 | 8px×86, 12px×13, 16px×7 | 1 | transform×60 |
| habits | 0 | 0 | 0 | 3 | 0 | 7 | 0 | 12px×3, 16px×3 | 1 | transform×13 |
| timetrack | 0 | 0 | 0 | 3 | 0 | 4 | 0 | 16px×5, 12px×4 | 1 | transform×7 |
| weather | 0 | 1 | 1 | 40 | 5 | 1 | 4 | 12px×30, 8px×5, 16px×3, 999px×1, 40px×1 | 1 | transform×2 |
| maps | 0 | 2 | 0 | 9 | 0 | 9 | 0 | 8px×16, 999px×4, 12px×2, 16px×1 | 1 | transform×10 |
| people | 0 | 0 | 0 | 5 | 0 | 33 | 17 | 8px×29, 12px×8, 16px×3 | 1 | transform×38 |
| fitness | 0 | 0 | 0 | 28 | 0 | 2 | 0 | 8px×57, 16px×28, 12px×1 | 1 | transform×5 |
| finance | 0 | 0 | 0 | 38 | 0 | 22 | 1 | 8px×36, 16px×19, 999px×4, 12px×2, 20px×1 | 1 | transform×25 |
| invoices | 0 | 0 | 0 | 12 | 1 | 10 | 0 | 8px×17, 12px×9, 16px×4 | 1 | transform×19 |
| subscriptions | 0 | 0 | 0 | 10 | 0 | 21 | 0 | 8px×18, 12px×1, 16px×1 | 1 | transform×21 |
| budgets | 0 | 0 | 0 | 6 | 0 | 4 | 0 | 16px×6, 12px×1 | 1 | transform×10 |
| lists | 0 | 0 | 0 | 14 | 0 | 18 | 0 | 8px×32, 12px×5, 16px×4 | 1 | transform×34 |
| pantry | 14 | 0 | 0 | 6 | 0 | 50 | 0 | 12px×21, 999px×14 | 1 | transform×37 |
| bookmarks | 0 | 0 | 0 | 1 | 0 | 34 | 0 | 8px×31, 12px×2, 16px×1 | 1 | transform×65 |
| notes | 0 | 0 | 0 | 3 | 0 | 20 | 0 | 8px×13, 12px×10, 16px×1, 20px×1, 999px×1 | 1 | transform×24 |
| chat | 0 | 0 | 0 | 2 | 0 | 1 | 0 | 12px×3, 16px×2, 8px×1 | 1 | transform×4 |
| browser | 0 | 0 | 0 | 7 | 0 | 9 | 0 | 12px×10, 8px×6, 16px×1 | 1 | transform×10 |
| feeds | 0 | 0 | 0 | 3 | 0 | 8 | 0 | 8px×9, 16px×3, 12px×1 | 1 | transform×9 |
| mail | 0 | 0 | 0 | 12 | 0 | 11 | 0 | 12px×19, 8px×16, 16px×4, 999px×1 | 1 | transform×21 |
| music | 0 | 0 | 0 | 1 | 0 | 6 | 1 | 12px×5, 16px×1 | 1 | transform×8 |
| vault | 34 | 0 | 0 | 35 | 0 | 2 | 0 | 12px×9, 999px×7, 20px×1 | 1 | transform×10 |
| accounts | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 12px×2 | 1 | transform×2 |
| disk | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 12px×6, 16px×4 | 1 | transform×6 |
| downloads | 0 | 0 | 0 | 2 | 0 | 9 | 0 | 12px×3, 8px×3, 20px×1, 999px×1, 16px×1 | 1 | transform×14 |
| clock | 0 | 0 | 0 | 1 | 0 | 13 | 0 | 16px×2, 12px×1 | 1 | transform×14 |
| routines | 0 | 0 | 0 | 1 | 0 | 2 | 0 | 8px×4, 12px×1, 16px×1 | 1 | transform×6 |
| device | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8px×7 | 1 |  |
| library | 0 | 0 | 0 | 83 | 2 | 28 | 3 | 12px×51, 16px×29, 8px×27, 20px×2 | 1 | transform×49 |
| library-vault | 0 | 0 | 0 | 3 | 0 | 1 | 1 | 16px×2, 12px×2, 20px×1, 8px×1 | 1 | transform×2 |
| tools | 0 | 0 | 0 | 19 | 1 | 16 | 0 | 12px×5, 16px×3, 20px×1 | 1 | transform×24 |
| settings | 0 | 0 | 0 | 6 | 0 | 0 | 1 | 12px×18, 8px×6, 999px×6, 20px×5, 16px×1 | 1 |  |
| settings-einrichtung | 0 | 0 | 0 | 2 | 0 | 1 | 1 | 12px×23, 16px×1 | 1 | transform×7 |
| settings-allgemein | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 12px×46, 999px×2, 20px×1 | 1 | transform×27 |
| settings-darstellung | 0 | 0 | 0 | 23 | 2 | 29 | 0 | 12px×31, 999px×13, 8px×10, 20px×9, 16px×2 | 1 | transform×34 |
| settings-barrierefreiheit | 0 | 0 | 0 | 10 | 0 | 9 | 0 | 12px×21, 999px×12, 20px×8 | 1 | transform×18 |
| settings-module | 0 | 0 | 0 | 2 | 0 | 1 | 0 | 8px×26, 12px×17, 16px×1 | 1 |  |
| settings-werkzeuge | 0 | 0 | 0 | 1 | 0 | 20 | 0 | 12px×22 | 1 | transform×28 |
| settings-benachrichtigungen | 0 | 0 | 0 | 15 | 0 | 3 | 0 | 12px×28, 999px×9, 16px×7, 20px×6 | 1 | transform×29 |
| settings-sicherheit | 0 | 0 | 0 | 3 | 0 | 2 | 0 | 12px×19, 999px×8, 20px×2 | 1 | transform×3 |
| settings-sync | 1 | 0 | 0 | 7 | 0 | 0 | 0 | 12px×28, 16px×5 | 1 | transform×7 |
| settings-ki | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 12px×26, 16px×3, 999px×2, 20px×1 | 1 | transform×22 |
| settings-verbindungen | 1 | 0 | 0 | 14 | 0 | 3 | 0 | 12px×41, 16px×9 | 1 | transform×59 |
| settings-schnellerfassung | 0 | 0 | 0 | 6 | 0 | 1 | 0 | 12px×19, 999px×3, 16px×2 | 1 | transform×2 |
| settings-updates | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 12px×18, 16px×4 | 1 | transform×1 |
| settings-entwickler | 1 | 0 | 0 | 2 | 0 | 1 | 0 | 12px×24, 16px×2 | 1 | transform×5 |
| settings-ueber | 1 | 0 | 0 | 4 | 0 | 1 | 0 | 12px×44, 16px×2, 999px×1 | 1 | transform×18 |
| settings-module-finance | 0 | 0 | 0 | 4 | 0 | 1 | 0 | 12px×19, 999px×3, 16px×2, 20px×1 | 1 | transform×5 |
| overview-calm | 0 | 2 | 0 | 5 | 0 | 3 | 3 | 12px×5, 16px×5, 20px×1, 999px×1 | 1 | transform×9 |
| overview-all | 1 | 2 | 0 | 49 | 0 | 38 | 0 | 16px×40, 12px×29, 8px×3, 20px×1, 999px×1 | 1 | transform×68 |

### Dialoge – 1920 dunkel, Seed

| Modul | Auslöser | Titel | Felder | Knöpfe | Breite×Höhe | Primär |
| --- | --- | --- | --- | --- | --- | --- |
| calendar | Termin eintragen | Termin eintragen | 5 | 13 | 544×651 | Termin eintragen |
| planner | – | – | – | – | – | – |
| todos | Aufgabe eintragen | Aufgabe eintragen | 1 | 3 | 544×282 | Aufgabe eintragen |
| habits | Gewohnheit eintragen | Gewohnheit eintragen | 3 | 8 | 544×565 | Gewohnheit eintragen |
| timetrack | Zeit eintragen | Zeit eintragen | 6 | 5 | 544×590 | Zeit eintragen |
| weather | Ort hinzufügen | Ort hinzufügen | 1 | 2 | 544×270 |  |
| maps | Ort eintragen | Die Karte lädt Kartenkacheln | 0 | 2 | 544×385 | Verstanden |
| people | Person eintragen | Person eintragen | 5 | 5 | 544×509 | Person eintragen |
| fitness | Einheit eintragen | Einheit eintragen | 9 | 13 | 544×726 | Einheit eintragen |
| finance | Buchung eintragen | Buchung eintragen | 3 | 6 | 544×533 | Buchung eintragen |
| invoices | Rechnung eintragen | Rechnung eintragen | 5 | 8 | 544×575 | Rechnung eintragen |
| subscriptions | Abo eintragen | Abo eintragen | 5 | 5 | 544×506 | Abo eintragen |
| budgets | Budget eintragen | Budget eintragen | 2 | 4 | 544×397 | Budget eintragen |
| lists | Neue Liste | Neue Liste | 3 | 3 | 544×476 | Speichern |
| pantry | Vorrat eintragen | Vorrat eintragen | 6 | 5 | 544×590 | Vorrat eintragen |
| bookmarks | Merkzettel eintragen | Merkzettel eintragen | 2 | 4 | 544×397 | Merkzettel eintragen |
| notes | Neues Notizbuch | Neues Notizbuch | 1 | 21 | 544×485 | Speichern |
| chat | – | – | – | – | – | – |
| browser | – | – | – | – | – | – |
| feeds | Feed eintragen | Feed eintragen | 3 | 3 | 544×479 | Feed eintragen |
| mail | – | – | – | – | – | – |
| music | – | – | – | – | – | – |
| vault | Unterlage eintragen | Unterlage eintragen | 11 | 5 | 544×819 | Unterlage eintragen |
| accounts | – | – | – | – | – | – |
| disk | – | – | – | – | – | – |
| downloads | Download eintragen | Download eintragen | 3 | 4 | 544×506 | Herunterladen |
| clock | Ort eintragen | Ort eintragen | 1 | 1 | 544×226 |  |
| routines | Routine eintragen | Routine eintragen | 4 | 11 | 544×643 | Routine eintragen |
| device | – | – | – | – | – | – |

### Zustände (Rechnungen, 1920 dunkel)

```json
{
 "rest": {
  "bg": "color(srgb 0.138667 0.161726 0.180863)",
  "shadow": "none",
  "transform": "none",
  "outline": "none 3px",
  "transition": "all 0s"
 },
 "hover": {
  "bg": "color(srgb 0.138667 0.161726 0.180863)",
  "shadow": "none",
  "transform": "none",
  "outline": "none 3px",
  "transition": "all 0s"
 },
 "hoverActions": [
  "Stadtwerke Musterstadt\nFällig am: Do., 17. Sep. · SW-2026-1000 · 1. Mahnung",
  "Als bezahlt markieren",
  "Weitere Aktionen"
 ],
 "focusInfo": {
  "tag": "A",
  "name": "Zur Übersicht",
  "outline": "solid 2px 2px",
  "focusVisible": true
 },
 "press": {
  "transform": "matrix(0.970727, 0, 0, 0.970727, 0, 0)",
  "bg": "rgb(255, 176, 122)",
  "transition": "transform"
 }
}
```

### axe (serious/critical) – 1920 dunkel, Seed

| Seite | Regel | Schwere | n | Erstes Ziel |
| --- | --- | --- | --- | --- |

### Widget-Größen (Übersicht „Ausführlich“, 1920)

| Widget | Breite | Höhe |
| --- | --- | --- |
| todos:next | 781 | 382 |
| planner:week | 781 | 315 |
| todos:open | 781 | 393 |
| habits:today | 781 | 301 |
| finance:balance | 379 | 201 |
| finance:month | 379 | 228 |
| timetrack:timer | 781 | 211 |
| weather:today | 379 | 205 |
| clock:places | 781 | 282 |
| invoices:due | 781 | 395 |
| subscriptions:next | 781 | 335 |
| bookmarks:recent | 379 | 278 |
| bookmarks:links | 781 | 330 |
| notes:recent | 379 | 260 |
| chat:recent | 379 | 181 |
| lists:open | 379 | 289 |
| lists:packing | 379 | 224 |
| routines:due | 379 | 289 |
| pantry:expiring | 379 | 366 |
| fitness:week | 379 | 163 |
| browser:bookmarks | 379 | 254 |
| feeds:summary | 379 | 205 |
| mail:inbox | 781 | 237 |
| maps:places | 379 | 225 |
| people:next | 379 | 263 |
| budgets:overview | 781 | 347 |
| add-expense | 98 | 32 |
| vault:expiring | 379 | 205 |
| accounts:status | 379 | 163 |
| music:player | 379 | 168 |
| device:status | 379 | 130 |
| disk:status | 379 | 208 |
| disk:system | 379 | 234 |
| downloads:running | 379 | 224 |

### Handy: Köpfe und Zeilenhöhen – 412 dunkel, Seed

| Seite | Kopf px | Inhalt ab y | Zeilen (n · Median · min–max) |
| --- | --- | --- | --- |
| calendar | 141 | 334 | – |
| planner | 93 | 328 | 5 · 57 · 56–57 |
| todos | 141 | 218 | 42 · 59 · 56–202 |
| habits | 141 | 266 | – |
| timetrack | 141 | 345 | 1 · 56 · 56–56 |
| weather | 278 | 105 | – |
| maps | 141 | 434 | 8 · 57 · 56–78 |
| people | 141 | 282 | 28 · 57 · 57–78 |
| fitness | 141 | 266 | 29 · 77 · 56–119 |
| finance | 141 | 343 | – |
| invoices | 141 | 266 | 7 · 58 · 56–81 |
| subscriptions | 93 | 234 | 9 · 57 · 56–78 |
| budgets | 141 | 274 | – |
| lists | 141 | 342 | 14 · 57 · 56–109 |
| pantry | 141 | 259 | 14 · 98 · 76–126 |
| bookmarks | 141 | 322 | 31 · 83 · 57–104 |
| notes | 93 | – | – |
| chat | 93 | 174 | 1 · 59 · 59–59 |
| feeds | 93 | 278 | 6 · 57 · 56–57 |
| music | 204 | 603 | – |
| vault | 141 | 396 | 34 · 106 · 84–150 |
| accounts | 93 | – | – |
| clock | 93 | – | – |
| routines | 141 | 266 | 3 · 78 · 77–78 |
| device | 49 | 130 | – |
| library | 232 | 93 | – |
| library-vault | 209 | 145 | – |
| tools | 120 | 217 | – |
| settings | 248 | 169 | – |
| settings-einrichtung | 96 | 306 | – |
| settings-allgemein | 72 | 319 | – |
| settings-darstellung | 72 | 319 | – |
| settings-barrierefreiheit | 72 | 390 | – |
| settings-module | 72 | 368 | – |
| settings-werkzeuge | 72 | 368 | – |
| settings-benachrichtigungen | 72 | 319 | – |
| settings-sicherheit | 72 | 319 | – |
| settings-sync | 72 | 319 | – |
| settings-ki | 72 | 319 | – |
| settings-verbindungen | 72 | 380 | – |
| settings-schnellerfassung | 72 | 282 | – |
| settings-updates | 72 | 319 | – |
| settings-entwickler | 72 | 319 | – |
| settings-ueber | 72 | 290 | – |
| settings-module-finance | 96 | 314 | – |
| overview-calm | – | 284 | – |
| overview-all | 72 | 240 | – |

### Layout-Sprung (CLS) über alle Läufe – nur Werte, die in mindestens zwei Läufen ≥ 0,05 sind

| Seite | Läufe mit CLS ≥ 0,05 |
| --- | --- |
| page-weather | D-light/seed 0.62, P-dark/seed 0.86, P-light/seed 0.86 |
| page-lists | D-light/seed 0.32, P-light/seed 0.64 |
| page-chat | P-dark/empty 0.11, P-light/empty 0.10 |

### Handy: kleine Ziele (< 40 px) und abgeschnittener Text – 412 dunkel, Seed

| Seite | klein n | Beispiele | abgeschnitten n | Beispiele |
| --- | --- | --- | --- | --- |
| page-calendar | 0 |  | 31 | _cellLabel_1979e_129 | Vertragsende: 1 Unterlage; _cellLabel_1979e_129 | Kündigungsfrist: Streaming Plus |
| page-calendar--v-monat | 0 |  | 31 | _cellLabel_1979e_129 | Vertragsende: 1 Unterlage; _cellLabel_1979e_129 | Kündigungsfrist: Streaming Plus |
| page-calendar--v-plan | 0 |  | 1 | _detail_cxqqv_31 | Heute: Stadtwerke Musterstadt bezahlen. Das reicht für heute. |
| page-calendar--v-arbeit | 0 |  | 31 | _cellLabel_1979e_129 | Vertragsende: 1 Unterlage; _cellLabel_1979e_129 | Kündigungsfrist: Streaming Plus |
| page-calendar--v-familie | 0 |  | 31 | _cellLabel_1979e_129 | Vertragsende: 1 Unterlage; _cellLabel_1979e_129 | Kündigungsfrist: Streaming Plus |
| dialog-calendar | 0 |  | 1 | _recentTitle_1979e_425 | Zahnarzt Dr. Beispiel |
| page-planner | 2 | 24×24 _check_9n1q8_91 | Termin vereinbaren 9; 24×24 _check_9n1q8_91 | Bücher aussortieren 22 | 1 | _detail_cxqqv_31 | Heute: Stadtwerke Musterstadt bezahlen. Das reicht für heute. |
| page-todos | 9 | 24×24 _check_aw6sk_88 | Recherche 16; 24×24 _check_aw6sk_88 | Bücher aussortieren 18 | 0 |  |
| page-invoices | 0 |  | 4 | _title_s8esv_224 | Stadtwerke Musterstadt; _title_s8esv_224 | Internet & Telefon Küstennetz |
| page-pantry | 0 |  | 1 | _detail_cxqqv_31 | 1 abgelaufen · 3 laufen bald ab · 6 werden knapp |
| page-notes | 0 |  | 3 | _meta_g4c5w_102 | Diese Woche Einkauf erledigt Paket abholen Steuerunterlagen sortieren Tag Plan M; _meta_g4c5w_102 | Überschrift 1 Überschrift 2 Fett, kursiv, durchgestrichen und Code. Erster Schri |
| page-notes--v-liste | 0 |  | 3 | _meta_g4c5w_102 | Diese Woche Einkauf erledigt Paket abholen Steuerunterlagen sortieren Tag Plan M; _meta_g4c5w_102 | Überschrift 1 Überschrift 2 Fett, kursiv, durchgestrichen und Code. Erster Schri |
| page-notes--v-karten | 0 |  | 14 | _meta_g4c5w_102 | Fliesenformat klären, Preis für die Dusche, Dauer der Arbeiten, Terminvorschlag.; _meta_g4c5w_102 | Montag Nudeln, Dienstag Suppe, Mittwoch Ofengemüse. Vorkochen am Sonntag. |
| page-music | 1 | 88×29  | Testlied | 0 |  |
| page-library | 3 | 61×32  | Alle; 71×32  | Aktiv | 0 |  |
| page-tools | 3 | 61×32  | Alle; 71×32  | Aktiv | 0 |  |
| page-settings-allgemein | 2 | 91×32  | Montag; 96×32  | Sonntag | 0 |  |
| page-settings-darstellung | 14 | 90×32  | System; 61×32  | Hell | 0 |  |
| page-settings-barrierefreiheit | 7 | 88×32  | Normal; 70×32  | Klein | 0 |  |
| page-settings-module | 1 | 182×26  | Modul-Bibliothek öffnen | 0 |  |
| page-settings-benachrichtigungen | 3 | 62×32  | Aus; 97×32  | 1 Stunde | 0 |  |
| page-settings-ki | 2 | 162×32  | Nur dieses Gerät; 228×32  | Alle Geräte dieses Kontos | 0 |  |
| page-settings-module-finance | 3 | 156×32  | Bis Monatsende; 94×32  | 30 Tage | 1 | _description_ti5y4_71 | Konten, Einnahmen und Ausgaben mit Kategorien, Monatsübersicht mit Diagrammen un |
| overview-calm | 2 | 76×32  | Ruhig; 120×32  | Ausführlich | 0 |  |
| overview-all | 2 | 76×32  | Ruhig; 122×32  | Ausführlich | 0 |  |
| setup-1 | 3 | 13×13  | INPUT; 13×13  | INPUT | 0 |  |

Überlauf 1920x1080-dark seed: keiner

Überlauf 1920x1080-dark empty: keiner

Überlauf 1920x1080-light seed: keiner

Überlauf 1920x1080-light empty: keiner

Überlauf 412x915-dark seed: keiner

Überlauf 412x915-dark empty: keiner

Überlauf 412x915-light seed: keiner

Überlauf 412x915-light empty: keiner

## Vorher – Audit 2026-11 (develop ebbf705, 26 Module)

Definitionen (aus `audit-tour.spec.ts` `measure()`, je Ansicht im Element `#main`, also ohne Seitenleiste und Topbar): **Aktionen** = sichtbare button/a[href]/input/select/textarea/[role=button|tab|switch|checkbox|menuitem], deren Box im ersten Bildschirm liegt (Oberkante über der Fensterhöhe, Unterkante über 0); **Chrome** = davon ohne Vorfahren li/[data-row]/table/[role=gridcell|grid]/article/Widget/dialog (also Navigation, Toolbars, Kopf) – gezählt über den ganzen Falz, nicht nur oberhalb des Inhalts; **Inhalt ab y** = kleinste Oberkante (> 60 px) eines sichtbaren Listen-/Tabellen-/Raster-/Artikel-/Widget-/Karten-/Canvas-Elements in `#main`, das nicht in nav/[role=tablist]/dialog/aside/Kopfband liegt (fehlt, wenn die Seite keines hat); **Kopf px** = Höhe des ersten `[data-size]`-Elements (Kopfband bzw. Kopfkarte); **Primär** = Knöpfe/Links mit Klasse `primary`; **Farbe Text/Icon/Fläche** = Elemente über dem Falz, deren Text-/Icon-/Hintergrundfarbe nicht eine der neutralen Tinten (--text, --text-muted, --text-3, --text-on-tint bzw. --bg, --surface, --surface-2) ist und Sättigung > 0,25 (Text/Icon) bzw. > 0,12 (Fläche); `color(srgb …)`-Werte aus `color-mix()` werden geparst; **Verläufe** = Elemente mit `background-image: …gradient` (Kopfband, Bank-Karten, Avatar-Ringe); **Wörter/Zeichen** = Textknoten sichtbarer Elemente über dem Falz; **Schriftgrößen/Gewichte** = verschiedene Werte an Textblättern über dem Falz; **Abstandswerte** = verschiedene gap/rowGap/paddingTop/paddingLeft-Werte sichtbarer Elemente (erste 2 500); **Rahmen** = gleiche Breite > 0 und `solid` auf allen vier Seiten mit sichtbarer Farbe (Alpha > 0,05), Element ≥ 40×24 px, keine input/select/textarea/button; **Ring** = `box-shadow`, dessen Segmente alle ohne Versatz und ohne Weichzeichnung sind (0 0 0 n px, inset oder nicht); **Schatten** = jeder andere `box-shadow` (ein inset mit Weichzeichnung zählt als Schatten); **getönt** = Hintergrund weder --bg/--surface/--surface-2 noch transparent, Sättigung > 0,12 (ohne button/input/select/tab); **neutrale Füllungen** = dasselbe ohne Sättigung (Hover, Bahnen, Scrims; nur in den facts); **--surface-2** separat; **Zeilen** = `[data-row]`-Elemente, Höhe des umschließenden `li` (sonst des Elements), Median/min/max; **CLS** = laufende Summe aller `layout-shift`-Einträge ohne kürzliche Eingabe seit `page.goto` der Ansicht (bei Reiter-Ansichten kumuliert seit dem Laden der Seite); Flächen-/Zeilen-/Bewegungs-Zählung über die ganze Seite, nicht nur den Falz, aber höchstens die ersten 6 000 Elemente von `#main` (`all.slice(0, 6000)`); **Inhalt ab y** schließt nur das Modul-Kopfband (`module-frame`) aus – auf Bibliothek, Werkzeugen und Einstellungen (93/169/174) liegen die gemessenen Elemente in der Kopfkarte; **Animationen** = Elemente mit `animationName ≠ none` (auch beendete Einblendungen), auf 10 gekappt; **CLS** bei Dialogen kumuliert seit dem Laden der Seite (ab dem nächsten Lauf: vor Palette und Werkzeug-Panel auf 0 gesetzt). Seed = Testdaten „medium“, alle Module an; Desktop posiert als Windows-App in Linux-Headless-Chromium.

### Reizlast über dem Falz – 1920x1080-dark, seed

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 147 | 25 | 506 | 241 | 1 | 10 | 104 | 2 | 3 | 363 | 2130 | 8 | 4 | 0.02 |
| planner | 48 | 20 | 559 | 211 | 1 | 4 | 20 | 2 | 2 | 283 | 1486 | 8 | 4 | 0.00 |
| todos | 59 | 21 | 589 | 240 | 1 | 2 | 16 | 2 | 3 | 139 | 769 | 8 | 4 | 0.01 |
| habits | 22 | 14 | 436 | 231 | 1 | 2 | 3 | 2 | 3 | 58 | 351 | 7 | 4 | 0.01 |
| timetrack | 19 | 18 | 460 | 233 | 1 | 2 | 10 | 2 | 3 | 45 | 290 | 6 | 4 | 0.01 |
| weather | 11 | 11 | 105 | 304 | 0 | 5 | 21 | 5 | 5 | 266 | 1361 | 9 | 5 | 0.00 |
| maps | 39 | 23 | 671 | 274 | 1 | 2 | 16 | 2 | 4 | 92 | 635 | 8 | 4 | 0.00 |
| people | 64 | 16 | 479 | 146 | 1 | 2 | 4 | 26 | 4 | 333 | 1552 | 7 | 4 | 0.00 |
| fitness | 23 | 16 | 546 | 233 | 1 | 2 | 3 | 2 | 8 | 148 | 603 | 8 | 4 | 0.01 |
| finance | 28 | 21 | 687 | 292 | 1 | 9 | 6 | 4 | 6 | 133 | 819 | 9 | 4 | 0.01 |
| invoices | 37 | 16 | 415 | 146 | 1 | 5 | 13 | 2 | 7 | 168 | 1020 | 9 | 4 | 0.01 |
| subscriptions | 33 | 9 | 491 | 261 | 1 | 4 | 26 | 4 | 5 | 260 | 1419 | 8 | 4 | 0.01 |
| budgets | 18 | 12 | 502 | 233 | 1 | 3 | 25 | 2 | 3 | 113 | 498 | 6 | 4 | 0.01 |
| lists | 36 | 21 | 714 | 237 | 1 | 2 | 8 | 2 | 3 | 85 | 447 | 8 | 4 | 0.00 |
| pantry | 49 | 11 | 543 | 233 | 1 | 6 | 23 | 2 | 3 | 124 | 643 | 9 | 4 | 0.01 |
| bookmarks | 48 | 15 | 574 | 249 | 1 | 2 | 4 | 2 | 3 | 146 | 947 | 9 | 4 | 0.01 |
| notes | 35 | 35 | – | 142 | 1 | 2 | 13 | 2 | 3 | 147 | 1016 | 8 | 3 | 0.01 |
| chat | 13 | 12 | 368 | 163 | 1 | 1 | 9 | 2 | 2 | 52 | 361 | 5 | 3 | 0.03 |
| browser | 28 | 16 | 554 | 118 | 0 | 0 | 2 | 1 | 1 | 62 | 599 | 7 | 3 | 0.01 |
| feeds | 26 | 14 | 634 | 233 | 1 | 1 | 11 | 2 | 3 | 54 | 453 | 9 | 4 | 0.01 |
| mail | 27 | 20 | 710 | 141 | 1 | 1 | 5 | 1 | 3 | 113 | 703 | 9 | 4 | 0.01 |
| music | 26 | 24 | 599 | 363 | 0 | 0 | 7 | 2 | 2 | 44 | 288 | 6 | 3 | 0.00 |
| vault | 35 | 17 | 634 | 233 | 1 | 13 | 25 | 2 | 3 | 288 | 1628 | 9 | 4 | 0.00 |
| accounts | 5 | 5 | – | 141 | 1 | 1 | 3 | 2 | 1 | 19 | 148 | 5 | 4 | 0.01 |
| disk | 10 | 4 | 502 | 238 | 0 | 3 | 2 | 1 | 2 | 175 | 930 | 9 | 4 | 0.13 |
| downloads | 18 | 10 | 415 | 165 | 1 | 2 | 7 | 1 | 1 | 87 | 564 | 5 | 4 | 0.01 |
| library | 17 | 6 | 93 | 223 | 0 | 1 | 56 | 3 | 9 | 157 | 1093 | 7 | 3 | 0.01 |
| library-vault | 4 | 4 | 145 | 133 | 0 | 0 | 11 | 2 | 1 | 53 | 379 | 6 | 3 | 0.01 |
| tools | 24 | 4 | 93 | 207 | 0 | 1 | 22 | 1 | 9 | 172 | 1204 | 7 | 3 | 0.01 |
| settings | 36 | 12 | 174 | 368 | 0 | 4 | 19 | 1 | 14 | 126 | 862 | 6 | 3 | 0.01 |
| settings-einrichtung | 35 | 19 | 174 | 133 | 1 | 5 | 19 | 2 | 11 | 115 | 808 | 7 | 3 | 0.01 |
| settings-allgemein | 45 | 18 | 174 | 133 | 0 | 5 | 17 | 1 | 11 | 187 | 1280 | 6 | 3 | 0.05 |
| settings-darstellung | 67 | 46 | 174 | 133 | 0 | 22 | 34 | 1 | 11 | 459 | 3009 | 6 | 4 | 0.00 |
| settings-barrierefreiheit | 42 | 23 | 174 | 133 | 0 | 9 | 18 | 1 | 11 | 197 | 1373 | 7 | 3 | 0.00 |
| settings-module | 47 | 13 | 174 | 133 | 0 | 5 | 35 | 1 | 29 | 144 | 1060 | 7 | 3 | 0.00 |
| settings-werkzeuge | 64 | 48 | 174 | 133 | 0 | 4 | 30 | 1 | 20 | 192 | 1453 | 6 | 3 | 0.00 |
| settings-benachrichtigungen | 44 | 23 | 174 | 133 | 1 | 8 | 20 | 1 | 11 | 188 | 1323 | 7 | 3 | 0.05 |
| settings-sicherheit | 41 | 25 | 174 | 133 | 0 | 7 | 17 | 1 | 11 | 291 | 2101 | 5 | 3 | 0.00 |
| settings-sync | 32 | 16 | 174 | 133 | 0 | 4 | 18 | 1 | 11 | 148 | 1027 | 7 | 3 | 0.00 |
| settings-ki | 40 | 16 | 174 | 133 | 0 | 6 | 20 | 1 | 11 | 216 | 1500 | 7 | 3 | 0.00 |
| settings-verbindungen | 38 | 14 | 174 | 133 | 0 | 4 | 17 | 1 | 11 | 171 | 1221 | 7 | 3 | 0.00 |
| settings-schnellerfassung | 33 | 17 | 174 | 133 | 0 | 4 | 18 | 1 | 11 | 187 | 1188 | 8 | 3 | 0.00 |
| settings-updates | 29 | 13 | 174 | 133 | 0 | 4 | 17 | 1 | 11 | 235 | 1663 | 6 | 4 | 0.00 |
| settings-entwickler | 34 | 18 | 174 | 133 | 1 | 5 | 17 | 1 | 11 | 169 | 1215 | 7 | 3 | 0.00 |
| settings-ueber | 42 | 13 | 174 | 133 | 0 | 5 | 17 | 1 | 12 | 140 | 1037 | 5 | 4 | 0.01 |
| settings-module-finance | 38 | 21 | 174 | 173 | 0 | 5 | 20 | 2 | 12 | 198 | 1404 | 5 | 3 | 0.00 |
| übersicht-ruhig | 25 | 8 | 240 | – | 1 | 5 | 14 | 3 | 7 | 126 | 689 | 5 | 4 | 0.06 |
| übersicht-ausführlich | 34 | 6 | 240 | 72 | 1 | 5 | 28 | 3 | 9 | 189 | 979 | 6 | 4 | 0.18 |

### Reizlast über dem Falz – 412x915-dark, seed

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 53 | 25 | 569 | 200 | 1 | 3 | 53 | 2 | 2 | 96 | 327 | 7 | 4 | 0.00 |
| planner | 21 | 20 | 778 | 268 | 1 | 1 | 17 | 2 | 1 | 94 | 491 | 7 | 4 | 0 |
| todos | 36 | 21 | 584 | 243 | 1 | 2 | 11 | 2 | 2 | 88 | 518 | 7 | 4 | 0 |
| habits | 22 | 14 | 533 | 280 | 1 | 2 | 3 | 2 | 2 | 56 | 340 | 6 | 4 | 0.00 |
| timetrack | 19 | 18 | 572 | 297 | 1 | 2 | 10 | 2 | 2 | 43 | 279 | 6 | 4 | 0.05 |
| weather | 11 | 11 | 105 | 336 | 0 | 1 | 8 | 5 | 4 | 216 | 1037 | 9 | 5 | 0.00 |
| maps | 27 | 23 | 846 | 349 | 1 | 2 | 10 | 2 | 3 | 53 | 321 | 8 | 4 | 0 |
| people | 24 | 16 | 554 | 169 | 1 | 2 | 4 | 6 | 3 | 79 | 426 | 7 | 4 | 0.00 |
| fitness | 18 | 13 | 632 | 271 | 1 | 2 | 3 | 2 | 4 | 79 | 353 | 7 | 4 | 0.00 |
| finance | 16 | 16 | 834 | 344 | 1 | 6 | 3 | 3 | 2 | 54 | 335 | 9 | 4 | 0.07 |
| invoices | 18 | 14 | 687 | 314 | 1 | 5 | 5 | 2 | 6 | 75 | 459 | 8 | 4 | 0.00 |
| subscriptions | 15 | 9 | 523 | 244 | 1 | 3 | 8 | 4 | 3 | 72 | 385 | 8 | 4 | 0.19 |
| budgets | 14 | 12 | 681 | 364 | 1 | 3 | 15 | 2 | 2 | 56 | 273 | 6 | 4 | 0.00 |
| lists | 21 | 19 | 858 | 308 | 1 | 2 | 7 | 2 | 2 | 62 | 332 | 7 | 4 | 0 |
| pantry | 20 | 11 | 642 | 280 | 1 | 5 | 14 | 2 | 2 | 52 | 268 | 8 | 4 | 0.00 |
| bookmarks | 23 | 13 | 661 | 288 | 1 | 2 | 4 | 2 | 2 | 62 | 429 | 8 | 4 | 0.00 |
| notes | 27 | 27 | – | 133 | 1 | 2 | 11 | 2 | 2 | 119 | 795 | 6 | 3 | 0.00 |
| chat | 11 | 10 | 356 | 159 | 1 | 1 | 9 | 2 | 1 | 49 | 342 | 5 | 3 | 0.01 |
| feeds | 17 | 11 | 690 | 306 | 1 | 1 | 11 | 2 | 2 | 37 | 316 | 9 | 4 | 0 |
| music | 22 | 22 | 710 | 208 | 0 | 0 | 5 | 2 | 1 | 32 | 210 | 6 | 3 | 0 |
| vault | 18 | 17 | 817 | 307 | 1 | 1 | 13 | 2 | 2 | 72 | 430 | 7 | 4 | 0.00 |
| accounts | 5 | 5 | – | 141 | 1 | 1 | 3 | 2 | 1 | 18 | 142 | 5 | 4 | 0 |
| library | 9 | 6 | 93 | 232 | 0 | 1 | 6 | 1 | 3 | 57 | 421 | 7 | 3 | 0 |
| library-vault | 4 | 4 | 145 | 209 | 0 | 0 | 11 | 2 | 1 | 53 | 379 | 6 | 3 | 0 |
| tools | 8 | 4 | 93 | 212 | 0 | 1 | 6 | 1 | 3 | 65 | 437 | 7 | 3 | 0 |
| settings | 19 | 12 | 169 | 338 | 0 | 4 | 1 | 1 | 2 | 57 | 361 | 5 | 3 | 0 |
| settings-einrichtung | 6 | 6 | 169 | 137 | 1 | 2 | 3 | 2 | 2 | 39 | 302 | 7 | 3 | 0 |
| settings-allgemein | 7 | 7 | 169 | 113 | 0 | 2 | 0 | 1 | 2 | 75 | 500 | 5 | 3 | 0.00 |
| settings-darstellung | 19 | 19 | 169 | 113 | 0 | 14 | 12 | 1 | 2 | 232 | 1527 | 6 | 4 | 0.00 |
| settings-barrierefreiheit | 9 | 9 | 169 | 113 | 0 | 3 | 1 | 1 | 2 | 100 | 707 | 6 | 3 | 0.01 |
| settings-module | 7 | 3 | 169 | 113 | 0 | 2 | 4 | 1 | 5 | 60 | 480 | 7 | 3 | 0.00 |
| settings-werkzeuge | 14 | 14 | 169 | 113 | 0 | 1 | 7 | 1 | 5 | 77 | 576 | 6 | 3 | 0.00 |
| settings-benachrichtigungen | 6 | 6 | 169 | 113 | 1 | 3 | 3 | 1 | 2 | 86 | 614 | 7 | 3 | 0.00 |
| settings-sicherheit | 7 | 7 | 169 | 137 | 0 | 3 | 0 | 1 | 2 | 107 | 758 | 5 | 3 | 0.01 |
| settings-sync | 5 | 5 | 169 | 113 | 0 | 1 | 2 | 1 | 2 | 69 | 520 | 7 | 3 | 0.00 |
| settings-ki | 6 | 6 | 169 | 113 | 0 | 3 | 3 | 1 | 2 | 89 | 648 | 7 | 3 | 0.12 |
| settings-verbindungen | 3 | 3 | 169 | 113 | 0 | 1 | 0 | 1 | 2 | 79 | 566 | 7 | 3 | 0.00 |
| settings-schnellerfassung | 5 | 5 | 169 | 113 | 0 | 1 | 1 | 1 | 2 | 79 | 482 | 7 | 3 | 0.04 |
| settings-updates | 3 | 3 | 169 | 113 | 0 | 1 | 1 | 1 | 2 | 84 | 593 | 6 | 4 | 0.00 |
| settings-entwickler | 6 | 6 | 169 | 113 | 1 | 2 | 1 | 1 | 2 | 84 | 608 | 6 | 3 | 0.00 |
| settings-ueber | 3 | 3 | 169 | 113 | 0 | 2 | 1 | 1 | 3 | 43 | 335 | 5 | 4 | 0.08 |
| settings-module-finance | 5 | 5 | 169 | 249 | 0 | 1 | 4 | 2 | 3 | 97 | 721 | 5 | 3 | 0 |
| übersicht-ruhig | 14 | 5 | 365 | – | 0 | 3 | 9 | 3 | 6 | 77 | 431 | 5 | 4 | 0 |
| übersicht-ausführlich | 15 | 5 | 365 | 72 | 0 | 3 | 10 | 3 | 6 | 80 | 449 | 5 | 4 | 0.25 |

### Reizlast über dem Falz – 1920x1080-dark, empty

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 58 | 23 | 551 | 286 | 1 | 5 | 17 | 2 | 3 | 116 | 439 | 7 | 4 | 0.04 |
| planner | 19 | 19 | – | 211 | 1 | 1 | 10 | 2 | 2 | 122 | 522 | 8 | 4 | 0.01 |
| todos | 19 | 19 | – | 180 | 0 | 1 | 5 | 2 | 3 | 42 | 255 | 7 | 4 | 0.01 |
| habits | 15 | 15 | – | 200 | 1 | 2 | 3 | 2 | 2 | 42 | 298 | 4 | 3 | 0.02 |
| timetrack | 15 | 15 | – | 233 | 1 | 2 | 3 | 2 | 2 | 43 | 280 | 6 | 4 | 0.01 |
| weather | 11 | 11 | – | 200 | 1 | 1 | 3 | 5 | 1 | 40 | 255 | 4 | 4 | 0.01 |
| maps | 14 | 14 | – | 233 | 1 | 2 | 4 | 2 | 4 | 35 | 201 | 6 | 4 | 0.01 |
| people | 13 | 13 | – | 140 | 1 | 1 | 4 | 2 | 4 | 30 | 211 | 5 | 3 | 0.02 |
| fitness | 10 | 10 | – | 206 | 1 | 2 | 3 | 2 | 3 | 40 | 241 | 7 | 4 | 0.01 |
| finance | 14 | 14 | 660 | 292 | 1 | 5 | 3 | 3 | 3 | 57 | 316 | 8 | 4 | 0.02 |
| invoices | 13 | 13 | – | 140 | 1 | 2 | 4 | 2 | 3 | 30 | 202 | 7 | 4 | 0.01 |
| subscriptions | 9 | 9 | – | 213 | 1 | 1 | 4 | 2 | 4 | 32 | 174 | 7 | 3 | 0.02 |
| budgets | 12 | 12 | – | 213 | 1 | 2 | 4 | 2 | 3 | 33 | 213 | 4 | 3 | 0.03 |
| lists | 14 | 14 | – | 233 | 1 | 2 | 6 | 2 | 3 | 30 | 191 | 7 | 4 | 0.01 |
| pantry | 11 | 11 | – | 205 | 1 | 2 | 8 | 2 | 3 | 31 | 204 | 5 | 3 | 0.02 |
| bookmarks | 14 | 14 | – | 249 | 1 | 2 | 4 | 2 | 3 | 22 | 156 | 5 | 3 | 0.01 |
| notes | 21 | 21 | – | 142 | 1 | 2 | 4 | 2 | 3 | 31 | 186 | 6 | 3 | 0.01 |
| chat | 12 | 12 | 368 | 163 | 1 | 1 | 9 | 2 | 2 | 58 | 390 | 5 | 3 | 0.00 |
| browser | 17 | 17 | – | 118 | 0 | 0 | 2 | 1 | 1 | 42 | 289 | 6 | 3 | 0.02 |
| feeds | 10 | 10 | – | 231 | 1 | 1 | 10 | 2 | 3 | 29 | 175 | 4 | 4 | 0.01 |
| mail | 10 | 10 | – | 141 | 0 | 1 | 3 | 1 | 3 | 39 | 258 | 4 | 2 | 0.01 |
| music | 10 | 10 | – | 213 | 1 | 1 | 4 | 2 | 3 | 38 | 252 | 4 | 3 | 0.01 |
| vault | 15 | 15 | – | 205 | 1 | 1 | 13 | 2 | 3 | 39 | 295 | 7 | 3 | 0.02 |
| accounts | 7 | 7 | – | 141 | 1 | 1 | 3 | 2 | 1 | 52 | 432 | 4 | 3 | 0.01 |
| disk | 10 | 4 | 502 | 238 | 0 | 3 | 2 | 1 | 2 | 175 | 930 | 9 | 4 | 0.01 |
| downloads | 18 | 10 | 415 | 165 | 1 | 2 | 7 | 1 | 1 | 87 | 564 | 5 | 4 | 0.01 |
| library | 17 | 6 | 93 | 223 | 0 | 1 | 56 | 3 | 9 | 157 | 1093 | 7 | 3 | 0.01 |
| library-vault | 4 | 4 | 145 | 133 | 0 | 0 | 11 | 2 | 1 | 53 | 379 | 6 | 3 | 0.01 |
| tools | 24 | 4 | 93 | 207 | 0 | 1 | 22 | 1 | 9 | 172 | 1204 | 7 | 3 | 0.01 |
| settings | 36 | 12 | 174 | 368 | 0 | 4 | 19 | 1 | 14 | 131 | 889 | 6 | 3 | 0.00 |
| settings-einrichtung | 35 | 19 | 174 | 133 | 1 | 5 | 20 | 2 | 11 | 118 | 829 | 7 | 3 | 0.00 |
| settings-allgemein | 45 | 18 | 174 | 133 | 0 | 5 | 17 | 1 | 11 | 185 | 1273 | 6 | 3 | 0.00 |
| settings-darstellung | 67 | 46 | 174 | 133 | 0 | 22 | 34 | 1 | 11 | 457 | 3002 | 6 | 4 | 0.00 |
| settings-barrierefreiheit | 42 | 23 | 174 | 133 | 0 | 9 | 18 | 1 | 11 | 195 | 1366 | 7 | 3 | 0.04 |
| settings-module | 47 | 13 | 174 | 133 | 0 | 5 | 35 | 1 | 29 | 142 | 1053 | 7 | 3 | 0.00 |
| settings-werkzeuge | 64 | 48 | 174 | 133 | 0 | 4 | 30 | 1 | 20 | 190 | 1446 | 6 | 3 | 0.00 |
| settings-benachrichtigungen | 44 | 23 | 174 | 133 | 1 | 8 | 20 | 1 | 11 | 186 | 1316 | 7 | 3 | 0.05 |
| settings-sicherheit | 41 | 25 | 174 | 133 | 0 | 7 | 17 | 1 | 11 | 289 | 2094 | 5 | 3 | 0.00 |
| settings-sync | 32 | 16 | 174 | 133 | 0 | 4 | 18 | 1 | 11 | 146 | 1020 | 7 | 3 | 0.00 |
| settings-ki | 40 | 16 | 174 | 133 | 0 | 6 | 20 | 1 | 11 | 214 | 1493 | 7 | 3 | 0.03 |
| settings-verbindungen | 38 | 14 | 174 | 133 | 0 | 4 | 17 | 1 | 11 | 169 | 1214 | 7 | 3 | 0.02 |
| settings-schnellerfassung | 33 | 17 | 174 | 133 | 0 | 4 | 18 | 1 | 11 | 185 | 1181 | 8 | 3 | 0.00 |
| settings-updates | 29 | 13 | 174 | 133 | 0 | 4 | 17 | 1 | 11 | 233 | 1656 | 6 | 4 | 0.00 |
| settings-entwickler | 34 | 18 | 174 | 133 | 1 | 5 | 17 | 1 | 11 | 177 | 1304 | 7 | 3 | 0.00 |
| settings-ueber | 42 | 13 | 174 | 133 | 0 | 5 | 17 | 1 | 12 | 138 | 1030 | 5 | 4 | 0.00 |
| settings-module-finance | 38 | 21 | 174 | 173 | 0 | 5 | 20 | 2 | 12 | 196 | 1397 | 5 | 3 | 0.00 |
| übersicht-ruhig | 13 | 10 | 216 | – | 1 | 3 | 3 | 0 | 1 | 90 | 568 | 5 | 4 | 0.01 |
| übersicht-ausführlich | 27 | 8 | 216 | 48 | 1 | 3 | 16 | 0 | 7 | 143 | 915 | 5 | 4 | 0.14 |

### Köpfe und Typografie – 1920 dunkel, Seed

| Seite | Kopf px | Größenklasse | h1 Größe/Gewicht/Schrift | h2/h3-Varianten | Zeilen (n · Median · min–max) | Abstandswerte | Icons (px/stroke) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 241 | hero | 32px/600/Inter Variable | 2 | – | 9 | 16px/1.75×10, 18px/1.75×3 |
| planner | 211 | hero | 32px/300/Inter Variable | 1 | 28 · 74 · 48–96 | 6 | 18px/1.75×19, 16px/1.75×10 |
| todos | 240 | compact | 20px/600/Inter Variable | 1 | 42 · 51 · 44–148 | 7 | 18px/1.75×44, 16px/1.75×14, 32px/1.5×1 |
| habits | 231 | hero | 32px/600/Inter Variable | 0 | – | 6 | 16px/1.75×10, 18px/1.75×6, 48px/-×4, 72px/-×4 |
| timetrack | 233 | hero | 32px/600/ui-monospace | 0 | 1 · 48 · 48–48 | 6 | 16px/1.75×13, 18px/1.75×3, 80px/-×1 |
| weather | 304 | hero | 32px/300/Inter Variable | 2 | – | 7 | 22px/1.5×24, 16px/1.75×13, 14px/1.75×8, 20px/1.5×7 |
| maps | 274 | hero | 32px/600/Inter Variable | 0 | 8 · 49 · 48–49 | 6 | 18px/1.75×10, 16px/1.75×9, 20px/1.5×8, 40px/1.5×1 |
| people | 146 | compact | 20px/600/Inter Variable | 0 | 28 · 104 · 82–104 | 8 | 18px/1.75×31, 16px/1.75×10, 32px/1.5×1 |
| fitness | 233 | hero | 32px/600/Inter Variable | 1 | 29 · 48 · 48–49 | 6 | 16px/1.75×33, 24px/-×29, 32px/-×7, 18px/1.75×4 |
| finance | 292 | hero | 32px/600/Inter Variable | 3 | 18 · 49 · 48–74 | 9 | 16px/1.75×24, 18px/1.75×22, 1038px/-×3 |
| invoices | 146 | compact | 20px/600/Inter Variable | 1 | 7 · 49 · 48–49 | 8 | 18px/1.75×10, 16px/1.75×9, 14px/1.75×2, 32px/1.5×1 |
| subscriptions | 261 | hero | 32px/600/Inter Variable | 1 | 9 · 54 · 49–54 | 9 | 18px/1.75×12, 16px/1.75×6, 14px/1.75×2 |
| budgets | 233 | hero | 32px/600/Inter Variable | 0 | – | 7 | 16px/1.75×6, 18px/1.75×3 |
| lists | 237 | hero | 32px/600/Inter Variable | 1 | 14 · 45 · 44–45 | 6 | 20px/1.5×15, 16px/1.75×9, 18px/1.75×4 |
| pantry | 233 | hero | 32px/600/Inter Variable | 1 | 14 · 104 · 76–126 | 8 | 16px/1.75×33, 18px/1.75×9 |
| bookmarks | 249 | hero | 32px/600/Inter Variable | 1 | 31 · 49 · 48–49 | 6 | 18px/1.75×34, 16px/1.75×10 |
| notes | 142 | compact | 32px/600/Georgia | 1 | – | 6 | 18px/1.75×17, 16px/1.75×13, 14px/1.75×6, 20px/1.5×3 |
| chat | 163 | compact | 20px/600/Inter Variable | 1 | – | 7 | 16px/1.75×8, 18px/1.75×2 |
| browser | 118 | compact | 32px/600/Georgia | 2 | 6 · 49 · 48–49 | 6 | 16px/1.75×8, 20px/1.5×7, 18px/1.75×1, 18px/-×1 |
| feeds | 233 | hero | 32px/600/Georgia | 1 | 6 · 50 · 50–50 | 7 | 16px/1.75×11, 18px/1.75×9 |
| mail | 141 | compact | 32px/600/Georgia | 1 | 7 · 157 · 111–268 | 7 | 16px/1.75×12, 18px/1.75×8, 32px/1.5×1, 20px/1.5×1 |
| music | 363 | hero | 32px/600/ui-monospace | 2 | – | 8 | 16px/1.75×14, 18px/1.75×5, 20px/1.5×3, 28px/1.5×3 |
| vault | 233 | hero | 32px/600/Inter Variable | 0 | 34 · 129 · 106–150 | 6 | 16px/1.75×5, 18px/1.75×2 |
| accounts | 141 | compact | 32px/600/ui-monospace | 0 | – | 5 | 16px/1.75×3, 18px/1.75×2, 32px/1.5×1 |
| disk | 238 | hero | 32px/600/ui-monospace | 2 | – | 7 | 16px/1.75×7, 72px/-×6, 18px/1.75×3 |
| downloads | 165 | compact | 20px/600/ui-monospace | 1 | 3 · 77 · 76–99 | 6 | 20px/1.5×8, 18px/1.75×5, 16px/1.75×3 |
| library | 223 | hero | 32px/600/Inter Variable | 1 | – | 8 | 26px/1.5×26, 16px/1.75×1, 18px/1.75×1 |
| library-vault | 133 | compact | 20px/600/Inter Variable | 0 | – | 8 | 20px/1.5×1, 16px/1.75×1 |
| tools | 207 | hero | 32px/600/Inter Variable | 1 | – | 8 | 26px/1.5×16, 20px/1.5×8, 16px/1.75×1 |
| settings | 368 | hero | 32px/600/Inter Variable | 0 | – | 6 | 20px/1.5×25, 18px/1.75×1, 16px/1.75×1 |
| settings-einrichtung | 133 | compact | 20px/600/Inter Variable | 1 | – | 8 | 20px/1.5×16, 18px/1.75×1, 16px/1.75×1, 14px/1.75×1 |
| settings-allgemein | 133 | compact | 20px/600/Inter Variable | 1 | – | 9 | 20px/1.5×16, 18px/1.75×3, 16px/1.75×1, 14px/1.75×1 |
| settings-darstellung | 133 | compact | 20px/600/Inter Variable | 1 | – | 8 | 20px/1.5×16, 18px/1.75×2, 16px/1.75×1, 14px/1.75×1 |
| settings-barrierefreiheit | 133 | compact | 20px/600/Inter Variable | 1 | – | 8 | 20px/1.5×16, 18px/1.75×2, 16px/1.75×1, 14px/1.75×1 |
| settings-module | 133 | compact | 20px/600/Inter Variable | 2 | – | 6 | 20px/1.5×40, 18px/1.75×1, 16px/1.75×1, 14px/1.75×1 |
| settings-werkzeuge | 133 | compact | 20px/600/Inter Variable | 1 | – | 8 | 20px/1.5×80, 18px/1.75×2, 16px/1.75×1, 14px/1.75×1 |
| settings-benachrichtigungen | 133 | compact | 20px/600/Inter Variable | 3 | – | 8 | 20px/1.5×16, 18px/1.75×1, 16px/1.75×1, 14px/1.75×1 |
| settings-sicherheit | 133 | compact | 20px/600/Inter Variable | 1 | – | 8 | 20px/1.5×16, 18px/1.75×3, 16px/1.75×1, 14px/1.75×1 |
| settings-sync | 133 | compact | 20px/600/Inter Variable | 3 | – | 9 | 20px/1.5×16, 18px/1.75×2, 16px/1.75×2, 14px/1.75×1 |
| settings-ki | 133 | compact | 20px/600/Inter Variable | 2 | – | 8 | 20px/1.5×16, 18px/1.75×7, 16px/1.75×1, 14px/1.75×1 |
| settings-verbindungen | 133 | compact | 20px/600/Inter Variable | 4 | – | 9 | 20px/1.5×16, 18px/1.75×3, 22px/1.5×3, 16px/1.75×2 |
| settings-schnellerfassung | 133 | compact | 20px/600/Inter Variable | 1 | – | 8 | 20px/1.5×16, 18px/1.75×3, 16px/1.75×1, 14px/1.75×1 |
| settings-updates | 133 | compact | 20px/600/Inter Variable | 3 | – | 6 | 20px/1.5×16, 18px/1.75×2, 16px/1.75×1, 14px/1.75×1 |
| settings-entwickler | 133 | compact | 20px/600/Inter Variable | 3 | – | 8 | 20px/1.5×16, 18px/1.75×3, 16px/1.75×1, 14px/1.75×1 |
| settings-ueber | 133 | compact | 20px/600/Inter Variable | 2 | – | 9 | 20px/1.5×16, 14px/1.75×2, 18px/1.75×1, 16px/1.75×1 |
| settings-module-finance | 173 | compact | 20px/600/Inter Variable | 1 | – | 8 | 20px/1.5×16, 14px/1.75×2, 18px/1.75×1, 16px/1.75×1 |
| overview-calm | – | – | 44px/700/Inter Variable | 3 | – | 6 | 18px/1.75×10, 16px/1.75×2, 22px/1.5×1 |
| overview-all | 72 | md | 44px/700/Inter Variable | 3 | – | 6 | 16px/1.75×60, 18px/1.75×44, 22px/1.5×34, 72px/-×4 |

### Flächen: Rahmen vs. Schatten vs. Tönung – 1920 dunkel, Seed

| Seite | Rahmen (rundum) | Ringe | Schatten | getönt | neutrale Füllungen | --surface-2 | Verläufe | Radien (px×n) | Animationen | Transitions (Eigenschaft×n) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 37 | 0 | 4 | 3 | 1 | 11 | 2 | 8px×87, 999px×15, 12px×3, 20px×2, 16px×1 | 1 | transform×7 |
| planner | 0 | 0 | 12 | 1 | 0 | 21 | 2 | 8px×29, 16px×13, 12px×9, 999px×8 | 10 | transform×25 |
| todos | 1 | 1 | 12 | 6 | 0 | 47 | 2 | 8px×47, 16px×12, 12px×12, 999px×12 | 10 | transform×57 |
| habits | 4 | 0 | 2 | 1 | 0 | 6 | 2 | 999px×10, 16px×4, 12px×3, 20px×1 | 1 | transform×11 |
| timetrack | 0 | 0 | 3 | 1 | 0 | 2 | 2 | 999px×10, 16px×4, 12px×3, 20px×1, 8px×1 | 2 | transform×4 |
| weather | 1 | 0 | 28 | 14 | 5 | 2 | 5 | 12px×31, 999px×9, 8px×5, 16px×2, 40px×1 | 1 | transform×2 |
| maps | 0 | 1 | 3 | 6 | 0 | 12 | 2 | 999px×15, 8px×8, 12px×6, 20px×1, 16px×1 | 9 | transform×10 |
| people | 0 | 1 | 30 | 2 | 0 | 32 | 26 | 16px×28, 999px×10, 12px×3, 20px×1 | 10 | transform×33 |
| fitness | 0 | 0 | 30 | 1 | 0 | 4 | 2 | 8px×57, 16px×28, 999px×5, 12px×3, 20px×1 | 10 | transform×7 |
| finance | 0 | 0 | 25 | 1 | 0 | 25 | 4 | 16px×22, 8px×18, 999px×13, 12px×4, 20px×2 | 10 | transform×28 |
| invoices | 0 | 1 | 5 | 4 | 0 | 11 | 2 | 12px×10, 8px×10, 999px×5, 16px×3, 20px×1 | 8 | transform×20 |
| subscriptions | 15 | 0 | 2 | 16 | 0 | 15 | 4 | 8px×9, 999px×7, 16px×4, 12px×2 | 10 | transform×23 |
| budgets | 3 | 0 | 8 | 11 | 0 | 5 | 2 | 999px×6, 16px×6, 12px×5, 20px×1 | 7 | transform×11 |
| lists | 0 | 0 | 2 | 1 | 0 | 18 | 2 | 8px×18, 12px×7, 16px×4, 999px×3 | 10 | transform×38 |
| pantry | 28 | 0 | 2 | 1 | 0 | 52 | 2 | 999px×19, 12px×16, 20px×1 | 10 | transform×39 |
| bookmarks | 0 | 0 | 6 | 2 | 0 | 35 | 2 | 8px×35, 999px×9, 12px×4, 20px×1, 16px×1 | 10 | transform×66 |
| notes | 1 | 0 | 2 | 2 | 0 | 20 | 2 | 8px×13, 12px×11, 999px×8, 16px×1, 20px×1 | 1 | transform×25 |
| chat | 0 | 0 | 3 | 2 | 0 | 1 | 2 | 999px×7, 12px×4, 16px×3 | 1 | transform×4 |
| browser | 1 | 0 | 2 | 1 | 0 | 9 | 1 | 12px×9, 999px×8, 8px×7, 16px×1 | 7 | transform×9 |
| feeds | 1 | 0 | 2 | 2 | 0 | 8 | 2 | 999px×7, 8px×3, 12px×2 | 1 | transform×9 |
| mail | 2 | 1 | 5 | 2 | 0 | 11 | 1 | 12px×18, 8px×11, 999px×9, 16px×4 | 8 | transform×21 |
| music | 0 | 0 | 6 | 5 | 0 | 6 | 2 | 999px×12, 12px×5, 16px×1 | 1 | transform×8 |
| vault | 34 | 0 | 1 | 1 | 0 | 1 | 2 | 12px×20, 999px×2 | 10 | transform×9 |
| accounts | 0 | 1 | 0 | 2 | 0 | 1 | 2 | 999px×2, 12px×2 | 1 | transform×2 |
| disk | 0 | 0 | 6 | 1 | 0 | 1 | 1 | 12px×6, 999px×4, 16px×4, 20px×1 | 1 | transform×6 |
| downloads | 0 | 0 | 3 | 3 | 0 | 10 | 1 | 999px×3, 12px×3, 8px×3, 20px×1, 16px×1 | 4 | transform×14 |
| library | 6 | 0 | 28 | 78 | 2 | 26 | 3 | 12px×72, 16px×32, 8px×25, 20px×3 | 1 | transform×44 |
| library-vault | 0 | 0 | 3 | 1 | 0 | 1 | 2 | 20px×2, 16px×2, 12px×2, 8px×1 | 1 | transform×2 |
| tools | 3 | 0 | 18 | 34 | 1 | 21 | 1 | 12px×21, 16px×19, 20px×3 | 1 | transform×28 |
| settings | 9 | 0 | 5 | 1 | 0 | 4 | 1 | 12px×18, 16px×9, 20px×6, 999px×6 | 1 |  |
| settings-einrichtung | 1 | 0 | 5 | 2 | 0 | 5 | 2 | 12px×24, 20px×6, 999px×6, 16px×1 | 1 | transform×7 |
| settings-allgemein | 10 | 1 | 6 | 2 | 0 | 16 | 1 | 12px×47, 999px×11, 20px×7 | 1 | transform×27 |
| settings-darstellung | 2 | 1 | 14 | 12 | 2 | 40 | 1 | 12px×32, 999px×21, 20px×15, 8px×10, 16px×2 | 1 | transform×31 |
| settings-barrierefreiheit | 0 | 0 | 13 | 2 | 0 | 21 | 1 | 12px×22, 999px×17, 20px×14 | 1 | transform×18 |
| settings-module | 24 | 0 | 5 | 1 | 0 | 4 | 1 | 12px×42, 20px×6, 999px×6 | 1 |  |
| settings-werkzeuge | 0 | 0 | 5 | 1 | 0 | 64 | 1 | 12px×19, 20px×6, 999px×6 | 1 | transform×64 |
| settings-benachrichtigungen | 4 | 0 | 14 | 3 | 0 | 14 | 1 | 12px×29, 999px×15, 20px×12, 16px×7 | 1 | transform×29 |
| settings-sicherheit | 0 | 0 | 7 | 1 | 0 | 8 | 1 | 12px×20, 999px×14, 20px×8 | 1 | transform×3 |
| settings-sync | 2 | 0 | 9 | 2 | 0 | 4 | 1 | 12px×29, 20px×6, 999px×6, 16px×5 | 1 | transform×7 |
| settings-ki | 2 | 1 | 7 | 3 | 0 | 6 | 1 | 12px×27, 999px×11, 20px×7, 16px×3 | 1 | transform×21 |
| settings-verbindungen | 4 | 1 | 11 | 3 | 0 | 11 | 1 | 12px×41, 16px×9, 999px×8, 20px×6 | 1 | transform×55 |
| settings-schnellerfassung | 4 | 0 | 6 | 1 | 1 | 5 | 1 | 12px×20, 999px×9, 20px×6, 16px×2 | 1 | transform×2 |
| settings-updates | 0 | 0 | 9 | 1 | 0 | 4 | 1 | 12px×19, 20px×6, 999px×6, 16px×4 | 1 | transform×1 |
| settings-entwickler | 1 | 0 | 6 | 1 | 0 | 5 | 1 | 12px×25, 20px×6, 999px×6, 16px×2 | 1 | transform×5 |
| settings-ueber | 2 | 1 | 5 | 3 | 0 | 6 | 1 | 12px×45, 999px×10, 20px×6, 16px×2 | 1 | transform×18 |
| settings-module-finance | 2 | 1 | 6 | 2 | 0 | 6 | 2 | 12px×20, 999px×9, 20px×7, 16px×2 | 1 | transform×5 |
| overview-calm | 0 | 2 | 9 | 1 | 0 | 4 | 3 | 16px×10, 12px×5, 20px×1, 999px×1 | 1 | transform×8 |
| overview-all | 1 | 2 | 41 | 34 | 0 | 36 | 3 | 16px×39, 12px×25, 8px×3, 20px×1, 999px×1 | 1 | transform×62 |

### Dialoge – 1920 dunkel, Seed

| Modul | Auslöser | Titel | Felder | Knöpfe | Breite×Höhe | Primär |
| --- | --- | --- | --- | --- | --- | --- |
| calendar | Neuer Termin | Neuer Termin | 8 | 16 | 544×950 | Speichern |
| planner | – | – | – | – | – | – |
| todos | – | – | – | – | – | – |
| habits | Gewohnheit hinzufügen | Gewohnheit hinzufügen | 3 | 8 | 544×565 | Speichern |
| timetrack | Eintrag hinzufügen | Eintrag hinzufügen | 7 | 3 | 544×677 | Speichern |
| weather | Ort hinzufügen | Ort hinzufügen | 1 | 2 | 544×270 |  |
| maps | Ort hinzufügen | Die Karte lädt Kartenkacheln | 0 | 2 | 544×385 | Verstanden |
| people | Person hinzufügen | Person hinzufügen | 4 | 4 | 544×509 | Speichern |
| fitness | – | – | – | – | – | – |
| finance | Buchung hinzufügen | Buchung hinzufügen | 6 | 6 | 544×668 | Speichern |
| invoices | Rechnung hinzufügen | Rechnung hinzufügen | 4 | 7 | 544×550 | Speichern |
| subscriptions | Abo hinzufügen | Abo hinzufügen | 6 | 4 | 544×649 | Speichern |
| budgets | Budget hinzufügen | Budget hinzufügen | 2 | 4 | 544×397 | Speichern |
| lists | Neue Liste | Neue Liste | 3 | 3 | 544×476 | Speichern |
| pantry | Vorrat hinzufügen | Vorrat hinzufügen | 5 | 4 | 544×590 | Speichern |
| bookmarks | – | – | – | – | – | – |
| notes | Neues Notizbuch | Neues Notizbuch | 1 | 21 | 544×485 | Speichern |
| chat | – | – | – | – | – | – |
| browser | – | – | – | – | – | – |
| feeds | Feed hinzufügen | Feed hinzufügen | 3 | 3 | 544×479 | Speichern |
| mail | – | – | – | – | – | – |
| music | – | – | – | – | – | – |
| vault | Unterlage hinzufügen | Unterlage hinzufügen | 9 | 3 | 544×819 | Speichern |
| accounts | – | – | – | – | – | – |
| disk | – | – | – | – | – | – |
| downloads | Download hinzufügen | Download hinzufügen | 3 | 4 | 544×506 | Herunterladen |

### Zustände (Rechnungen, 1920 dunkel)

```json
{
 "rest": {
  "bg": "color(srgb 0.956863 0.639216 0.611765 / 0.06)",
  "shadow": "none",
  "transform": "matrix(1, 0, 0, 1, 0, 0)",
  "outline": "none 3px",
  "transition": "all 0s"
 },
 "hover": {
  "bg": "rgb(31, 37, 41)",
  "shadow": "none",
  "transform": "matrix(1, 0, 0, 1, 0, 0)",
  "outline": "none 3px",
  "transition": "all 0s"
 },
 "hoverActions": [
  "Stadtwerke Musterstadt\nFällig am: Do., 17. Sep. · SW-2026-1000 · 1. Mahnung",
  "Als bezahlt markieren",
  "Weitere Aktionen"
 ],
 "focusInfo": {
  "tag": "A",
  "name": "Zur Übersicht",
  "outline": "solid 2px 2px",
  "focusVisible": true
 },
 "press": {
  "transform": "matrix(0.97, 0, 0, 0.97, 0, 0)",
  "bg": "rgb(255, 176, 122)",
  "transition": "transform"
 }
}
```

### axe (serious/critical) – 1920 dunkel, Seed

| Seite | Regel | Schwere | n | Erstes Ziel |
| --- | --- | --- | --- | --- |
| page-calendar | color-contrast | serious | 1 | ._lineOwn_11x18_167._line_11x18_139[title="Termin: Konzert"] > ._lineTime_11x18_173 :: <span class="_lineTime_11x18_173">13:00</span> |

### Widget-Größen (Übersicht „Ausführlich“, 1920)

| Widget | Breite | Höhe |
| --- | --- | --- |
| todos:next | 781 | 424 |
| planner:week | 781 | 315 |
| todos:open | 781 | 393 |
| habits:today | 781 | 312 |
| finance:balance | 379 | 201 |
| finance:month | 379 | 228 |
| timetrack:timer | 781 | 312 |
| weather:today | 379 | 205 |
| invoices:due | 781 | 395 |
| subscriptions:next | 781 | 335 |
| bookmarks:recent | 379 | 278 |
| bookmarks:links | 781 | 330 |
| notes:recent | 379 | 260 |
| chat:recent | 379 | 213 |
| lists:open | 379 | 289 |
| lists:packing | 379 | 224 |
| pantry:expiring | 379 | 366 |
| fitness:week | 379 | 200 |
| browser:bookmarks | 379 | 254 |
| feeds:summary | 379 | 205 |
| mail:inbox | 781 | 312 |
| maps:places | 379 | 225 |
| people:next | 379 | 263 |
| budgets:overview | 781 | 347 |
| add-expense | 98 | 32 |
| vault:expiring | 379 | 205 |
| accounts:status | 379 | 200 |
| music:player | 379 | 200 |
| disk:status | 379 | 208 |
| disk:system | 379 | 234 |
| downloads:running | 379 | 224 |

### Handy: Köpfe und Zeilenhöhen – 412 dunkel, Seed

| Seite | Kopf px | Inhalt ab y | Zeilen (n · Median · min–max) |
| --- | --- | --- | --- |
| calendar | 200 | 569 | – |
| planner | 268 | 778 | 5 · 57 · 56–57 |
| todos | 243 | 584 | 42 · 59 · 56–210 |
| habits | 280 | 533 | – |
| timetrack | 297 | 572 | 1 · 56 · 56–56 |
| weather | 336 | 105 | – |
| maps | 349 | 846 | 8 · 57 · 56–78 |
| people | 169 | 554 | 28 · 104 · 82–104 |
| fitness | 271 | 632 | 29 · 77 · 56–119 |
| finance | 344 | 834 | – |
| invoices | 314 | 687 | 7 · 130 · 103–176 |
| subscriptions | 244 | 523 | 9 · 155 · 81–181 |
| budgets | 364 | 681 | – |
| lists | 308 | 858 | 14 · 57 · 56–109 |
| pantry | 280 | 642 | 14 · 98 · 76–126 |
| bookmarks | 288 | 661 | 31 · 83 · 57–104 |
| notes | 133 | – | – |
| chat | 159 | 356 | – |
| feeds | 306 | 690 | 6 · 50 · 50–50 |
| music | 208 | 710 | – |
| vault | 307 | 817 | 34 · 106 · 84–150 |
| accounts | 141 | – | – |
| library | 232 | 93 | – |
| library-vault | 209 | 145 | – |
| tools | 212 | 93 | – |
| settings | 338 | 169 | – |
| settings-einrichtung | 137 | 169 | – |
| settings-allgemein | 113 | 169 | – |
| settings-darstellung | 113 | 169 | – |
| settings-barrierefreiheit | 113 | 169 | – |
| settings-module | 113 | 169 | – |
| settings-werkzeuge | 113 | 169 | – |
| settings-benachrichtigungen | 113 | 169 | – |
| settings-sicherheit | 137 | 169 | – |
| settings-sync | 113 | 169 | – |
| settings-ki | 113 | 169 | – |
| settings-verbindungen | 113 | 169 | – |
| settings-schnellerfassung | 113 | 169 | – |
| settings-updates | 113 | 169 | – |
| settings-entwickler | 113 | 169 | – |
| settings-ueber | 113 | 169 | – |
| settings-module-finance | 249 | 169 | – |
| overview-calm | – | 365 | – |
| overview-all | 72 | 365 | – |

### Layout-Sprung (CLS) über alle Läufe – nur Werte, die in mindestens zwei Läufen ≥ 0,05 sind

| Seite | Läufe mit CLS ≥ 0,05 |
| --- | --- |
| page-calendar--v-plan | D-dark/seed 0.14, D-dark/empty 0.11 |
| page-disk | D-dark/seed 0.13, D-light/seed 0.13 |
| page-settings-benachrichtigungen | D-dark/seed 0.05, D-dark/empty 0.05, D-light/seed 0.05, P-light/empty 0.13 |
| palette | D-dark/seed 0.11, D-light/seed 0.09, P-dark/seed 0.25, P-light/empty 0.07 |
| overview-calm | D-dark/seed 0.06, D-light/seed 0.06, P-light/empty 0.07 |
| overview-all | D-dark/seed 0.18, D-dark/empty 0.14, D-light/seed 0.18, D-light/empty 0.12, P-dark/seed 0.25, P-dark/empty 0.10, P-light/empty 0.07 |
| page-timetrack | D-light/seed 0.06, P-dark/seed 0.05, P-dark/empty 0.05, P-light/empty 0.05 |
| toolbox | D-light/seed 0.15, P-dark/seed 0.25, P-light/empty 0.07 |
| dialog-subscriptions | D-light/empty 0.05, P-dark/seed 0.06 |
| page-settings-ueber | D-light/empty 0.11, P-dark/seed 0.08, P-light/empty 0.13 |
| page-subscriptions | P-dark/seed 0.19, P-dark/empty 0.08, P-light/seed 0.07 |
| page-settings-ki | P-dark/seed 0.12, P-light/empty 0.12 |
| page-bookmarks | P-dark/empty 0.07, P-light/empty 0.07 |
| page-feeds | P-dark/empty 0.06, P-light/empty 0.06 |

### Handy: kleine Ziele (< 40 px) und abgeschnittener Text – 412 dunkel, Seed

| Seite | klein n | Beispiele | abgeschnitten n | Beispiele |
| --- | --- | --- | --- | --- |
| page-calendar | 0 |  | 31 | _cellLabel_11x18_123 | Vertragsende: 1 Unterlage; _cellLabel_11x18_123 | Kündigungsfrist: Streaming Plus |
| page-calendar--v-kalender | 0 |  | 31 | _cellLabel_11x18_123 | Vertragsende: 1 Unterlage; _cellLabel_11x18_123 | Kündigungsfrist: Streaming Plus |
| page-calendar--v-monat | 0 |  | 31 | _cellLabel_11x18_123 | Vertragsende: 1 Unterlage; _cellLabel_11x18_123 | Kündigungsfrist: Streaming Plus |
| page-calendar--v-arbeit | 0 |  | 31 | _cellLabel_11x18_123 | Vertragsende: 1 Unterlage; _cellLabel_11x18_123 | Kündigungsfrist: Streaming Plus |
| dialog-calendar | 0 |  | 2 | _recentTitle_11x18_477 | Teammeeting; _recentTitle_11x18_477 | Zahnarzt Dr. Beispiel |
| page-todos | 5 | 24×24 _check_jdqxd_88 | Recherche 16; 24×24 _check_jdqxd_88 | Bücher aussortieren 18 | 1 | _nextTitle_jdqxd_328 | Termin vereinbaren 9 |
| page-todos--v-alle | 5 | 24×24 _check_jdqxd_88 | Recherche 16; 24×24 _check_jdqxd_88 | Bücher aussortieren 18 | 1 | _nextTitle_jdqxd_328 | Termin vereinbaren 9 |
| page-todos--v-heute | 2 | 24×24 _check_jdqxd_88 | Formular ausfüllen 8; 24×24 _check_jdqxd_88 | Termin vereinbaren 9 | 1 | _nextTitle_jdqxd_328 | Termin vereinbaren 9 |
| page-todos--v-demnächst | 4 | 24×24 _check_jdqxd_88 | Recherche 16; 24×24 _check_jdqxd_88 | Bücher aussortieren 18 | 1 | _nextTitle_jdqxd_328 | Termin vereinbaren 9 |
| page-todos--v-irgendwann | 2 | 24×24 _check_jdqxd_88 | Keller aufräumen; 24×24 _check_jdqxd_88 | Fahrradreifen aufpumpen 19 | 1 | _nextTitle_jdqxd_328 | Termin vereinbaren 9 |
| page-todos--v-erledigt | 5 | 24×24 _check_jdqxd_88 | Vorräte prüfen 15; 24×24 _check_jdqxd_88 | Schritt 2 | 1 | _nextTitle_jdqxd_328 | Termin vereinbaren 9 |
| page-todos--v-board | 0 |  | 1 | _nextTitle_jdqxd_328 | Termin vereinbaren 9 |
| page-habits | 0 |  | 1 | _eyebrowText_1ofc1_95 | Planen · Gewohnheiten |
| page-habits--v-heute | 0 |  | 1 | _eyebrowText_1ofc1_95 | Planen · Gewohnheiten |
| page-habits--v-verlauf | 0 |  | 1 | _eyebrowText_1ofc1_95 | Planen · Gewohnheiten |
| page-habits--v-archiv | 0 |  | 1 | _eyebrowText_1ofc1_95 | Planen · Gewohnheiten |
| page-timetrack | 0 |  | 1 | _eyebrowText_1ofc1_95 | Planen · Zeiterfassung |
| page-timetrack--v-heute | 0 |  | 1 | _eyebrowText_1ofc1_95 | Planen · Zeiterfassung |
| page-timetrack--v-auswertung | 0 |  | 1 | _eyebrowText_1ofc1_95 | Planen · Zeiterfassung |
| page-timetrack--v-projekte | 0 |  | 1 | _eyebrowText_1ofc1_95 | Planen · Zeiterfassung |
| page-finance | 0 |  | 1 | _card_wxhy6_1 | Girokonto3.567,01 €verfügbar 11.598,49 € |
| page-finance--tab-transactions | 0 |  | 1 | _card_wxhy6_1 | Girokonto3.567,01 €verfügbar 11.598,49 € |
| page-finance--tab-accounts | 0 |  | 1 | _card_wxhy6_1 | Girokonto3.567,01 €verfügbar 11.598,49 € |
| page-finance--v-übersicht | 0 |  | 1 | _card_wxhy6_1 | Girokonto3.567,01 €verfügbar 11.598,49 € |
| page-finance--v-buchungen | 0 |  | 1 | _card_wxhy6_1 | Girokonto3.567,01 €verfügbar 11.598,49 € |
| page-finance--v-verlauf | 0 |  | 1 | _card_wxhy6_1 | Girokonto3.567,01 €verfügbar 11.598,49 € |
| page-finance--v-konten | 0 |  | 1 | _card_wxhy6_1 | Girokonto3.567,01 €verfügbar 11.598,49 € |
| page-finance--v-kategorien | 0 |  | 1 | _card_wxhy6_1 | Girokonto3.567,01 €verfügbar 11.598,49 € |
| page-budgets | 0 |  | 1 | _eyebrowText_1ofc1_95 | Geld · Budgets & Sparziele |
| page-budgets--v-budgets | 0 |  | 1 | _eyebrowText_1ofc1_95 | Geld · Budgets & Sparziele |
| page-budgets--v-sparziele | 0 |  | 1 | _eyebrowText_1ofc1_95 | Geld · Budgets & Sparziele |
| page-notes | 0 |  | 4 | _text_dofhq_25 | Milch nicht vergessen Paket abholen bis Freitag; _meta_un25p_98 | Diese Woche Einkauf erledigt Paket abholen Steuerunterlagen sortieren Tag Plan M |
| page-notes--v-liste | 0 |  | 4 | _text_dofhq_25 | Milch nicht vergessen Paket abholen bis Freitag; _meta_un25p_98 | Diese Woche Einkauf erledigt Paket abholen Steuerunterlagen sortieren Tag Plan M |
| page-notes--v-karten | 0 |  | 15 | _text_dofhq_25 | Milch nicht vergessen Paket abholen bis Freitag; _meta_un25p_98 | Fliesenformat klären, Preis für die Dusche, Dauer der Arbeiten, Terminvorschlag. |
| page-chat | 0 |  | 1 | _threadTitle_x89nu_33 | Beispiel: Tipps für den Wochenplan |
| page-music | 1 | 88×29  | Testlied | 0 |  |
| page-library | 3 | 61×32  | Alle; 71×32  | Aktiv | 0 |  |
| page-tools | 3 | 61×32  | Alle; 71×32  | Aktiv | 0 |  |
| page-settings-allgemein | 2 | 90×32  | Montag; 96×32  | Sonntag | 0 |  |
| page-settings-darstellung | 11 | 89×32  | System; 61×32  | Hell | 0 |  |

Überlauf 1920x1080-dark seed: keiner

Überlauf 1920x1080-dark empty: keiner

Überlauf 1920x1080-light seed: keiner

Überlauf 1920x1080-light empty: keiner

Überlauf 412x915-dark seed: keiner

Überlauf 412x915-dark empty: keiner

Überlauf 412x915-light seed: keiner

Überlauf 412x915-light empty: keiner
