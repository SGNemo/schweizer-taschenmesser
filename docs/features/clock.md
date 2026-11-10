# Uhr (module `clock`)

Places whose time is always in view: tiles on the overview, a list page, offline place search. Wish: Sven ("ein Uhr-Modul, in dem man Orte angibt und deren Zeit immer sieht"). State: **package 1 merged (#615)**, preview, off by default. Decision: [decisions/modules.md](../decisions/modules.md) (2026-11-09). Prompts for the next packages: [product/clock/](../product/clock/00-README.md).

## Package 1 (done)

| Part                                                                                                                                              | Where                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Table `clock_place` (`label`, `zone`, `order`)                                                                                                    | `web/src/modules/clock/{schema,repo}.ts`              |
| Page: local time as head figure, rows with large time, "morgen · +8 h", Tag/Nacht as word + icon, sort (drag, ⋯), rename, undoable remove, max 12 | `routes/ClockPage.tsx`, `components/*`                |
| Widget `kacheln`: 2 / 4 / 6 places                                                                                                                | `widgets/ClockWidget.tsx`                             |
| Offline search: `Intl.supportedValuesOf('timeZone')` + ~240 de/en city names, typo-tolerant, aliases rank lower                                   | `web/src/core/time/{placeSearch,cities}.ts`           |
| Zone arithmetic (shared with the Zeitzonen tool), one minute timer                                                                                | `core/time/zones.ts`, `core/time/useMinuteNow.ts`     |
| Quick capture `uhr <Stadt>` / `clock <city>`                                                                                                      | `quickCapture/parser/place.ts`, `targets/adapters.ts` |
| AI: one `create` action (keywords `weltuhr`, `zeitzone`; zone found offline)                                                                      | `modules/clock/{ai,aiDefaults}.ts`                    |
| Logo clock opens `/clock` while the module is on                                                                                                  | `layout/LogoClock.tsx`                                |

## Follow-ups from package 1

1. **Limit of 12 places only in the dialog.** Quick capture and the AI can add a 13th place: an adapter's `build` is synchronous and `aiCreateDefaults` cannot refuse. → [01-followups](../product/clock/01-followups.md).
2. **Unknown zone from the AI ("JST") is refused, not corrected.** Defaults never replace a given field (`core/ai/write/prepare.ts`). Recommendation: keep it (clean refusal, no wrong data); listed in 01 as "not in this package".
3. **Hand tests** (Windows/Android): [MANUAL-TESTS](../MANUAL-TESTS.md) "Uhr (Paket 1)".

## Next packages (each its own branch, decision first)

| #   | Package            | Core question                                                                   | Recommendation (for the decision chat)                                                                                                                   |
| --- | ------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2   | Wecker & Timer     | own alarm system in Uhr, or the existing calendar reminders and the Timer tool? | no own alarm engine: "Erinnerung um 9:00 Tokio-Zeit" creates a calendar reminder (converted to local time); the Timer stays a tool, linked from the page |
| 3   | Besprechungsplaner | hour matrix over the places, pick a slot, hand it to the calendar               | a view on the Uhr page (`?view=plan`), working hours per place as a field, hand-over by URL parameters of the calendar                                   |
| 4   | Wetter je Ort      | network for a module that is offline today                                      | global switch, off by default; coordinates from the city table (no geocoding); page rows only, not the widget                                            |

Not planned (no package): Android home-screen widget, own sync paths, seconds, world map.
