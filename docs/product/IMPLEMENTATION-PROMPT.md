# Umsetzungs-Prompts – Modulplan (ein Prompt je Paket)

Grundlage: [MODULE-PLAN.md](MODULE-PLAN.md), Begründungen und geprüfte Core-Fakten in [MODULE-REVIEW-2026-10-01.md](MODULE-REVIEW-2026-10-01.md) (Abschnitte 18–23). Reihenfolge ist verbindlich: 1 → 2/3 (parallel möglich) → 4 → 5 → 6; 7 unabhängig ab Paket 4. Jeder Prompt beginnt mit dem Block **„Gemeinsam für alle Pakete“** (kopieren oder verlinken) und dem Paket-Abschnitt.

---

## Gemeinsam für alle Pakete

### Rollen und Vorgaben
- Git: `docs/PROMPT-TEMPLATES.md#git` (eigener Branch `feat/<paket>` von frischem `develop`, PR gegen `develop`, nicht mergen). Rules: `#hard-rules`. Docs: `#knowledge`. PR: `#pr-text`. Zeile in `docs/CHATS.md` im ersten Commit.
- Lies zuerst `CLAUDE.md`, `docs/product/MODULE-PLAN.md`, den Paket-Abschnitt hier und Abschnitt 21 („Geprüfte Fakten zum Core“) der Review. Danach gezielt die genannten Dateien.
- Ich (Sven) entscheide. **Plan Mode** zuerst: Plan mit Dateiliste, Datenmodell-Diff, Migrationsschritten, Testplan; STOPP bis „Plan freigegeben“. Weitere Pflicht-Stopps: **vor jeder Migration** (Mapping-Tabelle Quelle → Ziel zeigen, Fixture-Testergebnis vorher/nachher), vor jedem `db:bump`, vor dem Löschen von Code eines stillgelegten Moduls.

### Harte Regeln (gelten zusätzlich zu CLAUDE.md)
1. **Kein Datenverlust.** Migration = Kopie in die neue Sammlung, gleiche `id`, `updatedAt`-Vergleich, idempotent, über `createRepo` (synchronisiert). Nie `remove`/Tombstones auf Quell-Tabellen, nie `purge`, nie Tabellen aus dem Schema (bis Paket 6).
2. **Stilllegen statt entfernen.** Ersetzte Module bekommen `retired: true`: keine Routen, Nav, Widgets, Schnellerfassung, `aiSchema`, Import-API (Rechte für diese IDs verweigern), aber Sammlungen bleiben im Schema; alte Pfade leiten auf das Ziel um. Code der Seiten/Komponenten darf entfernt werden, Schema/Repo bleiben.
3. **Sync-Kompatibilität.** Ein Gerät auf der Vorversion schreibt weiter in die alten Tabellen. Die Vorwärtskopie läuft beim Start, **nach jedem Sync-Pull** und **nach jedem Backup-Import**. Test mit `MemoryServer`: alt schreibt, neu zieht, Ziel enthält die Zeile.
4. **Backup-Kompatibilität.** Fixture-Backups aus 0.3.1 (`web/src/core/backup/__fixtures__/`, erfundene Daten) müssen importierbar sein und nach der Migration dieselben Einträge im Ziel ergeben (Snapshot-Test). Neue Exporte bleiben `nemo-backup-…`.
5. **Interne IDs unverändert** (`brand-ids.test.ts`): DB-Name, Backup-Format-IDs, Bundle-ID, Storage-Keys, bestehende Modul-IDs und Tabellennamen. Neue Module nur mit neuen IDs (`lists`, `people`, Gruppen `money`, `household`).
6. **Sicherheitsbereiche unberührt:** `modules/accounts` (Krypto, Ausschluss-Tests), `core/localapi` + Rust `local-api`, `src-tauri/crates/disk-scan/guard.rs`, `release.yml`, Secrets-Handling, „nie Nutzerdaten an die KI“ (`privacy.test.ts`).
7. **Widget- und Seed-Pflicht:** jedes sichtbare Modul hat ein Widget mit Leerzustand und Aktion; neue Module bekommen `contributions.onboarding` (Importer oder `noOnboarding`) und einen `StartDataButton` auf der Seite, wenn Startdaten existieren. Gruppen zeigen in der Bibliothek ihre Teilmodule, jedes einzeln abschaltbar.
8. **UI:** Texte nur in `strings.ts` (neue Manifest-Texte dorthin, bestehende beim Anfassen mitziehen), Tokens, `@/ui`-Komponenten, Touch ≥ 44 px, `data-autofocus`. Keine neuen Abhängigkeiten ohne Rückfrage.
9. **Versionen:** Breaking-Pakete mit `feat!:` + `BREAKING CHANGE:`-Fußzeile; `npm run version:set` macht nur Sven. Changelog-Abschnitt „Breaking“ nennt: welche Module unsichtbar werden, dass Daten erhalten bleiben, dass alle Geräte vor Paket 6 aktualisiert sein müssen.
10. **Feste ID-Listen pflegen** (Abschnitt 21 der Review): `exclusion.test.ts` (Liste ohne aiSchema), `e2e/a11y.spec.ts` (MODULES/PAGES), `core/setup/profiles.ts` + Test, `core/ai/testing.ts`, `intent/parser.ts`, `quickCapture/targets/adapters.ts`, `dataapi.test.ts`, `moduleImporters.test.ts`, `contributions.test.ts`, e2e `modules/layout/extras/newmodules/notifications`, `e2e/screenshots/capture.spec.ts`, `docs/user/module.md`, `docs/AI-IMPORT.md` (muss `buildApiPrompt` gleichen).

### Qualität (Definition of done je Paket)
- `npm run lint && npm run typecheck && npm test && npm run e2e` grün in `web/`; `check:docs` ohne neue Warnungen; `cargo fmt/clippy/test` nur, wenn Rust angefasst wurde.
- Migrationstests: Fixture-Backup alt → Import → Migration → Snapshot; Idempotenz (zweiter Lauf ändert nichts); Sync-Test alt → neu; Konfliktfall (beide Seiten geändert, LWW).
- **Vorher/Nachher-Screenshots** mit erfundenen Daten: `SCREENS_VIEWPORTS=1920x1080,412x915 npm run screenshots` vor und nach dem Paket (`SCREENS_DIR=test-results/screens/before|after`), Übersicht, betroffene Seiten, Bibliothek, Mobil „Mehr“. Im PR als Bilder.
- Docs: `docs/STATUS.md` (eine Zeile), `docs/DECISIONS.md` (eine Zeile je Entscheidung + Detail in `docs/decisions/`), `docs/ARCHITECTURE-MAP.md` (neue Pfade), `docs/HOW-TO.md` (Rezept „Modul stilllegen / zusammenlegen“ ab Paket 3), `docs/user/module.md`, `CHANGELOG.md` Unreleased.

### Parallele Chats
`docs/CHATS.md` lesen; Paket 1 belegt die Hotspots `router.tsx`, `useNavItems.ts`, `home/Home.tsx`, `core/modules/types.ts`, `pages/Settings.tsx`, `strings.ts` – währenddessen keine Feature-Chats an diesen Dateien. Pakete 3–5 belegen `core/db/schema*.json` (nach Merge von `develop` immer `db:bump` neu). Paket 2 darf parallel zu 3 laufen (nur `home/`, `ui/WidgetList`, Widgets von ToDos/Kalender).

### Abschluss jedes Pakets
PR gegen `develop` mit `#pr-text` (What and why · Structure/changes · Numbers: Modulzahl, Nav-Einträge, Bundle vorher/nachher · How verified · Open questions · Hand-over), Screenshots, CHATS-Zeile entfernt. Nicht mergen. Abschlussmeldung im Chat: PR-Link, Migrationsergebnis (Zeilen kopiert je Tabelle), offene Punkte.

---

## Paket 1 · Aufräumen (0.4.0)

### Ziel
Nemo wirkt ruhig: Gruppen „Geld“ und „Listen“, 18 → 12 Werkzeuge mit Rahmen, fester Notiz-Zettel, „Dieser PC“, Nachrichten/Habits/Zeiterfassung stillgelegt, bekannte Funde behoben. **Keine Datenmigration außer Zettel und Werkzeug-IDs.**

### Was du NICHT tust
Keine neuen Sammlungen, kein `db:bump` (Sammlungen bleiben), keine Verschmelzung von Daten, keine Änderung an Sync/Backup-Formaten, keine Rust-Änderung.

### Phasen
1. **Gruppen-Mechanik:** `manifest.group` (`core/modules/types.ts`, `validateManifest`), Router (Gruppenseite `/<group>` mit Tabs = Routen der Teilmodule; `/finance`, `/invoices`, … leiten auf `/money?tab=…` um – oder umgekehrt, Entscheidung im Plan), `useNavItems`, `MoreSheet`, Übersicht (Widgets der Teilmodule bleiben; optional Gruppen-Widget), Bibliothek (Teilmodule eingerückt, einzeln abschaltbar), Schnellerfassung (Aktionen gruppiert), `a11y.spec` PAGES. Gruppen: `money` (finance, invoices, subscriptions, budgets), `household` (shopping, packing, pantry – Daten unverändert; Paket 3 ersetzt shopping+packing durch `lists`).
2. **Stilllegen:** `manifest.retired` + Auswertung in Registry/`availableManifests`, Import-API-Scope (`core/dataapi/scope.ts`: retired = blockiert), Setup-Profile bereinigen, Umleitungen. Anwenden auf `news` (zusätzlich `core/ai/newsBrief.ts`, Startpaket, `e2e/news.spec.ts`, Strings, `MANUAL-TESTS` N-Punkte entfernen), `habits`, `timetrack`. Seiten-/Komponenten-Code dieser drei entfernen, `schema.ts`/`repo.ts`/`manifest.ts` (retired) behalten. Bibliothek zeigt stillgelegte Module nicht; Backup-Export enthält ihre Tabellen weiter.
3. **Werkzeuge:** `calc` nimmt Modi Prozent/MwSt und Teilen auf (Logik aus `percent`, `split` übernehmen, Tests mitnehmen); neues `dev` mit Tabs Base64/URL, JSON, UUID, Hash; `scratch` entfernen; `core/tools/layout.ts` migriert gespeicherte IDs (`percent`/`split` → `calc`, `base64`/`json`/`uuid`/`hash` → `dev`, `scratch` weg); Rahmen: Route `/tools/:id` öffnet das Sheet, Paletten-Einträge „Werkzeug: …“, Kürzel (Vorschlag `Strg+.`; in `docs/user/module.md` nennen), Dialogbreite bis 900 px ab 900 px Viewport, „Zurück“ als Icon in der Kopfzeile; Dateiwähler (Bilder, PDF) als `Button`. `core/tools/registry.test.ts`, Setup-Profile, `ToolsStep` anpassen.
4. **Notizen-Zettel:** Notiz mit fester `id: 'scratch'`, immer oben; einmalige Kopie aus `_settings` Scope `tools.scratch` (nur wenn Notiz fehlt und Text nicht leer); Widget „Notizen“ zeigt Zettel zuerst; `StartDataButton` auf der Notizen-Seite.
5. **Dieser PC:** `disk` bekommt Tab „System“ mit der bisherigen Systeminfo-Seite; `system`-Manifest entfernen (keine Daten; `BLOCKED_MODULES`, `exclusion.test`, `e2e/system.spec` → in `disk.spec`); Rust und Tauri-Commands unverändert; Modulname „Dieser PC“.
6. **Funde** (Review Abschnitt 8): Abo-Kachel-Umbruch, Kalender-Beschreibung, Vorräte→Einkauf nur mit Prüfung, Abo-`remindTime` als Setting, doppelte Icons, `StartDataButton` auf Verträge/Packlisten/Vorräte/Dokumente/Geschenke/Budgets, Setup-Text Backups, Profil-Text, Accounts-Kopfzeile mobil, `docs/product/` in `check-docs.mjs` `exemptDirs`.
7. Docs + Screenshots + PR. Changelog „Breaking“: Nachrichten, Habits, Zeiterfassung unsichtbar (Daten bleiben, Export über Backup).

### Zahlen im PR
Nav-Einträge vorher/nachher (Web und Desktop), Werkzeug-Kacheln, Zeilen entfernt, Bundle gzip vorher/nachher (`npm run build`).

---

## Paket 2 · Übersicht-Aktionen (K1)

### Ziel
Die Übersicht ist bedienbar: ToDo abhaken, Einkauf/Liste abhaken und hinzufügen, Termin/Erinnerung „erledigt“ wo sinnvoll, Widgetgröße je Widget; alles ohne die Seite zu verlassen.

### Umfang
`ui/WidgetList` + `home/` bekommen generische Aktions-Hooks (Checkbox, Inline-Hinzufügen mit `TextField labelHidden`, Größe s/m/l aus `homeLayout.sizes`); ToDos, Kalender (Heute & Morgen), Listen-Gruppe (Einkauf; nach Paket 3 `lists`), Notizen-Zettel (editierbar) ziehen nach. Optimistisches UI, `Skeleton`, Undo-Toast für Abhaken (10 s). Keine Datenmodell-Änderung. e2e `home.spec.ts` erweitern. Parallel zu Paket 3 erlaubt; Konfliktdateien nur Widgets der betroffenen Module.

---

## Paket 3 · Listen + Favoriten (0.5.0)

### Ziel
Neues Modul `lists` (Einkauf, Packlisten, Checklisten) ersetzt `shopping` und `packing`; Merkliste nimmt Favoriten aus `launcher` auf. Erstes Paket mit App-Migration – der Runner entsteht hier und wird in 4 und 5 wiederverwendet.

### Phasen
1. **Runner** `core/db/appMigrations.ts`: Schrittliste `{id, source, target, map(row), after?}`, Ausführung nach DB-Öffnen (`initCore`), nach `runSync`-Pull und nach `applyBackup`; Fortschritt pro Schritt in `_meta app.migrations.<id>` nur als Marker, die Kopie selbst ist idempotent (gleiche `id`, kopiere wenn Ziel fehlt oder `source.updatedAt > target.updatedAt`); schreibt über `createRepo` (synchron). Unit-Tests: leer, idempotent, LWW, Zieltabelle unbekannt → kein Fehler. STOPP mit Mapping-Tabelle vor dem ersten Lauf.
2. **`lists`:** `npm run gen:module -- lists "Listen"`, Schema `list {name, kind: shopping|packing|checklist, note, order}`, `item {listId, name, quantity?, done, order}`; Seite mit Listen-Tabs, Einkauf-Parser („2 Milch“), „Gekauftes entfernen“, Packliste „Zurücksetzen“/„Als Vorlage kopieren“; Widget (offene Einkäufe + Packfortschritt); Importer Text (Einkauf) + Vorlagen; `aiSchema` `list`, `item`; Schnellerfassung „Einkauf“; abonniert `shopping.requested`. Gruppe `household` = `lists` + `pantry`. Migration: `shopping_item` → Liste `shopping-default` „Einkauf“ (kind shopping) + Items gleiche `id`; `packing_list` → `list` (kind packing), `packing_item` → `item`. `shopping`, `packing` → `retired`, Pfade umleiten.
3. **Favoriten:** `bookmarks.item.kind` + `favorite`; Kachelansicht (Segment „Favoriten“), Gruppen = Tags; Migration `launcher_link` → `item {kind:'favorite', url, title, tags:[group], done:false}` gleiche `id`; Widget zeigt Favoriten-Zeile; `launcher` → `retired`; Presets entfallen (HTML-Import bleibt).
4. Fixtures (0.3.1-Backup mit Einkauf, Packliste, Links), Sync-Test alt → neu, Screenshots, Docs (`HOW-TO` Rezept „Modul zusammenlegen“, `DECISIONS`), Changelog Breaking.

---

## Paket 4 · Unterlagen + Personen (0.6.0)

### Ziel
`vault` wird „Unterlagen“ und nimmt Verträge auf; neues Modul `people` ersetzt Geburtstage und Geschenke.

### Phasen
1. **Unterlagen:** `document` + `category 'warranty'`, `provider?`, `startDate?`, `endDate?` (ersetzt `expiresOn`; Lesepfad akzeptiert beides, Schreiben nur `endDate`, Modul-Migration `manifest.migrations` v2 benennt um), `noticeDays?`; Kalender-Items Ende + Frist, Benachrichtigung `remindDaysBefore`; Mail-Importer aus `contracts` übernehmen; Widget „Fristen & Ablauf“; UI-Name „Unterlagen“, Icon neu (nicht `lock`). Migration `contracts_contract` → `vault_document` gleiche `id` (kind → category). `contracts` → `retired`. Dateien bleiben gerätelokal (Hinweistext bleibt).
2. **Personen:** `gen:module -- people "Personen"`, `person {name, birthday?: {month, day, year?}, note, tags}`, `gift {personId, title, occasion, date?, priceCents?, url?, status, note}`; Seite: Personenliste mit nächstem Geburtstag, Detail mit Geschenken; Alter, WhatsApp-Gruß, Kalender-Items (jährlich + Geschenk-Anlass bis verschenkt), Benachrichtigung, Text-Importer Geburtstage; `aiSchema` nur `person`; Widget „Nächste Geburtstage · offene Geschenke“; Schnellerfassung Person, Geschenk. Migration: `birthdays_birthday` → `person` gleiche `id`; `gifts_idea` → `gift`, `personId` = Person mit gleichem Namen (trim, case-insensitive), sonst neue Person `person-<slug>`. STOPP mit Abgleichsliste vor dem Lauf. `birthdays`, `gifts` → `retired`.
3. Fixtures, Sync-Test, Screenshots, Docs, Changelog Breaking.

---

## Paket 5 · Zeit (0.7.0)

### Ziel
Erinnerungen leben im Kalender; Termine können benachrichtigen; ToDos wiederholen sich.

### Phasen
1. **Termin-Benachrichtigung:** `event` + `kind: 'event'|'reminder'` (default event), `notify?: {minutesBefore, enabled}`; `contributions.notifications` im Kalender (Key-Konvention `event:<id>:<date>T<time>`; bestehende `reminder:`-Keys einmalig in den Scheduler-Cursor übernehmen, damit nichts doppelt feuert); Editor-Feld „Benachrichtigen“; `nativeSchedule`/`push` prüfen (`notifications.spec`).
2. **Erinnerungen → Kalender:** Tab „Erinnerungen“ (Liste der `kind: reminder`, Pausieren = `notify.enabled`), Schnelleingabe wie bisher, 8 Vorlagen als Importer `templates`; Migration `reminders_reminder` → `calendar_event {kind:'reminder', allDay:false, startDate, startTime:time, recurrence, note, notify:{minutesBefore:0, enabled:active}}` gleiche `id`; Tier-1-Parser (`intent/parser.ts`) und `aiSchema` (`reminder` entfällt, `event` + kind/notify), Schnellerfassung-Adapter, Teilen-Ziel, Widget „Nächste Erinnerungen“ in „Heute & Morgen“ aufgehen lassen (oder als Filter). `reminders` → `retired`, `/reminders` → `/calendar?tab=reminders`.
3. **ToDos:** `task.recurrence?` (Abhaken erzeugt nächste Instanz, Vorlage bleibt), `someday: boolean` (Filter „Irgendwann“), Widget-Filter; Kalender-Items für wiederkehrende Fälligkeiten.
4. Fixtures, Sync-Test, Benachrichtigungs-E2E (`page.clock`), Screenshots, Docs, Changelog Breaking.

---

## Paket 6 · Tabellen entfernen (0.9.0 oder 1.0.0)

Voraussetzung: alle Geräte ≥ 0.7, bestätigt von Sven. Stillgelegte Sammlungen (`news_*`, `habits_*`, `timetrack_*`, `reminders_reminder`, `shopping_item`, `packing_*`, `launcher_link`, `birthdays_birthday`, `gifts_idea`, `contracts_contract`) aus den Manifesten entfernen, `retired`-Manifeste löschen, `npm run db:bump`, `schema-history.json` ergänzen, `schema-upgrade.test.ts` so ändern, dass bewusst entfernte Tabellen in einer Allow-Liste stehen (nicht den Test streichen), Backup-Import: unbekannte Tabellen weiterhin still überspringen, aber im Import-Dialog nennen. Changelog Breaking: „Backups aus < 0.5 verlieren diese Tabellen“. STOPP vor `db:bump`.

---

## Paket 7 · Passwort-Health (S1)

Nur UI im Modul `accounts`, Krypto unverändert: schwache/wiederverwendete/alte Passwörter per zxcvbn (gebündelt), optionaler HIBP-Range-Check (k-Anonymität, Hash bleibt lokal, nur Präfix geht über `getPlatform().fetch`, Opt-in-Schalter mit Erklärung), Übersichtskarte im Tresor. `exclusion.test` und `privacy.test` bleiben grün; keine Netzanfrage ohne Opt-in (Test). Kein Breaking.
