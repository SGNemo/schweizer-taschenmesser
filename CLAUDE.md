# CLAUDE.md – Taschenmesser

Modular, local-first everyday PWA ("Swiss army knife"): Windows desktop (Chrome/Edge) + Android Chrome, installed as PWA.
Data lives in IndexedDB; sync is a separate optional layer; an AI search answers questions with as few tokens as possible.
Code, comments and commits are **English**; the UI is **German only** (all texts in `web/src/strings.ts`).

Deep design notes live in [`docs/architecture.md`](docs/architecture.md) (unchanged text; read the section for the area you touch and keep it current when a decision changes). This file holds the rules and commands you need every day.

## Repo layout
- `web/src-tauri/` – native shell (Tauri 2, Rust) around the web app: Windows installers, Android APK. Thin by design.
- `web/` – the PWA (Vite, React 19, TypeScript strict). Own `package.json`.
- `server/` – sync server (Fastify 5 + better-sqlite3, own `package.json`, Dockerfile, compose). Separate project, no shared package.
- `contract/` – JSON fixtures of the sync merge rule, read by the tests of both projects.


## Commands (run in `web/`)
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm run preview` | Production build / serve on :4173 |
| `npm run typecheck` | tsc for app, service worker, node configs |
| `npm run lint` | ESLint (incl. module isolation rules) |
| `npm run format:check` / `format` | Prettier check / write (also in `server/`) |
| `npm test` | Vitest unit + component tests |
| `npm run e2e` | `e2e:app` (Playwright, projects `desktop-chrome` + `pixel-7`, builds with `--mode e2e`) followed by `e2e:sync` (`playwright.sync.config.ts`: serial multi-device tests against the real server started from `../server`, in-memory DB) |
| `npm run gen:module -- <id> "<Name>"` | Generate a new module from `templates/module` |
| `npm run db:bump` | Regenerate `src/core/db/schema.snapshot.json` + bump Dexie version |
| `npm run gen:icons` | Re-render PWA PNG icons from `public/icon.svg` (native icons: `npx tauri icon public/icon.svg`) |
| `npm run tauri -- dev` / `build` | Native app (needs Rust; on Linux `libwebkit2gtk-4.1-dev libgtk-3-dev …`). `tauri build --debug --no-bundle` compiles the binary with the embedded frontend |
| `npm run version:check` / `version:sync` / `version:set -- <semver>` | Version consistency, Cargo mirror, release bump (see *Versioning*) |
| `npm run changelog -- --version <x.y.z>` | Release notes from Conventional Commits |

Server (run in `server/`): `npm test` (Vitest + `fastify.inject`, in-memory SQLite), `npm run typecheck`, `npm run lint`, `npm run build` (→ `dist/`), `npm start`, `npm run dev`.

Definition of done for every phase: `lint`, `typecheck`, `test`, `e2e` green; app starts; CLAUDE.md updated; commit + push to `develop`.

Sandbox note: a Chromium is pre-installed at `/opt/pw-browsers/chromium`; `playwright.config.ts` and `gen-icons.mjs` pick it up automatically (override with `PW_CHROMIUM_PATH`). Never run `playwright install` there.


## Rules that must hold (details in `docs/architecture.md`)
- **Module isolation:** modules never import each other; they use the event bus (`core/events`) and manifest contributions. Only sanctioned exceptions: `finance` → `subscriptions/public.ts`, `invoices/public.ts`; `budgets` → `finance/public.ts`. ESLint + `registry.test.ts` enforce this.
- **Data:** one Dexie table per collection (`<moduleId>_<collection>`); every synced record has the envelope `id, createdAt, updatedAt, deviceId, deletedAt, _f`. **Write only via `createRepo`** (`core/db/repo.ts`); modules must not import `@/core/db/db`. Never await non-Dexie promises inside Dexie transactions.
- **Schema:** collection/index change → `npm run db:bump` **and** add the previous stores to `core/db/schema-history.json`; stored data-shape change → bump `manifest.version` + `manifest.migrations`.
- **Formats:** money = integer cents; dates `'YYYY-MM-DD'`, times `'HH:mm'` (local wall clock); epoch ms only for technical timestamps. Use `now()` / `today()` from `core/time/now.ts`, never `Date.now()` in logic.
- **Sync:** field-level last-write-wins by greatest HLC; the rule exists twice (`core/sync/ops.ts`, `server/src/store.ts`) and is pinned by `contract/lww-cases.json` – change both or neither.
- **Platform:** only `core/platform/**` knows about Tauri (`@tauri-apps/*` only in `core/platform/tauri/**`); everything else uses `getPlatform()`.
- **AI privacy:** the assistant sends only instructions, the compact `aiSchema` of enabled modules, the date and the question – never user data (`privacy.test.ts`). The `accounts` module must never get an `aiSchema`, `searchable`, widget or calendar item (`exclusion.test.ts`).
- **Secrets:** no secrets in the repo; API keys via `getPlatform().secrets`. The bundle identifier `io.github.sgnemo.taschenmesser` must never change. The Android keystore and updater private key must never be lost or committed.
- **UI:** German only (`web/src/strings.ts`), CSS Modules + tokens, `data-autofocus` instead of `autoFocus` in dialogs, touch targets ≥ 44 px.
- **Commits:** Conventional Commits (`feat(scope):`, `fix:`, `feat!:`); release notes are generated from them.
- **Releases/CI:** tag `vX.Y.Z[-beta.N]` triggers `release.yml` (signed Windows installers + APK, gitleaks, artifact audit). Key handling, secrets and the audit steps are security-critical – do not weaken them. Release procedure and key creation: `docs/architecture.md` → "Releases & CI".

## Create a new module
1. `npm run gen:module -- habits "Habit-Tracker"` (id: lowercase alphanumeric). This copies `templates/module`, fills placeholders and runs `db:bump`.
2. Edit in `src/modules/habits/`: `schema.ts` (Zod data), `repo.ts` (`createRepo`), `ai.ts` (compact AI schema; `titleField` must be a field), `settings.ts`, `routes/`, `widgets/`, `migrations.ts`, manifest `icon`/`description`/`defaultEnabled`.
3. Route paths must start with `/<id>`; add `nav: true` for navigation entries; add `contributions.quickAdd` for the FAB.
4. Add UI strings to `src/strings.ts` (German).
5. If you change collections/indexes later: `npm run db:bump`. If you change stored data shape: bump `manifest.version` and add a migration.
6. Run `npm run lint && npm run typecheck && npm test`; add an E2E case for user-visible flows.


## Status
Phases 1–12 are done (foundation, core modules, finance, sync + backup, AI assistant + multi-provider router, extra modules, Tauri desktop + Android, CI/signed releases, self-update, password vault incl. OS keystore/biometrics). First public pre-release: `v0.2.0-beta.1`. Per-phase notes: `docs/architecture.md`. Device behaviour of the native shells is only verified by hand – see the two German sections at the end.

## Gotchas
- `pkill -f "<pattern>"` inside a shell command also matches that shell's own command line (exit 144, shell dies). Start servers with `&` + `echo $! > file` and `kill $(cat file)`; for `vite preview` the `[v]ite preview` trick works only when the pattern is not repeated elsewhere in the same command.
- Multi-device E2E lives in `e2e/sync/` (own config, `workers: 1`, shared server) and is ignored by `playwright.config.ts`. Helpers wait on IndexedDB (`_outbox` count) instead of UI state; use client-side navigation while a context is offline (a `goto` would fail).
- Tests that need "another device" create a second `TaschenmesserDB` (unit) or a second browser context (E2E); `MemoryServer` (`core/sync/testing.ts`, tests only) mirrors the server rule.
- Do not leave your own `vite preview` running on :4173 – Playwright reuses that port (`reuseExistingServer`) and would test a stale build. Stop it (`pkill -f "[v]ite preview"`) before `npm run e2e`.
- Async bus handlers (finance booking) finish *after* the UI action; E2E waits for their effect (e.g. poll IndexedDB) before navigating.
- E2E: a write is finished when the dialog that saved it has closed – wait for that (and for the UI to reflect it) before `goto`/`reload`. Fix the date with `page.clock.setFixedTime(...)`; `page.clock.install` + `fastForward` drives the notification scheduler. dnd-kit keyboard steps: wait for the live region (`[id^="DndLiveRegion"]`) between key presses.
- Vitest inlines `dexie` + `dexie-react-hooks` (`vitest.config.ts`); otherwise two Dexie copies break `useLiveQuery`.
- TypeScript is pinned to 6.0.x (typescript-eslint supports `<6.1`); `baseUrl` is not used (paths are relative).
- Controlled checkboxes update after an async DB write: in E2E use `click()` + `expect(...).toBeChecked()` instead of `check()` (Playwright's `check()` fails with "did not change its state").
- `web-push` always speaks HTTPS (even for tests); test the request with `generateRequestDetails` instead of a local HTTP server.
- E2E for the assistant: the Anthropic API is mocked with `page.route('https://api.anthropic.com/v1/messages')` (answer the CORS preflight `OPTIONS` yourself and add `access-control-allow-*` headers); test data is written straight into IndexedDB with envelope fields, so the app must have opened the DB once (`page.goto('/')`) first.
- The SDK's own retries slow error tests down: `createClaudeProvider({ maxRetries: 0 })` in unit tests.
- No secrets in the repo. API keys go through `getPlatform().secrets` (encrypted, local only); other tokens to the local `_secrets` table at runtime only.

## Manuelle Tests offen
Nur auf echter Hardware prüfbar (das macht Sven am Ende). Alles andere ist per Unit-/E2E-Tests und CI-Läufen abgedeckt.

### Schritt 11b – OS-Keystore, Biometrie, Bildschirmschutz
**Windows (installierte App, `Taschenmesser-Setup.exe`)**
1. *API-Schlüssel im Credential Manager:* Einstellungen → KI-Assistent → Anbieter hinzufügen → Schlüssel eintragen → Speichern → „Verbindung testen". Dann Windows-Suche „Anmeldeinformationsverwaltung" → „Windows-Anmeldeinformationen": Es gibt einen Eintrag `ai-key:<anbieter>` (Adresse `io.github.sgnemo.taschenmesser`). ☐
2. *Migration:* Ein Schlüssel, der schon mit einer älteren Version gespeichert war, funktioniert nach dem Update weiter (nach der ersten Nutzung erscheint er im Credential Manager). ☐
3. *Windows Hello:* Accounts → Tresor anlegen/entsperren → „Import, Export & Sicherheit" → „Biometrisches Entsperren aktivieren" (Master-Passwort eingeben) → Windows-Hello-Fenster erscheint und bestätigt. Danach „Sperren" → beim Sperrbildschirm fragt Windows Hello automatisch → Tresor offen. ☐
4. *Abbruch:* Beim Hello-Fenster „Abbrechen" → Tresor bleibt gesperrt, Passwortfeld und Button „Mit Biometrie entsperren" sind da. ☐
5. *Deaktivieren:* „Biometrisches Entsperren deaktivieren" → beim nächsten Sperren kein Hello-Fenster mehr; der Eintrag `bio:vault-dek:…` ist aus dem Credential Manager verschwunden. ☐
6. *Ohne Hello (kein PIN/Gesicht eingerichtet):* Abschnitt zeigt „Nicht verfügbar…", nichts bricht. ☐

**Android (signierte APK)**
7. *Keystore-Schlüssel:* API-Schlüssel speichern, App komplett schließen und neu öffnen, „Verbindung testen" funktioniert. Nach Neustart des Handys ebenfalls. ☐
8. *Biometrie aktivieren:* Accounts → Import, Export & Sicherheit → aktivieren (Master-Passwort) → Fingerabdruck-Dialog → „aktiv". Sperren → Sperrbildschirm zeigt den Dialog → Fingerabdruck → offen. ☐
9. *Abbrechen / falscher Finger:* Dialog abbrechen → gesperrt, Passwort geht weiter; falscher Finger → Dialog meldet Fehler, kein Entsperren. ☐
10. *Fingerabdrücke geändert:* In den Android-Einstellungen einen Fingerabdruck hinzufügen oder löschen → beim nächsten Entsperren erscheint „Biometrisches Entsperren ist nicht mehr gültig…", Master-Passwort entsperrt, Biometrie lässt sich neu aktivieren. ☐
11. *Bildschirmschutz:* Auf der Accounts-Seite Screenshot versuchen (wird blockiert/schwarz), App-Umschalter (Übersicht) zeigt kein Vorschaubild; auf anderen Seiten (Dashboard) normale Screenshots. ☐
12. *Hintergrund-Sperre:* App in den Hintergrund → nach eingestellter Zeit ist der Tresor gesperrt. ☐

**Beide:** Tresor-Daten und KI-Schlüssel bleiben nach einem App-Update erhalten (Update-Test, siehe unten). ☐

## Offen – macht Sven
Installation und Update auf echten Geräten (Windows und Android) – Schritt für Schritt:

1. **Installer holen (Pre-Release).** GitHub → Repository → *Releases* → Eintrag `v0.2.0-beta.1` (Pre-Release). Die README-Badges („Windows herunterladen" …) zeigen auf das *neueste stabile* Release und funktionieren erst, wenn es ein stabiles Release gibt – bis dahin die Dateien direkt von der Release-Seite laden: `Taschenmesser-Setup.exe` (Windows) und `Taschenmesser.apk` (Android). Prüfsumme optional: `Taschenmesser.apk.sha256`.
2. **Windows installieren.** `Taschenmesser-Setup.exe` starten. SmartScreen: „Weitere Informationen" → „Trotzdem ausführen" (die Datei hat kein Authenticode-Zertifikat, der Update-Inhalt ist mit dem Updater-Key signiert). Installation läuft pro Benutzer. App starten → Einstellungen → „App-Updates" zeigt die Version `0.2.0-beta.1`.
3. **Android installieren.** `Taschenmesser.apk` aufs Handy laden und öffnen. Beim ersten Mal „Installation aus unbekannten Quellen" für den Browser/Dateimanager erlauben, dann installieren. Öffnen → Einstellungen → „App-Updates" zeigt `0.2.0-beta.1`. (Vorherige Debug-/anders signierte Version vorher deinstallieren.)
4. **Etwas Testdaten anlegen** (ein ToDo, eine Notiz, ein KI-Anbieter, optional ein Tresor-Eintrag), damit man nach dem Update sieht, dass nichts verloren geht.
5. **Zweites Pre-Release erzeugen (der Update-Test).** Auf deinem Rechner im Repo: `cd web && npm run version:set -- 0.2.0-beta.2`, dann `git commit -am "chore(release): 0.2.0-beta.2"`, `git tag v0.2.0-beta.2`, `git push origin develop v0.2.0-beta.2`. Der Workflow *Release* baut, prüft (Secret-Scan + Artefakt-Audit) und veröffentlicht (~15 Min.; Fortschritt unter *Actions*). Oder sag mir Bescheid, dann mache ich das.
6. **In der installierten `beta.1`-App aktualisieren.** Einstellungen → „App-Updates" → Kanal **Beta** wählen → „Jetzt prüfen" → Banner „Update verfügbar (v0.2.0-beta.2)" mit Änderungsliste → „Jetzt aktualisieren".
   - *Windows:* Die App legt zuerst ein Backup an (`%APPDATA%\io.github.sgnemo.taschenmesser\backups\pre-update-…json`), lädt herunter, installiert und startet neu. Version zeigt `0.2.0-beta.2`, Daten sind da. ☐
   - *Android:* Backup → Download → Android-Installer öffnet sich → „Aktualisieren". Beim ersten Mal ggf. „Installation aus dieser Quelle erlauben" aktivieren, zurück in die App und nochmal „Jetzt aktualisieren". Danach Version `0.2.0-beta.2`, Daten sind da. ☐
7. **Stabil-Kanal prüfen (optional).** Kanal „Stabil" zeigt die Beta nicht an; erst ein Tag `v0.2.0` (ohne Suffix) wird dort angeboten, und die README-Download-Badges gehen dann.
8. **Rückmeldung.** Klappt etwas nicht: Fehlermeldung/Screenshot und Gerät nennen. Die Update-Logik ist Unit-getestet, aber Installer-Übergabe und Signaturprüfung sind erst hier real geprüft. Danach die Checkliste oben („Manuelle Tests offen") durchgehen.
