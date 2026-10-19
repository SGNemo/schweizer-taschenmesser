# feat/shortcut-map – for the next chat:

- The key map lives in `core/keyboard/map.ts` (pure rules) + `prefs.ts` (`tm-shortcuts`). A new F-key action = add it to `FKeyAction`, `FKEY_ACTIONS`, `DEFAULT_FKEYS`, the `switch` in `layout/useShortcuts.ts` (`runFKeyAction`), a label in `strings.keys.ts` (`actions`, 5 languages). A new tool chord = one line in `TOOL_CHORDS` (unique letter, tested).
- `ShortcutContext` got four required members (`toolAvailable`, `openTool`, `fkeys`, `runAction`); the handler reads the map at key time, so a change in Settings applies at once without a re-mount.
- The vault entry view marks itself with `data-shortcut-scope="entry"` (one attribute in `EntryDetail.tsx`); the `T` chord does not arm there because the vault's own `T` copies the code. Other module shortcuts that use a bare `T` need the same attribute.
- `layout/useShortcuts.ts` imports `useTools` (settings scope `tools`): the first render before settings load has no chords, which is fine.
- Open / maybe later: global (system-wide) keys are untouched; a rebindable chord table was left out on purpose (decisions/features.md). F7 only focuses the start button on Heute, it does not start the round.
- `npm run chats:status` still crashes on `origin/alert-autofix-1` (see Parking on the board).
