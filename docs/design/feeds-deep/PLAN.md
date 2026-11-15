# Feeds – depth and polish (round 2026-11 "Tiefe")

Maintainer ask: "Feeds braucht Beispiele und eine leichtere Möglichkeit, News hinzuzufügen."

## Now
A subscription list only: add by typing a feed address, edit, delete, OPML import (start-data menu) and export. Nemo never fetches a feed; a tap opens the site. Empty state: one sentence and "Feed hinzufügen".

## Goal
- A curated starter catalogue (de + en; news, tech, science, sport, gaming, local), one tap to subscribe, searchable; sources and how they were picked: [SOURCES.md](SOURCES.md).
- The add dialog takes a search word, a feed address or a website address.
- A website address finds its feeds (`<link rel="alternate">`), and every feed shows its latest articles before subscribing.
- Sharing a page from the browser (Android share sheet / PWA share target) offers "Als Feed abonnieren".
- Empty state with three suggestions from the catalogue.
- Network only on a click (preview / discovery); never in the background. Data-flow row `feeds`.

## Packages
1. `feat/feeds-easy-p1` – catalogue + search + one-tap add, empty state with three suggestions, share target → add dialog. No network.
2. `feat/feeds-easy-p2` – website discovery + article preview before subscribing (on click, `fetchPublic`), data-flow row, description text. Builds on p1.

OPML import/export already exists (start-data menu / ⋯ menu); no package needed.
