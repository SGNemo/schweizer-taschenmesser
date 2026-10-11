# 04 – Reibung: Einstellungen, Modul-Bibliothek, Werkzeugkasten

Phase 1 der Komfort-Evaluierung (Stand `develop` @ d48a4fee, 2026-10-11). Deutsch, weil Sven hier entscheidet. Keine Code-Änderung.

**Methode und Grenzen:** Klickzahlen sind aus dem Code abgeleitet (Router, Layout, Registry, Komponenten), nicht im Browser gestoppt. Gezählt wird ab „App offen auf der Startseite“. „Klick“ = Klick oder Tap; Tastenfolgen zählen einzeln. Screenshots (1920×1080, 412×915) und eine Stoppuhr-Messung kommen in Phase 3 (`06-settings-results.md`), dann vorher/nachher mit denselben Schritten. `01–03` im Ordner gibt es nicht (nicht vorhanden, nicht erfunden).

## 1. Was heute schon gut ist (nicht neu bauen)
- **Eine Registry für alles:** `core/settings/registry` (13 Kategorien, Sektionen + `fields`), Suche, Palette und Seite werden daraus erzeugt. Module liefern Sektionen über `manifest.settings`.
- **Deep-Link existiert:** `settingsPath(category, section, field)` → `/settings/<kat>#<sektion>--<feld>`, scrollt hin und hebt 1,6 s hervor (`useDeepLink`). Module und Widgets nutzen es bereits als Textlink (≈ 30 Dateien, z. B. `SyncBadge`, todos/pantry/calendar-Widgets).
- **Suche** findet Titel, Beschreibung, `keywords`, Kategorie und einzelne Felder (alle Wörter müssen vorkommen, Umlaute egal). Palette: `Einstellung: …` (nur nach Eingabe „einst…“).
- **Palette** hat Verlauf (lokal, abschaltbar), Rechner („19% von 240“), Werkzeug-Befehle, Einrichtung. `Strg+.` öffnet den Werkzeugkasten (AppShell).
- **Android:** Kategorienliste mit Untertitel + Status (`CategoryStatus`: Sync, Updates, KI, Verbindungen); Zurück-Link in der Kategorie.
- **Bibliothek:** Aktivieren ist schon *ein* Button auf der Karte; Deaktivieren hat Daten-Dialog (behalten/löschen).

## 2. Die 20 Handlungen
Klicks heute D = Desktop (Sidebar sichtbar), A = Android (Mehr → …). Ziel = Richtwert aus der Aufgabe.

| # | Handlung | Weg heute | D | A | Ziel | Befund |
|---|---|---|---|---|---|---|
| 1 | Theme wechseln | Einstellungen → Darstellung → Segment | 3 | 4 | 1 | kein Schnellschalter, nirgends sonst erreichbar |
| 2 | Dichte wechseln | wie 1 (Zeile weiter unten, scrollen) | 3+ | 4+ | 2 | Darstellung hat 11 Felder auf einer Seite |
| 3 | Sprache wechseln | Feld `general--language` zeigt nur „Deutsch“ | – | – | – | **entfällt** (UI nur Deutsch, CLAUDE.md); Zeile ist reine Info, Suche findet sie trotzdem |
| 4 | Lesehilfe an/aus | `Alt+L` oder Darstellung → Lesen → Schalter | 0–3 | 4 | 1 | Taste ok, aber unauffindbar; Android hat keinen Weg unter 4 |
| 5 | Benachrichtigungen stummschalten | nur Ruhezeit konfigurieren (Benachrichtigungen → Ruhige Erinnerungen) | 4+ | 5+ | 1–2 | **Sackgasse:** kein „Stumm für 1 Stunde/bis morgen“ |
| 6 | Sync-Status prüfen | `SyncBadge` in der Leiste (nur wenn Sync an) | 0 sehen, 1 Details | 0/1 | 1 | gut; ist aber ein Link, kein Status-Popover (Sync jetzt auslösen fehlt dort) |
| 7 | Backup jetzt erstellen | Einstellungen → Sync → Backup → Button | 3 + scrollen | 4 + scrollen | 2 | Kategorie „Sync“ trägt Backup (Altlast), schwer zu raten; Palette findet „Einstellung: Backup“ nur mit Präfix |
| 8 | Update prüfen | Einstellungen → Updates → „Jetzt prüfen“ | 3 | 4 | 2 | Banner erscheint von selbst, Prüfen nicht aus der Palette |
| 9 | KI-Provider wechseln / Limit | Einstellungen → KI → Sektion „KI“ (Schalter-Sektion steht davor) | 3+ | 4+ | 2 | Sektion mit 428 Zeilen, lang; keine Provider-Umschaltung aus dem Chat |
| 10 | Hotkey ändern | Einstellungen → Schnellerfassung → aufnehmen | 3 | – | 3 | nur Desktop; Fehlertexte vorhanden; Ziel erreicht |
| 11 | Modul aktivieren | Sidebar „Bibliothek“ → „Aktivieren“ (+ ggf. Startdaten-Dialog) | 2 (+1) | 3 (+1) | 2 | ok; kein Schalter in der Liste, kein Vorschau-Widget |
| 11b | Modul deaktivieren | Bibliothek → „Deaktivieren“ → Dialog (behalten/löschen) | 3 | 4 | 2 | Dialog nötig (Datenhinweis); ein Schritt weniger nur wenn keine Daten da sind |
| 12 | Einstellungen *eines* Moduls öffnen | Einstellungen → Module → durch lange Seite scrollen (alle Modul-Sektionen gestapelt) | 2 + scrollen | 3 + scrollen | 1 | **kein Einstieg aus dem Modul** (kein Zahnrad; nur Chat hat ein Einstellungs-Icon) |
| 13 | Tool starten | Leiste „Werkzeuge“ → Kachel | 2 | 3 (Mehr → Werkzeuge → Kachel) | 1–2 | ok; Tools in der Palette: „Werkzeug: Rechner“ → 3 Tasten + Enter |
| 14 | Tool zur Leiste hinzufügen | Werkzeuge → „verwalten“ → Schalter (oder Einstellungen → Werkzeuge) | 3 | 4 | 2 | **zwei fast gleiche Oberflächen** (`ToolLibrary` und `ToolsSection`), kein Abgleich |
| 15 | Tool-Reihenfolge ändern | Pfeil hoch/runter je Schritt | n Klicks | n Klicks | 1 | kein Ziehen; 5 Plätze = 5 Klicks |
| 16 | Werkzeugkasten per Tastatur | `Strg+.` | 1 Taste | – | 1 | funktioniert, steht aber **nicht** in der Kürzelübersicht `?` (nur Hint-Text `t.tools.shortcut`) |
| 17 | Einstellung aus dem Kontext ändern („Erinnerung nicht mehr zeigen“) | Textlinks in einzelnen Modulen; nirgends systematisch | 3–4 | 4–5 | 1 | **kein Muster**: kein Zahnrad in Widgets/Modul-Kopf/Dialogen |
| 18 | Supporter-Code eingeben | Einstellungen → Über → Supporter | 3 + scrollen | 4 + scrollen | 3 | selten; ok, aber „Über“ ist ein Sammelbecken (Version, Setup, Lizenzen, Supporter) |
| 19 | Einrichtung erneut starten | Palette „Einrichtung“ (3–4 Tasten) oder Über → Setup / Bibliothek-Link | 2–3 | 4 | 2 | ok |
| 20 | Diagnose exportieren | Über-/Entwickler-Bereich (`core/diagnostics`), im Release nicht auf einen Blick auffindbar | 3+ | 4+ | 2 | per Suche „Diagnose“ prüfen (Phase 3: Keyword ergänzen, wenn fehlend) |
| 21 | Startdaten für Modul laden | Einstellungen → Module → Modulsektion → Button, oder Dialog nach dem Aktivieren | 3 + scrollen | 4 + scrollen | 2 | in der Bibliothek-Karte selbst fehlt der Knopf |

Zusammenfassung: häufige Umschalter (1, 2, 4) kosten 3–4 Klicks statt 1–2; „Einstellung aus Kontext“ (12, 17) und „Stumm“ (5) sind echte Lücken; der Rest ist nahe am Ziel.

## 3. Zusätzliche Prüfpunkte
- **Suche – Synonyme:** nur `keywords` pro Sektion/Kategorie, keine Synonymliste; Treffer hängen davon ab, ob jemand das Wort eingetragen hat (Beispiel `Dunkelmodus` bei Darstellung). Umgangssprache („leise“, „Schrift größer“) ist nicht abgedeckt; Stichproben mit echten Begriffen folgen in Phase 3 als Test. **Modulnamen:** Modul-Sektionen sind nur sichtbar, wenn das Modul an ist (`visibleWhen`) – ein deaktiviertes Modul taucht in der Einstellungssuche nicht auf.
- **Suche – Treffer:** Link zur Sektion, keine Umschaltung im Treffer; auf dem Handy ist die Suche **nur in der Kategorienliste** sichtbar (`wide || !inCategory`), nicht innerhalb einer Kategorie, und nicht sticky.
- **Suche – Ranking:** Titel-Anfang 3, Titel enthält 2, sonst 1; Feld-Treffer 2/0; max. 12; bei Gleichstand keine Nutzungsgewichtung.
- **Palette:** Einstellungen erscheinen erst, wenn die Eingabe mit „einst“ beginnt (Absicht: Enter nicht kapern). Folge: „theme“ allein findet nichts, obwohl `Darstellung → Theme` existiert. Bibliothek-Module und Tools sind getrennte Befehlsgruppen ohne gemeinsame Ranking-Logik.
- **Deep-Links:** nur intern (`/settings/…#…`), kein `nemo://`-Schema; Bibliothek und Werkzeuge haben keine Anker (`/library`, `/tools` ohne `#id`). Hervorhebung funktioniert nur für Sektionen/Felder mit DOM-Id.
- **Tastatur:** Palette voll per Tastatur; Werkzeug-Kacheln sind Buttons. Reihenfolge ändern geht per Tastatur (Pfeil-Buttons), ist aber langsam. Kein `?`-Eintrag für `Strg+.`.
- **Android-Zurück:** Kategorie → Zurück-Link auf der Seite (nicht Browser-Back/Geste verifiziert); Dialoge (Werkzeuge/Mehr) sind `<dialog>`; ob die System-Zurück-Geste sie schließt, ohne die Seite zu verlassen, muss im E2E mit Android-Viewport geprüft werden (offener Punkt).
- **Zustandsanzeigen Kategorien-Leiste:** nur 4 von 13 Kategorien (Sync, Updates, KI, Verbindungen). Fehlend: Benachrichtigungen (Erlaubnis), Sicherheit/Tresor (gesperrt?), Backup (letzter Stand), Module („12 aktiv“).
- **Leerzustände:** Tools „Es sind keine Werkzeuge eingeschaltet“ + Link vorhanden; Einstellungssuche „Keine Treffer“ ohne Vorschlag; Bibliothek ohne Suche, kein Leerzustand nötig.
- **Hilfetexte:** `HelpHint` je Sektion, dazu Beschreibung je Feld. In Darstellung/Fokus/Ruhige Erinnerungen sind das oft zwei bis drei Zeilen pro Zeile → eher zu viele auf einer Seite; in Werkzeugen/Bibliothek eher passend. „Erweitert“-Trennung fehlt.
- **Bibliothek/Werkzeuge:** zwei Seiten, zwei Karten-Raster, gleiche Muster (Karte + Schalter/Button + Beschreibung) in zwei Implementierungen; Bibliothek ohne Suche, ohne „neu/aktualisiert“, ohne Vorschau, ohne Reihenfolge (Favoriten/Sidebar in `core/settings/nav.ts` getrennt, `MAX_FAVOURITES`).

## 4. Bewertung der Vorschläge (Vorgriff auf Phase 2)
| Vorschlag | Misst sich an | Einschätzung |
|---|---|---|
| Schnellschalter-Leiste (Theme, Dichte, Lesehilfe, Fokus, Stumm) | 1, 2, 4, 5 | **hoher Hebel**, klein; auch Palette-Befehle ohne Präfix |
| Kontext-Zahnrad → Deep-Link | 12, 17 | **hoher Hebel**, Grundlage ist da (`settingsPath` + Highlight); es fehlt eine Komponente + Konvention |
| Palette findet Einstellungen ohne „einst“, mit Direktumschaltung | 1, 2, 4, 7, 8 | hoher Hebel; Absicht des Präfix (kein Enter-Kapern) bleibt über Ranking lösbar |
| Suchsynonyme + Modulnamen (auch inaktive) | Suche | mittel, billig (Keyword-Daten, kein neues System) |
| Häufig genutzt (automatisch, lokal) | 7–10, 18–21 | mittel; ein Pinn-/Verlauf-Mechanismus existiert für die Palette (`core/search/recent.ts`) und kann gleich wirken; „abschaltbar“ → Fokus-Schalter `searchHistory` wiederverwenden |
| „Erweitert“ pro Kategorie | Hilfetexte/Dichte | mittel-groß (jede Sektion braucht Einstufung); Risiko: Einstellung „verschwindet“ → nur mit klarem Zähler („3 weitere“), Suche muss Erweitertes finden |
| Zurücksetzen pro Abschnitt, Undo-Toast | Sicherheit/Standardwerte | **Vorsicht:** Zurücksetzen darf Sicherheits-Sektionen (Tresor, Auto-Lock, Updater-Kanal, Keys) nicht erfassen; Undo-Infrastruktur existiert (`core/undo`) |
| Listen-Schalter + Vorschau + Startdaten in der Bibliothek | 11, 21 | mittel; geteilte Komponente für Bibliothek und Tool-Bibliothek ist sinnvoll (Duplikat jetzt) |
| Drag-and-drop-Reihenfolge | 15 | mittel; Tastatur-Alternative muss bleiben (Pfeil-Buttons); keine neue schwere Abhängigkeit → eigene Lösung mit Pointer-Events |
| Tool aus der Suchleiste („timer 10m“, „umrechnen 5 km“) | 13 | Rechner gibt es schon; Timer/Einheiten brauchen Parser pro Tool (`ToolManifest.expressions?`); lokal, kein Netz |
| Tool-Fenster lösbar / Always-on-top, Timer als Benachrichtigung | – | **groß, plattformnah** (Tauri-Fenster, `core/platform/**`, Android-Dienst); nicht in einen Komfort-PR, eigenes Paket oder streichen |
| `nemo://`-Schema | 17 | nur sinnvoll als interner Adapter auf `settingsPath`/Routen (Doku, Palette, Widgets); ein OS-Protokoll-Handler wäre Plattformarbeit + Sicherheitsfläche → **nicht** in diesem Umfang |
| Bibliothek: „Empfohlen für dich“ nach aktiven Modulen | – | konfliktträchtig mit „weniger Optionen/Reize“ (FOCUS-GUIDELINES: Reizlast); nur mit Aus-Schalter, Wert unklar → Rückfrage |
| `?`-Übersicht | 16 | trivial: `Strg+.` und neue Kürzel ergänzen |

## 5. Grenzen, die ich einhalte
- Sicherheitsrelevante Sektionen (Tresor/accounts, Auto-Lock, Biometrie, Keys/Tokens, Updater-Kanal, Datenträger) bleiben unverändert; Schnellschalter, Häufig-genutzt, Zurücksetzen und Erweitert erfassen sie nicht.
- Keine Einstellung verliert Schlüssel/Standardwert; `fields`-Keys sind Teil der Deep-Links und bleiben stabil.
- Texte nur über `strings.ts`. Die Aufgabe nennt „alle Sprachen/Glossar/`check:i18n`“: das Projekt ist **nur Deutsch** (CLAUDE.md) und hat kein `check:i18n`; ich halte mich an CLAUDE.md und `check:modules`/`check:docs`.
- Hotspots laut `CHATS.md`: `pages/settings/*` und `layout/AppShell.tsx`, `router.tsx` klein halten; `core/modules/types.ts`/`registry.ts` und `core/platform/**` nur mit Zeile in CHATS.md. Die Bibliothek-Änderung berührt Modul-Komfort-Chat (parallel) – `ModuleLibrary.tsx` ist laut Aufgabe gemeinsame Zone: vor Paket B abstimmen.

## 6. Offene Fragen an Sven → Phase 2
Gebündelt gestellt in der Chat-Antwort (siehe dort): Reichweite von Plattform-Themen (Tool-Fenster, `nemo://`), „Empfohlen für dich“, „Erweitert“-Umfang, Palette-Verhalten ohne „einst“.
