# Living scenes – inventory and choice (phase 1)

Read from the code on 2026-11-27 (`web/src/modules/*`, `web/src/home/*`, `web/e2e/stimulus-budget.json`); the overview was shot with seed data at 1920 and 412, light and dark (pictures: PR text). Steps: **0** tone only · **1** a small sign that reads the state · **2** a scene. Rules behind every verdict: the ten sentences in [README](README.md).

## 1. The overview today (critique at 1920 and 412)

- **One coloured thing.** In "Ausführlich" with every module on, the page is 4 601 px (1920) and 9 407 px (412) of white cards on grey; the weather card is the only surface with colour. The budget counts 19 coloured elements above the fold (1920) – they are the "Jetzt wichtig" cards, icon plates and dots, not the cards.
- **Every card has the same silhouette.** Head row (plate, title, a grey 20 px mark), then text. The mark is the module's signature, but grey and the same weight on all 35 cards; it identifies nothing at a glance. Rings (habits, disk), bars (budgets, week load) and the clock's tiles are the only shapes, all in one hue each.
- **No orientation by area.** Money cards (Kontostand, Diesen Monat, Rechnungen, Abbuchungen, Budgets) stand between plan and household cards and look like them; colour could say "this is money" before a word is read.
- **Empty halves.** Two-column cards with short content (Heute geschafft, Zeiterfassung, Wochenlast's head, Posteingang) leave their right half blank – room for a picture that costs no height.
- **412:** one column, one or two cards per screen, nine screens of the same card. Nothing marks where one is; the weather card is the only landmark.
- **What is good and stays:** the hierarchy (greeting → "Jetzt wichtig" → agenda → cards), calm text, red only where something is overdue, no borders or shadows (budget: exactly 0), the default view "Ruhig" with one card.
- **Three data-aware blocks exist and are fed nothing:** `Envelope` (fill), `WeekBars` (fill per day), `ArrowBand` (value) in `web/src/ui/identity/blocks.tsx`. Fed today: the calendar's hour strip, the stopwatch, the person ring, the music cover tone.

## 2. Modules: what changes, what a picture could read, step

"Reads" names quantities that exist or derive from the module's own collections; PRIV = an amount, name or subject that no picture may show. Signature = Identity 4.0.

| Module | Changes over a day or week | A picture could read | Signature | Step | Worth it? |
| --- | --- | --- | --- | --- | --- |
| Wetter `weather` | everything | – (built) | `sky` | 2 | the reference; unchanged |
| Gewohnheiten `habits` | done today k of n, fill per goal, rest day | plants: one per goal, bloom = today's state, size = days ever done | `ring` | **2** | yes – **pilot**: daily, personal, the hardest test of "never punish" |
| Planer `planner` (Heute) | the day's things, now, free time | the way through the meadow: stations = today's things, the sun = now | `weekBars` | **2** | yes, but after planner hub 2 (its files) |
| Planer (Wochenlast) | load per day (`BoardDay.planned / usable`) | `WeekBars fill` – the block waits for exactly this | `weekBars` | 1 | yes, cheap |
| Fitness `fitness` | sessions this week k of goal, minutes | the trail up the hill with a flag per session | – | 1 → 2 later | yes as a sign; a scene only after the garden proves itself |
| Musik `music` | playing, cover tone, progress | the stage in the cover's tone (head exists) | `coverTone` | 2 (own stage) | later: needs a connected account to show anything |
| Uhr `clock` | the hour at each place | a sky per place: night, dawn, day, golden hour, dusk; where the sun stands | `dial` | **1** | yes – **pilot**: the picture is the data |
| Kalender `calendar` | appointments today, minutes to next | the leaf with today's date and hour strip (built) | `calendarLeaf` | 1 | built; only moves onto the widget |
| ToDos `todos` | done today, open, due | ticks for what was **done today** – never what is open | `todayCard` | 1 | yes, small |
| Zeiterfassung `timetrack` | timer running, minutes today | the dial: arc = today, a hand while it runs | `stopwatch` | 1 | yes, the dial exists on the page |
| Routinen `routines` | due today, done today, per room | a house: a window lit per room that is done for today | – | 1 | yes |
| Personen `people` | days to the next birthday, birthday today | the ring with a candle on the day | `avatarRing` | 1 | yes: a rare, warm "special" state |
| Budgets `budgets` | spent share per envelope (ratio, not amount) | `Envelope fill` – the block waits for it | `envelope` | 1 | yes, cheap; red only when exceeded, as today |
| Listen `lists` | open items, packing progress, days to a trip | a basket: empty, some, many | `receipt` | 1 | yes, small |
| Vorräte `pantry` | stocked, low, expiring | the shelf with jars by stocked share; expiry stays text | `shelf` | 1 | yes |
| Downloads `downloads` | running, percent | `ArrowBand value` – waits for it | `arrowProgress` | 1 | yes, cheap (desktop) |
| Dieser PC `disk` | load, memory, free space | the gauges (rings are built) | `gauges` | 1 | built; no engine room – an info module |
| Finanzen `finance` | balance, month spent (PRIV amounts) | nothing: a level would show an amount at a glance | `bankCard` | **0** | **pilot** for tone only; the sparkline stays |
| Rechnungen `invoices` | open, due, overdue | nothing new; due badges say it | `bill` | 0 | no picture: deadlines are not a mood |
| Abos `subscriptions` | next charge | nothing new | `cycle` | 0 | no |
| E-Mail `mail` | unread count (PRIV subjects) | nothing: a mailbox that fills is a backlog picture | `stamp` | 0 | no (rule 3) |
| Notizen, Merkliste, Browser, Chat, Feeds | counts that rarely change | nothing that changes daily | – | 0 | no: a picture would be decoration (rule 1) |
| Karten & Orte, Austausch, Gerätestatus, Fernbedienung | status | nothing | – | 0 | no |
| Unterlagen `vault` | deadlines (counts only) | nothing | `folderTab` | 0 | no |
| Passwörter `accounts` | – | **never** anything from its data (rule 9) | `vaultDoor` | 0 | tone of its area only |

## 3. The ideas from the brief – kept, changed, dropped

| Idea | Verdict |
| --- | --- |
| Clock with the real sky of each city | **kept**, as a sign: the sky follows the place's hour (the same rule as the word "Nacht" beside it). The clock stores a zone, no position – so no real sunrise, no weather, no claim where the moon stands |
| Planner: the day as a way, the sun's place | **kept** as a scene, built last (planner hub 2 owns the files) |
| Budgets and balance as levels | **split:** budgets yes (a ratio the bars already show); the balance no – a lake that sinks is drama and shows money to anyone who glances at the screen |
| Pantry as a shelf with its real fill | **kept** as a sign |
| Lists as a basket | **kept** as a sign |
| Routines and habits as a garden that grows and never wilts | **habits kept** (the garden); **routines changed** to the house with lit windows – two gardens on one page would be one picture twice |
| Music with the cover's colour as the stage | **kept**, later (the head already does it) |
| This PC as an engine room | **dropped:** an info module; the rings already read load and space |
| Fitness | **kept** as a sign first |
| Calendar by season | **dropped as its own picture:** the season is part of the shared world (meadow, crowns, snow) and so shows in every scene |
| Mail as a mailbox | **dropped:** a filling mailbox counts a backlog (rule 3) |
| Downloads | **kept** as a sign (the arrow band) |

## 4. What the measurements allow

- **Yardstick:** the weather picture's ceilings ([weather-scenes-2/A11Y §4](../weather-scenes-2/A11Y.md)). A module picture is a crop of the same drawing plus a handful of shapes.
- **The stimulus budget** (`web/e2e/stimulus-budget.json`, `npm run check:stimulus`) gates height, buttons, links, icons (one per `<svg>`), first-screen actions, borders, shadows and coloured elements above the fold (a background counts from a chroma of 0.06). It does **not** gate motion or the number of colours. Overview today: `d1920--home-all` 4 601 px, 174 icons, 19 coloured; `p412--home-all` 9 407 px, 143 icons, 9 coloured; `home-calm` 28 / 4 and 20 / 3.
- So the design is built to cost little there: a picture is one `<svg>` that **replaces** the card's mark; beside the text it adds no height; the tone exists in a strength below the counting threshold. The numbers of both tone strengths: [PILOTS](PILOTS.md).
- The honest part: a page can pass that budget and still be louder. The stop therefore asks for the maintainer's yes with pictures **and** numbers, not only with numbers.
