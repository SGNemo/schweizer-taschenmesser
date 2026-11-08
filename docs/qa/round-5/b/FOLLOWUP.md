# Person B – Follow-ups (nicht in `feat/demo-b` gebaut)

## B09 Druckansicht (M, modulübergreifend)
Drucken einer Liste (Buchungen, Rechnungen) legt Navigation unten, „+“-Knopf, Toasts und die Kopfleiste über den Inhalt; es gibt kein `@media print` in der App. Shot: `shots/before-24-print-transactions.png`.

Prompt-Skizze: „Branch `fix/print-view` von develop. Ein Druck-Stylesheet für die Shell: in `layout/AppShell.module.css`, `layout/BottomNav`, `layout/TopBar`, `ui/Misc` (Toaster, Fab) je `@media print { display: none }`, Hauptinhalt volle Breite, keine Schatten/Hintergründe, Kartenköpfe ohne Farbe. Nur Tokens, keine neuen. E2E: `page.emulateMedia({ media: 'print' })` auf `/finance?tab=transactions` und `/invoices`, Nav/FAB nicht sichtbar, erste Zeile sichtbar. Hotspot `layout/AppShell.tsx` nur CSS. Kein Druck-Knopf (Strg+P reicht), Fokus-Checkliste: nichts Neues auf dem Bildschirm.“

## B10 Übersprungene Zeilen benennen (S)
`2 Zeilen ohne gültiges Datum oder Betrag wurden übersprungen.` sagt nicht, welche. Vorschlag: `BankParseResult.skippedRows?: { line: number; date: string; payee: string }[]` (höchstens 3) in `core/io/bank.ts`, Hinweis „übersprungen: Zeile 12 (31.02.26, Tankstelle Süd), …“. Fixture: `docs/qa/round-5/b/sparkasse-stoerung.csv`.

## Anfangssaldo mit Datum (M, Datenmodell)
B06 ist mit „Kontostand heute laut Bank“ gelöst, aber ein späterer Import noch älterer Buchungen verschiebt den Kontostand erneut. Sauber wäre `account.balanceDate` (optional, `manifest.version` + Migration): Buchungen vor diesem Datum zählen nicht in den Kontostand. Entscheidung Sven (Datenmodell).

## Für demo-a (Board-Einträge vom 2026-11-08)
B05 Bank-Kachel nach vorn, wenn das Zielmodul an ist; B08 „Kontoauszug importiert“ nur durch den Importer `bank`. Außerdem beobachtet (Handy, 412 px): die Einrichtungs-Checkliste füllt den ersten Bildschirm, die Karte „Diesen Monat“ liegt darunter (`shots/after-30-phone-home.png`) – kein Fund für B, nur Hinweis.

## Aus dem Council (offen, klein)
- Karte „Diesen Monat“ nach dem ersten Import in ein Konto mit 0 €: die Zahl „Frei bis Monatsende“ kann negativ sein, bis der Kontostand laut Bank eingetragen ist. Die Karte kann Import und Handeingabe nicht unterscheiden (Buchungen tragen kein Import-Merkmal); der Hinweis steht in der Import-Vorschau und in MESSAGE.md. Sauber: ein Merkmal am Konto „Kontostand noch nicht abgeglichen“.
- Konto-Dialog: Fehler zu leerem Namen und Währung erscheinen unter dem Feld „Anfangssaldo“ (vor dieser Runde schon so); eigene Fehlerplätze je Feld.
- Konto-Dialog: das gesperrte Feld „Anfangssaldo“ zeigt den alten Wert statt des berechneten.
- „Frei bis Monatsende“ zählt Sparkonten mit (wie der Ausblick); ggf. nur Girokonten.
