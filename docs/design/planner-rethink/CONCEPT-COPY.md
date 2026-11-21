# Planner rethink – words (`design:ux-copy`)

Part of [CONCEPT](CONCEPT.md). Rules: [FOCUS-WORDING](../FOCUS-WORDING.md) (no guilt, no growing counter, no exclamation mark), planner vocabulary of [planner-hub/CONCEPT-COPY](../planner-hub/CONCEPT-COPY.md) („Ding“, „frei“ = free time). German is the source (`web/src/strings.ts`), English the catalogue. Lines ≤ 68 characters.

| Where | German | English | Rejected, why |
| --- | --- | --- | --- |
| Lock, state on the row | fest (with a lock icon) | fixed | „gesperrt“ (reads as disabled), „angepinnt“ (jargon), „muss“ (pressure) |
| Lock, toggle name | Fest an diesem Tag | Keep on this day | „Festnageln“ (two words for one thing with „fest“), „Sperren“ |
| Lock, toast | Fest: Mi · Rückgängig / Nicht mehr fest: Mi · Rückgängig | Fixed: Wed / No longer fixed: Wed | „Festgenagelt“; „Gelöst“ (reads as solved) |
| Fixed block (training at 18:00) | 18:00–19:00 (the time alone) | 18:00–19:00 | „fest“ – now means the lock only (R12) |
| Missed, group head | Noch offen von Mo, Di | Still open from Mon, Tue | „Verpasst“ (judges; FOCUS-WORDING bars it in meta), „Überfällig“ (money only), „Liegen geblieben“ |
| Missed, more than three days | Noch offen seit Do, 12. | Still open since Thu 12 | „von früher“ (hides the days he is looking for), a count in the head |
| Missed, hint under the head | Nichts davon ist weg. Du entscheidest, wohin. | Nothing is gone. You decide where it goes. | „Du hast … nicht geschafft“ |
| Missed, row meta | war Mo | was Mon | „seit 2 Tagen“ |
| Missed, actions | Alle auf heute · Verteilen … | All to today · Spread … | „Aufräumen“, „Nachholen“ (duty) |
| Missed, old ones | Vom Tag nehmen | Take off the day | „Aufgeben“ |
| Missed, locked left out | 1 bleibt: fest | 1 stays: fixed | – |
| Moved while locked, toast | Steuer liegt auf Mi · fest · Rückgängig | Steuer is on Wed · fixed · Undo | releasing the lock silently |
| Past day in band and grid | offen | open | a figure („3 offen“) – the amount lives in the group only |
| No day, group head | Noch ohne Tag | No day yet | „Eingang“ (taken by ToDos), „Wartet auf freie Zeit“ (the engine's view), „Backlog“ |
| No day, hint | Nichts davon muss heute sein. | None of it has to be today. | (kept from Kopf leer) |
| Proposal chip | Vorschlag: Do | Suggestion: Thu | „Geplant für“ (it is not) |
| Proposal chip with deadline | Vorschlag: Do · Frist Fr | Suggestion: Thu · due Fri | – |
| Propose the week | Woche vorschlagen | Suggest a week | „Automatisch planen“, „Neu verteilen“ (sounds like it moves what lies) |
| Spread today's rest | Rest verteilen | Spread the rest | (kept) |
| Preview head | Vorschlag – noch ist nichts verschoben. | A suggestion – nothing has moved yet. | – |
| Preview buttons | Übernehmen · Verwerfen | Apply · Discard | (kept) |
| Overbooked day, line | 2 h 10 mehr als planbar | 2 h 10 more than fits | (the wording FOCUS-WORDING already has); „Überbucht“, „Zu viel geplant“ (barred), „Limit erreicht“ |
| Overbooked day, band tile | + 2 h 10 mehr (name: „2 h 10 mehr als planbar“) | + 2 h 10 more | red, „!“, a bare „+ 2 h 10“ (reads as more free time) |
| Entered on a full day, toast | Liegt auf Mo. Jetzt ist mehr geplant als planbar. | On Mon. More is planned now than fits. | „Kein Platz“ |
| Entered on a day kept free | Do ist frei gehalten. Liegt trotzdem dort. | Thu is kept free. It sits there anyway. | „Tag frei“ (clashes with „frei“ = free time, C9) |
| Entered, plain toast | Liegt auf Do · Rückgängig | On Thu · Undo | „Eingeplant: Mi · X jetzt Do“ (no second half is left) |
| Move, dialog hint | Es liegt dann an diesem Tag. Sonst bewegt sich nichts. | It then sits on that day. Nothing else moves. | „… bis du es wieder löst“ |
| Move, other day | Anderer Tag … | Another day … | – |
| Move, keyboard hint (menu) | Verschieben … (M) | Move … (M) | – |
| Split | In Teile aufteilen … | Split into parts … | „Sitzungen“ |
| Setting (was „Automatisch neu planen“) | Neues automatisch vorschlagen | Suggest a day for new things | – |
| Setting, help | Was du im Planer einträgst, liegt auf dem Tag, den du ansiehst. Neues von woanders liegt ohne Tag; mit Frist bekommt es einen Vorschlag. An: auch ohne Frist. Verschoben wird nie von selbst. | What you enter in the planner sits on the day you look at. New things from elsewhere have no day; with a deadline they get a suggestion. On: also without one. Nothing ever moves by itself. | „Neues liegt ohne Tag“ alone (reads as: what I type goes nowhere) |
| Date set in ToDos, chip | In ToDos: Do | In ToDos: Thu | laying it silently |
| Field examples | Zahnarzt Do fest · Steuer 2 Std bis Fr · Do frei halten | – (German parser only) | „Donnerstag frei“ stays understood; „lock“ and a trailing „!“ lock too |
| Week band, paging | Woche davor · Woche danach · Heute | Previous week · Next week · Today | – |
| View switch | Woche · 4 Wochen | Week · 4 weeks | „Monat“ (it is not a calendar month) |
| Change note | Der Plan bleibt jetzt liegen: Dinge wechseln den Tag nur noch, wenn du sie bewegst. | The plan now stays put: things change their day only when you move them. | – |

**Why „fest“ and not „gesperrt“:** the word is already on the screen for exactly this (the maintainer's screenshot), it is the shortest, and a lock icon carries the rest; the clash with timed blocks is removed by showing only their time. **Why not „Verpasst“** although the maintainer says it himself: he uses it about his own days; printed by the app above a list it judges. „Noch offen von Mo, Di“ says the same fact and names the days he is looking for. The internal name stays `missed`.

**Localisation:** the day short names come from `core/i18n/format`; „fest“ maps to one word per language (en „fixed“, never „locked“ next to the vault's lock wording); the lock words of the field are German-only like the rest of the parser.
