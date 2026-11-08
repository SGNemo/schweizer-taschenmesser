# UI schärfen, Runde 6 – K · Kosmetik, Messwerte, Tabu-Notizen (U28–U36, T01–T05)

Teil von [FINDINGS.md](FINDINGS.md); Belege und Spalten wie dort. Belege: `web/.screens/round6/<viewport>-<theme>/<seed|empty>/<name>.png` (im PR-Text), Messwerte `facts-*.json`, `cls-sources.json`.

### K · Kosmetik und Messwerte

| Id | Seite/Ansicht | Plattform/Theme | Beleg / Messung | Regel | Ursache (Datei:Zeile) | Fix | Aufwand | Bereich |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| U28 | überall | D+P | 4-px-Raster (gemessen `offGrid`): Segment-Padding 3 px (`_segment paddingTop/Left=3`), Kopfband-Innenabstand 36,8 px (`_inner paddingLeft=36.8` = 2,3 rem) | DESIGN-SPEC §5 Spacing | `ui/Patterns.module.css:42` (`padding: 3px`), `ui/HeadSurface.module.css` `.inner` | 4 px (Segment 44 px bleibt über `min-height`), 2,25 rem (36 px) | S | ui |
| U29 | Downloads, Zeile „handbuch.pdf“ | D, `page-downloads` | SHA- und Pfadzeile 29 px weiter links als Titel und Meta (Icon-Spalte fehlt) | Kanten fluchten | `modules/downloads/routes/DownloadsPage.tsx` Detailzeilen außerhalb `main` | Detailzeilen in den `main`-Slot der Zeile | S | modules/downloads |
| U30 | Zeiterfassung-Widget | D, `widget-timetrack-*` | „Nichts läuft“ + große „2:00“ + „Heute: 2 Std 0 Min“ – die Zahl steht zweimal, die Kontextzeile ist doppelt | DESIGN-SPEC §4a „eine Kontextzeile je Zahl“ | `modules/timetrack/widgets/*` | KPI „2:00“ mit Kontext „heute · nichts läuft“ | S | modules/timetrack |
| U31 | Einstellungen-Navigation | D, `page-settings` | Status „Nicht erlaubt“ rutscht unter „Benachrichtigungen“ (rechtsbündig, eigene Zeile), bewusst so gelöst, wirkt aber wie ein Versatz | Kanten fluchten | `pages/settings/SettingsLayout.module.css:248–250` | kürzerer Status („Aus“) oder Status als Punkt mit Tooltip | S | settings |
| U32 | Bibliothek, Modulkarten | D, `page-library` | Karten-Fuß uneinheitlich: Module ohne Importer zeigen „Details · X einschalten“ in einer Zeile, andere zwei Zeilen („Details Importieren“ / „X einschalten“) | Rhythmus | `pages/library/*` Kartenfuß | Fuß immer zweizeilig oder Importieren ins Details | S | library |
| U33 | Übersicht, Lesezeichen-Widget | D, `overview-all` (gemessen `clipped`) | Kachel-Label „Wochenmarkt-Karte der Region (2)“ abgeschnitten (einzeilig) | Tour „abgeschnitten“ | `modules/bookmarks/widgets/*` `tileLabel` | zweizeilig (`line-clamp: 2`) | S | modules/bookmarks |
| U34 | Toolbar am Handy | P, `412x915-dark/seed/page-finance` | Umbruch lässt ⋯ allein in einer Zeile stehen (Finanzen: „Mehr Felder · Buchung“ / „⋯“) | Rhythmus | `ui/Patterns.module.css` Toolbar-Wrap / `PageHeader` | ⋯ und Primär als eine nicht umbrechende Gruppe | S | ui |
| U35 | Kalender Woche/Tag | D+P, axe `scrollable-region-focusable` (serious) | Stundenraster scrollt, ist aber nicht per Tastatur erreichbar | WCAG 2.1.1 | `modules/calendar/components/TimeGrid.tsx:211` `tgBody` | `tabIndex={0}` + `aria-label` | S | modules/calendar |
| U36 | Kalender, Monat | D | Monatszellen: Chips einzeilig mit Ellipse – 40+ abgeschnittene Einträge je Monat (gemessen `clipped`); Teil von S03 | – | s. S03 | s. S03 | – | modules/calendar |

### Tabu-Bereiche (nur Board-Notiz, nicht fixen)

| Id | Seite | Fund | → Board an |
| --- | --- | --- | --- |
| T01 | E-Mail | Zweites Zahnrad unter dem Kopf-Zahnrad (Toolbar rechts), „Suchen“ primär neben „Aktualisieren“ (zwei Primäre), Hinweiskarte „Beispiel-Mails“ + Suchhinweis vor der Liste | `modules/mail/**` (Mail-Pakete) |
| T02 | „+ Neu“ (Schnell hinzufügen) | 13 Typ-Chips in drei Reihen + „Ziel: ToDos“ + drei Wege unter den Knöpfen („Speichern“, „+ Satz eintragen“, „Oder mit dem ganzen Formular“) – Reizlast | `quickCapture/**` (`feat/capture-multi-calm`) |
| T03 | Planer | S05, S08, S09; Board: Spalten verschieden hoch (451/350/575/139/275/74/551 px), Fr./So. nur Kopf | Planer-Chat (nach Svens Ansage: nach dem Rest) |
| T04 | Fitness | Kopf `1 Einheit · 55 Min` mit Hantel-Plate; nichts Auffälliges | `modules/fitness/**` |
| T05 | Einrichtung, Frage 3 | Fünf Schalter mit je 2–3 Zeilen Erklärung + 4-zeilige Fußnote (`layout/setup/steps`) – Reizlast; demo-a-Entscheidung | `core/setup/**` / `layout/setup/**` (falls noch offen) |

**Nicht gefunden (geprüft):** horizontaler Überlauf (0 px auf allen Seiten, beiden Größen, beiden Themes, mit Seed und leer), Fokusring nur bei Tastatur (`focusRing: mouse false / key true`), Zahlen ohne Kontextzeile in Widgets (0 Treffer), Übergänge auf width/height/colour (nur `accounts.module.css:32` `transition: width`), Hex/rohe Gewichte in Modul-CSS (Guards grün).

