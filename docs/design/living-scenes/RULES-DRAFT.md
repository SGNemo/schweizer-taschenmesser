# Living scenes – rules for later (draft of a section for MODULE-IDENTITY.md)

Not in force. The last package moves this text into [MODULE-IDENTITY](../MODULE-IDENTITY.md) as the section "Pictures" and adds one bullet to `docs/decisions/`; until then it is the round's working rule.

## Pictures

**Steps.** Every module has a step (`WidgetDef.picture.step`, none = 0): **0** the day's tone only · **1** a sign or sky tiles that read one datum · **2** a scene: a spot of the weather landscape with the module's things. Info modules (money, mail, documents, system) stay at 0 or 1. `accounts` is 0 for ever and nothing of its data reaches a picture.

**A picture reads data.** Each picture has a variables table (datum → what changes) and a pure function `…Vars()` in its module with a table test per row. A drawing with no variable is decoration and is not built.

**Never (rule 3 of the round):**
- nothing wilts, shrinks, empties, fades or falls because something was not done or time passed;
- no streaks, no counters of days missed, no outline of something "still to fill";
- an open thing is a quiet form of its own (a bud, a plain post), never a gap;
- growth follows totals and only rises;
- no red in any picture; overdue stays text;
- the empty state is a picture as pleasant as the full one.

**Text.** Everything a picture shows also stands as text in the card. Text stands on a picture only on a plain sky (weather head and card, clock tiles) in the sky's ink; scenes stand beside or under the content.

**One world.** Scenes are crops of the weather landscape and use the shared sky; module things take their colours through the scene's light. No second landscape, no other style, own drawings only. Drawings and signs live in `ui/scene`; modules pass numbers and enums, never a string a person wrote.

**Privacy.** A picture tells no more at a glance than the text beside it; no amount, name, title or subject is ever encoded (no level of a balance). Pictures make no request.

**Loudness.** Overview: at most 4 scene cards, the weather included (cockpit 2); on the phone no two in a row; the rest show their sign. The home view "Ruhig" shows none.

**Off switches.** "Bilder: Aus · Dezent · Verspielt" (device), "Bild zeigen" per module; colour mode "Ruhig" and "Modulfarben: Aus" turn pictures grey and the tone off; reduced motion removes the appearing fade.

**Motion.** Nothing moves by itself. A thing that appears because of a tick fades in once (300 ms, opacity).

**Budgets.** Per scene picture ≤ 220 elements and ≤ 64 KB of markup for what its crop shows (the weather's ceilings); a sign ≤ 24 elements; a sky tile ≤ 24. Overview: pictures add no border and no shadow; first paint of the overview with pictures ≤ 1.25 × without, at 4× CPU. `check:stimulus` values rise only in a package's PR with the maintainer's label.

**Checklist for a new picture.**
1. Which datum changes daily or weekly? Write the variables table first.
2. Step 1 or 2 – and why not lower?
3. Draw the empty, little, normal, much and special state; is any sadder than another? Then redraw.
4. What is deliberately not shown (privacy, rule 3)?
5. `…Vars()` with table tests; no string in the spot's vars.
6. Contrast of signs ≥ 3:1 on every tone; text never on a scene.
7. Count elements per state; measure first paint.
8. "Bilder: Aus" shows the card as before; grey in "Ruhig"; nothing moves with reduced motion.
9. FOCUS checklist ([FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md)): what could go instead? (the grey mark goes.)
