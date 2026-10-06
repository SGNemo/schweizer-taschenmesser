<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/header.png">
    <img src="docs/brand/header-light.png" alt="Nemo: der Schriftzug Nemo als Clownfisch mit Kopf, weißen Streifen und Schwanzflosse, darunter „Notizen · Erinnerungen · Module · Offline“" width="640">
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

<p align="center">Die Buttons laden die neueste <strong>stabile</strong> Version. Vorabversionen (Beta) und alle Änderungen: <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases">Releases</a>.</p>

<details>
<summary><strong>Dev-Preview (ungetestet)</strong></summary>

Nach jedem Stand von `develop` entsteht automatisch eine Vorschau: <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-Portable-dev.exe">Windows</a> · <a href="https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-dev.apk">Android</a>. Das ist eine **eigene App „Nemo Dev“ mit eigenen Daten**, ungetestet und nicht für den Alltag gedacht. Sie ersetzt die stabile Nemo-App nicht. Mehr dazu: [Installation](docs/user/installation.md#dev-preview-ungetestete-zwischenstände).
</details>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/readme/dashboard-dark.png">
    <img src="docs/screenshots/readme/dashboard-light.png" alt="Nemo-Übersicht auf dem Desktop mit erfundenen Beispieldaten: Seitenleiste mit Modulen, Karten für heutige Termine und Erinnerungen, offene Aufgaben, Kontostand und fällige Rechnungen" width="900">
  </picture>
</p>

## Was kann Nemo?

Module schaltest du in der **Modul-Bibliothek** einzeln ein. Alles funktioniert offline.

| Bereich | Module |
|---|---|
| Planen | **Kalender** (Monat, Woche, Tag, Termine anderer Module, Benachrichtigung vor Terminen, Erinnerungen auch bei geschlossener App), **ToDos** (Listen, Prioritäten, Unteraufgaben, Wiederholung, „Irgendwann“), **Personen** (Geburtstage und Geschenke) |
| Geld | **Finanzen** (Konten, Buchungen, Kategorien, Kontoauszug-Import), **Rechnungen**, **Abos**, **Budgets & Sparziele** |
| Merken | **Notizen**, **Merkliste** und **Lesezeichen** (Links, Lesen, Ansehen, Orte), **Listen** (Einkauf, Packlisten, Checklisten), **Unterlagen** (Ausweise, Verträge, Garantien mit Fristen) |
| Sicher | **Accounts**: Passwort-Tresor mit Argon2id/AES-256, TOTP, Generator, Biometrie. Für KI, Suche und Import unsichtbar |
| Haushalt & PC | **Vorräte** (Ablaufdaten, Nachkaufen), **Dieser PC** (nur Windows-App: Platz analysieren, sicher aufräumen, Systeminfo) |
| Dazu | **Werkzeuge** (Rechner, Prozent, Währung, Timer, QR, Einheiten, JSON, Hash …), **Schnell erfassen** (Tastenkürzel, Tray, Teilen-Menü) |

Dazu eine **Befehlspalette** (Strg+K) mit Suche über alle Module und einem **KI-Assistenten**, der einfache Fragen selbst beantwortet („Was steht heute an?“) und komplexere optional an einen Anbieter deiner Wahl gibt, ohne deine Daten zu senden. Details: [Module und Werkzeuge](docs/user/module.md), [Suche und KI](docs/user/ki-assistent.md).

## Wie fange ich an?

1. **Herunterladen:** Windows-Portable (eine Datei, keine Installation) oder Android-APK, Buttons oben.
2. **Starten:** Unter Windows die Datei doppelklicken (beim ersten Mal SmartScreen: „Weitere Informationen“ → „Trotzdem ausführen“). Unter Android die APK öffnen und die Installation aus dieser Quelle erlauben.
3. **Einrichten:** Der Einrichtungsassistent führt durch Module, Tresor, optionalen Sync und KI. Alles ist optional und später in den Einstellungen änderbar.

Genauer, inklusive Umstieg von einer alten Version und PWA-Installation: [Installation](docs/user/installation.md).

## Was passiert mit meinen Daten?

- **Lokal gespeichert.** Daten liegen in der Datenbank deines Geräts, kein Konto, kein Nemo-Cloud-Dienst.
- **Sync optional.** Nur über einen Server, den du selbst betreibst (Docker oder Node), auf Wunsch Ende-zu-Ende verschlüsselt.
- **Nie Nutzerdaten an KI.** Der Assistent schickt nur deine Frage, das Datum und Feldnamen, niemals Einträge. Der Tresor ist für KI komplett unsichtbar.
- **Signierte Updates.** Jede Aktualisierung wird vor dem Einspielen mit dem Schlüssel des Projekts geprüft. Details: [Sicherheit](docs/user/sicherheit.md).

<details>
<summary><strong>Windows: Portable, SmartScreen, Daten, Updates</strong></summary>

Die exe braucht keine Installation und keine Adminrechte. Voraussetzung ist Microsoft WebView2 (auf Windows 10/11 meist vorhanden). Daten liegen im Benutzerprofil unter `%LOCALAPPDATA%\io.github.sgnemo.taschenmesser`; ein leerer Ordner `data` neben der exe macht sie portabel (USB-Stick). Updates: Einstellungen → App-Updates, mit automatischer Sicherungskopie und Signaturprüfung. Vollständige Anleitung: [Installation](docs/user/installation.md#windows-eine-einzelne-datei-keine-installation).
</details>

<details>
<summary><strong>Android: APK installieren und aktualisieren</strong></summary>

APK öffnen, „Aus dieser Quelle zulassen“ für den Browser oder Dateimanager erlauben, installieren. Spätere Updates lädt die App selbst und prüft die Prüfsumme; Android akzeptiert nur APKs mit demselben Signaturschlüssel. Daten aus der PWA übernimmst du per Backup oder Sync. Anleitung: [Installation](docs/user/installation.md#installation-unter-android).
</details>

<details>
<summary><strong>Sync-Server: Docker, Tailscale, Push</strong></summary>

Ein kleiner Node-Server (Fastify + SQLite) mit Token-Login, als Docker-Image mit ausgelieferter PWA oder direkt per Node. Von unterwegs am einfachsten über Tailscale mit HTTPS; optional Web-Push für Erinnerungen bei geschlossener App. Anleitung und Umgebungsvariablen: [Sync-Server](docs/user/sync-server.md).
</details>

<details>
<summary><strong>KI-Anbieter: Claude, OpenAI, Gemini, Groq, OpenRouter, Mistral, Ollama</strong></summary>

Mehrere Anbieter werden der Reihe nach gefragt (lokal → kostenlos → bezahlt), mit Limits pro Anbieter und Kostenübersicht. API-Schlüssel bleiben verschlüsselt auf dem Gerät. Vorhandene Daten kann eine KI im Format der App liefern, du bestätigst eine Vorschau. Anleitung: [Suche und KI](docs/user/ki-assistent.md), [KI-Import](docs/AI-IMPORT.md).
</details>

<details>
<summary><strong>FAQ</strong></summary>

- **Warum warnt Windows beim ersten Start?** Die exe hat kein gekauftes Code-Signing-Zertifikat. Der Update-Inhalt ist trotzdem signiert und wird von der App geprüft.
- **Wo ist die iOS-Version?** Es gibt keine. Auf dem iPhone lässt sich die PWA im Browser nutzen (ohne Push).
- **Kann ich meine Daten exportieren?** Ja, Einstellungen → Backup erzeugt eine JSON-Datei mit allem außer Zugangsdaten; der Tresor hat einen eigenen verschlüsselten Export.
- **Heißt das Projekt nicht „Schweizer Taschenmesser“?** Das war der alte Name. Technische Kennungen (Paketname, Dateipfade) behalten ihn, damit Updates und Daten erhalten bleiben.
- **Ist Nemo kostenlos?** Ja, MIT-Lizenz. Kosten entstehen nur bei bezahlten KI-Anbietern, die du selbst einrichtest.
</details>

## Unterstützen

Nemo ist und bleibt kostenlos, alle Funktionen stehen allen offen. Wer das Projekt freiwillig unterstützen möchte (jeder Betrag, einmalig), bekommt als Dankeschön einen Supporter-Code per Mail und damit rein kosmetische Extras: ein „Danke“-Abzeichen und zusätzliche Farbthemen. Den Code gibst du unter Einstellungen → Über Nemo → Supporter ein; er wird nur auf deinem Gerät geprüft, ohne Konto und ohne Tracking. Bezahlt wird ausschließlich auf der Seite des Zahlungsanbieters, die App verarbeitet keine Zahlungsdaten.

## Wo gibt es mehr?

- [Dokumentation](docs/README.md) mit Nutzer- und Entwicklerdoku
- [Roadmap](docs/ROADMAP.md) mit Ideen für spätere Versionen
- [Änderungen](CHANGELOG.md)
- [Mitmachen](CONTRIBUTING.md), [Sicherheitslücken melden](SECURITY.md)
- [Lizenz: MIT](LICENSE). Logo und Name „Nemo“ sind für dieses Projekt gezeichnet und gedacht; bitte für Forks eigene verwenden.
