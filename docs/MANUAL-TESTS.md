# Manuelle Tests offen

Moved unchanged from `docs/STATUS.md` (2026-10-01). Hardware-only checks; the installation/update walkthrough is at the end of this file → "Anleitungen für Sven".

Nur auf echter Hardware prüfbar (das macht Sven am Ende). Alles andere ist per Unit-/E2E-Tests und CI-Läufen abgedeckt.

### Release 0.3.1 prüfen
R1. *Windows-Portable frisch herunterladen* (`Nemo-Portable.exe` von der Release-Seite `v0.3.1`) und starten; SmartScreen-Hinweis ist erwartet; Über-Dialog zeigt `0.3.1`. ☐
R2. *Android-APK als Update* (`Nemo.apk`) über eine bestehende 0.2.0-Installation installieren: Daten bleiben, Share-Ziel und Benachrichtigungs-Symbol funktionieren. ☐
R3. *In-App-Update:* eine 0.3.x-Installation (Windows-Portable und Android) prüft Updates und aktualisiert auf das erste Release ohne `Taschenmesser-*`-Dateien (`latest.json` verweist auf `Nemo-Portable.exe`, Android nimmt `Nemo.apk`). Daten bleiben erhalten. Von 0.2.x aus ist kein Selbst-Update mehr möglich (nur Neuinstallation). ☐
R4. *Sync-Tresor v2 (Argon2id) mit einem 0.2.0-Gerät:* zweites, altes Gerät am selben Server; prüfen, ob ein älterer Tresor weiter entschlüsselt. ☐
R5. Datenträger-Modul D1–D16 und Keystore/Windows Hello (Schritt 11b) wie unten. ☐

### Datenträger, Systeminfo (diese Runde) – nur auf echtem Windows prüfbar
Alles mit einem **Testordner** mit erfundenen Dateien, nie mit echten Nutzerdaten:
D1. *Scan echtes Laufwerk:* Datenträger → C: scannen. Fortschritt läuft, UI bleibt flüssig, Summe stimmt grob mit dem Explorer („Größe auf Datenträger“ des Ordners) überein. Ergebnis mit „Nicht gelesen“-Liste (z. B. `System Volume Information`). ☐
D2. *Treemap navigieren:* Klick in einen Ordner, Brotkrumen zurück, Umschalt+Klick wählt nur aus, Pfeiltasten/Eingabe/Rücktaste, Tooltip, Legende, Farbe nach Tiefe, Filter „Älter als“, „Dateityp“. ☐
D3. *Laufwerksarten:* USB-Stick und Netzlaufwerk erscheinen mit richtigem Typ; SSD/HDD-Angabe stimmt (kann „Festplatte“ ohne Angabe sein). ☐
D4. *Cloud-Platzhalter:* Ein OneDrive-Ordner mit „Nur online“-Dateien wird gescannt, ohne dass etwas heruntergeladen wird; Hinweis „liegen nur online“ erscheint. ☐
D5. *Verknüpfungen:* Ein Ordner mit Junction/Symlink auf einen großen Ordner: wird nicht doppelt gezählt (Hinweis „nicht betreten“). ☐
D6. *Papierkorb:* Testordner (mit ein paar Dateien) → Löschen → „In den Papierkorb“: Ordner liegt im Windows-Papierkorb, lässt sich wiederherstellen; Baum und Summen aktualisieren sich ohne Neu-Scan. ☐
D7. *Papierkorb nicht möglich:* Einen Testordner auf einem USB-Stick/Netzlaufwerk ohne Papierkorb löschen: Bericht „Papierkorb nicht möglich – nichts gelöscht“, der Ordner ist noch da; erst der bewusste „endgültig“-Schritt löscht. ☐
D8. *Sperrliste:* Diese Pfade zeigen **keine** Löschen-Schaltfläche, sondern „Geschützt“: Laufwerkswurzel, `C:\Windows` (und darin), `C:\Program Files`, `C:\ProgramData`, `C:\Users`, dein Profilordner, `AppData`, `System Volume Information`, `$Recycle.Bin`, `pagefile.sys`/`hiberfil.sys`, Ordner der Taschenmesser-App und ihrer Daten, Ordner eines laufenden Programms. Mit 8.3-Namen (`dir /x`) und über eine Junction auf `C:\Windows` ebenfalls nicht löschbar. ☐
D9. *Abbruch:* Scan während der Laufzeit abbrechen (Teilergebnis bleibt nutzbar); Löschen einer großen Testordner-Auswahl mit „Stoppen“ unterbrechen (Rest bleibt unberührt). ☐
D10. *Datei in Benutzung:* Eine geöffnete Testdatei in einem Testordner: Bericht „Teilweise gelöscht“ mit Grund „Datei in Benutzung“. ☐
D11. *Bestätigungen:* Große Löschung (> 10 GB oder > 10 000 Dateien, z. B. Testordner mit vielen leeren Dateien) und „endgültig“ verlangen das Eintippen des Namens; Dokumente/Bilder/Desktop zeigen die Warnung für persönliche Ordner. ☐
D12. *Aufräum-Helfer:* „Aufräumen“ auf der Startseite listet Temp/Downloads/Browser-Caches (nur vorhandene); „Doppelte Dateien“ findet zwei gleiche Testdateien, ein Exemplar bleibt immer. ☐
D13. *Im Explorer zeigen / Pfad kopieren* funktionieren (auch bei langen Pfaden). ☐
D14. *Berechtigungen:* App startet, Updater, Google-Login und lokale API funktionieren weiterhin (alle App-Befehle sind jetzt einzeln freigegeben; `capabilities/desktop.json`). ☐
D15. *Systeminfo:* Werte stimmen mit dem Task-Manager grob überein (CPU-Name, RAM, Akku am Laptop, Grafikkarte, lokale IP). ☐
D16. *Android/PWA:* „Datenträger“ und „Systeminfo“ erscheinen weder in der Modul-Bibliothek noch im Menü. ☐

### Übersicht und Dieser PC (Runde `feat/dashboard-variety-system-module`) – nur auf echtem Windows/Android prüfbar
V1. *GPU-Erkennung:* Dieser PC → System → Grafik: die **RTX 4070** erscheint (mit Speicher ≈ 12 GB und Treiberversion, „aktiv“), **nicht** „Microsoft Basic Render Driver“. Bei mehreren Grafikkarten (z. B. Prozessorgrafik) sind alle gelistet. ☐
V2. *Netzwerk-Adapterliste:* Pro Adapter Name, Typ (Kabel/WLAN/virtuell), Status, IPv4, **eine** IPv6; „Alle Adressen anzeigen“ blendet die übrigen ein. vEthernet/WSL/Hyper-V gedämpft am Ende. WLAN-Name und Signal erscheinen (unter Windows 11 24H2 ggf. nur mit Standortberechtigung – dann fehlen sie). Auf/Ab-Rate bewegt sich beim Download. „Öffentliche IP abfragen“ fragt erst nach dem Klick. ☐
V3. *Laufwerke:* Typ (NVMe/SSD/HDD/USB), Modellname, Systemlaufwerk-Markierung, Füllstand-Hinweis in Worten; Temperatur und Zustand erscheinen **oder** „nicht verfügbar – …“ mit Grund (ohne Adminrechte oft nur die Temperatur). „Belegt seit letztem Scan“ nach einem Scan und etwas Schreiben. Lese-/Schreibrate bei Kopieren einer großen Datei. ☐
V4. *Schnellübersicht:* Größen von Temp/Downloads/Browser-Cache/Papierkorb stimmen grob mit dem Explorer; „mindestens …“ bei sehr großen Ordnern; kein automatisches Löschen. ☐
V5. *Mehr Infos:* Mainboard, BIOS, RAM-Riegel (Anzahl, Typ, Takt), Windows-Build, letzter Neustart, Bildschirme (Auflösung, Rate), Standard-Lautsprecher/Mikrofon, Prozesse mit CPU %, „Im Task-Manager öffnen“. Akku am Laptop. ☐
V6. *Live-Kacheln:* CPU/RAM/Netz aktualisieren alle 3 s ohne Flackern; Mini-Verlauf füllt sich; Seite verlassen und zurückkehren beginnt neu. ☐
V7. *Übersicht mit echten Daten:* „Jetzt wichtig“ zeigt Überfälliges (rot), Heute (Akzent), bald Ablaufendes (Warnfarbe) – jeweils mit Icon/Text; leer = Bereich fehlt. ToDo im Widget abhaken → „Rückgängig“. Kachel „Heute“ zeigt Jetzt-Linie und „Als Nächstes“. Dichte „Kompakt“ in Einstellungen → Darstellung. ☐
V8. *Android:* Übersicht (Widgets, „Jetzt wichtig“ umbrechen sauber, Touch-Ziele), Dieser PC erscheint **nicht**. ☐

### Schritt 11b – OS-Keystore, Biometrie, Bildschirmschutz
**Windows (`Nemo-Portable.exe`)**
1. *API-Schlüssel im Credential Manager:* Einstellungen → KI-Assistent → Anbieter hinzufügen → Schlüssel eintragen → Speichern → „Verbindung testen". Dann Windows-Suche „Anmeldeinformationsverwaltung" → „Windows-Anmeldeinformationen": Es gibt einen Eintrag `ai-key:<anbieter>` (Adresse `io.github.sgnemo.taschenmesser`). ☐
2. *Migration:* Ein Schlüssel, der schon mit einer älteren Version gespeichert war, funktioniert nach dem Update weiter (nach der ersten Nutzung erscheint er im Credential Manager). ☐
3. *Windows Hello:* Accounts → Tresor anlegen/entsperren → „Import, Export & Sicherheit" → „Biometrisches Entsperren aktivieren" (Master-Passwort eingeben) → Windows-Hello-Fenster erscheint und bestätigt. Danach „Sperren" → beim Sperrbildschirm fragt Windows Hello automatisch → Tresor offen. ☐
4. *Abbruch:* Beim Hello-Fenster „Abbrechen" → Tresor bleibt gesperrt, Passwortfeld und Button „Mit Biometrie entsperren" sind da. ☐
5. *Deaktivieren:* „Biometrisches Entsperren deaktivieren" → beim nächsten Sperren kein Hello-Fenster mehr; der Eintrag `bio:vault-dek:…` ist aus dem Credential Manager verschwunden. ☐
6. *Ohne Hello (kein PIN/Gesicht eingerichtet):* Abschnitt zeigt „Nicht verfügbar…", nichts bricht. ☐

**Android (signierte APK)**
7. *Keystore-Schlüssel:* API-Schlüssel speichern, App komplett schließen und neu öffnen, „Verbindung testen" funktioniert. Nach Neustart des Handys ebenfalls. ☐
8. *Biometrie aktivieren:* Accounts → Import, Export & Sicherheit → aktivieren (Master-Passwort) → Fingerabdruck-Dialog → „aktiv". Sperren → Sperrbildschirm zeigt den Dialog → Fingerabdruck → offen. ☐
9. *Abbrechen / falscher Finger:* Dialog abbrechen → gesperrt, Passwort geht weiter; falscher Finger → Dialog meldet Fehler, kein Entsperren. ☐
10. *Fingerabdrücke geändert:* In den Android-Einstellungen einen Fingerabdruck hinzufügen oder löschen → beim nächsten Entsperren erscheint „Biometrisches Entsperren ist nicht mehr gültig…", Master-Passwort entsperrt, Biometrie lässt sich neu aktivieren. ☐
11. *Bildschirmschutz:* Auf der Accounts-Seite Screenshot versuchen (wird blockiert/schwarz), App-Umschalter (Übersicht) zeigt kein Vorschaubild; auf anderen Seiten (Dashboard) normale Screenshots. ☐
12. *Hintergrund-Sperre:* App in den Hintergrund → nach eingestellter Zeit ist der Tresor gesperrt. ☐

**Beide:** Tresor-Daten und KI-Schlüssel bleiben nach einem App-Update erhalten (Update-Test, siehe unten). ☐

### KI-Zugriff / lokale Import-API (Phase 2)
Nur in der Windows-App prüfbar (der Server selbst ist per Rust-Tests geprüft, die Oberfläche per E2E mit Ersatz-Server):
K1. *Aktivieren:* Einstellungen → KI-Zugriff → Schalter an → Status „Läuft auf http://127.0.0.1:47631“. Windows-Firewall fragt **nicht** (nur Loopback). ☐
K2. *Zugang:* „Zugang anlegen“, Name, ToDos Lesen + Schreiben → Schlüssel erscheint einmal, kopieren. PowerShell: `Invoke-RestMethod -Uri http://127.0.0.1:47631/v1/modules -Headers @{Authorization="Bearer <Schlüssel>"}` listet nur ToDos. ☐
K3. *Schutz:* dieselbe Anfrage ohne/mit falschem Schlüssel → 401; im Browser `http://127.0.0.1:47631/v1/modules` öffnen → Fehler (kein Zugriff). Von einem anderen Gerät im WLAN ist der Port nicht erreichbar. ☐
K4. *Probelauf:* `POST /v1/todos/import?dryRun=true` mit einem Eintrag → Ergebnis je Eintrag, in der App erscheint nichts. ☐
K4b. *Import mit Vorschau:* derselbe Aufruf ohne `dryRun` → Banner „… möchte 1 Eintrag in „ToDos“ übernehmen“ → Ansehen → Übernehmen; nach dem Sync ist der Eintrag auf dem Handy. „Import rückgängig machen“ (Einstellungen → KI-Zugriff) entfernt ihn überall. Ein Eintrag mit `id` erscheint als Änderung (alt → neu) und ist nicht vorausgewählt. ☐
K5. *Widerrufen / Port belegt:* Zugang widerrufen → nächste Anfrage 401. Port auf einen belegten Wert stellen → verständliche Meldung. ☐

### Portable Windows-Build (Phase 13)
Nur auf echtem Windows prüfbar (CI baut nur; der Smoke-Test dort ist informativ):
P1. *Start:* `Nemo-Portable.exe` (Pre-Release-Download) starten, SmartScreen „Weitere Informationen → Trotzdem ausführen". Die App öffnet sich, die Daten der bisher installierten Version sind da (gleiche App-Kennung). ☐
P2. *WebView2 fehlt:* auf einem Rechner/VM ohne WebView2 startet die exe → deutsches Meldungsfenster mit „OK" (öffnet die Microsoft-Seite) statt stillem Absturz. ☐
P3. *Portabler Modus:* Ordner `data` neben die exe legen, starten → die App ist leer (neues Profil), `data\` füllt sich; ohne den Ordner wieder das Benutzerprofil. ☐
P4. *Update (erst ab dem zweiten portablen Release):* Kanal Beta → „Jetzt prüfen" → „Jetzt aktualisieren": Backup, Download, die exe ersetzt sich, startet neu, neue Version, Daten da, im Ordner bleiben keine `.old`/`.new`-Dateien (nach dem nächsten Start). ☐
P5. *Fehlerfall:* exe in einen schreibgeschützten Ordner legen und aktualisieren → verständliche Meldung („Ordner nicht beschreibbar"), alte Version läuft weiter. ☐

### Verbindungen, Kalender, Kontoauszug (Phase 13, Schritt 3)
Braucht ein echtes Google-Konto bzw. eine echte Bankdatei – bitte nur mit eigenen Daten, nichts davon in den Chat kopieren:
C1. *Kalender-Abo (ICS):* Einstellungen → Verbindungen → Kalender-Abo: „Geheime Adresse im iCal-Format" deines Google-Kalenders eintragen. Im Browser (PWA) braucht das den Sync-Server (Proxy), in der Windows-App geht es direkt. Termine erscheinen im Kalender mit Badge „Extern", sind nur lesbar; Adresse entfernen → Termine verschwinden. ☐
C2. *Google-Login (nur Windows-App):* eigene Client-ID/Secret eintragen (siehe unten), „Verbinden" → der Browser öffnet die Google-Anmeldung → nach „Zulassen" erscheint die Seite „Die Anmeldung ist abgeschlossen" und die Karte zeigt „Verbunden". Bei einer unverifizierten App zeigt Google eine Warnung („Google hat diese App nicht überprüft" → „Erweitert" → „… öffnen"). ☐
C3. *Kalender-Sync:* nach dem Login erscheint die Liste deiner Kalender (nur der Hauptkalender ist angehakt); „Jetzt abgleichen" holt die Termine. Termin in Google ändern/löschen → nach „Jetzt abgleichen" (oder spätestens nach 30 min) auch hier. Zeiten stimmen (Zeitzone!), ganztägige und mehrtägige Termine ebenfalls. ☐
C4. *Ablauf des Tokens:* Status „Testing" in der Google Cloud Console → nach 7 Tagen zeigt die Karte „Abgelaufen" + „Neu anmelden"; lokale Termine bleiben. („In Produktion" vermeidet das.) ☐
C5. *Gmail-Scan:* Feature „E-Mails" einschalten (neuer Login mit mehr Rechten), dann in Rechnungen/Abos/Unterlagen/Kalender „… aus E-Mails erkennen" → Zeitraum wählen → Vorschau prüfen. Es darf nur passieren, was du bestätigst; der Vorschau-Text nennt „N Mails gelesen (Absender, Betreff, Datum, Vorschauzeile)". Prüfe, ob die Erkennungsquote brauchbar ist (Heuristiken sind auf erfundenen Beispielen getestet, nicht auf echten Mails). ☐
C6. *Trennen:* „Trennen" → Dialog „Termine behalten / löschen"; danach ist der Zugriff in deinem Google-Konto unter „Sicherheit → Drittanbieter-Zugriff" verschwunden. ☐
C7. *Kontoauszug:* Online-Banking → Umsätze → Export „CSV-CAMT" (oder „CAMT"). **Bitte nur die Kopfzeile (erste Zeile) einer echten Datei prüfen/schicken** und mit `Buchungstag`, `Verwendungszweck`, `Beguenstigter/Zahlungspflichtiger`, `Betrag` vergleichen; dann Finanzen → Einstellungen → Startdaten → „Kontoauszug importieren": Vorschau, Import, zweiter Import zeigt nur „Schon vorhanden". Abos: „Abos im Kontoauszug erkennen" zeigt regelmäßige Abbuchungen. ☐

### Werkzeuge (Phase 13, Schritt 5)
T1. *QR lesen:* Werkzeuge → QR-Code → „Lesen" → Kamera erlauben → einen QR-Code halten: Text erscheint (Windows-App/Chrome: `BarcodeDetector`; auf dem Handy Kamerarecht in der APK). Wo es nicht geht, steht ein Hinweis; Erzeugen geht immer. ☐
T2. *Währung:* mit Internet: Kurse laden, umrechnen; danach Netz aus → gespeicherte Kurse mit Datum. Die Schnittstelle `api.frankfurter.dev` ist nur per Doku geprüft (in der Windows-App keine CORS-Hürde, im Browser hängt es an deren CORS-Erlaubnis). ☐
T3. *Timer:* Timer starten, Sheet schließen – läuft weiter; bei Ablauf kommt die Benachrichtigung (Windows und Android). ☐

### Links, Teilen, Lesezeichen (Phase 13, Schritt 6)
L1. *Karte:* Termin mit Ort → „Auf der Karte zeigen“ öffnet Google Maps (Windows: Browser, Android: Maps-App). ☐
L2. *WhatsApp:* Personen → Knopf neben dem Namen → WhatsApp (Web/App) mit Glückwunschtext, Kontakt wählen. ☐
L3. *Teilen (Android, PWA in Chrome installiert):* in einer anderen App „Teilen“ → Nemo → Seite „Teilen“ mit den Zielen (nur eingeschaltete Module); Merkliste/Notiz/ToDo öffnen vorbefüllt. Die **APK** hat kein Teilen-Ziel (nicht gebaut). ☐
L4. *Lesezeichen:* Merkliste → Lesezeichen → Startdaten; Kacheln (Gruppe = erster Tag) öffnen den Link im Browser; alter Pfad `/launcher` leitet dorthin um. ☐
L5. *Spotify:* nicht gebaut (siehe docs/architecture.md). Soll ein Now-Playing-Widget kommen, brauche ich eine Entscheidung: Premium-Konto als Entwickler nötig, max. 5 Nutzer. ☐

### Einrichtungsassistent
E1. *Aus den Einstellungen starten und abbrechen (Windows-Portable und Android):* Einstellungen → „Einrichtung starten“ → ein, zwei Schritte mit „Weiter“ → X → „Später fortsetzen“; App schließen und neu öffnen: es öffnet sich nichts von selbst; erneut starten bietet „Fortsetzen bei …“. Android: Zurück-Geste fragt nach, statt die Seite zu verlassen. ☐
E2. *Frische Installation (Windows-Portable, dann Android-APK):* Übersicht zeigt die Willkommenskarte (kein Vollbild); „Einrichtung starten“ → alle Schritte durchgehen. Tresor: Master-Passwort festlegen, mit Fingerabdruck bzw. Windows Hello entsperrbar. KI-Anbieter mit echtem Schlüssel: „Verbindung testen“, danach Eintrag `ai-key:<anbieter>` im Credential Manager. Benachrichtigungen: erlauben; Android: Erinnerung bei geschlossener App, Hinweis zu genauen Alarmen/Akku-Optimierung. ☐
E3. *Wiederherstellung aus Backup:* frische App → Schritt „Sync und Wiederherstellung“ → „Backup-Datei einspielen“ → Module/Daten sind da; danach Profile/Startdaten überspringen. ☐
E4. *Bestehende Installation bleibt unberührt:* Update einer App mit Daten: keine Willkommenskarte, keine Checkliste, Daten unverändert; Einstellungen → „Einrichtung starten“ zeigt den aktuellen Zustand, nichts wird ohne Bestätigung geändert (Profil zeigt erst den Diff). ☐
E5. *Google-Verbindung im Assistenten (Windows):* Schritt „Konten verknüpfen“ → Anmeldung starten und im Browser abbrechen bzw. den Assistenten schließen: kein Token gespeichert, Status bleibt „Nicht verbunden“. ☐

### Übersicht als Home-Screen
H1. *Windows-Portable und Android:* App öffnen → Start ist die Übersicht; Logo (Sidebar bzw. Kopfzeile) führt von jedem Modul zurück; Android-Zurück: Modul → Übersicht, Übersicht beendet die App. ☐
H2. *Bearbeitungsmodus per Touch (Android):* „Anpassen“ → Widget am Griff lange drücken und verschieben, Größe S/M/L wählen, Widget-Liste öffnen und ein-/ausblenden, „Zurücksetzen“; alle Ziele gut treffbar, Seite scrollt beim Wischen nicht versehentlich mit. ☐
H3. *Sync der Anordnung:* auf Gerät A Reihenfolge/Größe/Sichtbarkeit ändern, Gerät B synchronisieren: gleiche Übersicht; ein altes Layout (vor dem Update angepasst) bleibt erhalten. ☐
H4. *Status-Widgets (Windows):* Datenträger zeigt Füllstände, Systeminfo CPU/RAM/Akku, Tresor nur gesperrt/entsperrt (nie Einträge). ☐

### Nemo: Umbenennung und Design
N1. *Windows-Portable starten (frische Datei und als Update):* Taskleisten-Icon zeigt den Fisch, Fenstertitel „Nemo“, Tray/Benachrichtigungen ohne „Taschenmesser“; Update von einer alten Version findet die Datei (`latest.json` zeigt ab dem nächsten Release auf `Nemo-Portable.exe`), Daten bleiben erhalten.
N2. *Android-APK als Update über die bestehende Installation:* App-Name „Nemo“, neues Icon, alle Daten da, Tresor entsperrbar. Adaptives Icon (runde/eckige Launcher-Maske, Fisch nicht abgeschnitten), Themed-Icon (Android 13+ einfarbig), Benachrichtigungs-Icon in der Statusleiste (`ic_notification` – prüfen, ob es das Tauri-Notification-Plugin wirklich nutzt), Splash.
N3. *Hell / Dunkel / System, Akzentfarben:* Einstellungen → Darstellung: alle vier Akzente in beiden Themes ansehen; Text lesbar, Fokus sichtbar (Tab-Taste).
N4. *Reduzierte Bewegung:* Betriebssystem-Einstellung „Animationen reduzieren“ an: keine Seiten-/Listen-/Diagramm-Animation, Ladeplatzhalter ohne Schimmer.
N5. *Neue Module der anderen Chats:* nach dem Merge Dashboard, Datenträger-Aufräumer und weitere neue Seiten hell/dunkel ansehen (sollten das Design über Tokens erben; Sonderstyles melden).
N6. *Alte Backups:* eine `taschenmesser-backup-…json` (auch verschlüsselt) einspielen; neue Exporte heißen `nemo-backup-…`.
N7. *Diagramm-Farben:* Türkis/Orange bei Farbfehlsichtigkeit prüfen (Validator des dataviz-Skills nach dem Rebrand noch nicht erneut gelaufen).
N8. *Windows-Portable mit dem Logo „Welle“:* Icon in Taskleiste, Titelleiste, Tray und Alt-Tab zeigt den neuen Fisch (7 ICO-Größen), Fenstertitel „Nemo“, Tray-Tooltip „Nemo“. ☐
N9. *Android-APK als Update über die bestehende Installation:* App-Name „Nemo“, **neues Launcher-Icon** (adaptiv: runde und eckige Maske, Fisch nicht abgeschnitten), Themed-Icon (Android 13+, einfarbig), **Benachrichtigungs-Icon** in der Statusleiste ist der weiße Fisch (kein weißer Klotz), alle Daten und der Tresor bleiben. Vorher war unklar, ob die Icons überhaupt in der APK landen (Kopierschritt in `release.yml` neu). ☐
N10. *Hell / Dunkel / System, Akzente, Design „Klar“:* Einstellungen → Darstellung: alle vier Akzente in beiden Themes; Karten mit Rahmen statt Schatten, Tabs als ruhige Pille, nur ein orangefarbener Hauptbutton je Seite; Titelleisten-Farbe (PWA/Browser) folgt der gewählten Darstellung. ☐
N11. *Neues Clownfisch-Icon (Branch `design/app-icon`), Windows-Portable:* Taskleiste (hell/dunkel, 100–200 % Skalierung), Tray, Alt-Tab und Fenstertitel zeigen den geneigten Fisch auf der orangen Kachel, nicht unscharf bei 16/24/32 px. ☐
N12. *Clownfisch-Icon, Android-APK als Update über die bestehende Installation:* Launcher-Icon (runde, eckige und Squircle-Maske: Fisch nicht abgeschnitten), Themed-Icon (Android 13+, einfarbig), Benachrichtigungs-Icon in der Statusleiste, Splash (hell/dunkel). Benachrichtigungs-Akzent ist jetzt `#E0550F`. ☐
N13. *Clownfisch-Icon im Browser/PWA:* Favicon im Tab (hell/dunkel), „Zum Startbildschirm“ (maskierbares Icon), Sidebar/Topbar zeigen die Wortmarke (Nemo als Clownfisch), leere Zustände. README-Header „Nemo als Clownfisch“ + Claim „Notizen · Erinnerungen · Module · Offline“ auf GitHub in hell und dunkel, Social-Preview neu hochladen (`docs/brand/social-preview.png`). ☐
N11. *Reduzierte Bewegung:* Systemeinstellung an → keine Seiten-/Listen-/Balken-Animation, Listen erscheinen sofort (kein Verzögern), Skeleton ohne Schimmer. ☐
N12. *README auf GitHub im hellen und dunklen Modus:* Header-Bild und Dashboard-Screenshot wechseln mit (`<picture>`), Badges lesbar, beide Download-Buttons liefern die Dateien (erst nach dem Nemo-Kopien-Upload zu v0.2.0 bzw. dem nächsten stabilen Release). ☐
N13. *Autostart (Windows):* Wenn Autostart in 0.2.0 aktiv war: nach dem Update prüfen, ob der Eintrag noch „Taschenmesser“ heißt und die App ihn als „aus“ anzeigt (siehe REVIEW M10). ☐

## KI-Eintragen per Leiste (PR A, nur von Hand prüfbar)
- **K1 Echte Sätze (Windows und Android):** in der Leiste (Strg+K / Suchen) eigene Sätze eintippen: „Rechnung Stadtwerke 89,90 € fällig 15.10.“, „Abo Netflix 12,99 monatlich ab 1.11.“, „Lösche das Abo Spotify“, „Markiere die Stadtwerke-Rechnung als bezahlt“. Erwartung: Vorschau mit richtigen Feldern, Änderung/Löschen zeigen Vorher/Nachher, nichts wird vor „Eintragen“ gespeichert, „Rückgängig“ im Hinweis stellt den Stand wieder her. Auf dem Handy: Tastatur schiebt die Vorschau nicht aus dem Bild.
- **K2 Statistik:** Einstellungen → KI → KI-Statistik: Regel-Antworten zählen mit 0 Token, Cloud-Antworten mit Token/Kosten; „x % ohne Cloud“ passt zu dem, was du getan hast.
- **K3 Cloud-Fallback:** mit eingerichtetem Anbieter einen Satz schreiben, den die Regeln nicht kennen („Leg bitte etwas für die Steuerberaterin fest, sie meldet sich Freitag“): die Vorschau erscheint, Statistik zeigt eine Cloud-Antwort; mit „Cloud-Fallback erlauben“ aus erscheint stattdessen die normale Antwort.
- **K4 Schalter:** „Einträge per KI vorschlagen“ aus: keine „Eintragen“-Option, kein „Mit KI eintragen“ im Modul; ein einzelnes Modul abgeschaltet: dafür kommt kein Vorschlag.

## Browser-Erweiterung (Brave) und Tresor-Brücke – nur von Hand prüfbar (Windows)
Vorbereitung: Portable-EXE aus dem Branch/Artefakt, `nemo-extension-….zip` entpacken, Tresor mit Beispieldaten. Hintergrund: [security/VAULT-EXTENSION.md](security/VAULT-EXTENSION.md).
X1. *Laden:* `brave://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“. Die ID lautet `olgcnfjmihlmpgjepkfbdjcpenckemaj`, keine Fehler im Service-Worker-Log. ☐
X2. *Verbindung bestätigen:* Nemo → Tresor → Browser-Erweiterung → an (Registry: `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\io.github.sgnemo.taschenmesser.vault` zeigt auf die JSON im `data`-Ordner bzw. App-Daten; auch Chrome/Edge/Chromium-Schlüssel). Popup zeigt einen Code, der Dialog in Nemo denselben; „Verbinden“ → Popup „Verbunden“. ☐
X3. *Host als GUI-EXE:* Der Host-Start (Release-EXE ohne Konsole) liefert Antworten (Popup „Verbunden“, nicht „nicht gefunden“); im Task-Manager erscheint kurz ein zweiter Prozess ohne Fenster, nach Schließen von Brave weg. ☐
X4. *Registrierung auf einer Test-Site:* Seite mit Registrierungsformular, E-Mail eintragen, ins Passwortfeld klicken → Vorschlag; „Verwenden“ füllt beide Passwortfelder; Speicherkarte zeigt die E-Mail; „Im Tresor speichern“ → in Nemo erscheint der Eintrag (URL = Origin der Seite). ☐
X5. *Sync aufs Handy:* Nach Sync (oder Auto-Sync) erscheint der Eintrag in der Android-App mit demselben Passwort. ☐
X6. *Login-Autofill:* Login-Seite derselben Domain: Schlüssel im Feld → Eintrag → Benutzername und Passwort gefüllt; vorher nichts. TOTP-Eintrag: Code-Feld bzw. Popup „Code kopieren“; Zwischenablage nach 30 s leer (und bei zwischenzeitlich kopiertem anderen Text unverändert). ☐
X7. *Phishing-Test:* Ähnliche Domain (z. B. `shop-example.test` statt `shop.example.test`, `http://` statt `https://`, anderer Port) bekommt keinen Eintrag und kein Passwort. ☐
X8. *Gesperrt / nicht gestartet:* Tresor sperren → Popup „gesperrt“, Speichern zeigt Hinweis, Daten bleiben im Tab; entsperren → „Erneut versuchen“ speichert. App beenden → „Nemo wurde nicht gefunden“. Auto-Sperre beendet die Sitzung sofort. ☐
X9. *Portable verschoben:* Ordner mit der EXE verschieben, App starten → Dialog zeigt den Pfad als aktuell (oder „Neu eintragen“), Erweiterung verbindet wieder ohne erneutes Bestätigen. ☐
X10. *Brave Shields:* Shields hoch/aus auf einer Test-Site: Overlay und Schlüssel erscheinen in beiden Fällen; Fingerprinting-Schutz „streng“ stört das Ausfüllen nicht. ☐
X11. *Pipe nur für dich:* Mit einem zweiten Windows-Benutzer ist die Pipe `\\.\pipe\nemo-vault-<Benutzer>` nicht öffenbar; ein zweites Nemo (Dev-Preview neben Release) meldet „belegt“ statt zu verdrängen. ☐
X12. *Tresor-Suche-Hotkey:* Einstellungen → Schnellerfassung → „Tastenkürzel Tresor-Suche“ setzen; bei entsperrtem Tresor öffnet es die Suche, bei gesperrtem nur das Fenster mit dem Sperrbildschirm. ☐
X13. *Tasten im Eintrag:* U/P/T/O kopieren Benutzername/Passwort/Code bzw. öffnen die Website; in Eingabefeldern passiert nichts. ☐
X14. *Eigene Seiten:* Auf der Nemo-PWA im Browser schlägt die Erweiterung nichts vor und bietet das Master-Passwort nie zum Speichern an. ☐

### Testdaten (Dev-Preview)
T1. *Dev-Preview frisch installieren* (`Nemo-Portable-dev.exe` / `Nemo-dev.apk`, leere Datenbank): Die App startet mit Daten in Übersicht und allen Modulen, Hinweis „Testdaten geladen“ erscheint einmal. ☐
T2. *Einstellungen → Entwickler → „Testdaten entfernen“:* alle Testdaten sind weg, eigene Einträge (vorher angelegt) bleiben. Nach Neustart werden sie nicht erneut geladen. ☐
T3. *Tresor:* Accounts zeigt einen Demo-Tresor mit der Passphrase `nemo-demo-tresor`; ein vorhandener Tresor wird nie überschrieben. ☐
T4. *Sync:* Mit eingerichtetem Sync-Server werden Testdaten nicht übertragen (Server hat sie nicht); erst „Seed-Sync erlauben“ schickt sie. ☐
T5. *Stabile App* (`Nemo-Portable.exe`/`Nemo.apk`) hat keinen Bereich „Entwickler“ und keinen Palette-Befehl „Testdaten laden“. ☐

### Einstellungen neu (Kategorien, Über Nemo) – nur auf echter Hardware prüfbar
E1. *Windows-Portable:* Einstellungen durchklicken – Kategorien-Leiste links, Auswahl markiert, Zurück/Vor des Fensters, Suche („Hotkey“ springt zu Schnellerfassung und hebt die Zeile hervor). ☐
E2. *Android:* Einstellungen öffnet die Kategorien-Liste, eine Kategorie öffnet den Inhalt, die Zurück-Geste führt zur Liste; große Touch-Ziele. ☐
E3. *Deep-Links:* „Benachrichtigungen aktivieren“ im Tab Erinnerungen des Kalenders, das Sync-Symbol oben und der Dev-Hinweis springen in die richtige Kategorie und zum Abschnitt. ☐
E4. *Über Nemo:* Version, Build/Commit (Dev-Preview), Plattform und Installationsart stimmen; „Ordner öffnen“ öffnet den Datenordner (Portable: `data/` neben der exe, sonst lokaler App-Ordner); Changelog und Lizenzen klappen auf; Diagnose-Export speichert eine Datei ohne Daten und Schlüssel. ☐
E5. *Gerät zurücksetzen (Testgerät!):* ohne exakt `LÖSCHEN` bleibt der Knopf aus; danach ist die App leer, API-Schlüssel und Backup-Passwort sind weg, der Sync-Server hat seine Daten noch. ☐
E6. *Entwickler:* die Kategorie erscheint nur im Dev-Preview-Build. ☐

### Fokus- und Aufmerksamkeitshilfen (Paket 1) – nur mit echtem Gerät und echtem Alltag prüfbar
F1. *Fokusmodus am Handy (Android):* ToDo über „Jetzt dran“ starten. Ring, Schritte und Buttons gut erreichbar mit einer Hand? Display-Sperre/App-Wechsel während der Runde: nach Rückkehr stimmt die Restzeit, die Anzeige oben führt zurück. Ende: „Zeit ist um“ erscheint erst beim Öffnen der App (kein System-Hinweis im Hintergrund, bekannt). ☐
F2. *Fokusmodus am PC (Windows):* Esc verlässt den Bildschirm, die Runde läuft weiter; „Fertig“ und „Runde beenden“; Ton am Ende (Einstellung „Sanfter Ton am Ende“) ist leise genug. ☐
F3. *Schnellerfassung in echten Situationen:* unterwegs „Formular ausfüllen 15 min“ eintippen und per Teilen-Menü etwas erfassen; stimmt Dauer und Ziel, wirkt es schnell genug? ☐
F4. *„Jetzt dran“ über einen Tag:* Passt der Vorschlag morgens? Sind „Später“ und „Etwas anderes“ verständlich? Tagesplan mit 3 Dingen: zu viel, zu wenig? ☐
F5. *Ruhiges „Jetzt wichtig“:* Wirkt „Wartet noch“ beruhigend oder versteckt es zu viel? „Neu planen“ verteilt sinnvoll? Jede Hilfe lässt sich unter Einstellungen → Darstellung → „Fokus & Aufmerksamkeit“ einzeln ausschalten. ☐
F6. *Erinnerungen über einen Tag (Handy und PC):* ein paar Erinnerungen und ToDos mit Datum anlegen; kommt die Morgen-Übersicht um die eingestellte Zeit, wirkt die Karte bei offener App ruhig, ist „Später“ nützlich? Ruhezeit und „höchstens 3 pro Stunde“ in der Praxis spürbar, aber nicht störend? ☐
F7. *Android, App geschlossen:* Erinnerungen und das Ende einer Fokus-Runde kommen vom System (ohne Knöpfe, bekannt); „Später“ gibt es nur in der Karte bei offener App. Gestaffelte Erinnerung testen (Einstellungen → Ruhige Erinnerungen). ☐
F8. *„Wenn ich am PC bin“:* auf dem Handy „Später → Wenn ich am PC bin“ wählen, nach dem Sync erscheint die Erinnerung einmal in der Windows-App. ☐
F9. *„Woran war ich?“:* App 30 Minuten verlassen, zurückkommen: erscheint die Karte auf der Übersicht, führt „Weiter dort“ an die richtige Stelle? ☐
F10. *Schnellerfassung ohne Rückfrage in echten Situationen:* unterwegs ein paar vage Sätze tippen; landen sie im Eingang, geht „Eingang sortieren“ abends zügig? Ctrl+Enter am PC fürs ganze Formular. ☐
F11. *Darstellung am Handy und PC:* „Sehr groß“, „Luftig“, „Bewegung: Weniger“ und „Nur das Wichtigste“ ausprobieren; bricht irgendwo das Layout, ist die ruhige Übersicht ruhig genug? ☐
F12. *Fortschritt im Alltag:* eine tägliche Wiederholung anlegen und ein paar Tage abhaken: erscheint „n in Folge“, bleibt ein ausgelassener Tag ohne Drama („mit Pausentag“)? Abends „Tag abschließen“ und der Wochenrückblick: wirken sie motivierend statt drängend? Eine Vorlage („Aus Vorlage“ in Listen) einmal wirklich benutzen. ☐

### Optik-Politur und Benachrichtigungs-Zentrum (`fix/visual-polish-notifications`) – nur auf echter Hardware prüfbar
V1. *Windows-Portable in verschiedenen Fenstergrößen:* Fenster ziehen, Halbbild-Snapping links/rechts, maximiert auf 1440p/Ultrawide. Übersicht, ToDos, Merkliste, Finanzen, Kalender: gleich hohe Karten, keine abgeschnittenen Wörter, kein waagerechter Scrollbalken; Schrift auf großem Monitor spürbar größer als auf dem Laptop. ☐
V2. *Android:* Übersicht, Kalender, Einstellungen im Hoch- und Querformat; Glocke in der Top-Bar, Panel als Sheet, Toasts über der Navigationsleiste, nichts unter Kamera-/Gestenleiste. ☐
V3. *Glocke:* eine Erinnerung für „gleich“ anlegen, App offen lassen: es erscheint **kein** Banner; die Glocke zählt hoch; „Nächste Erinnerung“ / „Zufällige Erinnerung“, Erledigt, Später, „Alle gelesen“ ausprobieren; Tastatur (Tab, Esc) und Fokus zurück auf die Glocke. ☐
V4. *Keine Banner mehr:* mit Einstellung „Erinnerungen in der App automatisch einblenden“ aus: Windows-/Android-Systembenachrichtigungen kommen unverändert; mit Einstellung an: Karte oben/unten rechts, verschwindet nach der gewählten Zeit, die Erinnerung bleibt in der Glocke. ☐

### Lesbarkeit (`feat/readability`) – nur im Alltag prüfbar
- **L1 Lesehilfe eine Woche** auf PC und Handy: Einstellungen → Darstellung → Lesen einschalten; Anteil 30/40/50 und Stärke Weich/Fett ausprobieren; hilft es bei Notizen, Antworten, Hilfetexten? `Alt+L` zum Umschalten (PC).
- **L2 Listen:** „Auch Listen“ wählen: werden Titel in Listen ruhiger oder unruhiger? Fokus-Lesen in einer langen Notiz öffnen.
- **L3 Ruhig-Modus:** Farben → Ruhig: bleiben nur Überfälliges und Heutiges farbig; erkennt man Kategorien noch am Namen?
- **L4 Gliederung:** Rechnungen/ToDos: Gruppen einklappen, nach Neustart bleibt der Zustand; Kalender-Woche: Stundenlinien, Wochenende, Jetzt-Linie; Bereichsfarben in Seitenleiste und Modul-Bibliothek (hell/dunkel, Rail, Handy).

## Anleitungen für Sven (aus STATUS verschoben, 2026-10-02)

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

### Google-Verbindung einrichten (einmalig, für Kalender/Gmail)
1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt „Nemo".
2. *APIs & Dienste → Bibliothek*: „Google Calendar API" und „Gmail API" aktivieren.
3. *OAuth-Zustimmungsbildschirm* → Typ „Extern"; Name „Nemo", deine Adresse als Support-/Entwickler-Mail. *Bereiche*: `…/auth/calendar.readonly` und `…/auth/gmail.readonly` hinzufügen. **Veröffentlichungsstatus auf „In Produktion" stellen** (ohne Prüfung; beim Login erscheint eine Warnung „nicht überprüft", nur du selbst nutzt es). Im Status „Testing" laufen Refresh-Tokens nach 7 Tagen ab (dann „Neu anmelden").
4. *Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID* → Typ **Desktop-App**. Client-ID und Client-Secret kopieren und in der Windows-App unter Einstellungen → Verbindungen → Google eintragen (landen im Windows-Anmeldeinformationsspeicher, nicht im Repo).
5. **Ungetestet/prüfen:** ob `gmail.readonly` bei einer unverifizierten „In Produktion"-App wie erwartet funktioniert. Wenn nicht: Status auf „Testing" lassen und deine Adresse als Testnutzer eintragen.
6. Android: Google-Login gibt es dort noch nicht; auf dem Handy kommen Termine über die Synchronisierung (sie liegen in einer synchronisierten Sammlung) oder über ein Kalender-Abo (ICS) an.

### Supporter-Modus (nur mit echter Zahlungsseite und Dienst prüfbar)
Voraussetzung: Schlüsselpaar erzeugt, `publicKeys.ts` im Build, Webhook-Dienst deployt ([services/supporter-webhook/README.md](../services/supporter-webhook/README.md)). Ohne Dienst gehen Codes per CLI (`create`).
S1. *Test-Spende mit kleinem Betrag* bei Ko-fi: Mail mit Code (Deutsch und Englisch) kommt an, nicht im Spam; Absender und Inhalt stimmen, Hinweis „freiwillig“ steht drin. ☐
S2. *Code auf dem PC:* Einstellungen → Über Nemo → Supporter, Code einfügen: Stufe, Name, Datum stimmen; Danke-Abzeichen in Über Nemo; Farbthemen wählbar; Logo in Themenfarbe. ☐
S3. *Code auf Android:* derselbe Code auf dem Handy eingeben (Einfügen-Knopf geht oder Direkteinfügen im Feld); Themes sehen auf dem Display gut aus (hell und dunkel). ☐
S4. *Sync:* Code nur auf einem Gerät eingeben; nach dem Sync zeigt das zweite Gerät denselben Status. Code entfernen: auch dort weg. ☐
S5. *Themes:* alle fünf in Hell und Dunkel durchklicken (Lesbarkeit, Fokusring sichtbar, Formulare erkennbar); ohne Code: 30-Sekunden-Vorschau endet von selbst, nichts bleibt gespeichert. ☐
S6. *Duplikat-Webhook:* in Ko-fi „Send test“ zweimal oder dieselbe Transaktion erneut senden: derselbe Code kommt wieder, kein neuer. ☐
S7. *Mailfehler:* Resend-Schlüssel kurz falsch setzen, Spende auslösen: nach den Wiederholungen kommt die Benachrichtigung an die Entwickleradresse (mit Hash-Kürzel, ohne Spender-Mail). ☐
S8. *Entwickler-Code:* `create --tier developer --name "Sven"` eingeben: Badge „Entwickler“, entfernbar, neu erzeugbar. ☐
