# Contributing

Thanks for helping with Nemo. Short version of the rules; the long one is [`CLAUDE.md`](CLAUDE.md) and [`docs/HOW-TO.md`](docs/HOW-TO.md).

- **Branches and PRs:** branch from `develop`, open the PR against `develop` (`main` only receives releases). Merge `develop` into your branch, never rebase shared history.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope):`, `fix:`, `docs:`); release notes are generated from them. Code, comments and commits in English; UI texts in German (`web/src/strings.ts`).
- **Before you push:** in `web/` run `npm run lint`, `npm run typecheck`, `npm test`; touch the server or MCP wrapper → the same there. E2E (`npm run e2e`) runs in CI and locally with Playwright's Chromium.
- **Design:** tokens and shared components only (`web/src/ui`), see the design guidelines in `CLAUDE.md`. No hex colours or one-off radii in module CSS.
- **Never change** internal identifiers (bundle id, package names, storage keys, backup format ids), weaken the release security steps, or commit secrets. `web/src/brand-ids.test.ts` pins the identifiers.
- **New module or tool:** `docs/HOW-TO.md` has step-by-step recipes; `npm run gen:module -- <id> "<Name>"` scaffolds a module.
- **Bugs and ideas:** use the issue templates. Security problems go to [`SECURITY.md`](SECURITY.md), not to a public issue.

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
