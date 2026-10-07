<p align="center"><a href="README.md">English</a> | <strong>Deutsch</strong></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/header.de.png">
    <img src="docs/brand/header-light.de.png" alt="Nemo-Logo: der Schriftzug Nemo als Clownfisch mit Kopf, weißen Streifen und Schwanzflosse, darunter Notizen · Erinnerungen · Module · Offline" width="640">
  </picture>
</p>

<h1 align="center">Nemo</h1>

<p align="center">Kalender, ToDos, Finanzen, Passwörter und mehr in einer App. Deine Daten bleiben auf deinem Gerät.</p>

<p align="center">
  <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases"><img src="https://img.shields.io/github/v/release/SGNemo/schweizer-taschenmesser?label=Version" alt="Neueste stabile Version"></a>
  <a href="https://github.com/SGNemo/schweizer-taschenmesser/actions/workflows/ci.yml"><img src="https://github.com/SGNemo/schweizer-taschenmesser/actions/workflows/ci.yml/badge.svg?branch=develop" alt="CI-Status des develop-Branches"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Lizenz-MIT-3b82f6" alt="Lizenz: MIT"></a>
  <img src="https://img.shields.io/badge/Plattformen-Windows%20%C2%B7%20Android%20%C2%B7%20PWA-555" alt="Plattformen: Windows, Android und PWA">
</p>

<p align="center">
  <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo-Portable.exe"><img src="https://img.shields.io/badge/Windows-portabel_herunterladen-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows: portable Version herunterladen"></a>
  <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo.apk"><img src="https://img.shields.io/badge/Android-APK_herunterladen-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android: APK herunterladen"></a>
</p>

<p align="center">Die Buttons laden die neueste <strong>stabile</strong> Version. Vorabversionen (Beta) und alle Änderungen: <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases">Releases</a>. Die App-Oberfläche ist heute Deutsch; weitere Sprachen sind in Arbeit.</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/readme/dashboard-dark.png">
    <img src="docs/screenshots/readme/dashboard-light.png" alt="Nemo-Übersicht auf dem Desktop mit erfundenen Beispieldaten: Seitenleiste mit Favoriten und Bereichen, die Leiste Jetzt wichtig, eine vorgeschlagene Aufgabe zum Anfangen und der kurze Plan für heute" width="900">
  </picture>
</p>

## Was kann Nemo?

Module schaltest du in der **Modul-Bibliothek** einzeln ein. Alles funktioniert offline.

| Bereich | Module |
|---|---|
| Planen | **Kalender** (Monat, Woche, Tag, Termine anderer Module, Erinnerungen auch bei geschlossener App), **ToDos** (Listen, Prioritäten, Unteraufgaben, Wiederholung, „Irgendwann“), **Personen** (Geburtstage und Geschenke) |
| Geld | **Finanzen** (Konten, Buchungen, Kategorien, Kontoauszug-Import), **Rechnungen**, **Abos**, **Budgets & Sparziele** |
| Merken | **Notizen**, **Merkliste** und **Lesezeichen** (Links, Lesen, Ansehen, Orte), **Listen** (Einkauf, Packlisten, Checklisten), **Unterlagen** (Ausweise, Verträge, Garantien mit Fristen) |
| Sicher | **Accounts**: Passwort-Tresor mit Argon2id/AES-256, TOTP, Generator, Biometrie. Für KI, Suche und Import unsichtbar |
| Haushalt & PC | **Vorräte** (Ablaufdaten, Nachkaufen), **Dieser PC** (nur Windows-App: Platz analysieren, sicher aufräumen, Systeminfo) |
| Dazu | **Werkzeuge** (Rechner, Prozent, Währung, Timer, QR, Einheiten, JSON, Hash …), **Schnell erfassen** (Tastenkürzel, Tray, Teilen-Menü) |

Dazu eine **Befehlspalette** (Strg+K) mit Suche über alle Module und ein **KI-Assistent**, der einfache Fragen selbst beantwortet („Was steht heute an?“) und schwierigere an einen Anbieter deiner Wahl geben kann, ohne deine Daten zu senden. Details: [Module und Werkzeuge](docs/user/modules.de.md), [Suche und KI](docs/user/ai-assistant.de.md).

## Schnellstart

1. **Herunterladen:** Windows-Portable (eine Datei, keine Installation) oder Android-APK, Buttons oben.
2. **Starten:** Unter Windows die Datei doppelklicken (beim ersten Mal fragt SmartScreen: „Weitere Informationen“ → „Trotzdem ausführen“). Unter Android die APK öffnen und die Installation aus dieser Quelle erlauben.
3. **Einrichten:** Der Einrichtungsassistent führt durch Module, Tresor, optionalen Sync und KI. Alles ist optional und später in den Einstellungen änderbar.

Genauer, inklusive Umstieg von einer alten Version und PWA-Installation: [Installation](docs/user/installation.de.md).

## Datenschutz in Kürze

- **Lokal gespeichert.** Daten liegen in der Datenbank deines Geräts. Kein Konto, kein Nemo-Cloud-Dienst.
- **Sync optional.** Nur über einen Server, den du selbst betreibst (Docker oder Node), auf Wunsch Ende-zu-Ende verschlüsselt.
- **Nie Nutzerdaten an KI.** Der Assistent schickt nur deine Frage, das Datum und Feldnamen, niemals Einträge. Ausnahmen gibt es nur, wenn du sie selbst auslöst: im Chat Daten eines Moduls anhängen (mit Vorschau) oder einer KI über die lokale Schnittstelle Leserechte geben. Der Tresor ist für KI komplett unsichtbar.
- **Signierte Updates.** Jede Aktualisierung wird vor dem Einspielen mit dem Schlüssel des Projekts geprüft. Die App fragt dafür einmal täglich bei GitHub nach (abschaltbar unter Einstellungen → App-Updates). Details: [Sicherheit](docs/user/security.de.md).

<details>
<summary><strong>Installation: Windows portabel, Android, PWA</strong></summary>

**Windows:** Die exe braucht keine Installation und keine Adminrechte. Voraussetzung ist Microsoft WebView2 (auf Windows 10/11 meist vorhanden). Daten liegen im Benutzerprofil unter `%LOCALAPPDATA%\io.github.sgnemo.taschenmesser`; ein leerer Ordner `data` neben der exe macht sie portabel (USB-Stick). Updates: Einstellungen → App-Updates, mit automatischer Sicherungskopie und Signaturprüfung.

**Android:** APK öffnen, „Aus dieser Quelle zulassen“ für den Browser oder Dateimanager erlauben, installieren. Spätere Updates lädt die App selbst und prüft die Prüfsumme; Android akzeptiert nur APKs mit demselben Signaturschlüssel.

**Dev-Preview:** Nach jedem Stand von `develop` entsteht eine ungetestete Vorschau: <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-Portable-dev.exe">Windows</a> · <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-dev.apk">Android</a>. Das ist eine **eigene App „Nemo Dev“ mit eigenen Daten** und ersetzt die stabile App nicht.

Vollständige Anleitung: [Installation](docs/user/installation.de.md).
</details>

<details>
<summary><strong>Sync und Backup: eigener Server, Docker, Tailscale, Push</strong></summary>

Ein kleiner Node-Server (Fastify + SQLite) mit Token-Login, als Docker-Image mit ausgelieferter PWA oder direkt per Node. Von unterwegs am einfachsten über Tailscale mit HTTPS; optional Web-Push für Erinnerungen bei geschlossener App. Backups gehen als verschlüsselte Datei, in der installierten App auch automatisch. Anleitungen: [Sync-Server](docs/user/sync.de.md), [Backup](docs/user/backup.de.md).
</details>

<details>
<summary><strong>KI-Anbieter: Claude, OpenAI, Gemini, Groq, OpenRouter, Mistral, Ollama</strong></summary>

Mehrere Anbieter werden der Reihe nach gefragt (lokal → kostenlos → bezahlt), mit Limits pro Anbieter und Kostenübersicht. API-Schlüssel bleiben verschlüsselt auf dem Gerät. Vorhandene Daten kann eine KI im Format der App liefern, du bestätigst eine Vorschau. Anleitungen: [Suche und KI](docs/user/ai-assistant.de.md), [KI-Import](docs/AI-IMPORT.de.md).
</details>

<details>
<summary><strong>FAQ</strong></summary>

- **Warum warnt Windows beim ersten Start?** Die exe hat kein gekauftes Code-Signing-Zertifikat. Der Update-Inhalt ist trotzdem signiert und wird von der App geprüft.
- **Gibt es eine iOS-Version?** Nein. Auf dem iPhone lässt sich die PWA im Browser nutzen (ohne Push).
- **Kann ich meine Daten exportieren?** Ja, Einstellungen → Backup erzeugt eine Datei mit allem außer Zugangsdaten; der Tresor hat einen eigenen verschlüsselten Export.
- **Heißt das Projekt nicht „Schweizer Taschenmesser“?** Das war der alte Name. Technische Kennungen (Paketname, Dateipfade) behalten ihn, damit Updates und Daten erhalten bleiben.
- **Ist Nemo kostenlos?** Ja, MIT-Lizenz. Kosten entstehen nur bei bezahlten KI-Anbietern, die du selbst einrichtest.

Mehr: [FAQ](docs/user/faq.de.md).
</details>

## Unterstützen

Nemo ist und bleibt kostenlos, alle Funktionen stehen allen offen. Wer das Projekt freiwillig über [Ko-fi](https://ko-fi.com/nemojr) unterstützen möchte (jeder Betrag, einmalig), bekommt als Dankeschön einen Supporter-Code per Mail. Er schaltet rein kosmetische Extras frei: ein „Danke“-Abzeichen und zusätzliche Farbthemen. Den Code gibst du unter Einstellungen → Über Nemo → Supporter ein; er wird nur auf deinem Gerät geprüft, ohne Konto und ohne Tracking. Bezahlt wird ausschließlich auf der Seite des Zahlungsanbieters, die App verarbeitet keine Zahlungsdaten. Mehr: [SUPPORT.md](SUPPORT.md).

## Mehr

- [Website](https://nemo-adhd-helper.online)
- [Dokumentation](docs/README.md) für Nutzer und Entwickler
- [Roadmap](docs/ROADMAP.md) mit Ideen für spätere Versionen
- [Änderungen](CHANGELOG.md)
- [Mitmachen](CONTRIBUTING.md), [Sicherheitslücke melden](SECURITY.md), [Verhaltenskodex](CODE_OF_CONDUCT.md)
- [Lizenz: MIT](LICENSE). Logo und Name „Nemo“ sind für dieses Projekt gezeichnet und gedacht; bitte für Forks eigene verwenden.
