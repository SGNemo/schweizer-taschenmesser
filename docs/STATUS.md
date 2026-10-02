# Status – Nemo

Letztes Release: `v0.3.1` am 2026-10-01 (stabil, auf `main`; `releases/latest` zeigt darauf; Nemo-*- und Taschenmesser-*-Assets, `latest.json`). Keine offenen Issues, keine offenen PRs (geprüft bei Erstellung dieser Datei).

## Fertig (eine Zeile je Release; Details: [CHANGELOG](../CHANGELOG.md), Arbeitsprotokoll bis 0.3.1: [archive/2026-10/STATUS-done-until-0.3.1.md](archive/2026-10/STATUS-done-until-0.3.1.md))
- `v0.2.0` (2026-09-30): Phasen 1–13 (Fundament bis Passwort-Tresor, Sync/Backup, KI-Assistent + Router, Tauri-Shell, Releases, Selbst-Update), KI-Import (JSON, lokale Import-API, `mcp/`).
- `v0.3.0-beta.1` (2026-09-30) / `v0.3.0` (2026-10-01): Nemo-Rebranding, Einrichtungsassistent, Schnell erfassen, Datenträger/Systeminfo (Windows), Vorrat, Zeiterfassung, Geschenkideen, Werkzeuge, flaches Design „Klar“, Übersicht + Widgets, Dev-Preview, MIT.
- Auf `develop` (noch nicht released): Testdaten für alle Module (Seed-Vertrag, Dev-Preview füllt leere App, Einstellungen → Entwickler).
- Design „Klar 2“: Tokens (#43), Bereiche + Shell (#45), Basis-Komponenten (#48) auf `develop`. Einstellungen: Kategorien + Registry (`feat/settings-overhaul`).
- Paket 1 „Aufräumen“ (0.4.0, `feat/cleanup-package-1`): Module stillgelegt, Werkzeuge 18 → 12, Zettel, „Dieser PC“.
- `v0.3.1` (2026-10-01, aktuell): neue Wortmarke, Clownfisch-Icon, Sicherheits-/Abhängigkeitskorrekturen.

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

## Bekannte Probleme / Hinweise
- README-Download-Badges zeigen auf das neueste *stabile* Release und funktionieren jetzt (seit `v0.2.0`).
- TypeScript ist auf 6.0.x gepinnt (typescript-eslint unterstützt `<6.1`).
- Aus PR #2 zurückgestellte Vorschläge: TypeScript 7 / `@types/node` 26, zxcvbn-Wörterbücher aus dem Precache nehmen (Entscheidung nötig, ~2,5 MB beim ersten Laden), Vitest-`node`-Projekt für reine Logiktests, `windows`-Crate 0.61 → 0.62 (nur per CI prüfbar). Erledigt 2026-09-30: JS-Plugin-Bumps (`plugin-http` 2.8.0, `plugin-opener` 2.7.0; die Rust-Seite bleibt `~2.7`, siehe Cargo), CI-Caching. `serde_json` bleibt: `tauri::generate_context!` braucht es.
- Commit `792e7aa` (Logo) hat zwei durch Shell-Backticks verschluckte Wörter im Text („after . Logo gets a prop“) – bewusst nicht per Force-Push korrigiert.
- Aus PR #3 offene Vorschläge: globaler „+“-FAB ab 900 px durch „+ Neu“ in der Top-Bar ersetzen; ToDo-Board mit Listen als Spalten.

## Modul-Review 2026-10-01 (entschieden, Doku-PR, noch nicht umgesetzt)
Zielbild B: 9 Nav-Einträge + „Dieser PC“; Gruppen „Geld“ und „Listen“; Verschmelzungen Erinnerungen → Kalender, Einkauf + Packlisten → Listen, Apps & Links → Merkliste, Geburtstage + Geschenke → Personen, Verträge → Unterlagen, Systeminfo → Datenträger; Nachrichten, Habits, Zeiterfassung werden stillgelegt (Tabellen bleiben bis Paket 6); Werkzeuge 18 → 12. Pakete, Versionen (0.4 … 0.7, `feat!:`) und Prompts: [product/MODULE-PLAN.md](product/MODULE-PLAN.md), [product/IMPLEMENTATION-PROMPT.md](product/IMPLEMENTATION-PROMPT.md). Funde der Review: alle behoben oder bewusst belassen (Fund 9 = gewollt, Fund 10 für bleibende Module erledigt; die Texte der zu ersetzenden Module ziehen mit ihren Paketen um). Reihenfolge mit der Design-Spezifikation: Design-PR 1 + 2 → Paket 1 → Design-PR 3 + 4 → Pakete 3–5; Design-PRs 5b/5c/5d nur für bleibende Module (Review Abschnitt 25).

## Nächste sinnvolle Schritte
0. Paket 1 „Aufräumen“ aus [product/IMPLEMENTATION-PROMPT.md](product/IMPLEMENTATION-PROMPT.md) starten (eigener Chat, Hotspots Router/Nav/Settings).
1. Hardware-Checklisten ([MANUAL-TESTS.md](MANUAL-TESTS.md)) abarbeiten (Sven), Fehler melden.
2. Update-Test auf echten Geräten mit dem nächsten Release (Schritte unter „Offen – macht Sven").
3. Einrichtungsassistent: offene Kleinigkeiten – Link „Einrichtung öffnen“ in den Leerzuständen der einzelnen Module (12 Seiten mit `StartDataButton`), Verbindungs-/Import-Schritte per Android-Zurück-Geste (Import-Dialog über dem Assistenten), automatische Backups als eigenes Feature.
4. Unverifizierte Adressen/Formate mit echten Daten prüfen (N1, C7, L4, Provider-Endpunkte).
5. Browser-Erweiterung auf echter Hardware prüfen (Checkliste X1–X14 in [MANUAL-TESTS.md](MANUAL-TESTS.md)), dann Store-/Release-Zip-Entscheidung.
6. Entscheidungen: Spotify-Widget (L5), Precache der Wörterbücher, FAB-Änderung.

## Manuelle Tests offen
Hardware-Checklisten (D1–D16, E1–E5, N1–N13, C7, L4 …): vollständig in [MANUAL-TESTS.md](MANUAL-TESTS.md).

## Offen – macht Sven
0. **Repo-Auftritt setzen (kein API-Zugriff durch Sessions):** GitHub → Settings → *Social preview*: `docs/brand/social-preview.png` hochladen. Repository-Beschreibung: „Nemo – modulare, lokale Alltags-App: Kalender, ToDos, Finanzen, Passwörter und mehr. Windows portable, Android, PWA. Daten bleiben auf dem Gerät.“ Topics: `local-first`, `pwa`, `tauri`, `react`, `typescript`, `rust`, `android`, `windows`, `offline-first`, `personal-finance`, `todo`, `calendar`, `password-manager`, `self-hosted`, `privacy`. Website-Feld: `https://github.com/SGNemo/schweizer-taschenmesser/releases/latest`. Danach in den Repo-Settings *Private vulnerability reporting* einschalten (SECURITY.md verweist darauf).

**Neu (Datenträger):** Die Checkliste D1–D16 in [MANUAL-TESTS.md](MANUAL-TESTS.md) auf einem echten Windows-Rechner abarbeiten (Windows-Code ist nur per `cargo check --target x86_64-pc-windows-msvc` geprüft, nicht ausgeführt). Windows-Portable-Größe vorher/nachher: nur der Release-Workflow kann sie messen (Dry-Run auf `develop`, siehe HOW-TO).

> **Stand v0.3.1:** Die Schritte 1, 5 und 7 stammen aus der Beta-Phase (`0.2.0-beta.x`); die Tags `v0.2.0`, `v0.3.0`, `v0.3.1` sind inzwischen veröffentlicht, das neueste stabile Release ist `v0.3.1`. Sinngemäß heute: neueste Version von der Release-Seite installieren, für den Update-Test später ein neues Release schneiden (Rezept: [howto/release-deps.md](howto/release-deps.md)); der Text unten bleibt als Ablauf erhalten.

Installation und Update auf echten Geräten (Windows und Android) – Schritt für Schritt:

1. **Dateien holen (Pre-Release).** GitHub → Repository → *Releases* → das neueste Pre-Release. Die README-Badges („Windows (portabel) herunterladen" …) zeigen auf das *neueste stabile* Release und funktionieren erst, wenn es ein stabiles Release gibt – bis dahin die Dateien direkt von der Release-Seite laden: `Nemo-Portable.exe` (Windows) und `Nemo.apk` (Android); die `Taschenmesser-*`-Dateien im selben Release sind identische Kopien für alte Installationen. Prüfsumme optional: `Nemo.apk.sha256`.
2. **Von der installierten Windows-Version umsteigen (einmalig, `0.2.0-beta.1` kann sich nicht selbst auf die portable Datei aktualisieren).** (a) Alte App: Einstellungen → Backup → exportieren. (b) `Nemo-Portable.exe` in einen beschreibbaren Ordner legen und starten (SmartScreen: „Weitere Informationen" → „Trotzdem ausführen"; die Datei hat kein Authenticode-Zertifikat, der Update-Inhalt ist mit dem Updater-Key signiert). Die Daten sind sofort da. (c) Alte Version deinstallieren – **„Anwendungsdaten löschen" nicht ankreuzen.** Einstellungen → „App-Updates" zeigt die Version.
3. **Android installieren.** `Nemo.apk` aufs Handy laden und öffnen. Beim ersten Mal „Installation aus unbekannten Quellen" für den Browser/Dateimanager erlauben, dann installieren. Öffnen → Einstellungen → „App-Updates" zeigt die Version. (Vorherige Debug-/anders signierte Version vorher deinstallieren.)
4. **Etwas Testdaten anlegen** (ein ToDo, eine Notiz, ein KI-Anbieter, optional ein Tresor-Eintrag), damit man nach dem Update sieht, dass nichts verloren geht.
5. **Nächstes Pre-Release erzeugen (der Update-Test).** Auf deinem Rechner im Repo: `cd web && npm run version:set -- 0.2.0-beta.3`, dann `git commit -am "chore(release): 0.2.0-beta.3"`, `git tag v0.2.0-beta.3`, `git push origin develop v0.2.0-beta.3`. Der Workflow *Release* baut, prüft (Secret-Scan + Artefakt-Audit), veröffentlicht und prüft danach alle Download-Links (~15 Min.; Fortschritt unter *Actions*). Oder sag mir Bescheid, dann mache ich das.
6. **In der portablen App aktualisieren.** Einstellungen → „App-Updates" → Kanal **Beta** wählen → „Jetzt prüfen" → Banner „Update verfügbar" mit Änderungsliste → „Jetzt aktualisieren".
   - *Windows:* Backup (`%APPDATA%\io.github.sgnemo.taschenmesser\backups\pre-update-…json`), Download, Signaturprüfung, die exe ersetzt sich selbst und startet neu. Version stimmt, Daten sind da. ☐
   - *Android:* Backup → Download → Android-Installer öffnet sich → „Aktualisieren". Beim ersten Mal ggf. „Installation aus dieser Quelle erlauben" aktivieren, zurück in die App und nochmal „Jetzt aktualisieren". Danach neue Version, Daten sind da. ☐
7. **Stabil-Kanal prüfen (optional).** Kanal „Stabil" zeigt die Beta nicht an; erst ein Tag `v0.2.0` (ohne Suffix) wird dort angeboten, und die README-Download-Badges gehen dann.
8. **Rückmeldung.** Klappt etwas nicht: Fehlermeldung/Screenshot und Gerät nennen. Die Update-Logik ist Unit-getestet, aber Austausch der laufenden exe, Installer-Übergabe (Android) und Signaturprüfung sind erst hier real geprüft. Danach die Checklisten in [MANUAL-TESTS.md](MANUAL-TESTS.md) durchgehen.

9. **Einrichtungsassistent prüfen.** Die Punkte E1–E5 in [MANUAL-TESTS.md](MANUAL-TESTS.md) auf Windows-Portable und Android durchgehen (frische Installation und eine mit Daten).

### Nemo-Rebranding
10. **GitHub-Repo umbenennen (optional).** Betrifft `REPO` (`core/update/github.ts`), den Updater-Endpunkt in `tauri.conf.json`, `RELEASES_PREFIX` in `update.rs`, README-Links und den Link-Check. GitHub leitet alte URLs zwar um, aber ein Update-Endpunkt darf nie kaputtgehen: erst einen Plan mit Übergangs-Release schreiben lassen, dann umbenennen.
11. **Download-Buttons der README:** erledigt – README und `docs/user/installation.md` verlinken seit dem Folge-PR `Nemo-Portable.exe` / `Nemo.apk` (das neueste stabile Release trägt beide Namen). Die `Taschenmesser-*`-Kopien entfallen ab dem nächsten Release (siehe 13); `v0.3.1` und älter behalten ihre Dateien.
12. **Social-Preview hochladen:** `docs/brand/social-preview.png` in GitHub → Settings → Social preview.
13. **Erledigt (ab dem nächsten Release nach `v0.3.1`):** Releases tragen nur noch `Nemo-*`; `latest.json` zeigt auf `Nemo-Portable.exe`. Folge: Installationen ≤ 0.2.x können sich nicht mehr selbst aktualisieren (Neuinstallation nötig); Clients ab 0.3.0 akzeptieren beide Namen. Offen: Die Rust-/TS-Allowlists (`PORTABLE_ASSETS`, `APK_ASSET_PAIRS`) nennen den Altnamen noch, harmlos, später entfernbar. Optional: MCP-Variablen `NEMO_TOKEN/NEMO_URL` als Alias zu `TASCHENMESSER_*`.

### Google-Verbindung einrichten (einmalig, für Kalender/Gmail)
1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt „Nemo".
2. *APIs & Dienste → Bibliothek*: „Google Calendar API" und „Gmail API" aktivieren.
3. *OAuth-Zustimmungsbildschirm* → Typ „Extern"; Name „Nemo", deine Adresse als Support-/Entwickler-Mail. *Bereiche*: `…/auth/calendar.readonly` und `…/auth/gmail.readonly` hinzufügen. **Veröffentlichungsstatus auf „In Produktion" stellen** (ohne Prüfung; beim Login erscheint eine Warnung „nicht überprüft", nur du selbst nutzt es). Im Status „Testing" laufen Refresh-Tokens nach 7 Tagen ab (dann „Neu anmelden").
4. *Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID* → Typ **Desktop-App**. Client-ID und Client-Secret kopieren und in der Windows-App unter Einstellungen → Verbindungen → Google eintragen (landen im Windows-Anmeldeinformationsspeicher, nicht im Repo).
5. **Ungetestet/prüfen:** ob `gmail.readonly` bei einer unverifizierten „In Produktion"-App wie erwartet funktioniert. Wenn nicht: Status auf „Testing" lassen und deine Adresse als Testnutzer eintragen.
6. Android: Google-Login gibt es dort noch nicht; auf dem Handy kommen Termine über die Synchronisierung (sie liegen in einer synchronisierten Sammlung) oder über ein Kalender-Abo (ICS) an.
