# Architecture notes – Nemo

Long design notes, split by topic (text moved unchanged from the former single file). Read only the topic you touch. Repo map: [ARCHITECTURE-MAP.md](ARCHITECTURE-MAP.md); decisions: [DECISIONS.md](DECISIONS.md); recipes: [HOW-TO.md](HOW-TO.md).

| Topic file | Sections inside (old section names kept for code comments) |
|---|---|
| [core](architecture/core.md) | Modules, Isolation, Data, Shared building blocks (Phase 2), State, UI, PWA |
| [finance](architecture/finance.md) | Money & finance (Phase 3) |
| [sync-backup](architecture/sync-backup.md) | Sync & backup (Phase 4) |
| [ai](architecture/ai.md) | AI assistant (Phase 5), Multi-provider AI (Phase 12) |
| [ai-write](architecture/ai-write.md) | AI writes (rules → local model → cloud), built-in local model |
| [extras](architecture/extras.md) | Extra modules & polish (Phase 6) |
| [native](architecture/native.md) | Native distribution (Phases 7–10): shell, PlatformService, versioning, Android, closed-app reminders, portable Windows build |
| [releases](architecture/releases.md) | Releases & CI (Phase 9), release security, Self-update (Phase 10) |
| [vault](architecture/vault.md) | Password vault "Accounts" (Phase 11), step 11b keystore/biometrics |
| [browser-extension](architecture/browser-extension.md) | Brave extension, native messaging host, vault bridge (files, data flow) |
| [importer](architecture/importer.md) | Start data & importers (Phase 13 step 2), HelpHint |
| [local-api](architecture/local-api.md) | Data contract & JSON import, **Local AI import API** (Rust transport, app side, batches, MCP wrapper) |
| [connectors](architecture/connectors.md) | Connectors, calendar sync, Gmail scan, proxy, bank import (Phase 13 step 3) |
| [tools-links](architecture/tools-links.md) | Toolbar & tools, maps/WhatsApp/share page/launcher, Spotify (not built) (Phase 13 steps 5–6) |
| [phases](architecture/phases.md) | Phase plan & status (1–13) |

## Dev-Preview (summary)
See [HOW-TO](HOW-TO.md) → "Dev-Preview" and [DECISIONS](DECISIONS.md) (Releases & security). Flow: push to `develop` → `ci.yml` jobs green → job `dev-preview` → `dev-preview.yml` (`secret-scan` → `prepare` → `windows` ‖ `android` → `publish`) → rolling pre-release `dev-preview`.
