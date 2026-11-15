# Planner hub – texts of the redesign (chat E)

Part of [CONCEPT-DESIGN](CONCEPT-DESIGN.md). Skill `design:ux-copy`; checked against [FOCUS-WORDING](../FOCUS-WORDING.md) and the text rules of [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md): no guilt, no growing counters, no exclamation marks, buttons are verbs, one sentence where possible. Link texts come unchanged from [CONCEPT-SOURCES](CONCEPT-SOURCES.md) §3.5. „Exists“ = already in `web/src/strings.ts` under `planner`.

**Voice.** The person is overloaded and opens the page to see what is next. Tone: plain, short, friendly; a number is a fact, never a verdict. One word for a plan thing: „Ding“ (en „thing“).

## Recommended copy

| Where | German | English | Note |
| --- | --- | --- | --- |
| Head figure, today has things | 1 h 20 frei | 1 h 20 free | replaces „… frei heute“; the context line says the day |
| Head context | heute · 3 Dinge | today · 3 things | |
| Head context, next day | morgen, Mo. 16. · heute ist frei | tomorrow, Mon 16 · today is free | phone: only the first half |
| Head figure, day full | Für heute ist genug geplant. | Enough is planned for today. | exists |
| Head figure, over | 40 Min mehr als planbar | 40 min more than fits | exists; not „zu viel“ (a verdict) |
| Head, only late money | Heute ist frei. · Frist vorbei: 6 Rechnungen | Today is free. · Deadline passed: 6 invoices | figure · context |
| Head notice, evening | Bald ist Tagesende. | The day is ending soon. | exists; notice slot, not the figure |
| Field label | Eintragen oder sagen | Add or tell | exists |
| Field placeholder | Was steht an? | What is coming up? | replaces the two examples in the placeholder |
| Example chips, lead-in | Zum Beispiel | For example | |
| Example chips | Steuer 2 Std bis Do · Donnerstag frei · schieb Saugen auf Mi | Taxes 2 h by Thu · Thursday off · move vacuuming to Wed | one entry, one day sentence, one move; a chip fills the field |
| Field button | Eintragen | Add | exists |
| Phone plus | Ding · name „Ding eintragen“ | Thing · name “Add thing” | `PageAction` short; name contains the text (WCAG 2.5.3) |
| Band tile | Mo 16. · 9 Dinge · 37 Min frei | Mon 16 · 9 things · 37 min free | day off: „frei“ / “off”; over: „40 Min mehr“ / “40 min over” |
| Day title | Heute · Sonntag, 15. November / Morgen · Montag, 16. November | Today · Sunday, 15 November / Tomorrow · Monday, 16 November | later days: the date alone |
| Day capacity | 37 Min frei von 3 h 12 | 37 min free of 3 h 12 | exists |
| Capacity link | Warum? | Why? | opens one line |
| Capacity line | Bis 21:00 geplant. Abgezogen: Teamrunde 1 h, Training 1 h, Pause 30 Min. | Planned until 21:00. Taken off: team meeting 1 h, workout 1 h, break 30 min. | P80 |
| Group heads | Zuerst · Danach · 5 | First · Then · 5 | no „wichtig“, no „Rest“ |
| Fold | 22 weitere | 22 more | |
| Phone fold | Danach · 5 Dinge | Then · 5 things | |
| Overbooked line | Der Tag hat mehr Dinge als Zeit. Rest verteilen | The day holds more things than time. Spread the rest | neutral; the link is the step |
| Sheet foot | Rest verteilen · Tage einteilen | Spread the rest · Set up days | exist |
| Source words | ToDo · Rechnung · Liste · Training · Abo · Routine · Termin | To-do · Invoice · List · Workout · Subscription · Routine · Appointment | always beside the icon |
| Block meta | 18:00–19:00 · fest | 18:00–19:00 · fixed | never „verpasst“ |
| Row detail, dunning | Mahnung · 92,40 € bis 20.11. | Reminder · €92.40 by 20 Nov | L6 |
| Late words | Frist war So | Deadline was Sun | exists; chores too – never „überfällig“ |
| Lead actions | Erledigt · Bezahlt … · Zur Liste · Kündigen … | Done · Paid … · Go to list · Cancel … | „…“ = a step follows in the source |
| Lead names | Erledigt: Wohnung saugen · Bezahlt …: Stadtwerke Musterstadt, 92,40 € bis 20.11. | Done: vacuum the flat · Paid …: Stadtwerke Musterstadt, €92.40 by 20 Nov | accessible names |
| Row menu | Verschieben … · Später · Dauer … · Mehr | Move … · Later · Duration … · More | „Verschieben …“ shows day chips |
| Move toast | Wohnung saugen · jetzt Mi · Rückgängig | Vacuum the flat · now Wed · Undo | |
| Chips | Aus Mail · Zur Mail · Zur Mahnung · Zur Rechnung · Im Plan · Di | From a mail · Go to mail · Go to reminder · Go to invoice · In plan · Tue | §3.5 |
| Chip, dunning origin | Mahnung aus Mail vom 3. Nov. | Reminder from mail of 3 Nov | invoice page and ⋯ „Verknüpft“ |
| Chip states | Gibt es nicht mehr. · Entfernen / Nicht auf diesem Gerät. · Im Browser öffnen | No longer exists. · Remove / Not on this device. · Open in browser | §3.5 |
| More links | Verknüpft · 3 | Linked · 3 | ⋯ entry when one chip line is not enough |
| Late group head | Frist vorbei · 6 Rechnungen · 573,59 € | Deadline passed · 6 invoices · €573.59 | a sum, not a day counter |
| Late group line | Liegt auf keinem Tag. Bezahlt ist bezahlt – wann, entscheidest du. | Sits on no day. Paid is paid – when is up to you. | alternatives below |
| Late row meta | Rechnung · 84,00 € · Frist war So | Invoice · €84.00 · deadline was Sun | |
| Late fold (phone) | Frist vorbei · 6 Rechnungen | Deadline passed · 6 invoices | |
| Waiting group | Wartet auf freie Zeit · 16 · Nichts davon muss heute sein. | Waiting for free time · 16 · None of it has to happen today. | exists |
| Context heads | Termine · Nächste Fristen | Appointments · Next deadlines | |
| Weather hint | Mo: Regen ab 16 Uhr | Mon: rain from 4 pm | text only, no advice |
| Empty, nothing yet | Noch nichts geplant. Eine Sache reicht. | Nothing planned yet. One thing is enough. | exists |
| Empty, next step | Schreib oben, was ansteht – oder tippe ein Beispiel an. | Write above what is coming up – or tap an example. | phone: „Tippe auf das Plus.“ / “Tap the plus.” |
| Empty day | Für diesen Tag ist nichts geplant. | Nothing is planned for this day. | |
| Day off | Heute ist frei. Der nächste Tag mit Dingen ist Montag. | Today is free. The next day with things is Monday. | |
| Only late | Die Woche ist leer. Offen sind nur die Rechnungen unter „Frist vorbei“. | The week is empty. Only the invoices under “Deadline passed” are open. | |
| All done | Alles erledigt. Zeit für etwas Schönes. | All done. Time for something nice. | exists in FOCUS-WORDING |
| Field error | Das habe ich nicht gespeichert. Dein Text steht noch im Feld. | That was not saved. Your text is still in the field. | new state (design-system audit) |

## Alternatives

| Element | Option | Tone | Best for |
| --- | --- | --- | --- |
| Late group line | **Liegt auf keinem Tag. Bezahlt ist bezahlt – wann, entscheidest du.** | calm, explains the place | recommended |
| | Wartet noch. Nichts davon ist auf einen Tag gelegt. | closest to „Wartet noch“ | if „Bezahlt ist bezahlt“ reads flippant |
| | (no line) | shortest | once the group is known |
| Head, next day | **37 Min frei** + „morgen, Mo. 16. · heute ist frei“ | a number | recommended |
| | Morgen wird es eng. | a sentence | reads as a warning – not chosen |
| | Heute ist frei. | today only | the complaint P01 |
| Group heads | **Zuerst · Danach** | order, no weight | recommended |
| | Wichtig · Rest | ranking | judges the rest – not chosen |

## Rationale

The head figure is a number of the day that asks for something, so it can never read „frei“ beside nine things. The late group says where the rows went („auf keinem Tag“) and leaves the when to the person; red is one icon, the rows carry words. Lead actions end in „…“ exactly when a step follows in the source. Example chips teach the three sentence kinds the field already understands (T6).

## Localization notes

„Ding“ → “thing” (not “task”: invoices and blocks are no tasks). „Frist war So“ needs the weekday short form from `core/i18n/format`, never a fixed locale. „Mahnung“ is “reminder” in the invoice sense (CONCEPT-SOURCES uses it), not “dunning”. Amounts and dates through the formatters; German texts grow ~20 % against English in the tiles – the tile shows free time and count on two lines for that reason. es/fr/pt-BR are frozen.
