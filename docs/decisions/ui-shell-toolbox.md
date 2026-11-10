# Decisions – shell – toolbox, palette, phone header

Part of [ui-shell](ui-shell.md). Index of areas: [DECISIONS](../DECISIONS.md).

## Toolbox comfort (2026-10-13, `feat/comfort-toolbox`)

- **Tools answer in the search bar** – optional `ToolManifest.expression` (pure, cheap parse): "timer 10m" starts a countdown, "umrechnen 5 km" lists conversions and Enter copies; only while the tool is on; local, nothing sent. The calculator keeps its own path (`core/calc/phrases.ts`).
- **"Zuletzt benutzt" row above the tiles, the tiles never move** – up to three tools used last (`tm-tools-recent`, device-local, off with "Verlauf in der Suche", emptied by "Verlauf löschen"), shown once more than four tools are on. A grid that reorders itself costs more than it saves.
- **Tool library on the shared `LibraryCard`** with search; "copy result" in the unit converter.
- **Tool order by drag and drop** in Einstellungen → Werkzeuge via the shared `@/ui` `SortableList` (dnd-kit, same sensors and screen-reader texts as the home widgets); the up/down buttons stay as the plain alternative. Keyboard: Space, arrows, Space.
- **Not done:** pinning the popover open (the toolbox is a dialog; a second window needs platform work), detachable/always-on-top tool windows and a background timer on Android (platform; see ROADMAP).

- **Palette key caps are not part of the option name (2026-10-24):** `<Keys decorative>` sets `aria-hidden` inside `role="option"`, so the name is the label only ("Timer", not "Timer T dann T"); the key is not repeated in a hidden text because the `?` sheet lists every key. The voice key sorts among the F-keys there when it is an F-key.

- **Phone header: content before chrome (2026-10-31):** below 900 px `AreaFrame` is one grid line (area label, scrollable tabs ≥ 44 px, actions), the page title is one step smaller (`--text-2xl`), and the topbar folds away on scrolling down > 48 px (transform/opacity, `--dur-fast`) and returns on scrolling up, at the top, on keyboard focus in the bar, or while a palette/dialog/on-screen keyboard is open. With less motion (system or in-app) it stays fixed; no new setting. Pure decision in `core/shell/topbarCollapse.ts`. `pageChrome.advancedInMenu` lets a page with a "⋯" menu take the "Erweitert" switch out of the header; the six pages without a menu keep it next to the title. Dev `SeedBanner` is one dismissible line.
