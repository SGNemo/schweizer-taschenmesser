[English](backup.md) | **Deutsch**

# Backup

*Einstellungen → Backup* sichert alle Daten als Datei und spielt ein Backup wieder ein. Zugangsdaten (Sync-Token, Schlüssel) sind nie im Backup enthalten.

## Backup anlegen
- **Verschlüsselt exportieren (empfohlen):** Die Datei ist mit einem Passwort geschützt (Argon2id, AES-256), mindestens 8 Zeichen. Ohne dieses Passwort lässt sich das Backup nicht öffnen; es gibt keine Rücksetzung.
- **Backup herunterladen:** Eine JSON-Datei mit allen Einträgen im Klartext, inklusive gelöschter Einträge für korrektes Zusammenführen.
- **Passwort-Tresor:** Der Tresor hat zusätzlich einen eigenen verschlüsselten Export.
- **Dateien in Unterlagen** bleiben auf dem Gerät, auf dem sie hinzugefügt wurden, und sind nicht im Backup.

## Automatische Backups (Windows, Android)
In der installierten App sichert Nemo auf Wunsch regelmäßig verschlüsselt in den eigenen Datenordner und behält die neuesten Kopien. Rhythmus (täglich, wöchentlich) und Anzahl der Kopien sind einstellbar. Das Passwort liegt im Schlüsselspeicher des Geräts; notiere es dir trotzdem, sonst lassen sich die Kopien nicht öffnen. Im Browser (PWA) gibt es keine automatischen Backups.

## Backup prüfen
„Backup prüfen“ testet eine Datei, ohne deine Daten anzufassen: Dateiformat, Prüfsumme (SHA-256), Entschlüsselung, Inhalt, eine Probe-Wiederherstellung in eine temporäre Datenbank und die Anzahl je Modul.

## Wiederherstellen
- **Zusammenführen:** Es geht nichts verloren; bei Konflikten gewinnt die jeweils neuere Änderung.
- **Ersetzen:** Das Backup wird zum Stand. Einträge, die nicht im Backup stehen, werden gelöscht, auch auf anderen Geräten, sobald sie synchronisieren.
- Vorher zeigt die App, was sich je Modul ändert, und legt automatisch eine Sicherheitskopie deiner aktuellen Daten an. Bricht etwas ab, bleibt alles unverändert.
- Tabellen alter, entfernter Module werden beim Wiederherstellen übersprungen; die App sagt dir, wie viele.

Umzug zwischen Geräten geht auch ohne Datei über den [Sync-Server](sync.de.md).
