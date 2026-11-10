# Website rethink – raw phase without app pictures

Round after [ROUND-5](ROUND-5.md). Maintainer's brief: new thinking for the site, built with the design skills;
pictures come when the app is finished. Limits unchanged (`site/README.md`): static Astro, no client script but
`theme.js`, strict CSP, colours from `site/src/styles/tokens.css`, de/en, Lighthouse ≥ 95, AA, complete without a
single app picture. The app's identity decision (3.2 or 4.0, `review/ui-audit-2026-11`) is not anticipated: the
site gets a form of its own, module colours appear as dots only.

**State: phases 1 and 2 done, waiting for the maintainer's choice.** Entschieden: open (see "Decided").

## 1 Who comes, with which question

Secondary analysis of existing material, no new study (skills `user-research` for the method, `research-synthesis`
for the output). Sources: `docs/qa/<persona>/REPORT.md` (7 personas, 2026-10-29), `docs/qa/CONSOLIDATED.md`,
`docs/qa/round-5/{a,b,c,d}` (first contact, 2026-11-08).

**Limit of the material:** every persona is invented and was played in scripted browser sessions; nobody real
used the site, no install was performed on a device, the round-5 messages are unsent. The counts below say how
often a theme was *written into* a persona, not how often real people have it. Treat them as hypotheses.

| Observation in the reports | n of 7 | Who |
|---|---|---|
| Read README or website before starting | 4 | Herbert, Lena, Priya, Sofía |
| "No account / no cloud / no tracking" reassured | 3 | Herbert, Lena, Sofía |
| Install warnings sounded risky | 2 (+1 wants to verify himself) | Herbert, Sofía (+Tom) |
| Doubted the app is "for me" | 4 | Herbert (stumbles over "ADHS"), Jonas, Priya, Mia |
| AI unwanted or frightening at first contact | 5 | Lena, Priya, Tom, Herbert, Sofía |
| Named the tools they would have to leave | 5 | Priya (Notion, Todoist, Toggl, Bitwarden), Lena (Google Kalender, Bring!, Keep), Mia (WhatsApp), Sofía, Tom |
| A statement that contradicts the app ended the visit | 3 | Sofía ("ends the visit"), Tom ("ist die App für ihn weg"), Lena |

Not in the material: nobody asks who is behind the project, nobody worries about the price.

Three visitors follow from it:

| Visitor | Question | Understood after ten seconds | Evidence |
|---|---|---|---|
| **The switcher** (Priya, Lena, Mia): has three to five apps for this | "Does it replace them, or is it the fourth?" | What is inside (plan, money, lists, passwords), on PC and phone, and that it is calm | „Solange sie dafür Toggl, Notion oder Todoist weiterführen muss, bleibt Nemo die zweite App.“ |
| **The careful one** (Herbert … Tom): one fears the warning, one wants proof | "Where does my data go, and is this file safe?" | Data stays on the device; what goes online is listed; the file can be checked | „…beruhigen Herbert sofort.“ · „…bis die exe und die APK von ihm selbst geprüft sind“ |
| **The friend with the link** (round 5, A–D): sent by the maintainer, wants the Dev-Preview | "What do I press, and what is normal?" | Which button, that the warning is expected, where the steps are | Draft messages `round-5/*/MESSAGE.md`: SmartScreen, „Aus dieser Quelle zulassen“, Play Protect |

Interpretation (mine, not in the files): trust signals work and contradictions cost more than a missing feature,
so the page says less and says it exactly. "ADHS" as the headline makes four of seven unsure whether they are
meant; as an honest sentence further down it does not.

## 2 The one statement – three candidates

| | Sentence | What falls under the table |
|---|---|---|
| K1 | "Your everyday in one app, and it stays with you." | The focus aids become a paragraph; the claim sounds like many others |
| K2 | "Your data stays on your device – and here is what leaves it anyway." | What the app is for moves to the second screen; the page reads cool |
| K3 | "One thing first: Nemo shows what to do now, the rest waits." | Privacy becomes the second message; a visitor without focus trouble may not feel addressed |

## 3 What today's page gets wrong or leaves arbitrary

Measured on the built page (`npm run screenshots`, 360 and 1280; pictures in the PR text).

1. **It stands on screenshots.** Hero, four scenes and the focus band are app captures; without them a headline
   and a list remain. Every UI round makes it stale.
2. **The standard product page.** Hero with picture, feature tour, three-column data row, comparison table, FAQ
   accordion, each with eyebrow + headline. Nothing in the form says "calm" or "yours"; the wording does.
3. **Order follows the product, not the questions.** The feature tour (about three screens at 1280 and at 360) comes
   before "where is my data" and long before "what do I press"; install is the last section, the page's most used
   answer for the friend with the link.
4. **Seven sections of equal weight.** Every section is a claim; none is the page's centre.
5. **The comparison table argues against "Übliche Apps"** that nobody named; the personas name concrete tools
   and ask whether they can leave them, which the table does not answer.
6. **"Ohne Cloud" is stated, not shown.** The careful visitor gets badges; the exact list of connections exists
   (`docs/user/security.md`) and is one click away from the page.
7. **The catalogue lists preview modules** on the start page ("In Arbeit", 8 names): statements about what is not
   finished.

## 4 New structure

Start page: one statement and the download · one picture slot that explains it · what is inside (six areas, from
`gen:modules`, shipped modules only) · where the data is and what goes online · how it treats you (focus,
with the honest ADHS sentence) · cost and support in two sentences · download again.

Out: comparison table, the four-scene tour, the supporter theme swatches, preview modules, the checksum
`<details>` in the hero (moves to the proof section or `/install`), the ocean hero as a picture carrier.

Own pages in phase 3 (content exists, form is new): `/install` (content unchanged), modules/features, "what goes
online", support, legal (content unchanged).

**Picture slots.** Every picture place is a named slot (`site/src/drafts/Slot.astro`, table
`site/src/drafts/slots.js`): fixed aspect ratio per breakpoint, one alt text. Today a drawing fills it that
stands for itself; later an app picture of the same ratio drops in and nothing moves.

## 5 Three directions (phase 2)

Real pages, noindex, not linked, not in the sitemap: `/_r/a`, `/_r/b`, `/_r/c` (English: `/_r/en/a` …). Source
`site/src/drafts/`, route `site/src/pages/[r]/[...slug].astro`. All three: Lighthouse 100/100/100 (performance,
accessibility, best practices; SEO is low on purpose, noindex), light and dark.

| | A „Brief“ (letter) | B „Nachweis“ (proof) | C „Ein Tag“ (one day) |
|---|---|---|---|
| Statement | K1 | K2 | K3 |
| Type | Newsreader (serif) for everything read, Inter for labels | Inter bold, JetBrains Mono for all that can be checked | Atkinson Hyperlegible Next, 800 for headlines and the times of day |
| Structure | One reading column, headings in the margin | Hero diagram, then the ledger "what goes online" as the centre | A day down a time rail, one scene and one sketch per moment |
| Tone | Tells, whole sentences | States, figures and file names | Shows, short scenes |
| Slots | `a-day` (typeset note), `a-words` (proof sheet of wording) | `b-schema` (data diagram), `b-areas` (six area plates) | `c-now`, `c-morning`, `c-focus`, `c-capture`, `c-money` (sketches) |
| Stands for | Calm and personal; the page itself is the least "app-like" thing | Checkable honesty; answers the careful visitor completely | Shows the product in use; the switcher sees her day |
| Costs | Long to read, nothing to scan; pictures later feel like guests | Cool; jargon may frighten Herbert; the app comes second | Five slots to fill later; privacy is the second message |

### Critique per direction (`design-critique`, worked in before the hand-over)

**A** – 1 The hero picture was a side note next to the headline → equal columns, larger type in the note.
2 "Was drin ist" was the longest and dullest part (six identical blocks) → two columns. 3 Accent overused
(buttons, italic line, every link) → links in text ink; accent only for the second headline line, "Jetzt dran"
and the buttons. Open: no element to scan for a visitor in a hurry.

**B** – 1 Two collisions with global class names broke the area plates and boxed the version line → renamed.
2 The diagram is the argument but was the smallest thing in the hero → equal columns, zone labels inside the
frames. 3 The app came after the checksums → "Was die App ist" moved up; "Prüf es selbst" got one plain
sentence before the terms. Open: the area plates are the weakest picture of the three directions.

**C** – 1 On the phone the hero sketch was cut off → slot `c-now` is 4:5 under 48rem. 2 The sketches floated in
empty stages → they fill the stage, type scales with the slot. 3 Three grey lines under the buttons → the
reassurance ("no account, data stays") moved above the buttons in normal size; the 22:00 moment no longer looks
disabled. Open: the slashed zero of the face in the large times is a matter of taste.

### Copy (`ux-copy`)

All texts de/en in `site/src/drafts/copy.ts`; every claim is one the current page or `docs/user/security.md`
already makes. Rules applied: buttons say what happens ("Für Windows herunterladen"); the install warning is
named before the click ("fragen beim ersten Start nach. Das ist im Moment normal."); every slot's alt text
describes the drawing and ends with "Gezeichnet, kein Bild aus der App."; captions name what comes later. One
claim was corrected on the way: quick capture understands German phrases only, the English page says so.

## 6 Recommendation and questions

Recommendation: **C as the frame, with B's ledger "what goes online" as its privacy section.** C answers the
switcher in the hero, keeps the ADHS sentence honest without making it the headline, and its slots are exactly
the pictures the app can deliver later; B's table is the strongest single piece for the careful visitor.

Questions to the maintainer: direction · statement (K1–K3) · tone (tell / state / show) · what must be on the
start page.

## Decided

Open – filled in after the maintainer's choice (direction, statement, tone, start page content).

## Skills used

`user-research`, `research-synthesis` (§ 1) · `design-critique` (§ 5) · `ux-copy` (§ 5, `copy.ts`). Phase 3:
`design-system`, `accessibility-review`, `design-handoff` (→ `SLOTS.md`). `frontend-design` is not installed in
this session; typography and layout were done without it.
