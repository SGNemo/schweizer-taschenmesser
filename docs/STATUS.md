# Status – Nemo

Letztes Release: `v0.3.1` am 2026-10-01 (stabil, auf `main`; `releases/latest` zeigt darauf). Alles danach liegt auf `develop` (Dev-Preview) und steht in `.changes/` → [CHANGELOG](../CHANGELOG.md). Offene PRs und was auf Sven wartet: [CHATS.md](CHATS.md). Diese Datei hält nur den Stand; Verlauf steht im Changelog, in Git und im Archiv ([bis 2026-11-10](archive/2026-11/STATUS-log-until-2026-11-10.md), [bis 0.3.1](archive/2026-10/STATUS-done-until-0.3.1.md)). Pro PR höchstens eine Zeile, und nur wenn sich der Stand ändert: laufende Runde anpassen oder eine Zeile unter „Abgeschlossene Runden“.

## Nächste eine Sache

UI-Audit 4.0 weiterführen: Paket 0b-2 (Modulkopf als eine Titelzeile mit Reitern, #688), danach 0b-3 bis 0b-8. Plan, Ledger und Pakete: [design/ui-audit-2026-11/](design/ui-audit-2026-11/PACKAGES.md).

## Laufende Runden

- **UI-Audit 4.0** ([design/ui-audit-2026-11/](design/ui-audit-2026-11/REPORT.md), Entscheidungen [decisions/ui-shell.md](decisions/ui-shell.md)): Paket 0a (Wächter, Ratsche, Lade-Robustheit, Hauptthread), V-1, AE1, AE4 und 0b-1 Fundament sind auf `develop`; 0b-2 läuft. Offen daraus: Monatskalender-Zeilen 18 px (0b-4), Tooltip der eingeklappten Seitenleiste schließt nicht mit Escape; technische Reste im [LEDGER](design/ui-audit-2026-11/LEDGER.md).
- **Fernsteuerung des PCs vom Handy** ([design/remote-control/PACKAGES.md](design/remote-control/PACKAGES.md), Regel [rules/remote-control.md](rules/remote-control.md)): PC-Seite, Modul „Fernbedienung“ und Benachrichtigung der vollen Stufe sind auf `develop`. Offen: Latenzmessung mit echtem Handy (#690), dann Seite Touchpad; Schalter für die Benachrichtigung; Lautstärketasten (`feat/remote-volume-keys`, braucht Android-Build).
- **Website Runde 5** ([design/site/ROUND-5.md](design/site/ROUND-5.md)): Pakete 2–4 auf `develop`; Paket 1 (neue Bilder, Social-Preview) wartet auf 0b-8. Website-Screenshots bleiben bis dahin deutsch und zeigen das alte Logo.
- **Modul Uhr** ([features/clock.md](features/clock.md)): Paket 1 auf `develop`; Folge-Prompts in [product/clock/](product/clock/01-followups.md), nicht gestartet.
- **UI schärfen, Runde 6** ([qa/round-6/STATUS.md](qa/round-6/STATUS.md)): alle acht Fix-PRs auf `develop`; offen U41 Kopfbandhöhen (`fix/ui6-head-heights`) und der Sammel-PR `fix/ui6-followups`.

## Abgeschlossene Runden (je eine Zeile; alles auf `develop`)

- Heimnetz-Sync (LAN-Hub, Koppeln, zweiter PC, „Nur im WLAN“): [design/sync-lan/CONCEPT.md](design/sync-lan/CONCEPT.md). Nicht gebaut: Abgleich ganz im Hintergrund.
- Use case „Kopf leer“ (Pakete 1–4, Nachlese, nachgemessen): [design/usecases/kopf-leer/TARGET.md](design/usecases/kopf-leer/TARGET.md).
- Erstkontakt-Runde 5 (Personen A–D, Installation ohne Hilfe, Dev-Preview-Erststart): `docs/qa/round-5/<a–d>/FINDINGS.md`.
- Fitness (Pakete 1–5, Vorschau, aus): [features/fitness.md](features/fitness.md). Offen: Yazio-Import (Format unbekannt).
- Planer (Pakete 1–5, Sweep): [design/plan/CONCEPT.md](design/plan/CONCEPT.md), [decisions/plan.md](decisions/plan.md). Eigene Konzepte stehen aus für Zeiterfassung, Energie, Gewohnheiten, Wochenrückblick.
- Identität v3 und v3.1 (Fundament, alle Modulgruppen, Werkzeuge, Bibliotheken, Einstellungen, Abnahme): [design/MODULE-IDENTITY.md](design/MODULE-IDENTITY.md), [Abnahme](design/identity-v3-audit/03-acceptance.md).
- Einstellungen v2 und v3 (Überblick, Suche, Profile, Reiter „Einrichtung“): [decisions/ui-shell.md](decisions/ui-shell.md).
- Logo v2 bis v2.2 und eingeklappte Seitenleiste: [decisions/ui-brand.md](decisions/ui-brand.md).
- Sprachen nur Deutsch + Englisch, es/fr/pt-BR eingefroren: [i18n/FROZEN.md](i18n/FROZEN.md).
- Agenten-Team v3.1 (sieben Agenten, Routing, Budgets): [meta/AGENTS.md](meta/AGENTS.md), [meta/WORK-ROUTING.md](meta/WORK-ROUTING.md). Offen bei Sven: Definitionen mit `ant apply` anwenden, Entscheidungs-Bullet in `decisions/meta.md`.
- Umzug v2 und Importer für andere Apps: [features/import-v2.md](features/import-v2.md), [features/import-apps.md](features/import-apps.md).
- Automatisierungen (Engine, Modul-Verträge, Einstellungen): [decisions/features.md](decisions/features.md). Vorschlag offen: Regel-Editor und Widget.
- Datenebene Performance (Phase 1, P2a–d): [perf/DATA-BASELINE-2026-11-03.md](perf/DATA-BASELINE-2026-11-03.md); E2E-Tempo und CI: [perf/CI-BASELINE-2-2026-11-04.md](perf/CI-BASELINE-2-2026-11-04.md).
- Mail-Modul (Pakete 0–5), Feeds, Browser + Downloads + Torrent, Karten (eigene Karte, Routing, ÖPNV): [features/](features/README.md). Nur mit Mock-Daten oder `cargo check` geprüft: Torrent, Browser-Rust-Teil, Android Custom Tabs (nicht auf Hardware gebaut).
- Planen-Gruppe, Geld-Gruppe, Haushalt & Tresor, Wissen/Medien/Dienste, Cockpit-Modus, Rechner (Modi, Plotter), Anonyme Persona: [CHANGELOG](../CHANGELOG.md), Rezepte in [HOW-TO](HOW-TO.md).
- Fokus- und Aufmerksamkeitshilfen (Pakete 1–4, Runden 2–5), Komfort-Review, Lesbarkeit: [features/focus-aids.md](features/focus-aids.md), [product/comfort/07-summary.md](product/comfort/07-summary.md). Nicht in `develop`: Finanz-Tabs Konten/Kategorien in Erweitert (`feat/comfort-finance-advanced`).
- QA-Runden (Personas, P1–P6, Runde 4 Chaos): [qa/CONSOLIDATED.md](qa/CONSOLIDATED.md), [qa/round-4/chaos/FINDINGS.md](qa/round-4/chaos/FINDINGS.md) (X25/X31/X37 nur teilweise). Offen: Feld-Reifegrad (Erinnerungs-Felder, Zock-Modus), Kalender „Wetter am Tag“ und „Als Ort speichern“.
- Fehlerberichte, Sicherheits-Review vor dem Launch, Änderungsprotokoll, Supporter-Modus, KI abschalten, Spracheingabe, KI-Eintragen: [security/LAUNCH-REVIEW-2026-10-06.md](security/LAUNCH-REVIEW-2026-10-06.md) (offen daraus u. a. X2 Pipe-Erstinstanz, V2 Windows-Hello-Wrapping, V4, S5 Sync-Token in den `SecretStore`; vollständig: Abschnitt B des Berichts), [howto/bug-reports.md](howto/bug-reports.md), [howto/changelog.md](howto/changelog.md).
- Docs-Diät 2026-11 (Startkosten eines Chats, CHATS/STATUS gekürzt, abgeschlossene Arbeitsordner entfernt): [meta/DOCS-DIET-2026-11.md](meta/DOCS-DIET-2026-11.md).

## Heute möglich in 15 Minuten

1. Social-Preview hochladen: GitHub → Settings → _Social preview_ → `docs/brand/social-preview.png` (Punkt 0 unten).
2. Release `v0.3.1` kurz prüfen: Checkliste R1 in [MANUAL-TESTS.md](MANUAL-TESTS.md) (Download, Start, Version im Über-Dialog).
3. Offene PRs ansehen: Liste „Wartet auf Sven“ in [CHATS.md](CHATS.md).

Website (`site/`, Cloudflare-Pages-Projekt `nemo-site`): `develop` deployt seit dem 04.11. wieder (Variablen `IMPRESSUM_*` in Production gesetzt). `main` baut als Preview und braucht die Variablen dort ebenfalls; Checkliste [howto/cloudflare-checks.md](howto/cloudflare-checks.md).

## Nicht gebaut / bekannte Grenzen

- Google-Drive-Sync-Adapter (nur `core/sync/adapters/googleDrive.stub.ts`), Binär-Anhänge im Sync, Tombstone-GC, Mehrmandanten-Server.
- Browser-Erweiterung: nur Brave/Chromium (MV3); Firefox, Safari, Store-Veröffentlichung (Chrome Web Store/Edge Add-ons, eigene Erweiterungs-ID → Allowlist), Release-Zip in `release.yml` (Vorschlag in [howto/browser-extension.md](howto/browser-extension.md)) offen; mehrstufige Logins und Felder in geschlossenen Shadow-Roots werden nicht erkannt.
- Android: Autofill-Dienst (Folge-PR geplant, Notiz in [ROADMAP.md](ROADMAP.md)); bis dahin Kopieren mit sensibler Zwischenablage, per Erweiterung gespeicherte Einträge kommen per Sync aufs Handy.
- Google-Login auf Android, zweiseitiger Kalender-Sync, FinTS/PSD2, Mail-Body-Parsing.
- Spotify in der Android-App ([spotify.md](features/spotify.md)), natives Android-Share-Target für die APK.
- Windows-Binaries ohne Authenticode-Zertifikat (SmartScreen-Warnung); Pre-Update-Backups liegen im `%APPDATA%`-Ordner, auch im portablen Modus.
- Providerdaten (Modellnamen, Preise, Limits, CORS aus der PWA), Bankdatei-Spaltennamen und Launcher-Adressen sind unverifiziert (siehe [MANUAL-TESTS.md](MANUAL-TESTS.md)).
- Geräteverhalten der nativen Shells (Windows Hello, Android-Keystore/Biometrie, Update-Austausch, Push) nur von Hand prüfbar.
- Einrichtungsassistent: keine automatischen lokalen Backups, keine App-Sperre, kein Screenshot-Schutz-Schalter (gibt es in der App nicht; der Assistent zeigt nur Vorhandenes). Kein Ollama-CORS-Workaround im Browser (Erkennung ist Best-Effort). Hinweise zu genauen Alarmen/Akku-Optimierung sind nur Text (keine Plugin-API geprüft/gebaut). Wochenstart nur im Kalender (KI-Zeiträume rechnen weiter mit Montag).

- Supporter-Modus: Webhook-Dienst ist gebaut, aber noch **nicht deployt** (Anleitung: [services/supporter-webhook/README.md](../services/supporter-webhook/README.md)); bis dahin Codes per CLI von Hand ([howto/supporter.md](howto/supporter.md)). Icon-Varianten (Android-Activity-Alias, Tray) bewusst nicht gebaut.

## Bekannte Probleme / Hinweise

- TypeScript ist auf 6.0.x gepinnt (typescript-eslint unterstützt `<6.1`).
- Aus PR #2 zurückgestellte Vorschläge: TypeScript 7 / `@types/node` 26, Vitest-`node`-Projekt für reine Logiktests, `windows`-Crate 0.61 → 0.62 (nur per CI prüfbar). Erledigt 2026-09-30: JS-Plugin-Bumps (`plugin-http` 2.8.0, `plugin-opener` 2.7.0; die Rust-Seite bleibt `~2.7`, siehe Cargo), CI-Caching. `serde_json` bleibt: `tauri::generate_context!` braucht es.
- Vorschlag offen (aus PR #3): ToDo-Board mit Listen als Spalten.
- Vor dem nächsten Release: Docker-Image des Sync-Servers einmal bauen und starten (Node 26 als Toolchain, [decisions/distribution.md](decisions/distribution.md)).
- Versionsnummern: Git-Tags enden bei `v0.3.1`; `web/package.json` und `CHANGELOG.md` nennen `1.0.0`. Vor dem nächsten Release klären, welche Nummer gilt.

## Modul-Review 2026-10-01 (entschieden, Doku-PR, noch nicht umgesetzt)

Zielbild B: 9 Nav-Einträge + „Dieser PC“; Gruppen „Geld“ und „Listen“; Verschmelzungen Erinnerungen → Kalender, (Einkauf + Packlisten → Listen, Apps & Links → Merkliste, Verträge → Unterlagen, Geburtstage + Geschenke → Personen: erledigt), Systeminfo → Datenträger; Nachrichten stillgelegt und mit Paket 6 entfernt; Habits und Zeiterfassung kamen am 2026-11-03 als neue Module zurück ([decisions/ui-shell.md](decisions/ui-shell.md)); Werkzeuge 18 → 12. Pakete (0.4 … 0.9) und Prompts: [product/MODULE-PLAN.md](product/MODULE-PLAN.md), [archive/2026-10/MODULE-IMPLEMENTATION-PROMPT.md](archive/2026-10/MODULE-IMPLEMENTATION-PROMPT.md). Review-Funde: alle behoben oder bewusst belassen. Reihenfolge mit der Design-Spezifikation: Design-PR 1 + 2 → Paket 1 → Design-PR 3 + 4 → Pakete 3–5; Design-PRs 5b/5c/5d nur für bleibende Module (Review Abschnitt 25).

## Nächste sinnvolle Schritte

1. Hardware-Checklisten ([MANUAL-TESTS.md](MANUAL-TESTS.md)) abarbeiten (Sven), Fehler melden.
2. Update-Test auf echten Geräten mit dem nächsten Release (Schritte unter „Offen – macht Sven").
3. Unverifizierte Adressen/Formate mit echten Daten prüfen (N1, C7, L4, Provider-Endpunkte).
4. Browser-Erweiterung auf echter Hardware prüfen (Checkliste X1–X14 in [MANUAL-TESTS.md](MANUAL-TESTS.md)), dann Store-/Release-Zip-Entscheidung.
5. Kaltstart/Precache: [perf/COLD-START-2026-10.md](perf/COLD-START-2026-10.md).

## Manuelle Tests offen

Hardware-Checklisten (D1–D16, E1–E5, N1–N13, C7, L4, F1–F11 Fokushilfen …): vollständig in [MANUAL-TESTS.md](MANUAL-TESTS.md).

## Offen – macht Sven

0b. **Google-Prüfung für die Mail-Berechtigungen (Mail-Modul, Paket 3):** `gmail.readonly`, `gmail.modify` und `gmail.send` sind bei Google „eingeschränkte Bereiche“. Mit der eigenen OAuth-Client-ID jedes Nutzers (so ist es gebaut) braucht das keine Prüfung durch Google; im Teststatus der Cloud-Console laufen die Anmeldungen aber nach 7 Tagen ab, bis die App auf „In Produktion“ gestellt wird (dann zeigt Google den Hinweis „nicht verifizierte App“). Würde Nemo je einen **eigenen, mitgelieferten** Client für alle Nutzer einsetzen, wäre die Google-OAuth-Verifizierung samt jährlicher Sicherheitsprüfung (CASA) Pflicht – das ist eine Entscheidung für dich, nicht für den Code. Siehe [decisions/legal.md](decisions/legal.md).
0a. **Dev-Preview-Schlüssel (vor dem Launch):** Schlüsselpaar erzeugt, öffentlicher Schlüssel (`FA423702E1D8B9CE`) steht in `src-tauri/tauri.dev.conf.json`; die Secrets `TAURI_DEV_SIGNING_PRIVATE_KEY` + `_PASSWORD` sind gesetzt (07.10.). Der Android-Keystore wurde am 07.10. neu angelegt (altes Passwort verloren): v0.3.1-Installationen lassen sich nicht aktualisieren, vorher Backup in der App, deinstallieren, neu installieren, Backup einspielen. Handtests aus dem Launch-Review (X1 Pipe auf Windows mit zweitem Nutzer, V1 Credential-Manager nach „Alle Daten löschen“, Android-APK-Update, Datenschutzseite: Name des Verantwortlichen eintragen). 0. **Repo-Auftritt setzen (kein API-Zugriff durch Sessions):** Beschreibung (Englisch), Website, Topics, Social Preview (`docs/brand/social-preview.png`, jetzt mit englischem Claim), _Private vulnerability reporting_ und Sponsor-Button: Texte zum Einfügen in [meta/REPO-SETTINGS.md](meta/REPO-SETTINGS.md). Kontakt-Adresse in `CODE_OF_CONDUCT.md` eintragen (Platzhalter).

**Neu (Datenträger):** Die Checkliste D1–D16 in [MANUAL-TESTS.md](MANUAL-TESTS.md) auf einem echten Windows-Rechner abarbeiten (Windows-Code ist nur per `cargo check --target x86_64-pc-windows-msvc` geprüft, nicht ausgeführt). Windows-Portable-Größe vorher/nachher: nur der Release-Workflow kann sie messen (Dry-Run auf `develop`, siehe HOW-TO).

- **TODO Rechtliches vor dem Launch** ([Checkliste](legal/LAUNCH-LEGAL-CHECKLIST.md)): Name und Anschrift stehen als Cloudflare-Pages-Variablen `IMPRESSUM_NAME`/`IMPRESSUM_STREET`/`IMPRESSUM_POSTCODE_CITY` (Production seit 04.11.; **auch in Preview setzen**, sonst bleibt `main` rot; nicht im Repo; `cd web && npm run check:legal` prüft den Rest), `[[RECHTSGRUNDLAGE]]` in [DATA-FLOWS](legal/DATA-FLOWS.md) füllen; der Release-Workflow bricht das Veröffentlichen ab, solange welche offen sind. Markenname „Nemo“ prüfen. **Google-OAuth „Testing“ (7 Tage, ≤ 100 Testnutzer): entschieden, Variante (a)**: jede Person bringt ihren eigenen Client mit, die App erklärt Ablauf und „Neu anmelden“. Verworfen: eigener Projekt-Client „In Produktion“ (Kalender sensibel, Gmail eingeschränkt, Prüfung durch Google nötig).
- Fehlerberichte: echte Adresse als `REPORT_MAIL` in `web/src/core/diagnostics/config.ts` eintragen (mit `.invalid` bleibt „Per Mail melden“ ausgeblendet).
- [LAUNCH-CHECKLIST](LAUNCH-CHECKLIST.md) auf frischer Windows-VM und Android-Gerät abhaken (Installation, SmartScreen, Update N→N+1, Deinstallation, Sicherer Modus).
- Update-Test auf echten Geräten (Windows, Android), Einrichtungsassistent E1–E5, Google-Verbindung einrichten: Anleitungen in [MANUAL-TESTS.md](MANUAL-TESTS.md) → „Anleitungen für Sven“.

### Nemo-Rebranding

10. **GitHub-Repo umbenennen (optional).** Betrifft `REPO` (`core/update/github.ts`), den Updater-Endpunkt in `tauri.conf.json`, `RELEASES_PREFIX` in `update.rs`, README-Links und den Link-Check. GitHub leitet alte URLs zwar um, aber ein Update-Endpunkt darf nie kaputtgehen: erst einen Plan mit Übergangs-Release schreiben lassen, dann umbenennen.
12. **Social-Preview hochladen:** `docs/brand/social-preview.png` in GitHub → Settings → Social preview.
13. **Erledigt (ab dem nächsten Release nach `v0.3.1`):** Releases tragen nur noch `Nemo-*`; `latest.json` zeigt auf `Nemo-Portable.exe`. Folge: Installationen ≤ 0.2.x können sich nicht mehr selbst aktualisieren (Neuinstallation nötig); Clients ab 0.3.0 akzeptieren beide Namen. Offen: Die Rust-/TS-Allowlists (`PORTABLE_ASSETS`, `APK_ASSET_PAIRS`) nennen den Altnamen noch, harmlos, später entfernbar. Optional: MCP-Variablen `NEMO_TOKEN/NEMO_URL` als Alias zu `TASCHENMESSER_*`.

**Neu (Supporter-Modus, [howto/supporter.md](howto/supporter.md), [legal/SUPPORTER-NOTES.md](legal/SUPPORTER-NOTES.md)):**

- Ko-fi-Seite und „Code erneut senden“-Seite sind in `supporterLinks.ts` eingetragen; vor dem Release mit einer echten Spende testen (Mail kommt an, Code wird akzeptiert, `/resend`).
- Schlüsselpaar erzeugen und sicher verwahren (`tools/supporter-cli`: `keygen`, dann `set-public-key`, `publicKeys.ts` committen; solange er leer ist, lehnt die App jeden Code ab). Eigenen Code: `create --tier developer --name "Sven"`.
- Webhook-Dienst deployen: Schritt für Schritt in [services/supporter-webhook/README.md](../services/supporter-webhook/README.md) (Cloudflare-Konto, KV und Queues anlegen, Secrets setzen, Resend mit verifizierter Domain, Webhook-URL und Token bei Ko-fi eintragen, Test-Spende). Vorher prüfen, dass die Feldnamen der echten Ko-fi-„Send test“-Nachricht zu `src/kofi.ts` passen (Schritt 15 der Anleitung).
- Steuerliche und rechtliche Klärung (Impressum, Datenschutzhinweis für den Mailversand): Checkliste in [legal/SUPPORTER-NOTES.md](legal/SUPPORTER-NOTES.md). README-Abschnitt „Unterstützen“ erst mit der Zahlungsseite veröffentlichen.

## Fertig (eine Zeile je Release; Details: [CHANGELOG](../CHANGELOG.md), Arbeitsprotokoll bis 0.3.1: [archive/2026-10/STATUS-done-until-0.3.1.md](archive/2026-10/STATUS-done-until-0.3.1.md))

- `v0.2.0` (2026-09-30): Phasen 1–13 (Fundament bis Passwort-Tresor, Sync/Backup, KI-Assistent + Router, Tauri-Shell, Releases, Selbst-Update), KI-Import (JSON, lokale Import-API, `mcp/`).
- `v0.3.0-beta.1` (2026-09-30) / `v0.3.0` (2026-10-01): Nemo-Rebranding, Einrichtungsassistent, Schnell erfassen, Datenträger/Systeminfo (Windows), Vorrat, Zeiterfassung, Geschenkideen, Werkzeuge, flaches Design „Klar“, Übersicht + Widgets, Dev-Preview, MIT.
- `v0.3.1` (2026-10-01, aktuell): neue Wortmarke, Clownfisch-Icon, Sicherheits-/Abhängigkeitskorrekturen.
- Seit `v0.3.1` auf `develop`: siehe „Abgeschlossene Runden“ oben und [CHANGELOG](../CHANGELOG.md).
