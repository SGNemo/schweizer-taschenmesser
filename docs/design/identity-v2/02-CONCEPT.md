# Identity v2 – round 2: concept and variants (2026-11-03, branch `feat/module-shell-identity`)

Decisions from round 1: colour strength **b** (tinted head with a gradient, content neutral); modules as **full pages**
in the content area (weather and Spotify become modules with route, manifest, identity; widgets show only today's
essentials); sidebar: active entry and icon in the module hue plus a thin stripe at the sidebar edge, on Android the
head carries the colour; references: Nothing weather (large thin numerals, air), Spotify (colour from the cover),
Apple Weather/Wallet, Things 3. Mockups: [`mockups/`](mockups/) (`*.html?v=A|B|C&theme=light|dark&device=desktop|mobile`,
contact sheets `*--desktop-light.png`, `*--desktop-dark.png`, `*--phone.png`; render with `node mockups/render.cjs`).

## 1. Module frame (`ModuleShell`, one component for every module)

Zones, top to bottom, always in this order; a module fills what it uses and never adds a head of its own:

| Zone | Content | Rules |
|---|---|---|
| **Notice** (optional) | warnings that outrank the page (weather warning, sync conflict) | semantic colour, one line, dismissable |
| **Hero** (module head) | eyebrow (area · module, icon chip), title, area tabs, headline figure or signature, 1 primary + ghost actions, place/account chips | tinted gradient in the module hue (`--tint-0 → --tint-1`), never behind body text; three styles `figure`, `cover`, `compact` |
| **Toolbar** | search, filter chips, period, segmented view switch, "Neu", "Mehr Felder" | one row, wraps on phones, sticky under the top bar when the content scrolls |
| **Content** | the module's lists, grids, charts | fills width and height (`flex: 1`); master–detail from 1200 px as today |
| **Aside** (optional) | context: allergy/air, library/queue, latest bookings, agenda | 22 rem column from 1200 px; below that a tab or sheet |

Width variants stay `content` (70 rem), `wide` (100 rem), `full`, but every page fills its variant: the frame is a flex
column, content stretches, and a module that is narrower than its variant chooses a narrower variant instead of
leaving space (Listen, Vorräte → `wide` two-column; Budgets → `content`). Dialogs stay for short tasks only
(create, confirm, pick). Phone: full screen, hero with a top stripe in the hue, **collapses on scroll** to one line
(name · headline figure · one fact; mockup `wetter--phone-head-collapse.png`), bottom nav highlights the area.
Cockpit: unchanged, the panel renders the same frame.

## 2. Identity v2 (manifest `identity`, extends v1)

```ts
identity: {
  hue: ModuleHue;            // primary, from the extended palette (light + dark, contrast-checked)
  hue2?: ModuleHue;          // secondary for the head gradient and the second chart series (default derived)
  widgetType: WidgetType;    // v1, unchanged
  head: 'figure' | 'cover' | 'compact';     // hero style
  surface: 'gradient' | 'tint' | 'plain';   // background treatment behind the head (never behind body text)
  signature: SignatureId;    // the one thing the module is recognised by (section 3)
  type?: 'sans' | 'thin' | 'mono' | 'serif'; // typography accent for figures/titles only
  shape?: 'soft' | 'round' | 'sharp';        // card corners: 16 / 20 / 10 px
  empty: EmptyMotif;         // empty-state motif (signature in grey)
  feedback?: 'tick' | 'pulse' | 'ring' | 'none'; // ≤ 250 ms accent on a confirmed action, off with reduced motion
}
```

Rules: `check:modules` enforces every field, contrast of the hue on `--bg`, `--surface` and the tinted head (≥ 4.5:1
for text in the hue, ≥ 3:1 for UI), ≥ 25° hue distance from danger/warning/success/accent, and no shared hue inside
one area. The "Ruhig" colour mode and "Modulfarben: Aus" reduce every hue to `--text-3`; the head keeps its shape and
signature in grey, so the module stays recognisable without colour. Semantic colours (overdue, warning, done) keep
priority and never appear in a head tint.

Palette extension (round 3): `lagoon` (weather sky base), `sand`, `rose`, `lime` as new hues with dark/light pairs,
each ≥ 25° from the state colours; in the mockups weather uses `indigo` and music `orchid` as stand-ins.

## 3. Signature building blocks (`@/ui/identity`)

Built in round 3 (needed by the three example modules or the Übersicht): **Sky** (gradient by condition and time of
day, sun/moon, cloud; weather page + widget), **CoverTone** (dominant colour from the current cover, cached per
image id, head and widget tint; Spotify), **BankCard** (card look with large balance, available, last digits; finance
hero + widget), **Ring** (conic categories/progress; finance categories, later disk, habits), **CalendarLeaf** (month
tab + day number; calendar hero + widget), **HeroFigure** (large numeral with unit and context line; every `figure`
head). Specified as a default for the module chats, built when a module needs them: **Receipt** (jagged edge;
Rechnungen, Einkauf as "Kassenzettel"), **Cycle** (ring with the next debit; Abos), **Envelope** (budget envelopes;
Budgets), **TodayCard** (focus card; ToDos), **Pin** (map pin + contour; Karten & Orte), **AvatarRing** (initials;
Personen), **NotePaper** (ruled paper edge; Notizen), **Pinboard** (tiles with pins; Merkliste), **Shelf** (shelf line +
label; Vorräte), **VaultDoor** (lock status ring; Passwörter), **FolderTab** (folder tabs; Unterlagen), **Stamp**
(envelope + stamp; E-Mail), **Gauges** (rings; Dieser PC), **ArrowProgress** (Downloads), **Bubble** (Chat),
**AddressBar** (Browser). Reserved for future modules: Stopwatch digits (Zeiterfassung), Suitcase (Packlisten),
Confetti accent (Geburtstage), Newspaper head (Nachrichten), Habit rings.

## 4. Signature per module (default for the module chats)

| Module | Hue | Head | Signature | Type | Widget shows |
|---|---|---|---|---|---|
| Wetter (new) | lagoon | cover (Sky) | Sky | thin | sky, temperature, next rain |
| Musik / Spotify (new) | orchid | cover (CoverTone) | CoverTone | mono (times) | cover, title, play/pause |
| Finanzen | teal | figure | BankCard + Ring | sans | mini card, month delta |
| Kalender | sky | compact | CalendarLeaf | sans | leaf + 3 entries |
| ToDos | moss | figure | TodayCard | sans | focus card |
| Rechnungen | ocean | figure | Receipt | sans | open sum + 3 due |
| Abos | navy | figure | Cycle | sans | next debit |
| Budgets | indigo | figure | Envelope | sans | 2 bars |
| Listen | orchid | compact | Receipt (Kassenzettel) | sans | checklist |
| Vorräte | moss | compact | Shelf | sans | count + 3 rows |
| Personen | plum | compact | AvatarRing | sans | next birthday |
| Karten & Orte | ocean | cover (map) | Pin | sans | last place |
| Merkliste | indigo | compact | Pinboard | sans | tiles |
| Notizen | violet | compact | NotePaper | serif (titles) | scratchpad |
| Chat | sky | compact | Bubble | sans | last answer |
| Browser | navy | compact | AddressBar | mono | tabs |
| E-Mail | teal | compact | Stamp | sans | unread |
| Unterlagen | plum | compact | FolderTab | sans | expiring |
| Passwörter | slate | compact | VaultDoor | mono | status only (rule) |
| Dieser PC | slate | figure | Gauges | mono | rings |
| Downloads | navy | figure | ArrowProgress | mono | progress |

## 5. The three variants (all within "b")

| | A · dezent | B · ausgeprägt | C · dazwischen |
|---|---|---|---|
| Head tint | 16 % → 3 %, one hue | 46 % → 10 %, two hues, diagonal | 30 % → 6 %, one hue |
| Signature | small emblem (56 px swatch, 72 px cover, mini card) | fills the head (sky as background, 168 px cover with its colour in the head, two real bank cards, 96 px leaf) | medium (sky at 55 %, 120 px cover, one card) |
| Figures | 2.25 rem / 700 | 3.75 rem / 800, weather thin 300, mono for times | 3 rem / 750 |
| Corners | 16 px everywhere | per module (`shape`) | 16 px |
| Widgets | chip + edge + small mark (as v1) | tinted head band with the signature in small, no edge | chip + tinted band |
| Sidebar | 2 px stripe | 4 px stripe + active item marker | 3 px stripe |

Recommendation: **B**, with two guards from A: body text never on a tint, and the "Ruhig" mode renders B like A in
grey. B is the only variant where the Übersicht reads as a set of different apps at a glance (sheet
`uebersicht--desktop-light.png`); C is the fallback if B feels loud on a 2560 screen after a week of use.

**Picked (2026-11-03): B** with the two guards; round 3 implements it.

## 6. Decisions to record (superseding v1 "Module identity", 2026-11-02)

- Tinted head bands and per-module signatures are **in**; the v1 chip and edge stay as the fallback for the "Ruhig"
  mode and for modules not yet converted.
- Weather and music are modules (`weather` in Planen, `music` in Wissen), not features of the Übersicht; the overview
  line and the dialog go away, the widgets open the module page.
- Every module page is a `ModuleShell`; a module may not render its own h1/head.
