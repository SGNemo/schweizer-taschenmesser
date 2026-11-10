# Contributing

Thanks for helping with Nemo. This is the short version of the rules; the long one is [`CLAUDE.md`](CLAUDE.md), the index of all docs is [`docs/README.md`](docs/README.md), recipes are in [`docs/HOW-TO.md`](docs/HOW-TO.md).

## Branches and pull requests
- Branch from `develop` (`feat/…`, `fix/…`, `docs/…`) and open the PR against `develop`. `main` only receives releases.
- Bring `develop` into your branch with a merge; never rebase shared history.
- One topic per PR. Fill in the PR template.
- **Change note:** add a note in `.changes/` (`npm run change` in `web/`): short, from the user's view, German and English; format in [`docs/howto/changelog.md`](docs/howto/changelog.md). A PR that only touches docs, tests or CI gets the label `no-changelog` instead.
- **Working with Claude Code:** the project is also developed in Claude Code chats, which read [`CLAUDE.md`](CLAUDE.md) automatically; the same rules apply to people. Two workflows you may see in PRs: `council` (independent review by three delegates before a decision PR is handed over) and `full stop` (a chat finishes its work end-to-end and hands over a PR against `develop`, never merging it). You do not need either to contribute.

## Conventions
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope):`, `fix:`, `docs:`); release notes are generated from them.
- **Language:** code, comments, commits and docs in English. User docs and the README also have a German translation (`*.de.md`, `README.de.md`); change both together, `npm run check:readme` (in `web/`) compares them.
- **UI texts:** never hard-code them in components. German source in `web/src/strings.ts`, the English catalog in `web/src/i18n/locales/en/` (German and English are the app languages; es/fr/pt-BR are frozen, [docs/i18n/FROZEN.md](docs/i18n/FROZEN.md)) with the terms of [docs/i18n/GLOSSARY.md](docs/i18n/GLOSSARY.md); `npm run check:i18n` (in `web/`) checks them. Recipe: [docs/howto/i18n.md](docs/howto/i18n.md). Translation fixes are welcome, see [docs/i18n/README.md](docs/i18n/README.md).
- **Design:** tokens and shared components only (`web/src/ui`), see [`docs/howto/design-rules.md`](docs/howto/design-rules.md). No hex colours or one-off radii in module CSS.
- **Never change** internal identifiers (bundle id, package names, storage keys, backup format ids), weaken the release security steps, or commit secrets. `web/src/brand-ids.test.ts` pins the identifiers.
- **New module or tool:** `docs/HOW-TO.md` has step-by-step recipes; `npm run gen:module -- <id> "<Name>"` scaffolds a module.

## Before you push
In `web/` run `npm run check` (format, lint, typecheck) and `npm test`. If you touch the server or the MCP wrapper, run the same there. E2E tests (`npm run e2e`) run in CI and locally with Playwright's Chromium. Screenshots only with made-up data. If you rename a module or change its description, run `npm run gen:modules` (the README, the module list in the user docs and the website list are generated from the registry; `--check` only verifies). README pictures come from `npm run app:screenshots -- --readme` in `site/`.

## Translations
- **Docs:** English is the source. To fix or add a German translation, edit the matching `*.de.md` file and keep headings and links in step with the English file.
- **App interface:** the German source is `web/src/strings.ts`, the English catalog is `web/src/i18n/locales/en/` (`es`, `fr`, `pt-BR` are frozen and not updated, [docs/i18n/FROZEN.md](docs/i18n/FROZEN.md)). To fix a wording, edit the text in the matching file (same key, terms from [docs/i18n/GLOSSARY.md](docs/i18n/GLOSSARY.md)), run `npm run check:i18n` in `web/` and open a PR. Or report it as an issue ("Translation" template): where you saw the text, what it says and what it should say.

## Bugs, ideas, security
Use the issue templates. Security problems go to [`SECURITY.md`](SECURITY.md), not to a public issue. Everyone taking part follows the [Code of conduct](CODE_OF_CONDUCT.md).

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
