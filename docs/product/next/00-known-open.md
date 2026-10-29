# Bereits bekannt und offen (Inventar, 2026-10-16)

Grundlage für die Ideenrunde in [01-ideas.md](01-ideas.md): alles, was die Doku schon als offen, vorgeschlagen, halb fertig oder abgelehnt führt – damit nichts doppelt erfunden wird. Nur Doku gelesen, kein Code. Stand: `develop` @ ab077a6 (nach #176/#177). STATUS, ROADMAP, CHATS werden hier nicht wiederholt, nur ergänzt und korrigiert.

## 1. Was ausgeliefert ist
Bereiche nach [MODULE-PLAN](../MODULE-PLAN.md) und `decisions/ui-shell.md`:
- **Planen:** Kalender (Tab Erinnerungen), ToDos, Personen · **Geld:** Finanzen, Rechnungen, Abos, Budgets & Sparziele · **Haushalt:** Listen (Einkauf, Packliste, Checkliste), Vorräte · **Wissen:** Notizen (+ Zettel), Merkliste (+ Lesezeichen) · **Tresor:** Accounts, Unterlagen · **System (Desktop):** Dieser PC · außerhalb: KI-Chat.
- Standardmäßig an: Kalender, ToDos, Finanzen, Rechnungen, Abos (`user/modules.md`). Alles andere optional.
- 12 Werkzeuge: Rechner, Entwickler, Währung, Timer & Stoppuhr, QR, Einheiten, Datumsrechner, Zeitzonen, Würfel & Zufall, Text, Bilder, PDF.
- Stillgelegt (Tabellen entfernt): Nachrichten, Gewohnheiten, Zeiterfassung.

## 2. Gebaut vs. halb gebaut
| Bereich | Stand | Quelle |
|---|---|---|
| Komfort Module (Pakete 1a–8b) | gemergt (#155–#175); Reste siehe §3 | `comfort/03-results.md`, `07-summary.md` |
| Komfort Einstellungen/Bibliothek/Werkzeugkasten | gemergt (#132, #150, #151, #153, #168, #169); Handtests M1–M4 offen | `comfort/06-settings-results.md` |
| Fokus-Funktionen Runde 1 (Pakete 1–4) | gebaut; Handtests F1–F12 offen | `features/focus-aids.md` |
| Fokus-Audit 2 | Doku gemergt (#176); **Paket 1 „Defaults“ als PR #177 offen**, Pakete 2–4 folgen auf `feat/focus2-today|reminders|additions` | `focus/11-plan-2.md` |
| Design „Klar 2“, Visual-Audit, Lesbarkeit | gebaut; Visual #16–#18 offen | `design/VISUAL-AUDIT-2026-10-03.md` |
| Modulplan | Pakete 1–6 fertig, **Paket 7 Passwort-Gesundheit offen** | `MODULE-PLAN.md` |
| Sicherheits-Launch-Review | Phase 2 fertig; B-Liste offen | `security/LAUNCH-REVIEW-2026-10-06.md` |
| Cleanup 2026-10-03 | Phase 2 umgesetzt; Top-10-Refactors offen | `meta/IMPROVEMENTS-2026-10-03.md` |
| Lokales Modell | Qwen3 4B vorläufig; Profil „Leicht“ offen | `features/local-model-eval.md` |

**Veraltet in STATUS/CHATS:** STATUS nennt viele Komfort-/Fokus-PRs noch als „wartet auf Review“, sie sind gemergt; CHATS führt den Fokus-Audit-2-Chat noch in Phase 0, der Audit ist gemergt und Paket 1 ist gebaut (#177).

## 3. Offene Punkte nach Kategorie

### Komfort
| # | Punkt | Aufwand | Quelle |
|---|---|---|---|
| K1 | Unterlagen-/Vorrats-Zeilen im Home-Widget nicht antippbar (Link in `DueList`-Zeile fehlt) | S | `comfort/03-results.md` §Package 4 |
| K2 | Palette-Verben pro Modul („bezahlt“, „Timer starten“) | M | ebd. |
| K3 | „Route“-Button für den Ort in Terminzeilen | S | ebd. |
| K4 | Abo → zugehörige Buchungen (`subscriptionId` oder Abgleich über Zahlungsempfänger) | M | ebd. §4, §5b |
| K5 | Benachrichtigung „Preis erhöht“, Enddatum je Preis | S | ebd. §5b |
| K6 | Schnellerfassung für Vorräte und Personen („Oma 12.3.“) – Parser braucht Signal | M | ebd. §Package 2 |
| K7 | Abo-Preis direkt in der Zeile ändern; Vorräte-Schnellaktionen in der Zeile | S | ebd. §1b |
| K8 | Filter-Chips für Rechnungen und Vorräte | S | ebd. §Package 3 |
| K9 | Accounts: Kopier-Icon in der Zeile, `/`-Suche | S | `comfort/02-plan.md` §5 Aktion 23 |
| K10 | Unterlagen: „verlängert +1 Jahr“ | S | `02-plan.md` §4 |
| K11 | Kalender: Termin per Tipp in Tag/Slot anlegen; Suche | M | ebd. |
| K12 | ToDos: Massenverschieben; Prioritäts-Chips | M | ebd. |
| K13 | Listen: Chips mit zuletzt genutzten Einträgen, Doppelt-Toast, Suche, Packlisten-Vorlagen jederzeit | S | ebd. |
| K14 | Budgets: Grenze ±, Drill-down zu Buchungen, Übertrag (M3) | M | ebd. |
| K15 | Merkliste: Zeilenklick öffnet Link, „URL einfügen“-Button | S | ebd. |
| K16 | Timer: Vorgaben 5/10/25 Min., Leertaste Start/Pause | S | ebd. |
| K17 | Nicht gewählt in Paket 5: Teilzahlung, Überweisung zwischen Konten, Checklisten-Zeilen in Notizen | M | `02-plan.md` §6 |
| K18 | Einstellungen: Kontext-Zahnrad auch in Dialogen; „Zurücksetzen“ nur in 4 Abschnitten; Backup/Update-Prüfung weiter 3 Klicks | S–M | `comfort/06-settings-results.md` |
| K19 | Android: Kategoriestatus für Benachrichtigungen/Module/Backup; Zurück-Geste per E2E | S | `05-settings-plan.md` §A.7 |
| K20 | Werkzeugkasten auf Android als Bottom-Sheet; `defaultEnabled`-Set prüfen (braucht OK je Werkzeug) | S | `05-settings-plan.md` §B.3/4 |

### Verschönerung und Design
| # | Punkt | Aufwand | Quelle |
|---|---|---|---|
| D1 | Visual #17: untere Navigation + FAB verdecken auf dem Handy die letzte Zeile (= Fokus-Audit-2 #4) | S | `VISUAL-AUDIT` §Findings; `focus/10-audit-2.md` §5 |
| D2 | Visual #18: Statustext in Einstellungsliste stößt an den Chevron | S | `VISUAL-AUDIT` |
| D3 | Visual #16: Wortmarke wirkt abgeschnitten (Brand-Asset) | S | ebd. |
| D4 | Ohne Screenshots geblieben: Dialoge, Palette, Einrichtungsassistent, Werkzeug-Sheet, Leer-/Fehlerzustände, lange Texte, ≈ 640 px | – | `VISUAL-AUDIT` §Status |
| D5 | Spec-Fragen offen: Papierkorb-Seite (30 Tage/manuell), Werkzeuge als Bereichsseite auf dem Handy, Wochenansicht Handy 3 Tage vs. 1 Tag + Wischen | – | `design/DESIGN-SPEC.md` §13 |
| D6 | Kalender-Monat Desktop: 264 Buttons, 124 Chips, keine ruhige Voreinstellung | M | `focus/10-audit-2.md` §5 #7 |
| D7 | Personen und Merkliste: dichte Badge-Reihen (57 Links am Desktop) | S | ebd. #13 |

### Funktion und Automatisierung
| # | Punkt | Aufwand | Quelle |
|---|---|---|---|
| F1 | Paket 7 Passwort-Gesundheit (zxcvbn + HIBP k-Anonymität, opt-in, UI nur in `accounts`) | M | `MODULE-PLAN.md` §Pakete |
| F2 | K3 Anhänge in Sync/Backup; M2 Termine ziehen; M3 Budget-Übertrag | L / M / M | `MODULE-PLAN.md` Ende; ROADMAP |
| F3 | Backup in selbst gewählten Ordner (`.enc.json`) | S | `features/backup-sync.md` §Proposals |
| F4 | LAN-Sync ohne Server mit Pairing-Code | L | ebd. |
| F5 | Android-Launcher-Shortcut für Schnellerfassung (`shortcuts.xml`) | S | `features/quick-capture.md` |
| F6 | Manifest-Beitrag `capture` je Modul (ersetzt `targets/`) | M | ebd. §Suggestion |
| F7 | Lokales Modell Profil „Leicht“ (Prompt/Grammatik oder LoRA auf Qwen3 0.6B/1.7B); Harness braucht Set-Argument | L | `features/local-model-eval.md` |
| F8 | Nicht gemacht: Vorschläge aus dem Chat, Streaming bei Providern, Token-Schätzung | M | `decisions/local-model.md` |
| F9 | Wetter-Widget (Open-Meteo, Stadt einmal gewählt) – **gehört Fokus-Audit 2 Paket 4** | M | `focus/11-plan-2.md` |
| F10 | Screenshot-Werkzeug (`getDisplayMedia`) – **Fokus-Audit 2 Paket 4** | M | ebd. |
| F11 | Shortcut-Karte, Akkorde, F-Tasten; systemweiter Hotkey – **Fokus-Audit 2 Paket 4** | M / L | ebd. |
| F12 | Nur nach Tagebuch: Countdown zu einem Termin, Log „was habe ich heute gemacht“, Routinezeiten | – | `10-audit-2.md` §6 |
| F13 | Google-Login auf Android fehlt | L | `MANUAL-TESTS.md` |

### Qualität und Technik
Aufwand laut `meta/IMPROVEMENTS-2026-10-03.md` §Top 10.
| # | Punkt | Aufwand | Quelle |
|---|---|---|---|
| Q1 | Typisierte Zeilen-Helfer in `core/db/repo.ts`/`tx.ts` statt ~10 `as unknown as` | M | IMPROVEMENTS §Top 10 |
| Q2 | `logError(tag, e)` statt ~40 stummer `.catch(() => undefined)` | M | ebd. |
| Q3 | Basiskomponente `EditorActions` für ~9 kopierte Editor-Fußzeilen | M | ebd. |
| Q4 | `server/src/app.ts` `buildApp` in Route-Plugins teilen | M | ebd. |
| Q5 | `ScanView.tsx` (516 Z.) und `OnboardingWizard.tsx` (551 Z.) aufteilen | M | ebd. |
| Q6 | ESLint `complexity` / `max-lines-per-function` als Warnung | S | ebd. |
| Q7 | `ScanPage` auf Selektoren statt Whole-Store-Subscription (Scan-Performance) | S | ebd. |
| Q8 | Gemeinsame `toHex`/base64-Helfer; `MS_PER_DAY`; 14-Tage-Push-Fenster | S | ebd. |
| Q9 | Hooks aus `LocalApiSection`, `AiSection`, `CommandPalette`, `BackupSection`, `FocusPage`, `SetupWizard` lösen | M | IMPROVEMENTS §Code structure |
| Q10 | Ladereihenfolge-Rätsel `TIME_RE` (`calendar/settings.ts`) bricht E2E nur in CI; `madge --circular` | S | IMPROVEMENTS §Repo hygiene |
| Q11 | E2E-Flakes unter Last: `reminders.spec.ts:89`, `newmodules.spec.ts:42` | S–M | CLEANUP §Result |
| Q12 | Test-Tooling: `resetDb`-Helfer, Vitest `isolate:false` (≈150 von 237 s Setup), schwere jsdom-Tests zusammenlegen; Blocker: WebCrypto-Realm, Dexie-Singleton | M | IMPROVEMENTS §Tests; `perf/BUILD-BASELINE` |
| Q13 | Repo-Hygiene: Root-`package.json`/Workspaces, Alias `@nemo/vault-core` 5×, Inter-Font-Pfad, `.dockerignore`, Playwright-Configs, User-Agent `Taschenmesser-Proxy/1` | S | IMPROVEMENTS §Repo hygiene |
| Q14 | „Geprüft, unklar“: `disk.del.errors.already-running`, `disk.filter.none_found`, `PageContainer .full` + ~20 Klassen in `Patterns.module.css`, `FRONT_WIDGETS`, `LEGACY_HASHES`, `DEFAULT_FOCUS`, `SETUP_STATUSES`, `googleDrive.stub.ts` | S | CLEANUP §A2/A5/A7/A8 |
| Q15 | Keine Coverage-Werkzeuge im Repo | S | CLEANUP §Baseline |
| Q16 | Lesbarkeit: Performance-Stichprobe Seed `large` bei Lesehilfe 100 % | S | `READABILITY-PLAN` §5 |

### Sicherheit (Sicherheitsbereich – nur mit eigenem Chat und ohne Abschwächung)
| # | Punkt | Aufwand | Quelle |
|---|---|---|---|
| S1 | X2 Pipe-Erstinstanz in `bind()` (Squatter auf Windows) | M | `security/LAUNCH-REVIEW-2026-10-06.md` §Status after phase 2 |
| S2 | X4 Overlay-Host durch Seite versteck-/verschiebbar (UI-Redress) | M | ebd. |
| S3 | V2 Windows Hello nur Zustimmungsschranke; DEK mit `KeyCredentialManager` umhüllen | L | ebd. |
| S4 | V5 Backup-Import: keine Zeilenvalidierung gegen Collection-Schema, keine Größengrenze (Vorschlag 64 MB, ungültige Zeilen überspringen + zählen) | M | ebd. |
| S5 | T2 `allowBackup`/Cleartext nach `tauri android init` in CI absichern | S | ebd. |
| S6 | V4 Android-Zwischenablage ohne `EXTRA_IS_SENSITIVE`; A5 Modelldatei beim Laden neu hashen | S / M | ebd. |
| S7 | N9/N11/N12 Server: Compose auf allen Interfaces, CORS `*`, kein Digest-Pin; kein `setErrorHandler`; Ops unbekannter Collections übersprungen, Cursor läuft weiter | S | ebd. |
| S8 | S5 Sync-Token in `_secrets.syncConfig` statt `SecretStore`; S13 APK-Digest-Signatur | M | `security/AUDIT-2026-09-30.md` |
| S9 | V9/V10 Tresor ohne Rollback-Schutz (`rev`-Zähler); CSV-Export ohne Formel-Neutralisierung | S / S | LAUNCH-REVIEW |
| S10 | P5 Build-Provenienz/Attestierung; CodeQL `js/request-forgery` in `proxy.ts` als False Positive abweisen + Tests | S | `security/FINDINGS-2026-10-01.md` |

### Fokus-Funktionen (Audit 2 – gehört den Chats `feat/focus2-*`)
Paket 1 Defaults (#177, offen), Paket 2 Home/„Heute“-Karte + ruhiges ToDo-Layout ohne FAB, Paket 3 Erinnerungen (Snooze in Zeilen, Touch-Ziele ≥ 44 px), Paket 4 Ergänzungen (Wetter, Screenshot, Shortcut-Karte). Quelle `focus/11-plan-2.md`. Noch nicht bewertet im Audit: Budgets, Rechnungen, Abos, Personen, Merkliste, Unterlagen, Dialoge (`10-audit-2.md` §2–3).

## 4. Abgelehnt oder zurückgestellt (nicht erneut vorschlagen)
- Gespeicherte Ansichten; geteilte Buchungen; Rezept-Import; Gewohnheits-Tracker; Palette-Befehlsbaum pro Modul über „Neu“ + 3–4 Verben hinaus (`comfort/02-plan.md` §1).
- Rechnung → ToDo/Erinnerung (Rauschen); Finanz-Erfassung ohne Bestätigung; automatische Rechnungen, die nie bezahlt wurden; Zukunftsbuchungen; > 12 verpasste Perioden pro Start (`03-results.md`, `decisions/features.md`).
- Termine ziehen nur, wenn nach den Chips noch nötig (`02-plan.md` §6).
- Einstellungen: kein „Empfohlen für dich“, kein Vorschau-Widget in der Bibliothekskarte; keine Plattformarbeit (Werkzeugfenster, Always-on-top, Android-Timer-Dienst, angeheftetes Popover, OS-Handler für `nemo://`); Werkzeug-Raster, das sich selbst umsortiert; Favoriten-Drag-and-drop (`comfort/05-settings-plan.md`, `decisions/ui-shell.md`).
- Getippte Bestätigung `LÖSCHEN` (entfernt 2026-10-13, #165).
- Fokus: ein Hauptschalter (zu grob); überzählige Benachrichtigungen verwerfen; explizite Erinnerungen verschieben; `done`-Feld an Terminen; ausgelöste Benachrichtigungen speichern; Erfassungstyp raten; Rückfrage als Standard; „Uhrzeit am ToDo wird Erinnerung“; eigener Lesemodus (`decisions/focus.md`, `features/focus-aids.md`).
- Audit 2: nichts wird gelöscht, nur standardmäßig aus oder zusammengelegt; globaler Hotkey nur mit Freigabe.
- Spotify-Connector; CUDA; 16-Zeichen-Supporter-Codes; separates Host-Binary für die Bridge; Server-Tombstone-GC (akzeptierte Grenze); Lesehilfe nie in Tresor/Eingaben/Zahlen/Code; Timer ↔ Zeiterfassung; Nachrichten nur als optionale Erweiterung.
- ROADMAP „Explicitly not planned“: Cloud-Konten, Telemetrie, Werbung; KI, die Nutzerdaten sieht (außer lokales Modell mit Schalter); FinTS/PSD2.

## 5. Halb fertig oder vermutlich ungenutzt
- Standardmäßig aus: In-App-Erinnerungskarte (+ 2 Unteroptionen), gestaffelte Vorwarnungen, Nachfass-Erinnerung, Lesehilfe (Alt+L), Home „Nur das Wichtigste“, lokale API (`decisions/focus.md`, `readability.md`, `10-audit-2.md` §3).
- Konflikt: „Jetzt“-Leiste in Modulen (`moduleNow`) gerade gebaut (#171, an), Audit 2 will sie standardmäßig aus (#177).
- Doppelte Konzepte: Fokusmodus mit Ring-Timer neben der Zeitleiste; drei „Heute“-Listen auf Home (`10-audit-2.md` §5).
- `googleDrive.stub.ts` Platzhalter; natives Android-Share-Target fehlt; Lesezeichen nur Ansicht der Merkliste; Unterlagen-Dateien weder Sync noch Backup (K3); Löschen in Unterlagen ohne Rückgängig.
- Handtests: alle Hardware-Gruppen in MANUAL-TESTS offen (D, E, N, C, L, F1–F12, K1–K4, V1–V4, L1–L4, A1–A2, S1–S4, M1–M4, Supporter S1–S8).

## 6. Widersprüche in der Doku (für einen Doku-Pflege-Schritt)
1. STATUS §Nächste Schritte 0 / Z.20: Fokus-Paket 1 „wartet auf Review“ – alle 4 Pakete sind gebaut.
2. STATUS Z.8: Finanz-Tabs fehlen – #175 ist gemergt.
3. `user/faq.md`: „Oberfläche nur Deutsch“ – es gibt 5 Sprachen.
4. `user/modules.md`: stillgelegte Daten bleiben im Backup – Paket 6 hat die Tabellen entfernt; Vorräte und KI-Chat fehlen dort als Module.
5. Audit 2 Problem #12: ToDo-Zeilen hätten kein „Später“ – Komfort 1b hat Wischen + „⋯ → Morgen/Nächste Woche“ gebaut; vor Paket 3 klären.
6. CHATS: Fokus-Audit-2-Zeile veraltet (Phase 0), Audit ist gemergt, Paket 1 als #177 offen.
7. DESIGN-SPEC §3 vs. `ui-shell.md`: Zuordnung von Personen.
