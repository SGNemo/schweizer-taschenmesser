# Focus audit 2 – phase 2: measures and packages (2026-10-14)

Basis: [10-audit-2.md](10-audit-2.md) and the maintainer's answers. Rules: nothing is deleted; "streichen" = off by default or folded, data and code stay; every addition needs a situation (the diary is still outstanding, so additions rest on the maintainer's direct wishes and are marked so). Mockups: [home-two-layers](mockups/home-two-layers.png), [todos-calm](mockups/todos-calm.png) (HTML next to them).

## Decisions so far (maintainer)
1. Home default = "Nur das Wichtigste", with a clear way to see more or pin chosen widgets.
2. Streaks and week review off by default for **new** installs; existing installs keep their choice, no extra prompt (fewer hints).
3. Screenshot = a tool/widget in the app. Shortcuts only for functions one wants to reach directly. In-app first.
4. Weather on by default, with a city chosen once (nothing is shown until a city is set).

## Column 1 – Fold / switch off by default (no data loss)
| Measure | Data path | Expected effect |
|---|---|---|
| Streaks (`streaks`) and week review (`weekReview`) default off for new installs | settings default only; existing `focus` scope keeps stored values, no migration | no counters in the busiest widget |
| Module "Jetzt" strips (`moduleNow`) default off for new installs | same | −1 repeated element on three pages |
| Day plan "Heute" and "Heute & Morgen" timeline merged into one "Heute" card on home (plan items first, then appointments) | `plannedFor` field untouched; only widgets change; old widget keys mapped via `LEGACY_WIDGET_KEYS` | three "today" lists become one |
| "Wartet noch" shown once (handle), not as card plus group | none | fewer repeated blocks on ToDos |
| Focus mode entered from the "Heute" card/timeline row ("Anfangen") instead of a separate concept | route and `_meta` state stay | one thing to understand, not two |

## Column 2 – Simplify
| Measure | Concrete | Expected effect |
|---|---|---|
| Home default "Nur das Wichtigste" for new installs + a handle "Mehr anzeigen · n" and "Anheften…" (reuses home edit mode) | `homeView` default; existing installs keep theirs | home 6598 px → about 1.5 screens |
| "Jetzt" card: one primary button, "Später" quiet, "Etwas anderes" into a menu | `NextWidget.tsx` | 3 equal choices → 1 + 1 |
| ToDos page: add field on top; "Neue Liste", "Erweitert", KI, filters into a "⋯" menu; no FAB where the page has an add field | `todos/routes`, `layout` | fixes covered row menu; ~6 controls → 2 |
| Focus settings: 27 → ~12 visible, rest under "Erweitert" (quiet hours as one line, max-per-hour, in-app prompt sub-options, stages) | `FocusSection.tsx` only; stored keys unchanged | shorter settings, same power |
| Settings → Darstellung: group themes/colours, show only the current choice + "Ändern" | `AppearanceSection.tsx` | 6945 px → about half |
| Touch targets: inline links ≥ 44 px where they act as buttons | `ui` | one-hand use on the phone |
| "Später"/snooze on ToDo list rows (swipe or menu) | uses existing snooze | postpone in 1 step |

## Column 3 – Additions (S/M/L, stimulus check)
| Addition | Situation (source) | Size | Stimulus check |
|---|---|---|---|
| Weather widget (Open-Meteo, city chosen once, one line: temperature, short text, rain hint) | wish: "things I'd pick up the phone or Google for" (maintainer) | M | one small card in "Heute"; only city text leaves the device; host added to the connect allow-list (`tauri.conf.json`, existing `core/net/fetchPublic.ts`); no key; `dataApi: false`; setting to switch off |
| Screenshot tool (captures the screen or window to an image/note; the app's own flow, no new dependency) | maintainer uses it daily elsewhere | M | tool under Werkzeuge, optional widget; web/PWA uses `getDisplayMedia`, desktop falls back to the same; permission asked by the browser |
| Shortcut map: in-app chords of 2–3 keys (e.g. `G` navigation exists; add `T` + letter for tools: Screenshot, Timer, Rechner, Scan…) and **F-keys** for the chosen top actions, user-rebindable in Settings, shown in `?` sheet | maintainer wish | M | no on-screen element; only keys; F5/F11/F12 stay with the browser, defaults use F2–F4, F6–F10; each shortcut must have a direct function |
| System-wide hotkey while the app is in the background (desktop) | maybe later | L | needs Tauri global-shortcut plugin = new dependency, **needs your approval**; not planned now |
| Ideas to test against the diary (not planned): countdown to an event, "what did I do today" log, medication/routine times | unconfirmed | – | only if the diary names a situation |

## Mockups (two biggest changes)
- **Home** ([png](mockups/home-two-layers.png)): A (recommended) = Jetzt + Heute + weather + "Mehr anzeigen"; B = same plus own pinned widgets. B is A with pins, so the default is A and B is the user path.
- **ToDos** ([png](mockups/todos-calm.png)): A (recommended) = add field, Heute, Später, "Wartet noch" handle, "⋯" menu; B = ToDos opens on "Heute" only, bigger change.

## Packages (small, one PR each, by impact; a stop and a week of use between them)
1. **Paket 1 – Defaults and settings** (`feat/focus2-defaults`): new-install defaults (home "Nur das Wichtigste", streaks/week review/module strips off), focus settings 27 → ~12 visible, Darstellung grouped. Tests: defaults for new vs existing installs, stored values untouched, settings inventory. Lowest risk, biggest drop of the stimulus numbers.
2. **Paket 2 – Home and "Heute"** (`feat/focus2-today`): one "Heute" card (plan + timeline + next), one-button "Jetzt", "Mehr anzeigen / Anheften", ToDos page calm layout, focus mode entered from "Heute". Tests: widget key mapping, "Heute" logic (ToDos due/planned + appointments + reminders), e2e of the ten paths on desktop and Pixel viewport with step counts.
3. **Paket 3 – Reminders and feedback** (`feat/focus2-reminders`): snooze on rows, one feedback line after each action (existing undo toast reused), notification limit tests, 44 px targets.
4. **Paket 4 – Additions** (`feat/focus2-additions`): weather, screenshot tool, shortcut map with F-keys (in-app). Own sub-PRs if too big.
After each package: re-measure with the same script (stimulus table of 10-audit-2) into `12-results-2.md`, and update FOCUS-GUIDELINES (new mandatory question "What could be removed instead?"), DECISIONS (each fold with why), STATUS, HOW-TO.

## Open before the build
- The diary and first-round usage are still missing; Paket 1 does not depend on them, Paket 2–4 should be confirmed against it.
- Paket 4: confirm F-key list and the shortcut map in a short question round when we get there.

**Model hint:** implementation (phase 3) is routine work and fits Sonnet; start each package in a fresh chat from `develop` and give this file as the brief.
**Release for the order:** please confirm "1 → 2 → 3 → 4" or change it.
