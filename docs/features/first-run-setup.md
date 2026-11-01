# First run: 3 questions, rest later

Package P1 of the QA round (`docs/qa/CONSOLIDATED.md` on branch `docs/qa-consolidation`; findings V01, B04–B07, B16, B21). Status: **implemented** (PR against `develop`). Maintainer answers: "Nur lokal, ohne KI" pre-selected, 6 profile cards, honest counting, scope incl. `layout/setup/**`.

## Measured today (develop @ `d9c9bbe`, e2e build, 412 px, fresh install)
| What | Value |
|---|---|
| Steps in the assistant | 12 (`core.basics` … `core.support`) |
| Taps, every step "Weiter" | 14 (start card 1 + 12 steps + "Fertig") – with a profile and its confirm box ≈ 16 |
| Progress numbers | wizard "Schritt x von **12**", dashboard card "10 von **11** erledigt" (the support hint is counted in one, not the other) |
| "Erledigt" without a write | every step where "Weiter" had nothing to save (9 of 12 in the run) |
| Network before a click | 1 request: `GET http://localhost:11434/api/tags` when the "KI-Anbieter" step opens (`detectOllama`, fails with a console error). Nothing else leaves the page in the whole run. |
| Example module | `devOnly`, hidden in release builds (`core/modules/registry.ts`); the QA build was the e2e build (`VITE_INCLUDE_EXAMPLE=true`) → B16 is a test-build effect; add a guard test only |

## After (same measurement, `e2e/setup.spec.ts` "first run")
3 questions, 5 taps (start card, Weiter, profile, Weiter, Fertig), 0 requests that leave the page (net log), dashboard card "2 von n Schritten erledigt" = the same total the wizard counts. The Ollama probe sends one request, only after the click "Auf diesem Computer nach Ollama suchen".

## Target flow (fresh install, status `notStarted`)
Welcome card button (unchanged, belongs to P2) → **quick mode** of the existing wizard, three screens, "Frage n von 3":
1. **Du** – name (optional) and text size (Normal / Groß / Sehr groß, applied live). Language, theme, week start sit in a collapsed "Mehr Einstellungen".
2. **Profil** – selectable cards (selected state, `aria-pressed`), each card names what it adds *and* what it switches off ("Schaltet ab: Finanzen, Rechnungen, Abos. Daten bleiben erhalten."). No confirm box in quick mode (nothing to lose on an empty install; modules can be switched back on any time).
3. **KI** – "Nur lokal, ohne KI" / "KI-Assistent später einrichten". Choosing the first calls `switchAiOff()`.

Taps: start 1 · Weiter 2 · profile 3 · Weiter 4 · "Fertig" 5 (6 if question 3 is not pre-selected). Every screen has "Rest später" (= leave, checklist keeps the rest) and "Alle Schritte ansehen" (expert path = today's wizard).
Afterwards the dashboard checklist card lists the remaining steps (sync, tools, AI provider, accounts, start data, notifications, backup, …).

## Changes by finding
- **V01** quick mode as above; new profiles `family` (calendar, todos, lists, pantry, people), `papers` ("Papiere & Termine": calendar, vault = Unterlagen, subscriptions, invoices + finance as required), `study` (todos, calendar, notes, bookmarks; timer). Quick screen shows 6 profiles (everyday, family, papers, study, finance, minimal); `productive` stays in the full step only.
- **B04** one number everywhere: total = steps without `hint`; the hint step is shown without a count. "Weiter" with nothing written records **skipped** ("Später"), not done – except steps that declare `settledByContinue` (the sync default "nur auf diesem Gerät"). Card: one primary button "Weiter einrichten", per-row "Öffnen" with distinct aria-labels; the old duplicate labels go.
- **B05** `setCanContinue` gets an optional reason (`setBlockedReason`); the wizard footer shows it next to "Weiter"; the profile confirm box moves above the cards' fold.
- **B06** profile cards list "Schaltet ab …"; button "Wählen", selected state.
- **B07** connector notes per connector (`ConnectorDef` text), Google "Testing" note only for Google.
- **B16** guard test: release build never lists `devOnly` modules in the setup.
- **B21** `detectOllama` runs only after the button "Auf diesem Computer nach Ollama suchen" (explains: asks `localhost:11434` only). Playwright net log asserts 0 external requests before any click.

## Files
`core/setup/{types,state,profiles,checklist,registry(additive)}.ts`, `layout/setup/{SetupWizard,ChecklistCard}.tsx` + `steps/{Basics,Profiles,Ai,Connectors}Step.tsx` + new `QuickFlow.tsx`, `strings.ts` block `setup` + `i18n/locales/*/setup.ts`, `e2e/setup.spec.ts`. Not touched: `WelcomeCard` (P2), `core/modules/*` (profiles live in `core/setup/profiles.ts`, no manifest change).

## Focus checklist ([FOCUS-GUIDELINES](../design/FOCUS-GUIDELINES.md))
1. Stimulus: 12 screens → 3; one question per screen, the rest hidden behind "Rest später". Profile cards 4 → 6 but only name + two short lines.
2. Off switch: the whole assistant is optional ("Rest später", card "Ausblenden"); the AI answer is itself the off switch.
3. Next step: one primary button per screen; blocked "Weiter" always says why.
4. Wording: "Später" instead of "Übersprungen"; no counters of failure; "Frage 2 von 3".
5. Interruption: progress is stored per step; leaving keeps finished steps (unchanged contract).
6. Tests: unit (progress, profiles, skipped≠done), e2e (3-question run, tap count, net log, skip path), de/en/es/fr/pt-BR via `check:i18n`.
7. Readability: colour only with text (selected = check icon + "Gewählt"); long texts via `ReadableText`.
9. Removed instead: the confirm box in quick mode, the double progress number, the duplicate card buttons, the automatic Ollama probe.
8. Clicks: 14 → 5.

## Moving from another app (`core.migrate`)
- Full assistant only (order 75, before start data; not in `QUICK_IDS`); offered on an empty installation, or while an origin is chosen. Tiles: Google, Todoist, Obsidian/Markdown, Bank, Bitwarden, "Papier / Kopf" (opens nothing). A tile switches the target module on and opens its existing importer (`core/importer`); Bitwarden goes to Passwords `?tools=1` (vault import stays in `ToolsDialog`).
- Progress: `_meta` `migrate.state` (`core/setup/migrate.ts`): origin ids + time, ticked manual point ids; never contents. A point is done when a committed `_imports` batch of its module is newer than the choice; manual points (calendar subscription, Bitwarden) are ticked by hand.
- `buildChecklist(…, subs)` adds `sub` rows under `core.migrate`; the row stays while a point is open. "Weiter": chosen + import run (or "Papier") = done, else "Später". The checklist row keeps its place even when more than five steps are open.
- Same tiles in Settings → Sync & Backup (`BackupSection`, dialog). ZIP is not unpacked.

## Not in this package
Everything under "Nicht umsetzen" / "Zurückgestellt" in CONSOLIDATED.md; other findings go into the PR text.
