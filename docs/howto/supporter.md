# How-to: supporter mode (codes, keys, themes)

What it is: voluntary support → a signed code → cosmetic extras only (thank-you badge, colour themes, themed logo). Everything stays free. Design: [architecture/supporter.md](../architecture/supporter.md), why: [decisions/supporter.md](../decisions/supporter.md), checklist for the maintainer: [legal/SUPPORTER-NOTES.md](../legal/SUPPORTER-NOTES.md).

**State:** everything is built: package, CLI, app check, status/sync, themes, badge, settings, and the **webhook service** (`services/supporter-webhook/`, README = deployment guide for the maintainer). The service is **not deployed** until the maintainer does the steps in its README; until then codes can be created by hand (below). The "pay" and "re-send" buttons in the app stay hidden while `pages/settings/supporterLinks.ts` is empty.

## One-time key setup (maintainer, own machine)
1. Needs Node 22.18 or newer. Install both parts (the CLI imports the shared package source): `cd packages/supporter-codes && npm ci`, then `cd ../../tools/supporter-cli && npm ci`.
2. `node bin/supporter-cli.mjs keygen` → writes `~/.nemo-supporter/key-1.txt` (mode 600, refuses paths inside a git checkout and any overwrite) and prints the **public** key. Back the file up (password manager + offline copy). Lost = no new codes with this key id; old codes keep working.
3. `node bin/supporter-cli.mjs set-public-key` → writes the public key into `web/src/core/supporter/publicKeys.ts` (the one place). Commit that file. Until then the app rejects every code.

Key ids 0–254 are for real keys; **255 is the public E2E test key** (only E2E builds trust it, never use it).

## Create a code by hand (fallback, also for yourself)
- Own developer code: `node bin/supporter-cli.mjs create --tier developer --name "Sven"` → paste into Einstellungen → Über Nemo → Supporter on one device; sync spreads it. It is a normal signed code: remove it like any other, create a new one any time.
- Supporter: `create --tier kaffee|kuchen [--name "Ada"] [--date 2026-10-05]`, send the line by mail. `verify CODE` checks one; `batch --tier kaffee --count 20` prints many.
- Names: max 20 characters, sanitised; only with the supporter's consent.

## Rotate the key
`keygen --key-id 2` → `set-public-key --key ~/.nemo-supporter/key-2.txt` (keeps id 1 in the file, so old codes stay valid) → ship the app → switch the service/CLI to the new key. No revocation list exists by design.

## Add a colour theme
1. Add a block to `web/src/ui/supporterThemes.css` (copy one; all 13 tokens as `light-dark(#light, #dark)` pairs, selector `:root[data-palette='id'], [data-palette-preview='id']`).
2. Add the id to `PALETTES` (`core/supporter/palette.ts`), the name to `t.supporter.palette.names` and the id to the regex in `web/index.html`.
3. `npx vitest run src/ui/supporterThemes.test.ts` – fails until WCAG AA holds (text 4.5:1, status badges 4.5:1, borders/focus 3:1).

## Tests
`cd packages/supporter-codes && npm test`, `cd tools/supporter-cli && npm test`, in `web/`: `npx vitest run src/core/supporter src/ui/supporterThemes.test.ts src/pages/settings` and `npx playwright test e2e/supporter.spec.ts e2e/supporter-themes.spec.ts`. The E2E build trusts key id 255 only; `core/seed/devFlag.test.ts` proves the test key and the dev-simulation path are in no normal build.

## Webhook service
Code, tests (`cd services/supporter-webhook && npm test`), local run (`npx wrangler dev`), secrets, deployment, failure table and rotation: [services/supporter-webhook/README.md](../../services/supporter-webhook/README.md). CI job `supporter-webhook` (lint, types, tests, bundle dry run) never deploys.

## Variant B (pre-signed stock) is not used
Decided against (see decisions). If it is ever needed: `batch` creates the stock, the service would only hand codes out.
