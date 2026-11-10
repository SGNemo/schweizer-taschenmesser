# Nachtrag Ästhetik (2026-11-10) – offene Punkte außerhalb von B1–B10

Gehört zu [REPORT.md](REPORT.md) und [PACKAGES.md](PACKAGES.md). **Nur Plan, nichts umgesetzt.** Quelle: ein unabhängiger Blick auf `develop` (9d73fbe) – Website gebaut (`site/`, 390 und 1440 px, hell/dunkel), App als seeded Dev-Preview (`build:e2e-seed`, Umfang `medium`, Uhr 2026-09-29 10:00; 1440×900 hell/dunkel und 412×915 dunkel; 16 Modulseiten, Leerzustand von Übersicht/ToDos/Finanzen), Icon aus `web/brand/*.svg` in 16–256 px mit Android-Masken. Nicht geprüft: Dialoge, Bewegung (Aufnahmen mit `reducedMotion`), WebView2, Android-Gerät.

Der Blick bestätigt B1–B4 und B8 als Ursache für „wirkt unfertig“ (Kalender: Inhalt ab y ≈ 550 von 900; am Handy fünf Steuerzeilen vor dem ersten Termin; bis zu drei Einstiege je Bildschirm; FAB über Zeilenknöpfen in Gewohnheiten, Werkzeuge, Einstellungen und auf dem gesperrten Tresor). Das steht im Plan und wird hier nicht wiederholt. Neu sind sechs Punkte:

| Id | Punkt | Empfehlung | Paket |
| --- | --- | --- | --- |
| AE1 | Deaktivierter Hauptknopf wird schmutzig braun | eigener Disabled-Zustand ohne Akzent und ohne `opacity` | 0b-1 |
| AE2 | Bereichsmuster hinter Text wirken im dunklen Theme wie Darstellungsfehler | Muster nie hinter Fließtext; nur Bühne, Leerzustand-Motiv, Bibliothek | 0b-1 (Token), 0b-2 (Kopf) |
| AE3 | Modul-Tönungen im Dunkeln stumpf | **keine** Umstellung auf `oklab` (gemessen, hilft nicht); Prüfpunkt nach 0b-2 | 0b-8 (Prüfpunkt) |
| AE4 | Wochenraster: Wortbruch und angeschnittene Zeilen in Terminblöcken | ganze Zeilen klemmen, Uhrzeit + Titel einzeilig, unter Mindestbreite stapeln | 0b-4 |
| AE5 | App-Icon liest sich ab 32 px als Lautsprecher-Symbol | entschieden: neue Silhouette, zweifarbige Kachel + einfarbige Marke mit innen endenden Bändern | eigenes Paket „Logo v2.1“ (`feat/logo-v2-1`), unabhängig von 0b |
| AE6 | Website: Platzhalter-Karten, unlesbarer Hero, keine Handy-Navigation | Designrunde 5 mit neuen Bildern | eigenes Paket „Website Runde 5“, **nach 0b-8** |

## AE1 · Deaktivierter Hauptknopf (0b-1)

- **Befund:** `ui/Button.module.css:20–23` setzt für jede Variante nur `opacity: 0.45`. Auf dem gefüllten Akzent (`--accent` `#ff9a57` dunkel) über `--bg`/`--surface` ergibt das ein stumpfes Braun, das wie ein Farbfehler aussieht, nicht wie „gesperrt“. Sichtbar auf `/accounts` gesperrt („Entsperren“ vor der Eingabe) und im Planer („Eintragen“ bei leerem Feld), jeweils im dunklen Theme gesehen; hell nicht einzeln geprüft.
- **Empfehlung:** Disabled als eigener Zustand: Fläche `--surface-sunken` (neuer 0b-1-Token) bzw. `--surface-2`, Text `--text-3`, kein Akzent, keine `opacity`; gleich für `primary`, `secondary`, `danger`. Der Knopf bleibt lesbar (Text ≥ 3:1), auch wenn WCAG deaktivierte Elemente ausnimmt.
- **Regeln/Tests:** `ui/Button.test.tsx` um den Zustand; Quelltext-Test „kein `opacity` auf `:disabled` in `ui/*.module.css`“ (heute zusätzlich `Fields.module.css:98, :128` – mitziehen oder ausnehmen, im PR benennen).
- **Abnahme:** Bild „Tresor gesperrt“ und „Planer leer“ hell/dunkel im PR; Reizbudget: eine farbige Fläche weniger je betroffener Seite.

## AE2 · Bereichsmuster hinter Text (0b-1, 0b-2)

- **Befund:** `--pattern-head: 0.06` und `--pattern-widget: 0.04` gelten in beiden Themes mit `--pattern-ink: var(--text)` (`ui/tokens.css:165–169`; gezeichnet in `ui/HeadSurface.module.css:44`, `home/Home.module.css:170`, `pages/library/Library.module.css:36`). Helle Linien auf dunkler Tönung fallen stärker auf als dunkle auf heller: im dunklen Theme liegen Zeilen-, Raster- und Schraffurmuster sichtbar hinter Titel und Fließtext (ToDos- und Planer-Kopf, „Heute“-Karte der Übersicht, Bereichs-Abschnitte der Bibliothek) und lesen sich wie Scanlines. 0b-7 nimmt das Muster schon aus dem Widget-Rahmen (`e2e/overview-head.spec.ts:147`); für den Kopf ist es nicht entschieden.
- **Empfehlung (A):** Muster nie hinter Fließtext. Mit der Titelzeile aus Regel 2 entfällt es im Standard-Kopf; es bleibt auf der Bühne (Wetter, Musik), im Leerzustand-Motiv und im Karten-Kopf der Bibliothek. Wo es bleibt, bekommt das dunkle Theme einen eigenen Wert (Vorschlag `0.03`).
- **Alternative (B):** überall behalten, im dunklen Theme halbieren. Kleiner, lässt aber Text auf Muster stehen.
- **Regeln/Tests, die sich ändern:** `docs/design/MODULE-IDENTITY.md:31, :71, :76` (Muster im Kopf 6 %, Widget 4 %); `ui/tokens.test.ts` um den Theme-Wert; `ruhig`/„Modulfarben: Aus“ bleiben bei 0 (`tokens.css:454–455, :474–475`).
- **Abnahme:** Köpfe und Übersicht dunkel als Vorher/Nachher im PR von 0b-2.

## AE3 · Modul-Tönungen im Dunkeln – geprüft, Farbraum ist nicht die Ursache (Prüfpunkt 0b-8)

- **Befund:** Im dunklen Theme wirken getönte Köpfe stumpf (Oliv bei ToDos, Mauve bei Planer und Gewohnheiten). Vermutung im Chat war die Mischung in sRGB (190 × `color-mix(in srgb …)` in 67 CSS-Dateien, keine in `oklab`/`oklch`).
- **Messung:** Kopf-Startton = 40 % Hue über `--surface` (`--head-tint-0`, `tokens.css:160, :601`). In sRGB gemischt: OKLab-Helligkeit 0,45–0,49, Chroma 0,053–0,062 (lime, moss, teal, indigo, orchid). Dieselbe Mischung `in oklab`: Helligkeit 0,44–0,47, Chroma 0,044–0,052 – also dunkler und **weniger** farbig. Die Umstellung verschlechtert das Bild und würde 190 Stellen und die gepinnten Kontrastwerte in `ui/tokens.test.ts` anfassen.
- **Empfehlung:** nichts umstellen. Ursache ist die Quelle (Pastell-Hue × dunkles Grau), nicht der Farbraum. Regel 2 nimmt das Band aus dem Standard-Kopf; danach bleiben Plakette, Kapsel (16 %), Bühne und Bibliothek. 0b-8 sieht diese Stellen im dunklen Theme noch einmal an. Nur wenn sie dann noch stumpf wirken: Frage an Sven mit Musterbild, ob das dunkle Theme je Hue eine eigene, kräftigere Tönungsbasis bekommt (neue Tokens, Label-Schritt).

## AE4 · Wochenraster des Kalenders (0b-4)

- **Befund:** `/calendar?view=week&date=2026-09-29` bei 1440×900 mit offener Agenda: Tagesspalte ≈ 98 px. Gleichzeitige Termine teilen die Spalte auf ≈ 45 px – Titel brechen mitten im Wort („Medika / nehme“, „Geburt / Kollege“). In einstündigen Blöcken belegt die Uhrzeit eine eigene Zeile, die dritte Zeile wird an der Unterkante angeschnitten („Oberkörper“, „nehmen“, „ablesen“). Datei: `modules/calendar/components/TimeGrid.tsx`. Möglicher Rest von S04 (`fix/ui6-calendar-views`, #594, `qa/round-6/STATUS.md:10`) – zuerst dagegen prüfen.
- **Empfehlung:** (1) Text nach Blockhöhe auf ganze Zeilen klemmen, Ellipse statt Anschnitt, voller Titel im `title`; (2) bei Blöcken ≤ 1 h Uhrzeit und Titel in einer Zeile – die Uhrzeit steht schon an der Rasterachse; (3) unter einer Mindestbreite (≈ 4,5 rem) überlappende Termine als Stapel mit „+n“ statt weiterer Spaltenteilung.
- **Regeln/Tests:** `e2e/screenshots/clipped-text.spec.ts` um die Wochenansicht bei 1440 mit Agenda; Kalender-Overflow-Spec bleibt grün.
- **Abnahme:** kein Wortbruch und keine angeschnittene Zeile im Seed bei 1440 und 1920; Bild im PR.

## AE5 · App-Icon (eigenes Paket „Logo v2.1“, unabhängig von 0b)

- **Befund:** `web/brand/app-icon.svg`: Bänder und Auge sind Ausschnitte in Kachelfarbe (`mask#nemo-app-cut`). Dadurch zerfällt der Fisch in drei Teile – Dreieck (Schwanz + Hinterkörper), senkrechter Balken, D-Form – und das ist ab 32 px abwärts das Lautsprecher-Symbol; bei 16 px sind Auge und Bänder weg. Die Marke nimmt 60 % der Kachelbreite ein (`scale(0.8)` auf 383 von 512). Fläche einfarbig `#b5430c`, ohne Tiefe; weißer Fisch mit farbigen Bändern ist die Umkehrung des Clownfisch-Signals.
- **Rahmen aus `decisions/ui-brand.md` „Logo v2“:** die In-App-Marke bleibt einfarbig im Akzent-Token (`brand-sync.test.ts`); verworfen wurden dort schon „head-only“, geometrische Bänder und Linien-Fisch. Der Ozean-Verlauf `--ocean-from/to` ist als Marken-Fläche erlaubt („Design Klar“).
- **Empfehlung:** Silhouette ändern (eingeschnürter Schwanzstiel, runde Fächerflosse statt Dreieck, damit das Stück hinter dem Band kein Kegel mehr ist) **und** für die statische Kachel die Farben drehen (Fisch im Akzent, Bänder weiß gefüllt statt ausgeschnitten, Kachel im Ozean-Verlauf). Die einfarbige In-App-Marke und das Android-Themed-Icon nehmen dieselbe Silhouette mit Ausschnitten.
- **Entscheidung (Sven, 2026-11-10):** neue Silhouette. **App-Icon** = zweifarbige Kachel (Fisch im Akzent, zwei weiß gefüllte Bänder, Ozean-Verlauf); **einfarbige Marke** (Seitenleiste, Pille, Android-Themed-Icon, Benachrichtigung) = dieselbe Silhouette, die zwei Bänder enden vor dem Umriss, damit der Fisch ein Stück bleibt. Verworfen in der Probe: alte Form mit gedrehten Farben, „nur der Kopf“ (einfarbig wird daraus ein Play-Symbol), zwei durchgeschnittene Bänder (zerfällt in drei Teile), ein Band. Umsetzung: Branch `feat/logo-v2-1` (eigener PR): `design/logo-v2` parametrisch, `node export.mjs`, `npx tauri icon`, `npm run gen:icons`; Handtests LG1–LG6.
- **Regeln/Tests:** Entscheidungs-Bullet in `decisions/ui-brand.md` (zweite Kachelfarbe für statische Dateien); `brand-sync.test.ts` und Android-Hintergrund `#b5430c` (`icons/android/values/ic_launcher_background.xml`) folgen der Entscheidung.

## AE6 · Website (eigenes Paket „Website Runde 5“, nach 0b-8)

Erst nach 4.0, weil Hero-, Planer- und README-Bilder die App zeigen und die Modulkarten Kopf- und Widget-Varianten zeichnen, die 4.0 ändert (neun Köpfe → Standard und Bühne).

| Id | Befund | Beleg |
| --- | --- | --- |
| W1 | Modulkatalog: 27 Karten mit gezeichneten Platzhalterbalken lesen sich wie Ladezustände; 21 tragen „optional“ oder „Vorschau“ (6 Standard, 13 optional, 8 Vorschau) | `Features.astro:71` (`IdentityMini kind="widget"`), `catalog/modules.json` |
| W2 | Hero: App-Bild bei 1440 px ≈ 440 px breit (`sizes` 44vw), Text darin unlesbar; am Handy das Desktop-Bild auf ≈ 320 px | `Hero.astro:57–58` |
| W3 | Kopfformen-Leiste: interne Begriffe („Kennzahl“, „Regal“, „Papier“), drei Kacheln niedriger und versetzt; mit 4.0 inhaltlich überholt | `Hero.astro:66` |
| W4 | Unter 64 rem keine Navigation und kein GitHub-Link (kein Menü); Seite am Handy ≈ 11 400 px lang, am Desktop ≈ 8 400 | `Header.astro:151–156` |
| W5 | Keine Tiefe, keine Bewegung: `site/README.md:29` erlaubt nur Farbwechsel bei Hover | `site/README.md` |
| W6 | Kleines: Logo zweimal untereinander (`Hero.astro:33`); eingeklapptes `<details>` „Prüfsummen“ steht allein unter der Leiste (`Hero.astro:75`); zwei linke Kanten (`.wrap` und `.wrap.narrow`, `global.css:219`); Sync-Diagramm mit Titeln auf drei Höhen (`Data.astro`); H1 und erste H2 sagen beide „an einem Ort“ | – |

**Empfehlung:** Designrunde 5 in `docs/design/site/` mit zwei Richtungen zur Wahl; Kern: wenige große, echte Bilder statt 27 Skizzen (Katalog als kompakte Liste darunter), Hero mit einem großen, angeschnittenen Bild (am Handy das Handy-Bild), Navigation unter 64 rem ohne JavaScript (`<details>` oder Anker-Leiste), eine linke Kante. Regelfrage an Sven: darf die Website eine Bewegung beim Einblenden bekommen (nur `transform`/`opacity`, aus unter `prefers-reduced-motion`) – heute verbietet es `site/README.md:29`.

**Prompt für den Chat (nach 0b-8 starten):**

```
Routing: Claude Code · Website Runde 5 (Auftritt nach Identity 4.0) · <Modell>

Ziel: Die Website (site/) wirkt fertig und zeigt die App nach Identity 4.0. Phase 1 = Designrunde,
dann Stopp, bis ich „Plan freigegeben“ schreibe. Phase 2 = Umsetzung in Paketen.

Lies zuerst: site/README.md, docs/design/site/README.md und
docs/design/ui-audit-2026-11/AESTHETICS-ADDENDUM.md (AE6, Befunde W1–W6 mit Belegen).

Phase 1 (nur docs/design/site/, kein Code in site/src):
- Befunde W1–W6 auf dem aktuellen develop nachmessen (npm run build, npm run screenshots; 360/390,
  768, 1280, 1440; hell/dunkel) und korrigieren, was nicht mehr stimmt.
- ROUND-5.md + zwei Mockups (round-5-a.html, round-5-b.html) zur Wahl. Beide lösen:
  W1 wenige große echte App-Bilder je Bereich statt 27 Skizzenkarten, Katalog als kompakte Liste;
  W2 Hero mit einem großen, angeschnittenen Bild, am Handy das Handy-Bild;
  W3 Kopfformen-Leiste ersetzen oder streichen (4.0 kennt nur Standard und Bühne);
  W4 Navigation unter 64 rem ohne JavaScript, Seitenlänge am Handy höchstens halb so lang wie heute;
  W6 eine linke Kante, Logo einmal, Prüfsummen an den Download, Sync-Diagramm auf einer Grundlinie.
- Die Mockups unterscheiden sich in der Tiefe: A bleibt flach, B nutzt den Ozean-Verlauf
  (--ocean-from/to) als Marken-Fläche im Hero und eine einzige Einblend-Bewegung.

Fragen an mich (gebündelt, je mit Empfehlung): Richtung A oder B; darf die Website eine Bewegung
bekommen (transform/opacity, aus unter prefers-reduced-motion; ändert site/README.md „no animation“);
bleiben Vorschau-Module auf der Seite sichtbar.

Phase 2 (nach Freigabe, je ein PR): (1) neue Bilder aus der seeded App (npm run app:screenshots,
auch --readme) und Social-Preview, (2) Hero + Kopfzeile + Navigation, (3) Funktionen/Katalog,
(4) Rest (Daten, Vergleich, Fuß) und Messung.

Nicht anfassen: CSP und public/_headers (kein Inline-Style, kein externes Skript), Token-Abgleich
(scripts/tokens.test.mjs), Katalog aus gen:modules, Download-Logik (fetch-release), Rechtstexte.

Fertig heißt: npm run check, check:links, lighthouse (hell und dunkel) grün; Screenshots vorher/nachher
bei 390 und 1440 im PR-Text; W1–W6 je mit „behoben“ oder Begründung.

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions ·
Closing: #closing · PR: #pr-text · Phasen: #phases
```
