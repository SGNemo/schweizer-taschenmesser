# Status – Nemo

Letztes Release: `v0.3.1` am 2026-10-01 (stabil, auf `main`; `releases/latest` zeigt darauf). Alles danach liegt auf `develop` (Dev-Preview) und steht in `.changes/` → [CHANGELOG](../CHANGELOG.md). Offene PRs und was auf Sven wartet: [CHATS.md](CHATS.md). Diese Datei hält nur den Stand; Verlauf steht im Changelog, in Git und im Archiv ([bis 2026-11-10](archive/2026-11/STATUS-log-until-2026-11-10.md), [bis 0.3.1](archive/2026-10/STATUS-done-until-0.3.1.md)). Pro PR höchstens eine Zeile, und nur wenn sich der Stand ändert: laufende Runde anpassen oder eine Zeile unter „Abgeschlossene Runden“.

## Nächste eine Sache

UI-Audit 4.0 weiterführen: Paket G-b (Vermögen, #736) abnehmen, dann 0b-4 bis 0b-8. Plan, Ledger und Pakete: [design/ui-audit-2026-11/](design/ui-audit-2026-11/PACKAGES.md).

## Laufende Runden

- **UI-Audit 4.0** ([design/ui-audit-2026-11/](design/ui-audit-2026-11/REPORT.md), Entscheidungen [decisions/ui-shell.md](decisions/ui-shell.md)): Paket 0a (Wächter, Ratsche, Lade-Robustheit, Hauptthread), V-1, AE1, AE4 und 0b-1 Fundament und 0b-2 (Kopf, Navigation) sind auf `develop`; 0b-3 (Geld, #714) ist auf `develop`; G-b (Vermögen, #736) wartet auf die Abnahme. Offen daraus: Monatskalender-Zeilen 18 px (0b-4), Tooltip der eingeklappten Seitenleiste schließt nicht mit Escape; technische Reste im [LEDGER](design/ui-audit-2026-11/LEDGER.md).
- **Fernsteuerung des PCs vom Handy** ([design/remote-control/PACKAGES.md](design/remote-control/PACKAGES.md), Regel [rules/remote-control.md](rules/remote-control.md), Nutzer-Doku [user/remote-control.de.md](user/remote-control.de.md)): Pakete 0–4 sind auf `develop` (Medien, Touchpad, Tastatur, Lautstärketasten). Paket 5 (`feat/remote-polish`): Karte auf der Übersicht mit „Wiedergabe / Pause“ und Nutzer-Doku. Modul und Einstellungs-Abschnitt bleiben `preview`, bis die Handtests FB1–FB19 in [MANUAL-TESTS.md](MANUAL-TESTS.md) auf echtem Handy und Windows-PC bestanden sind (keiner ist bisher gelaufen).
- **Website neu gedacht** ([design/site/RETHINK.md](design/site/RETHINK.md), PR #694): Richtung „Ein Tag“ mit der Tabelle „Was ins Netz geht“, Aussage „Eine Sache zuerst.“; Start, `/module`, `/daten`, `/unterstuetzen`, `/install` und Rechtliches in neuer Form, de und en, ohne ein App-Bild. Sechs Bild-Slots sind gezeichnet gefüllt; echte Bilder kommen über [design/site/SLOTS.md](design/site/SLOTS.md), sobald die App steht (ersetzt Runde 5, Paket 1).
- **Modul Uhr** ([features/clock.md](features/clock.md)): Paket 1 auf `develop`; Folge-Prompts in [product/clock/](product/clock/01-followups.md), nicht gestartet.
- **CI aufräumen, Runde 3** ([perf/CI-2026-11.md](perf/CI-2026-11.md)): Ursache ist die Warteschlange (20 Runner, 22 % der Zeit voll); kleine Workflow-Änderungen in #692, fünf Übergabe-Pakete in [perf/CI-2026-11-PACKAGES.md](perf/CI-2026-11-PACKAGES.md); messen: `node scripts/ci/measure.mjs`.
- **UI schärfen, Runde 6** ([qa/round-6/STATUS.md](qa/round-6/STATUS.md)): alle acht Fix-PRs auf `develop`; offen U41 Kopfbandhöhen (`fix/ui6-head-heights`) und der Sammel-PR `fix/ui6-followups`.

## Abgeschlossene Runden (je eine Zeile; alles auf `develop`)

- Musik: Cover für Playlists, Alben und Songs in allen Listen ([features/spotify.md](features/spotify.md)); offen: Handtest MU-C1 mit echtem Konto, Cover der von Spotify erzeugten Playlists (Daily Mix, Radio).
- Heimnetz-Sync (LAN-Hub, Koppeln, zweiter PC, „Nur im WLAN“): [design/sync-lan/CONCEPT.md](design/sync-lan/CONCEPT.md). Nicht gebaut: Abgleich ganz im Hintergrund.
- Use case „Kopf leer“ (Pakete 1–4, Nachlese, nachgemessen): [design/usecases/kopf-leer/TARGET.md](design/usecases/kopf-leer/TARGET.md).
- Erstkontakt-Runde 5 (Personen A–D, Installation ohne Hilfe, Dev-Preview-Erststart): [`docs/qa/round-5.md`](qa/round-5.md).
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
- Docs-Diät 2026-11 (Startkosten eines Chats, CHATS/STATUS gekürzt, abgeschlossene Arbeitsordner entfernt; Paket 4: Design-Runden 1–7, Lesbarkeitsplan, Visual-Audit und Cleanup 2026-10-03 in DESIGN-SPEC, `howto/known-duplicates.md` und ROADMAP zusammengefasst): [meta/DOCS-DIET-2026-11.md](meta/DOCS-DIET-2026-11.md).

## Offen – macht Sven

Was nur du tun kannst, dauerhaft bis zum Launch. Offene PRs, Entscheidungen und kleine Handgriffe stehen in [CHATS.md](CHATS.md) „Wartet auf Sven“. In 15 Minuten machbar: 1–4. Website-Build (`nemo-site`): [howto/cloudflare-checks.md](howto/cloudflare-checks.md).

1. **Repo-Auftritt setzen (kein API-Zugriff durch Sessions):** Beschreibung (Englisch), Website, Topics, Social Preview (`docs/brand/social-preview.png`, jetzt mit englischem Claim) und Sponsor-Button: Texte zum Einfügen in [meta/REPO-SETTINGS.md](meta/REPO-SETTINGS.md).
2. Kontakt-Adresse in [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) eintragen (Platzhalter).
3. Release `v0.3.1` kurz prüfen: Checkliste RL-R1 in [MANUAL-TESTS.md](MANUAL-TESTS.md) (Download, Start, Version im Über-Dialog).
4. Fehlerberichte ([howto/bug-reports.md](howto/bug-reports.md)): echte Adresse als `REPORT_MAIL` in `web/src/core/diagnostics/config.ts` eintragen (mit `.invalid` bleibt „Per Mail melden“ ausgeblendet).
5. **TODO Rechtliches vor dem Launch** ([Checkliste](legal/LAUNCH-LEGAL-CHECKLIST.md)): Name und Anschrift stehen als Cloudflare-Pages-Variablen `IMPRESSUM_NAME`/`IMPRESSUM_STREET`/`IMPRESSUM_POSTCODE_CITY` (Production seit 04.11.; **auch in Preview setzen**, sonst bleibt `main` rot; nicht im Repo; `cd web && npm run check:legal` prüft den Rest), `[[RECHTSGRUNDLAGE]]` in [DATA-FLOWS](legal/DATA-FLOWS.md) füllen; der Release-Workflow bricht das Veröffentlichen ab, solange welche offen sind. Markenname „Nemo“ prüfen.
6. Handtests aus dem Launch-Review (X1 Pipe auf Windows mit zweitem Nutzer, V1 Credential-Manager nach „Alle Daten löschen“, Android-APK-Update): LR1–LR3 in [MANUAL-TESTS.md](MANUAL-TESTS.md) (Windows und Android → „Launch-Review“).
7. [LAUNCH-CHECKLIST](LAUNCH-CHECKLIST.md) auf frischer Windows-VM und Android-Gerät abhaken (Installation, SmartScreen, Update N→N+1, Deinstallation, Sicherer Modus).
8. Update-Test auf echten Geräten (Windows, Android), Einrichtungsassistent EA-E1–EA-E5, Google-Verbindung einrichten: Anleitungen in [MANUAL-TESTS.md](MANUAL-TESTS.md) → „Anleitungen für Sven“.
9. Datenträger: Checkliste DT-D1–DT-D20 (dazu ZO-D13–ZO-D15) in [MANUAL-TESTS.md](MANUAL-TESTS.md) auf einem echten Windows-Rechner abarbeiten (Windows-Code ist nur per `cargo check --target x86_64-pc-windows-msvc` geprüft, nicht ausgeführt).
10. Übrige Hardware-Checklisten in [MANUAL-TESTS.md](MANUAL-TESTS.md) abarbeiten (N1–N13, GV-C7, LT-L4, FO-F1–FO-F11 Fokushilfen …), Fehler melden; dabei unverifizierte Adressen/Formate mit echten Daten prüfen (N1, GV-C7, LT-L4, Provider-Endpunkte) und die Browser-Erweiterung (X1–X14).
11. Supporter-Modus ([howto/supporter.md](howto/supporter.md)): Ko-fi-Seite und „Code erneut senden“-Seite sind in `supporterLinks.ts` eingetragen; vor dem Release mit einer echten Spende testen (Mail kommt an, Code wird akzeptiert, `/resend`).
12. Supporter-Modus: Webhook-Dienst deployen: Schritt für Schritt in [services/supporter-webhook/README.md](../services/supporter-webhook/README.md) (Cloudflare-Konto, KV und Queues anlegen, Secrets setzen, Resend mit verifizierter Domain, Webhook-URL und Token bei Ko-fi eintragen, Test-Spende). Vorher prüfen, dass die Feldnamen der echten Ko-fi-„Send test“-Nachricht zu `src/kofi.ts` passen (Schritt 15 der Anleitung).
13. Supporter-Modus: Steuerliche und rechtliche Klärung (Impressum, Datenschutzhinweis für den Mailversand): Checkliste in [legal/SUPPORTER-NOTES.md](legal/SUPPORTER-NOTES.md). README-Abschnitt „Unterstützen“ erst mit der Zahlungsseite veröffentlichen.
14. **GitHub-Repo umbenennen (optional).** Betrifft `REPO` (`core/update/github.ts`), den Updater-Endpunkt in `tauri.conf.json`, `RELEASES_PREFIX` in `update.rs`, README-Links und den Link-Check. GitHub leitet alte URLs zwar um, aber ein Update-Endpunkt darf nie kaputtgehen: erst einen Plan mit Übergangs-Release schreiben lassen, dann umbenennen.

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
- Aus PR #2 zurückgestellte Vorschläge: TypeScript 7 / `@types/node` 26, Vitest-`node`-Projekt für reine Logiktests, `windows`-Crate 0.61 → 0.62 (nur per CI prüfbar). `serde_json` bleibt: `tauri::generate_context!` braucht es.
- Der Android-Keystore wurde am 07.10. neu angelegt (altes Passwort verloren): v0.3.1-Installationen lassen sich nicht aktualisieren, vorher Backup in der App, deinstallieren, neu installieren, Backup einspielen.
- Release-Dateinamen: Die Rust-/TS-Allowlists (`PORTABLE_ASSETS`, `APK_ASSET_PAIRS`) nennen den Altnamen noch, harmlos, später entfernbar. Optional: MCP-Variablen `NEMO_TOKEN/NEMO_URL` als Alias zu `TASCHENMESSER_*`.
- Vorschlag offen (aus PR #3): ToDo-Board mit Listen als Spalten.
- Vor dem nächsten Release: Docker-Image des Sync-Servers einmal bauen und starten (Node 26 als Toolchain, [decisions/distribution.md](decisions/distribution.md)).
- Versionsnummern: Git-Tags enden bei `v0.3.1`; `web/package.json` und `CHANGELOG.md` nennen `1.0.0`. Vor dem nächsten Release klären, welche Nummer gilt.

## Modul-Review 2026-10-01

Zielbild B ist umgesetzt (Pakete 1–6 auf `develop` gemergt, Paket 7 Passwort-Check mit optionalem Datenleck-Abgleich in `accounts` gebaut); offen sind die Roadmap-Punkte ohne Datum (K3 Anhänge in Sync/Backup, M2 Kalender ziehen/ändern, M3 Budget-Übertrag, Nachrichten als optionale Erweiterung): [product/MODULE-PLAN.md](product/MODULE-PLAN.md).

## Nächste sinnvolle Schritte

Neben CHATS „Wartet auf Sven“ und der Liste oben: Kaltstart/Precache weiter verbessern, [perf/COLD-START-2026-10.md](perf/COLD-START-2026-10.md).

## Fertig (eine Zeile je Release; Details: [CHANGELOG](../CHANGELOG.md), Arbeitsprotokoll bis 0.3.1: [archive/2026-10/STATUS-done-until-0.3.1.md](archive/2026-10/STATUS-done-until-0.3.1.md))

- `v0.2.0` (2026-09-30): Phasen 1–13 (Fundament bis Passwort-Tresor, Sync/Backup, KI-Assistent + Router, Tauri-Shell, Releases, Selbst-Update), KI-Import (JSON, lokale Import-API, `mcp/`).
- `v0.3.0-beta.1` (2026-09-30) / `v0.3.0` (2026-10-01): Nemo-Rebranding, Einrichtungsassistent, Schnell erfassen, Datenträger/Systeminfo (Windows), Vorrat, Zeiterfassung, Geschenkideen, Werkzeuge, flaches Design „Klar“, Übersicht + Widgets, Dev-Preview, MIT.
- `v0.3.1` (2026-10-01, aktuell): neue Wortmarke, Clownfisch-Icon, Sicherheits-/Abhängigkeitskorrekturen.
- Seit `v0.3.1` auf `develop`: siehe „Abgeschlossene Runden“ oben und [CHANGELOG](../CHANGELOG.md).
