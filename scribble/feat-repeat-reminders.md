# feat/repeat-reminders (PR #181, merged 2026-10-18)

for the next chat: repeating reminders ("Ruhig wiederholen"). Short doc: `docs/features/repeat-reminders.md`, decision: `docs/decisions/focus.md`.

- Repeats are keys `<reminder key>:r1…:rN` (`core/notifications/policy.ts`: `repeatSeries`, `collapseRepeats`, `baseKey`, `isRepeatKey`). Quiet hours and "Stumm" drop them (do not move), the hourly limit still counts them but never lets a repeat push a first-time reminder into the summary.
- Answers (Erledigt / Später) are one synced field `ack:<key>` each in the `reminders` settings scope (`core/notifications/ack.ts`). Known limit: an answer reaches other devices with the next sync; until then their already scheduled repeats can still fire once.
- `DueNotification.baseTitle` (optional) keeps the reminder's own title when a repeat says "Noch offen: …"; "Später" stores it.
- Not repeated on purpose: "Später" entries (fire once), appointments, staged leads, the digest. A chat that wants those must extend `repeatSeries` callers, not the series itself.
- Existing installations keep `followUp` off (`LEGACY_FOCUS_DEFAULTS`); fresh ones start with it on.
- Android: `pickUpcoming` fills the 100-alarm budget with reminders first, repeats second.
- Gotcha: `npm run chats:status` crashes when a remote branch has no merge base (`alert-autofix-1`), see BOARD parking.
- Out of my scope and handed over: parser/clock fixes for dictated times (`quickCapture/parser/dates.ts`, `core/ai/write/rules/clock.ts`, `WritePreview`/`reminder.askTitle`) belong to the chat that owns the voice/write pipeline.
