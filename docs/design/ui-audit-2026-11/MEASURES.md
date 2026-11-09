Definitionen (aus `audit-tour.spec.ts` `measure()`, je Ansicht in `#main`): **Aktionen** = sichtbare button/a/input/select/[role=button|tab|switch|checkbox|menuitem] mit Oberkante über dem Falz; **Chrome** = davon außerhalb von Listenzeilen, Tabellen, Rasterzellen, Widgets und Dialogen (Navigation, Toolbars, Köpfe); **Inhalt ab y** = Oberkante des ersten Listen-/Raster-/Karten-Elements unter Kopf und Toolbars; **Farbe Text/Fläche/Icon** = Elemente über dem Falz, deren Farbe nicht eine der neutralen Tinten (--text, --text-muted, --text-3, --text-on-tint bzw. --bg, --surface) ist und Sättigung > 0,25 (Text/Icon) bzw. > 0,12 (Fläche); `color(srgb …)`-Werte aus `color-mix()` werden geparst; **Verläufe** = Elemente mit `background-image: …gradient` (das Kopfband zählt mit); **Rahmen** = 1 px solid auf allen vier Seiten mit sichtbarer Farbe, ≥ 40×24 px, keine Felder/Knöpfe; **Ring** = `box-shadow` als 0 0 0 n px oder inset; **Schatten** = anderer `box-shadow`; **getönt** = Hintergrund weder --bg/--surface/--surface-2 noch transparent (ohne Knöpfe/Felder/Tabs); **--surface-2** separat; Zählung über die ganze Seite, nicht nur den Falz. Seed = Testdaten „medium“, alle Module an; Desktop posiert als Windows-App in Linux-Headless-Chromium.

### Reizlast über dem Falz – 1920x1080-dark, seed

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 147 | 25 | 506 | 241 | 1 | 10 | 104 | 2 | 3 | 363 | 2130 | 8 | 4 | 0.03 |
| planner | 48 | 20 | 559 | 211 | 1 | 4 | 20 | 2 | 2 | 283 | 1486 | 8 | 4 | 0.01 |
| todos | 59 | 21 | 589 | 240 | 1 | 2 | 16 | 2 | 3 | 139 | 769 | 8 | 4 | 0.02 |
| habits | 22 | 14 | 436 | 231 | 1 | 2 | 3 | 2 | 3 | 58 | 351 | 7 | 4 | 0.01 |
| timetrack | 19 | 18 | 460 | 233 | 1 | 2 | 10 | 2 | 3 | 45 | 290 | 6 | 4 | 0.05 |
| weather | 11 | 11 | 105 | 304 | 0 | 5 | 21 | 5 | 5 | 266 | 1361 | 9 | 5 | 0.01 |
| maps | 39 | 23 | 671 | 274 | 1 | 2 | 16 | 2 | 4 | 92 | 635 | 8 | 4 | 0.01 |
| people | 64 | 16 | 479 | 146 | 1 | 2 | 4 | 26 | 4 | 333 | 1552 | 7 | 4 | 0.01 |
| fitness | 23 | 16 | 546 | 233 | 1 | 2 | 3 | 2 | 8 | 148 | 603 | 8 | 4 | 0.01 |
| finance | 28 | 21 | 687 | 292 | 1 | 9 | 6 | 4 | 6 | 133 | 819 | 9 | 4 | 0.02 |
| invoices | 37 | 16 | 415 | 146 | 1 | 5 | 13 | 2 | 7 | 168 | 1020 | 9 | 4 | 0.01 |
| subscriptions | 33 | 9 | 491 | 261 | 1 | 4 | 26 | 4 | 5 | 260 | 1419 | 8 | 4 | 0.01 |
| budgets | 18 | 12 | 502 | 233 | 1 | 3 | 25 | 2 | 3 | 113 | 498 | 6 | 4 | 0.01 |
| lists | 36 | 21 | 714 | 237 | 1 | 2 | 8 | 2 | 3 | 85 | 447 | 8 | 4 | 0.01 |
| pantry | 49 | 11 | 543 | 233 | 1 | 6 | 23 | 2 | 3 | 124 | 643 | 9 | 4 | 0.01 |
| bookmarks | 48 | 15 | 574 | 249 | 1 | 2 | 4 | 2 | 3 | 146 | 947 | 9 | 4 | 0.01 |
| notes | 35 | 35 | – | 142 | 1 | 2 | 13 | 2 | 3 | 147 | 1016 | 8 | 3 | 0.02 |
| chat | 13 | 12 | 368 | 163 | 1 | 1 | 9 | 2 | 2 | 52 | 361 | 5 | 3 | 0.01 |
| browser | 28 | 16 | 554 | 118 | 0 | 0 | 2 | 1 | 1 | 62 | 599 | 7 | 3 | 0.02 |
| feeds | 26 | 14 | 634 | 233 | 1 | 1 | 11 | 2 | 3 | 54 | 453 | 9 | 4 | 0.01 |
| mail | 27 | 20 | 710 | 141 | 1 | 1 | 5 | 1 | 3 | 113 | 703 | 9 | 4 | 0.01 |
| music | 26 | 24 | 599 | 363 | 0 | 0 | 7 | 2 | 2 | 44 | 288 | 6 | 3 | 0.00 |
| vault | 35 | 17 | 634 | 233 | 1 | 13 | 25 | 2 | 3 | 288 | 1628 | 9 | 4 | 0.02 |
| accounts | 5 | 5 | – | 141 | 1 | 1 | 3 | 2 | 1 | 19 | 148 | 5 | 4 | 0.00 |
| disk | 10 | 4 | 502 | 238 | 0 | 3 | 2 | 1 | 2 | 175 | 930 | 9 | 4 | 0.13 |
| downloads | 18 | 10 | 415 | 165 | 1 | 2 | 7 | 1 | 1 | 87 | 564 | 5 | 4 | 0.01 |
| library | 17 | 6 | 93 | 223 | 0 | 1 | 56 | 3 | 9 | 157 | 1093 | 7 | 3 | 0.01 |
| library-vault | 4 | 4 | 145 | 133 | 0 | 0 | 11 | 2 | 1 | 53 | 379 | 6 | 3 | 0.01 |
| tools | 24 | 4 | 93 | 207 | 0 | 1 | 22 | 1 | 9 | 172 | 1204 | 7 | 3 | 0.01 |
| settings | 36 | 12 | 174 | 368 | 0 | 4 | 19 | 1 | 14 | 133 | 896 | 6 | 3 | 0.00 |
| settings-einrichtung | 35 | 19 | 174 | 133 | 1 | 5 | 19 | 2 | 11 | 115 | 808 | 7 | 3 | 0.00 |
| settings-allgemein | 45 | 18 | 174 | 133 | 0 | 5 | 17 | 1 | 11 | 187 | 1280 | 6 | 3 | 0.05 |
| settings-darstellung | 67 | 46 | 174 | 133 | 0 | 22 | 34 | 1 | 11 | 459 | 3009 | 6 | 4 | 0.00 |
| settings-barrierefreiheit | 42 | 23 | 174 | 133 | 0 | 9 | 18 | 1 | 11 | 197 | 1373 | 7 | 3 | 0.00 |
| settings-module | 47 | 13 | 174 | 133 | 0 | 5 | 35 | 1 | 29 | 144 | 1060 | 7 | 3 | 0.00 |
| settings-werkzeuge | 64 | 48 | 174 | 133 | 0 | 4 | 30 | 1 | 20 | 192 | 1453 | 6 | 3 | 0.00 |
| settings-benachrichtigungen | 44 | 23 | 174 | 133 | 1 | 8 | 20 | 1 | 11 | 188 | 1323 | 7 | 3 | 0.00 |
| settings-sicherheit | 41 | 25 | 174 | 133 | 0 | 7 | 17 | 1 | 11 | 291 | 2101 | 5 | 3 | 0.00 |
| settings-sync | 32 | 16 | 174 | 133 | 0 | 4 | 18 | 1 | 11 | 148 | 1027 | 7 | 3 | 0.00 |
| settings-ki | 40 | 16 | 174 | 133 | 0 | 6 | 20 | 1 | 11 | 216 | 1500 | 7 | 3 | 0.00 |
| settings-verbindungen | 38 | 14 | 174 | 133 | 0 | 4 | 17 | 1 | 11 | 171 | 1221 | 7 | 3 | 0.00 |
| settings-schnellerfassung | 33 | 17 | 174 | 133 | 0 | 4 | 18 | 1 | 11 | 187 | 1188 | 8 | 3 | 0.00 |
| settings-updates | 29 | 13 | 174 | 133 | 0 | 4 | 17 | 1 | 11 | 235 | 1663 | 6 | 4 | 0.00 |
| settings-entwickler | 34 | 18 | 174 | 133 | 1 | 5 | 17 | 1 | 11 | 169 | 1215 | 7 | 3 | 0.01 |
| settings-ueber | 42 | 13 | 174 | 133 | 0 | 5 | 17 | 1 | 12 | 140 | 1037 | 5 | 4 | 0.00 |
| settings-module-finance | 38 | 21 | 174 | 173 | 0 | 5 | 20 | 2 | 12 | 198 | 1404 | 5 | 3 | 0.00 |

### Reizlast über dem Falz – 412x915-dark, seed

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 53 | 25 | 569 | 200 | 1 | 3 | 53 | 2 | 2 | 96 | 327 | 7 | 4 | 0.00 |
| planner | 21 | 20 | 778 | 268 | 1 | 1 | 17 | 2 | 1 | 94 | 491 | 7 | 4 | 0 |
| todos | 36 | 21 | 580 | 239 | 1 | 2 | 11 | 2 | 2 | 88 | 518 | 7 | 4 | 0.02 |
| habits | 22 | 14 | 533 | 280 | 1 | 2 | 3 | 2 | 2 | 56 | 340 | 6 | 4 | 0.00 |
| timetrack | 19 | 18 | 572 | 297 | 1 | 2 | 10 | 2 | 2 | 43 | 279 | 6 | 4 | 0.06 |
| weather | 11 | 11 | 105 | 336 | 0 | 1 | 8 | 5 | 4 | 216 | 1037 | 9 | 5 | 0.97 |
| maps | 27 | 23 | 846 | 349 | 1 | 2 | 10 | 2 | 3 | 53 | 321 | 8 | 4 | 0 |
| people | 24 | 16 | 554 | 169 | 1 | 2 | 4 | 6 | 3 | 79 | 426 | 7 | 4 | 0.00 |
| fitness | 18 | 13 | 632 | 271 | 1 | 2 | 3 | 2 | 4 | 79 | 353 | 7 | 4 | 0.00 |
| finance | 16 | 16 | 834 | 344 | 1 | 6 | 3 | 3 | 2 | 54 | 335 | 9 | 4 | 0.05 |
| invoices | 18 | 14 | 687 | 314 | 1 | 5 | 5 | 2 | 6 | 75 | 459 | 8 | 4 | 0.00 |
| subscriptions | 15 | 9 | 523 | 244 | 1 | 3 | 8 | 4 | 3 | 72 | 385 | 8 | 4 | 0.07 |
| budgets | 14 | 12 | 681 | 364 | 1 | 3 | 15 | 2 | 2 | 56 | 273 | 6 | 4 | 0.00 |
| lists | 21 | 19 | 858 | 308 | 1 | 2 | 7 | 2 | 2 | 62 | 332 | 7 | 4 | 0 |
| pantry | 20 | 11 | 642 | 280 | 1 | 5 | 14 | 2 | 2 | 52 | 268 | 8 | 4 | 0.00 |
| bookmarks | 23 | 13 | 661 | 288 | 1 | 2 | 4 | 2 | 2 | 62 | 429 | 8 | 4 | 0.00 |
| notes | 27 | 27 | – | 133 | 1 | 2 | 11 | 2 | 2 | 119 | 795 | 6 | 3 | 0.00 |
| chat | 11 | 10 | 366 | 169 | 1 | 1 | 9 | 2 | 1 | 49 | 342 | 5 | 3 | 0 |
| feeds | 17 | 11 | 690 | 306 | 1 | 1 | 11 | 2 | 2 | 37 | 316 | 9 | 4 | 0 |
| music | 22 | 22 | 710 | 208 | 0 | 0 | 5 | 2 | 1 | 32 | 210 | 6 | 3 | 0.12 |
| vault | 18 | 17 | 817 | 307 | 1 | 1 | 13 | 2 | 2 | 72 | 430 | 7 | 4 | 0.00 |
| accounts | 5 | 5 | – | 141 | 1 | 1 | 3 | 2 | 1 | 18 | 142 | 5 | 4 | 0 |
| library | 9 | 6 | 93 | 232 | 0 | 1 | 6 | 1 | 3 | 57 | 421 | 7 | 3 | 0 |
| library-vault | 4 | 4 | 145 | 209 | 0 | 0 | 11 | 2 | 1 | 53 | 379 | 6 | 3 | 0 |
| tools | 8 | 4 | 93 | 212 | 0 | 1 | 6 | 1 | 3 | 65 | 437 | 7 | 3 | 0 |
| settings | 19 | 12 | 169 | 338 | 0 | 4 | 1 | 1 | 2 | 57 | 361 | 5 | 3 | 0 |
| settings-einrichtung | 6 | 6 | 169 | 137 | 1 | 2 | 3 | 2 | 2 | 39 | 302 | 7 | 3 | 0 |
| settings-allgemein | 7 | 7 | 169 | 113 | 0 | 2 | 0 | 1 | 2 | 75 | 500 | 5 | 3 | 0.09 |
| settings-darstellung | 19 | 19 | 169 | 113 | 0 | 14 | 12 | 1 | 2 | 232 | 1527 | 6 | 4 | 0 |
| settings-barrierefreiheit | 9 | 9 | 169 | 113 | 0 | 3 | 1 | 1 | 2 | 100 | 707 | 6 | 3 | 0.07 |
| settings-module | 7 | 3 | 169 | 113 | 0 | 2 | 4 | 1 | 5 | 60 | 480 | 7 | 3 | 0 |
| settings-werkzeuge | 2 | 2 | 169 | 113 | 0 | 1 | 1 | 1 | 2 | 15 | 148 | 5 | 3 | 0.00 |
| settings-benachrichtigungen | 6 | 6 | 169 | 113 | 1 | 3 | 3 | 1 | 2 | 86 | 614 | 7 | 3 | 0.12 |
| settings-sicherheit | 7 | 7 | 169 | 137 | 0 | 3 | 0 | 1 | 2 | 107 | 758 | 5 | 3 | 0.01 |
| settings-sync | 5 | 5 | 169 | 113 | 0 | 1 | 2 | 1 | 2 | 69 | 520 | 7 | 3 | 0.00 |
| settings-ki | 6 | 6 | 169 | 113 | 0 | 3 | 3 | 1 | 2 | 89 | 648 | 7 | 3 | 0 |
| settings-verbindungen | 3 | 3 | 169 | 113 | 0 | 1 | 0 | 1 | 2 | 79 | 566 | 7 | 3 | 0.00 |
| settings-schnellerfassung | 5 | 5 | 169 | 113 | 0 | 1 | 1 | 1 | 2 | 79 | 482 | 7 | 3 | 0 |
| settings-updates | 3 | 3 | 169 | 113 | 0 | 1 | 1 | 1 | 2 | 84 | 593 | 6 | 4 | 0.00 |
| settings-entwickler | 6 | 6 | 169 | 113 | 1 | 2 | 1 | 1 | 2 | 84 | 608 | 6 | 3 | 0.00 |
| settings-ueber | 3 | 3 | 169 | 113 | 0 | 2 | 1 | 1 | 3 | 43 | 335 | 5 | 4 | 0.00 |
| settings-module-finance | 5 | 5 | 169 | 249 | 0 | 1 | 4 | 2 | 3 | 97 | 721 | 5 | 3 | 0 |

### Reizlast über dem Falz – 1920x1080-dark, empty

| Seite | Aktionen | davon Chrome | Inhalt ab y | Kopf px | Primär | Farbe Text | Farbe Fläche | Verläufe | Farbe Icon | Wörter | Zeichen | Schriftgrößen | Gewichte | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 58 | 23 | 551 | 286 | 1 | 5 | 17 | 2 | 3 | 116 | 439 | 7 | 4 | 0.01 |
| planner | 19 | 19 | – | 211 | 1 | 1 | 10 | 2 | 2 | 122 | 522 | 8 | 4 | 0.00 |
| todos | 19 | 19 | – | 180 | 0 | 1 | 5 | 2 | 3 | 42 | 255 | 7 | 4 | 0.01 |
| habits | 15 | 15 | – | 200 | 1 | 2 | 3 | 2 | 2 | 42 | 298 | 4 | 3 | 0.02 |
| timetrack | 15 | 15 | – | 233 | 1 | 2 | 3 | 2 | 2 | 43 | 280 | 6 | 4 | 0.05 |
| weather | 11 | 11 | – | 200 | 1 | 1 | 3 | 5 | 1 | 40 | 255 | 4 | 4 | 0.01 |
| maps | 14 | 14 | – | 233 | 1 | 2 | 4 | 2 | 4 | 35 | 201 | 6 | 4 | 0.01 |
| people | 13 | 13 | – | 140 | 1 | 1 | 4 | 2 | 4 | 30 | 211 | 5 | 3 | 0.02 |
| fitness | 10 | 10 | – | 206 | 1 | 2 | 3 | 2 | 3 | 40 | 241 | 7 | 4 | 0.01 |
| finance | 14 | 14 | 660 | 292 | 1 | 5 | 3 | 3 | 3 | 57 | 316 | 8 | 4 | 0.08 |
| invoices | 13 | 13 | – | 140 | 1 | 2 | 4 | 2 | 3 | 30 | 202 | 7 | 4 | 0.01 |
| subscriptions | 9 | 9 | – | 213 | 1 | 1 | 4 | 2 | 4 | 32 | 174 | 7 | 3 | 0.02 |
| budgets | 12 | 12 | – | 213 | 1 | 2 | 4 | 2 | 3 | 33 | 213 | 4 | 3 | 0.02 |
| lists | 14 | 14 | – | 233 | 1 | 2 | 6 | 2 | 3 | 30 | 191 | 7 | 4 | 0.01 |
| pantry | 11 | 11 | – | 205 | 1 | 2 | 8 | 2 | 3 | 31 | 204 | 5 | 3 | 0.02 |
| bookmarks | 14 | 14 | – | 249 | 1 | 2 | 4 | 2 | 3 | 22 | 156 | 5 | 3 | 0.01 |
| notes | 21 | 21 | – | 142 | 1 | 2 | 4 | 2 | 3 | 31 | 186 | 6 | 3 | 0.01 |
| chat | 12 | 12 | 368 | 163 | 1 | 1 | 9 | 2 | 2 | 58 | 390 | 5 | 3 | 0.01 |
| browser | 17 | 17 | – | 118 | 0 | 0 | 2 | 1 | 1 | 42 | 289 | 6 | 3 | 0.02 |
| feeds | 10 | 10 | – | 231 | 1 | 1 | 10 | 2 | 3 | 29 | 175 | 4 | 4 | 0.01 |
| mail | 10 | 10 | – | 141 | 0 | 1 | 3 | 1 | 3 | 39 | 258 | 4 | 2 | 0.01 |
| music | 10 | 10 | – | 213 | 1 | 1 | 4 | 2 | 3 | 38 | 252 | 4 | 3 | 0.01 |
| vault | 15 | 15 | – | 205 | 1 | 1 | 13 | 2 | 3 | 39 | 295 | 7 | 3 | 0.02 |
| accounts | 7 | 7 | – | 141 | 1 | 1 | 3 | 2 | 1 | 52 | 432 | 4 | 3 | 0.00 |
| disk | 10 | 4 | 502 | 238 | 0 | 3 | 2 | 1 | 2 | 175 | 930 | 9 | 4 | 0.13 |
| downloads | 18 | 10 | 415 | 165 | 1 | 2 | 7 | 1 | 1 | 87 | 564 | 5 | 4 | 0.01 |
| library | 17 | 6 | 93 | 223 | 0 | 1 | 56 | 3 | 9 | 157 | 1093 | 7 | 3 | 0.01 |
| library-vault | 4 | 4 | 145 | 133 | 0 | 0 | 11 | 2 | 1 | 53 | 379 | 6 | 3 | 0.01 |
| tools | 24 | 4 | 93 | 207 | 0 | 1 | 22 | 1 | 9 | 172 | 1204 | 7 | 3 | 0.01 |
| settings | 36 | 12 | 174 | 368 | 0 | 4 | 19 | 1 | 14 | 131 | 889 | 6 | 3 | 0.00 |
| settings-einrichtung | 35 | 19 | 174 | 133 | 1 | 5 | 20 | 2 | 11 | 118 | 829 | 7 | 3 | 0.00 |
| settings-allgemein | 45 | 18 | 174 | 133 | 0 | 5 | 17 | 1 | 11 | 185 | 1273 | 6 | 3 | 0.07 |
| settings-darstellung | 67 | 46 | 174 | 133 | 0 | 22 | 34 | 1 | 11 | 457 | 3002 | 6 | 4 | 0.00 |
| settings-barrierefreiheit | 42 | 23 | 174 | 133 | 0 | 9 | 18 | 1 | 11 | 195 | 1366 | 7 | 3 | 0.00 |
| settings-module | 47 | 13 | 174 | 133 | 0 | 5 | 35 | 1 | 29 | 142 | 1053 | 7 | 3 | 0.00 |
| settings-werkzeuge | 64 | 48 | 174 | 133 | 0 | 4 | 30 | 1 | 20 | 190 | 1446 | 6 | 3 | 0.00 |
| settings-benachrichtigungen | 44 | 23 | 174 | 133 | 1 | 8 | 20 | 1 | 11 | 186 | 1316 | 7 | 3 | 0.00 |
| settings-sicherheit | 41 | 25 | 174 | 133 | 0 | 7 | 17 | 1 | 11 | 289 | 2094 | 5 | 3 | 0.00 |
| settings-sync | 32 | 16 | 174 | 133 | 0 | 4 | 18 | 1 | 11 | 146 | 1020 | 7 | 3 | 0.00 |
| settings-ki | 40 | 16 | 174 | 133 | 0 | 6 | 20 | 1 | 11 | 214 | 1493 | 7 | 3 | 0.00 |
| settings-verbindungen | 38 | 14 | 174 | 133 | 0 | 4 | 17 | 1 | 11 | 169 | 1214 | 7 | 3 | 0.00 |
| settings-schnellerfassung | 33 | 17 | 174 | 133 | 0 | 4 | 18 | 1 | 11 | 185 | 1181 | 8 | 3 | 0.00 |
| settings-updates | 29 | 13 | 174 | 133 | 0 | 4 | 17 | 1 | 11 | 233 | 1656 | 6 | 4 | 0.00 |
| settings-entwickler | 34 | 18 | 174 | 133 | 1 | 5 | 17 | 1 | 11 | 177 | 1304 | 7 | 3 | 0.00 |
| settings-ueber | 42 | 13 | 174 | 133 | 0 | 5 | 17 | 1 | 12 | 138 | 1030 | 5 | 4 | 0.00 |
| settings-module-finance | 38 | 21 | 174 | 173 | 0 | 5 | 20 | 2 | 12 | 196 | 1397 | 5 | 3 | 0.00 |

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

### Flächen: Rahmen vs. Schatten vs. Tönung – 1920 dunkel, Seed

| Seite | Rahmen (1 px rundum) | Ringe | Schatten | getönt | --surface-2 | Verläufe | Radien (px×n) | Animationen | Transitions (Eigenschaft×n) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calendar | 37 | 0 | 4 | 4 | 11 | 2 | 8px×87, 999px×15, 12px×3, 20px×2, 16px×1 | 1 | transform×7 |
| planner | 0 | 0 | 12 | 1 | 21 | 2 | 8px×29, 16px×13, 12px×9, 999px×8 | 10 | transform×25 |
| todos | 1 | 1 | 12 | 6 | 47 | 2 | 8px×47, 16px×12, 12px×12, 999px×12 | 10 | transform×57 |
| habits | 4 | 0 | 2 | 1 | 6 | 2 | 999px×10, 16px×4, 12px×3, 20px×1 | 1 | transform×11 |
| timetrack | 0 | 0 | 3 | 1 | 2 | 2 | 999px×10, 16px×4, 12px×3, 20px×1, 8px×1 | 2 | transform×4 |
| weather | 1 | 0 | 28 | 19 | 2 | 5 | 12px×31, 999px×9, 8px×5, 16px×2, 40px×1 | 1 | transform×2 |
| maps | 0 | 1 | 3 | 6 | 12 | 2 | 999px×15, 8px×8, 12px×6, 20px×1, 16px×1 | 9 | transform×10 |
| people | 0 | 1 | 30 | 2 | 32 | 26 | 16px×28, 999px×10, 12px×3, 20px×1 | 10 | transform×33 |
| fitness | 0 | 0 | 30 | 1 | 4 | 2 | 8px×57, 16px×28, 999px×5, 12px×3, 20px×1 | 10 | transform×7 |
| finance | 0 | 0 | 25 | 1 | 25 | 4 | 16px×22, 8px×18, 999px×13, 12px×4, 20px×2 | 10 | transform×28 |
| invoices | 0 | 1 | 5 | 4 | 11 | 2 | 12px×10, 8px×10, 999px×5, 16px×3, 20px×1 | 8 | transform×20 |
| subscriptions | 15 | 0 | 2 | 16 | 15 | 4 | 8px×9, 999px×7, 16px×4, 12px×2 | 10 | transform×23 |
| budgets | 3 | 0 | 8 | 11 | 5 | 2 | 999px×6, 16px×6, 12px×5, 20px×1 | 7 | transform×11 |
| lists | 0 | 0 | 2 | 1 | 18 | 2 | 8px×18, 12px×7, 16px×4, 999px×3 | 10 | transform×38 |
| pantry | 28 | 0 | 2 | 1 | 52 | 2 | 999px×19, 12px×16, 20px×1 | 10 | transform×39 |
| bookmarks | 0 | 0 | 6 | 2 | 35 | 2 | 8px×35, 999px×9, 12px×4, 20px×1, 16px×1 | 10 | transform×66 |
| notes | 1 | 0 | 2 | 2 | 20 | 2 | 8px×13, 12px×11, 999px×8, 16px×1, 20px×1 | 1 | transform×25 |
| chat | 0 | 0 | 3 | 2 | 1 | 2 | 999px×7, 12px×4, 16px×3 | 1 | transform×4 |
| browser | 1 | 0 | 2 | 1 | 9 | 1 | 12px×9, 999px×8, 8px×7, 16px×1 | 7 | transform×9 |
| feeds | 1 | 0 | 2 | 2 | 8 | 2 | 999px×7, 8px×3, 12px×2 | 1 | transform×9 |
| mail | 2 | 1 | 5 | 2 | 11 | 1 | 12px×18, 8px×11, 999px×9, 16px×4 | 8 | transform×21 |
| music | 0 | 0 | 6 | 5 | 6 | 2 | 999px×12, 12px×5, 16px×1 | 1 | transform×8 |
| vault | 34 | 0 | 1 | 1 | 1 | 2 | 12px×20, 999px×2 | 10 | transform×9 |
| accounts | 0 | 1 | 0 | 2 | 1 | 2 | 999px×2, 12px×2 | 1 | transform×2 |
| disk | 0 | 0 | 6 | 1 | 1 | 1 | 12px×6, 999px×4, 16px×4, 20px×1 | 1 | transform×6 |
| downloads | 0 | 0 | 3 | 3 | 10 | 1 | 999px×3, 12px×3, 8px×3, 20px×1, 16px×1 | 4 | transform×14 |
| library | 6 | 0 | 28 | 80 | 26 | 3 | 12px×72, 16px×32, 8px×25, 20px×3 | 1 | transform×44 |
| library-vault | 0 | 0 | 3 | 1 | 1 | 2 | 20px×2, 16px×2, 12px×2, 8px×1 | 1 | transform×2 |
| tools | 3 | 0 | 18 | 35 | 21 | 1 | 12px×21, 16px×19, 20px×3 | 1 | transform×28 |
| settings | 9 | 0 | 5 | 1 | 4 | 1 | 12px×18, 16px×9, 20px×6, 999px×6 | 1 |  |
| settings-einrichtung | 1 | 0 | 5 | 2 | 5 | 2 | 12px×24, 20px×6, 999px×6, 16px×1 | 1 | transform×7 |
| settings-allgemein | 10 | 1 | 6 | 2 | 16 | 1 | 12px×47, 999px×11, 20px×7 | 1 | transform×27 |
| settings-darstellung | 2 | 1 | 14 | 14 | 40 | 1 | 12px×32, 999px×21, 20px×15, 8px×10, 16px×2 | 1 | transform×31 |
| settings-barrierefreiheit | 0 | 0 | 13 | 2 | 21 | 1 | 12px×22, 999px×17, 20px×14 | 1 | transform×18 |
| settings-module | 24 | 0 | 5 | 1 | 4 | 1 | 12px×42, 20px×6, 999px×6 | 1 |  |
| settings-werkzeuge | 0 | 0 | 5 | 1 | 64 | 1 | 12px×19, 20px×6, 999px×6 | 1 | transform×64 |
| settings-benachrichtigungen | 4 | 0 | 14 | 3 | 14 | 1 | 12px×29, 999px×15, 20px×12, 16px×7 | 1 | transform×29 |
| settings-sicherheit | 0 | 0 | 7 | 1 | 8 | 1 | 12px×20, 999px×14, 20px×8 | 1 | transform×3 |
| settings-sync | 2 | 0 | 9 | 2 | 4 | 1 | 12px×29, 20px×6, 999px×6, 16px×5 | 1 | transform×7 |
| settings-ki | 2 | 1 | 7 | 3 | 6 | 1 | 12px×27, 999px×11, 20px×7, 16px×3 | 1 | transform×21 |
| settings-verbindungen | 4 | 1 | 11 | 3 | 11 | 1 | 12px×41, 16px×9, 999px×8, 20px×6 | 1 | transform×55 |
| settings-schnellerfassung | 4 | 0 | 6 | 2 | 5 | 1 | 12px×20, 999px×9, 20px×6, 16px×2 | 1 | transform×2 |
| settings-updates | 0 | 0 | 9 | 1 | 4 | 1 | 12px×19, 20px×6, 999px×6, 16px×4 | 1 | transform×1 |
| settings-entwickler | 1 | 0 | 6 | 1 | 5 | 1 | 12px×25, 20px×6, 999px×6, 16px×2 | 1 | transform×5 |
| settings-ueber | 2 | 1 | 5 | 3 | 6 | 1 | 12px×45, 999px×10, 20px×6, 16px×2 | 1 | transform×18 |
| settings-module-finance | 2 | 1 | 6 | 2 | 6 | 2 | 12px×20, 999px×9, 20px×7, 16px×2 | 1 | transform×5 |

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
| page-todos--v-irgendwann | 3 | 24×24 _check_jdqxd_88 | Keller aufräumen; 24×24 _check_jdqxd_88 | Bücher aussortieren 22 | 1 | _nextTitle_jdqxd_328 | Termin vereinbaren 9 |
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
