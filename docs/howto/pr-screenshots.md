# Pictures for a PR text (and for the weather)

Learned in the weather scenes rounds (#1102–#1116). Pictures go into the PR text only, never into the code branch.

## The weather tool

`web/e2e/screenshots/weather.spec.ts` shoots any weather situation with the network mocked, the clock fixed and the browser in the place's time zone:

```bash
cd web
WEATHER_SCENES='eclipse|aurora' WEATHER_PARTS=head,card SCREENS_DIR=.screens/weather \
  npm run screenshots -- weather.spec.ts --project=plain
node e2e/screenshots/montage.mjs .screens/weather head-1920-light 1920 1 .screens/heads-1920-light.png
node e2e/screenshots/montage.mjs .screens/weather head-412-dark 1300 3 .screens/heads-412-dark.png
```

- **Scenarios** are rows of `SCENARIOS` (instant, place, WMO code, day/night, cloud, gusts, dust, DWD warnings, Kp). The list holds checked dates for full moon, eclipses, meteor nights, rainbow, dust, aurora and official warnings; add a row, or pass one as JSON in `WEATHER_SCENARIO`.
- **Parts:** `head` (head plus what went under it), `card` ("Mond & Himmel"), `air`, `days`, `overview` (switched to „Ausführlich“, so the weather widget is on it), `widget` (the card alone), `page` (full page).
- **Filters:** `SCREENS_VIEWPORTS=1920x1080,412x915`, `SCREENS_SCHEME=light,dark`.

## Pitfalls that cost time

- **Time zone.** Playwright's browser runs in UTC unless the context sets `timezoneId`; `clock.setFixedTime('2027-08-02T11:10:00')` is then 11:10 **UTC**, two hours past a Berlin eclipse. Always write the instant with `Z` and set `timezoneId` (the weather tool does both). The forecast's `current.time` is the place's _local_ time of the same instant.
- **Motion.** Shoot with `reducedMotion: 'reduce'`: the scene moves for 5 s after opening, and a picture taken then lands on a random frame.
- **One Playwright run per checkout.** Two runs at once share `test-results/` and one wipes the other (a stimulus or e2e run dies silently). Shoot before or after the e2e runs, or give one run `--output <other dir>`.
- **Montage.** A page built with `setContent` cannot load `file://` images – they come out as broken icons. `montage.mjs` embeds them as `data:` URLs.
- **First start.** A fresh browser context opens the setup assistant; go through `ready(page, url)` from `e2e/helpers.ts` (it dismisses it and waits for the page), not `page.goto`.
- **Parallel workers** (`--workers=4`) sometimes miss an element on a loaded machine; re-take the missing ones alone (`-g '<id> 1920 dark'`).
- **Hosts.** The cloud sandbox blocks hosts that are not allowed (403 from the proxy). Mocked routes never reach the network, so the tool works without them; a live check of a source needs the host in the environment.

## Getting them into the PR text

1. Lay them out (`montage.mjs`): one picture per viewport and scheme reads better than twenty.
2. Push them to a picture branch with no common history, e.g. `shots/<topic>`: `git init -b shots/<topic>` in an empty folder, add the PNGs, commit, `git push origin shots/<topic>`. Never into the code branch.
3. Link them in the PR text as `https://raw.githubusercontent.com/SGNemo/schweizer-taschenmesser/shots/<topic>/<file>.png`; `<img width="450" src="…">` for phone pictures, two columns in a table for light | dark.
4. Look at every picture before you link it (Read the PNG): a wrong date, an empty montage or a missing event shows at once.
