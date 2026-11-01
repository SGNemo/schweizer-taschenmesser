# T3 – Vorschlagsliste `preview` (Stopp 1, 2026-10-31)

Mechanismus ist gebaut (PR #347, `claude/friendly-tesla-ak9vb6`). **Beantwortet 2026-11-01:** die angekreuzten zwölf stehen auf `preview` (Modul `chat`, `maps`; Werkzeuge `diff`, `regex`, `screenshot`; Abschnitte `localapi`, `share`, `network`, `browser-extension`, `reading`, `voice`; Connector `spotify`), alles andere bleibt `stable`. Regel bleibt: `preview` versteckt nur in Katalogen (Bibliothek, Werkzeugkasten, Palette, Widget-Liste, Einstellungen) bis „In Arbeit anzeigen“ (Einstellungen → Darstellung → „Mehr Felder anzeigen“) an ist; was schon an, angepinnt oder in Benutzung ist, bleibt sichtbar. Nichts wird gelöscht, kein Default ändert sich.

Spalten: Objekt im Mechanismus · ein Satz Begründung · Empfehlung.

## Genannte Kandidaten
- [x] **KI-Chat** – Modul `chat`. Aus by default, hängt an KI-Anbietern/lokalem Modell, wenig Handtests. → **preview**
- [x] **Lokale API** – Abschnitt `localapi`. Desktop-Entwicklerschnittstelle, aus by default; bleibt sichtbar, solange sie an ist (`previewInUse` liest `localApi.config.enabled`). → **preview**
- [x] **Lesehilfe** – Abschnitt `reading`. Experimentelle Darstellung, aus by default; bleibt sichtbar, solange sie an ist (`previewInUse`: `readAid`). → **preview**
- [ ] **In-App-Erinnerungskarte, gestaffelte Vorwarnungen, Nachfass-Erinnerung** – Felder im Abschnitt `calm-reminders`, kein eigener Abschnitt. Reifegrad gilt je Abschnitt; ein Feld-Reifegrad (Felder in eine gefaltete Gruppe „In Arbeit“) wäre ein Folgepaket. → **nein (jetzt)**, Folgepaket, wenn gewünscht
- [ ] **Google-Drive-Stub** – nur `core/sync/adapters/googleDrive.stub.ts`, ohne UI; nichts, das ein Nutzer sieht. → **nein** (nichts zu markieren)
- [x] **Textvergleich** – Werkzeug `diff`. Entwickler-Helfer, aus by default, wenige Nutzer. → **preview**
- [x] **Regex** – Werkzeug `regex`. Wie Textvergleich. → **preview**
- [x] **Bildschirmfoto** – Werkzeug `screenshot`. Handtest B1 (WebView2 `getDisplayMedia`) offen. → **preview**
- [ ] **Wetter inkl. Luft/Pollen** – Abschnitt `weather` + Home-Zeile (Core-Block, nicht im Widget-Katalog). An by default und mehrfach überarbeitet; `preview` würde die Wetterzeile für alle verstecken (Default-Änderung). → **stable**; wenn doch: Abschnitt `preview` + kleine Reifegrad-Tabelle für Core-Blöcke in `home/Home.tsx`
- [x] **Spotify-Verbindung + Player-Widget** – Connector `spotify` + Core-Block `core:nowplaying`. Desktop-OAuth, Premium-Abhängigkeit, Handtests offen; Connectoren haben noch kein `maturity` (additives Feld in `core/connectors/types.ts` + Filter in `ConnectorsSection`, klein). → **preview**
- [ ] **Zock-Modus** – Karte `GameModeCard` im Abschnitt `notifications`, kein eigener Abschnitt; Handtests Z1–Z5 offen. Eigener Abschnitt wäre ein Umbau. → **nein (jetzt)**, Folgepaket wie bei den Feldern
- [x] **Sprach-Taste** – Abschnitt `voice`. Plattformabhängig (Taste F4, globaler Hotkey), Handtests offen; bleibt sichtbar, solange aktiviert (`previewInUse`: `tm-voice` enabled). → **preview**
- [x] **Karten & Orte mit Route und Bus/Bahn** – Modul `maps`. Drei Pakete frisch gemergt (#316/#323/#329), externe Dienste (OSRM, Transitous), Desktop-Kacheln gerade erst repariert (#331). → **preview**
- [x] **Mit Partner teilen** – Abschnitt `share`. Review-Punkte zu #290 offen (Wording, Toasts, `save()`); bleibt sichtbar, solange ein Paar verbunden ist. → **preview**
- [x] **Verbindungsprotokoll / Netzwerk sperren** – Abschnitt `network` (#284). Fortgeschrittene Transparenzfunktion, für Einsteiger ein Reiz mehr; bleibt sichtbar, solange „Netzwerk sperren“ an ist. → **preview**
- [ ] **Zuletzt gelöscht** – Abschnitt `recently-deleted` (#318/#325). Sicherheitsnetz nach dem Löschen; versteckt würde es Nutzer verunsichern, die etwas suchen. → **stable**

## Weiteres, standardmäßig aus oder in STATUS offen
- [x] **Browser-Erweiterung** – Abschnitt `browser-extension` (nur mit Tresor). Hardware-Checkliste X1–X14 offen, nur Brave/Chromium. → **preview**
- [ ] **Module aus by default** (`accounts`, `bookmarks`, `budgets`, `disk`, `lists`, `notes`, `pantry`, `people`, `vault`) – fertige Module; „aus by default“ ist eine Startauswahl, kein Reifegrad. → **stable**
- [ ] **Werkzeuge aus by default** (`dates`, `dev`, `dice`, `image`, `pdf`, `text`, `timezones`, `units`) – klein und fertig; `defaultEnabled: false` heißt „aus, aber sichtbar“. → **stable**
- [ ] **Beispiel-Modul `example`** – bleibt beim Dev-Flag (`devOnly`), kein Reifegrad nötig. → **stable**
- [ ] **Spotify-Musik in Fokusrunden** – Zeile `FocusMusicRow` im Abschnitt `focus`, Feld, kein Abschnitt. → **nein (jetzt)**
- [ ] **Handy-Layout, Update-Test, Hardware-Checklisten** – Zustände ohne Objekt im Mechanismus (Gerätetests). → nichts zu markieren

## Umgesetzt (Aufgabe 4–5)
`maturity: 'preview'` in den Manifesten/Abschnitten oben; „in Benutzung“ hält einen Preview-Abschnitt sichtbar (`SettingsContext.inUse` aus `useSectionsInUse`: lokale API läuft, Lesehilfe an, Sprach-Taste an, Netzwerk gesperrt, ein Teilen-Paar). Connectoren haben ein optionales `maturity` (`ConnectorDef`, Filter `core/connectors/registry.ts` `isVisible`: verbunden = sichtbar). `e2e/maturity.spec.ts` (Desktop + pixel-7) prüft Werkzeugkasten, Bibliothek, Palette, Einstellungen, Badge und „bleibt erreichbar“; die Specs der Preview-Funktionen schalten „In Arbeit anzeigen“ per `showPreview(page)` (`e2e/helpers.ts`) ein. Folgepaket (nicht gebaut): Feld-Reifegrad für Erinnerungs-Felder und Zock-Modus-Karte.
