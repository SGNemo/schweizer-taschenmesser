# PACKAGES – Identity 4.0 als Stopp-Pakete

Gehört zu [REPORT.md](REPORT.md) (Entscheidung, Befunde, Fragen) und [PACKAGE-0.md](PACKAGE-0.md) (0a im Detail). Stand: Sven neigt zu 4.0 (2026-11-09, „eher 4“); die Fragen 2–4 sind offen, ihre Empfehlungen stehen hier als Vorgabe und werden nach seiner Antwort angepasst. Mockups der Zielform: [mockups/](mockups/) (HTML; gerenderte Bilder auf dem Branch `shots/ui-audit-2026-11`). Einheiten: S ≈ 0,5–1, M ≈ 2–3, L ≈ 4–5 Chat-Tage; jedes Paket = eigener Branch + PR + Council + Stopp.

## Was 4.0 ändert – die fünf Regeln

(1) Flächen-/Tiefenmodell: Tonstufen statt Schatten (`--surface-raised`/`-sunken`, `--shadow-1` nur für Schwebendes), Karten ohne Rahmen, Zeilen als Flächen, höchstens zwei Ebenen; Lint. (2) Kopf-Logik: eine Titelzeile (Eyebrow, h1 28/600, eine Kennzahl, eine Aktion, Tabs an der Unterkante), sticky, mit Tabs ≤ 7.5 rem Desktop / ≤ 7 rem (≈ 110 px) Handy; die neun Varianten werden zu „Standard“ und „Bühne“ (Wetter, Musik), die Kopf-Signatur-Slots (`SIGNATURE_SLOTS`, `core/modules/types.ts`) ziehen in Widget-Marke, Leerzustand und Bibliothek um; die Marke selbst (`identity.signature`) und die Palette bleiben. (3) Navigation in einer Ebene: Bereiche bleiben die Ordnung der Seitenleiste; Sub-Navigation entfällt am Desktop, am Handy wird sie die eine Modul-Zeile unter dem Kopf (die Bottom-Bar bleibt). (4) Ein Eintragen-Einstieg je Bildschirm (Schnellerfassung ist der Weg; Modulknopf im Kopf; „Satz eintragen“ als Modus). (5) Dichte je Gerät: Master–Detail als Standard für Listenmodule, Lesemaß über `manifest.layout`/`PageContainer` (kein Modul-`max-width`), Handy-Inhalt ab Bildschirm 1.

**Was 4.0 aufhebt (mit Regel und Zeile):** **Was 4.0 aufhebt (mit Regel und Zeile):** die neun Kopf-Silhouetten als Manifest-Identität (`identity.head`, MODULE-IDENTITY „Head variants“ :33–45) werden zu „Standard“ und „Bühne“ – die Marke (`identity.signature`) trägt die Erkennbarkeit; die Sub-Navigation als eigene Rahmen-Zone (:17) entfällt am Desktop; das vollbreite Band mit 70-rem-Spalte (:21) wird zur Titelzeile in Seitenbreite; „Hairline all around“ bleibt ein erlaubter Identitätsträger (:27) – der Rahmen-Lint aus B4 trifft Karten und Zeilen, **nicht** die bewusst gerahmten Signaturen (Unterlagen „like a file in a folder“ `VaultPage.module.css:1`, Vorräte „a label“ `PantryPage.module.css:21`), die als Signatur-Blöcke markiert werden; die Wiederholung von Inhalt auf der eigenen Seite (:138) bleibt erlaubt, die Zahl im Kopf wird nur nicht mehr darunter wiederholt.

**Was bleibt, wörtlich und mit Test:** Palette v3, Marken (`identity.signature`), Widget-Katalog, gerahmte Signatur-Blöcke, Lesehilfe, Tresor-Ausschluss, KI-Datenschutz, Reizbudget, Touch ≥ 44 px, ruhiger Modus, Werte verbergen, Overflow, axe, Diagnose-Negativliste – die Liste mit dem Test je Zusage steht in PACKAGE-0 „Zusagen“.

## Reihenfolge und Go/No-Go

0a (≈ 5 Chat-Tage, PACKAGE-0) → **Go-Punkt:** 0a inklusive `e2e-seed` grün, Handtest (Maßnahme 0) erledigt, Council-Abnahme → 0b-1 … 0b-8 mit Stopp nach jedem. No-Go = 0b wartet; ein Rückfall auf 3.2 nur durch Svens Entscheidung. Jeder 0b-PR: Label `full-ci` nicht nötig (die Wächter laufen über den `seed`-Output), Council vor der Übergabe, Reizbudget-Ratsche grün oder von Sven per Label freigegeben (genau einmal, in 0b-1, mit neuer Baseline).

## 0b-1 · Fundament (L, 4–5 Chat-Tage)

- **Tokens:** `--surface-raised`, `--surface-sunken` (neutrale Tonstufen, beide Themes, AA gegen `--text`/`--text-muted`/`--text-3`, Test `ui/tokens.test.ts:112` erweitert), `--shadow-1` nur noch für Schwebendes (Menü, Dialog, Toast), `--border` nur für Trennlinien in Listen und Formularen; `ruhig`/`aus` behalten ihre Flachstellung (`tokens.css:430`).
- **Bausteine:** `Card` ohne Schatten (Tonstufe), `ListSurface` (Zeilen als Flächen, Hairline nur zwischen Zeilen), `Tabs` als die eine Ansichten-Navigation (`Segmented` nur noch für Filter), `PageContainer` mit `manifest.layout`-Variante `reading` (56–64 rem) und `split` (Master–Detail); `HeadSurface` wird zur Titelzeile (siehe 0b-2, hier nur die Tokens).
- **Lint/Wächter:** Rahmen-Lint (Karten und Zeilen ohne `border` außer Signatur-Blöcken), Schatten-Lint (nur Schwebendes), die Ratsche bekommt die neue Baseline (einmalig, mit Label).
- **Lade-Maßnahme 4** (PACKAGE-0 „0a-2“, Punkt 4): `browser_open`/`browser_show` als `async`, Inventur der synchronen Commands.
- **Stopp-Kriterium:** alle Zusagen grün, kein Modul angefasst, Übersicht und zwei Modulseiten (Finanzen, ToDos) als Vorher/Nachher-Bilder im PR; Council-Abnahme.

## 0b-2 · Kopf + Navigation (L, 4–5 Chat-Tage)

- **Kopf:** eine Titelzeile in Seitenbreite – Eyebrow (Bereich · Modul), h1 28/600, eine Kennzahl mit Kontextzeile, eine Aktion, Tabs an der Unterkante; sticky; Höhe mit Tabs ≤ 7,5 rem Desktop / ≤ 7 rem (≈ 110 px) Handy. Varianten nur noch „Standard“ und „Bühne“ (Wetter, Musik). Die Kopf-Signatur-Slots ziehen in Widget-Marke, Leerzustand und Bibliothek um.
- **Navigation:** Sub-Navigation entfällt am Desktop (Seitenleiste = Favoriten + Bereiche, Ansichten als Tabs im Kopf); am Handy wird sie die eine Modul-Zeile unter dem Kopf, die Bottom-Bar bleibt (Frage 3, Empfehlung a). Topbar: „Neu“ wird neutral (DESIGN-SPEC :24), die Schnellerfassung bleibt der eine Eintragen-Einstieg.
- **Tests, die sich hier ändern (als eigener, benannter Schritt):** `core/modules/registry.test.ts:80–82, :104, :110–124, :133, :139–141, :159`, `scripts/lib/checkIdentity.ts:59–65` und der Kopf-Anteil von `:81–100`, `layout/moduleShell.test.tsx:19–28, :30–42, :44–60` (Ersatz für `:62–68`: „genau ein `PageTitle`-h1 im Kopf-Slot“ + Quelltext-Test gegen eigene `<h1>`), `modules/music/__tests__/music.test.tsx:315`, `scripts/lib/checkModules.test.ts:20, :78–79`, `scripts/lib/moduleCatalog.test.ts:34`. MODULE-IDENTITY.md bekommt den Abschnitt „4.0 – Entwurf“.
- **Stopp-Kriterium:** Handy: Inhalt ab Bildschirm 1 auf allen Modulseiten (Seed-e2e „Inhalt ab y ≤ 360“), Desktop: Kopf ≤ 7,5 rem; Overflow 0; Council-Abnahme mit Bildern aller 26 Köpfe.

## 0b-3 bis 0b-6 · Bereiche (je M, 2–3 Chat-Tage)

Reihenfolge: **Geld** (Finanzen, Rechnungen, Abos, Budgets) → **Haushalt** (Listen, Vorräte) → **Tresor + Wissen** (Unterlagen, Passwörter, Merkliste, Notizen, Chat, Browser, Mail, Musik) → **System + Planen** (Dieser PC, Downloads, Kalender, ToDos, Gewohnheiten, Zeiterfassung, Wetter, Karten, Personen). Je Bereich: Seiten auf die neuen Bausteine (Tonstufen, `ListSurface`, Tabs), Master–Detail als Standard für Listenmodule, Lesemaß über `manifest.layout`, die 3.2-Politur als Inhalt (Einstiege zusammenlegen, Dialoge „erst das Nötige“, Leerzustand mit Motiv + Verb), Handy-Zeilen 48 px (Frage 4, Empfehlung a). Die Modul-Kandidaten aus Frage 2 (G-b Vermögen, H-b Routinen, T-a Fristen, S-b „Dieses Gerät“) sind **eigene** Pakete nach dem jeweiligen Bereichs-Paket, nicht Teil davon (REPORT „Fragen“, 2).

## 0b-7 · Übersicht und Leerzustände (M, 2–3 Chat-Tage)

„Jetzt wichtig“ nur danger + heute fällig, max. 4 + „n weitere“ (Test „überfällige/danger-Einträge fallen nie weg“); Widgets mit Tonstufe statt getöntem Kopf, Marke als Plate; keine Dubletten zu Agenda; Leerzustände mit Motiv + einem Verb in jedem Modul (B6); Einblend-Animationen je Zeile nur noch beim ersten Laden und mit Reduced-Motion-Pfad (M5-Befund).

## 0b-8 · Abnahme-Sweep (M, 2–3 Chat-Tage)

Alle 26 Module × 2 Geräte × 2 Themes mit der Audit-Tour neu gemessen (tools/), MEASURES vorher/nachher, Modern-Checkliste neu bewertet, Council auf den Gesamtstand; offene Nits in Follow-ups.

## Nach Svens Antworten auf 2–4

- **Frage 2 (Bereiche):** Sichtbarkeit (S–M, PACKAGE-0 „H-a“) direkt nach 0a; die Modul-Pakete G-b/H-b/T-a/S-b nach dem jeweiligen Bereichs-Paket; zweite Welle (G-c, H-c, T-c, S-c/S-d) danach.
- **Frage 3 (Navigation):** Option a ist in 0b-2 enthalten; b (+ ≈ 1 Chat-Tag) oder c (+ ≈ 2) ändern 0b-2.
- **Frage 4 (Handy-Dichte):** Option a ist in 0b-2 und den Bereichs-Paketen enthalten; b ändert nur die Zeilenhöhe (48 → 44 px).
