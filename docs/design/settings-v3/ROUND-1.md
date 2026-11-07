# Settings identity v3.1 – round 1 (diagnosis, direction, package 1)

Branch `design/settings-identity`. Rules: [MODULE-IDENTITY](../MODULE-IDENTITY.md) (Settings and libraries, Signatures), [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md), [DESIGN-SPEC](../DESIGN-SPEC.md). Shots: seeded e2e preview (`build:e2e-seed`, scale medium, clock 2026-09-29), 1920 × 1080 and 412 × 915, light and dark, full page: `shots/before-<tab>-<w>-<scheme>.jpg`, `shots/after-…` (16 tabs + the assistant). Capture: [tools/shots.spec.ts](tools/shots.spec.ts) (copy into `web/e2e/screenshots/`, preview on :4174). The browser build has no desktop shell, so hotkey and tray rows show only in the mockup and the unit tests.

## Step 1 – diagnosis

| Tab                | Problem                                                                                                                                                   | Evidence                                                            | Rule                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Über Nemo          | **Hierarchy:** "Einrichtung" is a small card between "Auf neue Änderungen hinweisen" and "Supporter", 1.5 screens down; nothing says how far the setup is | `before-ueber-1920-light.jpg` (third block)                         | FOCUS 3 (next step clear); Sven                                                   |
| Über Nemo          | **Primary actions:** two filled buttons ("Einrichtung starten", "Freiwillig unterstützen") plus a filled "Code übernehmen"                                | `before-ueber-*`                                                    | FOCUS 3 (one primary per view)                                                    |
| Über Nemo          | **Card stack:** ten one-colour cards in a row (links, legal ×3, licences, diagnostics)                                                                    | `before-ueber-1920-light.jpg`                                       | MODULE-IDENTITY "Settings": identity colour on plate / tint, not on nothing; Sven |
| Schnellerfassung   | **Repetition:** head card + two fact tiles ("Standardziel", "Tastenkürzel") repeat the fields right below                                                 | `before-schnellerfassung-1920-light.jpg`                            | FOCUS 1 (stimulus), 9 (what can go)                                               |
| Schnellerfassung   | **Repetition:** hotkey recorder and "Standard" button both show "Strg+Alt+N"                                                                              | Windows app (Sven's report; browser shows "nur in der Windows-App") | FOCUS 1                                                                           |
| Schnellerfassung   | **Hierarchy:** numbered steps 1–3 for settings that are not a sequence                                                                                    | `before-schnellerfassung-*`                                         | MODULE-IDENTITY Choices; direction "groups, not numbers"                          |
| Schnellerfassung   | **Switch rows:** long inline explanations after "·" (two lines per switch)                                                                                | `before-schnellerfassung-1920-light.jpg` (Ohne Rückfrage)           | Readability (≤ 68 ch, one line per row)                                           |
| Sync & Backup      | **Primary actions:** "Verbinden" and "Verschlüsselt exportieren" both filled                                                                              | `before-sync-1920-light.jpg`                                        | FOCUS 3                                                                           |
| Sync & Backup      | **Hierarchy:** numbered steps 1–2 twice (Server/Gerät, Sichern/Wiederherstellen)                                                                          | `before-sync-*`                                                     | direction "groups, not numbers"                                                   |
| Sync & Backup, KI  | **Identity:** the state banner is grey; the tab's hue lives only in the head                                                                              | `before-sync-*`, `before-ki-*`                                      | MODULE-IDENTITY: tint of a surface                                                |
| KI                 | **Empty surface:** the "KI-Assistent" card renders empty while its values load                                                                            | `before-ki-1920-light.jpg`                                          | owned by `fix/local-model-clarity` – noted, not touched                           |
| Verbindungen       | **Primary actions:** one filled "Verbinden" per connector, plus share/local-API buttons; very long page                                                   | `before-verbindungen-412-light.jpg`                                 | FOCUS 3 → package 2                                                               |
| Benachrichtigungen | two state banners (notifications, push)                                                                                                                   | `before-benachrichtigungen-*`                                       | "at most one tinted card per tab"                                                 |
| all                | **Reading measure:** content column fine (70 rem cap); no horizontal overflow at 412 in any tab (measured: 0 px)                                          | spec output                                                         | DESIGN-SPEC                                                                       |

Filled primary buttons per tab (visible, measured by the shot spec, 1920 light): before – Sync 2, Über 2, Verbindungen 2, Benachrichtigungen 1, Entwickler 1, the rest 0.

## Step 2 – direction

Fixed by the task: tab head like the tool heads (plate in the hue, title, one line), groups with a heading instead of numbers, space instead of a card stack, at most one tinted status card per tab, rows = title + one line + control with long text behind ⓘ, one filled primary per tab, tokens only.

Two variants differ in one point only (where the state figure sits):

|                      | A – head tall with figure                            | B – head compact, figure in the status card          |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Einrichtung          | `shots/mockup-variant-a-{1280,412}-{light,dark}.jpg` | `shots/mockup-variant-b-{1280,412}-{light,dark}.jpg` |
| Schnellerfassung (B) | –                                                    | `shots/mockup-quick-capture-b-*.jpg`                 |

Mockups: [mockups/](mockups/) (`node ../docs/design/settings-v3/mockups/render.mjs` from `web/`).

**Recommendation: B.** The state already has a home on Sync and KI (the status card), so a head figure would say it twice; B keeps all 16 heads at one height, which is calmer when switching tabs. The figure and the primary action sit together in the tinted card, so "what is the state" and "what do I do" are one glance, also on the phone.

## Step 3 – package 1 (built)

- **Blocks** (`web/src/pages/settings/components/`): `SettingsHead` (the tab head, moved out of `SettingsLayout`, compact), `StatusCard` (the one tinted state card, figure/icon, one action, optional body; `tinted={false}` for further ones). Extended, not copied: `@/ui` `SettingsGroup` `plain` (rows on the page between hairlines), `SettingRow` `hint` (ⓘ, existed), `ConnectParts` `StateBanner` = `StatusCard`, `Step` draws a heading and no number. The category page sets `data-hue`, so the tint follows the tab.
- **Einrichtung tab** first in "Persönlich" (the door for a new installation; reached without scrolling on the phone list), hue fern. Status card with ring, "n von m erledigt", "Als Nächstes: …", the one primary (Einrichtung starten / fortsetzen / Schritte ansehen); "Noch offen" list (next on top, each row opens the assistant at that step); "Checkliste auf der Übersicht anzeigen". Gone from "Über Nemo"; `/settings/ueber#setup` redirects. `core/setup` unchanged.
- **Assistant:** step head on a fern `HeadSurface` (plate, "Schritt n von m", one dot per step as the step signature, progressbar for assistive tech); summary shows `EmptyState` with a full ring as motif when everything is done.
- **Schnellerfassung:** fact tiles and numbers gone; status card "Probier es aus" with a live sample (parser + preview chips, saves nothing, `„p“ → Planer` …); groups Ziel / Tastenkürzel / Im Hintergrund; one key field per hotkey, "Standard: …" only when it differs; one-line sub-lines, long text behind ⓘ.
- **Large tabs** via the blocks only: Sync & KI get the tinted status card and headed groups; Über Nemo sets links, legal ×3 and diagnostics as plain groups. Single primary: Backup "Verschlüsselt exportieren", "Jetzt sichern", supporter "Code übernehmen" and connector "Verbinden" are secondary now.

### Numbers (before → after)

|                                                      | Before                                                                                           | After                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Filled primaries (1920 light)                        | Sync 2, Über 2, Verbindungen 2                                                                   | Sync 1, Über 1, Einrichtung 1, Verbindungen 2 (share/local API, package 2)                                                          |
| Clicks to the next step (desktop, from Settings)     | Über Nemo → scroll ~1 screen → "Einrichtung fortsetzen" → "Fortsetzen bei …" = 3 clicks + scroll | Einrichtung → "Einrichtung fortsetzen" → "Fortsetzen bei …" = 3, no scroll; or Einrichtung → "Öffnen" on the "Als Nächstes" row = 2 |
| Taps to the next step on the phone (settings list)   | scroll to "Über Nemo" → tap → 2 screens scroll → tap → tap = 3 taps + 3 scrolls                  | "Einrichtung" (top of the list) → "Öffnen" = 2 taps, no scroll                                                                      |
| Clicks "Tastenkürzel ändern"                         | Schnellerfassung → recorder → keys = 2 clicks                                                    | same 2 clicks; the second button with the same keys is gone                                                                         |
| Elements on Schnellerfassung above the first control | head card, 2 fact tiles, step number                                                             | one status card with the live sample                                                                                                |
| Horizontal overflow at 412 px                        | 0 in every tab                                                                                   | 0 in every tab                                                                                                                      |

### Decided for Sven (each can be turned back)

1. Variant B (compact head, figure in the status card) – before/after: `before-sync-*` / `after-sync-*`.
2. "Einrichtung" first in "Persönlich", hue fern – `before-index-412-light` / `after-index-412-light`.
3. Steps lose their numbers everywhere they were used (Sync, Backup, Connectors, Schnellerfassung) – `*-sync-*`, `*-verbindungen-*`.
4. Secondary instead of filled: Backup export, "Jetzt sichern", "Code übernehmen", connector "Verbinden" – `*-sync-*`, `*-ueber-*`.
5. Sample sentence stays German in every language (the parser is German-only, as the existing intro says).
