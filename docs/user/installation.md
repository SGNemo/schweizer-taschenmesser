# Installation

Nemo gibt es als portable Windows-Datei, als Android-App und als PWA im Browser. Die Downloads zeigen immer auf die neueste **stabile** Version. Bis zum ersten stabilen Release mit neuen Dateinamen heißen die Dateien noch `Taschenmesser-…` (der alte Projektname); Inhalt und Funktion sind Nemo. Vorabversionen (Beta) findest du auf der [Release-Seite](https://github.com/SGNemo/schweizer-taschenmesser/releases).

- **Windows:** [Taschenmesser-Portable.exe](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Taschenmesser-Portable.exe)
- **Android:** [Taschenmesser.apk](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Taschenmesser.apk) (Prüfsumme: [Taschenmesser.apk.sha256](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Taschenmesser.apk.sha256))

## Windows: eine einzelne Datei, keine Installation

1. `Taschenmesser-Portable.exe` herunterladen und an einen beliebigen Ort legen, an dem du schreiben darfst
   (z. B. in einen Ordner unter deinem Benutzerverzeichnis; **nicht** nach `C:\Programme`), und doppelklicken.
2. Windows zeigt eventuell „Der Computer wurde durch Windows geschützt“ (SmartScreen), weil unbekannte
   `.exe`-Dateien ohne gekauftes Code-Signing-Zertifikat immer so behandelt werden: **„Weitere Informationen“ →
   „Trotzdem ausführen“**. Der Update-Inhalt ist mit dem Update-Schlüssel des Projekts signiert; die App prüft
   die Signatur vor jedem Update selbst (und verweigert unsignierte oder fremd signierte Dateien).
3. **Voraussetzung: Microsoft WebView2.** Unter Windows 10/11 ist die Komponente in der Regel schon da (sie gehört zu
   Edge). Fehlt sie, erklärt die App das in einem Fenster und öffnet auf Wunsch die
   [Download-Seite](https://developer.microsoft.com/microsoft-edge/webview2/) („Evergreen Bootstrapper“).
4. **Updates:** Einstellungen → App-Updates. Die App legt zuerst eine Sicherungskopie an, lädt die neue `.exe`,
   prüft die Signatur, ersetzt sich selbst und startet neu (bei einem Fehler bleibt die alte Version erhalten).
   Dafür braucht der Ordner der `.exe` Schreibrechte.
5. **Wo liegen meine Daten?** Standardmäßig im Benutzerprofil (`%LOCALAPPDATA%\io.github.sgnemo.taschenmesser`), nicht
   neben der `.exe`; du kannst die Datei also jederzeit austauschen oder verschieben. **Portabler Modus (z. B. USB-Stick):**
   Lege einen leeren Ordner `data` neben die `.exe` – dann liegen die App-Daten dort statt im Benutzerprofil (die
   automatischen Update-Sicherungen bleiben in `%APPDATA%`).

**Von der installierten Version (Setup/MSI, bis `0.2.0-beta.1`) umsteigen:** Die portable App nutzt dieselbe
App-Kennung und findet deine Daten im Benutzerprofil deshalb sofort wieder.
1. In der alten App: Einstellungen → Backup → exportieren (Sicherheitskopie).
2. `Taschenmesser-Portable.exe` starten und prüfen, dass alles da ist (nicht gleichzeitig mit der alten App laufen lassen).
3. Die alte Version über „Apps & Features“ deinstallieren – im Deinstallationsfenster **„Anwendungsdaten löschen“ NICHT
   ankreuzen**. Falls doch etwas fehlt: Backup in der neuen App importieren.
Die alte installierte Version kann sich nicht selbst auf die portable Datei aktualisieren; der Umstieg ist einmalig manuell.

## Installation unter Android

1. `Taschenmesser.apk` auf dem Handy herunterladen (z. B. im Chrome-Browser) und öffnen.
2. Android fragt beim ersten Mal, ob die **Installation aus unbekannten Quellen** erlaubt ist: **„Einstellungen“ →
   „Aus dieser Quelle zulassen“** für den Browser bzw. die Dateien-App, dann zurück und „Installieren“. Play Protect
   kann eine zusätzliche Prüfung anbieten („Trotzdem installieren“ bzw. „App scannen“).
3. Für spätere Updates fragt die App selbst nach der Erlaubnis („Update installieren“); die neue APK muss mit demselben
   Schlüssel signiert sein, sonst lehnt Android sie ab.

> **Daten aus der PWA übernehmen:** Die installierte App hat einen eigenen Speicher. Umzug über *Einstellungen → Backup*
> (Export in der PWA, Import in der App) oder einfach über den Sync-Server.

## Als PWA installieren
Chrome/Edge (Windows) bzw. Chrome (Android) öffnen → „App installieren“. Service Worker und Installation brauchen
HTTPS (oder `localhost`).

> Spätere Releases tragen dieselben Dateien zusätzlich als `Nemo-Portable.exe` und `Nemo.apk`; bereits installierte Versionen aktualisieren sich weiter über die `Taschenmesser-…`-Namen.

## Dev-Preview (ungetestete Zwischenstände)

Nach jedem Stand von `develop` baut GitHub automatisch eine Vorschau (Windows-Portable und Android-APK). Sie ist für Tester gedacht und kann Fehler enthalten.

- **Eigene App, eigene Daten.** Die Dev-Preview heißt „Nemo Dev“ und läuft neben der stabilen App. Daten der stabilen App sind dort nicht vorhanden; hole sie per Sync oder Backup herüber. Unter Windows hat sie einen eigenen Datenordner (portabel: Ordner `data-dev` statt `data` neben der exe).
- **Download:** [Windows](https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-Portable-dev.exe) · [Android](https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-dev.apk). In der App zeigt ein „Dev“-Abzeichen, dass es die Vorschau ist.
- **Updates:** Die Dev-Preview folgt immer dem Dev-Kanal (Einstellungen → App-Updates) und legt vor jedem Update eine Sicherungskopie an. Die stabile App bietet nie eine Dev-Preview an.
- **Zurück zur stabilen Version:** Die stabile App ist ein separates Programm. Nutze sie weiter oder installiere sie neu; die Dev-Preview kannst du einfach löschen.
