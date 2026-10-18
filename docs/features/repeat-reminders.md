# Repeating reminders ("Ruhig wiederholen")

A reminder the user set (calendar kind `reminder`) that is not answered comes back every 30 minutes until "Erledigt" or "Später". Switch and values: Settings → Benachrichtigungen → Ruhige Erinnerungen (`focus.followUp`, default **on**; `repeatMinutes` 10/30/60, default 30; `repeatMax` 3/6/10, default 6).

## How it works
- **Pure logic** `core/notifications/policy.ts`: `repeatSeries` builds `<key>:r1 … :r<max>` (soft, text "Noch offen: …", the last one says it is the last and that the reminder stays in the notification centre). `baseKey`/`isRepeatKey` map extras to their reminder.
- **Source** `modules/calendar/notifications.ts` emits the series unless the base key is answered.
- **Calm rules, central in `applyPolicy`** (so in-app card, Android schedule and Web Push upload agree): a repeat in quiet hours or inside a "Stumm" pause is **dropped, not moved** (it still counts toward the limit, so the series ends at a fixed time); the hourly maximum applies and a repeat never pushes a first-time reminder into the summary. In `pickUpcoming` (Android) repeats only fill the alarm budget the reminders leave.
- **Answer ends it everywhere:** answers (`core/notifications/ack.ts`) are stored in the synced settings scope `reminders` as one field `ack:<key>` per answer (merges per field, pruned after 3 days), like the "Später" entries. "Später" also acknowledges the original. A synced answer triggers a rebuild of the OS/Web Push schedule (`triggers.ts`). Older device-local answers are still read.
- **Catch-up:** after a pause only the latest repeat per reminder is shown (`collapseRepeats`); the OS popup tag is the reminder's key, so a repeat replaces the earlier popup.
- **Existing installations** keep it off until switched on; fresh ones start with it on.
- **In-app card:** a repeat replaces the card of the same reminder (no stack).
- **Not repeated:** "Später" entries themselves (they fire once), appointments, staged leads, the digest.

## Test
`policy.test.ts` (time series, quiet-hours boundary, mute, answer mid-series, several reminders), `calendar/__tests__/notifications.test.ts` (10:00-style day with a synced answer), `ack.test.ts`, `e2e/reminders.spec.ts` (fixed clock).
