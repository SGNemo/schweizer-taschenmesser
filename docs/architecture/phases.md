# Phase plan & status

Part of the architecture notes ([index](../architecture.md)); map of paths: [ARCHITECTURE-MAP](../ARCHITECTURE-MAP.md); decisions: [DECISIONS](../DECISIONS.md).

1. **Foundation** – done: PWA shell, design system, layout, module registry/library, Dexie core (envelope, HLC, repo, outbox), event bus, settings, generator, example module, tests + E2E.
2. **Core modules** – done: `core/recurrence`, ToDo (lists, priority, due date, subtasks), Reminders (recurrence + local notifications), Calendar (month/week/day, aggregates other modules; week/day are agenda lists, no hour grid), Dashboard (drag & drop, hide/show, widgets "Heute & Morgen", "Offene ToDos", "Nächste Erinnerungen"). Core modules are `defaultEnabled`.
3. **Finance, Invoices, Subscriptions** – done: cross-links via bus + service + public read API, calendar/notification contributions, dashboard widgets (`Kontostand`, `Fällige Rechnungen`, `Nächste Abbuchungen`), month overview with charts, accounts/categories/bookings. Core modules: calendar 10, todos 20, reminders 30, finance 40, invoices 50, subscriptions 60 (all `defaultEnabled`).
4. **Sync + backup** – done: self-hosted server (Fastify + SQLite, Docker, token auth), field-level LWW sync with epochs/outbox, optional end-to-end encryption, JSON backup (merge/replace), settings UI + status badge, two-device E2E against the real server.
5. **AI assistant** – done: Query/Intent schema + executor, local German parser (stage 1), full text (minisearch), cache of validated intents, Claude (SDK) and Ollama providers, token accounting, create-with-confirmation, palette UI + settings, unit tests and E2E (stage 1 without network; stage 2 against a mocked Anthropic API).
6. **Extras & polish** – done: Merkliste, eight extra modules (off by default), local-only file storage, optional Web Push through the sync server (VAPID, encrypted payloads), PWA share target + shortcuts, axe-core accessibility E2E. Known limits: Push needs HTTPS and a real push service (not testable headless); vault files are not synced/backed up; no Lighthouse run in CI.
7. **Tauri desktop + portable Windows exe** – done (see [native.md](native.md)).
8. **Android (Tauri Mobile)** – done: builds in CI (unsigned in dry runs); device behaviour unverified.
9. **GitHub Actions, signing, releases, README** – done and verified through CI dry runs (portable Windows exe + Android APK artifacts); signing secrets exist and were verified by a full dry run (signing, `.sig` key match, audits); the first public pre-release is `v0.2.0-beta.1`.
10. **Self-update** – done (see [releases.md](releases.md), "Self-update (Phase 10)"); real update on devices unverified.
11. **Password vault "Accounts"** – done incl. step 11b (OS keystore, biometrics, `FLAG_SECURE`; device behaviour still to be tested by hand), see "Password vault".
12. **Multi-AI providers + router** – done (see [ai.md](ai.md), "Multi-provider AI (Phase 12)").
13. **Extension round (plan: portable Windows exe → start-data wizard + `HelpHint` → connectors (Google, bank CSV) → news module → toolbar → Spotify/Maps/share/launcher)** – steps 1 (portable exe, own update swap, link check), 2 (start-data wizard, importers, `HelpHint`) 3 (connectors: ICS + Google, calendar sync, mail suggestions, bank import, proxy) and 4 (news module, local collections, AI brief) 5 (toolbar, tool library, 14 tools, palette calculator) and 6 (Maps/WhatsApp links, share page, Apps & Links; Spotify and the native Android share target deliberately not built, see above) done; step 7 (docs, full verification, release) follows.

