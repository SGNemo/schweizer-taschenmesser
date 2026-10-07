# Decisions – Nemo

Index. Each area file holds one bullet per decision (**what** – why, with date or release; ≤0.2 = before 0.3.0), plus sources and rejected alternatives; nothing was dropped when the one-line list moved into the area files (2026-10-06). Add a decision as one bullet in its area file; a new area gets a file and a row here. Root rules: [CLAUDE.md](../CLAUDE.md) / [RULES.md](RULES.md); long design notes: [architecture.md](architecture.md).

| Area | File | Covers |
|---|---|---|
| Core: data, sync, AI | [decisions/core.md](decisions/core.md) | local-first, Dexie envelope + `createRepo`, money/dates, module isolation, local-only collections, LWW twice + `contract/`, `SyncAdapter`, E2E encryption, single-tenant server; AI never sees user data, three tiers, Zod-checked intents, provider router, vault/connector exclusion; deterministic seeds |
| Local model, AI writes, chat | [decisions/local-model.md](decisions/local-model.md) | rules → local model → cloud with preview, llama.cpp runtime behind a Cargo feature, models never bundled, chat module invisible to assistant/search/APIs |
| AI off | [decisions/ai-off.md](decisions/ai-off.md) | one reversible master switch, deletes keys and caches, device or account scope |
| Native, distribution, releases, security | [decisions/distribution.md](decisions/distribution.md) | thin Tauri shell, `PlatformService` seam, portable exe + signed self-update, APK signing, bundle id never changes, OS keystore, Conventional Commits, tag or dispatch release, gitleaks + artifact audit, no Authenticode, Dev-Preview app + dev channel |
| Imports, local API, connectors, disk, setup, extension | [decisions/features.md](decisions/features.md) | preview-before-write, one import format per collection, local AI import API, MCP wrapper, Google OAuth, narrow `/v1/proxy`, `manifest.platforms`, disk scan/delete/block list, Tauri permissions, setup assistant, browser extension & vault bridge (native messaging, pairing, origin rule) |
| Modules 0.4–0.7 | [decisions/modules.md](decisions/modules.md) | merged and retired modules, tools, Notizzettel, Dieser PC, LWW-faithful app migrations, Listen, Unterlagen, Personen, Zeit |
| UI, home screen, brand | [decisions/ui-brand.md](decisions/ui-brand.md) | home is not a module + widget per module, `PageContainer` + tokens, Design "Klar" / "Klar 2" tokens, widget types (red only for overdue), licence MIT, name Nemo with unchanged identifiers, `Nemo-*` release assets, logo C12, Android icons |
| Shell and navigation | [decisions/ui-shell.md](decisions/ui-shell.md) | navigation areas, favourites, one "+ Neu", settings categories and registry |
| Shared components | [decisions/ui-components.md](decisions/ui-components.md) | Klar 2 phase 3, `ItemRow`, sheets on phones, undo journal, shortcuts, fluid root size, grid heights and truncation |
| Focus and attention aids | [decisions/focus.md](decisions/focus.md) | one switch per aid, calm wording, notification centre instead of banners, doc budgets |
| Readability | [decisions/readability.md](decisions/readability.md) | reading aid off by default, colour only with meaning, grouped lists, "Ruhig" mode |
| Supporter mode | [decisions/supporter.md](decisions/supporter.md) | cosmetic only, Ed25519 codes verified offline, status derived from the code, Cloudflare Worker issuer |
| Languages | [decisions/language.md](decisions/language.md) | English docs source with German `*.de.md` copies, brand claim per language |
| Website | [decisions/website.md](decisions/website.md) | static `site/` (Astro), Cloudflare Pages from the repo, no tracking, release data at build time, tokens pinned to the app |
| Legal notices | [decisions/legal.md](decisions/legal.md) | placeholders instead of invented details, one-time notices at the place of use, generated + allowlisted licence list |
