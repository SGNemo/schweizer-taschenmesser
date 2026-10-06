# Status – Nemo

Letztes Release: `v0.3.1` am 2026-10-01 (stabil, auf `main`; `releases/latest` zeigt darauf; Nemo-*- und Taschenmesser-*-Assets, `latest.json`). Keine offenen Issues, keine offenen PRs (geprüft bei Erstellung dieser Datei).

## Nächste eine Sache
Fehlerberichte und Absturzfestigkeit (PRs #84, #85, #87 und dieser): Diagnose mit Vorschau, „Fehler melden“, Modul-Fehlerkarte, Wiederherstellungsbildschirm, Sicherer Modus, Backup-Fixtures 0.3.x, E2E „frische Installation“, `npm run test:update-path`, [LAUNCH-CHECKLIST](LAUNCH-CHECKLIST.md); offen: Rust-Panic-Hook und Logdatei im Datenordner, Cargo-Build in CI prüfen.

Fokus- und Aufmerksamkeitshilfen: Paket 1 „Anfangen“ ist gebaut (PR gegen `develop`, wartet auf Review/Merge); danach Paket 2 „Erinnerungen“. Plan: [features/focus-aids.md](features/focus-aids.md).

Optik-Politur und Benachrichtigungs-Zentrum (`fix/visual-polish-notifications`): PR gegen `develop`, wartet auf Review; Audit [design/VISUAL-AUDIT-2026-10-03.md](design/VISUAL-AUDIT-2026-10-03.md), Handtests V1–V4 in [MANUAL-TESTS.md](MANUAL-TESTS.md).

KI-Eintragen (PR A, Branch `feat/ai-write-local-model-chat`): Sätze in der Leiste werden zu Einträgen/Änderungen/Löschungen mit Vorschau (Regeln → Cloud-Fallback, jede Antwort mit Stufe und Statistik); Regel-Trefferquote jetzt an drei Sätzen gemessen (Tuning, Held-out, Blind; erste Blind-Messung 97,4 %, 1 Fehlgriff bei Fragen); PR B (Branch `feat/ai-local-model`): lokales Modell als Stufe 1 (Rust-Laufzeit hinter Cargo-Feature, Einstellungen, Download mit Zustimmung/Prüfsumme, Mess-Harness); Modellwahl steht aus; PR C (Branch `feat/ai-chat-module`, gestapelt auf B): Chat-Modul (mehrere Chats, lokales Modell oder Anbieter, Daten aus Modulen nur freiwillig mit Vorschau, sicheres Markdown, Export). Handtests K1–K4 in [MANUAL-TESTS.md](MANUAL-TESTS.md).

Lesbarkeit (`feat/readability`): Lesehilfe für jeden Text (Umfang 25–100 %, Einstellungen → Darstellung → Lesen), Farben nur mit Bedeutung, gruppierte Listen, Bereichsfarben in Navigation und Modul-Bibliothek; PR gegen `develop`, wartet auf Review; Handtests L1–L4 in [MANUAL-TESTS.md](MANUAL-TESTS.md), Entwurf [design/READABILITY-PLAN.md](design/READABILITY-PLAN.md).

KI abschalten (`feat/ai-off`): ein umkehrbarer Hauptschalter in Einstellungen → KI, löscht Schlüssel, Cache, Statistik und API-Tokens; PR gegen `develop`, wartet auf Review; Handtests A1–A2 in [MANUAL-TESTS.md](MANUAL-TESTS.md).

## Heute möglich in 15 Minuten
1. Social-Preview hochladen: GitHub → Settings → *Social preview* → `docs/brand/social-preview.png` (Punkt 0 unten).
2. Release `v0.3.1` kurz prüfen: Checkliste R1 in [MANUAL-TESTS.md](MANUAL-TESTS.md) (Download, Start, Version im Über-Dialog).
3. Offene PRs ansehen: Liste „Wartet auf Sven“ in [CHATS.md](CHATS.md).

Website (`feat/website`, `site/`): statische Seite mit Download, Ko-fi, Impressum/Datenschutz-Platzhaltern, DE/EN; PR gegen `develop`, wartet auf Review; danach Cloudflare-Pages-Projekt, Domain und Deploy-Hook einrichten ([site/README.md](../site/README.md) → „Offen – macht Sven“).


## Nicht gebaut / bekannte Grenzen
- Google-Drive-Sync-Adapter (nur `core/sync/adapters/googleDrive.stub.ts`), Binär-Anhänge im Sync, Tombstone-GC, Mehrmandanten-Server.
- Browser-Erweiterung: nur Brave/Chromium (MV3); Firefox, Safari, Store-Veröffentlichung (Chrome Web Store/Edge Add-ons, eigene Erweiterungs-ID → Allowlist), Release-Zip in `release.yml` (Vorschlag in [howto/browser-extension.md](howto/browser-extension.md)) offen; mehrstufige Logins und Felder in geschlossenen Shadow-Roots werden nicht erkannt.
- Android: Autofill-Dienst (Folge-PR geplant, Notiz in [ROADMAP.md](ROADMAP.md)); bis dahin Kopieren mit sensibler Zwischenablage, per Erweiterung gespeicherte Einträge kommen per Sync aufs Handy.
- Google-Login auf Android, zweiseitiger Kalender-Sync, FinTS/PSD2, Mail-Body-Parsing.
- Spotify-Connector (bewusst nicht gebaut), natives Android-Share-Target für die APK.
- Windows-Binaries ohne Authenticode-Zertifikat (SmartScreen-Warnung); Pre-Update-Backups liegen im `%APPDATA%`-Ordner, auch im portablen Modus.
- Providerdaten (Modellnamen, Preise, Limits, CORS aus der PWA), Bankdatei-Spaltennamen und Launcher-Adressen sind unverifiziert (siehe [MANUAL-TESTS.md](MANUAL-TESTS.md)).
- Geräteverhalten der nativen Shells (Windows Hello, Android-Keystore/Biometrie, Update-Austausch, Push) nur von Hand prüfbar.
- Einrichtungsassistent: keine automatischen lokalen Backups, keine App-Sperre, kein Screenshot-Schutz-Schalter (gibt es in der App nicht; der Assistent zeigt nur Vorhandenes). Kein Ollama-CORS-Workaround im Browser (Erkennung ist Best-Effort). Hinweise zu genauen Alarmen/Akku-Optimierung sind nur Text (keine Plugin-API geprüft/gebaut). Wochenstart nur im Kalender (KI-Zeiträume rechnen weiter mit Montag).

- Supporter-Modus: Webhook-Dienst ist gebaut, aber noch **nicht deployt** (Anleitung: [services/supporter-webhook/README.md](../services/supporter-webhook/README.md)); bis dahin Codes per CLI von Hand ([howto/supporter.md](howto/supporter.md)). Icon-Varianten (Android-Activity-Alias, Tray) bewusst nicht gebaut.

## Bekannte Probleme / Hinweise
- README-Download-Badges zeigen auf das neueste *stabile* Release und funktionieren jetzt (seit `v0.2.0`).
- TypeScript ist auf 6.0.x gepinnt (typescript-eslint unterstützt `<6.1`).
- Aus PR #2 zurückgestellte Vorschläge: TypeScript 7 / `@types/node` 26, zxcvbn-Wörterbücher aus dem Precache nehmen (Entscheidung nötig, ~2,5 MB beim ersten Laden), Vitest-`node`-Projekt für reine Logiktests, `windows`-Crate 0.61 → 0.62 (nur per CI prüfbar). Erledigt 2026-09-30: JS-Plugin-Bumps (`plugin-http` 2.8.0, `plugin-opener` 2.7.0; die Rust-Seite bleibt `~2.7`, siehe Cargo), CI-Caching. `serde_json` bleibt: `tauri::generate_context!` braucht es.
- Commit `792e7aa` (Logo) hat zwei durch Shell-Backticks verschluckte Wörter im Text („after . Logo gets a prop“) – bewusst nicht per Force-Push korrigiert.
- Aus PR #3 offene Vorschläge: globaler „+“-FAB ab 900 px durch „+ Neu“ in der Top-Bar ersetzen; ToDo-Board mit Listen als Spalten.

## Modul-Review 2026-10-01 (entschieden, Doku-PR, noch nicht umgesetzt)
Zielbild B: 9 Nav-Einträge + „Dieser PC“; Gruppen „Geld“ und „Listen“; Verschmelzungen Erinnerungen → Kalender, (Einkauf + Packlisten → Listen, Apps & Links → Merkliste, Verträge → Unterlagen, Geburtstage + Geschenke → Personen: erledigt), Systeminfo → Datenträger; Nachrichten, Habits, Zeiterfassung stillgelegt und mit Paket 6 entfernt; Werkzeuge 18 → 12. Pakete (0.4 … 0.9) und Prompts: [product/MODULE-PLAN.md](product/MODULE-PLAN.md), [product/IMPLEMENTATION-PROMPT.md](product/IMPLEMENTATION-PROMPT.md). Review-Funde: alle behoben oder bewusst belassen. Reihenfolge mit der Design-Spezifikation: Design-PR 1 + 2 → Paket 1 → Design-PR 3 + 4 → Pakete 3–5; Design-PRs 5b/5c/5d nur für bleibende Module (Review Abschnitt 25).

## Nächste sinnvolle Schritte
0. Fokus- und Aufmerksamkeitshilfen: Paket 1 „Anfangen“ (Branch `feat/adhd-friendly`), danach Paket 2 Erinnerungen, 3 Erfassen/Ruhe, 4 Fortschritt – Plan: [features/focus-aids.md](features/focus-aids.md).
1. Hardware-Checklisten ([MANUAL-TESTS.md](MANUAL-TESTS.md)) abarbeiten (Sven), Fehler melden.
2. Update-Test auf echten Geräten mit dem nächsten Release (Schritte unter „Offen – macht Sven").
3. Einrichtungsassistent: offene Kleinigkeiten – Link „Einrichtung öffnen“ in den Leerzuständen der einzelnen Module (12 Seiten mit `StartDataButton`), Verbindungs-/Import-Schritte per Android-Zurück-Geste (Import-Dialog über dem Assistenten), automatische Backups als eigenes Feature.
4. Unverifizierte Adressen/Formate mit echten Daten prüfen (N1, C7, L4, Provider-Endpunkte).
5. Browser-Erweiterung auf echter Hardware prüfen (Checkliste X1–X14 in [MANUAL-TESTS.md](MANUAL-TESTS.md)), dann Store-/Release-Zip-Entscheidung.
6. Entscheidungen: Spotify-Widget (L5), Precache der Wörterbücher, FAB-Änderung.

## Manuelle Tests offen
Hardware-Checklisten (D1–D16, E1–E5, N1–N13, C7, L4, F1–F11 Fokushilfen …): vollständig in [MANUAL-TESTS.md](MANUAL-TESTS.md).

## Offen – macht Sven
0. **Repo-Auftritt setzen (kein API-Zugriff durch Sessions):** GitHub → Settings → *Social preview*: `docs/brand/social-preview.png` hochladen. Repository-Beschreibung: „Nemo – modulare, lokale Alltags-App: Kalender, ToDos, Finanzen, Passwörter und mehr. Windows portable, Android, PWA. Daten bleiben auf dem Gerät.“ Topics: `local-first`, `pwa`, `tauri`, `react`, `typescript`, `rust`, `android`, `windows`, `offline-first`, `personal-finance`, `todo`, `calendar`, `password-manager`, `self-hosted`, `privacy`. Website-Feld: `https://github.com/SGNemo/schweizer-taschenmesser/releases/latest`. Danach in den Repo-Settings *Private vulnerability reporting* einschalten (SECURITY.md verweist darauf).

**Neu (Datenträger):** Die Checkliste D1–D16 in [MANUAL-TESTS.md](MANUAL-TESTS.md) auf einem echten Windows-Rechner abarbeiten (Windows-Code ist nur per `cargo check --target x86_64-pc-windows-msvc` geprüft, nicht ausgeführt). Windows-Portable-Größe vorher/nachher: nur der Release-Workflow kann sie messen (Dry-Run auf `develop`, siehe HOW-TO).

- Update-Test auf echten Geräten (Windows, Android), Einrichtungsassistent E1–E5, Google-Verbindung einrichten: Anleitungen in [MANUAL-TESTS.md](MANUAL-TESTS.md) → „Anleitungen für Sven“.

### Nemo-Rebranding
10. **GitHub-Repo umbenennen (optional).** Betrifft `REPO` (`core/update/github.ts`), den Updater-Endpunkt in `tauri.conf.json`, `RELEASES_PREFIX` in `update.rs`, README-Links und den Link-Check. GitHub leitet alte URLs zwar um, aber ein Update-Endpunkt darf nie kaputtgehen: erst einen Plan mit Übergangs-Release schreiben lassen, dann umbenennen.
11. **Download-Buttons der README:** erledigt – README und `docs/user/installation.md` verlinken seit dem Folge-PR `Nemo-Portable.exe` / `Nemo.apk` (das neueste stabile Release trägt beide Namen). Die `Taschenmesser-*`-Kopien entfallen ab dem nächsten Release (siehe 13); `v0.3.1` und älter behalten ihre Dateien.
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
- Auf `develop` (noch nicht released): Testdaten für alle Module (Seed-Vertrag, Dev-Preview füllt leere App, Einstellungen → Entwickler).
- Design „Klar 2“: Tokens (#43), Bereiche + Shell (#45), Basis-Komponenten (#48) auf `develop`. Einstellungen: Kategorien + Registry (`feat/settings-overhaul`).
- Paket 1 „Aufräumen“ (0.4.0, `feat/cleanup-package-1`): Module stillgelegt, Werkzeuge 18 → 12, Zettel, „Dieser PC“.
- Pakete 3–6 (0.5.0–0.9.0): Listen, Unterlagen, Personen, Erinnerungen im Kalender, ToDo-Wiederholung; Paket 6: 15 alte Tabellen entfernt.
- Auf `develop`/PR: Fokus- und Aufmerksamkeitshilfen Paket 3 „Erfassen, Ruhe, Wiederfinden“ (Erfassen ohne Rückfrage, Eingang sortieren, Suchverlauf, Textgröße/Zeilenabstand/Bewegung, ruhige Übersicht; gestapelt auf Paket 2).
- Auf `develop`/PR: Fokus- und Aufmerksamkeitshilfen Paket 4 „Fortschritt“ („n in Folge“ mit Pausentag, Wochenrückblick, Tag abschließen, Routine-Vorlagen; gestapelt auf Paket 3).
- Auf `develop`/PR: Fokus- und Aufmerksamkeitshilfen Paket 2 „Erinnerungen“ (Ruhezeit, Limit, Später, Morgen-Übersicht, Erinnerungs-Karte, „Woran war ich?“; gestapelt auf Paket 1).
- Auf `develop`/PR: Fokus- und Aufmerksamkeitshilfen Paket 1 (Jetzt dran, Tagesplan, Fokusmodus, ruhiges „Jetzt wichtig“, Dauer pro ToDo, Zeit bis zum Termin; Einstellungen „Fokus & Aufmerksamkeit“).
- `v0.3.1` (2026-10-01, aktuell): neue Wortmarke, Clownfisch-Icon, Sicherheits-/Abhängigkeitskorrekturen.
