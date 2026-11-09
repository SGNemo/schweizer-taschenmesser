# UI schärfen, Runde 6 – Stand je Fund (Phase 5)

Stand 2026-11-09. Quelle: [PLAN.md](PLAN.md) (Pakete), Fund-IDs aus [FINDINGS.md](FINDINGS.md) und den `U-*.md`. Jeder Fix-PR trägt seine IDs im Text, einen Vorher/Nachher-Beleg (Bilder auf `shots/ui6-*`-Branches, nie in `docs/`) und eine Prüfung, die auf `develop` vorher rot war. Nachmessung: eigene Tour auf `develop` nach den Merges (`tools/round6*.spec.ts`, 1920×1080 und 412×915 dunkel, mit und ohne Testdaten), Ergebnis unten.

## Gefixt (nach Paket)

| Paket / PR | Funde | Review |
| --- | --- | --- |
| `fix/ui6-ui` [#590](https://github.com/SGNemo/schweizer-taschenmesser/pull/590) | S02 Dialog-Identität · U07 `FileField` (6 von 11 Stellen) · U20 · U23b · U28 · U34 · U40 · U43 · U57 | Council 2 Runden (Architect 8, Guardian 9, Advocate 9) |
| `fix/ui6-calendar-views` [#594](https://github.com/SGNemo/schweizer-taschenmesser/pull/594) | S03 Monat als Zeilen · S04 Ganztags-Bereich begrenzt, Raster ohne angeschnittenen Block · U25 Handy-Toolbar 3 Zeilen | review-loop 3 Runden |
| `fix/ui6-calendar-small` [#595](https://github.com/SGNemo/schweizer-taschenmesser/pull/595) | U05 · U08 Rot nur überfällig · U15 · U16 · U17 · U27a · U35 · U58 | review-loop 2 Runden |
| `fix/ui6-layout` [#598](https://github.com/SGNemo/schweizer-taschenmesser/pull/598) | U01 kein Sprung beim Laden (CLS 0,23–0,36 → ≤ 0,025 auf vier von fünf Seiten) · U06 · U24 · U59 | review-loop 3 Runden |
| `fix/ui6-modules-plan` [#591](https://github.com/SGNemo/schweizer-taschenmesser/pull/591) | U02 · U21 · U48 · U26 · U09 · U10 · U30 · U47 (+ U57 ToDo-Zeile) | review-loop 1 Runde |
| `fix/ui6-modules-household-money` [#592](https://github.com/SGNemo/schweizer-taschenmesser/pull/592) | S01 Vorräte-Stepper · U12 · U13 · U42 · U18 · U56 · U44 · U14 | review-loop 2 Runden |
| `fix/ui6-modules-knowledge-system` [#596](https://github.com/SGNemo/schweizer-taschenmesser/pull/596) (offen) | U22 · U04 · U37 · U23a · U50 · U33 · U51 · U52 · U38 (geprüft, kein Code) · U11 · U29 · U27b · U53 | review-loop 2 Runden |
| `fix/ui6-home-settings` [#599](https://github.com/SGNemo/schweizer-taschenmesser/pull/599) (offen) | U19 · U39 · U49 · U03 · U31 · U54 · U55 · U32 | review-loop 2 Runden |

## Nachmessung auf `develop`

Wird nach dem letzten Merge ergänzt (Tour-Zahlen: Primärknöpfe je Ansicht, Rot, abgeschnittene Texte, Wortumbrüche, CLS).

## Offen aus den PRs (Follow-ups, je ein kleiner PR)

- **`ui/`:** `Patterns.module.css` `.done .title` erreicht verschachtelte Zeilen (Ursache U02; ToDos überschreiben lokal) → `.done > .row .title`; `FolderTabs` versteckt Zähler 0 (U53) und braucht eine `nowrap`-Option (U22); `data-empty` am `WidgetBody` statt Klassen-Import (U39); Fade am Zeilen-Ende nur bei Überlauf (S7 der Kalender-Review).
- **U07 Rest** (`tools/image`, `tools/pdf`, RecoveryScreen): `fix/ui6-filefield-rest`.
- **Übersicht, leere Installation:** CLS 0,18 je Laden (develop 0,03), weil das dichte Raster neu packt, wenn eine Karte einen Frame später kommt; Testdaten-Übersicht unverändert (0,18 vs 0,19). Entscheidung Sven: hinnehmen oder Raster erst packen, wenn alle Karten da sind.
- **Modulseiten mit Restsprung:** `/todos` erster Besuch 0,05–0,07 (Heute-Karte kommt nach den Tasks; `modules/todos`), `/disk` 0,13 (`DiskHead` wechselt Signatur-Höhe), `/` 0,14 (`home/`).
- **Einrichtung:** Fußzeile ohne `--kb-inset` (Handy-Tastatur); `e2e/setup.spec.ts` hat `localhost:4173` fest verdrahtet.
- **Kalender:** „Ablauf · Überfällig“ (per-Art-Wort fehlt), Art „gift“ unübersetzt, Handy-Raster-Oberkante 569 statt ≤ 480 px (braucht Kopfband/Reiter, siehe U41).
- **Texte:** eingefrorene es/fr/pt-BR behalten alte Kontextzeilen (Feeds-Widget, Zeiterfassung, Benachrichtigungs-Status); ungenutzte Schlüssel (`budgets.ext.head.chip`, `maps.placesBar.navigateTo`, `tMusicPage.libraryTitle`) für die nächste String-Bereinigung.
- **Handy-FAB** überdeckt Zeilen-⋯ und Karten-Knöpfe (Abos, Gewohnheiten) – Board-Notiz für `layout/`.

## Später (unverändert aus PLAN.md)

U41 Kopfbandhöhen (`fix/ui6-head-heights`, Mockup + Stopp) · S05/S08/S09/T03 Planer (Board-Notiz, nach dem Planer-Paket) · S06/S07 Konzepte ([CONCEPTS-S06-S07.md](CONCEPTS-S06-S07.md)) · T01/T02/T05 Tabu-Bereiche (Board).
