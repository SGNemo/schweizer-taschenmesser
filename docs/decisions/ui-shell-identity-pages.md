# Decisions – shell – identity v3 per page group

Part of [ui-shell](ui-shell.md). Index of areas: [DECISIONS](../DECISIONS.md).

## Tools identity v3 (2026-11-04, `feat/identity-v3-tools`, package 1 of 3)

- **Panel instead of popover:** the toolbox is a large centred window (`Dialog size="xl"`): list left (search, categories, Alt+1…9), the tool right, opens on the tool used last; under 900 px a full-screen sheet with one pane at a time (the tool first, the list behind the arrow). Chosen over a docked side panel (no base drawer, own focus logic, too narrow for the calculator modes and PDF) and over "both" (double layout upkeep). No change to `ui/Dialog`.
- **Identity in the manifest, not in CSS:** `identity`, `category`, `keywords` are required on every tool and checked (`check:tools`, registry test); hues come from palette v3 and must differ between neighbours. The library cards (`LibraryCard`, a base component the settings chat owns) do not show the hue yet: they need an optional `hue` prop (proposal in the PR).
- **Detached window is web-only for now:** `/tool/:id` without the shell, opened with `window.open` (PWA/browser). A Tauri window needs a platform seam and a capability (hotspots): own package. The tools that hand over to Notes or the vault navigate inside that window (accepted).
- **The old "Notizzettel" tool is not back:** the scratch pad lives in Notes (`modules.md`); the panel only links to it when Notes is on.

## Module identity v3 – household and vault pages (2026-11-04, branch `feat/identity-v3-haushalt-wissen`, package 1 of 3)

- **Content shape per module, module-local only (no tokens, shell or `ui/*` change):** pantry = shelf tiles in the head + label cards (hairline, punched hole, mono amount) with the cart as row action and "restock all" in the toolbar; lists = receipt (open figure + total in the head, slip beside it, paper with dashed top and jagged lower edge); documents = folder tabs as the filter (tab shape replaces `Chips`); passwords = group folder tabs, lock status and auto-lock stay in the head.
- **Empty states with their own motif** are module-local components (`PantryEmpty`, `ListsEmpty`, `VaultEmpty`, `AccountsEmpty`) because `ui/Misc` `EmptyState` always draws the fish. Proposal for the shell chat: an optional `motif?: ReactNode` prop on `EmptyState`.
- **Documents widget shows counts only** (state names + numbers, no title, provider or file name); pinned by `vault.widget.test.tsx`. The passwords widget stays status-only (`exclusion.test.ts`).
- **Pantry widget is `kacheln`** (tile per place with count and state in words, one context line, up to three names): the body now matches the frame variant. Packing widget overrides its frame to `fortschritt`. **Exception to "catalogue base type":** the tile body is built from `WidgetBody` plus module CSS because `TileGrid` has no count/state line; the name rows follow the widget size (2/3/5). Proposal for the shell chat: a count/state variant of `TileGrid` (`scribble/feat-identity-v3-haushalt-wissen.md`).

## Module identity v3 – knowledge pages (2026-11-04, branch `feat/identity-v3-wissen`, package 2 of 3)

- **Notes:** notebooks are coloured **index tabs** (the colour is the tab's fill, name and count are written on it, the chosen tab is a stronger fill); the cards view tints the sheet instead of a coloured top bar; page titles are serif. **Bookmarks:** head figure (open count, biggest kinds), the cards hang on a tinted board, widgets unchanged. **Feeds ("Nachrichten"):** newspaper head (serif via `identity.type`, date + count), the newest feed as a lead card, groups as CSS columns with a hairline; no fetching, no reader, no new network use. **Chat:** speech bubbles with a small corner, `BubbleSignature`, widget shows the latest title as a bubble (never message text). **Browser:** `AddressBarSignature` (host only, never a full address or query), the active tab is a filled chip.
- **Own empty-state motifs** again as module-local components (`NotesEmpty`, `BookmarksEmpty`, `FeedsEmpty`, `ChatEmpty`, `BrowserEmpty`); the `EmptyState` `motif` proposal stands (see package 1).

## Module identity v3 – media and services pages (2026-11-04, branch `feat/identity-v3-medien-dienste`, package 3 of 3)

- **Mail:** `MailEnvelope` (decoration, no mail text or numbers) beside the stamp that carries the unread count; the three columns follow the **page** width (`usePageWidthAtLeast(58)`, window query only as a fallback outside a page container); the open folder is a filled chip, the inset left bar is gone. **Music:** the queue sits beside the list by `@container page (min-width: 56rem)` instead of the 1200 px window query. **Downloads:** the compact head already shows the running figure with the arrow band; only the empty state is new.
- **Own empty-state motifs** again module-local (`MailEmpty`, `MusicEmpty`, `DownloadsEmpty`); with these, every module of the household, vault, knowledge and media/service groups draws its own motif. The `EmptyState` `motif` prop proposal stands.
- **Left for a later pass:** an envelope mark on unread mail rows, and the cover-tone hero of music is unchanged (it already was the cover hero).

## Shared empty-state motif (2026-11-04, `feat/ui-empty-motif`, package A of the shared identity blocks)

- **`EmptyState` takes an optional `motif`** (a 96 × 64 outline drawing, `aria-hidden`, decoration only) and `testId`; without a motif it draws the fish as before, the compact variant (dashboard widgets) always keeps the fish. The twelve module-local copies of identity v3 packages 1–3 are now thin wrappers (`XEmpty` = `EmptyState` + the module's drawing) and their twelve identical CSS files are gone. Habits keeps its own empty state (planning chat's code).

## Shared folder tabs, columns and the masthead id (2026-11-04, `feat/ui-folder-tabs`, package B of the shared identity blocks)

- **`ui/FolderTabs`** is the one tab-shaped filter (a named group of `aria-pressed` buttons; fill, shape and weight carry the state, a tab may bring its own colour as `--tab`, `folder` adds the folder body, `children` are extra controls at the end of the row). Documents, passwords and the notebooks of the notes use it; the three module-local copies are gone. Visible changes, all small: passwords tabs take the module tint instead of a neutral grey, and the "all" and "general" notebook tabs of the notes (no colour of their own) take the module tint, the chosen one the plain surface.
- **`GroupedList columns`** lets the groups flow into newspaper columns (20 rem, hairline between the columns, none above a group); feeds uses it instead of its own CSS.
- **`masthead`** is now a signature id (both lists: `core/modules/types.ts` and `scripts/lib/checkModules.ts`, pinned equal by `registry.test.ts`); feeds uses it. It has no block of its own (the head is `HeroFigure type="serif"` + `identity.type`).

## Tools identity v3, package 2 (2026-11-04, `feat/identity-v3-tools-calc-time`)

- **Shared blocks in `tools/kit.tsx`:** tools may not import each other, so the look of the contents (display, keys with depth, conversion flow, timer ring, cards) lives in one allowed neighbour of `shared.ts` (`isolation.test.ts` knows it). Logic, labels and test ids of the tools are unchanged.
- **The calculator gets a number pad** (digits, the decimal sign of the language, four operations, `ans`) next to the display: until now it could only be typed on. The field keeps its label for screen readers ("Rechnung"); the result is the large line of the display.
- **Ring and leaves are decoration:** the timer ring is `aria-hidden`, the time stays text in `role="timer"`; the date leaves show the dates the result line names (the day count, or the end date) and are hidden from screen readers.

## Tools identity v3, package 3 (2026-11-04, `feat/identity-v3-tools-make-check`)

- **Same blocks, more of them:** nine more tools use `tools/kit.*` (framed preview for QR and screenshots, persona card, section cards for dice and text, stat chips, file cards for PDF, a quiet mono panel for the developer tools). Logic, labels, test ids and the persona field list are unchanged.
- **The persona card is a card, not an ID:** initials in a circle, the name large, the word "Erfunden" in a frame (text, never only colour), the fields below. No new field, the intro and the "not for contracts, banks, authorities" notice stay (negative-list tests untouched).
