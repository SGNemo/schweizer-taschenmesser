# Änderungsprotokoll

Aus den Änderungsnotizen (`.changes/`) beim Release erzeugt; englische Fassung: [CHANGELOG.md](CHANGELOG.md). Was seit dem letzten Release dazukam, steht als Notizen in `.changes/`.

## [1.0.0] – 2026-10-07

### Wichtig vor dem Update
- **App:** Daten der alten Module Einkauf, Packlisten, Apps & Links, Geburtstage, Geschenke, Verträge, Erinnerungen, Gewohnheiten, Zeiterfassung und News werden von 0.3.x nicht übernommen. Vorher unter Einstellungen → Backup sichern.
- **App:** Die Datenbank wird auf Version 19 umgestellt; danach läuft keine ältere App mehr mit diesen Daten. Alle per Sync verbundenen Geräte auf dieselbe Version bringen.
- **Installation:** Installationen bis 0.2.x können sich nicht mehr selbst aktualisieren und müssen neu installiert werden.

### Highlights
- **App:** Neue Oberfläche „Klar 2“ mit Übersicht, Bereichen, Seitenleiste, Einstellungen mit Suche und Tastenkürzeln.
- **App:** Fünf Sprachen: Deutsch, Englisch, Spanisch, Französisch und Portugiesisch (Brasilien).
- **KI:** KI-Einträge in jedem Modul mit Vorschau und Rückgängig, lokales Modell und ein Hauptschalter „KI abschalten“.

### Neu
- **App:** Fehler melden mit Vorschau, Wiederherstellungsbildschirm und sicherer Modus.
- **Kalender:** Benachrichtigungen vorab und wiederkehrende Todos.
- **Lesbarkeit:** Fokus- und Lesehilfen: „Als Nächstes“, Tagesplan, Fokusmodus, ruhige Erinnerungen, Lesehilfe, größere Schrift, weniger Bewegung. Alles abschaltbar.

### Geändert
- **App:** Module neu geordnet: Listen, Personen, Unterlagen, Kalender mit Erinnerungen; Werkzeuge von 18 auf 12.

### Sicherheit
- **App:** Sicherheitsprüfung vor dem Start; CodeQL-Befunde bearbeitet.

## [0.3.1] – 2026-10-01

### Geändert
- **App:** Neues „Nemo“-Schriftzug im Clownfisch-Stil in Seitenleiste und Kopfzeile.

## [0.3.0] – 2026-10-01

### Highlights
- **App:** Erste stabile Version unter dem Namen Nemo mit neuem Symbol und Schriftzug; Daten bleiben beim Update erhalten.

### Neu
- **App:** Einrichtungsassistent, Schnellerfassung, Modul „Dieser PC“, Vorrat, Zeiterfassung, Geschenkideen, neue Werkzeuge, flaches Design „Klar“.

### Geändert
- **Installation:** Dateien heißen jetzt Nemo-Portable.exe und Nemo.apk; die alten Taschenmesser-Dateien liegen als Kopien bei, damit Updates weiter laufen.

### Sicherheit
- **Sync:** Verschlüsselte Backups, Gerätetokens und neuer Sync-Tresor; Sicherungskopien vor Updates sind verschlüsselt.

## Ältere Änderungen

Versionen 0.3.0-beta.1 und alles vor 0.3.0 sind hier zusammengefasst: Umbenennung in Nemo (neues Logo, flaches Design), Einrichtungsassistent, Schnellerfassung, Dieser PC, Vorrat, Zeiterfassung, Geschenkideen, neue Werkzeuge; verschlüsselte Backups und neuer Sync-Tresor. Davor: portable Windows-App mit signiertem Selbst-Update, Android-App, Passwort-Tresor, KI mit mehreren Anbietern, Konnektoren, News, lokale Import-Schnittstelle und MCP (0.2.0) sowie die Phasen 1–6 ohne Releases. Listen je Commit: [GitHub Releases](https://github.com/SGNemo/schweizer-taschenmesser/releases).
