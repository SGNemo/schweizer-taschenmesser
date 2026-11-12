# Knowledge, media, services – what each module owns

Index: [HOW-TO](../HOW-TO.md). Rules: [MODULE-IDENTITY](../design/MODULE-IDENTITY.md). Signatures are local components of each module (decoration, `aria-hidden`, text stays real); they are not in `@/ui/identity` yet (proposal below). **Since package 0b-6a (Identity 4.0)** Notizen, Merkliste, E-Mail, Chat and Feeds draw no signature under the head any more: the mark is the motif of the empty state and of the widget; E-Mail shows the unread count as the head's figure (`mail/components/InboxHead.tsx`), Musik keeps its stage with the views as `Tabs` below it ([decision](../decisions/ui-shell-identity-40-knowledge.md)).

| Module | Signature (in the head via `HeroSlot`) | Where | Settings (module section) |
|---|---|---|---|
| Notizen | note paper with the scratchpad text | `notes/components/NotePaper.tsx` | `view` list/cards, page templates (`notes/templates.ts`) |
| Merkliste | pinboard with the latest titles; cards view | `bookmarks/components/{Pinboard,BookmarkCard}.tsx` | `view`, `sort`, `linkPreview` (off) |
| E-Mail | stamp with the unread count; 3 columns from 1200 px | `mail/components/Stamp.tsx`, `routes/MailPage.tsx` | existing; search history is device-local |
| Browser | tab strip in the hue (CSS), start tiles, tab overview | `browser/routes/BrowserPage.tsx`, `components/TabOverview.tsx` | `tabPreview` (off) |
| Downloads | arrow band with overall progress | `downloads/components/ArrowBand.tsx` | existing |
| Wetter | sky (existing) | `weather/components/PlacesDialog.tsx`, `attention.ts`, `notifications.ts` | `warnNotify` (off) |
| Spotify | cover tone (existing) | `connectors/spotify/browse.ts`, `music/components/AddToPlaylist.tsx`, `music/useShortcuts.ts` | `shortcuts` (on); connection feature `playlistEdit` (off) |

## Page data from the web (link preview, reader, tab pictures)
- `fetchPublic(url, init, timeout, kind)`: `feed` (default), `page` (HTML ≤ 1 MB), `image` (png/jpeg/webp/gif ≤ 512 KB, never SVG). The sync server proxy takes `?kind=` with the same table; address checks are unchanged.
- `core/io/pageMeta.ts` and `core/io/readable.ts` reduce a page to plain data in an inert document; callers render text only. No cookies, no login, no script in or out of a tab.
- Picture of a saved link: `_blobs` key `bookmarks:preview:<id>` (device-local, not synced, not exported, not pruned by the vault).

## Limits worth knowing
- Spotify: the queue can only be appended to; playlist write paths (`/items`, fallback `/tracks`) are untested against a live account (MANUAL-TESTS).
- Downloads: the folder button reveals the most recent job (the platform seam has no "open folder" without a job).
- News stays retired: [features/news-proposal.md](../features/news-proposal.md).

## Proposals (not built here)
Promote `NotePaper`, `Pinboard`, `Stamp`, `ArrowBand` and the tab strip to `@/ui/identity`; weather radar (new host, own notice); a mini player in the header (AppShell hotspot).
