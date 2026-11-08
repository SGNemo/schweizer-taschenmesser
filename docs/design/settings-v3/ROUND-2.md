# Settings identity v3.1 – package 2 (remaining tabs)

Branch `design/settings-identity-2`, prompt in [PACKAGES.md](PACKAGES.md). Same capture as round 1 ([tools/shots.spec.ts](tools/shots.spec.ts)); shots `shots2/{before,after}-<tab>-<w>-<scheme>.jpg` for Allgemein, Darstellung, Barrierefreiheit, Module, Werkzeugkasten, Benachrichtigungen, Sicherheit, Verbindungen, Updates, Entwickler (1920 stored at 960 px, 412; light and dark; seeded preview of `develop` 2026-11-08).

## What changed (blocks only, no content)

| Where | Before | After |
| --- | --- | --- |
| Every settings tab | each group a white card: a stack of 5–8 cards per tab (`before-allgemein-1920-light.jpg`) | groups sit on the page between hairlines, told apart by heading and space (`[data-groups='plain']` on the category page, one rule in `ui/SettingsParts.module.css`); module settings pages keep their cards |
| Benachrichtigungen | state card, then the filled "aktivieren" button below it | button inside the state card (`StateBanner action`) |
| Verbindungen | filled buttons per connector ("Verbinden", "Kalender hinzufügen") and on local API "Neuer Zugang" | secondary; one card per connector, none outranks the others |
| Benachrichtigungen → Push | filled "Push aktivieren" next to the filled notification button | secondary |

## Numbers

| | Before | After |
| --- | --- | --- |
| Filled primaries per tab (1920 light, seeded) | Benachrichtigungen 1, Verbindungen 2 (412: 3), Entwickler 1, rest 0 | Benachrichtigungen 1, Verbindungen 1, Entwickler 1, rest 0 |
| Horizontal overflow at 412 px | 0 in every tab | 0 in every tab |

Verified: settings, a11y (every settings page, light/dark), notifications, connectors, Spotify, local API, share, comfort specs – 378 + 8 passed; settings/ui unit tests 388 passed.

## Left for later

- Benachrichtigungen: the state card's line is three sentences (`t.notifications.intro*`); shortening it is a text change for the notifications owner.
- Ruhe card on Benachrichtigungen repeats "Ruhe" as card title and control label (`GameModeCard`).
