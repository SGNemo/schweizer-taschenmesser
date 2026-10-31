# T3 – Vorschlagsliste `preview` (Stopp 1, 2026-10-31)

Mechanismus ist gebaut (PR `claude/friendly-tesla-ak9vb6`), **alles steht auf `stable`**. Sven kreuzt an; der Chat setzt dann nur die angekreuzten auf `preview` und baut die Tests. Regel bleibt: `preview` versteckt nur in Katalogen (Bibliothek, Werkzeugkasten, Palette, Widget-Liste, Einstellungen) bis „In Arbeit anzeigen“ (Einstellungen → Darstellung → „Mehr Felder anzeigen“) an ist; was schon an, angepinnt oder in Benutzung ist, bleibt sichtbar. Nichts wird gelöscht, kein Default ändert sich.

Spalten: Objekt im Mechanismus · ein Satz Begründung · Empfehlung.

## Genannte Kandidaten
- [ ] **KI-Chat** – Modul `chat`. Aus by default, hängt an KI-Anbietern/lokalem Modell, wenig Handtests. → **preview**
- [ ] **Lokale API** – Abschnitt `localapi`. Desktop-Entwicklerschnittstelle, aus by default; bleibt sichtbar, solange sie an ist (`previewInUse` liest `localApi.config.enabled`). → **preview**
- [ ] **Lesehilfe** – Abschnitt `reading`. Experimentelle Darstellung, aus by default; bleibt sichtbar, solange sie an ist (`previewInUse`: `readAid`). → **preview**
- [ ] **In-App-Erinnerungskarte, gestaffelte Vorwarnungen, Nachfass-Erinnerung** – Felder im Abschnitt `calm-reminders`, kein eigener Abschnitt. Reifegrad gilt je Abschnitt; ein Feld-Reifegrad (Felder in eine gefaltete Gruppe „In Arbeit“) wäre ein Folgepaket. → **nein (jetzt)**, Folgepaket, wenn gewünscht
- [ ] **Google-Drive-Stub** – nur `core/sync/adapters/googleDrive.stub.ts`, ohne UI; nichts, das ein Nutzer sieht. → **nein** (nichts zu markieren)
- [ ] **Textvergleich** – Werkzeug `diff`. Entwickler-Helfer, aus by default, wenige Nutzer. → **preview**
- [ ] **Regex** – Werkzeug `regex`. Wie Textvergleich. → **preview**
- [ ] **Bildschirmfoto** – Werkzeug `screenshot`. Handtest B1 (WebView2 `getDisplayMedia`) offen. → **preview**
- [ ] **Wetter inkl. Luft/Pollen** – Abschnitt `weather` + Home-Zeile (Core-Block, nicht im Widget-Katalog). An by default und mehrfach überarbeitet; `preview` würde die Wetterzeile für alle verstecken (Default-Änderung). → **stable**; wenn doch: Abschnitt `preview` + kleine Reifegrad-Tabelle für Core-Blöcke in `home/Home.tsx`
- [ ] **Spotify-Verbindung + Player-Widget** – Connector `spotify` + Core-Block `core:nowplaying`. Desktop-OAuth, Premium-Abhängigkeit, Handtests offen; Connectoren haben noch kein `maturity` (additives Feld in `core/connectors/types.ts` + Filter in `ConnectorsSection`, klein). → **preview**
- [ ] **Zock-Modus** – Karte `GameModeCard` im Abschnitt `notifications`, kein eigener Abschnitt; Handtests Z1–Z5 offen. Eigener Abschnitt wäre ein Umbau. → **nein (jetzt)**, Folgepaket wie bei den Feldern
- [ ] **Sprach-Taste** – Abschnitt `voice`. Plattformabhängig (Taste F4, globaler Hotkey), Handtests offen; bleibt sichtbar, solange aktiviert (`previewInUse`: `tm-voice` enabled). → **preview**
- [ ] **Karten & Orte mit Route und Bus/Bahn** – Modul `maps`. Drei Pakete frisch gemergt (#316/#323/#329), externe Dienste (OSRM, Transitous), Desktop-Kacheln gerade erst repariert (#331). → **preview**
- [ ] **Mit Partner teilen** – Abschnitt `share`. Review-Punkte zu #290 offen (Wording, Toasts, `save()`); bleibt sichtbar, solange ein Paar verbunden ist. → **preview**
- [ ] **Verbindungsprotokoll / Netzwerk sperren** – Abschnitt `network` (#284). Fortgeschrittene Transparenzfunktion, für Einsteiger ein Reiz mehr; bleibt sichtbar, solange „Netzwerk sperren“ an ist. → **preview**
- [ ] **Zuletzt gelöscht** – Abschnitt `recently-deleted` (#318/#325). Sicherheitsnetz nach dem Löschen; versteckt würde es Nutzer verunsichern, die etwas suchen. → **stable**

## Weiteres, standardmäßig aus oder in STATUS offen
- [ ] **Browser-Erweiterung** – Abschnitt `browser-extension` (nur mit Tresor). Hardware-Checkliste X1–X14 offen, nur Brave/Chromium. → **preview**
- [ ] **Module aus by default** (`accounts`, `bookmarks`, `budgets`, `disk`, `lists`, `notes`, `pantry`, `people`, `vault`) – fertige Module; „aus by default“ ist eine Startauswahl, kein Reifegrad. → **stable**
- [ ] **Werkzeuge aus by default** (`dates`, `dev`, `dice`, `image`, `pdf`, `text`, `timezones`, `units`) – klein und fertig; `defaultEnabled: false` heißt „aus, aber sichtbar“. → **stable**
- [ ] **Beispiel-Modul `example`** – bleibt beim Dev-Flag (`devOnly`), kein Reifegrad nötig. → **stable**
- [ ] **Spotify-Musik in Fokusrunden** – Zeile `FocusMusicRow` im Abschnitt `focus`, Feld, kein Abschnitt. → **nein (jetzt)**
- [ ] **Handy-Layout, Update-Test, Hardware-Checklisten** – Zustände ohne Objekt im Mechanismus (Gerätetests). → nichts zu markieren

## Nach der Antwort (Aufgabe 4–5)
Angekreuzte auf `preview` (eine Zeile je Manifest/Abschnitt, `previewInUse` wo oben genannt), `e2e/maturity.spec.ts` (Desktop + pixel-7) mit einem angekreuzten Werkzeug, Doku-Zeilen fertig. Ohne angekreuztes Werkzeug nimmt der E2E-Test `diff`.
