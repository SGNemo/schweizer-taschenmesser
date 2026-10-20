# Repeating reminders ("Ruhig wiederholen")

A reminder the user set (calendar kind `reminder`) that is not answered comes back every 30 minutes until "Erledigt" or "Später". Switch and values: Settings → Benachrichtigungen → Ruhige Erinnerungen (`focus.followUp`, default **on**; `repeatMinutes` 10/30/60, default 30; `repeatMax` 3/6/10, default 6).

## How it works
- **Pure logic** `core/notifications/policy.ts`: `repeatSeries` builds `<key>:r1 … :r<max>` (soft, text "Noch offen: …", the last one says it is the last and that the reminder stays in the notification centre). `baseKey`/`isRepeatKey` map extras to their reminder.
- **Source** `modules/calendar/notifications.ts` emits the series unless the base key is answered.
- **Calm rules, central in `applyPolicy`** (so in-app card, Android schedule and Web Push upload agree): a repeat in quiet hours or inside a "Stumm" pause is **dropped, not moved** (it still counts toward the repeat cap, so the series ends at a fixed time, but not toward the hourly limit); the hourly maximum applies and a repeat never pushes a first-time reminder into the summary. In `pickUpcoming` (Android) repeats only fill the alarm budget the reminders leave.
- **Answer ends it everywhere:** answers (`core/notifications/ack.ts`) are stored in the synced settings scope `reminders` as one field `ack:<key>` per answer (merges per field, pruned after 3 days), like the "Später" entries. "Später" also acknowledges the original. A synced answer triggers a rebuild of the OS/Web Push schedule (`triggers.ts`). Older device-local answers are still read.
- **Catch-up:** after a pause only the latest repeat per reminder is shown (`collapseRepeats`); the OS popup tag is the reminder's key, so a repeat replaces the earlier popup.
- **Existing installations** keep it off until switched on; fresh ones start with it on.
- **In-app card:** a repeat replaces the card of the same reminder (no stack).
- **Not repeated:** "Später" entries themselves (they fire once), appointments, staged leads, the digest.

## Test
`policy.test.ts` (time series, quiet-hours boundary, mute, answer mid-series, several reminders), `calendar/__tests__/notifications.test.ts` (10:00-style day with a synced answer), `ack.test.ts`, `e2e/reminders.spec.ts` (fixed clock).

## Grenzen im Zusammenspiel
`core/notifications/limits.test.ts` drives the real calendar source, `collectDue` and `checkDue` with a fixed clock (5-minute ticks). Secured combinations:
- **Quiet hours + repeats:** series of a 10:00 reminder ends at the last repeat before 22:00; nothing piles up at 07:00; an explicit reminder at 23:50 fires, its repeats across midnight are dropped.
- **Answer:** mid-series it stops the next tick; a daily reminder is not silenced by yesterday's answer (key carries the date).
- **Hourly cap + repeats:** three reminders in one hour against max 3: whole-hour view (Android, Web Push) = 2 firsts + one summary with the repeats; the open app, tick by tick, shows the three firsts and no repeat. Cap 0 = unlimited.
- **Stumm mid-series:** repeats inside the pause are dropped and do not count toward the hour's cap (`applyPolicy` removes them before the limit; `collectDue` passes a pause that overlaps the query window, so an ended pause still covers what fell inside it); explicit reminders arrive quiet.
- **Zock-Modus on/off mid-series:** only what arrives in between is quiet (+ tone on desktop); a reminder already quiet by Stumm never gets the tone.
- **Two devices:** an answer that syncs late lets the second device fire once more, never after it arrives.
- **DST night** (Europe/Berlin, 2026-03-29): 02:30 does not exist, the reminder fires once at 03:30.
- The hour bucket is the local clock hour (`policy.ts` `applyLimit`), so the cap holds in half-hour zones too (tested with `TZ=Asia/Kolkata`).

