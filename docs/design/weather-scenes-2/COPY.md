# Weather round 2 – words (German and English, taken literally)

German goes into `web/src/strings.weather.ts` (`tx`) / `strings.weatherPage.ts` (`tp`), English into the same keys of `i18n/locales/en/`. Key names are suggestions; where a bundle already has a fitting key, that key wins. Numbers and times through `core/i18n/format`. `{…}` are placeholders. Tone: [FOCUS-WORDING](../FOCUS-WORDING.md) – says what is, no alarm, no "Achtung".

## 1. Weather words that gain a level (`tx.conditions`)

The 22 words of round 1 stay. New: the word says the level the picture shows.

| When | Deutsch | English |
| --- | --- | --- |
| thunder level 1 | leichtes Gewitter | light thunderstorm |
| thunder level 2 | Gewitter | thunderstorm |
| thunder level 3 | starkes Gewitter | severe thunderstorm |
| thunder with hail, level 2 | Gewitter mit Hagel | thunderstorm with hail |
| thunder with hail, level 3 | starkes Gewitter mit Hagel | severe thunderstorm with hail |
| fog level 1 | Nebel | fog |
| fog level 2 | dichter Nebel | dense fog |
| thin high cloud over an otherwise clear sky (cover ≤ 2, veil) | Schleierwolken | thin high cloud |

Detail line additions (at most one, order as in round 1): Sturmböen · windig · Schnee liegt · Frost · Hitze – unchanged.

## 2. Rain in the next two hours (`tp.rainSoon…`)

| Case | Deutsch | English |
| --- | --- | --- |
| section name | Regen in den nächsten zwei Stunden | Rain in the next two hours |
| starts later, ends inside | Regen ab {HH:mm}, etwa {n} Minuten, zusammen etwa {mm} mm | Rain from {HH:mm}, about {n} minutes, about {mm} mm in all |
| starts later, goes on | Regen ab {HH:mm}, hält länger an | Rain from {HH:mm}, continuing |
| raining, ends inside | Regen noch bis etwa {HH:mm} | Rain until about {HH:mm} |
| raining, goes on | Regen, hält in den nächsten zwei Stunden an | Rain, continuing over the next two hours |
| one short burst | Kurzer Schauer gegen {HH:mm} | A short shower around {HH:mm} |
| snow instead of rain | Schnee ab {HH:mm} … (same sentences with "Schnee") | Snow from {HH:mm} … |
| head chip 1 | Regen ab {HH:mm} · Regen bis etwa {HH:mm} · Schauer gegen {HH:mm} | Rain from {HH:mm} · Rain until about {HH:mm} · Shower around {HH:mm} |
| under the bars (three labels, not clock times) | jetzt · +1 h · +2 h | now · +1 h · +2 h |

## 3. Hours (`tp.hour…`)

| Part | Deutsch | English |
| --- | --- | --- |
| group name | Stunde wählen | Choose an hour |
| section title, today / another day | Nächste Stunden / Stunden | Next hours / Hours |
| first card today | Jetzt | Now |
| card, rain line | {p} % · {mm} mm | {p} % · {mm} mm |
| card, snow | {p} % · {cm} cm | {p} % · {cm} cm |
| hour line (parts joined with " · ", each only with a value) | fühlt sich an wie {t}° · Böen {v} km/h aus {dir} · Luftfeuchte {p} % · Taupunkt {t}° · Bewölkung {p} % · {hPa} hPa · UV {n} · Sicht {km} km | feels like {t}° · gusts {v} km/h from the {dir} · humidity {p} % · dew point {t}° · cloud {p} % · {hPa} hPa · UV {n} · visibility {km} km |
| hour line, label for screen readers | Werte um {HH:mm} | Values at {HH:mm} |
| back | Jetzt | Now |
| back, on another day | Ganzer Tag | Whole day |
| no hours cached | Stundenwerte für diesen Tag kommen mit der nächsten Aktualisierung. | Hourly values for this day arrive with the next update. |

## 4. Days (`tp.day…`)

| Part | Deutsch | English |
| --- | --- | --- |
| stepper, group name | Tag | Day |
| stepper label, today | Heute, {Do. 26. Nov.} | Today, {Thu 26 Nov} |
| stepper label, other day | {Freitag, 27. Nov.} | {Friday, 27 Nov} |
| previous (accessible name) | Einen Tag zurück | One day back |
| next (accessible name) | Einen Tag weiter | One day on |
| back to today | Heute | Today |
| days group name | Tag wählen | Choose a day |
| head detail line, a day | {Freitag, 27. November} · {Wort} | {Friday, 27 November} · {word} |
| head detail line, an hour | {Fr.} {14:00} · fühlt sich an wie {t}° · {Wort} | {Fri} {14:00} · feels like {t}° · {word} |
| head, big number of a day (accessible name) | Höchstwert {a}°, Tiefstwert {b}° | High {a}°, low {b}° |
| chip, rain span | Regen {14}–{18} Uhr · {mm} mm | Rain {14}–{18} · {mm} mm |
| chip, no rain that day | Kein Regen | No rain |
| chip, wind of a day | Wind bis {v} km/h, Böen {g} | Wind up to {v} km/h, gusts {g} |
| chip, UV of a day | UV bis {n} | UV up to {n} |
| rest line of a day | {n} Stunden mit Regen · {n} Stunden mit Schnee · Sonnenschein {h} h · Bewölkung {p} % · Sonne {a}–{b} | {n} hours with rain · {n} hours with snow · sunshine {h} h · cloud {p} % · sun {a}–{b} |
| hint of another day (as the product words it today) | {Samstag}: Frost bis {t}° | {Saturday}: frost down to {t}° |
| live region | {Freitag, 27. November}: {Wort}, {a}° / {b}° | {Friday, 27 November}: {word}, {a}° / {b}° |
| live region, hour | {Freitag} {14:00}: {Wort}, {t}° | {Friday} {14:00}: {word}, {t}° |
| air beyond five days | Für diesen Tag liegt noch keine Luftvorhersage vor. | There is no air forecast for this day yet. |

## 5. Curve (`tp.chart…`)

| Part | Deutsch | English |
| --- | --- | --- |
| card title, today | Verlauf der nächsten 24 Stunden | The next 24 hours |
| card title, a day | Verlauf am {Freitag} | {Friday} over the day |
| select label | Anzeigen | Show |
| options | Temperatur und Regen · Wind und Böen · Sonne und Wolken · Luftdruck · UV · Luftqualität | Temperature and rain · Wind and gusts · Sun and cloud · Pressure · UV · Air quality |
| legend | Temperatur · gefühlt · Regenmenge · Regenwahrscheinlichkeit · Wind · Böen · Sonnenschein · Bewölkung · Luftdruck · UV · Luftqualitätsindex | temperature · feels like · rain amount · chance of rain · wind · gusts · sunshine · cloud · pressure · UV · air quality index |
| pressure word | steigt · fällt · gleichbleibend | rising · falling · steady |
| text alternative (one sentence per option) | Temperatur von {a}° bis {b}°, am wärmsten um {HH} Uhr; Regen {…} | Temperature from {a}° to {b}°, warmest at {HH}; rain {…} |

## 6. More values (`tp.more…`)

| Part | Deutsch | English |
| --- | --- | --- |
| disclosure | Mehr Werte | More values |
| groups | Gefühl · Niederschlag · Wind · Himmel · Luftdruck · Gewitterneigung | Feel · Precipitation · Wind · Sky · Pressure · Thunder tendency |
| Gefühl | Gefühlt {t}° · Taupunkt {t}° · Luftfeuchte {p} % | Feels like {t}° · Dew point {t}° · Humidity {p} % |
| dew point word, from 16° / 20° | schwül · drückend | muggy · oppressive |
| Niederschlag | Menge {mm} mm · Stunden mit Regen {n} · Neuschnee {cm} cm · Schneehöhe {cm} cm · Schneefallgrenze etwa {m} m | Amount {mm} mm · Hours with rain {n} · New snow {cm} cm · Snow depth {cm} cm · Snowfall line about {m} m |
| Wind | Mittel {v} km/h · Böen bis {g} km/h · aus {dir} | Mean {v} km/h · Gusts up to {g} km/h · from the {dir} |
| Himmel | Bewölkung {p} % · tief {p} % · mittel {p} % · hoch {p} % · Sonnenschein {h} h von {d} h · Sichtweite {km} km | Cloud {p} % · low {p} % · middle {p} % · high {p} % · Sunshine {h} h of {d} h · Visibility {km} km |
| Luftdruck | {hPa} hPa, {steigt} | {hPa} hPa, {rising} |
| Gewitterneigung | mäßig · hoch | moderate · high |

## 7. Mond & Himmel, first line

| Deutsch | English |
| --- | --- |
| Sonne {07:41}–{16:22} · {8 h 41 min} Tageslicht · Dämmerung {07:06}–{16:57} | Sun {07:41}–{16:22} · {8 h 41 min} of daylight · Twilight {07:06}–{16:57} |

## 8. Settings

No new setting. "Bild im Wetter-Kopf: Mit Bewegung" now covers the one brightening of the glow in a thunderstorm; its hint line gains: „Bei Gewitter leuchtet die Wolke einmal langsam auf." / "In a thunderstorm the cloud brightens once, slowly."

## 9. Change notes (one per package, `.changes/`)

| Package | Deutsch | English |
| --- | --- | --- |
| A | Wetter: Das Bild im Kopf ist neu gezeichnet – kantige Berge, Wald, See und Hütte. Es zeigt jetzt, wie stark Regen, Schnee, Gewitter, Nebel und Wind sind, und der Mond schaut auch bei bedecktem Himmel zwischen den Wolken hervor. | Weather: the picture in the head is redrawn – angular mountains, forest, a lake and a cabin. It now shows how strong rain, snow, thunder, fog and wind are, and the moon looks out between the clouds under an overcast sky too. |
| B | Wetter: mehr Angaben – Regen in den nächsten zwei Stunden, Menge je Stunde, eine Kurve zum Umschalten und „Mehr Werte" mit Taupunkt, Sicht, Schneefallgrenze und Tageslänge. | Weather: more values – rain in the next two hours, the amount per hour, a curve you can switch and "More values" with dew point, visibility, snowfall line and day length. |
| C | Wetter: Tage und Stunden lassen sich wählen. Ein Tipp auf einen Tag zeigt die ganze Seite für diesen Tag, ein Tipp auf eine Stunde ihr Bild. „Heute" ist immer einen Tipp entfernt. | Weather: days and hours can be chosen. A tap on a day shows the whole page for it, a tap on an hour its picture. "Today" is always one tap away. |
| D | Wetter: Das neue Bild erscheint auch in der Wetterzeile und auf der Wetter-Karte der Übersicht. | Weather: the new picture also appears in the weather line and on the weather card of the overview. |
