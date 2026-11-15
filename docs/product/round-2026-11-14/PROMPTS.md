# Runde 2026-11-14 – parallele Chats (alle Opus)

Stand `develop` @ 68eb5ba (nach Identity 4.0 / 0b-8). Offene PRs beim Zuschnitt: #849 + #838 (Übersicht baut sich auf, `home/**`), #828 (Perf Finanzen/Mail, wartet auf Sven), #542 (geparkt). Jeder Chat: eigener Branch von frischem `develop`, PR gegen `develop`, nie mergen. **Routing: Claude Code** für alle (Abo, nicht das Agenten-Budget).

**Ratsche:** Svens Proxy-Freigabe für Ratschen-Treffer gilt bis **2026-11-22** (`decisions/meta-ci-docs.md`) – Chats mit erwartetem Treffer (P5, P8) zuerst starten.

## Übersicht

| # | Chat | Branch | Prompt | Besitzt (andere nur lesen) | Start |
|---|---|---|---|---|---|
| P1 | Wochenende retten, Paket 1 | `fix/plan-weekend-quick` | [PACKAGES.md → Paket 1](../../design/usecases/wochenende/PACKAGES.md#prompt--package-1-quick-fixes-fixplan-weekend-quick) | `modules/planner/**`, `quickCapture/parser/**`, `quickCapture/ui/CaptureForm.tsx` | jetzt (Pakete 2–8 je nach Merge des vorigen) |
| P2 | Uhr: 12 Orte überall | `fix/clock-followups` | [product/clock/01-followups.md](../clock/01-followups.md) | `modules/clock/**`, `quickCapture/targets/**`, `core/ai/write/prepare.ts` | jetzt (02–04 danach, je mit Stopp) |
| P3 | Rahmen- und Einstellungs-Reste | `fix/shell-settings-rests` | unten | `layout/AppShell.*`, `pages/settings/SettingsLayout.*` + Titelzeile | jetzt |
| P4 | Geld am Handy | `fix/money-phone` | unten | `modules/{finance,invoices}/**` (ohne `finance/importer.ts`) | jetzt |
| P5 | Dialoge, Zeilen, Wortlaut | `fix/dialogs-rows-wording` | unten | `modules/{weather,vault,fitness,pantry,bookmarks}/**` | jetzt |
| P6 | Leerzustände und Listen | `fix/empty-states-4` | unten | `modules/{lists,people,budgets,habits}/**` | jetzt |
| P7 | Runde-6-Reste | `fix/ui6-followups` | unten | `ui/Patterns.module.css`, `ui/FolderTabs*`, `layout/setup/**` (Fußzeile), `modules/calendar/**` (CSS/Texte), `tools/{image,pdf}/**` | jetzt |
| P8 | Erstkontakt-Reste (Freunde A–D) | `fix/round5-rests` | unten | `core/setup/**` (A11), `modules/finance/importer.ts` (B10), LAN-Sync-Texte, `core/seed/dev.ts`, `modules/notes/import*`, i18n-Remount | jetzt |
| P9 | Kaltstart-Reste | `perf/cold-start-rests` | unten | `ui/index.ts`, `core/importer/host.tsx`, `ShareQr.tsx` | jetzt |
| P10 | Planer-Konzepte (nur Doku) | `docs/plan-concepts` | unten | `docs/design/plan/**` | jetzt |
| P11 | Screenshots 4.0 | `docs/screenshots-4-0` | unten | `docs/assets/screenshots/**`, `README*.md`, Social Preview | **zuletzt**, wenn P3–P7 gemergt sind (sonst zeigen die Bilder den alten Stand) |

Merge-Reihenfolge: P9 → P7 → P3 → P4 → P5 → P6 → P8 → P1/P2 (eigene Reihen) → P10 → P11. `strings.ts` und der en-Katalog: jeder nur im eigenen Block. Nicht in dieser Runde: Typografie-Skala M3 (`tokens.css`, ändert jedes Bild – eigene Runde nach P11), Sicherheit S5 (wartet auf Sven), Uhr 02–04, Website-Bilder `design/site/SLOTS.md` (nach P11, teilt `site/scripts/app-screenshots.mjs`).

Kopf jedes Prompts (nicht wiederholt): `Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text`. Keine Fragen außer wo genannt; was die nächste Handlung nicht ändert, entscheidet der Chat und nennt es im PR. Quelle der Befunde: [REPORT.md](../../design/ui-audit-2026-11/REPORT.md) „Abnahme 0b-8 → Folgepunkte n“ und „Abschlussmessung 2 → Neue Folgepunkte (x)“.

---

## P3 – Rahmen- und Einstellungs-Reste (`fix/shell-settings-rests`)

```
Routing: Claude Code · Rahmen- und Einstellungs-Reste · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/shell-settings-rests`. Hotspots `layout/AppShell.tsx` und `pages/Settings.tsx`: nur kleine, lokale Änderungen, Zeile im ersten Satz des Draft-PRs.

## Pflichtliste
- 0b-R (STATUS „App-Rahmen“): rechte Flucht bei sichtbarer Bildlaufleiste (Windows) – `scrollbar-gutter: stable` o. ä. an `.main` in `layout/AppShell.module.css`, messen bei 1280 px mit und ohne Leiste; `data-hue` am `<aside>` in `AppShell.tsx` (~Z. 162) entfernen, wenn wirklich ungenutzt (grep CSS/Tests).
- 0b-E (STATUS „Zusatzpaket 0b-E“): Unit-Test für die Ladelogik der Reiter (`TabBody` in `pages/settings/SettingsLayout.tsx`); Suchfeld der Einstellungen am Handy als Symbol in der Titelzeile (wie die Topbar-Suche, ≥ 44 px, Fokus springt ins Feld); Trefferstreifen für Links im Fließtext (≥ 44 px Trefferfläche ohne sichtbare Größenänderung, Regel in `docs/howto/design-rules.md` „The short list“ prüfen).

## Nicht in diesem Paket
`home/**` (#849), Seitenleiste/Rail-Logik, neue Tokens.

## Abnahme
`npm run check`, `test`, `check:i18n`, E2E `shell`, `settings*`, `a11y` grün (Desktop + pixel-7); Stimulus-Budget ohne neue Warnung; vorher/nachher-Bilder (1280 px mit Bildlaufleiste, Handy-Einstellungen) im PR-Text; `.changes/` DE/EN.

## Skills
`review-loop`, dazu `design:accessibility-review` für Suchsymbol und Trefferstreifen; Abschluss `full stop`.
```

## P4 – Geld am Handy (`fix/money-phone`)

```
Routing: Claude Code · Geld am Handy · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/money-phone`. Keine Hotspots. `modules/finance/importer.ts` gehört P8 – nicht anfassen.

## Pflichtliste (REPORT, Abnahme 0b-8 → Folgepunkte)
- 4: Rechnungsnamen am Handy nicht auf ~10 Zeichen kürzen; zwei Zeilen desselben Empfängers unterscheidbar (Betrag/Fälligkeit in der zweiten Zeile, keine neue Zeilenhöhe > 48 px).
- 6 (Finanzen-Teil): „Buchung“ im Kopf und am Plus → „Buchung eintragen“ (Regel „<Ding> eintragen“, `decisions/ui-shell*` #755/#817). `e2e/shell.spec.ts:183–184` ist ein Ratschen-Treffer: im PR-Text als Treffer benennen; Svens Proxy-Freigabe läuft bis 2026-11-22.
- 10: Kontextzeilen der drei Kennzahlen brechen am Handy dreizeilig („+13,12 € (0 %) zum Vormonat“) – höchstens zwei Zeilen, Prozent nur wenn ≠ 0 oder kürzer formulieren.
- Neu aus Runde 6 (qa/round-6/STATUS.md „Neu aus der Nachmessung“): Finanzen → Verlauf zwei Primärknöpfe → einer; Finanzen-Kontokarten kürzen den Text.

## Abnahme
`npm run check`, `test`, `check:i18n`, E2E `money*`, `finance*`, `invoices*`, `shell` grün (Desktop + pixel-7); Bilder vorher/nachher 412 px im PR; Wortlaut nach FOCUS-WORDING; `.changes/` DE/EN.

## Skills
`review-loop`, `design:ux-copy` für die Wortwahl, `design:design-critique` für die Handy-Zeilen; Abschluss `full stop`.
```

## P5 – Dialoge, Zeilen, Wortlaut (`fix/dialogs-rows-wording`)

```
Routing: Claude Code · Dialoge, Zeilen, Wortlaut · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/dialogs-rows-wording`. Keine Hotspots.

## Pflichtliste (REPORT, Abnahme 0b-8 → Folgepunkte)
- 6 (Wetter-Teil): „Ort hinzufügen“ → „Ort eintragen“ (dieselbe Regel wie überall, Tests nachziehen).
- 7 (M7): Unterlagen-Dialog (11 Felder) und Fitness-Dialog (9 Felder): Pflichtfelder zuerst, Rest hinter „Mehr Felder“ (vorhandenes `ui/AdvancedFields`-Muster, kein neues Bauteil); Tresor-Regeln (`NoReadAid`, kein `aiSchema`) unberührt.
- 15: Handy-Zeilen über 48 px – Vorräte 98, Unterlagen 106, Merkliste 83, Fitness 77 px: auf eine Zeile + Meta-Zeile, Trefferfläche ≥ 44 px bleibt; messen mit `e2e/screenshots/targets-focus.spec.ts` bzw. Stimulus-Messung.

## Nicht in diesem Paket
Leerzustände (P6), Typografie-Skala (eigene Runde), Uhr (P2).

## Abnahme
`npm run check`, `test`, `check:i18n`, E2E der fünf Module + `a11y` grün (Desktop + pixel-7); Zeilenhöhen vorher/nachher als Tabelle im PR; Stimulus-Budget ohne neue Warnung; `.changes/` DE/EN.

## Skills
`review-loop`, `design:design-critique` (Dialog-Aufbau), `design:ux-copy`; Abschluss `full stop`.
```

## P6 – Leerzustände und Listen (`fix/empty-states-4`)

```
Routing: Claude Code · Leerzustände und Listen · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/empty-states-4`. Keine Hotspots; gemeinsame `ui/`-Bauteile gehören P7 – nur benutzen, nicht ändern.

## Pflichtliste (REPORT)
- Abschlussmessung 2 → Neue Folgepunkte (a) leere Liste: gefüllt „Neue Liste“, nächster Schritt „Artikel eintragen“ – ein Verb, Kopf „0 offen · 1 Ladenbereich“ ruhiger; (b) weißer Streifen unter leeren Personen am Handy; (c) Personen „Alle“, Budgets-Wortlaut.
- Abnahme 0b-8 → Folgepunkt 3 (Rest): Beträge in Listen in Tabellenziffern statt Monospace, orangener Haken → Haken in der Modulfarbe/neutral (Farbe nur mit Bedeutung).
- Folgepunkt 13 (nur diese Module): Leerzustand von Gewohnheiten (drei offene Ringe lesen sich wie ein Ladekreis) neu; Position der Leerzustände einheitlich (ToDos oben, andere mittig → eine Regel, in `docs/howto/design-rules.md` nur, wenn sie dort fehlt). Uhr und Fitness gehören P2/P5 – dort nur einen Satz im PR-Text als Folgepunkt.

## Abnahme
`npm run check`, `test`, `check:i18n`, E2E der vier Module (leer und mit Seed, Desktop + pixel-7) grün; CLS der leeren Seiten < 0,05 (wie 0b-8 gemessen); Bilder vorher/nachher im PR; `.changes/` DE/EN.

## Skills
`review-loop`, `design:ux-copy` (Leerzustands-Sätze nach FOCUS-WORDING), `design:design-critique`; Abschluss `full stop`.
```

## P7 – Runde-6-Reste (`fix/ui6-followups`)

```
Routing: Claude Code · Runde-6-Reste · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/ui6-followups`. Liste: docs/qa/round-6/STATUS.md „Offen aus den PRs“ – jeden Punkt erst im Code prüfen (Identity 4.0 hat einiges schon erledigt), erledigte im PR-Text als „schon erledigt durch #…“ nennen.

## Pflichtliste
- `ui/Patterns.module.css` `.done .title` trifft verschachtelte Zeilen → `.done > .row .title` (ToDos-Overrides danach entfernen, wenn überflüssig); `FolderTabs`: Zähler 0 und `nowrap` wie dort beschrieben; `WidgetBody` `data-empty` nur, wenn außerhalb von `home/**` (Übersicht gehört #849).
- U07 Rest: rohe `type="file"` in `tools/image/View.tsx` (~108), `tools/pdf/View.tsx` (~116, 225) und RecoveryScreen → vorhandenes `FileField`.
- Einrichtung: Fußzeile mit `--kb-inset` (Handy-Tastatur); `e2e/setup.spec.ts` ohne fest verdrahtetes `localhost:4173` (baseURL).
- Kalender: „Ablauf · Überfällig“ mit Wort je Art, Art „gift“ übersetzen (DE/EN), Uhrzeit-Kontrast auf eigenen Monatszeilen (S03, AA).
- Handy-FAB überdeckt Zeilen-⋯ und Karten-Knöpfe (Abos, Gewohnheiten): Abstand am Seitenende prüfen; wenn es `.main` braucht, nur Befund in den PR (AppShell gehört P3).

## Nicht in diesem Paket
Ungenutzte Schlüssel quer durch `strings.ts` (blockübergreifend, eigener Aufräum-PR), `home/**`, U41 Kopfbandhöhen (wahrscheinlich durch 4.0 erledigt – nur prüfen und im PR sagen).

## Abnahme
`npm run check`, `test`, `check:i18n`, E2E `setup`, `calendar*`, `tools*`, `todos*`, `a11y` grün (Desktop + pixel-7); `.changes/` DE/EN.

## Skills
`review-loop`, `design:accessibility-review` (Kontrast, Tastatur-Inset); Abschluss `full stop`.
```

## P8 – Erstkontakt-Reste der Freunde A–D (`fix/round5-rests`)

```
Routing: Claude Code · Erstkontakt-Reste A–D · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Ziel: Bevor Sven die vier Freunde die Dev-Preview ansehen lässt (qa/round-5/<x>/MESSAGE.md), sind ihre offenen kleinen Funde behoben. Befunde: docs/qa/round-5.md; Skizzen: docs/qa/round-5/{a,b,d}/FOLLOWUP.md. Pakete mit Stopp-freiem Ablauf, aber **zwei PRs**: Teil 1 ohne Daten-/Kernänderung, Teil 2 (F4) mit `council`.

## Teil 1 (`fix/round5-rests`)
- A11 (a/FOLLOWUP F2): Schrittzahl der Einrichtung ändert sich ohne Aktion → stabil zählen (`core/setup/**`; Regel „setup progress device-local, step ids only“).
- B10 (b/FOLLOWUP): „2 Zeilen übersprungen“ nennt die Zeilen (Nummer + Grund) in der Vorschau des Bank-Imports (`modules/finance/importer.ts`, Vorschau-Text).
- D02/D18 (d/FOLLOWUP F1): Kopplungsdialog am PC nennt den Weg mit den Wörtern des Handys („Sync & Backup“), ein Name für „Zuletzt abgeglichen“ (`strings.lanSync.ts`, `SyncSection.tsx`, `LanClientSection.tsx` – nur Texte; LAN-Sync-Regeln unberührt).
- D13 (F5): Sprachwechsel schließt offene Dialoge nicht mehr (Baum nicht neu mounten; Texte werden ohnehin beim Rendern gelesen) – nicht `layout/AppShell.tsx` (P3), sondern dort, wo der Remount ausgelöst wird.
- D14 (F2): Dev-Preview füllt Testdaten nur nach Frage („Mit Beispieldaten starten?“), nie still (`core/seed/dev.ts` `autoFillIfEmpty`); stabiler Build unverändert (`e2e/devflag.spec.ts`).
- D16 (F6): ein Wort für die Sync-Passphrase (Glossar `docs/i18n/GLOSSARY.md` entscheidet; `docs/user/sync.de.md:93` und Strings nachziehen).
- C11 nur prüfen: Übersicht leer nach Auto-Füllen bis Reload – wenn durch #842/#849 erledigt, im PR so nennen; sonst Befund für #849 in die Notizen.
## Teil 2 (`fix/notes-import-dates`, nach Teil 1)
- D17 (F4): importierte Markdown-Notizen behalten `created:`/`date:` aus dem Front Matter (sonst ZIP-Datum) als `createdAt`, `modified:` als `updatedAt`. Braucht eine Option an `createRepo` (Daten-Regel: nur über `createRepo`, Envelope unverändert, Sync/HLC unberührt) – Entscheidungs-Bullet in `decisions/core*.md`.

## Nicht in diesem Paket
C15 und C12 (gehören Wochenende 1/2), D15 (Planer, Wochenende), A12 Außendisplay und D01 (Hardware).

## Abnahme
Je Teil: `npm run check`, `test`, `check:i18n`, betroffene E2E (setup, finance-import, sync-lan, notes-import, devflag) grün; je Befund-Id im PR „vorher → nachher“; `.changes/` DE/EN; Befund-Ids in round-5.md als erledigt markieren (eine Zeile je Id).

## Skills
Teil 1 `review-loop` + `design:ux-copy` (Texte für A–D: B nimmt Formulierungen wörtlich, C hat wenig Geduld); Teil 2 `council` (Datenvertrag `createRepo`); Abschluss je `full stop`.
```

## P9 – Kaltstart-Reste (`perf/cold-start-rests`)

```
Routing: Claude Code · Kaltstart-Reste · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `perf/cold-start-rests`. Grundlage: docs/perf/COLD-START-2026-10.md („next“) und docs/perf/CLICK-TO-CONTENT-2026-11.md.

## Pflichtliste
- Vorher messen (`npm run check:bundle` bzw. das Skript aus COLD-START, kritischer Pfad gzip; Klick-Wächter aus #821).
- `SortableList` (und andere schwere Teile) nicht mehr über den Sammelexport `ui/index.ts` in den Start-Chunk ziehen; `OnboardingWizard` in `core/importer/host.tsx` erst bei Bedarf laden; `qrcode` in `ShareQr.tsx` per `import()`.
- `@noble` in `SupporterEffects`: nur Befund und Vorschlag im PR (Einbindung sitzt in `AppShell.tsx`, gehört P3).
- Nachher messen, Budget in der Budget-Datei nur senken, nie heben; Offline-E2E grün.

## Abnahme
Vorher/nachher-Tabelle (kritischer Pfad, Precache, Klick bis Inhalt) im PR; `npm run check`, `test`, E2E Smoke + Offline grün; `.changes/` nur, wenn Nutzer etwas merkt, sonst Label `no-changelog`.

## Skills
`review-loop`; Abschluss `full stop`.
```

## P10 – Planer-Konzepte (nur Doku, `docs/plan-concepts`)

```
Routing: Claude Code · Planer-Konzepte · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `docs/plan-concepts`, nur `docs/design/plan/**`, kein Code.

## Ziel
docs/design/plan/CONCEPT.md §7 nennt vier fehlende Konzepte: Zeiterfassung, Energie, Gewohnheiten, Wochenrückblick. Je eines: was der Planer davon braucht, kleinster Nutzen-Schritt, Datenfluss über den Event-Bus (Module importieren einander nie), Fokus-Checkliste 1–9 (kein Streak-Verlust, keine Schuldtexte, alles abschaltbar), Reizlast, Abhängigkeit zu „Wochenende retten“ (PACKAGES.md, W14 „Zeiterfassung automatisch“ ist dort „nicht jetzt“). Messen am Seed, was heute schon da ist (Module Gewohnheiten, Zeiterfassung existieren).
Ergebnis: je Konzept eine Datei ≤ 1 Seite + Paketplan mit fertigen Prompts im Format von `docs/design/usecases/wochenende/PACKAGES.md`.

## Stopp
Nach dem Bericht eine `AskUserQuestion` (≤ 4 Fragen, Empfehlung zuerst), dann Prompts finalisieren.

## Skills
`design:user-research` (Ziel: ADHS-freundliche Planung, Svens eigener KI-Planungsalltag), `design:research-synthesis`; `review-loop` mit einer Runde (Doku); Abschluss `full stop`.
```

## P11 – Screenshots 4.0 (`docs/screenshots-4-0`) – zuletzt

Aus PR #845 übernommen, unverändert bis auf den Kopf.

```
Routing: Claude Code · Screenshots 4.0 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Task: the README pictures and the social preview show the app before 4.0. Shoot them again from the seeded build.
- In `site/`: `npm run app:screenshots -- --readme` (writes `docs/assets/screenshots/*.webp`: overview, calendar, finance; desktop and phone; light and dark). Then `npm run gen:social` in `web/` for the social preview (docs/howto/design-brand.md).
- Seed `medium`, nothing real in the pictures.
- Check every picture by eye. Old head bands are gone; „Ruhig“ is the default overview. If the README picture of the overview should show „Ausführlich“, say so in the alt text.
- Adjust the alt texts in README.md and README.de.md to what the pictures show (`npm run check:readme`).
- Image budget: `npm run check:docs` (docs/meta/DOCS-GUIDE.md).
- Branch `docs/screenshots-4-0` from fresh develop, PR into develop, label `no-changelog`. Put before/after as images in the PR, never extra copies under docs/.
Skills: `council` before hand-over (README hotspot, public face), `design:design-critique` on the picture set; closing `full stop`; final message = 3 points + PR link.
```
