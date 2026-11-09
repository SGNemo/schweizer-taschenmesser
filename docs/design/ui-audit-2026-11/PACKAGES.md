# PACKAGES – Identity 4.0 als Stopp-Pakete

Gehört zu [REPORT.md](REPORT.md) (Entscheidung, Befunde, Fragen) und [PACKAGE-0.md](PACKAGE-0.md) (0a im Detail). Stand: Du neigst zu 4.0 (2026-11-09, „eher 4“); die Fragen 2–4 sind offen, ihre Empfehlungen stehen hier als Vorgabe, die Alternativen am Ende. Zielform: [mockups/README.md](mockups/README.md) (vier Seiten, Bilder auf dem Branch `shots/ui-audit-2026-11`). Einheiten: S ≈ 0,5–1, M ≈ 2–3, L ≈ 4–5 Chat-Tage; jedes Paket = eigener Branch + PR + Council + Stopp. Alle 26 Module: Planen (Kalender, ToDos, Gewohnheiten, Zeiterfassung, Wetter, Karten, Personen, Planer), Geld (Finanzen, Rechnungen, Abos, Budgets), Haushalt (Listen, Vorräte, Fitness), Wissen (Merkliste, Notizen, Chat, Browser, Mail, Musik, Feeds), Tresor (Unterlagen, Passwörter), System (Dieser PC, Downloads).

## Was 4.0 ändert – die fünf Regeln

4.0 ändert das Gerüst, vier Identitätsregeln (MODULE-IDENTITY: Kopf-Silhouetten :33–45, Sub-Navigations-Zone :17, Band-Geometrie :21, getönte Widget-Kopfzone :71/:76) und fünf Spec-Regeln (DESIGN-SPEC §7 „Schatten, kein Rahmen“ wird zu Tonstufen, :24 das gefüllte „+ Neu“ wird neutral, :68 „Jetzt wichtig“ kappt bei 4 + „n weitere“ statt 6 und faltet nie danger/heute, :29 die Bottom-Bar wird Übersicht · Planen · Plus · Geld · Mehr statt drei Bereichs-Slots, :10 kein FAB – der Plus in der Leiste ist die Hauptaktion am Handy); Palette, Marken (`identity.signature`), Widget-Katalog und die gerahmten Signatur-Blöcke bleiben.

1. **Flächen-/Tiefenmodell:** Tonstufen statt Schatten (`--surface-raised`/`-sunken`, `--shadow-1` nur für Schwebendes), Karten ohne Rahmen, Zeilen als Flächen, höchstens zwei Ebenen; Lint mit eingefrorener Baseline, die je Bereichs-Paket schrumpft.
2. **Kopf-Logik:** eine Titelzeile in Inhaltsbreite (Lesemaß bei `reading`, Seitenbreite bei `split`) – Eyebrow (Bereich · Kontext), h1 28/600 Desktop und 22/600 Handy, **eine** Kennzahl mit Kontextzeile, **eine** gefüllte Modul-Aktion (nur Desktop), Tabs an der Unterkante; sticky. Höhe: Desktop Titelzeile + Tabs ≤ 7,5 rem (120 px); Handy Titelzeile + Modul-Zeile + Tabs ≤ 9 rem (144 px), Inhalt ab y ≤ 220 px (mit Topbar). Die neun Varianten werden zu „Standard“ und „Bühne“ (Wetter, Musik; die Bühne darf höher sein, bleibt aber unter dem Falz); die Kopf-Signatur-Slots ziehen in Widget-Marke, Leerzustand und Bibliothek um.
3. **Navigation in einer Ebene:** Bereiche bleiben die Ordnung der Seitenleiste (nur der aktive Bereich offen, wie heute); Sub-Navigation entfällt am Desktop, am Handy wird sie die eine Modul-Zeile unter dem Kopf; die Bottom-Bar wird Übersicht · Planen · Plus · Geld · Mehr (`layout/BottomNav.tsx:8` `BOTTOM_AREA_SLOTS` 3 → 2, DESIGN-SPEC :29; Haushalt und die übrigen Bereiche liegen unter „Mehr“, einen Tipp tiefer – V-1 macht Haushalt in der Seitenleiste und im Mehr-Blatt sichtbar; M9 bleibt bei fünf Zielen).
4. **Ein Eintragen-Einstieg je Bildschirm:** Desktop – die gefüllte Modul-Aktion im Kopf, global das neutrale „Neu“ (Schnellerfassung); Handy – der Plus-Knopf in der Mitte der Bottom-Bar (Daumenzone, M9; auf einer Modulseite die Modul-Aktion, auf der Übersicht die Schnellerfassung), im Kopf keine Aktion, kein FAB über dem Inhalt; kein zweiter Toolbar-Knopf; Ausnahme Erfassungslisten (Listen, Planer): das Inline-Feld bleibt als ruhige letzte Zeile der Liste; „Satz eintragen“ wird ein Modus der Schnellerfassung.
5. **Dichte je Gerät:** Master–Detail als Standard für Listenmodule, Lesemaß über `manifest.layout`/`PageContainer` (kein Modul-`max-width`), Zeilen 48 px am Handy und 44 px am Desktop (36 px nur unter `pointer: fine`), Handy-Inhalt ab Bildschirm 1.

Dazu die 3.2-Politur (Einstiege zusammenlegen, Status-Wege kürzen, Dialoge „erst das Nötige“) als Inhalt der Bereichs-Pakete. **Was bleibt, wörtlich und mit Test:** Palette v3 und Marken, Widget-Katalog, Stripe-Regel, AA-Kontrast inkl. `--text-on-tint`, Touch ≥ 44 px, Bewegung nur `transform`/`opacity`, ruhiger Farbmodus, Werte verbergen, Lesehilfe- und Tresor-Ausschluss, KI-Datenschutz, Datenschutz-Sätze, Farbe nur mit Text/Icon, Reizbudget, Overflow, axe, Diagnose-Negativliste, Einrichtung nie von selbst, `forced-colors`, die harten UI-Regeln aus CLAUDE.md – je Zusage der Test in [PACKAGE-0.md](PACKAGE-0.md) „Zusagen“.

## Reihenfolge und Go/No-Go

0a (≈ 5 Chat-Tage, PACKAGE-0) → **V-1 Sichtbarkeit** (Frage 2, unabhängig vom Go) → **Go-Punkt:** 0a inklusive `e2e-seed` grün, Handtest (Maßnahme 0) erledigt, Council-Abnahme → 0b-1, 0b-1r, 0b-2 … 0b-8 mit Stopp nach jedem. No-Go = 0b wartet, V-1 bleibt; ein Rückfall auf 3.2 nur durch Svens Entscheidung. Jeder 0b-PR: kein `full-ci`-Label nötig (die Wächter laufen über den `seed`-Output), Council vor der Übergabe, Reizbudget-Ratsche grün oder von Sven per Label freigegeben – nur in 0b-1 (erste Baseline der vier neuen Größen, Rahmen/Schatten runter), 0b-2 (Kopf/Tabs: `buttons`/`links`/`firstScreenActions` neu, erwartet runter) und 0b-5 (zwei Signatur-Blöcke); jeder andere 0b-PR ohne Label.

| Paket | Umfang | Aufwand |
| --- | --- | --- |
| V-1 | Sichtbarkeit: Listen und Budgets bei Neuinstallationen an, Downloads `stable` (Windows) | S–M, 1,5–2 |
| 0b-1 | Fundament: Tokens, Bausteine, Lints | L, 4–5 |
| 0b-1r | Lade-Maßnahme 4 (Rust): `async`-Commands, Inventur | M, 2–3 |
| 0b-2 | Kopf + Navigation | L, 4–5 |
| 0b-3 | Bereich Geld | M, 2–3 |
| 0b-4 | Bereich Planen | M, 2–3 |
| 0b-5 | Bereiche Haushalt + Tresor | M, 2–3 |
| 0b-6 | Bereiche Wissen + System | M, 2–3 |
| 0b-7 | Übersicht und Leerzustände | M, 2–3 |
| 0b-8 | Abnahme-Sweep | M, 2–3 |

**0b ≈ 22–31 Chat-Tage** in neun Paketen (0b-1 bis 0b-8 plus 0b-1r); mit 0a (≈ 5) **4.0 gesamt ≈ 27–36 Chat-Tage**; 3.2 käme auf ≈ 13–17 (0a 5 + Politur 8–12); V-1 (1,5–2) kommt bei beiden Wegen dazu, wenn Frage 2 so beantwortet wird. Reihenfolge der Bereiche: Geld zuerst (Svens Schwerpunkt, vier Module, Master–Detail und Kennzahl-Kopf als Muster), dann Planen (die meistgenutzten Seiten Kalender und ToDos, acht Module, das größte Paket), dann Haushalt + Tresor (fünf Module, darunter die beiden Signatur-Blöcke), zuletzt Wissen + System (neun Module, sechs davon nur Desktop oder selten).

## V-1 · Sichtbarkeit (S–M, 1,5–2 Chat-Tage)

- **Umfang:** Listen und Budgets bei Neuinstallationen an, Downloads unter Windows `stable` ohne Torrent-Teil; Bestandsinstallationen und Sync-Geräte unverändert. Mechanik: gerätelokaler Default-Stand in `_meta` mit Reset beim ersten Pull mit Fremd-Ops oder Restore, benutzte Module bleiben an ([PACKAGE-0.md](PACKAGE-0.md) „H-a“).
- **Regeln/Tests:** keine synchronisierte `_modules`-Zeile ohne Nutzung; `core/setup/detect.ts`-Test „Einrichtung erscheint nie von selbst bei Daten“ bleibt grün; vier neue Tests (PACKAGE-0 „H-a“).
- **Abnahme:** Neuinstallation zeigt Haushalt, Geld mit Budgets und (Windows) System in der Seitenleiste; ein Altgerät mit Sync zeigt nach dem Beitritt eines Neugeräts keine neue Zeile; eine ausdrückliche Haushaltswahl (`enabled: false`) bleibt auf allen Geräten; bewusste Folge: ein Gründergerät verliert beim Beitritt eines zweiten Geräts höchstens Budgets ohne Einträge aus der Navigation (Downloads bleibt: es gehört zum Default-Stand, ist aber vom Reset ausgenommen, weil es keine Collections und keinen Sync-Effekt hat).
- **Stopp:** PR + Council; unabhängig vom Go-Punkt, läuft auch bei No-Go.

## 0b-1 · Fundament (L, 4–5 Chat-Tage)

- **Umfang:** Tokens `--surface-raised`, `--surface-sunken` (neutrale Tonstufen, beide Themes), `--shadow-1` nur noch für Schwebendes (Menü, Dialog, Toast), `--border` nur für Trennlinien in Listen und Formularen; `ruhig`/`aus` behalten ihre Flachstellung (`tokens.css:430`); die vier neuen Ratschen-Größen (`borders`, `shadows`, `surfaceLanguages`, `colouredAboveFold`) bekommen hier ihre erste Baseline. Bausteine: `Card` ohne Schatten (Tonstufe), `ListSurface` (Zeilen als Flächen, Hairline nur zwischen Zeilen), `Tabs` als die eine Ansichten-Navigation (`Segmented` nur noch für Filter), `PageContainer` mit `manifest.layout`-Varianten `reading` (56–64 rem) und `split` (Master–Detail). Rahmen und Schatten werden nicht per statischem Lint geprüft, sondern über die neuen Ratschen-Größen `borders`/`shadows` je Seite × Viewport aus `stimulus-budget.json` (PACKAGE-0 „Reizbudget-Ratsche“), deren Startwerte die heutigen Laufzeit-Zählungen sind (Rahmen: Kalender 37, Unterlagen 34, Vorräte 28, Einstellungen→Module 24, Abos 15; Schatten: Personen 30, Fitness 30, Wetter 28, Bibliothek 28, Finanzen 25) und die je Bereichs-Paket sinken – sonst wäre 0b-1 sofort rot.
- **Regeln/Tests:** `ui/tokens.test.ts:112` schließt die neuen Flächen-Tokens in beiden Themes ein (AA gegen `--text`, `--text-muted`, `--text-3`); `noStripes.test.ts`, `calm.spec.ts`, `hide-values.spec.ts` unverändert grün; die Ratsche bekommt genau hier die neue Baseline (einmalig, mit Label).
- **Abnahme:** kein Modul angefasst (Diff nur `ui/**`, `layout/**`, Tokens, Lints, Baselines); Übersicht sowie Finanzen und ToDos als Vorher/Nachher-Bilder im PR; Council.
- **Stopp:** Paket 0b-1r und 0b-2 warten auf die Abnahme.

## 0b-1r · Lade-Maßnahme 4 (M, 2–3 Chat-Tage, Rust)

- **Umfang:** `browser_open`/`browser_show` als `async`-Commands, `opened` erst nach Erfolg, `browser_show` meldet fehlende Tabs, Inventur der 87 synchronen Commands nach „kann blockieren“ – Spezifikation in [PACKAGE-0.md](PACKAGE-0.md) „0a-2, Maßnahme 4“.
- **Regeln/Tests:** `guard.rs` und `confirmed_twice` in `disk_delete` unverändert; keine neuen Commands ohne `build.rs` `COMMANDS` + `capabilities/desktop.json`; `cargo check`, `cargo test` der Crates.
- **Abnahme:** Windows-Handtest (Maßnahme 0 als MANUAL-TESTS-Schritt): Browser-Tab öffnen, dann drei Module – kein „…“, kein „Keine Rückmeldung“ in der Titelleiste.
- **Stopp:** eigener PR, unabhängig von 0b-2; kann parallel zu 0b-2 laufen.

## 0b-2 · Kopf + Navigation (L, 4–5 Chat-Tage)

- **Umfang:** die Titelzeile aus Regel 2 (Standard und Bühne), Sub-Navigation entfällt am Desktop, am Handy die Modul-Zeile unter dem Kopf; Bottom-Bar Übersicht · Planen · Plus · Geld · Mehr (Regel 3; Frage 3, Empfehlung A); Einstieg nach Regel 4: Desktop Modulknopf im Kopf + neutrales „Neu“ (DESIGN-SPEC :24), Handy der Plus in der Bottom-Bar (Modul-Aktion auf Modulseiten, Schnellerfassung auf der Übersicht), kein Kopfknopf und kein FAB am Handy (DESIGN-SPEC :10). Handy-Dichte (Frage 4, Empfehlung A): Kopf ≤ 9 rem inkl. Modul-Zeile, Inhalt ab Bildschirm 1; die Zeilenhöhe 48 px kommt mit den Bereichs-Paketen.
- **Regeln/Tests, die sich hier ändern (als eigener, benannter Schritt):** `core/modules/registry.test.ts:80–82, :104, :110–124, :133, :139–141, :159`; `scripts/lib/checkIdentity.ts:59–65` und der Kopf-Anteil von `:81–101`; `layout/moduleShell.test.tsx:19–28, :30–42, :44–60, :62–68` (Ersatz aus 0a-1b: „genau ein `PageTitle`-h1 im Kopf-Slot“ + Quelltext-Test gegen eigene `<h1>`); `layout/moduleShell.test.tsx:70–82` („views stay below the head“ – Tabs ziehen an die Kopfunterkante), `:84–96`, `:98–105` (Kalender-Tagblock im L-Slot), `:107–131` und `:133–145` (Signatur-Slots je Kopfvariante), `:147–151` (compact bar); `layout/BottomNav.tsx:8` und `layout/nav.test.tsx` (zwei Bereichs-Slots + Plus); `modules/music/__tests__/music.test.tsx:315`; `scripts/lib/checkModules.test.ts:20, :78–79`; `scripts/lib/moduleCatalog.test.ts:34`; `scripts/lib/checkIdentity.test.ts:127–136` (`checkSignatureUse`); e2e: `e2e/shell.spec.ts:72–80` („modules of an area are a sub-navigation under the head“ – steht in `SMOKE_FILES`, wird auf dem 0b-2-PR als erster rot), `e2e/layout.spec.ts:236` (Sub-Navigation scrollt unter den Kopf) und `:268–290` (fokus-Köpfe), `e2e/identity.spec.ts:74` (Signatur-Slot), `hue-consistency.spec.ts`, `library-identity.spec.ts` (Kopf-Zeilen), `overview-head.spec.ts` (Kopf-Teil). **Berührte Zusagen mit neuem Assert:** Schnellerfassung als Palettenmodus → `core/ai/privacy.test.ts` (Enter = lokal eintragen, nur „?“ geht an den Assistenten, nie Eingabetext ohne „?“) und `modules/accounts/__tests__/exclusion.test.ts` (Palette und Capture kennen `accounts`/`vault` weder als Ziel noch als Treffer); Kopf-Kennzahl → `hide-values.spec.ts` (Kennzahl in Finanzen/Budgets verdeckt). MODULE-IDENTITY.md bekommt den Abschnitt „4.0 – Entwurf“, DESIGN-SPEC :24 den neutralen „Neu“.
- **Abnahme:** Seed-e2e „Kopf ≤ 120 px Desktop auf allen 26 und ≤ 144 px Handy auf allen 22 Handy-Modulseiten“ (Bühne Wetter/Musik ≤ 320 px; Browser, Mail, Dieser PC, Downloads gibt es am Handy nicht); „Inhalt ab y ≤ 220 px“ wird je Bereichs-Paket abgenommen, weil Toolbar-Knöpfe und „Mehr Felder“-Schalter erst dort fallen (Ausnahmen: Bühne, und Notizen/Passwörter ohne messbares Inhaltselement); Overflow 0; Bilder aller 26 Köpfe im PR; Council.
- **Stopp:** die Bereichs-Pakete warten auf die Abnahme.

## 0b-3 · Geld (M, 2–3 Chat-Tage)

- **Umfang:** Finanzen, Rechnungen, Abos, Budgets auf Tonstufen, `ListSurface`, Tabs; Finanzen und Rechnungen als Master–Detail (`manifest.layout: 'split'`); ein Einstieg je Seite (Toolbar-Knopf und „Mehr Felder“-Schalter weg, Regel 4); Dialoge „erst das Nötige“ (Buchung 3 Felder sichtbar, Rest aufklappbar); Leerzustand Motiv + ein Verb (B6); Abos: Schalter neutral, nur die Warn-Zeilen farbig (B7); Zeilen 48 px Handy / 44 px Desktop.
- **Regeln/Tests:** `exclusion.test.ts` unberührt; Modul-Importregel (`finance` → `subscriptions/public.ts`, `invoices/public.ts`; `budgets` → `finance/public.ts`); Rahmen-/Schatten-Baseline sinkt um die Treffer der vier Module (Abos 15); `GroupedList`- und `max-width`-Baselines sinken.
- **Abnahme:** Reizbudget-Ratsche grün ohne Label; MEASURES-Lauf der vier Seiten: Rahmen 0 außer Signatur-Blöcken, farbige Flächen über dem Falz ≤ 10, Inhalt ab y ≤ 220 Handy; Klickweg „Buchung eintragen“ ≤ 2 Klicks + Enter.
- **Stopp:** PR + Council; danach optional das Modul-Paket G-b Vermögen (Frage 2).

## 0b-4 · Planen (M, 2–3 Chat-Tage)

- **Umfang:** Kalender, ToDos, Gewohnheiten, Zeiterfassung, Wetter (Bühne), Karten, Personen, Planer; Kalender-Raster und Kopf-Chips auf Tonstufen (B4: 37 Rahmen), ToDos ohne Inline-Feld, Planer behält seines als letzte Zeile (Regel 4), Lesemaß für ToDos/Gewohnheiten/Zeiterfassung, Personen und Planer als Master–Detail; Leerzustände; Zeilen 48/44 px.
- **Regeln/Tests:** Kalender-Overflow-Spec, `touch-hit-phone.spec.ts`, `.lineTime` bleibt auf `--text-on-tint`; Baselines sinken um Kalender 37.
- **Abnahme:** wie 0b-3; zusätzlich Klickwege „Aufgabe eintragen“ und „Termin eintragen“ ≤ 2 Klicks + Enter, Termin-Dialog ≤ 5 sichtbare Felder.
- **Stopp:** PR + Council.

## 0b-5 · Haushalt + Tresor (M, 2–3 Chat-Tage)

- **Umfang:** Listen (Inline-Feld bleibt als letzte Zeile, Regel 4), Vorräte, Fitness, Unterlagen, Passwörter; die Signatur-Blöcke `.doc` (Unterlagen) und `.label` (Vorräte) bleiben gerahmt und werden markiert (zwei Einträge in `signature-blocks.json`, mit Label; die Ratsche zählt sie danach nicht); alles andere auf Tonstufen; Unterlagen als Master–Detail; Passwörter-Dialog mit fester Fußleiste am Handy (B10); Datenschutz-Sätze sichtbar (0a-1b-Test).
- **Regeln/Tests:** Tresor-Ausschluss (`exclusion.test.ts`), Lesehilfe-Laufzeit-e2e, `NoReadAid` unverändert; Signatur-Block-Liste der Ratsche genau um diese zwei Blöcke erweitert (mit Label).
- **Abnahme:** wie 0b-3; `/vault` und `/accounts` ohne `[data-rs]`.
- **Stopp:** PR + Council; danach optional T-a Fristen und H-b Routinen (Frage 2).

## 0b-6 · Wissen + System (M, 2–3 Chat-Tage)

- **Umfang:** Merkliste, Notizen, Chat, Browser, Mail, Musik (Bühne), Feeds, Dieser PC, Downloads; Merkliste ohne die drei leeren Kopf-Karten (Runde-6 R36), Bibliothek mit Tonstufen statt 78 Tönungen (B4), Browser-Leerzustand mit „Tab neu öffnen“ (H5); Notizen und Mail behalten ihr Zweispalten-Layout, umgestellt auf `split`.
- **Regeln/Tests:** `manifest.platforms` (Desktop-Module) unverändert; Disk-Regeln (`guard.rs`) unberührt; Baselines sinken.
- **Abnahme:** wie 0b-3; Desktop-Module per Windows-Handtest (MANUAL-TESTS).
- **Stopp:** PR + Council; danach optional S-b „Dieses Gerät“ (Frage 2).

## 0b-7 · Übersicht und Leerzustände (M, 2–3 Chat-Tage)

- **Umfang:** „Jetzt wichtig“: danger (überfällige Zahlungen, überschrittene Budgets) und heute Fälliges bleiben immer sichtbar, nur accent/warning (Budgets ≥ 90 %, Abgelaufenes in Vorräten/Unterlagen, Hinweise) falten in „n weitere“, Kappung 4 statt 6 (DESIGN-SPEC :68, Spec-Regel 3) (B9); Ruhig = Strip + eine „Heute“-Karte auf Inhaltsbreite, sonst nichts; Widgets mit Tonstufe statt getöntem Kopf (MODULE-IDENTITY :71/:76, Identitätsregel 4), Marke als Plakette, Höhe nach Inhalt, Ruhig-Karte auf Inhaltsbreite; keine Dubletten zwischen Strip, Agenda und Widgets (ein Termin erscheint einmal); Leerzustände mit Motiv + einem Verb in jedem Modul (B6); Einblend-Animationen `pageIn`/`itemIn` nur beim ersten Laden einer Sitzung und mit Reduced-Motion-Pfad (M5-Befund).
- **Regeln/Tests:** `home/AttentionStrip.test.tsx:85` („keeps today and everything overdue visible“) bleibt und bekommt den Assert „accent/warning falten ab 4“; **ändern sich hier (benannter Schritt):** `e2e/overview-head.spec.ts:147` („the widget frame is tinted and patterned“) und der 14-%-Widget-Teil von `ui/tokens.test.ts:335`; `core/modules/widgets.test.tsx` und `ui/widgets/widgets.test.tsx` (Katalog, eindeutige Titel) unverändert; Dubletten-Test auf dem Seed (Regel: der Strip zählt, Karten listen – kein Titel zweimal als Liste auf der Übersicht, kein Strip-Eintrag, dessen Liste die Heute-Karte in „Ruhig“ zeigt; geprüft für alle Strip-Einträge, nicht nur Termine).
- **Abnahme:** MEASURES „Übersicht“ (ab jetzt mit in der Reizlast-Tabelle): farbige Flächen über dem Falz ausführlich ≤ 20 (heute 28 bei 1920, 10 bei 412), ruhig ≤ 8 (heute 14 bei 1920, 9 bei 412), CLS ≤ 0,05 in beiden Geräten; Council.
- **Stopp:** PR + Council.

## 0b-8 · Abnahme-Sweep (M, 2–3 Chat-Tage)

- **Umfang:** alle 26 Module × 2 Geräte × 2 Themes mit der Audit-Tour neu gemessen (tools/, mit dem korrigierten Werkzeug: Animationen ohne Kappung, `__cls` vor jedem Dialog zurückgesetzt), MEASURES vorher/nachher, Modern-Checkliste M1–M10 neu bewertet, Klickwege neu gezählt, Council auf den Gesamtstand; offene Nits als Follow-ups.
- **Abnahme:** Checkliste ≥ 8 × erfüllt; kein „nicht“ mehr; Reizbudget-Baseline unter dem Stand von 0b-1.
- **Stopp:** Ende von 4.0; MODULE-IDENTITY „4.0“ wird von „Entwurf“ zu „gültig“.

## Befund → Paket

| Befund / Klickweg | Paket |
| --- | --- |
| B1 Navigation dreifach, Kopf über dem Falz | 0b-2 |
| B2 Kopfband wiederholt Zahlen | 0b-2 (Kopf), 0b-3…6 (Kontextzeilen) |
| B3 drei bis vier Einstiege | 0b-2 (Topbar/Schnellerfassung), 0b-3…6 (Toolbar, Inline, FAB weg) |
| B4 zwei Flächensprachen | 0b-1 (Tokens, Lints), 0b-3…6 (Seiten) |
| B5 Dichte gleich und spät | 0b-1 (`split`, `reading`), 0b-2 (Handy-Kopf), 0b-3…6 (Zeilen, Master–Detail) |
| B6 Leerzustände ohne Verb | 0b-7 (Muster), 0b-3…6 (je Modul) |
| B7 Akzent-Orange, Links ohne Unterstreichung | 0b-1 (Tokens: Link-Unterstreichung, Akzent nur Hauptaktion und Aktiv), 0b-3 (Abos-Schalter) |
| B8 Tabs vs. Segment, drei Schriften | 0b-1 (`Tabs`/`Segmented`), 0b-2 (ein h1-Stil, Mono nur für Zahlen) |
| B9 Übersicht | 0b-7 |
| B10 Dialoge zu lang, Handy ohne festen Fuß | 0b-1 (Sheet-Baustein mit fester Fußleiste, Datums-/Zeitfeld in `@/ui`), 0b-3…6 („erst das Nötige“) |
| Klickweg: Enter im Suchfeld landet bei der KI | 0b-2 (Schnellerfassung als Modus der Palette: Enter = eintragen, „?“ = fragen) |
| Klickweg: ToDo „auf heute“ am Handy über ⋯ | 0b-4 (Wischen bleibt, „Heute“ als erste Aktion im Blatt) |
| Klickweg: Darstellung am Handy (Messung fehlgeschlagen) | 0b-6 (Einstellungen-Reiter als Tabs im Kopf, dann neu messen) |
| Klickweg: Backup-/Sync-Status 3–4 Klicks | S-b „Dieses Gerät“ (Frage 2) – ohne S-b bleibt der Weg; 0b-6 setzt die Status-Kacheln der Einstellungs-Startseite auf eine Zeile |
| Lade-Robustheit H1–H5 | 0a-2 (Maßnahmen 1–3; H3-Retry = Reload in Maßnahme 1), 0b-1r (Maßnahme 4) |

## Wenn du anders antwortest

- **Frage 1 B (erst nach 0a entscheiden):** 0a und V-1 laufen wie geplant; vor 0b-1 eine Council-Runde mit Go/No-Go-Frage an dich; kein Mehraufwand, nur ein Stopp mehr.
- **Frage 1 C (3.2):** 0a und V-1 laufen; statt 0b-1…0b-8 vier Politur-Pakete auf dem v3.1-Rahmen (Klickwege, Dichte, Bewegung, Konsistenz; 8–12 Chat-Tage); B1, B2, B4 bleiben bestehen.
- **Frage 2 B (nur Sichtbarkeit):** die Modul-Pakete G-b/H-b/T-a/S-b entfallen; der Klickweg „Backup-Status“ bleibt bei 3–4 Klicks. **Frage 2 C (nur ein Bereich):** Empfehlung Geld, also nur G-b Vermögen (M, 2–3) nach 0b-3.
- **Frage 3 B (weniger Bereiche):** 0b-2 + ≈ 1 Chat-Tag (Bereichs-Umbau, Setup-Profile, `registry.test.ts:144`); **Frage 3 C (Favoriten-first):** 0b-2 + ≈ 2 Chat-Tage (neue Leerzustände für Nutzer ohne Favoriten).
- **Frage 4 B (44 px):** nur die Zeilenhöhe in 0b-3…6 (48 → 44 px), 0 Mehraufwand; **Frage 4 C (Zeilenhöhe wie heute):** die Zeilen bleiben bei 50–59 px, Kopf und Inhalt ab Bildschirm 1 bleiben (−0,5 Chat-Tag in 0b-3…6).
