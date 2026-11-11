# Hard rules – supporter mode, diagnostics, setup assistant

Unabridged text of three hard rules; one line in root [CLAUDE.md](../../CLAUDE.md) points here. Moved word for word from root `CLAUDE.md` on 2026-11-11 (maintainer's decision, [meta/DOCS-DIET-2026-11.md](../meta/DOCS-DIET-2026-11.md) rule change 1). Read before touching `web/src/core/supporter`, `web/src/core/diagnostics`, `web/src/core/setup` or `packages/supporter-codes`. The setup assistant also has a longer entry in [RULES.md](../RULES.md).

- **Supporter mode:** cosmetic only, nothing behind a paywall, no nag; codes Ed25519-signed and checked offline (`packages/supporter-codes`, no network in `core/supporter`); status is derived from the code; the code-issuing service is separate and knows no user data. [docs/howto/supporter.md](../howto/supporter.md)
- **Diagnostics / bug reports:** only on user action, previewed first, never sent by the app; never entries, vault, tokens, keys, server URLs, mails, IPs, user paths (negative-list test in `core/diagnostics`). [docs/howto/bug-reports.md](../howto/bug-reports.md)
- **Setup assistant:** progress device-local (`_meta` `setup.state`), step ids only, never secrets, never appears by itself on an installation with data.
