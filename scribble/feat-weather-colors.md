# feat/weather-colors

Done: weather window clearer and more colourful, meaning only (see `docs/decisions/weather.md`, v3). Pure presentation: `home/WeatherPreview.tsx|css`, `WeatherAir.tsx|css`, `RatingChip` styles; test for the colour hooks in `WeatherLine.test.tsx`.

For the next chat:

- Look at it on the real exe/phone in light and dark: the day-range gradient (blue→amber) and the tinted "now" card are the parts most worth a second pair of eyes (contrast is from the token inks, AA by design but not measured in the sandbox).
- Idea, not done: collapse "Stunde für Stunde" to every 3 hours with a "alle Stunden" toggle if it is still too long.
