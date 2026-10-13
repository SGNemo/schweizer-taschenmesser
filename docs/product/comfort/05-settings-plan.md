# 05 – Plan: Komfort für Einstellungen, Bibliothek, Werkzeugkasten

Phase 2, Stand 2026-10-11. Grundlage: [04-settings-friction.md](04-settings-friction.md). Entscheidungen von Sven (Phase 1): **keine Plattformarbeit** (Tool-Fenster, Always-on-top, Timer-Dienst, OS-Protokoll → ROADMAP), `nemo://` nur als **internes** Schema; Palette **immer** durchsuchbar mit Direktumschaltung; **kein** „Erweitert“, **kein** „Empfohlen für dich“; Pakete A und B, dazwischen STOPP.

## Leitplanken
- Nur Registry/Kategorien/Tool-Registry erweitern, keine zweite Struktur. Texte in allen fünf Sprachen (`check:i18n`; in der Umsetzung als Bundle `strings.comfort.ts`). *Nachtrag:* Die erste Fassung nannte hier „nur Deutsch“, das war ein veralteter Stand.
- **Ausgenommen von Schnellschaltern, Häufig-genutzt-Direktumschaltung und „Zurücksetzen“:** Tresor/accounts, Auto-Lock, Biometrie, Keys/Tokens, Updater-Kanal, Datenträger, Local API, Sync-Verschlüsselung. Sie bleiben nur als Link zur Sektion erreichbar; Bestätigungen unverändert. Markierung per `quick: false`/`resettable: false` ist Standard, Freigabe ist ausdrücklich (Allow-Liste, nicht Deny-Liste).
- Keine neue Abhängigkeit; Drag-and-drop mit Pointer-Events, Pfeil-Buttons bleiben als Tastatur-Weg.
- Fokus-Richtlinien: keine Zähler-/Schuldtexte, alles abschaltbar, Bewegung nur transform/opacity.

## Paket A – Einstellungen + Übergreifend (Branch `feat/comfort-settings`)
1. **Schnellschalter** (`core/settings/quick.ts`): Allow-Liste aus der Registry (Theme, Dichte, Lesehilfe, Fokusmodus, „Stumm bis …“). Eine Leiste ganz oben in Einstellungen, dieselben Einträge als Palette-Befehle. Stumm = neuer Zustand (lokal, mit Ablaufzeit: 1 h / bis morgen), wirkt auf die bestehende Ruhezeit-Logik von `core/notifications`; keine neue Option, sondern ein temporärer Schalter, schaltet sich selbst zurück.
2. **Suche + Palette** (`core/settings/registry/search.ts`, `CommandPalette.tsx`): ein gemeinsamer Index; Einstellungen ohne „einst“-Präfix, hinter Befehlen/Modulen gerankt (Fragen behalten Vorrang vor Treffern, kein Enter-Kapern); Schalter-Treffer schalten direkt um (Segment/Boolean; Enter), mit Toast + Undo; Synonymliste (`core/settings/registry/synonyms.ts`, ein Eintrag = Wort → Sektion/Feld, getestet) und Modulnamen auch für deaktivierte Module (Treffer führt zur Bibliothek-Karte).
3. **Häufig genutzt** (lokal, `localStorage`, nie synchronisiert, abschaltbar über den bestehenden Schalter „Verlauf in der Suche“ + eigener Eintrag im Fokus-Bereich): zählt geöffnete Sektionen/Schalter, zeigt die obersten 5 als erste Gruppe der Kategorien-Leiste. Gleiche Technik wie `core/search/recent.ts`; „Verlauf löschen“ leert beides.
4. **Kontext-Zahnrad** (`@/ui` `SettingsLink`, ein Icon-Button 44 px): `<SettingsLink to={settingsPath('…','…','feld')} />` springt in die Sektion und hebt sie hervor (vorhandener `useDeepLink`). Einbau in Widget-Kopf (`AutoWidget`/Widget-Katalog, damit alle Basistypen es erben), Modul-Header (`AreaFrame`/Modulseiten über Manifest `settings`), Dialoge. Erst in Basiskomponenten; Module bekommen es ohne eigenen Code, wenn sie `manifest.settings.fields` haben. Zurück-Weg: Browser-/Android-Zurück führt zur Ausgangsseite.
5. **Deep-Link-Schema (intern)**: `core/links.ts` bekommt `appLink('settings'|'library'|'tools', …)` → Route; `nemo://settings/<kat>/<sektion>/<feld>`-Strings werden nur intern geparst (Palette, Doku, Widgets), nie vom OS geöffnet. `/library#<modul>` und `/tools#<tool>` bekommen Anker + Hervorhebung.
6. **Zurücksetzen pro Abschnitt** nur für Sektionen mit `resettable: true` (Darstellung, Lesen, Fokus, Ruhige Erinnerungen, Schnellerfassung ohne Hotkey-Registrierung?) – setzt auf Standardwert, **Undo-Toast** statt Bestätigungsdialog. Schlüssel und Standardwerte bleiben unberührt (Test: Registry-Snapshot der Keys).
7. **Android:** Suche bleibt in der Kategorie sichtbar und klebt oben (sticky); Kategorien-Status um Benachrichtigungen (Erlaubnis), Module („n aktiv“), Backup (letzter Stand) ergänzt; Zurück-Geste: Kategorie → Liste, Liste → vorherige Seite (E2E im 412×915-Viewport).
8. **Kürzelübersicht `?`**: `Strg+.` (Werkzeuge), Palette-Beispiele, Lesehilfe ergänzen.
9. Kleine Straffung: Hilfetexte nur noch dort, wo ein Feld nicht selbsterklärend ist (Darstellung, Fokus: Beschreibung → `HelpHint` statt zweiter Zeile). Kein Entfernen von Schlüsseln.

**Nicht in A:** Bibliothek, Werkzeugkasten (Paket B).

## Paket B – Bibliothek + Werkzeugkasten (Branch `feat/comfort-toolbox`, danach evtl. getrennt)
Abstimmung vor Start: Modul-Komfort-Chat fasst `ModuleLibrary.tsx` an → Zeile in CHATS.md; wenn er noch offen ist, zuerst nur Werkzeuge.
1. **`@/ui` `ToggleList`/`ToggleCard`** (gemeinsam für Modul- und Tool-Bibliothek, ersetzt die doppelte Karten-Implementierung in `ModuleLibrary.tsx` und `ToolLibrary.tsx`, plus `ToolsSection.tsx` nutzt dieselbe Zeile): Schalter in der Liste, Suchfeld (Name, Beschreibung, Funktionsbegriffe aus `keywords`), Gruppen/Filter, Kennzeichnung „neu“/„aktualisiert“ (aus Versionsvergleich lokal, dismissbar, kein Zähler).
2. **Bibliothek:** Aktivieren per Schalter direkt in der Liste; Deaktivieren bleibt mit Daten-Dialog (behalten/löschen), aber nur wenn Daten da sind, sonst direkt; Startdaten-Knopf je Karte (vorhandener `StartDataButton`); Reihenfolge der Sidebar-Favoriten per Ziehen (`core/settings/nav.ts`). **Vorschau-Widget in der Karte entfällt** (Reizlast, Rendering teurer).
3. **Werkzeugkasten:** zuletzt genutztes Tool zuerst (lokal, abschaltbar wie Häufig genutzt); Reihenfolge per Ziehen in Bibliothek und Kasten; Tool-Ausdrücke in der Palette: neues optionales `ToolManifest.expressions` (Parser pro Tool, rein lokal): `=19% von 240` (vorhanden), `timer 10m`, `umrechnen 5 km` → Treffer mit Ergebnis/„Starten“, Enter führt aus oder öffnet das Tool vorbelegt; **Ergebnis kopieren** mit einem Klick (vorhandene Kopier-Logik der Palette wiederverwenden); Tools „anheften“ = Kasten bleibt offen (Schalter im Kasten, lokal); Android: Dialog als Bottom-Sheet-Variante mit Griff.
4. Standard-Set prüfen (`defaultEnabled`) – nur mit Svens Okay pro Tool, Änderungen betreffen neue Installationen.

## Ziel-Klickzahlen (D = Desktop / A = Android)
| Handlung | heute D/A | Ziel D/A | durch |
|---|---|---|---|
| Theme / Dichte wechseln | 3 / 4 | 1–2 / 2 | Schnellschalter, Palette |
| Lesehilfe an/aus | 0–3 / 4 | 0–1 / 2 | Schnellschalter |
| Stumm | 4+ / 5+ | 2 / 2 | neuer Stumm-Schalter |
| Backup jetzt / Update prüfen | 3 / 4 | 2 / 2–3 | Palette-Befehle, Häufig genutzt |
| Einstellungen eines Moduls | 2+scroll / 3+scroll | 1 / 1 | Kontext-Zahnrad |
| Einstellung aus Kontext | 3–4 / 4–5 | 1 / 1 | Kontext-Zahnrad |
| Modul an / aus | 2 / 3 (aus 3 / 4) | 1–2 / 2 | Listen-Schalter |
| Tool starten | 2 / 3 | 1–2 / 2 | Palette, zuletzt genutzt zuerst |
| Tool hinzufügen / umsortieren | 3 / n | 2 / 1 Ziehen | ToggleList |
| Startdaten laden | 3+scroll | 2 | Knopf in Karte |

## Tests (je Paket)
Unit: Suche (Synonyme, Modulnamen inkl. inaktiv, Direktumschaltung, Allow-Liste), Häufig genutzt (lokal, aus, nichts im Sync-Scope), Deep-Link-Parser, Zurücksetzen (Keys/Defaults unverändert), Undo, Tool-Ausdrücke. E2E (Desktop + Android-Viewport): Klickzählung der 20 Handlungen, Zahnrad aus Widget, Modul per Listen-Schalter, Tool per `Strg+.` und per Palette, Zurück-Geste. A11y: Tastatur, Fokus-Rückgabe, Reduced Motion. Messung nach jedem Paket in `06-settings-results.md`.

## Risiken
- `useSections`/Registry und `CommandPalette.tsx` sind Hotspots: Zeile in CHATS.md, kleine lokale Änderungen, bei Konflikt in Registry/Logik STOPP.
- Stumm-Schalter berührt `core/notifications`: nur lesende Erweiterung der Ruhezeit-Prüfung, getestet; wenn das nicht ohne Logik-Umbau geht → Rückfrage.
- Direktumschaltung in der Palette darf nie sicherheitsrelevante Felder erreichen (Allow-Liste + Test).

## Freigabe
Bitte freigeben (oder ändern): Paket A wie oben, Paket B danach. Empfehlung: Umsetzung mit **Sonnet** (Modellwechsel jetzt ok); Plan Mode kurz pro Paket.
