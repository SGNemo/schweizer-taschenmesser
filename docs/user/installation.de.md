[English](installation.md) | **Deutsch**

# Installation

Nemo gibt es als portable Windows-Datei, als Android-App und als PWA im Browser. Die Downloads zeigen immer auf die neueste **stabile** Version. Vorabversionen (Beta) findest du auf der [Release-Seite](https://github.com/SGNemo/schweizer-taschenmesser/releases).

- **Windows:** [Nemo-Portable.exe](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo-Portable.exe)
- **Android:** [Nemo.apk](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo.apk) (Prüfsumme: [Nemo.apk.sha256](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo.apk.sha256))

## Windows: eine einzelne Datei, keine Installation

1. `Nemo-Portable.exe` herunterladen und an einen beliebigen Ort legen, an dem du schreiben darfst
   (z. B. in einen Ordner unter deinem Benutzerverzeichnis; **nicht** nach `C:\Programme`), und doppelklicken.
2. Windows zeigt eventuell „Der Computer wurde durch Windows geschützt“ (SmartScreen), weil unbekannte
   `.exe`-Dateien ohne gekauftes Code-Signing-Zertifikat immer so behandelt werden: **„Weitere Informationen“ →
   „Trotzdem ausführen“**. Der Update-Inhalt ist mit dem Update-Schlüssel des Projekts signiert; die App prüft
   die Signatur vor jedem Update selbst (und verweigert unsignierte oder fremd signierte Dateien). Meldet Windows
   stattdessen die **intelligente App-Steuerung** (Smart App Control) ohne „Trotzdem ausführen“, lässt es unsignierte
   Apps gar nicht zu; mehr dazu und alle Klicks mit Edge-Download-Warnung: [Schritt für Schritt](https://nemo-adhd-helper.online/install) ([English](https://nemo-adhd-helper.online/en/install)).
3. **Voraussetzung: Microsoft WebView2.** Unter Windows 10/11 ist die Komponente in der Regel schon da (sie gehört zu
   Edge). Fehlt sie, erklärt die App das in einem Fenster und öffnet auf Wunsch die
   [Download-Seite](https://developer.microsoft.com/microsoft-edge/webview2/) („Evergreen Bootstrapper“).
4. **Updates:** Einstellungen → Updates. Die App legt zuerst eine Sicherungskopie an, lädt die neue `.exe`,
   prüft die Signatur, ersetzt sich selbst und startet neu (bei einem Fehler bleibt die alte Version erhalten).
   Dafür braucht der Ordner der `.exe` Schreibrechte.
   Hinweis: Version 0.2.x (Name „Taschenmesser“) kann sich nicht mehr selbst aktualisieren, weil neue Releases keine `Taschenmesser-…`-Dateien mehr enthalten. Einmal die aktuelle `Nemo-Portable.exe` bzw. `Nemo.apk` laden und installieren (Daten über Backup oder Sync mitnehmen).
5. **Wo liegen meine Daten?** Standardmäßig im Benutzerprofil (`%LOCALAPPDATA%\io.github.sgnemo.taschenmesser`), nicht
   neben der `.exe`; du kannst die Datei also jederzeit austauschen oder verschieben. **Portabler Modus (z. B. USB-Stick):**
   Lege einen leeren Ordner `data` neben die `.exe` – dann liegen die App-Daten dort statt im Benutzerprofil (die
   automatischen Update-Sicherungen bleiben in `%APPDATA%`).
6. **Tray-Symbol:** Ein Rechtsklick zeigt oben „Heute“: bis zu 5 Dinge von heute (nur Titel und Uhrzeit, nie Beträge); ein Klick öffnet den Eintrag. Abschaltbar unter Einstellungen → Schnellerfassung.

**Von der installierten Version (Setup/MSI, bis `0.2.0-beta.1`) umsteigen:** Die portable App nutzt dieselbe
App-Kennung und findet deine Daten im Benutzerprofil deshalb sofort wieder.
1. In der alten App: Einstellungen → Backup → exportieren (Sicherheitskopie).
2. `Nemo-Portable.exe` starten und prüfen, dass alles da ist (nicht gleichzeitig mit der alten App laufen lassen).
3. Die alte Version über „Apps & Features“ deinstallieren – im Deinstallationsfenster **„Anwendungsdaten löschen“ NICHT
   ankreuzen**. Falls doch etwas fehlt: Backup in der neuen App importieren.
Die alte installierte Version kann sich nicht selbst auf die portable Datei aktualisieren; der Umstieg ist einmalig manuell.

## Installation unter Android

1. `Nemo.apk` auf dem Handy herunterladen (z. B. im Chrome-Browser) und öffnen.
2. Android fragt beim ersten Mal, ob die **Installation aus unbekannten Quellen** erlaubt ist: **„Einstellungen“ →
   „Von dieser Quelle zulassen“** für den Browser bzw. die Dateien-App, dann zurück und „Installieren“. Play Protect
   kann eine zusätzliche Prüfung anbieten („Trotzdem installieren“ bzw. „App scannen“). Blockiert die **Automatische
   Blockierung** neuerer Samsung-Geräte die Installation: Einstellungen → Sicherheit und Datenschutz → Automatische
   Blockierung aus, installieren, wieder einschalten (solange sie an ist, scheitern auch Updates aus der App).
3. Für spätere Updates öffnest du Einstellungen → Updates und tippst auf „Jetzt aktualisieren“: Die App lädt das Update, prüft die
   Prüfsumme und übergibt an den Android-Installer (wenn gefragt, die Installation aus dieser Quelle erlauben). Die neue APK muss mit demselben
   Schlüssel signiert sein, sonst lehnt Android sie ab.

> **Daten aus der PWA übernehmen:** Die installierte App hat einen eigenen Speicher. Umzug über *Einstellungen → Backup*
> (Export in der PWA, Import in der App) oder einfach über den Sync-Server.

## Als PWA installieren
Chrome/Edge (Windows) bzw. Chrome (Android) öffnen → „App installieren“. Service Worker und Installation brauchen
HTTPS (oder `localhost`).


## Umzug von einer anderen App
**Einstellungen → Sync & Backup → Umzug von einer anderen App → Umzug starten** (auch über die Befehlspalette, „Aus anderer App importieren“). Drei Schritte auf einem Zettel:
1. **Woher kommst du?** Google, Apple, Microsoft, Todoist, TickTick, Notion, Evernote, Obsidian/Markdown, Kontoauszug, Passwort-Manager, Browser-Lesezeichen oder „Weiß ich nicht“. Nemo sagt, wo du den Export bekommst.
2. **Dateien:** Wähle die Dateien oder die ZIP so, wie sie ist (Google Takeout, Todoist-Sicherung, Notion-Export). Gelesen wird nur auf diesem Gerät.
3. **Prüfen:** Nemo zeigt, was es erkannt hat, warum, wie sicher und wie viel („Todoist (CSV) · 3 Projekte · 214 Aufgaben“). Danach die gewohnte Vorschau je Bereich: neu, bereits gespeichert, nicht lesbar und was warum draußen bleibt.

Trainings- und Ernährungs-Exporte aus Strong, Hevy und Cronometer (CSV) erkennt Nemo unter „Weiß ich nicht“ und übernimmt sie in Fitness (in Arbeit, vorher einschalten).

Wiederholungen (Todoist „jeden Montag“, TickTick-Wiederholungen) und geplante Dauern werden zu echten Wiederholungen und Aufwandsschätzungen. Jeder Umzug lässt sich ganz zurücknehmen: in der Zusammenfassung nach einem Umzug mit mehreren Teilen oder später unter **Letzte Umzüge** auf derselben Karte; was du seitdem geändert hast, bleibt. Passwörter werden nur im Tresor importiert, mit deinem Master-Passwort. Die Schaltfläche **Checkliste** zeigt weiter, was je Herkunft noch fehlt. Alles ist freiwillig.

## Dev-Preview (ungetestete Zwischenstände)

Nach einem grünen Push auf `develop`, der Code ändert, baut GitHub automatisch eine Vorschau (Windows-Portable und Android-APK). Sie ist für Tester gedacht und kann Fehler enthalten.

- **Eigene App, eigene Daten.** Die Dev-Preview heißt „Nemo Dev“ und läuft neben der stabilen App. Daten der stabilen App sind dort nicht vorhanden; hole sie per Sync oder Backup herüber. Unter Windows hat sie einen eigenen Datenordner (portabel: Ordner `data-dev` statt `data` neben der exe).
- **Download:** [Windows](https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-Portable-dev.exe) · [Android](https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-dev.apk). In der App zeigt ein „Dev“-Abzeichen, dass es die Vorschau ist.
- **Updates:** Die Dev-Preview folgt immer dem Dev-Kanal (Einstellungen → Updates) und legt vor jedem Update eine Sicherungskopie an. Die stabile App bietet nie eine Dev-Preview an.
- **Zurück zur stabilen Version:** Die stabile App ist ein separates Programm. Nutze sie weiter oder installiere sie neu; die Dev-Preview kannst du einfach löschen.
