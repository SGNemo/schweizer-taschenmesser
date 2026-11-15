# Gerätestatus – depth and polish (round 2026-11 "Tiefe")

**Is:** `/device` shows eight status lines in four groups (backup, sync, storage, app) and one button. The live facts
of the computer (CPU, memory, network, battery, hardware, processes) exist only in "Dieser PC" → System
(`modules/disk/components/SystemTab.tsx`), off by default and desktop only. The phone sees two lines.

**Goal:** the page answers "how is this device doing, and what is it?" on every platform: live load while the page is
open, a hardware passport to copy for support, battery and drive health where readable, unexpected shutdowns; the
widget carries the core numbers. Read-only (the chat "dieser-pc" acts; this module shows and explains).

**Limits (all packages):** reads only while the page is visible (3 s, paused when hidden), history only in memory;
nothing leaves the device; no IP address (local or public), no network name, no path, no user name, no serial number
on the page, in the copied text or in the widget; no new data, no `aiSchema`, `dataApi: false` stays.

## Packages (one branch and PR each, in this order)

| #   | Branch                         | Content                                                                                                                                                                                                                                                       | Hotspots                                                                                  |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| p1  | `feat/device-status-deep-p1`   | Desktop: live tiles (CPU, memory, network, battery) with `Sparkline`, top 5 programs (CPU / memory), hardware passport with "Als Text kopieren", connection line (kind, signal in words), uptime. Phone: battery (Web API), Android version. Existing reads only. | `strings.ts` (own block)                                                                  |
| p2  | `feat/device-status-deep-p2`   | New read command `system_health` in `crates/system-info`: battery wear and cycles, unexpected shutdowns and blue screens (time + code, 30 days), drive health (temperature, wear) where Windows reports it. Lines on the page.                                  | `core/platform/system.ts`, `src-tauri/src/system.rs`, `lib.rs`, `build.rs`, capabilities |
| p3  | `feat/device-status-deep-p3`   | Widget: one reading at mount (no polling): memory and uptime on the PC, battery on the phone, next to the status sentence.                                                                                                                                     | –                                                                                         |

Not built: temperatures of CPU/GPU (Windows gives them only to admin or a driver; "Dieser PC" already says so), public
IP (never), the System tab of "Dieser PC" (owned by the chat "dieser-pc"; suggestion in the scribble note: point it here).
