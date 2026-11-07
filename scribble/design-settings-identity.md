# design/settings-identity – for the next chat (settings identity v3.1, package 1, PR open)

- Blocks: `pages/settings/components/{SettingsHead,StatusCard}`, `@/ui` `SettingsGroup plain`, `SettingRow hint` (ⓘ). `StateBanner` is the `StatusCard` (tinted in the tab hue via `data-hue` on the category page; a second card on a tab passes `tinted={false}`), `Step` no longer draws its number (`n` is ignored).
- New settings category `einrichtung` (first in "Persönlich", hue fern); section `setup` moved there, `/settings/ueber#setup` follows. E2E that started the assistant from `/settings/ueber` now use `/settings/einrichtung`.
- Shots: `docs/design/settings-v3/tools/shots.spec.ts` (copy into `web/e2e/screenshots/`, seeded preview on :4174) also prints the filled primary buttons per tab.
- Packages 2–3 ready as prompts: `docs/design/settings-v3/PACKAGES.md`.
- Finding (not mine, also on develop 591f365): `e2e/shortcuts.spec.ts` "T then T opens the timer, T then R the calculator" fails on desktop-chrome every run.
