# feat/screenshot-tool

for the next chat:
- The tool itself was already built by #207 (see BOARD heads-up); this branch only adds the 3 s pause, Share, `NotSupportedError` -> "not available", tests, `docs/features/screenshot.md`, hand test B1-B5.
- Parking: if the Windows app (WebView2) cannot do `getDisplayMedia` (hand test B1), a Rust capture would need a new dependency (Cargo) - maintainer's decision. Not built.
- `getPlatform().clipboard` has no image method; copy uses the Web API. Adding one touches the platform seam hotspot - only if B2 fails in WebView2.
- Shortcut for the tool: tool id `screenshot`, order 170, comes with the shortcut map (`feat/shortcut-map`); nothing added here.
