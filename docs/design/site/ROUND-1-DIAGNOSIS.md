# Round 1 – Diagnosis of the current website and three directions

Base: `develop` 2026-10-06, `site/` built locally, screenshots at 360/768/1280/1920, light and dark.

## Diagnosis (honest)
- **Hierarchy:** Mark, H1, lead, two equal buttons, three facts, version line, checksum link: seven
  elements of similar weight before the eye settles. Nothing is clearly first.
- **Hero claim:** "Eine ruhige Alltags-App, die deine Daten bei dir lässt" is right but abstract;
  "Alltags-App" says nothing concrete. The 10-second test fails on *what it is*: you need the lead
  to learn "Kalender, Aufgaben, Finanzen, Passwörter".
- **Trust:** "Open Source · kostenlos · keine Cloud" is a grey footnote below the buttons. "Kein
  Konto", "kein Server von uns" and "MIT" are only in section 3. Trust should sit next to the
  download, not under it.
- **Download:** Buttons are visible but the two orange blocks compete; on 360 px they are the
  loudest thing on the page and still show no clear "this is the main action" framing. Version
  and size are inside the button (good) and repeated in the line below (noise).
- **Screenshot:** The one image carries a "Dev" badge and the Dev menu (not final UI), is small on
  1280 (half width, 420 px tall) and tiny on 360 px. No phone view although "Android" is a main
  button. Only one screenshot for eight claimed features.
- **Rhythm:** Five sections with the same recipe (eyebrow, H2, grid), separated by hairlines. No
  change of pace, nothing to look at between the hero and the footer. The 1920 px view is a
  narrow column in a lot of grey.
- **Typography:** Inter and tokens are right; H1 at 52 px with 20ch max breaks into three uneven
  lines ("Eine ruhige Alltags- / App, die deine / Daten bei dir lässt"). Hyphenation in the claim.
  Body text is calm and short (keep).
- **Imagery:** Icons only. No sense of the "fish" brand beyond the mark; the social preview shows a
  reef motif the site never uses.
- **Mobile:** Works, nothing breaks, but the page is one long grey column; the feature tiles
  become eight stacked cards before any proof. Touch targets and contrast are fine.
- **Keep:** no JS, local fonts, CSP, theme switch, release data from the API, the calm wording,
  the install accordions, the Ko-fi card.

## Three directions (hero + first section, desktop and phone)
| | A – Ruhig und editorial | B – Produkt-fokussiert | C – Warm mit Riff-Motiv |
|---|---|---|---|
| File | `direction-a.html` | `direction-b.html` | `direction-c.html` |
| Hero | Centred claim in two lines, downloads directly under it, trust line with ticks, one wide screenshot below | Left copy, large screenshot bleeding off the right edge with a phone overlay | Warm wash with faint fish silhouettes, claim with accent on "Und nur bei dir", download card, PC + phone side by side |
| First section | "Warum Nemo" as three numbered statements, no cards | "Was Nemo kann" tiles with mini-screenshots (crops as stand-ins) | "Deine Daten bleiben bei dir" data-flow graphic (PC ↔ own server ↔ phone, cloud AI aside) |
| Strength | Calmest, fastest to read, scales to 1920 | Shows the product first, best for "what is it" | Most distinct, carries the brand, explains privacy visually |
| Risk | Could feel generic without a strong image | Busiest hero; the phone overlay must not clutter 360 px | Wash and silhouettes must stay subtle to pass the focus rules |

**Recommendation:** C for the hero (brand and trust in one picture) with B's mini-screenshot tiles
in "Was Nemo kann". A's numbered "Warum" list is the fallback if C feels too warm.

## Open for the maintainer
1. Direction (A/B/C or a mix).
2. Claim: "Dein Alltag, ohne Cloud. Ruhig sortiert." (A) · "Kalender, Aufgaben, Geld und
   Passwörter. Auf deinem Gerät, nicht in der Cloud." (B) · "Alles Wichtige an einem Ort. Und nur
   bei dir." (C).
3. Both download buttons filled (as now) or Windows filled + Android outlined on desktop?
