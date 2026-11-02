# feat/mail-read – for the next chat (mail packages 2–5)

- Provider seam: `ConnectorDef.mailbox` (`core/mail/types.ts`). Write actions (package 3) extend `MailProvider` with optional `modify/trash/send/drafts`; Gmail scopes come as new connector features `mail-modify` / `mail-send` (the login always re-consents with the combined scope set, no incremental grant).
- Linking (package 2): the module may not import `@/connectors`; use `saveCapture()` from `@/quickCapture/targets` and the parsers in `quickCapture/parser`. `connectors/google/heuristics.ts` (`analyzeMessage`) is only reachable through the connector: expose it as an optional `MailProvider.analyse` or via `core/mail`.
- `useLiveQuery` must stay free of writes: `getDeviceKey()` creates the key on first use (a write) – that crashed the home widgets once (fixed: key fetched lazily, only for sealed rows).
- Finding (not mine): axe `label-content-name-mismatch` on every `GroupedList` toggle ("Heute 2" vs aria-label "Heute einklappen") shows on `/invoices` with seed data too; the a11y e2e does not see it because it runs without data. Mail's seed e2e disables that one rule.
- Demo inbox: rows with account `demo` (seed) appear only while no real account is connected.
- Manual tests: `docs/MANUAL-TESTS.md` "E-Mail lesen" (M1–M8) need a real Google account on Windows.
