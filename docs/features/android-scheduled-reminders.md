# Android: scheduled reminders and tauri-plugin-notification 2.7.0

Found in the security package 9 review (#1081). Code: `web/src/core/platform/tauri/index.ts` (`scheduleUpcoming`), test `tauri.test.ts`. Hand test: SEC-15 in [MANUAL-TESTS](../MANUAL-TESTS.md).

## What the plugin does (sources of the 2.7.0 crate, `android/src/main/java/`)

- JS `sendNotification` → `window.Notification` (init script) → Rust `notify` → Kotlin `show` → `manager.schedule(notification)`: the alarm is set, **`notificationStorage.appendNotifications` is not called** (only `batch` calls it).
- `getPending` reads only that storage, so `pending()` never lists Nemo's alarms. The old stale-cancel step (`pending()` minus wanted) cancelled nothing: a reminder deleted in Nemo could still fire.
- `cancel(ids)` works without storage: `cancelTimerForNotification` rebuilds the `PendingIntent` from request code = id and the receiver class (extras are not compared) and cancels the alarm.
- `LocalNotificationRestoreReceiver` (boot) restores only from the storage. Worse: `Notification.sourceJson` is never assigned anywhere, so `appendNotifications` stores the string `"null"` even on the `batch` path; `getSavedNotification` then returns null and nothing is restored, and `getPending` may fail on such entries. So `batch` is no way out either.

## Fix in Nemo (no fork)

- Nemo keeps its own list of the alarm ids it handed to Android (localStorage `tm-native-alarm-ids`, device-local, ids only – hashes of the notification keys, no text). Stale = (own list ∪ `pending()`) minus wanted → `cancel`. The list is written after the cancel and before scheduling, so an interrupted run still cancels next time.
- Only alarms still in the future are cancelled: the plugin's `cancel(id)` also dismisses a shown notice with that id, and a reminder that already fired leaves the upcoming list – cancelling it would take it out of the shade unread. The list stores `[id, at]`; entries of the first version (ids only) are still cancelled once.
- `pending()` failing no longer stops scheduling.
- Reboot: Android drops all alarms on reboot and the plugin restores none. `startNativeSchedule` already reschedules on app start, every 10 minutes and when the app becomes visible. **Known limit:** after a reboot, reminders fire only once Nemo has been opened again.

## Proposal for the plugin (upstream, not done here)

1. `show`: call `notificationStorage.appendNotifications(listOf(notification))` when `schedule != null`, like `batch`.
2. Set `sourceJson` from the raw invoke arguments (`invoke.getArgs()` / per item in `batch`), as the Capacitor original did; without it storage, `getPending` and boot restore stay broken.
3. `getPending`: skip entries that do not parse instead of failing.

Once a fixed plugin version is in, Nemo's own list can stay (harmless) or go; the boot limit above disappears.
