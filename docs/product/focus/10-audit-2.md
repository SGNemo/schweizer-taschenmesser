# Focus audit 2 – phase 1: strict review (2026-10-14)

Status: **preliminary**. Evidence = answers of the maintainer (nothing is removed or deleted, everything stays switchable; usage per function unknown), DOM measurements and screenshots of the seeded Dev build (medium test data, desktop 1280×800 and phone 412×915), and a read of the settings and defaults in code. No diary yet, so "benefit according to diary" is open and every verdict below is a hypothesis to be confirmed by it. Raw numbers: [img/audit2-inventory.json](img/audit2-inventory.json). Method note: the measuring spec is local tooling and not committed (this branch is docs only).

**Ground rule from the maintainer:** nothing is deleted. "Streichen" therefore means *off by default* (still one switch away) or *folded into an existing place*, never removal of data or code.

## 1. Stimulus inventory (default state, seeded data)
| View (phone / desktop) | Page height | Buttons | Links | Icons | Badge-like | Colours | First screen: actions |
|---|---|---|---|---|---|---|---|
| Home | **6598 px** / 800 | 22 / 44 | 65 / 81 | 67 / 110 | 1 | 10 | 22 / 46 |
| ToDos | 3382 / 800 | **107 / 129** | 10 / 26 | 60 / 103 | **44** | 10 | 36 / 64 |
| Calendar (month) | 1087 / 800 | 51 / **264** | 10 / 26 | 13 / 56 | **124** (desktop) | 12 | 60 / 117 |
| Reminders tab | 4064 | 82 / 104 | 11 / 27 | 36 / 79 | 8 | 8 | 30 / 62 |
| Finance | 1844 | 15 / 76 | 13 / 29 | 16 / 77 | 2 / 19 | 11 / 12 | 25 / 55 |
| Notes | 1697 | 18 / 40 | 10 / 26 | 15 / 58 | 12 | 7 | 22 / 50 |
| Lists | 1236 | 43 / 65 | 9 / 25 | 27 / 70 | 15 | 8 | 43 / 67 |
| Pantry | 1965 | 60 / 82 | 9 / 25 | 27 / 70 | 15 | 10 | 37 / 61 |
| People | 3375 | 66 / 88 | 10 / 26 | 40 / 83 | 29 | 7 | 29 / 63 |
| Bookmarks | 4227 | 61 / 83 | 41 / 57 | 44 / 87 | 32 | 7 | 43 / 75 |
| Settings → Darstellung | **6945** | 83 / 115 | 7 / 35 | 12 / 67 | 1 | **20** | 20 / 62 |
| Settings → Module | 5564 | 41 / 73 | 8 / 36 | 10 / 65 | 1 | 9 | 14 / 56 |

(Badge-like = elements with class badge/chip/count/pill/tag. Animated elements per view: 1 everywhere except ToDos 1; nothing animates without a reason, reduced motion respected.)

- **Home on the phone is ~7 screens tall with ~20 widgets** below the "Jetzt dran" card. The first-round "Nur das Wichtigste" mode exists, but it is off by default, so the default home is the heaviest view of the app.
- **Settings:** 77 stored core settings (27 of them in the focus scope), 22 module settings, 38 settings sections (`sections.tsx`). Target: fewer.
- **Notifications per day, defaults:** at most 1 digest (09:00) + each event's own lead + user-set reminders, capped at 3 per hour, quiet hours 22–07; staged leads, follow-up and in-app card are off. Default load is low; the risk is not volume but the number of switches to understand (see section 3).
- **Touch targets:** 72–90 interactive elements below 44 px on home and ToDos (many are inline links); to be split into real targets vs. text links in phase 2.

## 2. Criteria scores (0 poor, 1 ok, 2 good; – = not measurable from static review, needs the walk-through)
K1 first glance says what to do · K2 one main action · K3 nothing moves without reason · K4 short text · K5 minimal decisions · K6 abort without loss · K7 re-entry · K8 time visible · K9 feedback after action · K10 friendly errors · K11 one-hand on phone.

| View | K1 | K2 | K3 | K4 | K5 | K6 | K7 | K8 | K9 | K10 | K11 | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home | 1 | 1 | 2 | 1 | **0** | – | 2 | 2 | – | – | 1 | "Jetzt dran" on top is good; but 3 buttons beside the one task (Anfangen / Später / Etwas anderes) plus FAB, then ~20 widgets, 6598 px |
| ToDos | 1 | 1 | 2 | 1 | **0** | – | 1 | 1 | – | – | 1 | add field + "Neue Liste" + "Erweitert" + settings gear + FAB + filter chips + "Neu planen" card; 44 badge-like; the FAB covers the last row's menu |
| Calendar | 1 | 1 | 2 | **0** | **0** | – | 1 | 2 | – | – | 2 | desktop month grid: 264 buttons, 124 chips; phone view is clean |
| Finance | 1 | 1 | 2 | 1 | 1 | – | 1 | 1 | – | – | 1 | 15 buttons on the phone; amounts carry context |
| Notes | 2 | 1 | 2 | 1 | 1 | – | 1 | 1 | – | – | 2 | 22 actions on first screen; small |
| Lists | 1 | 1 | 2 | 2 | 1 | – | 1 | 0 | – | – | 1 | 43 buttons; good short text |
| Pantry | 1 | 1 | 2 | 1 | 1 | – | 1 | 2 | – | – | 1 | expiry shown as days; 15 badges |
| Settings/Darstellung | 0 | 0 | 2 | 0 | **0** | – | – | – | – | – | 1 | 6945 px, 20 colours (theme swatches), 83 buttons |
Not yet scored: Budgets, Invoices, Subscriptions, People, Bookmarks, Vault, dialogs (quick capture, editors, focus screen, inbox sorter) – they need the interactive walk-through.

**Pattern:** K3 (calm, no needless motion) is good everywhere – first round worked there. K5 (decisions) is the weak spot: every main view offers many equal-weight choices at once.

## 3. Verdicts on the first-round focus functions
Without usage data (and with "nothing removed") the only verdicts used are: keep · simplify · merge · **off by default**. Default-off functions stay one switch away and keep their data.

| Function (setting) | Verdict | Why (hypothesis, confirm with diary) |
|---|---|---|
| "Jetzt dran" card (`nextOne`) | keep, simplify | best element of the home; reduce the three buttons to one primary ("Anfangen") + one quiet "Später" |
| Day plan "Heute" (`dayPlan`, `planLimit` 3) | merge | same screen as "Jetzt dran" and the "Heute & Morgen" timeline: three overlapping "today" lists |
| Calm attention strip (`calmAttention`) | keep | removes the red wall; keep the single chip |
| Module "Jetzt" strip (`moduleNow`) | off by default | repeats the home chip on three module pages; extra element per page |
| Time to next (`timeToNext`) | keep | one number with context, solves "how long until…" |
| Focus mode + timer (`focusMinutes`, `focusSound`, `focusIndicator`) | merge with timeline idea | a ring timer is a separate world from the day timeline; offer "start this entry" from the timeline instead of two entries |
| Quiet hours (`quietHours`, from/to) | keep | defaults fine; two time pickers could be a single "Ruhezeit" line |
| Max per hour (`maxPerHour`) | simplify | hide behind "Erweitert"; default 3 stays |
| Staged leads (`staggered`, `stages`) | off by default (already) | five choices; keep in Erweitert |
| Follow-up (`followUp`) | off by default (already) | one more notification type; keep |
| Morning digest (`todoDigest`, time) | keep | one notification replacing many |
| In-app prompt card (`inAppPrompt`, position, seconds) | simplify | 3 settings for one card that is off by default: show only the switch, rest in Erweitert |
| "Woran war ich" (`resumeCard`) | keep | core re-entry aid |
| Quick capture without question (`captureNoQuestion`) | keep | fewer decisions |
| Search history (`searchHistory`) | keep, hide switch | low load, switch rarely needed |
| Streaks (`streaks`) | **off by default** | even gentle counters are a stimulus; positive-only wording is preserved, but "n in Folge" is optional by guideline; on only if the diary says it motivates |
| Week review (`weekReview`) | off by default | an extra block in the busiest widget |
| Evening wrap-up (`eveningWrapUp`) | keep | one tap, ends the day calmly |
| "Nur das Wichtigste" home | **on by default** (candidate) | would fix the heaviest view; needs the home decision in phase 2 |
| Text size, line spacing, motion switch, reading aid | keep | accessibility, device-local |
| Inbox sorter | keep | one thing at a time is right |

27 focus settings can be presented as ~12 visible ones + an "Erweitert" group; nothing is lost.

## 4. The ten everyday paths – status
The walk-through (step counts, screenshots with markings, e2e later) is **not done yet**: the paths come from the diary. Provisional list to confirm or replace: (1) see what is due today, (2) add a ToDo in one go, (3) start a task and keep going, (4) snooze or postpone, (5) capture a thought on the phone, (6) find something again, (7) check a bill or due date, (8) plan tomorrow in the evening, (9) come back after a break, (10) tick off a routine (morning/evening). First observations from the static pass: path 1 is already on the first screen; path 2 needs a field, a list choice (chips) and a button on ToDos but one key (`N`) on desktop; path 9 works via the resume card; path 4 has "Später" only on the card, not on list rows.

## 5. Top 15 problems, by impact
1. Home default = 20 widgets / 6598 px on the phone; the calm mode is off by default.
2. Three overlapping "today" lists on home (Jetzt dran, Heute plan, Heute & Morgen timeline) plus the attention chip.
3. ToDos page: 6+ controls above the first task, 44 badge-like elements, "Wartet noch 8" repeated as card and group.
4. FAB overlaps the last visible row on phone (menu button hidden).
5. Settings Darstellung 6945 px on phone; many settings of equal weight; 38 sections.
6. 27 focus settings visible at once; several are sub-options of off features.
7. Calendar desktop month view: 264 buttons / 124 chips; no calm default.
8. Focus mode and timeline are two separate concepts for "doing something now".
9. Streaks/week review add counters to the home widget (even if gentle).
10. Module "Jetzt" strips duplicate the home chip on three pages.
11. Interactive elements < 44 px: 72–90 on home/ToDos phone (inline links).
12. "Später"/snooze exists on cards, not on list rows (extra steps to postpone a ToDo).
13. People (29) and Bookmarks (32) pages: dense badge rows, 57 links on Bookmarks desktop.
14. Keyboard: only letter keys, `G` chords, `Ctrl+K`, `Ctrl+Z`; no F-keys, no screenshot or global shortcut (see section 6).
15. Unused modules still occupy navigation/widgets by default (disable by default is possible, no deletion).

## 6. Wishes from the maintainer (Phase 0 answers)
- **Weather** and "functions I would otherwise pick up the phone or search the web for". Candidate source: Open-Meteo (free, no API key, OpenStreetMap-based geocoding via Nominatim or Open-Meteo's own). Privacy check needed: only coarse location (city name chosen by the user) leaves the device, never entries; fits the connector pattern (`web/src/connectors`), `dataApi: false`. Not decided.
- **Hotkeys:** wants strong shortcuts (also 2–3 key chords, or two keys then F1–F12), e.g. "create screenshot". Today: `N`, `G`+letter, `J/K/E/Space//`, `?`, `Ctrl+Z`, `Ctrl+K` (`core/keyboard/shortcuts.ts`). There is no screenshot function in the app. System-wide hotkeys on the desktop (while the app is in the background) would need Tauri's global-shortcut plugin = a new dependency, so it is a decision for the maintainer, not a default.
- **Other tools/paper:** unknown; to be filled from the diary. Suggestions to check against it: shopping/errands lists, weather, medication/time-of-day routines, "what did I do today" log, countdown to events.

## 7. Questions (max 4, each with a recommendation)
1. **Home default:** make "Nur das Wichtigste" the default (everything else one tap away, nothing removed)? *Recommendation: yes.*
2. **Streaks and week review:** switch both off by default, existing users keep their choice? *Recommendation: yes for new installs; for existing installs ask once, calmly.*
3. **Hotkeys:** in-app only (no new dependency), or also system-wide on the desktop app via the Tauri global-shortcut plugin? And what do you mean by "screenshot": a screenshot of the app, or capturing the screen into a note? *Recommendation: in-app chords + F-keys first; global shortcut as its own package after a dependency decision.*
4. **Weather:** Open-Meteo with a city you pick once, shown as one small widget (off by default)? *Recommendation: yes, as a separate package 4 item.*
