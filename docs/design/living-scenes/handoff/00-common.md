# Handoff – common to every package

Read first: [README](../README.md) (the ten sentences), [RULES-DRAFT](../RULES-DRAFT.md), [CONCEPT-KIT](../CONCEPT-KIT.md), [COPY](../COPY.md), [A11Y](../A11Y.md). The mockup is the specification: **port it shape by shape, do not redesign.** Pictures of the mockups: `PR=1 node docs/design/living-scenes/mockups/render.mjs` → `web/.screens/living-scenes/`.

## Measures

| What | Value |
| --- | --- |
| Scene on a card of ≥ 2 columns | the right 44 % of the card, flush with its top, right and bottom edge, clipped by the card's radius; content in the left 56 % with the card's padding |
| Scene on a one-column card, phone | a strip 112 px high, flush with the card's left, right and bottom edge, under the content (card padding above it) |
| Scene on a module page | panel 340 × 250 (card radius) beside the first block at ≥ 1100 px content width; strip 120 px, full width, above it below that |
| Crop | `viewFor(spot, box)` in `mockups/world.js`: width = the spot's `span`, height = span × box h / box w (≤ 320), foot at the landscape's foot; `preserveAspectRatio="xMaxYMax slice"` |
| Sign | 32 × 32 px at the end of the card head (where the 20 px mark is), one hue |
| Sky tile | the tile's whole background; body in the right 40 %; text in the sky's ink |
| Tone | `color-mix(in srgb, var(--tone) 12 %, var(--surface-raised))` light; dark step and inks: [A11Y §1](../A11Y.md) |
| Appearing fade | 300 ms, opacity 0 → 1, on the new shape only; none with reduced motion |
| Tone change | 600 ms `background-color`; none with reduced motion |

## Tokens (hotspot `web/src/ui/tokens.css`: announce on the board first)

- Day tones `--tone-day | golden | dusk | night | overcast | rain | snow` = the mockup's values (`mockups/mock.css`, taken from the weather palette's skies), `--tone` chosen by `[data-sky-tone]`.
- `--text-3-on-tone` (light, dark): [A11Y §1](../A11Y.md).
- Module things: the block `P` and `FLOWERS` at the top of `mockups/world.js` become `--scene-<name>` tokens with `--scene-grey-<name>` twins (as the weather's; a missing grey draws black – `draw.test.ts` checks).
- No hex outside `tokens.css`; colours pass through the scene's light (`lit`) exactly as in the mockup (`X.C.lit(colour, k)` – keep each `k`).

## Every package proves

1. **Variables as table tests:** each row of the module page's table is a case of the pure `…Vars()` function (datum → vars) and of the spot's `layer()` (vars → which parts are drawn: assert on `data-part` counts).
2. **Rule 3:** a test walks the state space (nothing done … all done, old data, a long pause) and asserts that no part count falls when only time passes, and that no part exists for an open thing beyond its quiet form.
3. **Contrast** per state as [A11Y](../A11Y.md) names it (signs ≥ 3:1 on every tone; clock text on every band).
4. **Cost:** elements and bytes per picture under the ceilings ([A11Y §4](../A11Y.md)), counted in a test.
5. **Off:** "Bilder: Aus" renders the card exactly as before the package (snapshot of the old DOM for the card); colour mode "Ruhig" → greys; `prefers-reduced-motion` → no fade.
6. **No string in a picture:** the spot's `Vars` type has no string field; `accounts` has no `picture` (`exclusion.test.ts`).
7. `npm run check`, `npm test`, `npm run e2e`, `npm run check:stimulus` inside the frame the maintainer released (tone 12 %: the coloured-above-the-fold rise is named in the PR and waits for the `stimulus-raise` label).
8. Pictures only in the PR text (branch `shots/<topic>`), invented data.

## Not in any package

New motion beyond the fade · sounds · pictures in notifications · a picture for `accounts` · network requests · area tints · changing the weather's look.
