# feat/phone-one-hand – for the next chat:
- Every overlay that should answer to Back must be a `ui/Dialog` or `ui/RowMenu` (they call `useBackClose`). A new popover/sheet built by hand does not get a history entry; use `core/shell/useBackClose(open, onBack)` (return `'keep'` if it stays open).
- Editors ask after typing since 2026-10-29: `Dialog askAfterTyping` (notes, ToDo editor, quick add). Other editors (finance, people …) still close without asking; add the prop where wanted.
- `NoticeHost` (one-time notices) has a no-op `onClose`: Back consumes its history entry and the notice stays; only "Verstanden" closes it. Intended.
- A route change while an overlay is open (e.g. a link in the "Mehr" sheet) leaves a marker entry below the new page; `backStack` steps over it on the way back (one visible Back press). Forward over such a marker bounces back: rare, accepted.
- Step counts per path are in `e2e/phone-paths.spec.ts` (`MAX` = before this package). A change that adds a step to one of the ten paths fails there.
- Not done / ideas: a real device check of the Android back gesture (Tauri WebView) and the keyboard on a phone (MANUAL-TESTS), `dirty` for editors, Back inside the setup assistant's own steps (it closes the whole assistant today).
