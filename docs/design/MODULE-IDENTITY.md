# Module identity v2 – rules for every module

Binding for every module and for new ones. Origin: [identity-v2/](identity-v2/) (diagnosis, concept, mockups of variants A/B/C; **B** was picked). Decisions: [ui-shell](../decisions/ui-shell.md) "Module identity v2". It extends [DESIGN-SPEC](DESIGN-SPEC.md) and [FOCUS-GUIDELINES](FOCUS-GUIDELINES.md); it replaces nothing in them.

## What a module owns, what the shell owns

The shell (`layout/AreaFrame.tsx`, via `router.tsx`) wraps **every** module page in the same frame:

| Zone              | Owner                               | Content                                                                                                                                 |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Notice (optional) | module via `HeroSlot area="notice"` | one hint that outranks the page (weather hint)                                                                                          |
| Head ("hero")     | shell                               | eyebrow (module chip + area), **the page's h1**, the area's tabs, the headline figure or the signature, the gear and "Mit KI eintragen" |
| Toolbar           | module                              | search, filter chips, period, view switch, "Neu", "Erweitert" (`PageHeader` views/children, `Toolbar`)                                  |
| Content           | module                              | lists, grids, charts; master–detail from 1200 px; fills the page width variant                                                          |
| Aside (optional)  | module                              | context: air quality, library, latest bookings; 20–22 rem from 1200 px                                                                  |

- **A module never draws its own head or its own h1.** Use `PageHeader` (title + views + actions) or `PageTitle` (a bare title); both render the h1 into the head. Without a shell (dialogs, tests) they render in place.
- **Widths:** `manifest.layout` (`content` 70 rem, `wide` 100 rem, `full`). A page fills its variant; a module that is narrower than its variant picks a narrower variant instead of leaving empty space.
- **Dialogs only for short tasks** (create, confirm, pick). A module is a page, also when it is small (weather, music).
- **Phone:** full screen; the head is sticky and folds to one line after 96 px of scrolling (`core/shell/heroCollapse.ts`), the bar below stays. The bottom navigation and the sidebar tint themselves in the module hue (below).
- **Slots for the module's own head content** (`@/ui/identity` `HeroSlot`): `notice` (above), `backdrop` (full-bleed decoration behind the head: sky, cover tone), `figure` (under the title: big figure with its context line), `extra` (beside the title: cards, leaf, cover). All decoration is `aria-hidden`; figures are real text.

## The manifest field `identity`

```ts
identity: {
  hue: ModuleHue; hue2?: ModuleHue; widgetType: WidgetType;    // colour + the catalogue type of the main widget
  head: 'figure' | 'cover' | 'compact';                        // hero style
  surface: 'gradient' | 'tint' | 'plain';                      // treatment behind the head, never behind body text
  signature: SignatureId;                                      // the one thing the module is recognised by
  type?: 'sans' | 'thin' | 'mono' | 'serif';                   // typography accent for the head's title and figures only
  shape?: 'soft' | 'round' | 'sharp';                          // card corners 16 / 20 / 10 px
  feedback?: 'tick' | 'pulse' | 'ring' | 'none';               // ≤ 250 ms accent after a confirmed action
}
```

Required: `hue`, `widgetType`, `head`, `surface`, `signature` (`validateManifest`, `npm run check:modules`, registry test: no two modules of one area share a hue). The empty-state motif is the signature in grey (not a separate field). `hue2` colours the second stop of the head gradient and nothing else.

## Tokens (`ui/tokens.css`)

| Token                                                              | Use                                                                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `--mod-<hue>` (10 hues, light + dark)                              | module colour: chip, tab underline, sidebar stripe, chart series, signature. ≥ 3:1 on the surfaces, ≥ 25° from the state colours |
| `--module-color`, `--module-color-2`                               | set by `data-hue` (and `hue2` inline) on the head, a page, a widget, a nav item                                                  |
| `--head-tint-0`, `--head-tint-1`, `--head-gradient`, `--head-flat` | the head's gradient (40 % → 10 % of the hue over `--surface`); widgets use 65 % / 80 % of it                                     |
| `--shape-soft/round/sharp`                                         | card corners per module                                                                                                          |
| `--sky-*`                                                          | the weather sky (day, rain, night)                                                                                               |

**Rules:** text on a tint is always `--text` (AA for every hue, both themes, `tokens.test.ts`); the hue itself only as chip, underline, stripe, icon or figure accent. No body text on a tint. Semantic colours (overdue, warning, done) keep priority and never appear in a head tint. **"Ruhig" colour mode and "Modulfarben: Aus"** set all `--mod-*` to `--text-3` and flatten the tint (12 % / 5 %): head shape and signature stay, so the module is still recognisable without colour. No permanent animation; a signature never moves on its own; `prefers-reduced-motion` and the in-app "less motion" stop everything that moves. Contrast of a dynamic colour (a cover) is checked at run time (`safeTint`).

## Building blocks (`@/ui/identity`)

| Block                                       | Use                                                                                                                 | Parametrised by                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `Sky` + `skyKind`                           | weather head (backdrop) and widget swatch; clear / cloudy / rain / night; night sets its own light ink              | condition group, day/night              |
| `useCoverTone`, `safeTint`, `dominantColor` | colour from the current cover (24 × 24 px canvas, cached per cover, local blobs only); `safeTint` keeps the text AA | cover blob                              |
| `BankCard`                                  | account as a card: balance large, "available" as the context line                                                   | module hue (+ `hue2` for a second card) |
| `Ring`, `ringColor`                         | shares of a whole in steps of the hue; the legend carries the meaning                                               | module hue                              |
| `CalendarLeaf`                              | month strip, big day, weekday                                                                                       | module hue                              |
| `HeroFigure`                                | the big number with label and context line; `thin` / `mono` / `serif`                                               | `identity.type`                         |
| `HeroSlot`                                  | portal into the head's slots                                                                                        | –                                       |

Specified as defaults for the module chats, built when a module needs them (declared in `SIGNATURES`; a signature without a component renders nothing yet): `todayCard`, `receipt` (jagged edge), `cycle`, `envelope`, `shelf`, `avatarRing`, `pin`, `pinboard`, `notePaper`, `bubble`, `addressBar`, `stamp`, `folderTab`, `vaultDoor`, `gauges`, `arrowProgress`. Reserved for future modules: stopwatch digits, suitcase, confetti (very quiet), newspaper head, habit rings.

## The signature per module (default for the module chats)

| Module                  | Hue               | Head    | Signature                          | Type               | Widget shows                                                        |
| ----------------------- | ----------------- | ------- | ---------------------------------- | ------------------ | ------------------------------------------------------------------- |
| Wetter `weather` ✓      | indigo (+ sky)    | cover   | `sky`                              | thin               | sky swatch, temperature, word, rain hint                            |
| Musik `music` ✓         | orchid            | cover   | `coverTone`                        | mono               | cover, title, artist, play/pause/next                               |
| Finanzen ✓              | teal              | figure  | `bankCard` + `ring`                | sans               | first account as a mini card (with several accounts), total balance |
| Kalender ✓              | sky               | compact | `calendarLeaf` (today in the head) | sans               | leaf + today's timeline                                             |
| ToDos                   | moss              | figure  | `todayCard`                        | sans               | focus card                                                          |
| Rechnungen              | ocean             | figure  | `receipt`                          | sans               | open sum + due list                                                 |
| Abos                    | navy              | figure  | `cycle`                            | sans               | next debit                                                          |
| Budgets                 | indigo            | figure  | `envelope`                         | sans               | two bars                                                            |
| Listen                  | orchid            | compact | `receipt` ("Kassenzettel")         | sans               | checklist                                                           |
| Vorräte                 | moss              | compact | `shelf`                            | sans               | count + rows                                                        |
| Personen                | plum              | compact | `avatarRing`                       | sans               | next birthday                                                       |
| Karten & Orte           | ocean             | cover   | `pin`                              | sans               | last place                                                          |
| Merkliste ✓             | indigo            | compact | `pinboard`                         | sans               | tiles                                                               |
| Notizen ✓               | violet            | compact | `notePaper`                        | serif              | scratchpad                                                          |
| Chat · Browser · E-Mail | sky · navy · teal | compact | `bubble` · `addressBar` · `stamp`  | sans · mono · sans | last answer · tabs · unread                                         |
| Unterlagen · Passwörter | plum · slate      | compact | `folderTab` · `vaultDoor`          | sans · mono        | expiring · status only (never entries)                              |
| Dieser PC · Downloads ✓ | slate · navy      | figure  | `gauges` · `arrowProgress`         | mono               | rings · progress                                                    |

✓ = built (identity v2 package; Merkliste, Notizen, E-Mail `stamp`, Browser `addressBar` as tab strip and Downloads `arrowProgress` as module-local components, see [howto/knowledge-modules.md](../howto/knowledge-modules.md)); the others keep the v1 look inside the new frame until their module chat adds the signature (head, tint, chip and h1 placement already come from the shell).

## Widgets

A widget keeps its catalogue base type. Identity v2 adds: a head band tinted in the hue (weaker than the module head), the icon on a chip, the signature in small where the module has one; **only what matters today** (the module page shows the rest). Urgency stays in the card (stripes, badges), the band never signals state.

## Checklist for a new or converted module

1. Manifest `identity` complete; the hue is free in the area; `head`/`signature` match the table above.
2. The page uses `PageHeader`/`PageTitle`, no own h1, no own head; the layout variant fills its width; no dialog for the module itself.
3. Signature: a block from `@/ui/identity` through `HeroSlot` (or none yet); it is decoration, numbers stay text, it works without colour.
4. Text on any tint is `--text`; a dynamic colour goes through `safeTint`; check light and dark and "Ruhig".
5. Widget: base type, only today, empty state with one next step, one context line per number.
6. Seeds and onboarding as before; e2e: the module frame carries `data-hue`; axe in both themes.
7. Focus checklist ([FOCUS-GUIDELINES](FOCUS-GUIDELINES.md)): no streak, no guilt text, no permanent motion, an off switch (the colour modes) – and name what became redundant.
