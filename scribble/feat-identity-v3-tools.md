# feat/identity-v3-tools – for the next chat

- Package 1 (this PR): contract (`identity`, `category`, `keywords`, `check:tools`), toolbox panel (`layout/tools/*`), detached window route `/tool/:id`, tests. Tool *contents* are unchanged.
- Package 2 (`feat/identity-v3-tools-calc-time`): calc display/keys/tabs, units + currency flow, timer ring, date leaf, time zones. Package 3 (`feat/identity-v3-tools-make-check`): QR preview, persona card ("erfunden"), dice, text, image, PDF, screenshot, dev/diff/regex in mono. Build them inside `ToolStage` (it draws head and surface; the tool draws content only).
- Open for others: (1) `LibraryCard` needs an optional `hue` (settings chat); (2) Notes could open the scratch pad on a `?scratch=1` param (the panel links to plain `/notes` today); (3) a Tauri window for "Lösen" needs a platform seam + capability (`core/platform/*`, `desktop.json`), not started.
- Handy: `e2e/helpers.ts` `openToolbox(page)` / `pickTool(page, name)` open the panel (phone: back to the list first).
