# Manuelle Tests offen

Nur auf echter Hardware prüfbar (das macht Sven am Ende). Alles andere ist per Unit-/E2E-Tests und CI-Läufen abgedeckt.

**Aufbau:** eine Liste je Gerät, von oben nach unten: [Windows](#windows) · [Android](#android) · [Beide Geräte: zusammen oder je einmal](#beide-geräte-zusammen-oder-je-einmal) · [Beide Geräte: egal welches](#beide-geräte-egal-welches) · [Website](#website) · [Konten nötig (Google, Spotify, Ko-fi)](#konten-nötig-google-spotify-ko-fi). Darin nach Modul; die kleine Überschrift nennt den Block (meist den PR), aus dem der Test stammt. Ids bleiben; Ids, die mehrfach vorkamen, tragen ein Themen-Kürzel davor ([Umbenannte Ids](#umbenannte-ids)). Neuer Test: in den Abschnitt des Geräts, das er braucht, unter sein Modul, mit einer Id, die es noch nicht gibt. Installation und Update Schritt für Schritt: [Anleitungen für Sven](#anleitungen-für-sven-aus-status-verschoben-2026-10-02).

## Windows

Nur am Windows-PC (portable Exe oder Dev-Preview-Exe).

### App: Installation und Update

#### Release 0.3.1 prüfen

RL-R1. _Windows-Portable frisch herunterladen_ (`Nemo-Portable.exe` von der Release-Seite `v0.3.1`) und starten; SmartScreen-Hinweis ist erwartet; Über-Dialog zeigt `0.3.1`. ☐

#### Datenträger, Systeminfo (diese Runde) – nur auf echtem Windows prüfbar

Windows-Portable-Größe vorher/nachher: nur der Release-Workflow kann sie messen (Dry-Run auf `develop`, siehe HOW-TO; aus STATUS verschoben, 2026-11-10).
Alles mit einem **Testordner** mit erfundenen Dateien, nie mit echten Nutzerdaten:
DT-D14. _Berechtigungen:_ App startet, Updater, Google-Login und lokale API funktionieren weiterhin (alle App-Befehle sind jetzt einzeln freigegeben; `capabilities/desktop.json`). ☐

#### Portable Windows-Build (Phase 13)

Nur auf echtem Windows prüfbar (CI baut nur; der Smoke-Test dort ist informativ):
P1. _Start:_ `Nemo-Portable.exe` (Pre-Release-Download) starten, SmartScreen „Weitere Informationen → Trotzdem ausführen". Die App öffnet sich, die Daten der bisher installierten Version sind da (gleiche App-Kennung). ☐
P2. _WebView2 fehlt:_ auf einem Rechner/VM ohne WebView2 startet die exe → deutsches Meldungsfenster mit „OK" (öffnet die Microsoft-Seite) statt stillem Absturz. ☐
P3. _Portabler Modus:_ Ordner `data` neben die exe legen, starten → die App ist leer (neues Profil), `data\` füllt sich; ohne den Ordner wieder das Benutzerprofil. ☐
P4. _Update (erst ab dem zweiten portablen Release):_ Kanal Beta → „Jetzt prüfen" → „Jetzt aktualisieren": Backup, Download, die exe ersetzt sich, startet neu, neue Version, Daten da, im Ordner bleiben keine `.old`/`.new`-Dateien (nach dem nächsten Start). ☐
P5. _Fehlerfall:_ exe in einen schreibgeschützten Ordner legen und aktualisieren → verständliche Meldung („Ordner nicht beschreibbar"), alte Version läuft weiter. ☐

#### Nemo: Umbenennung und Design

N1. _Windows-Portable starten (frische Datei und als Update):_ Taskleisten-Icon zeigt den Fisch, Fenstertitel „Nemo“, Tray/Benachrichtigungen ohne „Taschenmesser“; Update von einer alten Version findet die Datei (`latest.json` zeigt ab dem nächsten Release auf `Nemo-Portable.exe`), Daten bleiben erhalten.
N1a. _Lade-Robustheit und Browser-Tab (UI-Audit 0a, Windows; Ergebnis als Tabelle Schritt · „…“ ja/nein · Titelleiste an den nächsten Chat oder ins Notiz-Repo):_ (1) Variante notieren: Dev-Preview-Exe oder `tauri dev`. (2) Frisch starten, ohne Browser-Tab ToDos, Gewohnheiten und Zeiterfassung öffnen: jede Seite erscheint, keine bleibt bei „…“. (3) Browser-Modul → eine Adresse laden: die Seite erscheint im Rahmen. (4) Danach dieselben drei Module öffnen: jede erscheint; bleibt eine länger als vier Sekunden leer, steht dort „Die Seite lädt noch“ mit „Neu laden“. (5) Während (3) und (4) das Fenster ziehen und die Titelleiste ansehen: „Keine Rückmeldung“ = Hauptthread blockiert. (6) Tray-Icon anklicken: es reagiert. (7) Auf einer Modulseite „Neu laden“ auslösen (oder Strg+R), zurück zum Browser-Modul: der Tab ist wieder sichtbar; fehlt er, bietet die Seite „Tab neu öffnen“; beim Verlassen des Moduls verschwindet er. (8) Nur wenn in (5) das Fenster reagierte und trotzdem eine Seite leer blieb: in den WebView2-DevTools (Netzwerk) den hängenden `assets/*.js`-Request notieren (Adresse ohne Query, Status). Seit #638 baut `browser_open` den Tab nicht mehr auf dem Hauptthread: der Test prüft diesen Fix, „Keine Rückmeldung“ wäre ein Rückfall. ☐
N13. _Autostart (Windows):_ Wenn Autostart in 0.2.0 aktiv war: nach dem Update prüfen, ob der Eintrag noch „Taschenmesser“ heißt und die App ihn als „aus“ anzeigt (siehe REVIEW M10). ☐

### Logo und Icons

#### Nemo: Umbenennung und Design

N8. _Windows-Portable mit dem Logo „Welle“:_ Icon in Taskleiste, Titelleiste, Tray und Alt-Tab zeigt den neuen Fisch (7 ICO-Größen), Fenstertitel „Nemo“, Tray-Tooltip „Nemo“. ☐
CF-N11. _Neues Clownfisch-Icon (Branch `design/app-icon`), Windows-Portable:_ Taskleiste (hell/dunkel, 100–200 % Skalierung), Tray, Alt-Tab und Fenstertitel zeigen den geneigten Fisch auf der orangen Kachel, nicht unscharf bei 16/24/32 px. ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM1 Eingeklappte Seitenleiste, Fisch v2.2:** bei 125 % Skalierung: Kachel und Symbole scharf, Tooltip mit Maus und Tab, Taskleisten-Icon zeigt den neuen Fisch. (PR #669) ☐

#### Logo v2 (Branch `design/logo-v2`) – nur auf Geräten prüfbar

Neues Zeichen: orangefarbene Kachel mit weißem Fisch (App-Symbol), Pille „Mark + NEMO“ in der Seitenleiste; Farbe = Akzent-Token (`#b5430c` hell, `#ff9a57` dunkel).
- **LG1 Windows-Taskleiste:** Portable-App starten: Taskleisten-Symbol bei 100 % und 150 % Skalierung, mit heller und dunkler Taskleiste, zeigt die Kachel mit dem Fisch (Bänder und Auge erkennbar, Ecken nicht abgeschnitten); Alt+Tab und Fensterleiste dasselbe. ☐
- **LG2 Windows-Tray:** Tray-Symbol („Heute“) im Infobereich bei 16 und 24 px erkennbar, helle und dunkle Taskleiste. ☐

### Darstellung

#### Optik-Politur und Benachrichtigungs-Zentrum (`fix/visual-polish-notifications`) – nur auf echter Hardware prüfbar

OP-V1. _Windows-Portable in verschiedenen Fenstergrößen:_ Fenster ziehen, Halbbild-Snapping links/rechts, maximiert auf 1440p/Ultrawide. Übersicht, ToDos, Merkliste, Finanzen, Kalender: gleich hohe Karten, keine abgeschnittenen Wörter, kein waagerechter Scrollbalken; Schrift auf großem Monitor spürbar größer als auf dem Laptop. ☐

### Übersicht

#### Übersicht als Home-Screen

HS-H4. _Status-Widgets (Windows):_ Datenträger zeigt Füllstände, Systeminfo CPU/RAM/Akku, Tresor nur gesperrt/entsperrt (nie Einträge). ☐

### Cockpit

#### Cockpit-Modus (`feat/cockpit-mode`) – Gerät nötig

CP-C3. _Windows F11:_ im Cockpit F11 → echtes Vollbild des Fensters, noch einmal F11 oder „Cockpit beenden“ → zurück; F11 außerhalb des Cockpits bleibt ohne Wirkung. ☐

### Einstellungen

#### Einstellungen neu (Kategorien, Über Nemo) – nur auf echter Hardware prüfbar

EN-E1. _Windows-Portable:_ Einstellungen durchklicken – Kategorien-Leiste links, Auswahl markiert, Zurück/Vor des Fensters, Suche („Hotkey“ springt zu Schnellerfassung und hebt die Zeile hervor). ☐

#### Einstellungen v2 (Paket 1) – nur von Hand prüfbar

- **SO3 Breites Fenster (2560 px):** Inhaltsverzeichnis rechts folgt dem Scrollen, kein Zittern; Lesbarkeit der Karten hell und dunkel. ☐

#### Einstellungen in Identität v3 (Paket 1) – nur von Hand prüfbar

- **SV3 Breite Fenster (2560 px) und 1280 × 720:** Kopf und Liste zentriert, nichts läuft über; hell und dunkel. ☐

#### Hauptthread frei halten (UI-Audit 4.0, Paket 0a-4 Teil 2) – nur auf Windows prüfbar

Dev-Preview-Exe. Bei jedem Punkt gilt zusätzlich: das Fenster lässt sich währenddessen verschieben, in der Titelleiste steht nie „Keine Rückmeldung“, und ein Wechsel zu einem anderen Modul zeigt dessen Inhalt statt „…“. Hintergrund und Einordnung je Command: [perf/MAIN-THREAD-COMMANDS-2026-11.md](perf/MAIN-THREAD-COMMANDS-2026-11.md).
- **MT-H6 Einstellungen und „Über Nemo“:** „Mit Windows starten“ ein und aus: der Schalter bleibt nach erneutem Öffnen der Seite auf dem gewählten Stand (Task-Manager → Autostart zeigt Nemo bzw. nicht). „Datenordner öffnen“ öffnet den Explorer. Im Systemmonitor „Task-Manager öffnen“ startet ihn. ☐

### Modul-Bibliothek

#### Bibliotheken in Identität v3 (Paket 2) – nur von Hand prüfbar

- **LB4 Breite Fenster (2560 px):** Karten füllen die Zeile, nichts läuft über; Werkzeug-Bibliothek ebenso, hell und dunkel. ☐

### Schnellerfassung und Befehlspalette

#### Schnellerfassung: Android-Kurzbefehle, Kachel, Tray „Heute“ – nur auf echter Hardware prüfbar

TR-T1. _Windows, Tray:_ ein Termin heute 15:00 und ein überfälliges ToDo anlegen, Rechtsklick auf das Tray-Symbol: oben „Heute“ mit „Überfälliges ToDo“ und „15:00 · Termin“, darunter „Jetzt dran anfangen“ und „Timer 25 Minuten“, dann Erfassen/App öffnen/Beenden wie bisher. Keine Beträge, kein Tresor, keine Notizinhalte. ☐
TR-T2. _Klick:_ Klick auf die Termin-Zeile holt das Hauptfenster nach vorn und öffnet den Kalender an dem Tag; „Timer 25 Minuten“ startet den Timer und zeigt ihn; „Jetzt dran anfangen“ öffnet den Fokus für das ToDo. ☐
TR-T3. _Aktualisieren und Abschalten:_ ToDo erledigen → nach dem nächsten Öffnen des Tray-Menüs ist die Zeile weg (sofort, spätestens nach 5 Minuten). Einstellungen → Schnellerfassung → „Heute im Tray-Menü zeigen“ aus: Block verschwindet, Menü wie vorher. Leerer Tag: kein Block. ☐

#### Hauptthread frei halten (UI-Audit 4.0, Paket 0a-4 Teil 2) – nur auf Windows prüfbar

Dev-Preview-Exe. Bei jedem Punkt gilt zusätzlich: das Fenster lässt sich währenddessen verschieben, in der Titelleiste steht nie „Keine Rückmeldung“, und ein Wechsel zu einem anderen Modul zeigt dessen Inhalt statt „…“. Hintergrund und Einordnung je Command: [perf/MAIN-THREAD-COMMANDS-2026-11.md](perf/MAIN-THREAD-COMMANDS-2026-11.md).
- **MT-H5 Schnellerfassung mit Zwischenablage:** Einstellung „Zwischenablage beim Öffnen einfügen“ ein, in einem anderen Programm Text kopieren, Schnellerfassung per Tastenkürzel öffnen: der Text steht sofort im Feld. Noch einmal mit einer großen kopierten Excel-Tabelle (Excel offen lassen): das Fenster öffnet sich ohne Hänger. ☐

### Spracheingabe

#### Spracheingabe (nur von Hand prüfbar)

SE-V1. _Windows-App (WebView2):_ Einstellungen → Schnellerfassung → Spracheingabe einschalten (Hinweis lesen), F4 halten und sprechen: erscheint der Text im Suchfeld (Strg+K)? Wenn nicht: kommt ein ruhiger Satz statt eines Fehlers, und ist das Ergebnis in [features/voice.md](features/voice.md) nachgetragen? ☐
SE-V2. _Systemweite Taste (Windows):_ Taste setzen, Nemo im Hintergrund: ein Druck holt das Fenster und startet die Aufnahme, der nächste beendet sie; Esc bricht ab, nichts geht verloren. ☐

### Tastenkürzel

#### Tastenkürzel (Kürzelkarte)

TK-K1. _Windows-App:_ `T` dann `T` öffnet den Timer; F8 ebenso, auch mit dem Cursor in einem Textfeld (nichts wird getippt). F10 öffnet nur die Einstellungen, kein Fenstermenü. ☐

### Erinnerungen und Benachrichtigungen

#### Stumm (Pause für Erinnerungen)

ST-M4. _Desktop:_ Karte in der App erscheint wie sonst; der Ton der Windows-Benachrichtigung bleibt (bekannte Grenze). ☐

### Zock-Modus

#### Zock-Modus (Windows, Vollbild-Spiel) – nur von Hand prüfbar

Vorbereitung: Portable-EXE aus dem Branch/Artefakt; Einstellungen → Benachrichtigungen: Erlaubnis erteilt, „Zock-Modus“ auf „Automatisch“; Lautstärke ca. 50 %. Hintergrund: [features/game-mode.md](features/game-mode.md).
- **Z1 Kein Windows-Ton:** Zock-Modus „Aus“, Fenster im Hintergrund, „Testbenachrichtigung senden“: kommt der Toast ohne Windows-Benachrichtigungston? (Die App setzt keinen Ton; wenn doch einer kommt: melden.) ☐
- **Z2 Ton bei Fenster im Tray:** „Ton testen“ mit sichtbarem Fenster (alle drei Klänge, Lautstärke 0 = still). Dann Schließen-in-Tray an, Fenster schließen, Erinnerung für in 2 Minuten anlegen vorher, Zock-Modus „Immer“: kommt der Toast ohne Windows-Ton, und danach der App-Ton? Notieren: Verzögerung in Sekunden. ☐
- **Z3 Vollbild-Spiel:** ein Spiel im Vollbild (Direct3D) starten, Zock-Modus „Automatisch“, Erinnerung für in 2 Minuten: nur der leichte App-Ton, kein Windows-Ton, der Toast wartet im Info-Center oder erscheint (Windows' Spiel-Ruhe kann ihn zurückhalten, das ist ok). Spiel beenden, nächste Erinnerung: normaler Weg, kein App-Ton. ☐
- **Z4 Randfälle:** Browser-Video im Vollbild (F11/YouTube) zählt als „beschäftigt“ und löst ebenfalls den leisen Weg aus (gewollt); „Stumm“ an: weder Ton noch Windows-Ton; Zock-Modus „Aus“: nie ein App-Ton. Ein Spiel im Fenstermodus wird nicht erkannt → „Immer“ benutzen. ☐

### Fokus

#### Fokus- und Aufmerksamkeitshilfen (Paket 1) – nur mit echtem Gerät und echtem Alltag prüfbar

FO-F2. _Fokusmodus am PC (Windows):_ Esc verlässt den Bildschirm, die Runde läuft weiter; „Fertig“ und „Runde beenden“; Ton am Ende (Einstellung „Sanfter Ton am Ende“) ist leise genug. ☐

### KI

#### KI-Eintragen per Leiste (PR A, nur von Hand prüfbar)

- **KL-K5 Lokales Modell (Windows, Build mit `local-llm`):** Einstellungen → KI → Lokales Modell: Modell wählen, „Herunterladen …“ zeigt Größe, Quelle, Prüfsumme; nach dem Download „Laden“, „Testen“ erkennt den Beispielsatz. GTX 1070: „Grafikkarte nutzen“ an, Vulkan wird erkannt, Zeit pro Satz notieren; aus: Ryzen 5 7600X (CPU). Kein Netz: Sätze gehen weiter lokal. ☐
- **KL-K6 Chat:** Modul Chat aktivieren; mit lokalem Modell (Windows) und mit einem Anbieter je eine Frage und eine Rückfrage stellen (Verlauf wird berücksichtigt). Im Zahnrad Module für Daten wählen, „Daten anhängen“ ankreuzen: die Vorschau zeigt genau den mitgeschickten Text, ohne Auswahl geht nichts mit. Antwort kopieren, neu erzeugen, Frage ändern, Export als Markdown öffnen, Chat löschen. Android „Leicht“ (kleines Modell) folgt mit der Android-Entscheidung. ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM5 Lokales Modell in der Dev-Preview:** erste Dev-Preview beobachten (kalter Cache, ~20 min einmalig); Lokales Modell → Download → Testfrage von Hand. (PR #504; vgl. KL-K5) ☐

### Lokale API (KI-Zugriff)

#### KI-Zugriff / lokale Import-API (Phase 2)

Nur in der Windows-App prüfbar (der Server selbst ist per Rust-Tests geprüft, die Oberfläche per E2E mit Ersatz-Server):
KZ-K1. _Aktivieren:_ Einstellungen → KI-Zugriff → Schalter an → Status „Läuft auf http://127.0.0.1:47631“. Windows-Firewall fragt **nicht** (nur Loopback). ☐
KZ-K2. _Zugang:_ „Zugang anlegen“, Name, ToDos Lesen + Schreiben → Schlüssel erscheint einmal, kopieren. PowerShell: `Invoke-RestMethod -Uri http://127.0.0.1:47631/v1/modules -Headers @{Authorization="Bearer <Schlüssel>"}` listet nur ToDos. ☐
KZ-K3. _Schutz:_ dieselbe Anfrage ohne/mit falschem Schlüssel → 401; im Browser `http://127.0.0.1:47631/v1/modules` öffnen → Fehler (kein Zugriff). Von einem anderen Gerät im WLAN ist der Port nicht erreichbar. ☐
KZ-K4. _Probelauf:_ `POST /v1/todos/import?dryRun=true` mit einem Eintrag → Ergebnis je Eintrag, in der App erscheint nichts. ☐
KZ-K5. _Widerrufen / Port belegt:_ Zugang widerrufen → nächste Anfrage 401. Port auf einen belegten Wert stellen → verständliche Meldung. ☐

### Heimnetz-Sync

#### Sync im Heimnetz: Hub im PC (Paket 2b-2) – nur auf Windows prüfbar

- **HN-L1 Firewall:** Hub starten, Kopplungsfenster öffnen: Windows fragt einmal nach Freigabe für private Netze; „Zulassen“ merken, „Abbrechen“ → `lan_hub_status` meldet weiter `listening`, ein Handy findet den Hub nicht (Hinweis „Windows blockiert“ in der Oberfläche folgt mit Paket 4).
- **HN-L2 Netzwerkart:** WLAN auf „Öffentlich“ stellen: `lan_hub_status` zeigt `off`, `blocked: true`, kein Port lauscht (`netstat -ano`); zurück auf „Privat“: lauscht wieder, ohne Neustart (≤ 2 s).
- **HN-L3 Netzwechsel:** erste Kopplung im Heim-WLAN, dann Hotspot des Handys: Hub lauscht nicht mehr; zurück ins Heim-WLAN: lauscht wieder. VPN/WSL/Docker-Adapter erscheinen nie in `netstat`.
- **HN-L4 mDNS:** `dns-sd -B _nemo-sync._tcp` (oder Handy-Scanner) zeigt einen zufälligen Namen `nemo-xxxxxxxx`, TXT nur `v=1` und `h=…`; nach Neustart anderer Name; nur auf der Heim-Schnittstelle.
- **HN-L5 Schlüsselspeicher:** In der Anmeldeinformationsverwaltung stehen Einträge `io.github.sgnemo.taschenmesser.lan-sync` (Dev-Preview: `….dev.lan-sync`); Eintrag löschen → nächster Start legt neue Schlüssel an, alle Geräte müssen neu koppeln.

#### Sync im Heimnetz: PC und Handy koppeln (Pakete 3a/3b) – nur mit Windows-PC und Android-Handy prüfbar

- **HN-L16 Zweiter PC per Webcam koppeln:** Hub-PC: „Gerät koppeln“ → QR. Zweiter Windows-PC mit Webcam: Einstellungen → Synchronisation → „Mit einem anderen PC koppeln“ → WebView2 fragt nach der Kamera („Zulassen“) → Webcam auf den QR am Hub-PC → Code auf beiden gleich → am Hub-PC „Koppeln“: der zweite PC zeigt „Abgeglichen“ / „Mit deinem PC gekoppelt“, „Gerät koppeln“ ist dort weg; ein ToDo wandert hin und zurück. Ohne Webcam (oder abgesteckt): ruhige Zeile „Ohne Kamera geht das Koppeln mit einem anderen PC noch nicht.“ mit Verweis auf „Eigener Server (erweitert)“, kein Rot. In der Anmeldeinformationsverwaltung des zweiten PCs stehen `lan-client:static-key` und `lan-client:hub` unter `io.github.sgnemo.taschenmesser`. Hub-PC beenden → zweiter PC „Jetzt abgleichen“: „Gleicht ab, sobald dein PC im selben WLAN erreichbar ist“. ☐

### Fernsteuerung

#### Fernsteuerung, PC-Seite (`feat/remote-host-media`, `feat/remote-host-settings`) – nur auf echtem Windows prüfbar

FS-R1, FS-R2, FS-R8, FS-R10 und FS-R11 gehen sofort (Einstellungen → Allgemein → „In Arbeit anzeigen“ an, dann Einstellungen → Verbindungen → Fernsteuerung). FS-R3–FS-R7 brauchen Paket 2 (Handy-Modul), FS-R9 Paket 3.
FS-R2. _Tray nach Neuaufbau, Sprache:_ App-Sprache wechseln und einen Termin für heute anlegen (Tray-Menü wird neu gebaut): Menü und Tooltip bleiben vollständig, das Symbol flackert nicht; App auf Englisch bei deutschem Windows: der Bestätigungs-Dialog (FS-R8) ist englisch. ☐
FS-R10. _Abschnitt ohne Hub:_ Heimnetz-Abgleich aus: der Abschnitt zeigt zwei kurze Sätze und den Link „Zum Abgleich im Heimnetz“, keinen Schalter. Mit Hub, Hauptschalter aus: die Auswahl je Gerät ist grau, ein Satz erklärt warum. ☐

### Kalender

#### Modul-Rahmen, Wetter und Musik (Branch `feat/module-shell-identity`) – nur auf Geräten prüfbar

- **PK4 Ziehen im Zeitraster (≥ 1400 px):** Wochenansicht: Termin ziehen verschiebt (auch auf einen anderen Tag), unteren Rand ziehen ändert die Länge, über leere Fläche ziehen öffnet „Neuer Termin“ mit Beginn/Ende; „Rückgängig“ stellt wieder her; mit Tastatur `Alt+↓` (15 min) und `Alt+Umschalt+↓`; eine Serie lässt sich nicht ziehen (Hinweis). ☐

### Uhr

#### Uhr (Paket 1, #615) – nur von Hand prüfbar

Vorbereitung: Einstellungen → Darstellung → „In Arbeit anzeigen“, Modul-Bibliothek → „Uhr“ einschalten, zwei Orte eintragen. Hintergrund: [features/clock.md](features/clock.md).
- **UH-U1 Logo-Uhr in der Windows-App:** „Uhrzeit neben dem Logo“ an; Klick auf die Uhrzeit öffnet die Uhr-Seite; Modul aus → die Uhrzeit ist kein Link mehr (kein Hand-Cursor, nichts passiert). Eingeklappte Seitenleiste: „14“/„07“ öffnet ebenfalls die Seite. ☐

### Tresor

#### Schritt 11b – OS-Keystore, Biometrie, Bildschirmschutz

KS-1. _API-Schlüssel im Credential Manager:_ Einstellungen → KI-Assistent → Anbieter hinzufügen → Schlüssel eintragen → Speichern → „Verbindung testen". Dann Windows-Suche „Anmeldeinformationsverwaltung" → „Windows-Anmeldeinformationen": Es gibt einen Eintrag `ai-key:<anbieter>` (Adresse `io.github.sgnemo.taschenmesser`). ☐
KS-2. _Migration:_ Ein Schlüssel, der schon mit einer älteren Version gespeichert war, funktioniert nach dem Update weiter (nach der ersten Nutzung erscheint er im Credential Manager). ☐
KS-3. _Windows Hello:_ Accounts → Tresor anlegen/entsperren → „Import, Export & Sicherheit" → „Biometrisches Entsperren aktivieren" (Master-Passwort eingeben) → Windows-Hello-Fenster erscheint und bestätigt. Danach „Sperren" → beim Sperrbildschirm fragt Windows Hello automatisch → Tresor offen. ☐
KS-4. _Abbruch:_ Beim Hello-Fenster „Abbrechen" → Tresor bleibt gesperrt, Passwortfeld und Button „Mit Biometrie entsperren" sind da. ☐
KS-5. _Deaktivieren:_ „Biometrisches Entsperren deaktivieren" → beim nächsten Sperren kein Hello-Fenster mehr; der Eintrag `bio:vault-dek:…` ist aus dem Credential Manager verschwunden. ☐
KS-6. _Ohne Hello (kein PIN/Gesicht eingerichtet):_ Abschnitt zeigt „Nicht verfügbar…", nichts bricht. ☐

#### Launch-Review: Handtests (aus STATUS verschoben, 2026-11-10; Bericht [security/LAUNCH-REVIEW-2026-10-06.md](security/LAUNCH-REVIEW-2026-10-06.md))

LR1. _X1 Pipe auf Windows mit zweitem Nutzer_ (Fix: SQOS-Flag in `ipc.rs`). ☐
LR2. _V1 Credential-Manager nach „Alle Daten löschen“_: das biometrische Siegel des Tresors ist danach weg. ☐

### Browser-Erweiterung

#### Browser-Erweiterung (Brave) und Tresor-Brücke – nur von Hand prüfbar (Windows)

Vorbereitung: Portable-EXE aus dem Branch/Artefakt, `nemo-extension-….zip` entpacken, Tresor mit Beispieldaten. Hintergrund: [security/VAULT-EXTENSION.md](security/VAULT-EXTENSION.md).
X1. _Laden:_ `brave://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“. Die ID lautet `olgcnfjmihlmpgjepkfbdjcpenckemaj`, keine Fehler im Service-Worker-Log. ☐
X2. _Verbindung bestätigen:_ Nemo → Tresor → Browser-Erweiterung → an (Registry: `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\io.github.sgnemo.taschenmesser.vault` zeigt auf die JSON im `data`-Ordner bzw. App-Daten; auch Chrome/Edge/Chromium-Schlüssel). Popup zeigt einen Code, der Dialog in Nemo denselben; „Verbinden“ → Popup „Verbunden“. ☐
X3. _Host als GUI-EXE:_ Der Host-Start (Release-EXE ohne Konsole) liefert Antworten (Popup „Verbunden“, nicht „nicht gefunden“); im Task-Manager erscheint kurz ein zweiter Prozess ohne Fenster, nach Schließen von Brave weg. ☐
X4. _Registrierung auf einer Test-Site:_ Seite mit Registrierungsformular, E-Mail eintragen, ins Passwortfeld klicken → Vorschlag; „Verwenden“ füllt beide Passwortfelder; Speicherkarte zeigt die E-Mail; „Im Tresor speichern“ → in Nemo erscheint der Eintrag (URL = Origin der Seite). ☐
X6. _Login-Autofill:_ Login-Seite derselben Domain: Schlüssel im Feld → Eintrag → Benutzername und Passwort gefüllt; vorher nichts. TOTP-Eintrag: Code-Feld bzw. Popup „Code kopieren“; Zwischenablage nach 30 s leer (und bei zwischenzeitlich kopiertem anderen Text unverändert). ☐
X7. _Phishing-Test:_ Ähnliche Domain (z. B. `shop-example.test` statt `shop.example.test`, `http://` statt `https://`, anderer Port) bekommt keinen Eintrag und kein Passwort. ☐
X8. _Gesperrt / nicht gestartet:_ Tresor sperren → Popup „gesperrt“, Speichern zeigt Hinweis, Daten bleiben im Tab; entsperren → „Erneut versuchen“ speichert. App beenden → „Nemo wurde nicht gefunden“. Auto-Sperre beendet die Sitzung sofort. ☐
X9. _Portable verschoben:_ Ordner mit der EXE verschieben, App starten → Dialog zeigt den Pfad als aktuell (oder „Neu eintragen“), Erweiterung verbindet wieder ohne erneutes Bestätigen. ☐
X10. _Brave Shields:_ Shields hoch/aus auf einer Test-Site: Overlay und Schlüssel erscheinen in beiden Fällen; Fingerprinting-Schutz „streng“ stört das Ausfüllen nicht. ☐
X11. _Pipe nur für dich:_ Mit einem zweiten Windows-Benutzer ist die Pipe `\\.\pipe\nemo-vault-<Benutzer>` nicht öffenbar; ein zweites Nemo (Dev-Preview neben Release) meldet „belegt“ statt zu verdrängen. ☐
X12. _Tresor-Suche-Hotkey:_ Einstellungen → Schnellerfassung → „Tastenkürzel Tresor-Suche“ setzen; bei entsperrtem Tresor öffnet es die Suche, bei gesperrtem nur das Fenster mit dem Sperrbildschirm. ☐
X13. _Tasten im Eintrag:_ U/P/T/O kopieren Benutzername/Passwort/Code bzw. öffnen die Website; in Eingabefeldern passiert nichts. ☐
X14. _Eigene Seiten:_ Auf der Nemo-PWA im Browser schlägt die Erweiterung nichts vor und bietet das Master-Passwort nie zum Speichern an. ☐

#### Hauptthread frei halten (UI-Audit 4.0, Paket 0a-4 Teil 2) – nur auf Windows prüfbar

Dev-Preview-Exe. Bei jedem Punkt gilt zusätzlich: das Fenster lässt sich währenddessen verschieben, in der Titelleiste steht nie „Keine Rückmeldung“, und ein Wechsel zu einem anderen Modul zeigt dessen Inhalt statt „…“. Hintergrund und Einordnung je Command: [perf/MAIN-THREAD-COMMANDS-2026-11.md](perf/MAIN-THREAD-COMMANDS-2026-11.md).
- **MT-H4 Browser-Erweiterung:** Konten → Browser-Erweiterung: „Verbinden“ (Registrierung) zeigt die Browser als eingetragen, der Status bleibt nach einem Seitenwechsel richtig; Brücke aus und wieder ein, danach füllt die Erweiterung auf einer Testseite weiter aus (Klick → Zugangsdaten erscheinen). „Trennen“ entfernt die Einträge wieder. ☐

### Notizen

#### Notizen: Editor (`feat/notes-editor`) – nur auf echter Hardware prüfbar

- **NE-E2 Windows-App:** Strg+B/I, Tab/Shift+Tab in Listen, Strg+Z/Y; Vollbild; Bild aus der Zwischenablage einfügen und nach Neustart noch da. ☐
- **NE-E6 Windows-App:** Strg+N öffnet eine neue Seite (Alt+N im Browser), Alt+Z den Schmierzettel; Tabs mit vielen Seiten scrollen seitlich. ☐

### Browser

#### Browser (Desktop, nur mit echtem Fenster prüfbar)

BR-B1. _Tab sitzt im Nemo-Fenster:_ Modul „Browser“ in der Bibliothek einschalten, `/browser` öffnen, `example.org` eintippen: die Seite erscheint genau im grauen Rahmen, Fenster vergrößern/verkleinern: sie folgt. Menü („Mehr“) öffnen: die Seite verschwindet, das Menü ist lesbar; schließen: sie ist wieder da. ☐
BR-B2. _Isolation:_ auf einer beliebigen Seite die Entwicklerkonsole (F12 ist aus; Rechtsklick → Untersuchen nur im Debug-Build) – `window.__TAURI_INTERNALS__` ist nicht definiert, `fetch('http://ipc.localhost/…')` bleibt ohne Antwort. ☐
BR-B3. _HTTP-Warnung:_ `http://neverssl.com` → Warnseite mit „Zurück“/„Trotzdem öffnen“; Einstellung „Vor unverschlüsselten Seiten warnen“ aus: öffnet direkt. ☐
BR-B4. _Pop-ups, Downloads, Rechte:_ eine Seite mit `window.open` – kein Fenster, Hinweis „Ein Pop-up wurde blockiert“; ein Download-Link – nichts wird gespeichert, Hinweis mit „Im Systembrowser öffnen“; Kamera/Mikrofon/Standort-Abfrage einer Testseite wird ohne Rückfrage abgelehnt (Windows/WebView2; Linux/macOS: nicht gebaut). ☐
BR-B5. _Privat:_ privater Tab, auf einer Seite anmelden/Cookie setzen, Tab schließen, neuen privaten Tab: nicht mehr angemeldet; Verlauf bleibt leer. Normaler Tab: Anmeldung bleibt nach App-Neustart; „Browserdaten löschen“ entfernt sie. ☐
BR-B6. _Blocker (Windows):_ eine Seite mit vielen Anzeigen: Zähler im Menü „Blocker“ steigt, Fremdserver-Liste füllt sich, „Blocken“ legt eine eigene Regel an, nach „Neu laden“ fehlt dieser Server. Pausieren auf der Seite lädt alles wieder. ☐
BR-B7. _Suchen auf der Seite:_ Strg+F zeigt die Suchleiste von WebView2 (nicht von Nemo gebaut). ☐
BR-B8. _Merkliste/Notiz:_ „In Merkliste speichern“ (Modul an) legt den Eintrag an, „Als Notiz speichern“ öffnet eine neue Notiz mit Titel und Adresse. ☐

#### Wissen, Medien, Dienste (Branch `feat/knowledge-media-depth`) – nur auf Geräten prüfbar

- **W3 Browser-Lesemodus (Windows):** auf einer echten https-Artikelseite Menü → Lesemodus; private Tabs und http-Seiten bieten ihn nicht an; „Vorschaubilder für offene Tabs“ einschalten und die Tab-Übersicht öffnen. ☐

#### Identität v3: Wissen (Paket 2) – nur von Hand prüfbar

- **WK5 Browser-Pille:** Browser (Windows-App): die Pille zeigt nur den Host der offenen Seite; der aktive Tab ist als gefüllter Chip erkennbar, auch in „Ruhig“.

#### Hauptthread frei halten (UI-Audit 4.0, Paket 0a-4 Teil 2) – nur auf Windows prüfbar

Dev-Preview-Exe. Bei jedem Punkt gilt zusätzlich: das Fenster lässt sich währenddessen verschieben, in der Titelleiste steht nie „Keine Rückmeldung“, und ein Wechsel zu einem anderen Modul zeigt dessen Inhalt statt „…“. Hintergrund und Einordnung je Command: [perf/MAIN-THREAD-COMMANDS-2026-11.md](perf/MAIN-THREAD-COMMANDS-2026-11.md).
- **MT-H7 Browser-Tabs (bleiben auf dem Hauptthread):** in einem Tab vier Seiten nacheinander öffnen, dann dreimal sehr schnell „Zurück“: der Tab steht auf der ersten Seite, „Vor“ dreimal: auf der vierten. Neu laden und Zoom (Strg +/−) reagieren sofort. Hängt das Fenster genau hier, bitte mit Seite und Uhrzeit notieren – das wäre ein Fall für WebView2 selbst. ☐

### Downloads und Torrent

#### Datenträger, Systeminfo (diese Runde) – nur auf echtem Windows prüfbar

Alles mit einem **Testordner** mit erfundenen Dateien, nie mit echten Nutzerdaten:
ZO-D13. _Zuordnung (Windows, aus):_ Downloads → BitTorrent → „Bei Windows eintragen“. Windows-Einstellungen → Standard-Apps zeigt Nemo für „magnet“ und „.torrent“; ein bestehender Standard bleibt unverändert, bis du Nemo wählst. „Eintrag entfernen“ → Nemo verschwindet aus der Liste (Registry: `HKCU\Software\Classes\Nemo.Magnet`, `Nemo.Torrent`, `HKCU\Software\Nemo`, Wert unter `RegisteredApplications` weg). Beim Dev-Preview heißen die Einträge `NemoDev…`. ☐
ZO-D14. _Magnet-Link öffnen:_ Nemo als Standard für magnet wählen, in einem Browser einen (Test-)Magnet-Link anklicken: Nemo kommt nach vorn (auch bei schon laufender App), der Dialog „Torrent hinzufügen“ ist vorbefüllt, nichts startet vor „Herunterladen“. Bei ausgeschaltetem Torrent-Teil: Hinweis „Ein Magnet-Link wartet“, nach dem Einschalten (mit Hinweis) öffnet sich der Dialog. Downloads-Modul aus: Angebot zum Einschalten. ☐
ZO-D15. _.torrent-Datei öffnen:_ Doppelklick auf eine Test-.torrent (und eine fehlende/über 10 MB große) → Dialog zeigt die erste Datei, die zweite wird stumm ignoriert; mit „Öffnen mit“ gestartet funktioniert dasselbe bei kaltem Start. ☐

#### Downloads (Desktop, nur mit echtem Netz und Fenster prüfbar)

DL-D1. _Download und Prüfsumme:_ Modul „Downloads“ einschalten, eine kleine Datei von einer Seite mit veröffentlichter SHA-256 hinzufügen (Prüfsumme einfügen): läuft, wird „Fertig“, „Stimmt überein“. Eine falsche Prüfsumme: „Fehlgeschlagen – Prüfsumme stimmt nicht, Datei wurde gelöscht“. ☐
DL-D2. _Pausieren, Fortsetzen, Neustart:_ großen Download starten, pausieren, Nemo beenden, neu starten: Eintrag steht „Pausiert“ mit dem alten Stand, nichts läuft von selbst; „Fortsetzen“ macht dort weiter (kein neuer Anfang). Auch beim Beenden mitten im Download (Task-Manager): nach dem Start „Pausiert“. ☐
DL-D3. _Limit:_ Einstellung „Tempolimit“ auf 200 KB/s: die Anzeige bleibt darunter; auf 0: wieder volle Geschwindigkeit. ☐
DL-D4. _Ordner und Dateien:_ Ordner wählen (Dialog), gleichnamige Datei vorhanden: neue heißt „name (1).ext“, die alte bleibt. „Im Ordner zeigen“ markiert die Datei im Explorer, öffnet sie nicht. Eine ausführbare Datei wird nie gestartet. ☐
DL-D5. _Aus dem Browser:_ im Browser auf einen Download-Link klicken: nichts wird gespeichert, Hinweis mit „Im Download-Manager öffnen“; Modul aus: „Aktivieren“-Hinweis. Der Dialog erscheint vorausgefüllt und lädt erst nach „Herunterladen“. Hinweis: ohne die Cookies des Browsers (Seiten mit Anmeldung liefern ggf. nur eine Fehlerseite). ☐
DL-D6. _Entfernen:_ „Aus der Liste entfernen“ lässt die Datei liegen, „Mit Datei löschen“ fragt nach und löscht Datei und `.part`. ☐

#### Torrent (Desktop, nur mit echtem Netz prüfbar; nur legale Inhalte, z. B. eine Linux-Distribution von deren Download-Seite)

TO-D7. _Aus und Hinweis:_ Downloads-Seite, „BitTorrent ist aus“; „Torrent-Teil einschalten“ zeigt den Hinweis (legale Inhalte, hochladen beim Herunterladen, Abmahnung); erst nach „Verstanden“ startet die Engine. Aus- und wieder Einschalten: kein zweiter Hinweis. ☐
TO-D8. _Magnet und Datei:_ Magnet-Link einer Linux-Distribution einfügen → „Dateien ansehen“ (kann etwas dauern) → Dateien wählen, Ordner wählen → lädt; dasselbe mit der `.torrent`-Datei der Distribution („.torrent-Datei öffnen“). Mehrere Dateien landen in `Ordner/<Name>/`. ☐
TO-D9. _Anzeige und Limits:_ Zustand, Fortschritt, Verbindungen, Laden/Teilen pro Sekunde, Verhältnis; Einstellungen → Torrent-Limits setzen: die Anzeige bleibt darunter. ☐
TO-D10. _Teilen und Neustart:_ nach dem Download „Teilt“; Verhältnis 1,0 gesetzt → nach Erreichen „Fertig, Teilen beendet“. Nemo beenden und neu starten (auch hart per Task-Manager): alle Torrents stehen „Pausiert“, nichts lädt oder teilt von selbst. ☐
TO-D11. _Entfernen:_ „Aus der Liste entfernen“ lässt die Dateien, „Mit Dateien löschen“ fragt nach und löscht sie. ☐
TO-D12. _IP und Ausschalten:_ „IP-Adresse anzeigen“ fragt erst auf den Klick (api.ipify.org). „Torrent-Teil ausschalten“ beendet die Engine; kein Netzverkehr der Torrents mehr (Ressourcenmonitor). Rechner ohne IPv6 (selten): „konnte nicht starten“. ☐

#### Wissen, Medien, Dienste (Branch `feat/knowledge-media-depth`) – nur auf Geräten prüfbar

- **W4 Downloads (Windows):** laufende Downloads: Band und Prozent stimmen, Restzeit in der Zeile, „Fertig“/„Probleme“-Filter, „Zielordner zeigen“ öffnet den Explorer am letzten Download. ☐

#### Identität v3: Medien und Dienste (Paket 3) – nur von Hand prüfbar

- **MD4 Downloads:** leere Ansicht zeigt den Pfeil in der Ablage; ein laufender Download zeigt Zahl und Band im Kopf.

#### Hauptthread frei halten (UI-Audit 4.0, Paket 0a-4 Teil 2) – nur auf Windows prüfbar

Dev-Preview-Exe. Bei jedem Punkt gilt zusätzlich: das Fenster lässt sich währenddessen verschieben, in der Titelleiste steht nie „Keine Rückmeldung“, und ein Wechsel zu einem anderen Modul zeigt dessen Inhalt statt „…“. Hintergrund und Einordnung je Command: [perf/MAIN-THREAD-COMMANDS-2026-11.md](perf/MAIN-THREAD-COMMANDS-2026-11.md).
- **MT-H3 Downloads:** einen großen Download starten, schnell hintereinander Pause → Fortsetzen → Pause klicken: der Eintrag steht am Ende auf „Pausiert“ und zeigt nach „Fortsetzen“ wieder Tempo; Limit setzen und wieder auf 0; „Im Ordner zeigen“; „Aus der Liste entfernen“. Nemo beenden und neu starten: die Liste ist dieselbe wie vorher (kein leerer Stand, kein doppelter Eintrag). Wenn möglich einmal mit einem USB-Stick oder Netzlaufwerk als Zielordner. ☐

### Dieser PC

#### Datenträger, Systeminfo (diese Runde) – nur auf echtem Windows prüfbar

Alles mit einem **Testordner** mit erfundenen Dateien, nie mit echten Nutzerdaten:
DT-D1. _Scan echtes Laufwerk:_ Datenträger → C: scannen. Fortschritt läuft, UI bleibt flüssig, Summe stimmt grob mit dem Explorer („Größe auf Datenträger“ des Ordners) überein. Ergebnis mit „Nicht gelesen“-Liste (z. B. `System Volume Information`). ☐
DT-D2. _Treemap navigieren:_ Klick in einen Ordner, Brotkrumen zurück, Umschalt+Klick wählt nur aus, Pfeiltasten/Eingabe/Rücktaste, Tooltip, Legende, Farbe nach Tiefe, Filter „Älter als“, „Dateityp“. ☐
DT-D3. _Laufwerksarten:_ USB-Stick und Netzlaufwerk erscheinen mit richtigem Typ; SSD/HDD-Angabe stimmt (kann „Festplatte“ ohne Angabe sein). ☐
DT-D4. _Cloud-Platzhalter:_ Ein OneDrive-Ordner mit „Nur online“-Dateien wird gescannt, ohne dass etwas heruntergeladen wird; Hinweis „liegen nur online“ erscheint. ☐
DT-D5. _Verknüpfungen:_ Ein Ordner mit Junction/Symlink auf einen großen Ordner: wird nicht doppelt gezählt (Hinweis „nicht betreten“). ☐
DT-D6. _Papierkorb:_ Testordner (mit ein paar Dateien) → Löschen → „In den Papierkorb“: Ordner liegt im Windows-Papierkorb, lässt sich wiederherstellen; Baum und Summen aktualisieren sich ohne Neu-Scan. ☐
DT-D7. _Papierkorb nicht möglich:_ Einen Testordner auf einem USB-Stick/Netzlaufwerk ohne Papierkorb löschen: Bericht „Papierkorb nicht möglich – nichts gelöscht“, der Ordner ist noch da; erst der bewusste „endgültig“-Schritt löscht. ☐
DT-D8. _Sperrliste:_ Diese Pfade zeigen **keine** Löschen-Schaltfläche, sondern „Geschützt“: Laufwerkswurzel, `C:\Windows` (und darin), `C:\Program Files`, `C:\ProgramData`, `C:\Users`, dein Profilordner, `AppData`, `System Volume Information`, `$Recycle.Bin`, `pagefile.sys`/`hiberfil.sys`, Ordner der Taschenmesser-App und ihrer Daten, Ordner eines laufenden Programms. Mit 8.3-Namen (`dir /x`) und über eine Junction auf `C:\Windows` ebenfalls nicht löschbar. ☐
DT-D9. _Abbruch:_ Scan während der Laufzeit abbrechen (Teilergebnis bleibt nutzbar); Löschen einer großen Testordner-Auswahl mit „Stoppen“ unterbrechen (Rest bleibt unberührt). ☐
DT-D10. _Datei in Benutzung:_ Eine geöffnete Testdatei in einem Testordner: Bericht „Teilweise gelöscht“ mit Grund „Datei in Benutzung“. ☐
DT-D11. _Bestätigungen:_ Große Löschung (> 10 GB oder > 10 000 Dateien, z. B. Testordner mit vielen leeren Dateien) und „endgültig“ fragen ein zweites Mal („Wirklich löschen?“, kein Eintippen mehr; ein schneller Doppelklick bestätigt nicht beide Male); Dokumente/Bilder/Desktop zeigen die Warnung für persönliche Ordner. ☐
DT-D12. _Aufräum-Helfer:_ „Aufräumen“ auf der Startseite listet Temp/Downloads/Browser-Caches (nur vorhandene); „Doppelte Dateien“ findet zwei gleiche Testdateien, ein Exemplar bleibt immer. ☐
DT-D13. _Im Explorer zeigen / Pfad kopieren_ funktionieren (auch bei langen Pfaden). ☐
DT-D15. _Systeminfo:_ Werte stimmen mit dem Task-Manager grob überein (CPU-Name, RAM, Akku am Laptop, Grafikkarte, lokale IP). ☐
DT-D17. _Alt & ungenutzt:_ Spiele-/Steam-Laufwerk scannen: Karte „Alter“ zeigt lange nicht aktualisierte Spiele warm (orange/rot) mit Alter auf der Kachel; „Dateityp“ zeigt Spieldaten statt fast nur „Sonstiges“; „Lange nicht geändert“ (1 Jahr, ab 10 MB) listet jeden alten Ordner einmal mit plausibler Summe; zwei Treffer ankreuzen → „In den Korb“ bzw. „Auswahl löschen …“ öffnet die normale Bestätigung (Papierkorb). ☐
DT-D18. _Live-Scan:_ großes Laufwerk scannen: statt Balken eine Zeile „Scan läuft · bisher …“ mit Pause/Abbrechen; Karte (und Liste) erscheinen sofort und wachsen alle 1–2 s Ordner für Ordner, unfertige Ordner tragen „…“ bzw. „zählt noch“; zum Kalender wechseln und zurück: der Scan läuft weiter, die Laufwerke-Seite zeigt dieselbe Zeile mit „Zum Scan“; Pause friert alles ein; Abbrechen liefert das Teilergebnis; nach dem Ende übernimmt die normale, anklickbare Karte. Der Scan ist nicht spürbar langsamer als vorher. ☐
DT-D19. _Steam zuletzt gespielt:_ Laufwerk mit Steam-Spielen (auch eine zweite Bibliothek, z. B. `D:\SteamLibrary`) scannen: Filter „Spiele (Steam)“ erscheint, listet die installierten Spiele, am längsten nicht gespielte zuerst, mit Datum wie in Steam (Bibliothek → Spiel → „Zuletzt gespielt“); ein nie gestartetes Spiel zeigt „Kein Spieldatum von Steam“; die Details eines Spielordners zeigen „Zuletzt gespielt“. ☐
DT-D20. _Zuletzt benutzt:_ `fsutil behavior query disableLastAccess` zeigt den Zustand. Ist er „aktiviert“ (0 oder 2): Scan von C: → Legende sagt „letzte Benutzung“, Filter heißt „Lange nicht benutzt“ und misst standardmäßig nach „letztem Öffnen“ (Umschalten auf „letzter Änderung“ geht); eine alte Testdatei öffnen, nach ~1 Std. neu scannen → ihre Kachel wird „jung“ gefärbt und sie fällt aus der Liste. Ist er „deaktiviert“ (1 oder 3) oder das Laufwerk FAT/exFAT (USB-Stick): alles bleibt bei „letzte Änderung“ / „Lange nicht geändert“, ohne Umschalter. ☐

#### Übersicht und Dieser PC (Runde `feat/dashboard-variety-system-module`) – nur auf echtem Windows/Android prüfbar

DV-V1. _GPU-Erkennung:_ Dieser PC → System → Grafik: die **RTX 4070** erscheint (mit Speicher ≈ 12 GB und Treiberversion, „aktiv“), **nicht** „Microsoft Basic Render Driver“. Bei mehreren Grafikkarten (z. B. Prozessorgrafik) sind alle gelistet. ☐
DV-V2. _Netzwerk-Adapterliste:_ Pro Adapter Name, Typ (Kabel/WLAN/virtuell), Status, IPv4, **eine** IPv6; „Alle Adressen anzeigen“ blendet die übrigen ein. vEthernet/WSL/Hyper-V gedämpft am Ende. WLAN-Name und Signal erscheinen (unter Windows 11 24H2 ggf. nur mit Standortberechtigung – dann fehlen sie). Auf/Ab-Rate bewegt sich beim Download. „Öffentliche IP abfragen“ fragt erst nach dem Klick. ☐
DV-V3. _Laufwerke:_ Typ (NVMe/SSD/HDD/USB), Modellname, Systemlaufwerk-Markierung, Füllstand-Hinweis in Worten; Temperatur und Zustand erscheinen **oder** „nicht verfügbar – …“ mit Grund (ohne Adminrechte oft nur die Temperatur). „Belegt seit letztem Scan“ nach einem Scan und etwas Schreiben. Lese-/Schreibrate bei Kopieren einer großen Datei. ☐
DV-V4. _Schnellübersicht:_ Größen von Temp/Downloads/Browser-Cache/Papierkorb stimmen grob mit dem Explorer; „mindestens …“ bei sehr großen Ordnern; kein automatisches Löschen. ☐
DV-V5. _Mehr Infos:_ Mainboard, BIOS, RAM-Riegel (Anzahl, Typ, Takt), Windows-Build, letzter Neustart, Bildschirme (Auflösung, Rate), Standard-Lautsprecher/Mikrofon, Prozesse mit CPU %, „Im Task-Manager öffnen“. Akku am Laptop. ☐
DV-V6. _Live-Kacheln:_ CPU/RAM/Netz aktualisieren alle 3 s ohne Flackern; Mini-Verlauf füllt sich; Seite verlassen und zurückkehren beginnt neu. ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM2 „Dieser PC“, Kopf v3.1:** Kopf hell/dunkel; „Ruhig“: Dateitypen grau, Muster + Legende bleiben; Baumkarte nach Alter/Dateityp. (PR #490) ☐
- **GM3 Laufwerke-Seite:** Karten in zwei Spalten, „Details“, Scan aus der Karte, Liste. (PR #483) ☐

#### Hauptthread frei halten (UI-Audit 4.0, Paket 0a-4 Teil 2) – nur auf Windows prüfbar

Dev-Preview-Exe. Bei jedem Punkt gilt zusätzlich: das Fenster lässt sich währenddessen verschieben, in der Titelleiste steht nie „Keine Rückmeldung“, und ein Wechsel zu einem anderen Modul zeigt dessen Inhalt statt „…“. Hintergrund und Einordnung je Command: [perf/MAIN-THREAD-COMMANDS-2026-11.md](perf/MAIN-THREAD-COMMANDS-2026-11.md).
- **MT-H1 Löschen in „Dieser PC“ (wichtigster Punkt):** einen Testordner mit ein paar Wegwerf-Dateien scannen, zwei Dateien markieren, „Löschen“: der Plan erscheint, nach der Bestätigung liegen die Dateien im Papierkorb, die Karte zeigt die neue Größe. Dann „Endgültig löschen“ wählen: Nemo fragt ein **zweites Mal** nach; ohne die zweite Bestätigung wird nichts gelöscht. Ein Ordner aus der Sperrliste (z. B. `C:\Windows`) lässt sich weiterhin nicht zum Löschen vormerken. Zweimal schnell auf „Löschen“ klicken: es läuft nur ein Löschvorgang. ☐
- **MT-H2 „Dieser PC“ blättern:** `C:\` scannen, während und nach dem Scan schnell durch große Ordner klicken (z. B. `Windows` → `WinSxS`), dabei zum Kalender und zurück: die Karte folgt dem zuletzt geklickten Ordner, nichts bleibt hängen. „Im Explorer zeigen“ öffnet den Explorer mit dem markierten Eintrag. „Aufräumen“ zeigt die bekannten Orte (Temp, Browser-Caches). ☐

### Werkzeuge

#### Bildschirmfoto (Windows-App, Handy) – nur von Hand prüfbar

Werkzeug in Einstellungen/Werkzeuge einschalten (standardmäßig aus). Details: [features/screenshot.md](features/screenshot.md).
- **BF-B1 Windows-App, Fenster:** Portable-EXE, Werkzeug „Bildschirmfoto“ → „Bildschirm aufnehmen“: kommt eine Auswahl (Bildschirm/Fenster)? Ein Fenster wählen: Vorschau erscheint. Kommt stattdessen „… gibt es auf diesem Gerät nicht“ (kein Fehler), ist WebView2 ohne Aufnahme – dann Notiz an den Maintainer (Rust-Aufnahme = neue Abhängigkeit). ☐
- **BF-B2 Kopieren:** „Kopieren“, dann in Paint/Mail einfügen (Strg+V): das Bild erscheint. ☐
- **BF-B3 Speichern:** „Speichern“: Windows-Dialog, Datei `bildschirmfoto-JJJJ-MM-TT-HHMM.png` öffnet sich als Bild. ☐
- **BF-B4 Pause:** „Nach 3 Sekunden aufnehmen“ an, Quelle wählen, zum Fenster wechseln: Zähler 3-2-1, dann Bild; „Abbrechen“ beim Zählen: „Nichts aufgenommen.“ ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM4 Shell-Fixes:** Werkzeuge mit Strg+. und Alt+2; Lesehilfe 100 % in der Seitenleiste mit „Zurück“. (PR #481; vgl. TP3) ☐

#### Rechner-Plotter (Branch `feat/calc-plotter`)

PL3. _Tastatur (Windows):_ Graph anklicken oder mit Tab erreichen, Pfeiltasten verschieben, + und − zoomen, 0 setzt zurück; der Fokusrahmen ist sichtbar. ☐

#### Werkzeuge: Panel (Handtest)

- TP3 · Windows: Strg+. öffnet, Suchfeld hat den Fokus, Alt+1…9 wechselt, Pfeil runter/hoch geht durch die Liste, Esc leert die Suche, dann schließt es, der Fokus liegt wieder auf „Werkzeuge“; Alt+Zahl kollidiert mit keinem Windows-Kürzel.

### Leistung

#### Datenebene: Messung auf Geräten (Phase 1, [perf/DATA-BASELINE-2026-11-03.md](perf/DATA-BASELINE-2026-11-03.md))

- **PF1 Portable-Exe, große Datenmenge:** Dev-Preview-Build, Einstellungen → Entwickler → Testdaten „Groß“ laden (die Skala `xl` gibt es nur in `npm run measure:data`). Übersicht öffnen, Kalender, Budgets, Finanzen öffnen, in der Befehlspalette „tankstelle“ suchen: Zeiten notieren (Stoppuhr), Speicher im Task-Manager. ☐
- **PF3 Festplatte-Modul (Rust):** „Dieser PC“ → Löschen-Plan und Details eines großen Ordners: bleibt das Fenster bedienbar (Ziel: ja)? Zeiten in die Baseline eintragen. ☐

## Android

Nur am Android-Handy (APK, Dev-Preview-APK oder PWA in Chrome).

### App: Installation und Update

#### Release 0.3.1 prüfen

RL-R2. _Android-APK als Update_ (`Nemo.apk`) über eine bestehende 0.2.0-Installation installieren: Daten bleiben, Share-Ziel und Benachrichtigungs-Symbol funktionieren. ☐

#### Nemo: Umbenennung und Design

N2. _Android-APK als Update über die bestehende Installation:_ App-Name „Nemo“, neues Icon, alle Daten da, Tresor entsperrbar. Adaptives Icon (runde/eckige Launcher-Maske, Fisch nicht abgeschnitten), Themed-Icon (Android 13+ einfarbig), Benachrichtigungs-Icon in der Statusleiste (`ic_notification` – prüfen, ob es das Tauri-Notification-Plugin wirklich nutzt), Splash.

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM12 PWA offline:** PWA einmal online öffnen, Flugmodus, dann App + benutztes Werkzeug + Tresor-Stärke öffnen ([perf/COLD-START-2026-10.md](perf/COLD-START-2026-10.md)). (Runde T1–T6, #341–#349; vgl. BP1) ☐

#### Launch-Review: Handtests (aus STATUS verschoben, 2026-11-10; Bericht [security/LAUNCH-REVIEW-2026-10-06.md](security/LAUNCH-REVIEW-2026-10-06.md))

LR3. _Android-APK-Update._ ☐

#### Backlog-Ernte (`chore/backlog-harvest-2026-11`) – nur auf Geräten prüfbar

- **BK1 Android Auto Backup aus:** nach dem ersten CI-Build des Dev-Previews die APK installieren: `adb shell dumpsys package io.github.sgnemo.taschenmesser.dev | findstr /i ALLOW_BACKUP` zeigt kein `ALLOW_BACKUP`. Außerdem prüfen, dass der Schritt „Android manifest hardening“ im Job-Log steht und `usesCleartextTraffic` meldet. ☐

### Logo und Icons

#### Nemo: Umbenennung und Design

N9. _Android-APK als Update über die bestehende Installation:_ App-Name „Nemo“, **neues Launcher-Icon** (adaptiv: runde und eckige Maske, Fisch nicht abgeschnitten), Themed-Icon (Android 13+, einfarbig), **Benachrichtigungs-Icon** in der Statusleiste ist der weiße Fisch (kein weißer Klotz), alle Daten und der Tresor bleiben. Vorher war unklar, ob die Icons überhaupt in der APK landen (Kopierschritt in `release.yml` neu). ☐
CF-N12. _Clownfisch-Icon, Android-APK als Update über die bestehende Installation:_ Launcher-Icon (runde, eckige und Squircle-Maske: Fisch nicht abgeschnitten), Themed-Icon (Android 13+, einfarbig), Benachrichtigungs-Icon in der Statusleiste, Splash (hell/dunkel). Benachrichtigungs-Akzent ist jetzt `#E0550F`. ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM6 Launcher-Icon:** zeigt den Fisch v2.2. (PR #669) ☐

#### Logo v2 (Branch `design/logo-v2`) – nur auf Geräten prüfbar

Neues Zeichen: orangefarbene Kachel mit weißem Fisch (App-Symbol), Pille „Mark + NEMO“ in der Seitenleiste; Farbe = Akzent-Token (`#b5430c` hell, `#ff9a57` dunkel).
- **LG3 Android als Update:** `Nemo.apk` über eine bestehende Installation installieren: Daten bleiben, Launcher-Symbol zeigt den neuen Fisch (Kreis, Squircle oder abgerundet je nach Launcher; der Fisch liegt vollständig innerhalb der Maske), Benachrichtigungs-Symbol in der Statusleiste ist der Fisch (einfarbig) mit der Akzentfarbe, Verknüpfungen (Kurzbefehle, Teilen-Ziel) haben den neuen Hintergrund. ☐
- **LG4 Themed Icon (Android 13+):** „Designte Symbole“ im Launcher an: das Symbol nimmt die Hintergrundfarbe an, der Fisch bleibt mit Bändern und Auge erkennbar. ☐

### Darstellung

#### Identität v3: Planen + Geld (`feat/identity-v3-planen-geld`) – am Gerät und in „Ruhig“ prüfbar

- [ ] IP1 Kalender, ToDos, Gewohnheiten, Zeiterfassung, Karten & Orte, Abos, Budgets am Handy (412 px) und im Hochformat: nichts läuft seitlich über, Kopf lesbar, Schalter ≥ 44 px.

#### Optik-Politur und Benachrichtigungs-Zentrum (`fix/visual-polish-notifications`) – nur auf echter Hardware prüfbar

OP-V2. _Android:_ Übersicht, Kalender, Einstellungen im Hoch- und Querformat; Glocke in der Top-Bar, Panel als Sheet, Toasts über der Navigationsleiste, nichts unter Kamera-/Gestenleiste. ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM8 Planen + Geld v3.1:** ToDos-Kopf: Titel gekürzt, „Später“ sichtbar; Rechnungen: „Nächste bezahlen“. (PR #493) ☐
- **GM9 Topbar:** lang scrollen, Seite wechseln → die Leiste ist sofort da. (PR #481) ☐
- **GM10 Handy-Layout (QA P2):** Gerätetest von Kopfzeile, Listenzeilen, Hinweisen, Willkommenskarte, ToDos-Spalte, Einstellungs-Navi. (`fix/qa-mobile-layout`) ☐

#### Wissen, Medien, Dienste (Branch `feat/knowledge-media-depth`) – nur auf Geräten prüfbar

- **W8 Handy (Android/PWA):** Notizen (Karten, Vorlagen), Merkliste (Pinnwand) und E-Mail-Listen bei 412 px: nichts läuft über, Menüs sind erreichbar. ☐

#### Modul-Rahmen, Wetter und Musik (Branch `feat/module-shell-identity`) – nur auf Geräten prüfbar

- **MR-M1 Handy-Kopf (Android):** ein Modul öffnen (z. B. Finanzen, Wetter), nach unten scrollen: der Kopf schrumpft auf eine Zeile (Name, Tabs), die Leiste oben blendet beim Scrollen nach unten aus und beim Hochscrollen wieder ein, ohne den Kopf zu verdecken. Zurück an den Anfang: der Kopf wächst wieder. ☐

### Übersicht

#### Übersicht und Dieser PC (Runde `feat/dashboard-variety-system-module`) – nur auf echtem Windows/Android prüfbar

DV-V8. _Android:_ Übersicht (Widgets, „Jetzt wichtig“ umbrechen sauber, Touch-Ziele), Dieser PC erscheint **nicht**. ☐

#### Übersicht als Home-Screen

HS-H2. _Bearbeitungsmodus per Touch (Android):_ „Anpassen“ → Widget am Griff lange drücken und verschieben, Größe S/M/L wählen, Widget-Liste öffnen und ein-/ausblenden, „Zurücksetzen“; alle Ziele gut treffbar, Seite scrollt beim Wischen nicht versehentlich mit. ☐

### Cockpit

#### Cockpit-Modus (`feat/cockpit-mode`) – Gerät nötig

CP-C1. _Android immersiv:_ Übersicht → „Cockpit“: Status- und Navigationsleiste verschwinden, Wischen vom Rand zeigt sie kurz; „Cockpit beenden“ (Griff oben antippen) bringt sie zurück. ☐
CP-C2. _Bildschirm wach halten (Android):_ Einstellungen → Darstellung → Sonstiges → „Bildschirm wach halten“ an; im Cockpit geht der Bildschirm nicht aus, nach dem Beenden wieder normal. ☐
CP-C4. _Zurück-Geste (Android):_ Widget-Titel öffnet das Modul im Panel; Zurück schließt nur das Panel, das Cockpit bleibt. ☐

### Einstellungen

#### Einstellungen neu (Kategorien, Über Nemo) – nur auf echter Hardware prüfbar

EN-E2. _Android:_ Einstellungen öffnet die Kategorien-Liste, eine Kategorie öffnet den Inhalt, die Zurück-Geste führt zur Liste; große Touch-Ziele. ☐

#### Einstellungen v2 (Paket 1) – nur von Hand prüfbar

- **SO1 Handy, zwei Ebenen:** Einstellungen öffnen: Karten oben, Kategorienliste darunter; eine Karte antippen, in der Kategorie „Zurück“ (Pfeil und Android-Geste) führt zur Übersicht. ☐
- **SO2 Modul-Seite auf dem Handy:** Module → ein Modul: Kopf mit Modulfarbe, Blöcke untereinander, „Alle Module“ zurück; in „Ruhig“ wird der Kopf grau. ☐
- **SO4 Erweitert auf dem Handy:** Einstellungen → KI: „Erweitert“ ist zu; antippen öffnet „Lokales Modell“ und „KI-Statistik“; Seite neu laden: bleibt offen; wieder zu: bleibt zu. ☐
- **SO12 Barrierefreiheit:** Einstellungen → Barrierefreiheit am Handy: Textgröße „Sehr groß“ und Bewegung „Weniger“ wirken sofort, Lesehilfe und Fokus sind hier zu finden; ein alter Link (Darstellung → Fokus) führt hierher. ☐

#### Einstellungen in Identität v3 (Paket 1) – nur von Hand prüfbar

- **SV1 Handy, zwei Ebenen:** Einstellungen: Status-Kopf mit sechs Kacheln, darunter Karten und die gruppierte Liste; eine Kategorie antippen zeigt ihren Kopf mit „Einstellungen“ als Rücksprung, Android-Zurück führt zur Liste. ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM7 Einstellungs-Suche:** Einstellungen lang runter/hoch scrollen: die Suche bleibt ohne Lücke unter der Kopfleiste. (`fix/settings-search-sticky-phone`) ☐

### Modul-Bibliothek

#### Bibliotheken in Identität v3 (Paket 2) – nur von Hand prüfbar

- **LB1 Handy:** Modul-Bibliothek: Kopf mit Zahlen, Werkzeugleiste (Suche, Filter, Bereich) bricht um, Karten einspaltig; „Details“ öffnet das Modul, Android-Zurück führt zur Liste. ☐

### Bedienung

#### Komfort-Review (`docs/product/comfort/`) – nur im Alltag und am Handy prüfbar

KO-K1. _Eine Woche echte Nutzung:_ ToDos, Termine und Geld nur über Zeilenaktionen (Wischen, ⋯-Menü) bedienen. Fehlt eine Aktion, die du ständig suchst? Löst ein Wisch versehentlich etwas aus? ☐
KO-K2. _Wischen am Handy:_ ToDo erledigen, Rechnung bezahlen, Buchung umkategorisieren, Termin „+1 Tag / +1 Woche“. Fühlt sich die Trefferfläche (≥ 44 px) und der Rückgängig-Hinweis gut an, auch einhändig? ☐

### Schnellerfassung und Befehlspalette

#### Befehlspalette lädt beim ersten Öffnen (nur von Hand prüfbar)

- **BP1 Offline:** PWA am Handy einmal online öffnen, Flugmodus, App neu starten: Suche/Palette (Lupe, Strg+K, Sprachtaste) öffnet sich ohne Fehler, auch ohne dass sie vorher benutzt wurde. ☐

#### Schnellerfassung: Android-Kurzbefehle, Kachel, Tray „Heute“ – nur auf echter Hardware prüfbar

Android-Teil: Gradle baut ihn nur im Job „Android APK (dev)“ von `.github/workflows/dev-preview.yml` (nach jedem grünen Push auf `develop`) bzw. „Android APK“ von `release.yml` (Trockenlauf bei Push auf `develop` mit Änderungen unter `web/src-tauri/**`), nicht im PR.
SF-Q1. _Android, Launcher:_ lange auf das Nemo-Symbol drücken: drei Kurzbefehle „Erfassen“, „Suchen“, „Heute“ (Gerätesprache). „Erfassen“ öffnet die App mit dem Erfassen-Blatt, „Suchen“ mit der Suche, „Heute“ auf der Übersicht – auch wenn die App schon offen war. ☐
SF-Q2. _Android, Schnelleinstellungen:_ Schnelleinstellungen bearbeiten → Kachel „Nemo: Erfassen“ hinzufügen, tippen: Leiste klappt zu, App öffnet mit dem Erfassen-Blatt (Android 14+ und älter). Bei gesperrtem Handy erst entsperren, nichts öffnet über dem Sperrbildschirm. ☐
SF-Q3. _Dev-Preview parallel installiert:_ Kurzbefehle und Kachel der „Nemo Dev“ öffnen „Nemo Dev“, die der stabilen App die stabile App (nie die andere, keine Auswahl-Abfrage). Teilen von Text funktioniert in beiden wie vorher. ☐

### Spracheingabe

#### Spracheingabe (nur von Hand prüfbar)

SE-V3. _Android (Chrome-PWA und APK):_ PWA: Mikrofon-Knopf in der Palette spricht, Berechtigung wird erfragt. APK: Knopf ist ausgeblendet, Einstellungen sagen „Hier nicht verfügbar“. ☐

### Tastenkürzel

#### Tastenkürzel (Kürzelkarte)

TK-K3. _Handy:_ der Abschnitt lässt sich nur mit Fingertipp bedienen („Entfernen“, „Standard“). ☐

### Erinnerungen und Benachrichtigungen

#### Stumm (Pause für Erinnerungen)

ST-M1. _Android:_ Erinnerung in 2 Minuten anlegen, Einstellungen → „Stumm“ → 1 Stunde: die Erinnerung kommt, aber ohne Ton und Vibration (Kanal „Stumm“ in den App-Benachrichtigungseinstellungen sichtbar). Danach „Aus“: nächste Erinnerung mit Ton. ☐

#### Erinnerungen bei geschlossener App (P5) – nur auf Android prüfbar

Skript und Auswertung: [features/qa-reminders-safety.md](features/qa-reminders-safety.md). Je Zeile notieren: pünktlich / verspätet (Minuten) / nie; Gerät, Android-Version, Akkumodus.
EG-E1. _Android:_ Erinnerung in 3 Minuten, App aus den zuletzt benutzten Apps wegwischen, Bildschirm aus: kommt pünktlich. ☐
EG-E2. _Android, Ruhezustand:_ Gerät 30+ Minuten unberührt (nicht am Ladegerät), Erinnerung in 45 Minuten: kommt. ☐
EG-E3. _Android, Neustart:_ Erinnerung in 10 Minuten, Gerät neu starten, Nemo nicht öffnen: kommt. ☐
EG-E4. _Android, Akku „eingeschränkt“ für Nemo_ und _„Wecker & Erinnerungen“ entzogen_: jeweils wie EG-E1; Ergebnis dokumentieren. ☐
EG-E5. _Android, „Beenden erzwingen“ und Flugmodus:_ wie EG-E1 (Flugmodus muss gehen). ☐
EG-E6. _PWA in Chrome (gleiches Handy), mit und ohne Web Push:_ EG-E1 und EG-E3; ohne Push kommt nichts, mit Push kommt es. ☐

#### Erinnern-Zeile, Genommen, Ruhe (P5 Paket A)

EZ-A1. _Android:_ Termin mit Uhrzeit anlegen, „Erinnern → 1 h“ und „Als Vorgabe merken“; ein neuer Termin startet mit „1 h“, ein Termin ohne Uhrzeit bekommt nichts. Ohne Benachrichtigungs-Erlaubnis erscheint ein ruhiger Satz mit „Erlauben“ und „Nicht mehr zeigen“. ☐
EZ-A3. _Android:_ Erinnerung mit „Einnahme“ anlegen: Karte und Glocke zeigen „Genommen“, danach ist sie weg, nichts wird gezählt. ☐

### Zock-Modus

#### Zock-Modus (Windows, Vollbild-Spiel) – nur von Hand prüfbar

- **Z5 Android:** Zock-Modus „An“: Erinnerung kommt über den Kanal „Stumm“ ohne Ton und Vibration; „Aus“: wieder normal. ☐

### Fokus

#### Fokus- und Aufmerksamkeitshilfen (Paket 1) – nur mit echtem Gerät und echtem Alltag prüfbar

FO-F1. _Fokusmodus am Handy (Android):_ ToDo über „Jetzt dran“ starten. Ring, Schritte und Buttons gut erreichbar mit einer Hand? Display-Sperre/App-Wechsel während der Runde: nach Rückkehr stimmt die Restzeit, die Anzeige oben führt zurück. Ende: „Zeit ist um“ erscheint erst beim Öffnen der App (kein System-Hinweis im Hintergrund, bekannt). ☐
FO-F3. _Schnellerfassung in echten Situationen:_ unterwegs „Formular ausfüllen 15 min“ eintippen und per Teilen-Menü etwas erfassen; stimmt Dauer und Ziel, wirkt es schnell genug? ☐
FO-F7. _Android, App geschlossen:_ Erinnerungen und das Ende einer Fokus-Runde kommen vom System (ohne Knöpfe, bekannt); „Später“ gibt es nur in der Karte bei offener App. Gestaffelte Erinnerung testen (Einstellungen → Ruhige Erinnerungen). ☐

### KI

#### KI-Eintragen per Leiste (PR A, nur von Hand prüfbar)

- **KL-K7 Android „Leicht“:** folgt mit der Android-Entscheidung.

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM11 KI-Erinnerung per Satz:** Satz per Sprache („Erinner mich um 15 Uhr an die Wäsche“): die Benachrichtigung kommt zur Zeit. (`feat/ai-reminder-voice`) ☐

### Teilen

#### Links, Teilen, Lesezeichen (Phase 13, Schritt 6)

LT-L3. _Teilen (Android, PWA in Chrome installiert):_ in einer anderen App „Teilen“ → Nemo → Seite „Teilen“ mit den Zielen (nur eingeschaltete Module); Merkliste/Notiz/ToDo öffnen vorbefüllt. Die **APK** hat kein Teilen-Ziel (nicht gebaut). ☐

#### Mit Partner teilen: QR-Bilder (Kamera) – nur von Hand prüfbar

QR-Q5. _Android-App:_ QR-Lesen braucht Kamera-Berechtigung und eine WebView mit QR-Erkennung; wenn das Lesen nicht startet, gilt der Dateiweg. ☐

### Uhr

#### Uhr (Paket 1, #615) – nur von Hand prüfbar

Vorbereitung: Einstellungen → Darstellung → „In Arbeit anzeigen“, Modul-Bibliothek → „Uhr“ einschalten, zwei Orte eintragen. Hintergrund: [features/clock.md](features/clock.md).
- **UH-U2 Sortieren mit dem Finger (Android):** Griff lange drücken, Ort ziehen: die Reihenfolge bleibt nach Neustart; Scrollen der Liste verschiebt nichts; „Rückgängig“ im Toast stellt die alte Reihenfolge her. ☐

### Finanzen

#### Geld-Gruppe: Finanzen (Paket 1)

- **GD-G6 Hell/dunkel/Ruhig:** Finanzen-Seite (Kopf, Karten, Ausblick) in Hell, Dunkel und „Ruhig“, Handy 412 px: lesbar, nichts läuft über. ☐

### Rechnungen

#### Geld-Gruppe: Rechnungen (Paket 2)

- **GD-G10 Kopf:** Beleg-Karte hell, dunkel, „Ruhig“, 412 px: Summe, Anzahl, nächste Fälligkeit lesbar, gezackter Rand ohne Bewegung. ☐

### Abos

#### Geld-Gruppe: Abos (Paket 3)

- **GD-G11 Kacheln und Kopf:** Abos hell, dunkel, „Ruhig“, 412 px: Kachel mit Monogramm und der Kopf mit der nächsten Abbuchung lesbar, jede Kachel behält ihre Farbe, nichts bewegt sich. ☐

### Budgets

#### Geld-Gruppe: Budgets (Paket 4)

- **GD-G15 Zeiträume und Übertrag:** Budget mit „Quartal“ und „Rest übernehmen“ (Mehr Felder): Karte zeigt „Q… 2026“, die Summe des Quartals und den Übertrag des Vorquartals. Hell, dunkel, „Ruhig“, 412 px: Kopf („Noch frei“, Ring nur breit), Karten lesbar. ☐

### Unterlagen und Fristen

#### Fristen (P5 Paket B)

FR-F3. _Handy:_ Einheit-Auswahl (Tage/Wochen/Monate) und Zahlenfeld gut treffbar, Zahl bleibt beim Wechsel der Einheit. ☐

#### Löschen mit Rückgängig, Entwurf (P5 Paket C)

LU-U2. _Handy:_ Unterlage-Dialog öffnen, Text tippen, Zurück-Geste bzw. neben den Dialog tippen, Dialog erneut öffnen: Text ist da; „Abbrechen“ verwirft ihn. ☐

### Vorräte

#### Haushalt & Tresor (Branch `feat/household-vault-identity`) – nur auf Geräten prüfbar

- **HT1 Barcode-Scanner (Android, Chrome/PWA und APK):** Vorräte → „Scannen“, Kamera erlauben, einen Barcode einer Packung zeigen: unbekannt → neuer Vorrat mit der Nummer; danach dieselbe Packung nochmal: „einer mehr“. Wo die Kamera-Erkennung fehlt (APK-WebView?), erscheint der Hinweis und die Nummer lässt sich tippen. Kamera geht beim Schließen aus. ☐

#### Identität v3: Haushalt und Tresor (Paket 1) – nur von Hand prüfbar

- **HV1 Wischen am Etikett (Handy):** In den Vorräten einen knappen Vorrat nach rechts wischen → „An die Einkaufsliste gesendet“; das Warenkorb-Symbol am Etikett tut dasselbe.
- **HV3 Scannen:** „Scannen“ in der Werkzeugleiste öffnet weiterhin die Kamera; der Barcode legt einen Vorrat an oder erhöht ihn.

### Tresor

#### Schritt 11b – OS-Keystore, Biometrie, Bildschirmschutz

KS-7. _Keystore-Schlüssel:_ API-Schlüssel speichern, App komplett schließen und neu öffnen, „Verbindung testen" funktioniert. Nach Neustart des Handys ebenfalls. ☐
KS-8. _Biometrie aktivieren:_ Accounts → Import, Export & Sicherheit → aktivieren (Master-Passwort) → Fingerabdruck-Dialog → „aktiv". Sperren → Sperrbildschirm zeigt den Dialog → Fingerabdruck → offen. ☐
KS-9. _Abbrechen / falscher Finger:_ Dialog abbrechen → gesperrt, Passwort geht weiter; falscher Finger → Dialog meldet Fehler, kein Entsperren. ☐
KS-10. _Fingerabdrücke geändert:_ In den Android-Einstellungen einen Fingerabdruck hinzufügen oder löschen → beim nächsten Entsperren erscheint „Biometrisches Entsperren ist nicht mehr gültig…", Master-Passwort entsperrt, Biometrie lässt sich neu aktivieren. ☐
KS-11. _Bildschirmschutz:_ Auf der Accounts-Seite Screenshot versuchen (wird blockiert/schwarz), App-Umschalter (Übersicht) zeigt kein Vorschaubild; auf anderen Seiten (Dashboard) normale Screenshots. ☐
KS-12. _Hintergrund-Sperre:_ App in den Hintergrund → nach eingestellter Zeit ist der Tresor gesperrt. ☐

### Notizen

#### Notizen: Editor (`feat/notes-editor`) – nur auf echter Hardware prüfbar

- **NE-E1 Android:** Seite öffnen, Tastatur (Gboard) mit Autokorrektur: tippen, `# ` und `- ` Kürzel, `/`-Menü, Text markieren → schwebende Leiste bedienbar (Fett, Hervorheben, Link); Bild aus der Galerie per „/Bild“; Zurück zur Liste. ☐
- **NE-E4 Große Seite:** 100.000 Zeichen einfügen (z. B. langer Markdown-Text): Tippen und Scrollen bleibt flüssig auf dem Handy? ☐
- **NE-E5 Android Seitenliste:** Notizbuch anlegen (Farbe, Symbol), Seiten verschieben, „Eigene Reihenfolge“ mit langem Druck auf den Griff sortieren (scrollt die Liste noch?), „Offene Seiten“ oben in der Liste, Zurück-Taste. ☐
- **NE-E10 Verknüpfen:** `[[` tippen (Handy-Tastatur), Titel wählen, Link antippen, Rückverweise unter der Seite; „Notiz ergänze …“ im Assistenten zeigt in der Vorschau den angehängten Text. ☐

### Merkliste

#### Identität v3: Wissen (Paket 2) – nur von Hand prüfbar

- **WK2 Pinnwand:** Merkliste in der Kartenansicht: Karten liegen auf der Tafel, nichts läuft über den Rand (Handy).

### Browser

#### Browser (Desktop, nur mit echtem Fenster prüfbar)

BR-B9. _Android (Custom Tabs, APK nötig):_ Browser öffnen, Adresse eingeben → die Seite erscheint in einem Custom Tab (Chrome-Leiste, Schließen-Pfeil zurück in Nemo). Suchbegriff nutzt die gewählte Suchmaschine. Stern setzt ein Lesezeichen; Lesezeichen und „Zuletzt besucht“ öffnen wieder im Custom Tab. Ohne Chrome/Browser mit Custom Tabs öffnet der Standardbrowser. Die Einstellungen zeigen Blocker/HTTP-Warnung nicht. ☐
BR-B10. _Android: Datenschutz:_ Nemo erhält nichts aus dem Custom Tab zurück (Verlauf zeigt nur, was in Nemo geöffnet wurde); „Verlauf speichern“ aus → nichts wird vermerkt. Der Browser erscheint nicht in der Desktop-Liste doppelt. ☐

### Dieser PC

#### Datenträger, Systeminfo (diese Runde) – nur auf echtem Windows prüfbar

Alles mit einem **Testordner** mit erfundenen Dateien, nie mit echten Nutzerdaten:
DT-D16. _Android/PWA:_ „Datenträger“ und „Systeminfo“ erscheinen weder in der Modul-Bibliothek noch im Menü. ☐

### Werkzeuge

#### Bildschirmfoto (Windows-App, Handy) – nur von Hand prüfbar

Werkzeug in Einstellungen/Werkzeuge einschalten (standardmäßig aus). Details: [features/screenshot.md](features/screenshot.md).
- **BF-B5 Android:** Werkzeug zeigt nur den Hinweis, keinen Knopf. ☐

#### Rechner-Modi (Branch `feat/calculator-modes`)

RM-C1. _Android-APK:_ Rechner öffnen, alle sechs Tabs durchtippen; die Tab-Leiste scrollt seitlich, die aktive Tab bleibt sichtbar, Tasten sind gut treffbar, Tastatur verdeckt das Ergebnis nicht. ☐

#### Rechner-Plotter (Branch `feat/calc-plotter`)

PL1. _Android-APK:_ Rechner → Tab „Plotter“: der Graph füllt die Breite, die Achsenzahlen sind lesbar, Zoom- und Pfeil-Tasten sind gut treffbar, die Bildschirmtastatur verdeckt den Graphen nicht. ☐

#### Anonyme Persona (Branch `feat/tool-anonymous-persona`)

AP4. _Android:_ die Zeilen mit „Kopieren“ und „Neu würfeln“ sind gut treffbar, nichts läuft über den Rand. ☐

#### Werkzeuge: Panel (Handtest)

- TP1 · Android: „Werkzeuge“ öffnet ein Vollbild-Sheet auf dem zuletzt benutzten Werkzeug; Pfeil oben links zeigt die Liste, Zurück-Geste schließt das Sheet; keine Taste unter 44 px, kein seitliches Wischen.

### Leistung

#### Datenebene: Messung auf Geräten (Phase 1, [perf/DATA-BASELINE-2026-11-03.md](perf/DATA-BASELINE-2026-11-03.md))

- **PF2 Android-Gerät, große Datenmenge:** wie PF1 auf einem echten Gerät (oder Emulator): Start bis zur Übersicht, Modul öffnen, Suche, Schnellerfassung; Backup erstellen und wiederherstellen. Messwerte der Emulation (4× CPU) stehen in der Baseline. ☐

## Beide Geräte: zusammen oder je einmal

Braucht PC und Handy gleichzeitig (Sync, Fernsteuerung, zwei Geräte) oder soll auf beiden einmal laufen.

### App: Installation und Update

#### Release 0.3.1 prüfen

RL-R3. _In-App-Update:_ eine 0.3.x-Installation (Windows-Portable und Android) prüft Updates und aktualisiert auf das erste Release ohne `Taschenmesser-*`-Dateien (`latest.json` verweist auf `Nemo-Portable.exe`, Android nimmt `Nemo.apk`). Daten bleiben erhalten. Von 0.2.x aus ist kein Selbst-Update mehr möglich (nur Neuinstallation). ☐
RL-R4. _Sync-Tresor v2 (Argon2id) mit einem 0.2.0-Gerät:_ zweites, altes Gerät am selben Server; prüfen, ob ein älterer Tresor weiter entschlüsselt. ☐
RL-R5. Datenträger-Modul DT-D1–DT-D18 und Keystore/Windows Hello (Schritt 11b) wie unten. ☐

### Logo und Icons

#### Logo v2 (Branch `design/logo-v2`) – nur auf Geräten prüfbar

Neues Zeichen: orangefarbene Kachel mit weißem Fisch (App-Symbol), Pille „Mark + NEMO“ in der Seitenleiste; Farbe = Akzent-Token (`#b5430c` hell, `#ff9a57` dunkel).
- **LG7 Logo v2.1 (nach dem ersten Dev-Preview-Build):** Windows-Taskleiste bei 100 % und 150 %: der weiße Fisch auf der Akzent-Kachel ist bei 16–24 px als Fisch in einem Stück erkennbar (zwei innere Bänder, kein Lautsprecher-Symbol); Android-Launcher (Kreis/Squircle), Themed Icon und Benachrichtigung zeigen dieselbe Form, nichts angeschnitten. ☐

### Darstellung

#### Lesbarkeit (`feat/readability`) – nur im Alltag prüfbar

- **LS-L1 Lesehilfe eine Woche** auf PC und Handy: Einstellungen → Darstellung → Lesen einschalten; Umfang 25/50/75/100 %, Anteil 30/40/50 und Stärke Weich/Fett ausprobieren (Überschriften: Wortanfang hell, Rest dunkler; bei 100 % auch Schaltflächen und Navigation); hilft es bei Notizen, Antworten, Hilfetexten? `Alt+L` zum Umschalten (PC).

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM13 Fundament v3:** Übersicht und je ein Modul pro Bereich in hell/dunkel, „Ruhig“, eingeklappte Sidebar, Handy. (PR #414) ☐
- **GM14 Lesehilfe 100 %:** beim Modulwechsel prüfen. (PR #496) ☐

### Sprache

#### Sprachen (App auf Deutsch und Englisch; es/fr/pt-BR eingefroren)

- **SP-S1 – jede Sprache einmal durchklicken:** Einstellungen → Allgemein → Sprache nacheinander auf English und Deutsch (nur diese zwei plus „Wie das Gerät“ in der Liste). Je Sprache: Übersicht, Kalender, ToDos, Finanzen, Einstellungen, Befehlspalette (Strg+K) und einen Dialog öffnen. Erwartet: sofortige Umschaltung ohne Neustart, kein deutscher Rest außer Einträgen, Startdaten und den Beispielen für Schnell erfassen; nichts abgeschnitten (Telefon und Desktop); Datum, Zahlen und Beträge passend zur Sprache.
- **SP-S2 – Systemsprache:** neue Installation (Android: App-Daten löschen; Windows: portable exe in leerem Ordner; PWA: neues Browserprofil) mit Gerätesprache Deutsch (Österreich) → App startet auf Deutsch, Einrichtung fragt im ersten Schritt nach der Sprache. Gerätesprache Spanisch oder Japanisch → Englisch (die Liste zeigt dann „Same as device (English)“).
- **SP-S5 – Datums-/Zeitfelder (QA B25):** auf echtem Windows (portable exe) und Android-Handy mit deutscher bzw. englischer Oberfläche einen Termin anlegen: zeigen die Felder Datum und Uhrzeit das Format des Geräts (TT.MM.JJJJ, 24 h) oder US-Format („10/29/2026“, AM/PM)? Der QA-Lauf sah US-Format in einem Test-Chromium; erst bei Bestätigung am Gerät wird Code geändert. ☐

### Übersicht

#### Übersicht als Home-Screen

HS-H1. _Windows-Portable und Android:_ App öffnen → Start ist die Übersicht; Logo (Sidebar bzw. Kopfzeile) führt von jedem Modul zurück; Android-Zurück: Modul → Übersicht, Übersicht beendet die App. ☐
HS-H3. _Sync der Anordnung:_ auf Gerät A Reihenfolge/Größe/Sichtbarkeit ändern, Gerät B synchronisieren: gleiche Übersicht; ein altes Layout (vor dem Update angepasst) bleibt erhalten. ☐

### Einstellungen

#### Einstellungen v2 (Paket 1) – nur von Hand prüfbar

- **SO7 Profile am Handy und am PC:** Einstellungen → Allgemein → Verwalten: „Abends“ schaltet dunkel + ruhige Farben + Ruhezeit; das Profil trägt „Aktiv“, „Rückgängig“ im Hinweis stellt alles zurück; ein Zeitplan (z. B. in 2 Minuten) schaltet bei offener App um, ein Umschalten von Hand davor oder danach bleibt bis zum nächsten Zeitpunkt. ☐
- **SO8 Datei mit Einstellungen:** exportieren (Android: „Speichern unter“, Windows: Dialog), die Datei im Texteditor ansehen: keine Adressen, Tokens, Tresor- oder Supporter-Werte; auf einem zweiten Gerät übernehmen: Vorschau, dann „Übernehmen“ und „Rückgängig“. ☐

### Einrichtung

#### Einrichtungsassistent

EA-E1. _Aus den Einstellungen starten und abbrechen (Windows-Portable und Android):_ Einstellungen → „Einrichtung starten“ → ein, zwei Schritte mit „Weiter“ → X → „Später fortsetzen“; App schließen und neu öffnen: es öffnet sich nichts von selbst; erneut starten bietet „Fortsetzen bei …“. Android: Zurück-Geste fragt nach, statt die Seite zu verlassen. ☐
EA-E2. _Frische Installation (Windows-Portable, dann Android-APK):_ Übersicht zeigt die Willkommenskarte (kein Vollbild); „Einrichtung starten“ → alle Schritte durchgehen. Tresor: Master-Passwort festlegen, mit Fingerabdruck bzw. Windows Hello entsperrbar. KI-Anbieter mit echtem Schlüssel: „Verbindung testen“, danach Eintrag `ai-key:<anbieter>` im Credential Manager. Benachrichtigungen: erlauben; Android: Erinnerung bei geschlossener App, Hinweis zu genauen Alarmen/Akku-Optimierung. ☐

### Testdaten

#### Testdaten (Dev-Preview)

TS-T1. _Dev-Preview frisch installieren_ (`Nemo-Portable-dev.exe` / `Nemo-dev.apk`, leere Datenbank): Die App startet mit Daten in Übersicht und allen Modulen, Hinweis „Testdaten geladen“ erscheint einmal. ☐

### Backup und Daten

#### Zuletzt gelöscht (P5 Paket D)

ZG-G2. _Mit eingerichtetem Sync-Server, zwei Geräte:_ auf Gerät A löschen und „Endgültig löschen“; nach dem Abgleich ist der Eintrag auch auf Gerät B weg und nicht in dessen Liste. ☐

### Erinnerungen und Benachrichtigungen

#### Optik-Politur und Benachrichtigungs-Zentrum (`fix/visual-polish-notifications`) – nur auf echter Hardware prüfbar

OP-V4. _Keine Banner mehr:_ mit Einstellung „Erinnerungen in der App automatisch einblenden“ aus: Windows-/Android-Systembenachrichtigungen kommen unverändert; mit Einstellung an: Karte oben/unten rechts, verschwindet nach der gewählten Zeit, die Erinnerung bleibt in der Glocke. ☐

#### Erinnern-Zeile, Genommen, Ruhe (P5 Paket A)

EZ-A2. _Einstellungen → Benachrichtigungen (Android, Windows, PWA):_ der Einleitungstext passt zur Plattform; auf Android und Windows fehlt die Push-Karte. ☐
EZ-A5. _Ruhe:_ eine Karte „Ruhe“ (Aus / 1 Stunde / Bis morgen) mit „Beim Spielen“ (Windows) bzw. „Immer leise“ (Android); Schnellleiste und Palette heißen „Ruhe“. ☐

### Fokus

#### Fokus- und Aufmerksamkeitshilfen (Paket 1) – nur mit echtem Gerät und echtem Alltag prüfbar

FO-F6. _Erinnerungen über einen Tag (Handy und PC):_ ein paar Erinnerungen und ToDos mit Datum anlegen; kommt die Morgen-Übersicht um die eingestellte Zeit, wirkt die Karte bei offener App ruhig, ist „Später“ nützlich? Ruhezeit und „höchstens 3 pro Stunde“ in der Praxis spürbar, aber nicht störend? ☐
FO-F8. _„Wenn ich am PC bin“:_ auf dem Handy „Später → Wenn ich am PC bin“ wählen, nach dem Sync erscheint die Erinnerung einmal in der Windows-App. ☐
FO-F10. _Schnellerfassung ohne Rückfrage in echten Situationen:_ unterwegs ein paar vage Sätze tippen; landen sie im Eingang, geht „Eingang sortieren“ abends zügig? Ctrl+Enter am PC fürs ganze Formular. ☐
FO-F11. _Darstellung am Handy und PC:_ „Sehr groß“, „Luftig“, „Bewegung: Weniger“ und „Nur das Wichtigste“ ausprobieren; bricht irgendwo das Layout, ist die ruhige Übersicht ruhig genug? ☐

### KI

#### KI-Eintragen per Leiste (PR A, nur von Hand prüfbar)

- **KL-K1 Echte Sätze (Windows und Android):** in der Leiste (Strg+K / Suchen) eigene Sätze eintippen: „Rechnung Stadtwerke 89,90 € fällig 15.10.“, „Abo Netflix 12,99 monatlich ab 1.11.“, „Lösche das Abo Spotify“, „Markiere die Stadtwerke-Rechnung als bezahlt“. Erwartung: Vorschau mit richtigen Feldern, Änderung/Löschen zeigen Vorher/Nachher, nichts wird vor „Eintragen“ gespeichert, „Rückgängig“ im Hinweis stellt den Stand wieder her. Auf dem Handy: Tastatur schiebt die Vorschau nicht aus dem Bild.

#### KI abschalten – nur mit zwei Geräten prüfbar

- **KA-A1:** Einstellungen → KI → „Alle Geräte“ → abschalten. Das zweite Gerät nach dem nächsten Abgleich: keine KI-Einträge in der Suche, kein „Mit KI eintragen“, Einstellungen → KI zeigt nur „KI wieder einschalten“; die Schlüssel dort sind gelöscht (Windows: Anmeldeinformationsspeicher, Eintrag `ai-key:…`).
- **KA-A2:** „Nur dieses Gerät“: das andere Gerät behält seine KI. Windows: der KI-Zugriff (Port 47631) ist nach dem Abschalten nicht mehr erreichbar.

### Lokale API (KI-Zugriff)

#### KI-Zugriff / lokale Import-API (Phase 2)

Nur in der Windows-App prüfbar (der Server selbst ist per Rust-Tests geprüft, die Oberfläche per E2E mit Ersatz-Server):
KZ-K4b. _Import mit Vorschau:_ derselbe Aufruf ohne `dryRun` → Banner „… möchte 1 Eintrag in „ToDos“ übernehmen“ → Ansehen → Übernehmen; nach dem Sync ist der Eintrag auf dem Handy. „Import rückgängig machen“ (Einstellungen → KI-Zugriff) entfernt ihn überall. Ein Eintrag mit `id` erscheint als Änderung (alt → neu) und ist nicht vorausgewählt. ☐

### Heimnetz-Sync

#### Sync im Heimnetz: PC und Handy koppeln (Pakete 3a/3b) – nur mit Windows-PC und Android-Handy prüfbar

- **HN-L6 Koppeln:** PC: Einstellungen → Synchronisation → „Gerät koppeln“ → QR erscheint (Firewall-Abfrage beim ersten Mal: „Zulassen“). Handy: Einstellungen → Synchronisation → „Mit PC koppeln“ → Kamera-Erlaubnis → QR scannen. Beide zeigen denselben 6-stelligen Code; PC: „Koppeln“. Handy: „Abgeglichen · Mit deinem PC gekoppelt“; PC listet das Gerät. Nichts eingetippt. ☐
- **HN-L7 Abgleich hin und zurück:** ToDo am Handy anlegen → am PC „Jetzt abgleichen“ → erscheint; am PC ändern → Handy „Jetzt abgleichen“ → geändert. Dasselbe Feld auf beiden geändert: die spätere Änderung gewinnt. ☐
- **HN-L8 PC aus:** Nemo am PC beenden → Handy „Jetzt abgleichen“: ruhige Zeile „Gleicht ab, sobald dein PC im selben WLAN erreichbar ist“, kein Rot, keine Meldung; Nemo wieder starten → nächster Abgleich klappt. Neue IP des PCs: siehe HN-L17. ☐
- **HN-L9 Handy kommt heim** (WLAN-Auslöser `lan-watch`; Abgleich ganz im Hintergrund ist nicht gebaut). Jeweils: am Handy unterwegs (WLAN aus, Mobilfunk) eine Änderung, dann WLAN an im Heimnetz, Uhr starten:
  - **a) App offen** (Sync-Seite sichtbar): ohne WLAN ist „Jetzt abgleichen“ grau mit „Nur im WLAN“; WLAN an → innerhalb weniger Sekunden „Abgeglichen“, „Noch nicht abgeglichen“ verschwindet, Knopf wieder aktiv, ohne Tippen. ☐
  - **b) App im Hintergrund** (Home-Taste, 1 / 5 / 15 Minuten warten, dann WLAN an): am PC prüfen, ob die Änderung ankommt, ohne die App zu öffnen; Zeit bis zum Einfrieren notieren (Android friert Apps im Hintergrund nach Minuten ein, CONCEPT §6/F8) → Messwert in CONCEPT §9 nachtragen. ☐
  - **c) App geschlossen** (aus „Zuletzt verwendet“ weggewischt): WLAN an → nichts passiert (erwartet); App öffnen → gleicht nach wenigen Sekunden ab. ☐
- **HN-L10 Kopplung lösen:** am PC „Kopplung lösen“ → Handy „Jetzt abgleichen“: „Diese Kopplung wurde gelöst.“ mit „Neu koppeln“. Am Handy „Kopplung lösen“ → am PC verschwindet das Gerät beim nächsten Kontakt. ☐
- **HN-L11 Abbruch / alter Code:** am PC beim Code „Abbrechen“: Handy zeigt sofort (nicht erst nach Minuten) „Kopplung abgebrochen.“ mit „Neu versuchen“; einen alten QR (Foto) scannen: „Kopplung nicht möglich – am PC neu zeigen.“ mit „Neu scannen“. Am Handy während „Verbindet …“ „Abbrechen“: Dialog schließt sofort. Nach „Kopplung lösen“ am PC: am Handy „Neu koppeln“ → klappt (frischer Geräteschlüssel). ☐
- **HN-L12 Kopfleiste unterwegs:** Handy im Mobilfunk: das Sync-Symbol oben ist grau (kein Rot), Tooltip „Synchronisation: wartet auf deinen PC“. ☐
- **HN-L13 Öffentliches Netz / Kamera:** Windows-Netz auf „Öffentlich“ → PC „Gerät koppeln“: kein QR, stattdessen die Schritte zu „Privat“ und „Windows-Einstellungen öffnen“ (öffnet Netzwerkstatus); auf „Privat“ stellen → QR erscheint nach wenigen Sekunden von selbst. Handy „Mit PC koppeln“: Kamera-Dialog in der App mit „Abbrechen“, Android fragt einmal nach der Kamera; ablehnen → ruhige Zeile „Kamera ist aus …“, kein Absturz; erlauben → QR wird erkannt. ☐
- **HN-L14 PC neu gestartet:** gekoppelt, am Handy eine Änderung → Nemo am PC beenden und neu starten (auch: am nächsten Tag) → Handy „Jetzt abgleichen“: gleicht ab, „Noch nicht abgeglichen“ verschwindet. Ist der PC aus: Zeile „Eben versucht – der PC hat nicht geantwortet …“. ☐
- **HN-L15 Umstieg vom Server:** PC und Handy am eigenen Server → „Vom Server auf das Heimnetz umstellen“: „Vom Server trennen“ erst nach „Sicherung speichern“; die Liste zeigt das andere Gerät mit „Am Server sperren“; nach dem Trennen bleiben alle Einträge, dann koppeln → beide gleichen im Heimnetz ab, nichts doppelt, nichts weg. ☐
- **HN-L17 PC neue IP → Handy findet ihn wieder:** gekoppelt; am Router dem PC eine andere IP geben (DHCP-Reservierung ändern oder PC an anderen Port/Switch, `ipconfig` prüfen), Nemo am PC läuft → Handy „Jetzt abgleichen“: nach höchstens ein paar Sekunden „Abgeglichen“, ohne neu zu koppeln; nächster Abgleich ist wieder sofort (neue Adresse gemerkt). Gegenprobe: Gäste-WLAN oder Netz mit Client-Isolation → ruhige Zeile, kein Rot, kein zweiter Versuch innerhalb von 30 s. ☐

### Teilen

#### Mit Partner teilen: QR-Bilder (Kamera) – nur von Hand prüfbar

QR-Q1. _Zwei Geräte (z. B. Handy und Laptop, Chromium-Browser mit QR-Erkennung):_ Einstellungen → Verbindungen → „Dauerhaft teilen“ → Verbindung anlegen, Code notieren, „Als QR-Bilder zeigen“. Auf dem anderen Gerät „Mit Kamera lesen“, Kamera auf den Bildschirm halten: Fortschritt „n von m Bildern“ läuft hoch, danach erscheint die Vorschau, „Zusammenführen“ übernimmt. ☐
QR-Q2. _Reihenfolge und Wiederholung:_ „Anhalten“, Kamera wegnehmen und später wieder hinhalten: das Lesen läuft weiter, nichts geht verloren. ☐

### Fernsteuerung

#### Fernsteuerung, PC-Seite (`feat/remote-host-media`, `feat/remote-host-settings`) – nur auf echtem Windows prüfbar

FS-R1, FS-R2, FS-R8, FS-R10 und FS-R11 gehen sofort (Einstellungen → Allgemein → „In Arbeit anzeigen“ an, dann Einstellungen → Verbindungen → Fernsteuerung). FS-R3–FS-R7 brauchen Paket 2 (Handy-Modul), FS-R9 Paket 3.
FS-R1. _Hub ohne Fernsteuerung:_ Heimnetz-Sync wie bisher starten, koppeln, synchronisieren: alles unverändert; Tray zeigt das normale Symbol und kein „Fernsteuerung beenden“. ☐
FS-R3. _Lautstärke und Ton aus:_ vom Handy lauter/leiser (je 2 %) und Ton aus; „lauter“ hebt Ton aus auf; die Anzeige am Handy folgt dem PC, auch wenn am PC selbst gedreht wird. ☐
FS-R4. _Zwei Player:_ Spotify und ein Browser-Video offen: Wiedergabe/Pause, Nächster, Vorheriger treffen den Player, den auch die Medientasten der Tastatur treffen. ☐
FS-R5. _Sperrbildschirm:_ PC sperren (Win+L): Medien und Lautstärke gehen weiter; „PC sperren“ vom Handy sperrt; der Zustand „gesperrt“ kommt am Handy an. ☐
FS-R6. _Tray bei geschlossenem Fenster:_ Fenster in den Tray schließen, Sitzung öffnen: Symbol bekommt den Punkt, Tooltip nennt das Gerät, erster Menüeintrag „Fernsteuerung beenden“, darunter grau „Danach bleibt das Gerät pausiert, bis du es hier wieder einschaltest“. ☐
FS-R7. _Beenden pausiert:_ „Fernsteuerung beenden“ im Tray: das Handy verliert die Verbindung sofort und kommt nicht wieder, bis das Gerät am PC wieder eingeschaltet wird (mit Bestätigung). ☐
FS-R8. _Bestätigung nur am PC:_ „Medien und Lautstärke“ wählen, „Wieder einschalten“, Hauptschalter an (bei vorhandener Freigabe); ab Paket 3 auch Maus/Tastatur und „Entsperren aus“: jedes Mal ein Windows-Dialog mit Gerätename (eigene Zeile) und letztem Kontakt in ganzen Tagen (keine Uhrzeit; unter einem Tag „in den letzten 24 Stunden“), Warnzeichen nur bei Maus/Tastatur oder „Entsperren aus“; „Abbrechen“ ändert nichts; Senken (Stufe runter, Schalter aus) fragt nicht. ☐
FS-R9. _Nicht während einer Sitzung (ab Paket 3):_ während das Handy Maus und Tastatur steuert, lässt sich keine Freigabe erhöhen – auch nicht mit einem Dialog, der vor der Sitzung geöffnet wurde. ☐
FS-R11. _Schalter aus:_ Hauptschalter aus fragt nicht nach und der Heimnetz-Abgleich läuft weiter (Handy synchronisiert danach noch). ☐

#### Fernbedienung, Handy (`feat/remote-module-page`) – nur mit Pixel und Windows-PC prüfbar

Vorher am Handy: Einstellungen → Allgemein → „In Arbeit anzeigen“, Modul „Fernbedienung“ einschalten; am PC: Einstellungen → Verbindungen → Fernsteuerung, dem Handy „Medien und Lautstärke“ erlauben. Zugleich FS-R3–FS-R7 oben ausführen.
FB1. _Erster Android-Build mit dem Client:_ APK bauen und starten; „Fernbedienung“ öffnen: Zeile „Dein PC · Lautstärke … %“ erscheint binnen etwa einer Sekunde. ☐
FB2. _Einhändig, ohne Hinsehen:_ Pause, Nächster, Vorheriger, Leiser/Lauter treffen; gehalten kommt der erste Schritt sofort mit einem Vibrieren, dann höchstens etwa 5 Schritte je Sekunde, auch mit leicht wanderndem Daumen, ohne Kontextmenü; zehnmal blind Leiser/Lauter, nie die untere Leiste getroffen. ☐
FB3. _Menü:_ „Ton aus“ (danach „Ton an“) und „PC sperren“; nach dem Sperren steht „gesperrt“ in der Zeile, Medien gehen weiter. ☐
FB4. _Zustände:_ am PC Schalter aus → Satz mit dem Schritt am PC; am PC „Fernsteuerung beenden“ → „am PC pausiert“; WLAN am Handy aus → nach etwa 5 s „antwortet noch nicht“, dann „nicht erreichbar“; WLAN an + „Erneut versuchen“ → verbunden. ☐
FB5. _Langsames WLAN:_ Wiedergabe/Pause drücken; zeigt die Zeile kurz den alten Stand, heilt eine späte Antwort ihn ohne zweiten Druck? Ein zweiter Druck davor schaltet erneut um (bekannt). ☐
FB6. _App wechseln:_ anderes Programm öffnen und zurück: verbindet neu ohne Frage; am PC verschwindet in der Zwischenzeit der Chip. ☐
FB7. _Widget:_ gekoppelt steht auf der Übersicht „Dein PC“ mit „Öffnen“, ohne Kopplung „Noch kein PC gekoppelt.“ mit „PC koppeln“; es öffnet keine Verbindung (am PC kein Chip). ☐
FB8. _Player ohne Medien-Sitzung:_ ein Player, der sich so nicht pausieren lässt: notieren, welcher (Frage an Sven, kein Tasten-Ersatz). ☐
FB9. _Unterbrechung:_ Bildschirm aus oder eingehender Anruf: am PC verschwindet der Chip; zurück auf der Seite verbindet sie ohne Frage neu. ☐
FB10. _Bildschirm anlassen:_ Einstellung an: der Bildschirm bleibt an, solange die Seite offen ist, und geht nach dem Verlassen wieder normal aus; mit eingeschaltetem Cockpit bleibt dessen „Bildschirm an“ nach dem Verlassen erhalten. ☐
FB11. _TalkBack:_ liest die Zustandszeile bei Sätzen (nicht bei jedem Lautstärkeschritt) und jede Taste mit ihrem Namen. ☐
FB12. _Benachrichtigung bei Maus und Tastatur (ab der Seite Touchpad prüfbar):_ Touchpad am Handy zum ersten Mal nutzen → am PC erscheint einmal, ohne Ton, „Das Gerät „…“ steuert jetzt Maus und Tastatur. Beenden: Rechtsklick auf das Nemo-Symbol im Tray, dann „Fernsteuerung beenden“.“ (ganz lesbar, auch mit einem langen Gerätenamen – der wird nach 24 Zeichen gekürzt); das Symbol liegt unter ^ (ausgeblendete Symbole) → der Text führt trotzdem hin, Rechtsklick → „Fernsteuerung beenden“ beendet und pausiert das Gerät; Klick auf die Benachrichtigung selbst richtet nichts an; Seite verlassen und gleich wieder öffnen → keine zweite; nur Medien nutzen → nie eine; nach 30 Minuten und erneutem Touchpad → wieder eine. Gerät ohne Namen → „Gerät ohne Namen (xxxx) steuert …“ ohne Anführungszeichen; Systemklänge an → trotzdem kein Ton. Mit dem portablen Exe prüfen, ob Windows die Benachrichtigung unter „Nemo“ führt. ☐
FB13. _Latenz messen (Dev-Preview am Handy, PC gekoppelt und im selben WLAN, Fernsteuerung „Medien“ für das Handy erlaubt):_ Einstellungen → Entwickler → „Fernbedienung: Latenz messen“. Auf der Messfläche etwa zehn Sekunden mit einem Finger kreisen, loslassen; „Verbindungsaufbau messen“ tippen und warten; die Zeile „Was der Aufruf kosten darf“ sagt „passt hinein“, „knapp“ oder „zu teuer“. „Ergebnis kopieren“ und die Zeile in die Tabelle in `docs/design/remote-control/CONCEPT.md` §3 übertragen (oder dem Chat geben). Zweimal messen: nah am Router (diese Messung entscheidet) und am anderen Ende der Wohnung (zeigt nur, was das WLAN dazutut; dazwischen eine Minute Pause, der Knopf ist so lange gesperrt). Am PC darf dabei nichts passieren außer dem kurzen Tray-Hinweis beim Verbindungsaufbau; kein „Abgebrochen“. ☐
FB14. _Entsperren am Handy für Maus und Tastatur (ab der Seite Touchpad prüfbar; zuerst: baut die Dev-Preview für Android nach dem Merge von `feat/remote-client-full` überhaupt – das Kotlin der neuen Abfrage ist ungebaut):_ PC verlangt „Am Handy entsperren“ → erstes Tippen aufs Touchpad zeigt die Systemabfrage (Fingerabdruck, Gesicht oder PIN); abbrechen → Medien läuft weiter, kein Touchpad; bestätigen → Touchpad geht, danach acht Stunden keine Abfrage (App neu starten → wieder eine). Handy ohne Bildschirmsperre → Touchpad geht, die Seite sagt, dass das Handy keine Sperre hat. Der Tresor lässt sich danach weiter per Fingerabdruck öffnen. Abfrage zwei Minuten stehen lassen → sie verschwindet von selbst, Medien läuft weiter. PC gesperrt → Touchpad sagt es, Medien läuft weiter. ☐

### Kalender

#### Links, Teilen, Lesezeichen (Phase 13, Schritt 6)

LT-L1. _Karte:_ Termin mit Ort → „Auf der Karte zeigen“ öffnet Google Maps (Windows: Browser, Android: Maps-App). ☐

### Gewohnheiten

#### Geld-Gruppe: Rechnungen (Paket 2)

- **PH1 Wasser trinken:** Modul-Bibliothek → Gewohnheiten einschalten; „Gewohnheit hinzufügen“ → Vorlage „Wasser trinken“ speichern; „+1“ zählt ein Glas ohne Hinweisfeld, Strg+Z nimmt es zurück; die Benachrichtigungen kommen alle 2 Stunden zwischen 9 und 19 Uhr mit „3 von 8 Gläser“ und hören auf, sobald 8 erreicht sind (Android: App geschlossen, Erinnerung kommt trotzdem). ☐

### Zeiterfassung

#### Geld-Gruppe: Rechnungen (Paket 2)

- **TT3 Auswertung und CSV:** Auswertung Woche/Monat: Summe, Betrag, Balken je Projekt/Kunde; „Als CSV speichern“ speichert eine Datei (Windows: Speichern-Dialog, Android: Teilen/Speichern), Öffnen in einer Tabelle zeigt Spalten und `.` als Dezimalzeichen. ☐

### Finanzen

#### Geld-Gruppe: Finanzen (Paket 1)

- **GD-G5 CSV-Export:** Buchungen → „Mehr“ → „Als CSV exportieren“ (Windows-Speichern-Dialog, Android-Teilen): Datei öffnet sich in Excel/LibreOffice mit Semikolon-Spalten, Beträge mit Punkt. ☐

### Rechnungen

#### Geld-Gruppe: Rechnungen (Paket 2)

- **GD-G8 Zahlungsdaten:** IBAN eintragen (Mehr Felder), in der Zeile „⋯“ → „Zahlungsdaten kopieren“, im Banking einfügen: Empfänger, IBAN in Vierergruppen, Verwendungszweck, offener Betrag. Falsche Prüfziffer: ruhiger Hinweis, speichern geht trotzdem. Windows und Android. ☐
- **GD-G9 Beleg:** Foto und PDF anhängen (Android: Kamera/Dateien), Vorschau und „Beleg herunterladen“; auf einem zweiten synchronisierten Gerät steht „liegt hier nicht“. ☐

### Abos

#### Geld-Gruppe: Abos (Paket 3)

- **GD-G12 Probezeit:** Abo mit „Probezeit endet am“ in drei Tagen: Chip „Probezeit“, Erinnerung am gewählten Tag (Windows, Android), Eintrag im Kalender. ☐

### Personen

#### Haushalt & Tresor (Branch `feat/household-vault-identity`) – nur auf Geräten prüfbar

- **HT3 Gratulieren:** Person mit Telefon und Mail: WhatsApp (mit Nummer), Anrufen und E-Mail öffnen auf Windows und Android die richtige App. ☐

### Tresor

#### Schritt 11b – OS-Keystore, Biometrie, Bildschirmschutz

**Beide:** Tresor-Daten und KI-Schlüssel bleiben nach einem App-Update erhalten (Update-Test, siehe unten). ☐

### Browser-Erweiterung

#### Browser-Erweiterung (Brave) und Tresor-Brücke – nur von Hand prüfbar (Windows)

Vorbereitung: Portable-EXE aus dem Branch/Artefakt, `nemo-extension-….zip` entpacken, Tresor mit Beispieldaten. Hintergrund: [security/VAULT-EXTENSION.md](security/VAULT-EXTENSION.md).
X5. _Sync aufs Handy:_ Nach Sync (oder Auto-Sync) erscheint der Eintrag in der Android-App mit demselben Passwort. ☐

### Notizen

#### Notizen: Editor (`feat/notes-editor`) – nur auf echter Hardware prüfbar

- **NE-E8 PDF:** Seite → „Exportieren“ → „PDF (Druckansicht)“: Windows-App und Browser öffnen den Druckdialog („Als PDF speichern“), Bilder sind dabei; auf Android öffnet sich kein Druckdialog (bekannte Grenze der WebView) – Markdown/Text gehen. ☐
- **NE-E9 Ordner-Import:** Ordner mit .md/.txt wählen (Windows und Android): Ordnername wird Notizbuch, zweiter Import desselben Ordners meldet Doppelte. ☐

### Werkzeuge

#### Werkzeuge (Phase 13, Schritt 5)

WZ-T3. _Timer:_ Timer starten, Sheet schließen – läuft weiter; bei Ablauf kommt die Benachrichtigung (Windows und Android). ☐

## Beide Geräte: egal welches

Geht auf jedem Gerät; einmal reicht.

### Logo und Icons

#### Nemo: Umbenennung und Design

CF-N13. _Clownfisch-Icon im Browser/PWA:_ Favicon im Tab (hell/dunkel), „Zum Startbildschirm“ (maskierbares Icon), Sidebar/Topbar zeigen die Wortmarke (Nemo als Clownfisch), leere Zustände. README-Header „Nemo als Clownfisch“ + Claim „Notes · Events · Modules · Offline“ (README.md) bzw. „Notizen · Erinnerungen · Module · Offline“ (README.de.md) auf GitHub in hell und dunkel, Social-Preview neu hochladen (`docs/brand/social-preview.png`). ☐

#### Logo v2 (Branch `design/logo-v2`) – nur auf Geräten prüfbar

Neues Zeichen: orangefarbene Kachel mit weißem Fisch (App-Symbol), Pille „Mark + NEMO“ in der Seitenleiste; Farbe = Akzent-Token (`#b5430c` hell, `#ff9a57` dunkel).
- **LG5 Favicon und PWA:** Tab-Symbol in Chrome/Edge/Firefox bei heller und dunkler Tab-Leiste ist die Kachel mit dem Fisch; PWA installieren: Symbol auf Startbildschirm oder Desktop (maskable: Fisch nicht angeschnitten), Splash beim Start zeigt den Fisch in der Akzentfarbe. ☐
- **LG6 Seitenleiste und Topbar:** breite Seitenleiste zeigt die Pille (hell und dunkel; Systemschema und App-Thema verschieden: die Pille bleibt lesbar), eingeklappt zeigt sie nur den Fisch in Akzentfarbe, Handy-Topbar unter 416 px nur den Fisch, darüber die Pille. ☐

### Darstellung

#### Identität v3: Planen + Geld (`feat/identity-v3-planen-geld`) – am Gerät und in „Ruhig“ prüfbar

- [ ] IP2 „Ruhig“ und „Modulfarben: Aus“: Module bleiben ohne Farbe an Form und Signatur erkennbar (Kapsel-Icons, Umschlag, Ring, runde Häkchen).
- [ ] IP3 Lesehilfe an (Abdeckung 75 und 100 %): Köpfe, Kapseln und Karten sauber, Zahlen und Eingaben unberührt.

#### Nemo: Umbenennung und Design

N3. _Hell / Dunkel / System, Akzentfarben:_ Einstellungen → Darstellung: alle vier Akzente in beiden Themes ansehen; Text lesbar, Fokus sichtbar (Tab-Taste).
N4. _Reduzierte Bewegung:_ Betriebssystem-Einstellung „Animationen reduzieren“ an: keine Seiten-/Listen-/Diagramm-Animation, Ladeplatzhalter ohne Schimmer.
N5. _Neue Module der anderen Chats:_ nach dem Merge Dashboard, Datenträger-Aufräumer und weitere neue Seiten hell/dunkel ansehen (sollten das Design über Tokens erben; Sonderstyles melden).
N7. _Diagramm-Farben:_ Türkis/Orange bei Farbfehlsichtigkeit prüfen (Validator des dataviz-Skills nach dem Rebrand noch nicht erneut gelaufen).
N10. _Hell / Dunkel / System, Akzente, Design „Klar“:_ Einstellungen → Darstellung: alle vier Akzente in beiden Themes; Karten mit Rahmen statt Schatten, Tabs als ruhige Pille, nur ein orangefarbener Hauptbutton je Seite; Titelleisten-Farbe (PWA/Browser) folgt der gewählten Darstellung. ☐
N11. _Reduzierte Bewegung:_ Systemeinstellung an → keine Seiten-/Listen-/Balken-Animation, Listen erscheinen sofort (kein Verzögern), Skeleton ohne Schimmer. ☐

#### Lesbarkeit (`feat/readability`) – nur im Alltag prüfbar

- **LS-L2 Listen:** Umfang 50 % und mehr: werden Titel in Listen ruhiger oder unruhiger? Lange Listen (Rechnungen/ToDos mit vielen Einträgen) bei 100 %: bleibt es flüssig? Fokus-Lesen in einer langen Notiz öffnen.
- **LS-L3 Ruhig-Modus:** Farben → Ruhig: bleiben nur Überfälliges und Heutiges farbig; erkennt man Kategorien noch am Namen?
- **LS-L4 Gliederung:** Rechnungen/ToDos: Gruppen einklappen, nach Neustart bleibt der Zustand; Kalender-Woche: Stundenlinien, Wochenende, Jetzt-Linie; Bereichsfarben in Seitenleiste und Modul-Bibliothek (hell/dunkel, Rail, Handy).

#### Modul-Rahmen, Wetter und Musik (Branch `feat/module-shell-identity`) – nur auf Geräten prüfbar

- **MR-M5 Ruhig-Modus:** Einstellungen → Darstellung → Farben → „Ruhig“: Köpfe, Widget-Bänder, Himmel und Karten werden grau; Aufbau und Signatur bleiben erkennbar. ☐

#### Identität v3: Haushalt und Tresor (Paket 1) – nur von Hand prüfbar

- **HV5 Ruhig / Lesehilfe:** In „Ruhig“ und mit „Modulfarben: Aus“ sind Vorräte, Einkauf, Unterlagen und Passwörter noch an Form und Beschriftung zu erkennen; mit Lesehilfe (75 %) bricht keine Kachel und kein Reiter.

### Sprache

#### Sprachen (App auf Deutsch und Englisch; es/fr/pt-BR eingefroren)

- **SP-S3 – Bestandsinstallation:** ein Gerät mit vorhandenen Daten aktualisieren → bleibt Deutsch, bis die Sprache geändert wird. Ein Gerät, auf dem Französisch (oder Spanisch, Portugiesisch) gewählt war → nach dem Update ruhig Englisch, ohne Dialog; Dezimalzeichen und Datumsreihenfolge unverändert (Einstellungen → Formate zeigt die alte Region). ☐

### Übersicht

#### Übersicht und Dieser PC (Runde `feat/dashboard-variety-system-module`) – nur auf echtem Windows/Android prüfbar

DV-V7. _Übersicht mit echten Daten:_ „Jetzt wichtig“ zeigt Überfälliges (rot), Heute (Akzent), bald Ablaufendes (Warnfarbe) – jeweils mit Icon/Text; leer = Bereich fehlt. ToDo im Widget abhaken → „Rückgängig“. Kachel „Heute“ zeigt Jetzt-Linie und „Als Nächstes“. Dichte „Kompakt“ in Einstellungen → Darstellung. ☐

### Einstellungen

#### Einstellungen neu (Kategorien, Über Nemo) – nur auf echter Hardware prüfbar

EN-E3. _Deep-Links:_ „Benachrichtigungen aktivieren“ im Tab Erinnerungen des Kalenders, das Sync-Symbol oben und der Dev-Hinweis springen in die richtige Kategorie und zum Abschnitt. ☐
EN-E4. _Über Nemo:_ Version, Build/Commit (Dev-Preview), Plattform und Installationsart stimmen; „Ordner öffnen“ öffnet den Datenordner (Portable: `data/` neben der exe, sonst lokaler App-Ordner); Changelog und Lizenzen klappen auf; Diagnose-Export speichert eine Datei ohne Daten und Schlüssel. ☐
EN-E5. _Gerät zurücksetzen (Testgerät!):_ der erste Klick fragt „Bist du sicher?“, ein schneller Doppelklick löscht nicht, „Zurück“ ändert nichts; danach ist die App leer, API-Schlüssel und Backup-Passwort sind weg, der Sync-Server hat seine Daten noch. ☐
EN-E6. _Entwickler:_ die Kategorie erscheint nur im Dev-Preview-Build. ☐

#### Einstellungen v2 (Paket 1) – nur von Hand prüfbar

- **SO5 Zurücksetzen:** Darstellung → Farbschema „Dunkel“: unten erscheint „Vom Standard abweichend“ mit dem Zurücksetzen-Knopf; ein Modul (z. B. Aufgaben): Schalter ändern, „Geändert · Auf Standard“ stellt zurück, „Rückgängig“ bringt es wieder. ☐
- **SO6 Vorschau und Hinweis:** Darstellung → Text öffnen: die Vorschau folgt Schriftgröße und Dichte; Benachrichtigungen → „Erinnerungen in der App einblenden“ an: Beispielkarte oben/unten rechts; Tresor: „30 Minuten“ zeigt den ruhigen Hinweis. ☐
- **SO9 Änderungsverlauf:** drei Einstellungen ändern, „Rückgängig“ in der Liste nimmt genau diese zurück; Schalter „Änderungen merken“ aus: nichts wird mehr notiert; „Verlauf löschen“ leert die Liste. ☐
- **SO10 Meldungen pro Modul:** Einstellungen → Benachrichtigungen → Erweitert → „Meldungen pro Modul“: „Hinweis zur Zeit“ für ein Modul ausschalten, eine Erinnerung dieses Moduls in 2 Minuten setzen: sie erscheint in der Glocke, aber nicht als Hinweis (Android: auch nicht als Systemmeldung); wieder einschalten: sie kommt wieder. ☐
- **SO11 Speicher:** Einstellungen → Allgemein → Speicher: die Größe passt ungefähr zum Gerät; „Zwischenspeicher leeren“ mit Bestätigung, danach Werkzeuge (z. B. Rechner) mit Internet neu öffnen: lädt wieder; die App selbst bleibt offline nutzbar. ☐

#### Einstellungen in Identität v3 (Paket 1) – nur von Hand prüfbar

- **SV2 „Ruhig“ und „Modulfarben: Aus“:** Köpfe, Plättchen und die Kapsel werden grau, Muster verschwinden, alles bleibt lesbar (Text, Icons). ☐
- **SV4 Punkt „weicht vom Standard ab“:** Darstellung → Farbschema „Dunkel“: in der Liste erscheint der Punkt bei „Darstellung“; „Auf Standard“ entfernt ihn; ein Screenreader liest den Text. ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM20 Komfort Einstellungen:** eine Woche Nutzung: Reizlast von Zahnrad und Schnellleiste. (#132, #150, #151, #153; vgl. ST-M1–ST-M4) ☐

### Modul-Bibliothek

#### Bibliotheken in Identität v3 (Paket 2) – nur von Hand prüfbar

- **LB2 „Ruhig“ und „Modulfarben: Aus“:** Kartenköpfe, Plättchen und Miniaturen werden grau, Text bleibt lesbar. ☐
- **LB3 Schalter überall gleich:** ein Modul mit Einträgen auf der Karte und auf der Detailseite ausschalten: dieselbe Rückfrage „behalten/löschen“; ein leeres Modul: Hinweis mit „Rückgängig“. ☐

### Einrichtung

#### Einrichtungsassistent

EA-E3. _Wiederherstellung aus Backup:_ frische App → Schritt „Sync und Wiederherstellung“ → „Backup-Datei einspielen“ → Module/Daten sind da; danach Profile/Startdaten überspringen. ☐
EA-E4. _Bestehende Installation bleibt unberührt:_ Update einer App mit Daten: keine Willkommenskarte, keine Checkliste, Daten unverändert; Einstellungen → „Einrichtung starten“ zeigt den aktuellen Zustand, nichts wird ohne Bestätigung geändert (Profil zeigt erst den Diff). ☐

### Testdaten

#### Testdaten (Dev-Preview)

TS-T2. _Einstellungen → Entwickler → „Testdaten entfernen“:_ alle Testdaten sind weg, eigene Einträge (vorher angelegt) bleiben. Nach Neustart werden sie nicht erneut geladen. ☐
TS-T3. _Tresor:_ Accounts zeigt einen Demo-Tresor mit der Passphrase `nemo-demo-tresor`; ein vorhandener Tresor wird nie überschrieben. ☐
TS-T4. _Sync:_ Mit eingerichtetem Sync-Server werden Testdaten nicht übertragen (Server hat sie nicht); erst „Seed-Sync erlauben“ schickt sie. ☐
TS-T5. _Stabile App_ (`Nemo-Portable.exe`/`Nemo.apk`) hat keinen Bereich „Entwickler“ und keinen Palette-Befehl „Testdaten laden“. ☐

### Backup und Daten

#### Nemo: Umbenennung und Design

N6. _Alte Backups:_ eine `taschenmesser-backup-…json` (auch verschlüsselt) einspielen; neue Exporte heißen `nemo-backup-…`.

#### Zuletzt gelöscht (P5 Paket D)

ZG-G1. _Android/Windows:_ Unterlage mit Datei, ein Abo und einen Termin löschen; Einstellungen → Allgemein → „Zuletzt gelöscht“ zeigt alle drei mit „noch 30 Tage“. „Wiederherstellen“ bringt sie zurück (Datei der Unterlage ist da). ☐
ZG-G3. _Schalter „Gelöschtes 30 Tage aufbewahren“ aus:_ Liste verschwindet mit Hinweis; „Rückgängig“ direkt nach dem Löschen geht weiter. ☐

### Bedienung

#### Komfort-Review (`docs/product/comfort/`) – nur im Alltag und am Handy prüfbar

KO-K3. _Erweitert:_ pro Modul Basis lassen, einige Tage nutzen; fehlt im Basis-Formular etwas Wichtiges? „Alle Module Erweitert“ (Einstellungen) einmal an- und ausschalten. ☐

### Schnellerfassung und Befehlspalette

#### Befehlspalette lädt beim ersten Öffnen (nur von Hand prüfbar)

- **BP2 Erstes Öffnen online:** Palette öffnen und sofort tippen: kein verlorener Buchstabe, kein sichtbares Flackern. ☐

### Spracheingabe

#### Spracheingabe (nur von Hand prüfbar)

SE-V4. _Sprachen:_ App auf English stellen, sprechen: wird in der App-Sprache erkannt? ☐

### Tastenkürzel

#### Tastenkürzel (Kürzelkarte)

TK-K2. _Umbelegen:_ Einstellungen → Allgemein → Tastenkürzel: eine belegte Taste wird mit Text abgelehnt, F5/F11/F12 ebenso; nach „Entfernen“ bei Rechner lässt sich F9 für „Heute“ vergeben und wirkt sofort. ☐

### Erinnerungen und Benachrichtigungen

#### Optik-Politur und Benachrichtigungs-Zentrum (`fix/visual-polish-notifications`) – nur auf echter Hardware prüfbar

OP-V3. _Glocke:_ eine Erinnerung für „gleich“ anlegen, App offen lassen: es erscheint **kein** Banner; die Glocke zählt hoch; „Nächste Erinnerung“ / „Zufällige Erinnerung“, Erledigt, Später, „Alle gelesen“ ausprobieren; Tastatur (Tab, Esc) und Fokus zurück auf die Glocke. ☐

#### Stumm (Pause für Erinnerungen)

ST-M2. _Web Push:_ gleiche Prüfung mit geschlossener App und eingerichtetem Push: Benachrichtigung erscheint ohne Ton. ☐
ST-M3. _Extras:_ gestaffelte Erinnerung oder Tagesübersicht fällt in die Pause: kommt erst nach deren Ende. ☐

#### Erinnern-Zeile, Genommen, Ruhe (P5 Paket A)

EZ-A4. _Glocke:_ mehr als drei Erinnerungen in einer Stunde zeigen konkrete Titel (nicht „Weitere Erinnerungen · n“); Älteres liegt unter „Früher“. ☐

### Fokus

#### Fokus- und Aufmerksamkeitshilfen (Paket 1) – nur mit echtem Gerät und echtem Alltag prüfbar

FO-F4. _„Jetzt dran“ über einen Tag:_ Passt der Vorschlag morgens? Sind „Später“ und „Etwas anderes“ verständlich? Tagesplan mit 3 Dingen: zu viel, zu wenig? ☐
FO-F5. _Ruhiges „Jetzt wichtig“:_ Wirkt „Wartet noch“ beruhigend oder versteckt es zu viel? „Neu planen“ verteilt sinnvoll? Jede Hilfe lässt sich unter Einstellungen → Darstellung → „Fokus & Aufmerksamkeit“ einzeln ausschalten. ☐
FO-F9. _„Woran war ich?“:_ App 30 Minuten verlassen, zurückkommen: erscheint die Karte auf der Übersicht, führt „Weiter dort“ an die richtige Stelle? ☐
FO-F12. _Fortschritt im Alltag:_ eine tägliche Wiederholung anlegen und ein paar Tage abhaken: erscheint „n in Folge“, bleibt ein ausgelassener Tag ohne Drama („mit Pausentag“)? Abends „Tag abschließen“ und der Wochenrückblick: wirken sie motivierend statt drängend? Eine Vorlage („Aus Vorlage“ in Listen) einmal wirklich benutzen. ☐

### KI

#### KI-Eintragen per Leiste (PR A, nur von Hand prüfbar)

- **KL-K2 Statistik:** Einstellungen → KI → KI-Statistik: Regel-Antworten zählen mit 0 Token, Cloud-Antworten mit Token/Kosten; „x % ohne Cloud“ passt zu dem, was du getan hast.
- **KL-K3 Cloud-Fallback:** mit eingerichtetem Anbieter einen Satz schreiben, den die Regeln nicht kennen („Leg bitte etwas für die Steuerberaterin fest, sie meldet sich Freitag“): die Vorschau erscheint, Statistik zeigt eine Cloud-Antwort; mit „Cloud-Fallback erlauben“ aus erscheint stattdessen die normale Antwort.
- **KL-K4 Schalter:** „Einträge per KI vorschlagen“ aus: keine „Eintragen“-Option, kein „Mit KI eintragen“ im Modul; ein einzelnes Modul abgeschaltet: dafür kommt kein Vorschlag.

### Automatisierungen

#### Automatisierungen (Handtest)

- AU1 · Einstellungen → Darstellung → „In Arbeit anzeigen“ an; Einstellungen → Benachrichtigungen: „Automatisierungen“ und „Regel-Protokoll“ erscheinen. Hauptschalter ein, Vorlage „Rechnung bald fällig“ ein, Tage vorher 3; eine offene Rechnung mit Fälligkeit in 2 Tagen anlegen; nach höchstens zehn Minuten (und App offen) liegt eine Aufgabe „Rechnung … bezahlen“ in ToDos, die Erinnerung kommt als ruhige Benachrichtigung (Ruhezeiten und Limit gelten), das Protokoll zeigt den Lauf.
- AU2 · Im Protokoll „Rückgängig“ bei diesem Lauf: Aufgabe und Erinnerung sind weg; eine zwischendurch geänderte Aufgabe bleibt und wird gemeldet.
- AU3 · „Nur ausprobieren (Trockenlauf)“ an: gleiche Schritte schreiben nichts, das Protokoll sagt „Trockenlauf“.
- AU4 · Befehlspalette: „regel“ tippen → „Regel ausführen: …“ führt die Regel aus; „Letzte Regel-Ausführung rückgängig“ nimmt sie zurück.
- AU6 · Profil-Vorlagen („Arbeit am Morgen“, „Abends“) zur eingestellten Uhrzeit (App offen): Profil wechselt, Toast mit Rückgängig.

### Teilen

#### Mit Partner teilen: QR-Bilder (Kamera) – nur von Hand prüfbar

QR-Q3. _Firefox/Safari:_ dort steht „Dieser Browser kann QR-Codes nicht lesen. Nimm stattdessen die Datei.“, der Dateiweg geht. ☐
QR-Q4. _Kamera verweigert:_ ruhiger Hinweis, die Kamera bleibt aus, die Datei geht. Nach „Kamera ausschalten“ und beim Schließen der Seite erlischt die Kamera-Anzeige. ☐

### Kalender

#### Modul-Rahmen, Wetter und Musik (Branch `feat/module-shell-identity`) – nur auf Geräten prüfbar

- **PK1 Kalender-Ansichten:** Kalender → „Jahr“: zwölf Monate, Tag antippen öffnet die Tagesansicht; „Agenda“: nächste 30 Tage, nur Tage mit Einträgen. Einstellungen → Kalender → „Feiertage anzeigen“ → Bayern: Heilige Drei Könige 6.1. erscheint im Monat (unterstrichen/als Text), mit „Aus“ verschwindet er. ☐
- **PK2 Einzelner Termin einer Serie:** wiederkehrenden Termin öffnen → „Nur den Termin am … entfernen“: nur dieser Tag fehlt, Rückgängig stellt ihn wieder her, die Benachrichtigung dieses Tages bleibt aus. ☐
- **PK3 Als ToDo merken:** Termin öffnen → „Als ToDo merken“: Aufgabe im Eingang mit dem Datum als Fälligkeit (ToDos aktiv). Überschneidende Termine (Wochenansicht ≥ 1400 px) haben gestrichelten Rand. ☐
- **PK5 Mehrere Kalender:** „Mehr Felder anzeigen“ → „Kalender verwalten“: „Arbeit“ und „Familie“ anlegen/umfärben; Chips blenden Termine ein/aus; im Termin-Dialog das Feld „Kalender“; einen Kalender löschen: seine Termine bleiben sichtbar. ☐
- **PK6 Erinnerungen:** Zeitring zeigt „Nächste Erinnerung in …“; „Erledigte entfernen“ räumt nur Beendete/Pausierte auf (Rückgängig); Termin mit „Erinnern“ → „Zusätzlich erinnern“ (Mehr Felder): zwei Benachrichtigungen. ☐

### ToDos

#### Modul-Rahmen, Wetter und Musik (Branch `feat/module-shell-identity`) – nur auf Geräten prüfbar

- **TD1 Board im echten Browser:** ToDos → „Board“: eine Karte mit der Maus auf eine andere Spalte ziehen (Heute, Demnächst, Irgendwann, Erledigt); Rückgängig stellt sie zurück; das Ziehen geht auf Chrome und Firefox, auf Android funktioniert das „⋯“-Menü („Verschieben nach …“). ☐
- **TD2 Ansichten und Tags:** „Heute“, „Demnächst“, „Irgendwann“ zeigen je die richtigen Aufgaben; eine Aufgabe mit „Beginnt am“ in der Zukunft fehlt in „Alle“ und „Heute“ und steht unter „Demnächst“ („ab …“); Tag-Chips (unter „Mehr Felder anzeigen“) filtern. ☐
- **TD3 Checkliste, Verknüpfung, Projekt:** in der Aufgabe Checklistenpunkte anlegen/abhaken (Zähler in der Zeile); im Kalender „Als ToDo merken“: die Aufgabe hat „Termin: …“ und öffnet den Termin; eine Liste als „Projekt“ markieren zeigt den Fortschrittsbalken. ☐

### Gewohnheiten

#### Geld-Gruppe: Rechnungen (Paket 2)

- **PH2 Pausentag und Verlauf:** an einer Gewohnheit „⋯“ → „Pausentag“: die Karte wird grau, es kommt keine Erinnerung, im Verlauf ist der Tag schraffiert und die Quote („x von y geplanten Tagen“) sinkt nicht; „Pausentag aufheben“ stellt ihn zurück. ☐
- **PH3 Aus-Schalter:** Einstellungen → Gewohnheiten → „Erinnerungen“ aus: keine Benachrichtigung mehr, Ringe und Verlauf bleiben; Ruhige Zeiten verschieben die Erinnerungen wie bei anderen Modulen. ☐
- **PH4 Kopf und Widget:** Kopf zeigt je einen Ring pro heutige Gewohnheit (hell, dunkel, „Ruhig“, 412 px, mit Text); das Übersichts-Widget zeigt „x von y geschafft“ und „+1 …“. ☐

### Zeiterfassung

#### Geld-Gruppe: Rechnungen (Paket 2)

- **TT1 Start und Stopp:** Modul-Bibliothek → Zeiterfassung einschalten; Projekt anlegen (Name, Stundensatz); Chip „<Projekt> starten“ klicken: Kopf zeigt die laufende Stoppuhr (Sekunden), „Pause“/„Weiter“ und „Stopp“ funktionieren; „Ruhig“ / reduzierte Bewegung: nur Minuten, keine Sekunden. ☐
- **TT2 Leerlauf:** Zeit laufen lassen, Gerät länger als die eingestellte Zeit liegen lassen (Fenster wechseln/Sperrbildschirm), zurückkehren: Hinweis „Du warst … Min weg“ und die Frage mit drei Wahlmöglichkeiten; erst die Wahl ändert etwas („Als Pause abziehen“ erhöht die Pause, „Dort stoppen…“ beendet zur letzten Eingabe); Einstellung 0 = keine Frage. ☐
- **TT4 Aus dem Kalender:** Termin öffnen → „Zeit erfassen“: Zeit läuft mit dem Terminnamen als Notiz; ist Zeiterfassung aus, passiert nichts. ☐

### Uhr

#### Uhr (Paket 1, #615) – nur von Hand prüfbar

Vorbereitung: Einstellungen → Darstellung → „In Arbeit anzeigen“, Modul-Bibliothek → „Uhr“ einschalten, zwei Orte eintragen. Hintergrund: [features/clock.md](features/clock.md).
- **UH-U3 Minutenwechsel:** App 2 Minuten offen lassen: Seite, Widget und Logo-Uhr springen gleichzeitig zur vollen Minute; nach Standby/Bildschirm aus stimmt die Zeit sofort wieder. ☐
- **UH-U4 12-Stunden-Format:** Einstellungen → Sprache & Format → en-US: Seite und Widget zeigen „11:07 PM“ ohne Überlauf am Handy. ☐

### Finanzen

#### Verbindungen, Kalender, Kontoauszug (Phase 13, Schritt 3)

Braucht ein echtes Google-Konto bzw. eine echte Bankdatei – bitte nur mit eigenen Daten, nichts davon in den Chat kopieren:
GV-C7. _Kontoauszug:_ Online-Banking → Umsätze → Export „CSV-CAMT" (oder „CAMT"). **Bitte nur die Kopfzeile (erste Zeile) einer echten Datei prüfen/schicken** und mit `Buchungstag`, `Verwendungszweck`, `Beguenstigter/Zahlungspflichtiger`, `Betrag` vergleichen; dann Finanzen → Einstellungen → Startdaten → „Kontoauszug importieren": Vorschau, Import, zweiter Import zeigt nur „Schon vorhanden". Abos: „Abos im Kontoauszug erkennen" zeigt regelmäßige Abbuchungen. ☐

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM18 Bank, Person B:** echte Sparkassen-CSV-CAMT importieren, Export in Excel öffnen. (PR #580; vgl. GV-C7, GD-G5) ☐
- **GM19 Kontoauszug-Import je Bank:** OFX, QIF, Bank-Vorlagen und Spaltenzuordnung je Bank mit echter Datei ([features/bank-import.md](features/bank-import.md)). ☐

#### Geld-Gruppe: Finanzen (Paket 1)

- **GD-G1 Umbuchung:** Finanzen → Konten → „Umbuchung“ (oder Buchungen → „Mehr“ im Erweitert-Modus): von Girokonto auf Sparkonto 50 €. Beide Salden ändern sich, „Einnahmen“ und „Ausgaben“ des Monats nicht; die Zeile zeigt „Girokonto → Sparkonto“. Zeile öffnen, löschen: beide Hälften verschwinden, „Rückgängig“ bringt beide zurück. ☐
- **GD-G2 Aufteilen:** neue Ausgabe 50 €, „Mehr Felder“ → „Auf mehrere Kategorien aufteilen“, 32 € + 18 €: die Übersicht zählt beide Kategorien, die Liste zeigt „2 Kategorien“. Mit falscher Summe lässt sich nicht speichern (Hinweis „… zu verteilen“). ☐
- **GD-G3 Unterkategorie:** Kategorien → neue Kategorie mit „Oberkategorie“ und Symbol: sie erscheint eingerückt, die Übersicht rechnet sie in die Oberkategorie. ☐
- **GD-G4 Ausblick und Jahr:** Übersicht → Ausblick (zwei Sätze; „Mehr Felder anzeigen“ → „Details“): wiederkehrende Buchung, Abo-Abbuchungen und offene Rechnungen erscheinen mit Datum; „30 Tage“ / „90 Tage“ wechseln. Zeitraum „Jahr“: zwölf Monate, Sparquote. ☐

#### Backlog-Ernte (`chore/backlog-harvest-2026-11`) – nur auf Geräten prüfbar

- **BK3 CSV öffnen:** Finanzen → Export mit einer Buchung, deren Empfänger `=1+1` heißt, in Excel/LibreOffice öffnen: die Zelle zeigt den Text `'=1+1`, keine Berechnung. Passwort-Export (Bitwarden-Format) bleibt unverändert. ☐

### Rechnungen

#### Komfort-Review (`docs/product/comfort/`) – nur im Alltag und am Handy prüfbar

KO-K4. _Wiederkehrende Rechnung:_ Miete mit „Monatlich“ anlegen, bezahlen, Rückgängig; kommt genau eine neue? ☐

#### Geld-Gruppe: Rechnungen (Paket 2)

- **GD-G7 Teilzahlung:** Rechnung 100 € öffnen, Teilzahlung 40 €: „Noch 60,00 € offen“, die Liste zeigt „Teilweise bezahlt“, Finanzen hat eine Buchung −40 €. Zweite Teilzahlung über den Rest: die Rechnung ist „Bezahlt“, Summe der Buchungen = 100 €. Teilzahlung entfernen: Buchung weg, Rechnung wieder offen. ☐

### Abos

#### Geld-Gruppe: Abos (Paket 3)

- **GD-G13 Preisänderung:** zwei Buchungen mit gleichem neuem Preis für ein Abo (Empfängername enthält den Abo-Namen): unter „Jetzt wichtig“ erscheint „… bucht jetzt X statt Y“, ein Klick öffnet das Abo mit „Preis übernehmen“; ohne Klick ändert sich nichts. Einstellung „Preisänderung melden“ aus: kein Hinweis. ☐
- **GD-G14 Abbuchungen buchen:** Finanzen → Einstellungen „Abo-Abbuchungen als Ausgabe buchen“ an, App neu starten: fällige Abbuchungen der letzten 31 Tage sind gebucht (Hinweis mit „Rückgängig“), keine doppelte Buchung neben einem Bankimport; eine gelöschte Buchung kommt nicht wieder. ☐

#### Backlog-Ernte (`chore/backlog-harvest-2026-11`) – nur auf Geräten prüfbar

- **BK2 Kündigungsfrist in Monaten:** Abo mit Abbuchung am 31., Frist „3 Monate“: „Kündigen bis“ liegt auf dem 30. des Monats drei Monate davor (nicht 90 Tage davor). Ein Abo oder eine Unterlage, die vor dem Update „90 Tage“ als „3 Monate“ zeigte, zeigt nach dem Update weiter „3 Monate“ und rechnet kalendarisch; „45 Tage“ bleibt „45 Tage“. ☐

### Budgets

#### Geld-Gruppe: Budgets (Paket 4)

- **GD-G16 Warnung und Prognose:** Budget ab 50 % warnen: „Jetzt wichtig“ zeigt ruhig (nicht rot) „… % verbraucht“; liegt das Tempo über dem Limit, steht „Im bisherigen Tempo: etwa X über dem Budget“. Einstellung „Prognose zeigen“ aus: keine Zeile. ☐
- **GD-G17 Verlauf:** Budget öffnen: sechs Zeiträume mit Ausgaben und Limit, „Buchungen ansehen“ öffnet Finanzen im richtigen Monat. ☐
- **GD-G18 Sparziel-Plan:** Ziel mit „Geplante Rate“ und Zieldatum: Satz „Mit … im Monat bist du im … am Ziel“ und ob das zum Zieldatum passt (ohne Vorwurf). ☐

### Unterlagen und Fristen

#### Fristen (P5 Paket B)

FR-F1. _Android/Windows:_ Unterlage „Vertrag“ mit Ende in 3 Monaten und Frist 4 Monate anlegen: Liste „Frist vorbei am …“ (ruhig, kein Rot), Übersicht zeigt es gedämpft, Kalender „Frist vorbei: …“. ☐
FR-F2. _Abo jährlich mit Frist „3 Monate“:_ im Dialog steht „Kündigen bis …“ groß; Monatsabo hat kein 31-Tage-Feld, der Tag folgt dem Datum „Abbuchung am“. ☐

#### Löschen mit Rückgängig, Entwurf (P5 Paket C)

LU-U1. _Android/Windows:_ Unterlage mit Datei löschen: keine Rückfrage, Toast „Gelöscht · Rückgängig“; „Rückgängig“ bringt Eintrag und Datei zurück (Herunterladen geht). ☐

### Vorräte

#### Identität v3: Haushalt und Tresor (Paket 1) – nur von Hand prüfbar

- **HV2 Kacheln springen:** Auf eine Regal-Kachel im Kopf tippen → die Liste springt zum Abschnitt des Ortes (Tastatur: Enter).

### Personen

#### Links, Teilen, Lesezeichen (Phase 13, Schritt 6)

LT-L2. _WhatsApp:_ Personen → Knopf neben dem Namen → WhatsApp (Web/App) mit Glückwunschtext, Kontakt wählen. ☐

#### Haushalt & Tresor (Branch `feat/household-vault-identity`) – nur auf Geräten prüfbar

- **HT2 Kontakte-Datei:** Personen → Einrichtung/Import → „Aus Kontakte- oder Kalenderdatei“: eine .vcf aus Google Kontakte/iCloud und eine .ics eines Geburtstagskalenders; Vorschau prüfen, nichts doppelt. ☐
- **HT5 Geschenk aus Merkliste:** Merkliste → Menü → „Als Geschenkidee“ (Personen an), bei einer Person „Für … übernehmen“. ☐

### Packlisten

#### Haushalt & Tresor (Branch `feat/household-vault-identity`) – nur auf Geräten prüfbar

- **HT4 Wetter am Ziel:** Packliste mit Ziel (eine Stadt) und Datum in den nächsten 7 Tagen → „Wetter am Ziel prüfen“: erst der Hinweis „Verstanden“, dann Wort, Grad, Regen % und ein Packhinweis; ohne Netz die ruhige Meldung. ☐

### Karten und Orte

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM15 Eigene Karte, Overpass:** erste echte Overpass-Antwort auf einem Gerät: Suche → Ort → „Eigene Karte erzeugen“, „Genauer machen“, Straße suchen → „Aus deiner Karte“. (#342, #346, #348, #350, #352) ☐
- **GM16 Eigene Karte, Regionsdatei:** eine echte Regionsdatei (Planetiler/`pmtiles`) auf einem eigenen Host gegen den Leser. (#342–#352) ☐
- **GM17 Eigene Karte, Tempo:** Erlanger Karte löschen und neu erzeugen (Blöcke von vier Zellen, zwei Anfragen, Wartezeit vom Server); notieren, wie lange es dauert. (PR #387) ☐

#### Geld-Gruppe: Finanzen (Paket 1)

- **PM1 Orte-Liste:** Karten & Orte → Orte: Kategorie-Chips, Suchfeld und „Zuletzt/Name“ ändern die Liste; fixierte Orte stehen oben; „Navigieren“ öffnet den Ort in OpenStreetMap (Android: in der Karten-App deiner Wahl). ☐
- **PM2 Ort aus Termin:** Termin mit Ort öffnen → „Als Ort merken“: Karte-Tab mit dem Ort im Suchfeld; erst „Suchen“ fragt (zuerst eigene Karte), dann Treffer wählen → „Ort speichern“. ☐

### Tresor

#### Tresor: Abgleich mit Datenlecks (`feat/vault-breach-check`)

LK-1. _Aus (Standard):_ Tresor → „Passwörter prüfen“; Einstellungen → Verbindungen → Protokoll zeigt keine Anfrage an api.pwnedpasswords.com. ☐
LK-2. _An:_ Einstellungen → Sicherheit → Abgleich mit Datenlecks einschalten; Eintrag mit Passwort „password“ anlegen; „Passwörter prüfen“ → Eintrag steht unter „In einem bekannten Datenleck gefunden“; Protokoll zeigt Anfragen als „Tresor: Abgleich mit Datenlecks“ (nur Host, 5 Zeichen im Pfad werden nicht gespeichert). ☐
LK-3. _Netzwerk sperren:_ Sperre an → Prüfung zeigt „nicht verfügbar“, Stärke/Wiederverwendung/Alter erscheinen trotzdem. ☐

#### Haushalt & Tresor (Branch `feat/household-vault-identity`) – nur auf Geräten prüfbar

- **HT6 Tresor-Kopf:** Passwörter entsperren: „Entsperrt“ mit „Sperrt automatisch in etwa n Min.“, nach Inaktivität „Gesperrt“; Ruhig-Modus und „weniger Bewegung“: nichts bewegt sich. „Passwörter prüfen“ zeigt nur Titel, nie ein Passwort. ☐
- **HT7 Notfallblatt:** „Notfallblatt“ → „Als Datei speichern“, Datei öffnen und drucken: Schritte, Datum, Anzahl, kein Geheimnis. ☐

#### Identität v3: Haushalt und Tresor (Paket 1) – nur von Hand prüfbar

- **HV4 Tresor-Sperre:** Passwörter entsperren, ruhig liegen lassen: der Kopf zählt „sperrt in n Min.“ herunter und sperrt dann; Gruppen-Reiter bleiben nach dem Entsperren erhalten.

### Notizen

#### Notizen: Editor (`feat/notes-editor`) – nur auf echter Hardware prüfbar

- **NE-E3 Absturz:** Seite mit viel Text, Tab/Fenster hart beenden (Task-Manager), neu öffnen: Text ist da (ggf. Hinweis „wiederhergestellt“). ☐
- **NE-E7 Verlauf:** eine Seite zwei Minuten bearbeiten, „Verlauf“ zeigt frühere Stände, Wiederherstellen und mit Strg+Z zurück. ☐

#### Identität v3: Wissen (Paket 2) – nur von Hand prüfbar

- **WK1 Notizbuch-Reiter:** Notizen: Notizbuch-Reiter wählen, neues Notizbuch mit Farbe anlegen → der Reiter trägt die Farbe, Name und Zahl sind lesbar (hell und dunkel, Lesehilfe 75 %).

### Merkliste

#### Links, Teilen, Lesezeichen (Phase 13, Schritt 6)

LT-L4. _Lesezeichen:_ Merkliste → Lesezeichen → Startdaten; Kacheln (Gruppe = erster Tag) öffnen den Link im Browser; alter Pfad `/launcher` leitet dorthin um. ☐

#### Wissen, Medien, Dienste (Branch `feat/knowledge-media-depth`) – nur auf Geräten prüfbar

- **W6 Merkliste Linkvorschau:** „Linkvorschau laden“ einschalten, einen Link speichern: Seitenname, Beschreibung und Bild erscheinen in der Pinnwand-Ansicht; ausgeschaltet kommt nichts nach. ☐
- **W7 Lesemodus Merkliste:** Menü → „Im Lesemodus öffnen“ bei einem https-Link; der Eintrag wird „Angefangen“. ☐

### Feeds

#### Identität v3: Wissen (Paket 2) – nur von Hand prüfbar

- **WK3 Feeds-Titelseite:** Feeds: Aufmacher ist das zuletzt hinzugefügte Feed; Gruppen stehen in Spalten (breites Fenster) und untereinander (Handy).

### Chat

#### Identität v3: Wissen (Paket 2) – nur von Hand prüfbar

- **WK4 Sprechblasen:** Chat: eigene Nachricht rechts, Antwort links; lange Zeilen und Code brechen nicht aus der Blase aus.

### Import aus anderen Apps

#### Importer aus anderen Apps (Branch `feat/importers`)

- **IA1** Befehlspalette → „Aus anderer App importieren …“ → eine echte `.enex`-Datei aus Evernote wählen: Erkennung „Evernote“, Vorschau, Bericht mit Anhängen; „Rückgängig“ entfernt alles.
- **IA2** Ein Obsidian-Ordner als ZIP (Windows: Rechtsklick → Senden an → ZIP): Notizbücher aus Ordnern, `.obsidian` fehlt in der Vorschau, Bilder werden im Bericht gezählt.
- **IA3** Google Takeout (Kalender + Keep + Aufgaben) als ZIP: drei Teile nacheinander („Teil 1 von 3“), je eigene Vorschau.
- **IA4** Große Datei (> 50 MB Text oder viele Tausend Notizen): Fortschritt sichtbar, „Abbrechen“ mittendrin lässt nichts zurück (Notizen-Zähler unverändert).
- **IA5** Echte Exporte prüfen (Kopfzeilen sind je Version/Sprache verschieden): Outlook-Aufgaben-CSV (deutsch und englisch), KeePassXC- und 1Password-CSV im Tresor-Import; unbekannte Kopfzeile melden.

#### Backlog-Ernte (`chore/backlog-harvest-2026-11`) – nur auf Geräten prüfbar

- **IA6** Notion → Einstellungen → Exportieren → „Markdown & CSV“ (mit Unterseiten): ZIP über „Aus anderer App importieren“ wählen: Titel ohne Kennung, Verweise als `[[…]]`, Eigenschaften oben im Text, Bilder im Bericht gezählt; echte Exporte weichen je Version ab, Abweichungen melden.
- **IA7** Feeds → „Importieren“ mit einer echten OPML-Datei aus einer Podcast-/Feed-App (Gruppen, Umlaute, sehr viele Abos): Vorschau, Bericht; danach „Als OPML exportieren“ und die Datei in der anderen App wieder einlesen.

### Wetter

#### Wissen, Medien, Dienste (Branch `feat/knowledge-media-depth`) – nur auf Geräten prüfbar

- **W5 Wetter-Hinweis (Gerät):** „Bei Unwetter benachrichtigen“ einschalten, bei einer echten Hitze/Sturm-Vorhersage kommt morgens oder am Vorabend genau eine Benachrichtigung; „Jetzt wichtig“ zeigt den Hinweis auch ohne den Schalter. ☐

#### Modul-Rahmen, Wetter und Musik (Branch `feat/module-shell-identity`) – nur auf Geräten prüfbar

- **MR-M4 Wetterhinweis und Himmel:** echten Ort wählen: der Himmel passt zu Wetter und Tageszeit (nachts hell auf dunkel). Bei Gewitter/Sturm in der Vorhersage erscheint oben ein Hinweis mit dem Satz „keine amtliche Warnung“. Zweiten Ort über „Ort hinzufügen“ ergänzen, per Chip umschalten, mit × entfernen. ☐

### Werkzeuge

#### Werkzeuge (Phase 13, Schritt 5)

WZ-T1. _QR lesen:_ Werkzeuge → QR-Code → „Lesen" → Kamera erlauben → einen QR-Code halten: Text erscheint (Windows-App/Chrome: `BarcodeDetector`; auf dem Handy Kamerarecht in der APK). Wo es nicht geht, steht ein Hinweis; Erzeugen geht immer. ☐
WZ-T2. _Währung:_ mit Internet: Kurse laden, umrechnen; danach Netz aus → gespeicherte Kurse mit Datum. Die Schnittstelle `api.frankfurter.dev` ist nur per Doku geprüft (in der Windows-App keine CORS-Hürde, im Browser hängt es an deren CORS-Erlaubnis). ☐

#### Rechner-Modi (Branch `feat/calculator-modes`)

RM-C2. _Offline:_ App einmal online öffnen, Flugmodus, Rechner öffnen: Wissenschaft (sin, log) geht nur, wenn der Rechner vorher online geöffnet war; sonst Grundrechenarten und der ruhige Hinweis. ☐
RM-C3. _Sprachen:_ Format-Region auf en-US stellen: `1,234.5 + 1` und `1.234,5 + 1` ergeben beide 1235.5, Ergebnis mit Punkt als Dezimalzeichen. ☐
RM-C4. _Notiz:_ Notizen einschalten, Verlauf → „In Notiz übernehmen“ öffnet eine neue Notiz mit den Zeilen. ☐

#### Rechner-Plotter (Branch `feat/calc-plotter`)

PL2. _Offline vor dem ersten Gebrauch:_ ohne vorherigen Online-Start des Rechners zeigt der Plotter die ruhige Fehlermeldung statt eines Graphen (die Bibliothek ist nicht im Vorab-Cache). ☐

#### Anonyme Persona (Branch `feat/tool-anonymous-persona`)

AP1. _Wegwerf-Mail:_ Werkzeug in der Bibliothek einschalten, „Wegwerf-Mail öffnen“ mit jedem der drei Anbieter: die Seite öffnet sich im Browser (Android: im Standardbrowser, Windows: im Standardbrowser), Nemo füllt nichts aus. ☐
AP2. _Notiz:_ Notizen einschalten, „Als Notiz speichern“ öffnet eine neue Notiz mit allen Zeilen, auch dem Passwort. ☐
AP3. _Telefon:_ Deutschland: die Nummern stehen im Bereich 030 23125…, 040 66969…, 089 99998…, 0221 4710…, 069 90009…; kein Anschluss meldet sich. USA: +1 … 555 01xx. ☐
AP5. _Einstellungen:_ Einstellungen → Werkzeuge → „Anonyme Persona“: Anbieter ändern; im Werkzeug zeigt „Wegwerf-Mail öffnen“ den gleichen Anbieter und öffnet dessen Seite. ☐
AP6. _Tresor:_ Tresor und Werkzeug einschalten, „Im Tresor speichern“ (bei gesperrtem Tresor erst entsperren): das Formular „Zugang hinzufügen“ ist mit Name, Benutzername, Passwort und Notizen gefüllt, nach „Speichern“ liegt der Eintrag verschlüsselt im Tresor; nach einem Neuladen öffnet `/accounts?handoff=1` kein Formular mehr. ☐

#### Werkzeuge: Panel (Handtest)

- TP2 · PWA im Browser und installiert: „In eigenem Fenster öffnen“ öffnet das Werkzeug allein in einem kleinen Fenster (Popup-Blocker erlaubt?), Rechnen dort funktioniert, das Fenster lässt sich schließen; in der Windows-App fehlt der Knopf.
- TP4 · Hell/Dunkel, „Ruhig“ und „Modulfarben: Aus“: die Werkzeugfläche wird grau, Plättchen und Zeichen bleiben erkennbar.
- TP5 · Rechner am Handy und mit der Maus: Zahlenblock tippt in das Display (7 × 6 = 42), Komma/Punkt je nach Sprache, „⌫“ löscht; Tasten fühlen sich gedrückt an, auch mit „Weniger Bewegung“ ohne Verzögerung.
- TP6 · Timer: der Ring läuft mit (Timer und Pomodoro leeren sich, die Stoppuhr füllt pro Minute), die Zeit in der Mitte ist gut lesbar in hell/dunkel; Einheiten und Währung: großes Ergebnis, „Ergebnis kopieren“ legt es in die Zwischenablage.
- TP7 · Persona: die Karte zeigt Initialen, Namen und „Erfunden“ im Rahmen, Hinweis „nicht für Verträge, Banken, Behörden“ bleibt; Würfel: mehrere Würfel zeigen je eine Fläche, ein Screenreader liest „3, 5“; QR: Vorschau groß und scannbar (Handykamera) in hell und dunkel; Dev/Diff/Regex lesen sich in der Code-Optik gut.

## Website

Die öffentliche Website und die GitHub-Seite.

### GitHub-README

#### Nemo: Umbenennung und Design

N12. _README auf GitHub im hellen und dunklen Modus:_ Header-Bild und Dashboard-Screenshot wechseln mit (`<picture>`), Badges lesbar, beide Download-Buttons liefern die Dateien (erst nach dem Nemo-Kopien-Upload zu v0.2.0 bzw. dem nächsten stabilen Release). ☐

### Website

#### Handtests aus gemergten PRs (aus CHATS.md gesammelt, 2026-11-10)

- **GM21 Hero und Anker-Leiste:** Seite scrollen: die Leiste mit den vier Links + GitHub bleibt oben, das Hero-Bild blendet einmal ein (mit „Bewegung reduzieren“ nicht). (PR #674) ☐
- **GM22 Rest der Seite:** Vorschau einmal ganz durchscrollen. (PR #685) ☐
- **GM23 Eingefrorene Sprachen:** `/es`, `/fr`, `/pt-br` leiten auf `/en`. (PR #507) ☐

## Konten nötig (Google, Spotify, Ko-fi)

Braucht ein echtes Konto; nur mit eigenen Daten, nichts davon in den Chat kopieren.

### Google

#### Verbindungen, Kalender, Kontoauszug (Phase 13, Schritt 3)

Braucht ein echtes Google-Konto bzw. eine echte Bankdatei – bitte nur mit eigenen Daten, nichts davon in den Chat kopieren:
GV-C1. _Kalender-Abo (ICS):_ Einstellungen → Verbindungen → Kalender-Abo: „Geheime Adresse im iCal-Format" deines Google-Kalenders eintragen. Im Browser (PWA) braucht das den Sync-Server (Proxy), in der Windows-App geht es direkt. Termine erscheinen im Kalender mit Badge „Extern", sind nur lesbar; Adresse entfernen → Termine verschwinden. ☐
GV-C2. _Google-Login (nur Windows-App):_ eigene Client-ID/Secret eintragen (siehe unten), „Verbinden" → der Browser öffnet die Google-Anmeldung → nach „Zulassen" erscheint die Seite „Die Anmeldung ist abgeschlossen" und die Karte zeigt „Verbunden". Bei einer unverifizierten App zeigt Google eine Warnung („Google hat diese App nicht überprüft" → „Erweitert" → „… öffnen"). ☐
GV-C3. _Kalender-Sync:_ nach dem Login erscheint die Liste deiner Kalender (nur der Hauptkalender ist angehakt); „Jetzt abgleichen" holt die Termine. Termin in Google ändern/löschen → nach „Jetzt abgleichen" (oder spätestens nach 30 min) auch hier. Zeiten stimmen (Zeitzone!), ganztägige und mehrtägige Termine ebenfalls. ☐
GV-C4. _Ablauf des Tokens:_ Status „Testing" in der Google Cloud Console → nach 7 Tagen zeigt die Karte „Abgelaufen" + „Neu anmelden"; lokale Termine bleiben. („In Produktion" vermeidet das.) ☐
GV-C5. _Gmail-Scan:_ Feature „E-Mails" einschalten (neuer Login mit mehr Rechten), dann in Rechnungen/Abos/Unterlagen/Kalender „… aus E-Mails erkennen" → Zeitraum wählen → Vorschau prüfen. Es darf nur passieren, was du bestätigst; der Vorschau-Text nennt „N Mails gelesen (Absender, Betreff, Datum, Vorschauzeile)". Prüfe, ob die Erkennungsquote brauchbar ist (Heuristiken sind auf erfundenen Beispielen getestet, nicht auf echten Mails). ☐
GV-C6. _Trennen:_ „Trennen" → Dialog „Termine behalten / löschen"; danach ist der Zugriff in deinem Google-Konto unter „Sicherheit → Drittanbieter-Zugriff" verschwunden. ☐

#### E-Mail lesen (Modul „E-Mail“, `feat/mail-read`) – nur mit echtem Google-Konto auf Windows prüfbar

ML-M1. In Einstellungen → Verbindungen Google verbinden, Funktion „E-Mails" einschalten; Modul „E-Mail" in der Bibliothek aktivieren. Der Posteingang zeigt deine Threads, die Ordnerliste (Posteingang, Markiert, eigene Labels) hat Ungelesen-Zahlen. ☐
ML-M2. Suche mit Gmail-Syntax (`from:… has:attachment newer_than:7d`) liefert dasselbe wie in Gmail. ☐
ML-M3. Eine HTML-Mail öffnen (Newsletter): Bilder sind blockiert („N externe Bilder blockiert"), „Bilder laden" lädt sie; ein Link öffnet im Standardbrowser, nicht im Fenster. Prüfe, dass die Mail im Gmail-Web weiterhin **ungelesen** ist (Nemo ändert nichts). ☐
ML-M4. Anhang herunterladen und öffnen (PDF, Bild). Mail mit eingebettetem Logo (`cid:`) zeigt das Logo. ☐
ML-M5. Zweites Google-Konto hinzufügen (Verbindungen → „Weiteres Konto hinzufügen"): im Mail-Modul erscheint eine Kontoauswahl. ☐
ML-M6. Netz aus: die zuletzt gesehenen Köpfe erscheinen mit dem Hinweis „Kein Netz". Token widerrufen (Google-Kontoeinstellungen): Hinweis „abgelaufen" mit Link zu den Verbindungen. ☐
ML-M7. Mail-Einstellungen → „Zwischenspeicher leeren"; danach ist die Liste erst nach dem Laden wieder gefüllt. Der Cache ist nicht im Sync (zweites Gerät zeigt nichts davon) und nicht im Backup. ☐
ML-M8. Das HTML-Fenster funktioniert im Windows-Fenster (WebView2) wie im Browser: Mail wird angezeigt, kein Skript läuft. ☐
ML-M9. (Paket 2, `feat/mail-link`) Eine echte Rechnungsmail öffnen → „Aus dieser Mail anlegen" → Rechnung: Empfänger, Betrag und Fälligkeit sind vorbefüllt (stimmen sie bei deinen Mails?). Es wird erst mit „Speichern" etwas angelegt; die Rechnung enthält den Link zur Mail (öffnet die Mail im Browser). ☐
ML-M10. Dasselbe für Termin (Datum/Uhrzeit aus einer Einladung), ToDo, Erinnerung (morgen 9:00), Merkliste, Notiz. Bei der Notiz kommt der Mailtext nur mit dem Häkchen hinein. In der Mail steht danach „Aus dieser Mail angelegt" mit Link in das Modul; löschst du den Eintrag, verschwindet der Verweis. ☐
ML-M11. (Paket 3, `feat/mail-write`) Verbindungen → Google: „E-Mails verwalten" und „E-Mails senden" sind aus, jede mit Erklärung. Nur „verwalten" einschalten, „Neu anmelden": Google zeigt die zusätzliche Berechtigung an. Im Mail-Modul erscheinen Archivieren, Papierkorb, „Weitere Aktionen"; Antworten und „Neue Mail" nur mit Entwurf (kein Senden-Knopf). ☐
ML-M12. Als gelesen/ungelesen markieren wirkt sofort (in Gmail prüfen) und lässt sich in den 6 s zurücknehmen. Archivieren, Label setzen, Papierkorb fragen vorher; „Rückgängig" holt den Verlauf zurück (Papierkorb: auch in Gmail wieder im Posteingang). ☐
ML-M13. „E-Mails senden" zusätzlich einschalten, neu anmelden. Neue Mail an dich selbst: „Weiter zum Senden" → Prüfansicht → „Senden bestätigen" → 10 s Wartefenster: „Zurückziehen" bringt den Text zurück (nichts gesendet, in Gmail prüfen); beim zweiten Mal bis zum Ende warten, die Mail kommt an. Antworten bleibt im selben Verlauf (Gmail zeigt es als Antwort), Umlaute und Anhang (PDF, Bild) kommen richtig an. ☐
ML-M14. Entwurf speichern → erscheint in Gmail unter „Entwürfe"; im Mail-Modul „Entwurf bearbeiten", ändern, speichern (kein zweiter Entwurf), senden (der Entwurf verschwindet). ☐
ML-M15. Berechtigung in den Google-Kontoeinstellungen widerrufen: jede Aktion meldet „Dafür fehlt eine Berechtigung" mit Link zu den Verbindungen, es wird nichts geändert oder gesendet. ☐
ML-M16. (Paket 4, `feat/mail-notify`) Modul-Einstellungen E-Mail: „Bei neuen Mails benachrichtigen" ist aus. Einschalten (Windows-Benachrichtigungen für Nemo erlauben), Abstand 5 Minuten. Nach dem ersten Nachsehen kommt **keine** Meldung für alte Mails. Schick dir eine Mail: nach spätestens 5–6 Minuten erscheint „1 neue E-Mail" (ohne Absender, ohne Betreff). Mit „Absender zeigen" steht der Name dabei. ☐
ML-M17. Mail anderswo lesen, bevor die Meldung kommt: es kommt keine. Mehrere Mails in einem Abstand: eine Meldung mit der Anzahl. In den Ruhezeiten (Einstellungen → Benachrichtigungen) kommt sie erst nach deren Ende. Nur die gewählten Labels zählen (Dialog „Mail-Einstellungen" → Labels). Bei ausgeschalteter App/Netz kommt nichts, und es entsteht kein Stau von Meldungen beim Wiedereinschalten (höchstens eine). ☐
ML-M18. Einstellungen → Mail → „Lokales Modell darf Mails lesen" einschalten, ohne geladenes Modell: „Kurz zusammenfassen" zeigt „Kein lokales Modell bereit" mit Link zu den KI-Einstellungen, es geht nichts ins Netz. Eingebautes Modell laden: Zusammenfassung erscheint, Hinweis „Wird nicht gespeichert", nach „Schließen" und Neuöffnen ist sie weg. ☐
ML-M19. Nur Ollama auf `localhost` konfiguriert: Zusammenfassung funktioniert. Ollama-Eintrag auf eine LAN-Adresse oder Cloud-Preset: keine Antwort, Hinweis „Kein lokales Modell bereit"; im Netzwerk-Mitschnitt keine Anfrage an einen fremden Host. „Aus dieser Mail anlegen" → „Vorschlag vom lokalen Modell": Feld ändert sich erst nach „Übernehmen". ☐

#### Einrichtungsassistent

EA-E5. _Google-Verbindung im Assistenten (Windows):_ Schritt „Konten verknüpfen“ → Anmeldung starten und im Browser abbrechen bzw. den Assistenten schließen: kein Token gespeichert, Status bleibt „Nicht verbunden“. ☐

#### Sprachen (App auf Deutsch und Englisch; es/fr/pt-BR eingefroren)

- **SP-S4 – native Texte (Windows):** Google-Anmeldung abschließen → die Ergebnisseite im Browser erscheint in der Browsersprache; ohne WebView2 erscheint der Hinweis in der Windows-Sprache.

#### Wissen, Medien, Dienste (Branch `feat/knowledge-media-depth`) – nur auf Geräten prüfbar

- **W1 E-Mail echt (Windows):** mit einem echten Gmail-Konto (`mail-modify` an): ab 1200 px stehen Ordner, Liste und Lesebereich nebeneinander; „Als gelesen markieren“ und „Archivieren“ aus dem Zeilenmenü, „Rückgängig“ im Hinweis; Suchfeld schlägt frühere Suchen und Absender vor. ☐

#### Automatisierungen (Handtest)

- AU5 · Mail-Konto verbunden und „Neue Mails melden“ an, Vorlage „Rechnung per Mail“ ein: eine Rechnungs-Mail erzeugt unter „Vorschläge“ einen Eintrag; „Prüfen“ zeigt die Vorschau, erst „Eintragen“ speichert.

#### Identität v3: Medien und Dienste (Paket 3) – nur von Hand prüfbar

- **MD1 Mail-Spalten (Windows-App):** E-Mail mit verbundenem Konto: bei breiter Seite stehen Ordner, Liste und Lesefenster nebeneinander, beim Verkleinern des Fensters oder Einblenden der Seitenleiste wechselt es zur Liste mit Mail darüber; der offene Ordner ist ein gefüllter Chip.
- **MD2 Umschlag:** der Umschlag im Kopf zeigt keine Zahlen und keinen Mailtext; die Briefmarke daneben trägt die Zahl der ungelesenen Mails.

### Spotify

#### Links, Teilen, Lesezeichen (Phase 13, Schritt 6)

LT-L5. _Spotify:_ gebaut als Verbindung mit „Läuft gerade“-Zeile (Handtests S1–S4 unten bei „Spotify“). ☐

#### Spotify-Verbindung (Windows-App, eigenes Spotify-Konto) – nur von Hand prüfbar

Vorher: App im Developer Dashboard anlegen, Redirect-URI `http://127.0.0.1:38417/callback`, eigenes Konto unter „User management“, Client ID in Nemo einfügen ([user/spotify.de.md](user/spotify.de.md)).
S1. _Echter Login:_ Einstellungen → Verbindungen → Spotify → Verbinden: Browser öffnet Spotify, nach „Zustimmen“ zeigt die Ergebnisseite „Anmeldung ist abgeschlossen“, Status „Verbunden“. Spiele in Spotify etwas ab: auf der Übersicht erscheint binnen etwa 30 s „Läuft gerade: Titel – Interpret“; der Titel öffnet Spotify im Browser. Spotify stoppen: die Zeile verschwindet. ☐
S2. _Pause/Weiter/Nächster (Premium-Konto):_ Knöpfe in der Zeile steuern den Player (Pause → „Pausiert: …“, Weiter, Nächster wechselt den Titel). Nemo minimieren: keine regelmäßigen Anfragen (die Zeile fragt nur bei sichtbarer App). ☐
S3. _Ohne Premium (kostenloses Konto):_ Pause klicken: einmal Hinweis „Steuern braucht Spotify Premium.“, Knöpfe weg, Anzeige bleibt; nach Neustart keine Knöpfe, kein zweiter Hinweis. ☐
S4. _Port belegt:_ ein anderes Programm auf Port 38417 starten (z. B. `python -m http.server 38417 --bind 127.0.0.1`), Verbinden klicken: Meldung „Port belegt …“, der Browser öffnet sich nicht; Programm beenden, erneut Verbinden klappt. Danach Trennen: Zeile weg. ☐
S5. _Musik in der Fokus-Runde (Premium-Konto, Spotify offen auf dem PC):_ beim Verbinden „Playlists“ ankreuzen; Einstellungen → Fokus & Aufmerksamkeit → Weitere Einstellungen → „Musik in der Fokus-Runde“ → „Playlist starten“, eine Playlist wählen. Fokus-Runde starten: die Playlist beginnt; „Fertig“ oder Zeit um: Pause. Spotify schließen und neu starten: Runde läuft normal weiter, Zeile „Musik: nicht erreichbar“. Mit „Beim Start weiterspielen“: pausierte Wiedergabe läuft los, nichts Neues startet. ☐
S6. _Spotify in der PWA (Handy oder PC im Browser, https-Adresse):_ im Developer Dashboard zusätzlich `<deine Nemo-Adresse>/oauth/callback` als Redirect-URI eintragen (steht auch auf der Spotify-Karte); Client-ID speichern, „Verbinden“: die Seite wechselt zu Spotify und kommt zurück, Karte zeigt „Verbunden“, „Läuft gerade“ erscheint. Falls es nach der Rückkehr „Fehler“ zeigt: Browserkonsole auf CORS-Meldungen für `accounts.spotify.com/api/token` oder `api.spotify.com` prüfen und melden. ☐
S7. _Spotify-Player (echtes Konto, Premium, Spotify offen):_ beim Verbinden „Playlists“, „Lieblingssongs“ und „Zuletzt gehört“ ankreuzen. Karte „Läuft gerade“ antippen: Playlist öffnen (alle Titel, Cover, Dauer) – es spielt nichts; Titel antippen: er spielt, danach geht die Playlist weiter. ♥ bei einem Titel: er erscheint in Spotify unter „Lieblingssongs“; nochmal tippen: weg. ⋯ → Warteschlange: der Titel kommt als Nächstes/danach. Titel ausblenden: er verschwindet nur hier, in Spotify bleibt er; „Abspielen“ überspringt ihn. Geräte-Menü: Wiedergabe wechselt auf ein anderes Gerät. Falls Playlist-Inhalte leer bleiben: Spotify hat die Playlist-Felder geändert, bitte melden (Parser: `connectors/spotify/browse.ts`). ☐

#### Wissen, Medien, Dienste (Branch `feat/knowledge-media-depth`) – nur auf Geräten prüfbar

- **W2 Spotify Playlists (PWA/PC):** in Verbindungen „Playlists bearbeiten“ einschalten (neue Anmeldung), im Track-Menü „Zu Playlist hinzufügen …“: bestehende Liste und neue Liste; prüfen, ob `/items` oder der Rückfall `/tracks` greift; Tastenkürzel (Leertaste, Umschalt+←/→, L, /) und ihr Schalter in den Modul-Einstellungen. ☐

#### Modul-Rahmen, Wetter und Musik (Branch `feat/module-shell-identity`) – nur auf Geräten prüfbar

- **MR-M2 Spotify ohne Gerät (Windows und Android):** Spotify auf allen Geräten beenden, Modul „Musik“ öffnen: „Gerade läuft nichts“, die Geräteliste, „Spotify-App öffnen“ (öffnet die App, wenn das System das `spotify:`-Schema kennt, sonst nichts Schlimmes) und „Im Browser öffnen“ (Webplayer). Ein Gerät mit „Hier abspielen“ wählen: Musik startet dort. Ohne Premium steht der Hinweis, ohne die Knöpfe. ☐
- **MR-M3 Coverfarbe:** Titel mit sehr hellem und mit sehr dunklem Cover abspielen: der Kopf der Musik-Seite wird in der Coverfarbe getönt, die Schrift bleibt gut lesbar (hell und dunkel). ☐
- **MR-M6 Musik schaltet sich beim Verbinden ein:** Spotify unter Verbindungen verbinden: „Musik“ ist danach aktiv (Hinweis „Jetzt aktiv“), erscheint unter Wissen und als Widget. Wer „Musik“ in der Bibliothek ausgeschaltet hat und neu verbindet, bekommt es nicht wieder eingeschaltet. ☐

#### Identität v3: Medien und Dienste (Paket 3) – nur von Hand prüfbar

- **MD3 Musik:** Warteschlange neben der Liste, sobald die Seite breit genug ist; Cover-Kopf unverändert.

### Ko-fi (Supporter)

#### Supporter-Modus (nur mit echter Zahlungsseite und Dienst prüfbar)

Voraussetzung: Schlüsselpaar erzeugt, `publicKeys.ts` im Build, Webhook-Dienst deployt ([services/supporter-webhook/README.md](../services/supporter-webhook/README.md)). Ohne Dienst gehen Codes per CLI (`create`).
SU-S1. _Test-Spende mit kleinem Betrag_ bei Ko-fi: Mail mit Code (Deutsch und Englisch) kommt an, nicht im Spam; Absender und Inhalt stimmen, Hinweis „freiwillig“ steht drin. ☐
SU-S2. _Code auf dem PC:_ Einstellungen → Über Nemo → Supporter, Code einfügen: Stufe, Name, Datum stimmen; Danke-Abzeichen in Über Nemo; Farbthemen wählbar; Logo in Themenfarbe. ☐
SU-S3. _Code auf Android:_ derselbe Code auf dem Handy eingeben (Einfügen-Knopf geht oder Direkteinfügen im Feld); Themes sehen auf dem Display gut aus (hell und dunkel). ☐
SU-S4. _Sync:_ Code nur auf einem Gerät eingeben; nach dem Sync zeigt das zweite Gerät denselben Status. Code entfernen: auch dort weg. ☐
SU-S5. _Themes:_ alle fünf in Hell und Dunkel durchklicken (Lesbarkeit, Fokusring sichtbar, Formulare erkennbar); ohne Code: 30-Sekunden-Vorschau endet von selbst, nichts bleibt gespeichert. ☐
SU-S6. _Duplikat-Webhook:_ in Ko-fi „Send test“ zweimal oder dieselbe Transaktion erneut senden: derselbe Code kommt wieder, kein neuer. ☐
SU-S7. _Mailfehler:_ Resend-Schlüssel kurz falsch setzen, Spende auslösen: nach den Wiederholungen kommt die Benachrichtigung an die Entwickleradresse (mit Hash-Kürzel, ohne Spender-Mail). ☐
SU-S8. _Entwickler-Code:_ `create --tier developer --name "Sven"` eingeben: Badge „Entwickler“, entfernbar, neu erzeugbar. ☐

## Anleitungen für Sven (aus STATUS verschoben, 2026-10-02)

> **Stand v0.3.1:** Die Schritte 1, 5 und 7 stammen aus der Beta-Phase (`0.2.0-beta.x`); die Tags `v0.2.0`, `v0.3.0`, `v0.3.1` sind inzwischen veröffentlicht, das neueste stabile Release ist `v0.3.1`. Sinngemäß heute: neueste Version von der Release-Seite installieren, für den Update-Test später ein neues Release schneiden (Rezept: [howto/release-deps.md](howto/release-deps.md)); der Text unten bleibt als Ablauf erhalten.

Installation und Update auf echten Geräten (Windows und Android) – Schritt für Schritt:

1. **Dateien holen (Pre-Release).** GitHub → Repository → _Releases_ → das neueste Pre-Release. Die README-Badges („Windows (portabel) herunterladen" …) zeigen auf das _neueste stabile_ Release und funktionieren erst, wenn es ein stabiles Release gibt – bis dahin die Dateien direkt von der Release-Seite laden: `Nemo-Portable.exe` (Windows) und `Nemo.apk` (Android); die `Taschenmesser-*`-Dateien im selben Release sind identische Kopien für alte Installationen. Prüfsumme optional: `Nemo.apk.sha256`.
2. **Von der installierten Windows-Version umsteigen (einmalig, `0.2.0-beta.1` kann sich nicht selbst auf die portable Datei aktualisieren).** (a) Alte App: Einstellungen → Backup → exportieren. (b) `Nemo-Portable.exe` in einen beschreibbaren Ordner legen und starten (SmartScreen: „Weitere Informationen" → „Trotzdem ausführen"; die Datei hat kein Authenticode-Zertifikat, der Update-Inhalt ist mit dem Updater-Key signiert). Die Daten sind sofort da. (c) Alte Version deinstallieren – **„Anwendungsdaten löschen" nicht ankreuzen.** Einstellungen → „App-Updates" zeigt die Version.
3. **Android installieren.** `Nemo.apk` aufs Handy laden und öffnen. Beim ersten Mal „Installation aus unbekannten Quellen" für den Browser/Dateimanager erlauben, dann installieren. Öffnen → Einstellungen → „App-Updates" zeigt die Version. (Vorherige Debug-/anders signierte Version vorher deinstallieren.)
4. **Etwas Testdaten anlegen** (ein ToDo, eine Notiz, ein KI-Anbieter, optional ein Tresor-Eintrag), damit man nach dem Update sieht, dass nichts verloren geht.
5. **Nächstes Pre-Release erzeugen (der Update-Test).** Auf deinem Rechner im Repo: `cd web && npm run version:set -- 0.2.0-beta.3`, dann `git commit -am "chore(release): 0.2.0-beta.3"`, `git tag v0.2.0-beta.3`, `git push origin develop v0.2.0-beta.3`. Der Workflow _Release_ baut, prüft (Secret-Scan + Artefakt-Audit), veröffentlicht und prüft danach alle Download-Links (~15 Min.; Fortschritt unter _Actions_). Oder sag mir Bescheid, dann mache ich das.
6. **In der portablen App aktualisieren.** Einstellungen → „App-Updates" → Kanal **Beta** wählen → „Jetzt prüfen" → Banner „Update verfügbar" mit Änderungsliste → „Jetzt aktualisieren".
   - _Windows:_ Backup (`%APPDATA%\io.github.sgnemo.taschenmesser\backups\pre-update-…json`), Download, Signaturprüfung, die exe ersetzt sich selbst und startet neu. Version stimmt, Daten sind da. ☐
   - _Android:_ Backup → Download → Android-Installer öffnet sich → „Aktualisieren". Beim ersten Mal ggf. „Installation aus dieser Quelle erlauben" aktivieren, zurück in die App und nochmal „Jetzt aktualisieren". Danach neue Version, Daten sind da. ☐
7. **Stabil-Kanal prüfen (optional).** Kanal „Stabil" zeigt die Beta nicht an; erst ein Tag `v0.2.0` (ohne Suffix) wird dort angeboten, und die README-Download-Badges gehen dann.
8. **Rückmeldung.** Klappt etwas nicht: Fehlermeldung/Screenshot und Gerät nennen. Die Update-Logik ist Unit-getestet, aber Austausch der laufenden exe, Installer-Übergabe (Android) und Signaturprüfung sind erst hier real geprüft. Danach die Checklisten in [MANUAL-TESTS.md](MANUAL-TESTS.md) durchgehen.

9. **Einrichtungsassistent prüfen.** Die Punkte EA-E1–EA-E5 in [MANUAL-TESTS.md](MANUAL-TESTS.md) auf Windows-Portable und Android durchgehen (frische Installation und eine mit Daten).

### Google-Verbindung einrichten (einmalig, für Kalender/Gmail)

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt „Nemo".
2. _APIs & Dienste → Bibliothek_: „Google Calendar API" und „Gmail API" aktivieren.
3. _OAuth-Zustimmungsbildschirm_ → Typ „Extern"; Name „Nemo", deine Adresse als Support-/Entwickler-Mail. _Bereiche_: `…/auth/calendar.readonly` und `…/auth/gmail.readonly` hinzufügen. **Veröffentlichungsstatus auf „In Produktion" stellen** (ohne Prüfung; beim Login erscheint eine Warnung „nicht überprüft", nur du selbst nutzt es). Im Status „Testing" laufen Refresh-Tokens nach 7 Tagen ab (dann „Neu anmelden").
4. _Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID_ → Typ **Desktop-App**. Client-ID und Client-Secret kopieren und in der Windows-App unter Einstellungen → Verbindungen → Google eintragen (landen im Windows-Anmeldeinformationsspeicher, nicht im Repo).
5. **Ungetestet/prüfen:** ob `gmail.readonly` bei einer unverifizierten „In Produktion"-App wie erwartet funktioniert. Wenn nicht: Status auf „Testing" lassen und deine Adresse als Testnutzer eintragen.
6. Android: Google-Login gibt es dort noch nicht; auf dem Handy kommen Termine über die Synchronisierung (sie liegen in einer synchronisierten Sammlung) oder über ein Kalender-Abo (ICS) an.

Hintergrund (aus STATUS verschoben, 2026-11-10; entschieden in [decisions/legal.md](decisions/legal.md)):

- **Google-Prüfung für die Mail-Berechtigungen (Mail-Modul, Paket 3):** `gmail.readonly`, `gmail.modify` und `gmail.send` sind bei Google „eingeschränkte Bereiche“. Mit der eigenen OAuth-Client-ID jedes Nutzers (so ist es gebaut) braucht das keine Prüfung durch Google; im Teststatus der Cloud-Console laufen die Anmeldungen aber nach 7 Tagen ab, bis die App auf „In Produktion“ gestellt wird (dann zeigt Google den Hinweis „nicht verifizierte App“). Würde Nemo je einen **eigenen, mitgelieferten** Client für alle Nutzer einsetzen, wäre die Google-OAuth-Verifizierung samt jährlicher Sicherheitsprüfung (CASA) Pflicht – das ist eine Entscheidung für dich, nicht für den Code. Siehe [decisions/legal.md](decisions/legal.md).
- **Google-OAuth „Testing“ (7 Tage, ≤ 100 Testnutzer): entschieden, Variante (a)**: jede Person bringt ihren eigenen Client mit, die App erklärt Ablauf und „Neu anmelden“. Verworfen: eigener Projekt-Client „In Produktion“ (Kalender sensibel, Gmail eingeschränkt, Prüfung durch Google nötig).

## Umbenannte Ids

Alte Id (Block) → neue Id. Verweise in alten PRs, Notizen und im Archiv meinen die alte Id.

- C1–C4 (Cockpit-Modus) → CP-C1–CP-C4
- R1–R5 (Release 0.3.1 prüfen) → RL-R1–RL-R5
- D1–D20 (Datenträger, Systeminfo) → DT-D1–DT-D20
- D13–D15 (Datenträger, Systeminfo; Zuordnung, Magnet, .torrent) → ZO-D13–ZO-D15
- V1–V8 (Übersicht und Dieser PC) → DV-V1–DV-V8
- 1–3 (Tresor: Abgleich mit Datenlecks) → LK-1–LK-3
- 1–12 (Schritt 11b) → KS-1–KS-12
- K1–K5 (KI-Zugriff / lokale Import-API) → KZ-K1–KZ-K5
- C1–C7 (Verbindungen, Kalender, Kontoauszug) → GV-C1–GV-C7
- M1–M19 (E-Mail lesen) → ML-M1–ML-M19
- T1–T3 (Werkzeuge) → WZ-T1–WZ-T3
- L1–L5 (Links, Teilen, Lesezeichen) → LT-L1–LT-L5
- R1–R11 (Fernsteuerung, PC-Seite) → FS-R1–FS-R11
- E1–E5 (Einrichtungsassistent) → EA-E1–EA-E5
- H1–H4 (Übersicht als Home-Screen) → HS-H1–HS-H4
- N11–N13 (Nemo: Umbenennung und Design; Clownfisch-Icon) → CF-N11–CF-N13
- K1–K7 (KI-Eintragen per Leiste) → KL-K1–KL-K7
- T1–T5 (Testdaten) → TS-T1–TS-T5
- E1–E6 (Einstellungen neu) → EN-E1–EN-E6
- F1–F12 (Fokus- und Aufmerksamkeitshilfen) → FO-F1–FO-F12
- K1–K4 (Komfort-Review) → KO-K1–KO-K4
- V1–V4 (Optik-Politur und Benachrichtigungs-Zentrum) → OP-V1–OP-V4
- L1–L4 (Lesbarkeit) → LS-L1–LS-L4
- E1–E10 (Notizen: Editor) → NE-E1–NE-E10
- A1–A2 (KI abschalten) → KA-A1–KA-A2
- V1–V4 (Spracheingabe) → SE-V1–SE-V4
- B1–B5 (Bildschirmfoto) → BF-B1–BF-B5
- S1–S5 (Sprachen) → SP-S1–SP-S5
- S1–S8 (Supporter-Modus) → SU-S1–SU-S8
- M1–M4 (Stumm) → ST-M1–ST-M4
- K1–K3 (Tastenkürzel) → TK-K1–TK-K3
- E1–E6 (Erinnerungen bei geschlossener App) → EG-E1–EG-E6
- A1–A5 (Erinnern-Zeile, Genommen, Ruhe) → EZ-A1–EZ-A5
- F1–F3 (Fristen) → FR-F1–FR-F3
- Q1–Q5 (Mit Partner teilen: QR-Bilder) → QR-Q1–QR-Q5
- U1–U2 (Löschen mit Rückgängig, Entwurf) → LU-U1–LU-U2
- G1–G3 (Zuletzt gelöscht) → ZG-G1–ZG-G3
- Q1–Q3 (Schnellerfassung: Android-Kurzbefehle, Kachel, Tray „Heute“) → SF-Q1–SF-Q3
- T1–T3 (Schnellerfassung: Android-Kurzbefehle, Kachel, Tray „Heute“) → TR-T1–TR-T3
- C1–C4 (Rechner-Modi) → RM-C1–RM-C4
- B1–B10 (Browser) → BR-B1–BR-B10
- D1–D6 (Downloads) → DL-D1–DL-D6
- D7–D12 (Torrent) → TO-D7–TO-D12
- M1–M6 (Modul-Rahmen, Wetter und Musik) → MR-M1–MR-M6
- G1–G6 (Geld-Gruppe: Finanzen) → GD-G1–GD-G6
- G7–G10 (Geld-Gruppe: Rechnungen) → GD-G7–GD-G10
- G11–G14 (Geld-Gruppe: Abos) → GD-G11–GD-G14
- G15–G18 (Geld-Gruppe: Budgets) → GD-G15–GD-G18
- U1–U4 (Uhr) → UH-U1–UH-U4
- L1–L5 (Sync im Heimnetz: Hub im PC) → HN-L1–HN-L5
- L6–L17 (Sync im Heimnetz: PC und Handy koppeln) → HN-L6–HN-L17
- H1–H7 (Hauptthread frei halten) → MT-H1–MT-H7
