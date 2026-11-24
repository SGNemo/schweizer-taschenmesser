# Weather scenes – words (German and English, taken literally)

German and English both go into `web/src/strings.weather.ts` / `strings.weatherPage.ts` (these bundles hold the languages inline; es / fr / pt-BR are frozen and not touched). Keys are proposals in the existing bundles (`tx` = `tWeather`, `tp` = `tWeatherPage`); a package may rename a key, never a word. Tone: [FOCUS-WORDING](../FOCUS-WORDING.md) – what is there, no exclamation marks, no superlatives ("Blutmond", "Jahrhundert-Finsternis" are not used). Numbers and dates through `core/i18n/format`; `{…}` are parameters. The picture is `aria-hidden`: every word below is also what a screen reader gets.

## 1. Weather words (package 1a; head, overview line, widget, hour cards and day rows alike)

The word follows the WMO code, not the group of nine, so the word and the picture agree. `codeGroup` and the rating keep their nine groups. Key `tx.conditions.<id>`; `tx.codes` stays until nothing reads it.

| id | WMO | German | English |
| --- | --- | --- | --- |
| `clear` | 0 | klar | clear |
| `mostlyClear` | 1 | überwiegend klar | mostly clear |
| `partly` | 2 | leicht bewölkt | partly cloudy |
| `overcast` | 3 | bedeckt | overcast |
| `fog` | 45 | Nebel | fog |
| `rimeFog` | 48 | Nebel mit Reif | freezing fog |
| `drizzle` | 51, 53, 55 | Nieselregen | drizzle |
| `freezingDrizzle` | 56, 57 | gefrierender Niesel | freezing drizzle |
| `rainLight` | 61 | leichter Regen | light rain |
| `rain` | 63 | Regen | rain |
| `rainHeavy` | 65 | starker Regen | heavy rain |
| `freezingRain` | 66, 67 | gefrierender Regen | freezing rain |
| `snowLight` | 71 | leichter Schneefall | light snow |
| `snow` | 73 | Schneefall | snow |
| `snowHeavy` | 75 | starker Schneefall | heavy snow |
| `snowGrains` | 77 | Schneegriesel | snow grains |
| `showersLight` | 80 | leichte Schauer | light showers |
| `showers` | 81 | Schauer | showers |
| `showersHeavy` | 82 | heftige Schauer | heavy showers |
| `snowShowers` | 85, 86 | Schneeschauer | snow showers |
| `thunder` | 95 | Gewitter | thunderstorm |
| `thunderHail` | 96, 99 | Gewitter mit Hagel | thunderstorm with hail |

A forecast cached before package 1a has no code: the word is the id nearest to its group (`conditionId(undefined, group)`).

Additions the picture needs a word for (appended to the detail line under the temperature, after the weather word, at most one, in this order of priority):

| Key | When | German | English |
| --- | --- | --- | --- |
| `tp.sceneStorm` | wind ≥ 50 or gusts ≥ 70 km/h | Sturmböen | gale-force gusts |
| `tp.sceneWindy` | gusts ≥ 50 km/h or wind ≥ 35 km/h | windig | windy |
| `tp.sceneSnowLies` | snow depth ≥ 1 cm and the weather word is not a snow word | Schnee liegt | snow on the ground |
| `tp.sceneFrost` | temperature ≤ 0°, no snow word and not "Schnee liegt" | Frost | frost |
| `tp.sceneHeat` | temperature ≥ 30° by day | Hitze | heat |

## 2. Chips and the hint (words and icons package 1a; the pill in the head package 1b)

| Key | German | English | Note |
| --- | --- | --- | --- |
| `tp.keyDry` | Kein Regen in Sicht | No rain in sight | word unchanged; icon `umbrella` instead of `sun` |
| `tp.keyUv` | UV {n} | UV {n} | unchanged; shown only between sunrise and sunset |
| `tp.keySunrise` | Sonnenaufgang {time} | Sunrise {time} | third chip at night until package 2 brings the moon chip |
| `tp.warnComputed` | berechnet, keine amtliche Warnung | calculated, not an official warning | suffix inside the hint, once per hint block |
| `tp.warnLabel` | Wetterhinweis | Weather notice | name of the `role="note"`; unchanged |
| `tp.warn.ice({day})` | {day}: gefrierender Regen, es kann glatt sein | {day}: freezing rain, it may be slippery | new hint kind `ice` (a day whose code is 56, 57, 66 or 67) |
| `tp.warnNotifyHelp` | Aus. Nemo meldet Gewitter, Sturm, Starkregen, Glätte, Hitze oder Frost für deinen Hauptort mit einer einzigen Benachrichtigung am Morgen (heute) oder Abend davor (morgen). Es sind eigene Hinweise aus der Vorhersage, keine amtlichen Warnungen. Sie funktioniert nur, solange die App läuft. | Off. Nemo reports thunderstorms, storm, heavy rain, ice, heat or frost for your main place with a single notification in the morning (today) or the evening before (tomorrow). These are own hints from the forecast, not official warnings. It only works while the app is running. | today's text with „Gewitter“ and „Glätte“ added; nothing else changes |

The existing lines `tp.warn.storm|wind|rain|heat|frost` keep their words (German and English as they are). `tp.warnSource` (the sentence under the old bar) is replaced by `tp.warnComputed`. The frost hint's icon becomes `thermometer` (nothing falls), `ice` takes `cloudDrizzle`.

Official warnings: §7 (package 3b).

## 3. Settings (package 1b, moon switch package 2) – both in the shared `weather` scope, shown in Einstellungen → Verbindungen → Wetter

| Key | German | English |
| --- | --- | --- |
| `tp.sceneSetting` | Bild im Wetter-Kopf | Picture in the weather head |
| `tp.sceneSettingHelp` | Zeigt Wetter, Tageszeit und Mond als Bild. Bewegung läuft beim Öffnen fünf Sekunden und kommt dann zur Ruhe. | Shows weather, time of day and moon as a picture. Motion runs for five seconds when you open the page and then comes to rest. |
| `tp.sceneMotion` | Mit Bewegung | With motion |
| `tp.sceneStill` | Standbild | Still picture |
| `tp.scenePlain` | Schlicht (nur Himmel) | Plain (sky only) |
| `tp.skySetting` | Mond und Himmelsereignisse | Moon and sky events |
| `tp.skySettingHelp` | Mondphase, Finsternisse und Sternschnuppen-Nächte. Wird auf diesem Gerät berechnet, ohne Abfrage im Netz. | Moon phase, eclipses and meteor nights. Calculated on this device, without a request to the network. |

## 4. Moon (package 2)

| Key | German | English |
| --- | --- | --- |
| `tx.moon.new` | Neumond | New moon |
| `tx.moon.waxingCrescent` | Zunehmende Sichel | Waxing crescent |
| `tx.moon.firstQuarter` | Zunehmender Halbmond | First quarter |
| `tx.moon.waxingGibbous` | Zunehmender Mond | Waxing gibbous |
| `tx.moon.full` | Vollmond | Full moon |
| `tx.moon.waningGibbous` | Abnehmender Mond | Waning gibbous |
| `tx.moon.lastQuarter` | Abnehmender Halbmond | Last quarter |
| `tx.moon.waningCrescent` | Abnehmende Sichel | Waning crescent |
| `tx.moon.lit({n})` | {n} % beleuchtet | {n} % lit |
| `tp.keyMoon({phase}, {n})` | {phase} · {n} % | {phase} · {n} % |
| `tp.moonTitle` | Mond & Himmel | Moon & sky |
| `tp.moonNextFull({date})` | Vollmond am {date} | Full moon on {date} |
| `tp.moonNextNew({date})` | Neumond am {date} | New moon on {date} |
| `tp.moonFullToday` | Heute ist Vollmond | Full moon today |
| `tp.moonNewToday` | Heute ist Neumond | New moon today |
| `tp.moonRise({time})` | Mondaufgang {time} | Moonrise {time} |
| `tp.moonSet({time})` | Monduntergang {time} | Moonset {time} |
| `tp.moonNoRise` | Der Mond geht heute nicht auf | The moon does not rise today |
| `tp.moonNoSet` | Der Mond geht heute nicht unter | The moon does not set today |
| `tp.moonSuper` | Supermond | Supermoon |
| `tp.moonSuperLine` | Vollmond in Erdnähe: er wirkt etwas größer und heller. | Full moon close to Earth: it looks a little larger and brighter. |
| `tp.moonBlue` | Zweiter Vollmond in diesem Monat | Second full moon this month |
| `tp.moonDayAria({phase})` | Mond: {phase} | Moon: {phase} |
| `tp.asideLabel` | Luft, Mond & Himmel | Air, moon & sky |

„Erstes Viertel“ / „Letztes Viertel“ are not used in German: „Halbmond“ says what one sees. A day row shows glyph + name only (no percent); the hero chip and the moon card show the percent.

## 5. Sky events (package 3)

Dates as `{date}` = weekday short + day + month ("Mo., 2. Aug."), times local `HH:mm`. One event line at a time ([CONCEPT-EVENTS §2](CONCEPT-EVENTS.md)).

| Key | German | English |
| --- | --- | --- |
| `tp.ev.solarPartial` | Partielle Sonnenfinsternis | Partial solar eclipse |
| `tp.ev.solarTotal` | Totale Sonnenfinsternis | Total solar eclipse |
| `tp.ev.solarAnnular` | Ringförmige Sonnenfinsternis | Annular solar eclipse |
| `tp.ev.lunarPartial` | Partielle Mondfinsternis | Partial lunar eclipse |
| `tp.ev.lunarTotal` | Totale Mondfinsternis | Total lunar eclipse |
| `tp.ev.ahead({name}, {date}, {from}, {to})` | {name} am {date} · {from}–{to} | {name} on {date} · {from}–{to} |
| `tp.ev.today({name}, {from}, {to})` | Heute: {name} · {from}–{to} | Today: {name} · {from}–{to} |
| `tp.ev.tonight({name}, {from}, {to})` | Heute Nacht: {name} · {from}–{to} | Tonight: {name} · {from}–{to} |
| `tp.ev.running({name}, {to})` | {name} läuft · bis {to} | {name} in progress · until {to} |
| `tp.ev.peak({time})` | Höhepunkt {time} | Maximum {time} |
| `tp.ev.solarCover({n})` | hier bis {n} % der Sonne bedeckt | up to {n} % of the sun covered here |
| `tp.ev.lunarCover({n})` | bis {n} % im Erdschatten | up to {n} % in Earth's shadow |
| `tp.ev.lunarTotalSpan({from}, {to})` | ganz im Schatten {from}–{to} | fully in shadow {from}–{to} |
| `tp.ev.lunarRed` | Der Mond steht rötlich im Erdschatten. | The moon turns reddish in Earth's shadow. |
| `tp.ev.solarSafety` | Nur mit Sonnenfinsternis-Brille hinsehen, nie mit bloßem Auge oder Sonnenbrille. | Look only through eclipse glasses, never with the naked eye or sunglasses. |
| `tp.ev.risesLate({time})` | Der Mond geht hier erst um {time} auf, den Anfang sieht man nicht. | The moon rises here at {time}, the beginning is not visible. |
| `tp.ev.setsEarly({time})` | Der Mond geht hier um {time} unter, das Ende sieht man nicht. | The moon sets here at {time}, the end is not visible. |
| `tp.ev.sunLow({time})` | Die Sonne geht hier um {time} unter, das Ende sieht man nicht. | The sun sets here at {time}, the end is not visible. |
| `tp.ev.clouds` | Wolken verdecken den Himmel hier wahrscheinlich. | Clouds will probably hide the sky here. |
| `tp.ev.meteors({name})` | Heute Nacht: Sternschnuppen der {name}, am besten nach Mitternacht. | Tonight: {name} meteors, best after midnight. |
| `tp.ev.meteorsEvening({name})` | Heute Nacht: Sternschnuppen der {name}, am besten am späten Abend. | Tonight: {name} meteors, best in the late evening. |
| `tp.ev.moonBright` | Der helle Mond überstrahlt die schwächeren. | The bright moon outshines the fainter ones. |
| `tp.ev.starNight` | Dunkle Nacht ohne Mond: gute Sicht auf die Sterne. | A dark night without a moon: a good view of the stars. |
| `tp.ev.rainbow` | Regenbogen möglich: Regen bei tiefer Sonne. Schau mit der Sonne im Rücken. | A rainbow is possible: rain with a low sun. Look with the sun behind you. |
| `tp.ev.rainbowChip` | Regenbogen möglich | Rainbow possible |
| `tp.ev.dust({n})` | Saharastaub in der Luft ({n} µg/m³): der Himmel wirkt milchig. | Saharan dust in the air ({n} µg/m³): the sky looks milky. |
| `tp.ev.next` | Als Nächstes | Next |
| `tp.ev.solsticeWinter` | Wintersonnenwende: der kürzeste Tag. Ab morgen werden die Tage länger. | Winter solstice: the shortest day. From tomorrow the days get longer. |
| `tp.ev.solsticeSummer` | Sommersonnenwende: der längste Tag. | Summer solstice: the longest day. |
| `tp.ev.equinoxSpring` | Tagundnachtgleiche: astronomischer Frühlingsanfang. | Equinox: the astronomical start of spring. |
| `tp.ev.equinoxAutumn` | Tagundnachtgleiche: astronomischer Herbstanfang. | Equinox: the astronomical start of autumn. |

Meteor shower names (`tp.ev.shower.<id>`, German genitive plural as written / English): Quadrantiden / Quadrantid · Lyriden / Lyrid · Eta-Aquariiden / Eta Aquariid · Perseiden / Perseid · Orioniden / Orionid · Geminiden / Geminid. The chip on a meteor night: „Sternschnuppen: {name}“ / "Meteors: {name}" (`tp.ev.meteorsChip`); the chip on an eclipse day: „{name} {from}–{to}“ with the short names „Sonnenfinsternis“ / "Solar eclipse" and „Mondfinsternis“ / "Lunar eclipse" (`tp.ev.solarShort`, `tp.ev.lunarShort`). `tp.ev.dust` is a row in „Atemwege & Allergie“, not a chip.

South of the equator the solstice and equinox lines swap (June = winter solstice, March = start of autumn).

## 7. Aurora and official warnings (package 3b)

| Key | German | English |
| --- | --- | --- |
| `tp.ev.auroraChip` | Polarlicht möglich | Aurora possible |
| `tp.ev.aurora` | Heute Nacht: Polarlicht möglich | Tonight: an aurora is possible |
| `tp.ev.auroraLine({from}, {to})` | Blick nach Norden, abseits von Licht. Am ehesten zwischen {from} und {to} Uhr. | Look north, away from lights. Most likely between {from} and {to}. |
| `tp.ev.auroraLineSouth({from}, {to})` | Blick nach Süden, abseits von Licht. Am ehesten zwischen {from} und {to} Uhr. | Look south, away from lights. Most likely between {from} and {to}. |
| `tp.ev.auroraSource({kp})` | Quelle: NOAA SWPC, Vorhersage Kp {kp} | Source: NOAA SWPC, forecast Kp {kp} |
| `tp.officialLabel` | Amtliche Warnung | Official warning |
| `tp.official({event})` | Amtliche Warnung: {event} | Official warning: {event} |
| `tp.officialSevere({event})` | Amtliche Unwetterwarnung: {event} | Official severe weather warning: {event} |
| `tp.officialUntil({day}, {time})` | bis {day} {time} | until {day} {time} |
| `tp.officialSource` | Quelle: DWD | Source: DWD |
| `tp.officialMore({n})` | + {n} weitere | + {n} more |
| `tp.officialSetting` | Amtliche Warnungen (Deutschland) | Official warnings (Germany) |
| `tp.officialSettingHelp` | Zeigt Warnungen des Deutschen Wetterdienstes für deinen Ort. Dafür geht die ungefähre Position des Orts an den DWD, nie deine Einträge. | Shows warnings of the German weather service for your place. For this the approximate position of the place goes to the DWD, never your entries. |
| `tx.creditWarnings` | Warnungen: Deutscher Wetterdienst | Warnings: Deutscher Wetterdienst |
| `tx.creditAurora` | Polarlicht-Vorhersage: NOAA SWPC | Aurora forecast: NOAA SWPC |
| `tx.privacy` (replaces today's sentence) | Nur der Ortsname (beim Suchen) und die ungefähre Position des gewählten Orts gehen an open-meteo.com und, für amtliche Warnungen in Deutschland, an den Deutschen Wetterdienst – nie deine Einträge. Die Polarlicht-Vorhersage ist eine allgemeine Datei von NOAA SWPC, dabei wird kein Ort gesendet. Abfrage etwa alle 30 Minuten, solange die Übersicht offen ist. | Only the place name (when searching) and the approximate position of the chosen place go to open-meteo.com and, for official warnings in Germany, to the Deutscher Wetterdienst – never your entries. The aurora forecast is a general file from NOAA SWPC; no place is sent for it. Requested about every 30 minutes while the overview is open. |

With `tp.sceneSettingHelp` of §3 the switch "Mond und Himmelsereignisse" gets one more sentence in its help (`tp.skySettingHelp`, replaces the text of §3): „Mondphase, Finsternisse, Sternschnuppen-Nächte und Polarlicht. Mond und Finsternisse werden auf diesem Gerät berechnet; für Polarlicht wird eine allgemeine Vorhersage-Datei von NOAA SWPC geladen, ohne deinen Ort.“ / "Moon phase, eclipses, meteor nights and aurora. Moon and eclipses are calculated on this device; for the aurora a general forecast file is loaded from NOAA SWPC, without your place."

## 6. Rejected words

| Rejected | Why |
| --- | --- |
| „heiter“ for WMO 1 | wrong at night; „überwiegend klar“ works at any hour |
| „Blutmond“, „Jahrhundert-…“, „spektakulär“ | fake urgency; the line says what is seen |
| „Erstes / Letztes Viertel“ | the picture shows half a moon; „Halbmond“ is the common word |
| „Warnung“ for a computed hint | reserved for the official source (package 3b); the hint says „berechnet, keine amtliche Warnung“ |
| „Regenbogen heute“ | a rainbow cannot be promised; „möglich“ |
| „Schlechte Sicht“ for clouds | says what is missed; „Wolken verdecken den Himmel hier wahrscheinlich.“ states the fact |
