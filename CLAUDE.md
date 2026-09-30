# CLAUDE.md – Taschenmesser

Modular, local-first everyday PWA ("Swiss army knife"): Windows desktop (Chrome/Edge) + Android Chrome, installed as PWA.
Data lives in IndexedDB; sync is a separate optional layer; an AI search answers questions with as few tokens as possible.
Code, comments and commits are **English**; the UI is **German only** (all texts in `web/src/strings.ts`).

Deep design notes live in [`docs/architecture.md`](docs/architecture.md) (unchanged text; read the section for the area you touch and keep it current when a decision changes). This file holds the rules and commands you need every day.

## Repo layout
- `web/src-tauri/` – native shell (Tauri 2, Rust) around the web app: portable Windows exe, Android APK. Thin by design.
- `web/` – the PWA (Vite, React 19, TypeScript strict). Own `package.json`.
- `server/` – sync server (Fastify 5 + better-sqlite3, own `package.json`, Dockerfile, compose). Separate project, no shared package.
- `mcp/` – MCP server (stdio, `@modelcontextprotocol/sdk`) wrapping the local import API; own `package.json`, no data access of its own.
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

MCP wrapper (run in `mcp/`): `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` (→ `dist/index.js`).

Server (run in `server/`): `npm test` (Vitest + `fastify.inject`, in-memory SQLite), `npm run typecheck`, `npm run lint`, `npm run build` (→ `dist/`), `npm start`, `npm run dev`.

Definition of done for every phase: `lint`, `typecheck`, `test`, `e2e` green; app starts; CLAUDE.md updated; commit + push to `develop`.

Sandbox note: a Chromium is pre-installed at `/opt/pw-browsers/chromium`; `playwright.config.ts` and `gen-icons.mjs` pick it up automatically (override with `PW_CHROMIUM_PATH`). Never run `playwright install` there.


## Rules that must hold (details in `docs/architecture.md`)
- **Module isolation:** modules never import each other; they use the event bus (`core/events`) and manifest contributions. Only sanctioned exceptions: `finance` → `subscriptions/public.ts`, `invoices/public.ts`; `budgets` → `finance/public.ts`. ESLint + `registry.test.ts` enforce this.
- **AI import:** `core/dataapi` derives the import format from `dataSchema` (no second schema); `scope.ts` is the single filter, `accounts` must stay unreachable (`dataApi: false` + id block). New collections holding secrets/connector data need `dataApi: false`.
- **Local API (desktop):** loopback only, off by default; transport/security in `src-tauri/crates/local-api` (never add a bind-address setting, CORS, or logging of tokens/bodies), meaning in `core/localapi/handler.ts`. Tokens only as SHA-256 in `_meta`; blocked/unknown modules must answer identically. User guide: `docs/AI-IMPORT.md` (its prompt must equal `buildApiPrompt`, tested).
- **Data:** one Dexie table per collection (`<moduleId>_<collection>`); every synced record has the envelope `id, createdAt, updatedAt, deviceId, deletedAt, _f`. **Write only via `createRepo`** (`core/db/repo.ts`); modules must not import `@/core/db/db`. Never await non-Dexie promises inside Dexie transactions.
- **Schema:** collection/index change → `npm run db:bump` **and** add the previous stores to `core/db/schema-history.json`; stored data-shape change → bump `manifest.version` + `manifest.migrations`.
- **Formats:** money = integer cents; dates `'YYYY-MM-DD'`, times `'HH:mm'` (local wall clock); epoch ms only for technical timestamps. Use `now()` / `today()` from `core/time/now.ts`, never `Date.now()` in logic.
- **Sync:** field-level last-write-wins by greatest HLC; the rule exists twice (`core/sync/ops.ts`, `server/src/store.ts`) and is pinned by `contract/lww-cases.json` – change both or neither.
- **Platform:** only `core/platform/**` knows about Tauri (`@tauri-apps/*` only in `core/platform/tauri/**`); everything else uses `getPlatform()`.
- **AI privacy:** the assistant sends only instructions, the compact `aiSchema` of enabled modules, the date and the question – never user data (`privacy.test.ts`). The `accounts` module must never get an `aiSchema`, `searchable`, widget or calendar item (`exclusion.test.ts`).
- **Secrets:** no secrets in the repo; API keys via `getPlatform().secrets`. The bundle identifier `io.github.sgnemo.taschenmesser` must never change. The Android keystore and updater private key must never be lost or committed.
- **UI:** German only (`web/src/strings.ts`), CSS Modules + tokens, `data-autofocus` instead of `autoFocus` in dialogs, touch targets ≥ 44 px, page width via `manifest.layout` (`PageContainer`), never a module-level `max-width`.
- **Commits:** Conventional Commits (`feat(scope):`, `fix:`, `feat!:`); release notes are generated from them.
- **Releases/CI:** tag `vX.Y.Z[-beta.N]` triggers `release.yml` (signed portable Windows exe + APK, gitleaks, artifact audit). Key handling, secrets and the audit steps are security-critical – do not weaken them. Release procedure and key creation: `docs/architecture.md` → "Releases & CI".

## Create a new module
1. `npm run gen:module -- habits "Habit-Tracker"` (id: lowercase alphanumeric). This copies `templates/module`, fills placeholders and runs `db:bump`.
2. Edit in `src/modules/habits/`: `schema.ts` (Zod data), `repo.ts` (`createRepo`), `ai.ts` (compact AI schema; `titleField` must be a field), `settings.ts`, `routes/`, `widgets/`, `migrations.ts`, manifest `icon`/`description`/`defaultEnabled`.
3. Route paths must start with `/<id>`; add `nav: true` for navigation entries; add `contributions.quickAdd` for the FAB; set `layout` (`narrow` | `content` | `wide` | `full`, default `content`) to the page width the module needs; `contributions.onboarding` is required (start-data importers, or `noOnboarding`; see docs/architecture.md → Start data).
4. Add UI strings to `src/strings.ts` (German).
5. If you change collections/indexes later: `npm run db:bump`. If you change stored data shape: bump `manifest.version` and add a migration.
6. Run `npm run lint && npm run typecheck && npm test`; add an E2E case for user-visible flows.


## Status
Phases 1–13 are done (foundation, core modules, finance, sync + backup, AI assistant + multi-provider router, extra modules, Tauri desktop + Android, CI/signed releases, self-update, password vault incl. OS keystore/biometrics; extension round: portable exe, start-data wizard, connectors, news, tools, links/share/launcher). First public pre-release: `v0.2.0-beta.1`, next: `v0.2.0-beta.2` (first portable build). Per-phase notes: `docs/architecture.md`. Device behaviour of the native shells is only verified by hand – see the two German sections at the end.

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
**Windows (`Taschenmesser-Portable.exe`)**
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

### KI-Zugriff / lokale Import-API (Phase 2)
Nur in der Windows-App prüfbar (der Server selbst ist per Rust-Tests geprüft, die Oberfläche per E2E mit Ersatz-Server):
K1. *Aktivieren:* Einstellungen → KI-Zugriff → Schalter an → Status „Läuft auf http://127.0.0.1:47631“. Windows-Firewall fragt **nicht** (nur Loopback). ☐
K2. *Zugang:* „Zugang anlegen“, Name, ToDos Lesen + Schreiben → Schlüssel erscheint einmal, kopieren. PowerShell: `Invoke-RestMethod -Uri http://127.0.0.1:47631/v1/modules -Headers @{Authorization="Bearer <Schlüssel>"}` listet nur ToDos. ☐
K3. *Schutz:* dieselbe Anfrage ohne/mit falschem Schlüssel → 401; im Browser `http://127.0.0.1:47631/v1/modules` öffnen → Fehler (kein Zugriff). Von einem anderen Gerät im WLAN ist der Port nicht erreichbar. ☐
K4. *Probelauf:* `POST /v1/todos/import?dryRun=true` mit einem Eintrag → Ergebnis je Eintrag, in der App erscheint nichts. ☐
K4b. *Import mit Vorschau:* derselbe Aufruf ohne `dryRun` → Banner „… möchte 1 Eintrag in „ToDos“ übernehmen“ → Ansehen → Übernehmen; nach dem Sync ist der Eintrag auf dem Handy. „Import rückgängig machen“ (Einstellungen → KI-Zugriff) entfernt ihn überall. Ein Eintrag mit `id` erscheint als Änderung (alt → neu) und ist nicht vorausgewählt. ☐
K5. *Widerrufen / Port belegt:* Zugang widerrufen → nächste Anfrage 401. Port auf einen belegten Wert stellen → verständliche Meldung. ☐

### Portable Windows-Build (Phase 13)
Nur auf echtem Windows prüfbar (CI baut nur; der Smoke-Test dort ist informativ):
P1. *Start:* `Taschenmesser-Portable.exe` (Pre-Release-Download) starten, SmartScreen „Weitere Informationen → Trotzdem ausführen". Die App öffnet sich, die Daten der bisher installierten Version sind da (gleiche App-Kennung). ☐
P2. *WebView2 fehlt:* auf einem Rechner/VM ohne WebView2 startet die exe → deutsches Meldungsfenster mit „OK" (öffnet die Microsoft-Seite) statt stillem Absturz. ☐
P3. *Portabler Modus:* Ordner `data` neben die exe legen, starten → die App ist leer (neues Profil), `data\` füllt sich; ohne den Ordner wieder das Benutzerprofil. ☐
P4. *Update (erst ab dem zweiten portablen Release):* Kanal Beta → „Jetzt prüfen" → „Jetzt aktualisieren": Backup, Download, die exe ersetzt sich, startet neu, neue Version, Daten da, im Ordner bleiben keine `.old`/`.new`-Dateien (nach dem nächsten Start). ☐
P5. *Fehlerfall:* exe in einen schreibgeschützten Ordner legen und aktualisieren → verständliche Meldung („Ordner nicht beschreibbar"), alte Version läuft weiter. ☐

### Verbindungen, Kalender, Kontoauszug (Phase 13, Schritt 3)
Braucht ein echtes Google-Konto bzw. eine echte Bankdatei – bitte nur mit eigenen Daten, nichts davon in den Chat kopieren:
C1. *Kalender-Abo (ICS):* Einstellungen → Verbindungen → Kalender-Abo: „Geheime Adresse im iCal-Format" deines Google-Kalenders eintragen. Im Browser (PWA) braucht das den Sync-Server (Proxy), in der Windows-App geht es direkt. Termine erscheinen im Kalender mit Badge „Extern", sind nur lesbar; Adresse entfernen → Termine verschwinden. ☐
C2. *Google-Login (nur Windows-App):* eigene Client-ID/Secret eintragen (siehe unten), „Verbinden" → der Browser öffnet die Google-Anmeldung → nach „Zulassen" erscheint die Seite „Die Anmeldung ist abgeschlossen" und die Karte zeigt „Verbunden". Bei einer unverifizierten App zeigt Google eine Warnung („Google hat diese App nicht überprüft" → „Erweitert" → „… öffnen"). ☐
C3. *Kalender-Sync:* nach dem Login erscheint die Liste deiner Kalender (nur der Hauptkalender ist angehakt); „Jetzt abgleichen" holt die Termine. Termin in Google ändern/löschen → nach „Jetzt abgleichen" (oder spätestens nach 30 min) auch hier. Zeiten stimmen (Zeitzone!), ganztägige und mehrtägige Termine ebenfalls. ☐
C4. *Ablauf des Tokens:* Status „Testing" in der Google Cloud Console → nach 7 Tagen zeigt die Karte „Abgelaufen" + „Neu anmelden"; lokale Termine bleiben. („In Produktion" vermeidet das.) ☐
C5. *Gmail-Scan:* Feature „E-Mails" einschalten (neuer Login mit mehr Rechten), dann in Rechnungen/Abos/Verträge/Kalender „… aus E-Mails erkennen" → Zeitraum wählen → Vorschau prüfen. Es darf nur passieren, was du bestätigst; der Vorschau-Text nennt „N Mails gelesen (Absender, Betreff, Datum, Vorschauzeile)". Prüfe, ob die Erkennungsquote brauchbar ist (Heuristiken sind auf erfundenen Beispielen getestet, nicht auf echten Mails). ☐
C6. *Trennen:* „Trennen" → Dialog „Termine behalten / löschen"; danach ist der Zugriff in deinem Google-Konto unter „Sicherheit → Drittanbieter-Zugriff" verschwunden. ☐
C7. *Kontoauszug:* Online-Banking → Umsätze → Export „CSV-CAMT" (oder „CAMT"). **Bitte nur die Kopfzeile (erste Zeile) einer echten Datei prüfen/schicken** und mit `Buchungstag`, `Verwendungszweck`, `Beguenstigter/Zahlungspflichtiger`, `Betrag` vergleichen; dann Finanzen → Einstellungen → Startdaten → „Kontoauszug importieren": Vorschau, Import, zweiter Import zeigt nur „Schon vorhanden". Abos: „Abos im Kontoauszug erkennen" zeigt regelmäßige Abbuchungen. ☐

### Nachrichten (Phase 13, Schritt 4)
N1. *Feed-Adressen des Startpakets:* Nachrichten → „Startdaten einrichten" → Startpaket: die neun Adressen (`web/src/modules/news/starter.ts`) stammen aus dem Gedächtnis und konnten hier nicht geprüft werden. „Aktualisieren" → bei einem Feed mit Fehler unter „Feeds verwalten" steht der Grund; kaputte Adressen ersetzen (oder mir die richtige nennen). ☐
N2. *Browser (PWA):* Abrufen geht nur mit Sync-Server (Proxy); ohne erscheint der Hinweis. In der Windows-App ohne Server. ☐
N3. *„Für später"* legt den Artikel in der Merkliste ab (Modul „Merkliste" muss an sein); „Im Browser lesen" öffnet den Artikel im Standardbrowser. ☐
N4. *KI-Tagesüberblick:* mit eingerichtetem KI-Anbieter → „Tagesüberblick mit KI" → kurze Punktliste; in Einstellungen → KI-Assistent steht der Verbrauch; es werden nur Schlagzeilen gesendet. ☐

### Werkzeuge (Phase 13, Schritt 5)
T1. *QR lesen:* Werkzeuge → QR-Code → „Lesen" → Kamera erlauben → einen QR-Code halten: Text erscheint (Windows-App/Chrome: `BarcodeDetector`; auf dem Handy Kamerarecht in der APK). Wo es nicht geht, steht ein Hinweis; Erzeugen geht immer. ☐
T2. *Währung:* mit Internet: Kurse laden, umrechnen; danach Netz aus → gespeicherte Kurse mit Datum. Die Schnittstelle `api.frankfurter.dev` ist nur per Doku geprüft (in der Windows-App keine CORS-Hürde, im Browser hängt es an deren CORS-Erlaubnis). ☐
T3. *Timer:* Timer starten, Sheet schließen – läuft weiter; bei Ablauf kommt die Benachrichtigung (Windows und Android). ☐

### Links, Teilen, Apps & Links (Phase 13, Schritt 6)
L1. *Karte:* Termin mit Ort → „Auf der Karte zeigen“ öffnet Google Maps (Windows: Browser, Android: Maps-App). ☐
L2. *WhatsApp:* Geburtstage → Knopf neben dem Namen → WhatsApp (Web/App) mit Glückwunschtext, Kontakt wählen. ☐
L3. *Teilen (Android, PWA in Chrome installiert):* in einer anderen App „Teilen“ → Taschenmesser → Seite „Teilen“ mit den Zielen (nur eingeschaltete Module); Merkliste/Notiz/ToDo öffnen vorbefüllt. Die **APK** hat kein Teilen-Ziel (nicht gebaut). ☐
L4. *Apps & Links:* Modul einschalten → „Startdaten einrichten“ → Vorschläge; die acht Startseiten (DHL, Hermes, DPD, Bahn, Maps, WhatsApp Web, Spotify, DWD) im Browser öffnen und melden, welche nicht stimmt. ☐
L5. *Spotify:* nicht gebaut (siehe docs/architecture.md). Soll ein Now-Playing-Widget kommen, brauche ich eine Entscheidung: Premium-Konto als Entwickler nötig, max. 5 Nutzer. ☐

## Offen – macht Sven
Installation und Update auf echten Geräten (Windows und Android) – Schritt für Schritt:

1. **Dateien holen (Pre-Release).** GitHub → Repository → *Releases* → das neueste Pre-Release. Die README-Badges („Windows (portabel) herunterladen" …) zeigen auf das *neueste stabile* Release und funktionieren erst, wenn es ein stabiles Release gibt – bis dahin die Dateien direkt von der Release-Seite laden: `Taschenmesser-Portable.exe` (Windows) und `Taschenmesser.apk` (Android). Prüfsumme optional: `Taschenmesser.apk.sha256`.
2. **Von der installierten Windows-Version umsteigen (einmalig, `0.2.0-beta.1` kann sich nicht selbst auf die portable Datei aktualisieren).** (a) Alte App: Einstellungen → Backup → exportieren. (b) `Taschenmesser-Portable.exe` in einen beschreibbaren Ordner legen und starten (SmartScreen: „Weitere Informationen" → „Trotzdem ausführen"; die Datei hat kein Authenticode-Zertifikat, der Update-Inhalt ist mit dem Updater-Key signiert). Die Daten sind sofort da. (c) Alte Version deinstallieren – **„Anwendungsdaten löschen" nicht ankreuzen.** Einstellungen → „App-Updates" zeigt die Version.
3. **Android installieren.** `Taschenmesser.apk` aufs Handy laden und öffnen. Beim ersten Mal „Installation aus unbekannten Quellen" für den Browser/Dateimanager erlauben, dann installieren. Öffnen → Einstellungen → „App-Updates" zeigt die Version. (Vorherige Debug-/anders signierte Version vorher deinstallieren.)
4. **Etwas Testdaten anlegen** (ein ToDo, eine Notiz, ein KI-Anbieter, optional ein Tresor-Eintrag), damit man nach dem Update sieht, dass nichts verloren geht.
5. **Nächstes Pre-Release erzeugen (der Update-Test).** Auf deinem Rechner im Repo: `cd web && npm run version:set -- 0.2.0-beta.3`, dann `git commit -am "chore(release): 0.2.0-beta.3"`, `git tag v0.2.0-beta.3`, `git push origin develop v0.2.0-beta.3`. Der Workflow *Release* baut, prüft (Secret-Scan + Artefakt-Audit), veröffentlicht und prüft danach alle Download-Links (~15 Min.; Fortschritt unter *Actions*). Oder sag mir Bescheid, dann mache ich das.
6. **In der portablen App aktualisieren.** Einstellungen → „App-Updates" → Kanal **Beta** wählen → „Jetzt prüfen" → Banner „Update verfügbar" mit Änderungsliste → „Jetzt aktualisieren".
   - *Windows:* Backup (`%APPDATA%\io.github.sgnemo.taschenmesser\backups\pre-update-…json`), Download, Signaturprüfung, die exe ersetzt sich selbst und startet neu. Version stimmt, Daten sind da. ☐
   - *Android:* Backup → Download → Android-Installer öffnet sich → „Aktualisieren". Beim ersten Mal ggf. „Installation aus dieser Quelle erlauben" aktivieren, zurück in die App und nochmal „Jetzt aktualisieren". Danach neue Version, Daten sind da. ☐
7. **Stabil-Kanal prüfen (optional).** Kanal „Stabil" zeigt die Beta nicht an; erst ein Tag `v0.2.0` (ohne Suffix) wird dort angeboten, und die README-Download-Badges gehen dann.
8. **Rückmeldung.** Klappt etwas nicht: Fehlermeldung/Screenshot und Gerät nennen. Die Update-Logik ist Unit-getestet, aber Austausch der laufenden exe, Installer-Übergabe (Android) und Signaturprüfung sind erst hier real geprüft. Danach die Checklisten oben („Manuelle Tests offen") durchgehen.

### Google-Verbindung einrichten (einmalig, für Kalender/Gmail)
1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt „Taschenmesser".
2. *APIs & Dienste → Bibliothek*: „Google Calendar API" und „Gmail API" aktivieren.
3. *OAuth-Zustimmungsbildschirm* → Typ „Extern"; Name „Taschenmesser", deine Adresse als Support-/Entwickler-Mail. *Bereiche*: `…/auth/calendar.readonly` und `…/auth/gmail.readonly` hinzufügen. **Veröffentlichungsstatus auf „In Produktion" stellen** (ohne Prüfung; beim Login erscheint eine Warnung „nicht überprüft", nur du selbst nutzt es). Im Status „Testing" laufen Refresh-Tokens nach 7 Tagen ab (dann „Neu anmelden").
4. *Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID* → Typ **Desktop-App**. Client-ID und Client-Secret kopieren und in der Windows-App unter Einstellungen → Verbindungen → Google eintragen (landen im Windows-Anmeldeinformationsspeicher, nicht im Repo).
5. **Ungetestet/prüfen:** ob `gmail.readonly` bei einer unverifizierten „In Produktion"-App wie erwartet funktioniert. Wenn nicht: Status auf „Testing" lassen und deine Adresse als Testnutzer eintragen.
6. Android: Google-Login gibt es dort noch nicht; auf dem Handy kommen Termine über die Synchronisierung (sie liegen in einer synchronisierten Sammlung) oder über ein Kalender-Abo (ICS) an.
