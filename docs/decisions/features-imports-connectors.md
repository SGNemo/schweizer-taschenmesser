# Decisions in full – features – imports, AI import API, connectors

Part of [features](features.md). Index of areas: [DECISIONS](../DECISIONS.md).

## Imports & AI import API
- **Preview-before-write for every import:** wizard shows per-row checkboxes, duplicates pre-deselected, invalid rows; nothing is written before confirmation; each import is one undoable batch (`_imports`, ids `imp-<batch>-<n>`). Source: architecture.md "Start data"; commit 14205c5.
- **One import format per collection derived from its Zod schema** (no second hand-kept schema); `scope.ts` is the single filter. Source: commit 4d8b3f1; architecture.md "Data contract".
- **A move from another app is one run:** the sheet gives every part one `groupId`; the run is listed and undone as a whole (`core/importer/runs.ts`), each batch keeps its own undo rules; recognition shows reason, certainty in words and counts before the preview. Source: [features/import-v2.md](../features/import-v2.md).
- **Local AI import API: desktop only, off by default, loopback-only, transport in Rust, meaning in TypeScript.** No bind-address setting, no CORS, Host/Origin checks, hashed tokens with per-module rights, nothing logged. API imports wait as pending batches for user confirmation; changes to existing entries are never pre-ticked or auto-committed; no delete endpoint. Source: commits 4a0b230, 0944e68; architecture.md.
- **MCP wrapper is a thin separate project with no data access, not shipped in release downloads.** Token only sent to 127.0.0.1/localhost, no redirects. Source: commit c4e9b30.

## Connectors & network
- **User brings their own Google OAuth client (Desktop app type); nothing shipped in repo/binary.** OAuth via PKCE + loopback listener; Google login not on Android yet. Source: architecture.md "Connectors"; CLAUDE.md.
- **Gmail scan reads only metadata + snippet, never the body; user confirms each suggestion.** Source: architecture.md.
- **Sync-server proxy `/v1/proxy` is deliberately narrow (SSRF hardening)** – needed by the PWA for ICS/RSS; native app fetches directly. Source: commit 7e93948; architecture.md.
- **Spotify connector (desktop): own Client ID, fixed port 38417; "Läuft gerade" line, ≤ 1 request/30 s while visible.** [spotify.md](../features/spotify.md)
