# Umsetzungs-Prompt: Nemo-Designüberarbeitung „Klar 2“

Dieser Prompt ist für einen Claude-Code-Chat gedacht, der die in `docs/design/DESIGN-SPEC.md` beschlossene Designüberarbeitung umsetzt. Er verweist auf Spezifikation und Mockups, statt sie zu wiederholen; alles, was für die Umsetzung zwingend ist, steht hier als harte Vorgabe. Teil B schlägt die Aufteilung in getrennte PRs für parallele Chats vor.

---

# Aufgabe: Designüberarbeitung umsetzen – Phase <N> „<Name>“

## Ziel
Die Oberfläche von Nemo nach `docs/design/DESIGN-SPEC.md` umsetzen: ruhig, klar, dunkel zuerst, eine Hauptaktion pro Ansicht, Zeilen statt Karten, Bereiche statt flacher Modulliste, Bewegung nur als Rückmeldung. Die Spezifikation ist beschlossen; du setzt sie um, du diskutierst sie nicht neu. Bei echten Lücken fragst du (siehe Arbeitsweise), bei Widersprüchen zwischen Spezifikation und Mockup gilt die Spezifikation.

Lies zuerst: `CLAUDE.md`, `docs/README.md`, `docs/design/DESIGN-SPEC.md` (ganz), danach nur den Rundenbericht und die Mockups deiner Phase (`docs/design/ROUND-<n>-*.md`, `docs/design/mockups/round-<n>/`). Mockups sind eigenständige HTML-Dateien mit erfundenen Daten; sie zeigen Zielzustand und Maße, nicht Code zum Kopieren.

## Branch und Git
- Git-Regeln: `docs/PROMPT-TEMPLATES.md#git`. Eigener Branch `feat/design-<phase>` von frischem `develop`; einen von der Session vorgegebenen Branch ignorierst du. Zeile in `docs/CHATS.md` im ersten Commit (Thema, Branch, Bereich), Hotspots dort beachten (`tokens.css`, `AppShell.tsx`, `router.tsx`, `strings.ts`, `core/modules/types.ts`).
- Kleine thematische Commits (Conventional Commits, z. B. `feat(ui): …`, `refactor(todos): …`), regelmäßig pushen. Vor dem Abschluss `develop` per Merge hereinholen (kein Rebase), Checks erneut laufen lassen.
- PR gegen `develop` (`gh pr create --base develop`), **nicht mergen**. Geht Push oder PR nicht: STOPP und PR-Text ausgeben. Kein `main`, keine Tags, Releases, Force-Pushes.

## Harte Regeln
- Regeln: `docs/PROMPT-TEMPLATES.md#hard-rules` und die Hard rules in `CLAUDE.md` gelten unverändert. Insbesondere:
  - **Interne IDs bleiben**: Bundle-Identifier `io.github.sgnemo.taschenmesser`, `tm-*`-Storage-Keys, Datenbankname, Backup-Format-IDs, Paketnamen, Updater-Endpunkte. `web/src/brand-ids.test.ts` muss grün bleiben.
  - **Sicherheitsbereiche unberührt**: Signierung, Secrets, Release-Audit, Tresor-Krypto (`core/crypto`, `modules/accounts` Logik), Local-API-Transport, KI-Privacy (`privacy.test.ts`, `exclusion.test.ts`), Disk-Blockliste und getippte Bestätigung. Du änderst dort nur Darstellung, nie Logik.
  - **Daten**: Schreiben nur über `createRepo`; keine Schema- oder Datenänderungen für Designzwecke (Ausnahme: `_settings`-Scopes für Favoriten/Bereiche und `_meta` für gerätelokale Darstellung, wie in der Spezifikation).
  - **Modul-Isolation bleibt**: Bereiche sind reine Navigation (`manifest.area`), kein Modul importiert ein anderes.
  - **Tokens-Pflicht**: keine Hex-, Radius-, Schatten-, z-index- oder Gewichtswerte in Modul-CSS; alles aus `web/src/ui/tokens.css`. Einzige dokumentierte Ausnahme: die Treemap-Palette in `modules/disk/components/Palette.module.css`.
  - **Ein gefüllter Akzent pro Ansicht**; FAB nur unter 900 px; Türkis nur für Diagramme und den hellen Fokusring.
  - **Bewegung** nur `transform`/`opacity`, 120/200/250 ms, `prefers-reduced-motion` = sofort; keine Seiten-Slides, kein Listen-Stagger, kein Dauerdrehen.
  - **Deutsch nur in `web/src/strings.ts`**; neue Texte dort im Block des jeweiligen Moduls anhängen, nichts umsortieren.
  - Keine neuen Abhängigkeiten ohne Rückfrage (Lucide, dnd-kit, Inter sind vorhanden).

## Arbeitsweise
- Starte im **Plan Mode**: Inventar der betroffenen Dateien, Plan je Schritt mit Reihenfolge, Risiken, Testplan. STOPP bis „Plan freigegeben“.
- Setze dann Schritt für Schritt um; nach jedem Schritt `cd web && npm run check && npm test` (bei UI-Schritten zusätzlich die betroffenen E2E-Specs). Rot wird sofort behoben, nie übersprungen oder abgeschaltet.
- **Vorher/Nachher-Screenshots** je Schritt: `SCREENS_DESKTOP=1 SCREENS_SCHEME=dark|light SCREENS_VIEWPORTS=1280x720,1920x1080,412x915 SCREENS_PAGES='^(…)$' SCREENS_DIR=test-results/screens/<phase>/<vorher|nachher> npm run screenshots`. Vorher-Satz vor der ersten Änderung aufnehmen. Beide Themen, Desktop und Handy.
- Nach jedem Schritt: Screenshots per SendUserFile schicken, kurz berichten, bei Abweichung von der Spezifikation fragen. Zwischenstopps: nach dem Plan, nach dem ersten sichtbaren Schritt (Tokens bzw. Shell), vor dem PR.
- Fragen nur, wenn die Spezifikation wirklich schweigt (§ 13 „Open items“) oder etwas technisch unmöglich ist; dann mit Vorschlag und Empfehlung, gebündelt per AskUserQuestion.
- Parallele Chats arbeiten an anderen Phasen (siehe Teil B). Fasse nur Dateien deiner Phase an; Hotspots nur mit Ankündigung in `docs/CHATS.md`; bei Konflikten in `tokens.css` oder `strings.ts` beide Inhalte behalten.

## Phasen (Reihenfolge; ein Chat je Phase, siehe Teil B)
1. **Tokens** (`web/src/ui/tokens.css`, `tokens.test.ts`, `global.css`): Werte aus SPEC § 5–6 (cool), `--text-3`, `--overlay`, `--shadow-1/2`, Radien 8/12/16/20, Fokus-Outline, Entfernen von `--accent-2*`, `--surface-glass`, `--*-soft` (Status-Soft über `color-mix`), Icon-Strich 1,5 px, Textgrößen-/Dichte-Root-Variablen (`data-text-size`, `data-density`). Dark-Block doppelt und identisch. Test erweitert (SPEC § 11). Dark zuerst prüfen, dann hell.
2. **Shell und Navigation** (`layout/AppShell*`, `useNavItems`, `MoreSheet`, `router.tsx`, `core/modules/types.ts` + `registry.ts` für `area`, Settings-Scope für Favoriten/Bereiche): Hybrid-Sidebar mit Rail (SPEC § 2), Bereiche und Favoriten (§ 3), Topbar mit einem „+ Neu“, Werkzeuge-Label, Bottom-Nav nach Bereichen, FAB nur mobil, Bereichsseiten mit Unterreitern, Master-Detail ab 1200 px (`SPLIT_QUERY`), Seitenwechsel ohne Slide. `strings.ts`: Bereichsnamen.
3. **Basis-Komponenten** (`web/src/ui/*`): Button-Hierarchie, Fields inkl. `SelectField`, Switch/Checkbox/Segmented/Chips/Tabs, `ItemRow` als einziges Listenmuster, Card ohne Rahmen, Dialog mit Sheet-Variante als Standard auf dem Handy, Toast mit Rückgängig, Badge-Töne, Skeleton/EmptyState/Fehlerbox, `Progress`, Tastatur-Hooks (`N`, `G`+Buchstabe, `J/K`, `?`, `Ctrl+Z`) und Shortcut-Sheet, Mehrfachauswahl-Leiste, Swipe-Helfer. Komponententests und Komponentenblatt-Screenshot.
4. **Home** (`web/src/home/*`, Widgets der Module nur über `WidgetList`): Begrüßung, Datum, Zählerleiste, spaltenbasiertes Raster mit „Heute“ als einzigem L-Widget, Hero-Zahlen, Zweizeilen-Zeilen, Aktionen im Widget (abhaken, bezahlt, snoozen), Handy-Reihenfolge.
5. **Module** (je Modul ein Commit, Reihenfolge: Rechnungen, Abos, Verträge, Budgets → Finanzen → Kalender → ToDos, Erinnerungen, Geburtstage, Habits, Zeiterfassung → Einkauf, Vorräte, Packlisten, Geschenkideen → Notizen, Merkliste, Nachrichten, Links → Accounts, Dokumente → Datenträger, Systeminfo → Werkzeuge → Einstellungen, Setup): Umstellung auf `ItemRow`, Panel/Sheet-Details, Schnellerfassung als „Neu“, Vollformulare mit „Mehr“-Chips, Entfernen der Modul-Kopien von Segmented/Progress/Inputs, Modul-Besonderheiten nach `ROUND-7-MODULES.md`.
6. **Motion** (`PageContainer.module.css`, `AppShell.module.css`, Komponenten-CSS): Muster aus SPEC § 9, Entfernen von `pageIn`, `itemIn`, `pillIn`, Sync-Spin, Blur; Reduced-Motion-Prüfung.
7. **Tests, Screenshots, Doku**: `lint`, `typecheck`, `test`, `e2e` (inkl. `a11y.spec.ts` mit Themen, Akzenten, Dichten), Screenshot-Sätze vorher/nachher in `docs/screenshots/<datum>/` (nur die README-Bilder und ein kleiner Satz, ≤ 1280 px), `docs/STATUS.md` (eine Zeile), `docs/DECISIONS.md` (eine Zeile + `docs/decisions/ui-brand.md`), `docs/howto/design-rules.md` und `docs/ARCHITECTURE-MAP.md` auf Stand, `CLAUDE.md` nur wenn eine Root-Regel sich ändert (Akzent, Motion, Bereiche).

## Qualität
- Definition of done je Phase: `npm run check`, `npm test`, `npm run e2e` grün; App startet (Web und, wo verfügbar, `tauri dev`); Kontrastprüfung über `tokens.test.ts`; axe ohne neue Verstöße; Touch-Ziele ≥ 44 px; Tastaturweg für jede neue Aktion; Reduced Motion geprüft; Vorher/Nachher-Screenshots in beiden Themen und drei Auflösungen im PR.
- Keine Verschlechterung: Klickwege aus `ROUND-1-DIAGNOSIS.md` § 3 dürfen nicht länger werden; die sieben Szenarien im PR-Text mit Klickzahl nachher.
- Kein toter Code: ersetzte Modul-CSS-Klassen, Komponenten und Strings werden entfernt, nicht auskommentiert.

## Abschluss
- PR-Text: `docs/PROMPT-TEMPLATES.md#pr-text` (What and why · Structure/changes · Numbers · How verified · Open questions · Hand-over), dazu die Screenshot-Paare und die Szenario-Tabelle. Zeile in `docs/CHATS.md` im letzten Commit entfernen.
- STOPP nach dem PR; nicht mergen.

---

# Teil B: Aufteilung in getrennte PRs (parallele Chats)

| PR | Phase(n) | Dateien (Kern) | Abhängig von | Parallel möglich mit |
|---|---|---|---|---|
| **1 Tokens** | 1 | `ui/tokens.css`, `tokens.test.ts`, `global.css`, `index.html` (theme-color), `stores/ui.ts` (Textgröße/Dichte) | – | 3 (gegen die alten Namen entwickeln, Variablen am Ende umbenennen) |
| **2 Shell + Bereiche** | 2 | `layout/*`, `router.tsx`, `core/modules/types.ts`, `registry.ts`, `available.ts`, `modules/*/manifest.ts` (nur `area`), `strings.ts` (Block `nav`), Settings-Scope | 1 (Tokens für Rail/Topbar) | 3, 4 |
| **3 Basis-Komponenten** | 3 | `ui/*`, `core/keyboard/*` (neu), `ui/*.test.tsx` | 1 | 2, 4 |
| **4 Home** | 4 | `home/*`, `ui/WidgetList.tsx`, `modules/*/widgets/*` (nur über WidgetList-API) | 1, 3 | 2, 5a |
| **5a Module Geld** | 5 | `modules/{finance,invoices,subscriptions,budgets,contracts}/**` | 2, 3 | 5b, 5c, 5d |
| **5b Module Planen** | 5 | `modules/{calendar,todos,reminders,birthdays,habits,timetrack}/**` | 2, 3 | 5a, 5c, 5d |
| **5c Module Haushalt + Wissen** | 5 | `modules/{shopping,pantry,packing,gifts,notes,bookmarks,news,launcher}/**` | 2, 3 | 5a, 5b, 5d |
| **5d Tresor + System + Werkzeuge + Einstellungen** | 5 | `modules/{accounts,vault,disk,system}/**` (nur UI), `tools/**`, `layout/ToolsSheet.tsx`, `pages/Settings.tsx`, `pages/settings/*`, `layout/setup/*` | 2, 3 | 5a, 5b, 5c |
| **6 Motion** | 6 | `PageContainer.module.css`, `AppShell.module.css`, Komponenten-CSS, `Misc.module.css` | 2, 3 | 5x (Motion fasst keine Modul-Dateien an) |
| **7 Abschluss** | 7 | `e2e/a11y.spec.ts`, `e2e/screenshots/*`, `docs/**`, `README`-Bilder | alle | – |

Regeln für die Parallelität: jeder Chat trägt sich in `docs/CHATS.md` ein; `tokens.css`, `strings.ts`, `types.ts`/`registry.ts`, `AppShell.tsx`, `router.tsx` sind Hotspots (ein Chat je Datei, Ankündigung vorher); Modul-Chats fassen nur ihre Modulordner und ihren `strings.ts`-Block an; PR 2 und 3 werden vor den Modul-PRs gemerged; jeder Modul-PR holt `develop` per Merge herein, bevor er fertig ist. Reihenfolge der Merges: 1 → 2, 3 → 4, 5a–5d, 6 → 7.
