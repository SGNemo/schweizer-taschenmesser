# Security policy

## Reporting a vulnerability
Please **do not** open a public issue for security problems. Use GitHub's private vulnerability reporting on this repository ("Security" → "Report a vulnerability"). If that is unavailable, contact the maintainer through the e-mail address on the [GitHub profile](https://github.com/SGNemo). You should get a first answer within a week.

Please include: affected version (Settings → App updates shows it), platform (Windows portable, Android APK, PWA, sync server), steps to reproduce, and what an attacker could gain.

## Scope
- The app (`web/`), the native shells (`web/src-tauri/`), the sync server (`server/`) and the MCP wrapper (`mcp/`).
- Release artifacts: portable Windows executable, Android APK, `latest.json`.

Out of scope: third-party services users connect on their own (AI providers, Google, feed hosts), and problems that require a compromised device.

## What we do
- Releases are built in CI from tags; the updater payload is signed with the project's updater key and verified before installation, the APK is signed with the project keystore. Secrets never live in the repository (gitleaks over the history, artifact audit before publishing).
- Sync end-to-end encryption, the password vault (Argon2id + AES-256-GCM) and the local import API are described in [`docs/architecture.md`](docs/architecture.md) and reviewed in [`docs/security/`](docs/security/).

Supported: the latest stable release. Fixes are released as a new version, not backported.

