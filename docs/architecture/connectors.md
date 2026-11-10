# Connectors, calendar sync, bank import (Phase 13 step 3)

Part of the architecture notes ([index](../architecture.md)); map of paths: [ARCHITECTURE-MAP](../ARCHITECTURE-MAP.md); decisions: [DECISIONS](../DECISIONS.md).

**Connectors, calendar sync, bank import (Phase 13, step 3)** – `web/src/core/connectors/` (framework), `web/src/connectors/<id>/` (one folder per service), `server/src/proxy.ts`.

- [connectors-framework](connectors-framework.md) – isolation, `ConnectorDef`, state & secrets, several accounts, OAuth
- [connectors-calendar-bank](connectors-calendar-bank.md) – calendar sync, Gmail scan, proxy `GET /v1/proxy`, bank statements
- [connectors-mail](connectors-mail.md) – mail module: read-only side, create from a mail, write side, new-mail notifications, local model reads mail
- **Not built / limits:** Google login on Android (needs its own authorization plugin), two-way calendar sync, Sparkasse FinTS/PSD2, new-mail notifications while the app is closed (they would need the text on a server or an OS alarm), IMAP; HTML mail composing (plain text only); a mail → subscription/contract/birthday target (the heuristics know them, the menu does not offer them).
