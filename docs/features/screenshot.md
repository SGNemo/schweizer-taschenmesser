# Bildschirmfoto (Werkzeug `screenshot`)

Tool in `web/src/tools/screenshot/` (group extra, **off by default**, order 170). Capture a screen, window or tab, then copy, save or share the picture. Decision: [decisions/tools.md](../decisions/tools.md).

## Flow
- `capture.ts` `captureFrame`: `getDisplayMedia({ video: true, audio: false })` → one frame on a canvas → PNG blob; the stream is stopped at once. The browser asks for permission every time.
- Optional pause (checkbox, 3 s): starts **after** the source is picked, so the user can switch to the window. Calm text counter ("Aufnahme in 3 …"), no animation (reduced motion needs nothing), "Abbrechen" stops it.
- Result: preview, then **Kopieren** (Web `ClipboardItem` `image/png`), **Speichern** (`getPlatform().saveFile`: download in the browser, dialog in the desktop app), **Teilen** (`navigator.share` with a file, button only where `canShare({ files })` accepts this PNG; many desktop browsers share text only), **Verwerfen**.
- No history, no automatic storage: the picture lives in memory (object URL, revoked on discard) until an action. It never goes into diagnostics or error reports and is never sent anywhere.
- Clipboard: `getPlatform().clipboard` has text only; an image method would touch the platform seam (hotspot), so the Web API is used on every platform.

## Platforms
| Platform | `getDisplayMedia` | Tool shows |
|---|---|---|
| Chromium browser / PWA (desktop) | yes | full tool |
| Firefox, Safari desktop | yes (own pickers) | full tool, copy may fall back to "Speichern" |
| Windows app (Tauri, WebView2) | **not verified here** (no Windows hardware in the build chat); WebView2 may refuse with `NotSupportedError` or show no picker | works if it does; otherwise "nicht verfügbar" text (`NotSupportedError` is mapped to it, not to an error) |
| Android app / phone browsers (WebView) | no (`mediaDevices.getDisplayMedia` missing) | friendly "nicht verfügbar" text, no button |

If WebView2 refuses, a Rust capture (e.g. a screenshot crate) would be a **new dependency**: maintainer's decision, parked in `scribble/BOARD.md`. Hand test: [MANUAL-TESTS](../MANUAL-TESTS.md) ("Bildschirmfoto").

## Tests
`logic.test.ts` (support, file name, error classes), `capture.test.ts` (frame → PNG with mocked video/canvas, delay, cancel, copy, share), `Tool.test.tsx`, `e2e/screenshot.spec.ts` (canvas `captureStream` mock on desktop and pixel-7; hint where capture is missing).
