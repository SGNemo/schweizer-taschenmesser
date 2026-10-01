# Archive: STATUS "Fertig" and round logs until v0.3.1

Moved unchanged from `docs/STATUS.md` on 2026-10-01 (release `v0.3.1`). Release summaries: [CHANGELOG](../../../CHANGELOG.md). Current status: [STATUS](../../STATUS.md).

## Fertig
- Phasen 1–13: Fundament, Kernmodule, Finanzen/Rechnungen/Abos, Sync + Backup (E2E-verschlüsselbar), KI-Assistent + Multi-Provider-Router, Extra-Module, Tauri Desktop (portable exe) + Android, CI/signierte Releases, Selbst-Update, Passwort-Tresor inkl. OS-Keystore/Biometrie, Startdaten-Assistent, Verbindungen (Google, ICS), Nachrichten, Werkzeuge, Links/Teilen/Launcher. Notizen je Phase: [`architecture.md`](../../architecture.md).
- Einrichtungsassistent (`core/setup/`, `layout/setup/`): manuell startbar (Settings, Palette, Dashboard-Karten), jederzeit abbrechbar, Fortschritt geräte-lokal; Schritte Grundlagen, Sync/Wiederherstellung, Profile, Werkzeuge, Tresor, KI-Anbieter, Verbindungen, Startdaten, Import per KI, Benachrichtigungen, Backup/Updates, Dashboard; Checkliste im Dashboard; `setupSteps` an Manifesten. Details: `ARCHITECTURE-MAP.md`, `DECISIONS.md`, `HOW-TO.md`.
- Layout-System (`PageContainer`, PR #3), Aufräumen + Doku-Split (PR #2).
- KI-Import-Runde (PR #4): JSON-Import je Modul, lokale Import-API (nur Desktop, Loopback, Tokens, Vorschau/Undo), MCP-Wrapper `mcp/`, Anleitung [`AI-IMPORT.md`](../../AI-IMPORT.md).
- Releases: `v0.2.0-beta.1`, `v0.2.0-beta.2` (erste portable Version), `v0.2.0`, `v0.3.0-beta.1` (Pre-Release), `v0.3.0` (stabil, erstes Release unter dem Namen Nemo), `v0.3.1` (stabil, neue Wortmarke).
- Review-Runde 2026-09-30 (Branch `chore/nemo-review-polish`): Review des Rebrandings ([`REVIEW-2026-09-30.md`](REVIEW-2026-09-30.md)), Korrekturen (IDs gepinnt, Legacy-Fixtures, Release-Prüfung, Android-Icons in die APK, Benachrichtigungs-Icon), Design „Klar“ + neues Logo „Welle“ ([`DESIGN-CONCEPT-2026-09-30.md`](DESIGN-CONCEPT-2026-09-30.md)), Aufräumen (tote Exporte/Strings, `pad2`, E2E-Helfer, CI-Caches), [`ROADMAP.md`](../../ROADMAP.md), kurze README + `docs/user/`, MIT-Lizenz, CHANGELOG/CONTRIBUTING/SECURITY, Issue-/PR-Vorlagen.

## Home-Screen-Runde (Branch `feat/home-screen`)
- Übersicht ist kein Modul mehr (`web/src/home/`): Startroute, Logo-Klick, Alt+Pos1, abgesetzter Navigationsblock; Widgets für alle Module (Tresor, Datenträger, Systeminfo mit Status-Widgets, Fallback-Widget); eigener Bearbeitungsmodus (Reihenfolge, Größe S/M/L, Widget-Liste, Zurücksetzen); Konfiguration synchronisiert (Scope `home`, alter Scope `dashboard` wird migriert).
- Widget-Pflicht abgesichert: Typ, `validateManifest`, `npm run check:modules` (CI), `widgets.test.tsx`, Generator/Template, PR-Vorlage.

## Diese Runde (Branch `feat/disk-cleaner-and-modules`)
- **Datenträger** (nur Desktop): Laufwerkskarten, paralleler Rust-Scan (Fortschritt, Pause, Abbruch, „Nicht gelesen“-Liste), Treemap + Liste + Schnellfilter + Details, Auswahl-Korb, Löschen in den Papierkorb (Standard) oder endgültig mit Sperrliste, Tippbestätigung, Bericht; Aufräum-Helfer (bekannte Temp-/Cache-Ordner, leere Ordner, doppelte Dateien).
- **Systeminfo** (nur Desktop), **Zeiterfassung**, **Vorräte** (mit Weitergabe an die Einkaufsliste), **Geschenkideen**; Werkzeuge **Text**, **Zeitzonen**, **Bilder verkleinern**, **PDF**.
- `manifest.platforms` + `availableManifests()`; Tauri-Befehle einzeln freigegeben (`build.rs`, `capabilities/desktop.json`); DB-Version 13.
