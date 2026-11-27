# Living scenes – words (German, English)

To be taken verbatim. Keys are proposals; German lives in `web/src/strings.ts`, English in `web/src/i18n/locales/en/`. Pictures are `aria-hidden`: every datum a picture shows is text in the card, so there are no long text alternatives – only the lines below.

## 1. Settings (package 1)

| Key | de | en |
| --- | --- | --- |
| `settings.pictures.title` | Bilder | Pictures |
| `settings.pictures.hint` | Karten und Module zeigen ihren Stand auch als Bild: ein Garten für Gewohnheiten, der Himmel je Ort. Texte und Zahlen bleiben immer da. | Cards and modules also show their state as a picture: a garden for habits, the sky for each place. Texts and numbers always stay. |
| `settings.pictures.off` | Aus | Off |
| `settings.pictures.off.hint` | Karten wie bisher, ohne Bilder und Farbton. | Cards as before, without pictures or tone. |
| `settings.pictures.calm` | Dezent | Subtle |
| `settings.pictures.calm.hint` | Farbton der Tageszeit und kleine Zeichen. Keine Szenen. | The time of day's tone and small signs. No scenes. |
| `settings.pictures.playful` | Verspielt | Playful |
| `settings.pictures.playful.hint` | Dazu Szenen wie der Garten – höchstens vier auf der Übersicht. | Plus scenes like the garden – four at most on the overview. |
| `settings.pictures.module` | Bild zeigen | Show picture |
| `settings.pictures.module.hint` | Zeigt das Bild dieses Moduls auf seiner Karte und Seite. | Shows this module's picture on its card and page. |
| `settings.focus.picturesLink` | Bilder und Farbton einstellen | Set pictures and tone |

The middle value is **"Dezent"**, not "Ruhig": the app already has "Ruhig" twice (home view, colour mode); a third one would name three different things alike. The brief's wording "aus · ruhig · verspielt" stays as the idea.

## 2. Cards

| Where | de | en | Rule |
| --- | --- | --- | --- |
| ToDos summary, third part (`todos.widget.doneToday(n)`) | {n} heute erledigt | {n} done today | only when n ≥ 1; joined with " · " |
| Habits summary (unchanged) | {k} von {n} geschafft | {k} of {n} done | names all scheduled goals, also beyond the 12 plants |

No new empty-state text: the empty bed and the still lake stand beside the texts that exist ("Noch keine Gewohnheiten.").

## 3. Clock – the day part follows the sky's four bands (package clock)

| Hour | de | en |
| --- | --- | --- |
| 21–6 | Nacht | Night |
| 6–8 | Morgen | Morning |
| 8–18 | Tag | Day |
| 18–21 | Abend | Evening |

Used where "Tag" / "Nacht" stand today (`t.clock.day`, `t.clock.night`; new `t.clock.morning`, `t.clock.evening`): "Abend · +9 h". "Morgen" as a day part stands before the dot, "morgen" as tomorrow after it ("Morgen · morgen · +8 h" cannot occur: 6–8 o'clock tomorrow reads "Morgen · morgen · +8 h" only in German) – therefore the German day part is **"Früh"** (en "Morning"): "Früh · morgen · +8 h".

## 4. What is never written

No praise from a picture ("Dein Garten blüht!"), no count of days, no "noch 2 bis …", no word about what is missing. Pictures have no captions.
