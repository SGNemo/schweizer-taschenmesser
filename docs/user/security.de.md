[English](security.md) | **Deutsch**

# Sicherheit und Datenschutz

## In Kürze

- **Lokal zuerst:** Alle Daten liegen in der Datenbank des Geräts (IndexedDB bzw. App-Speicher). Es gibt kein Konto und keinen Cloud-Dienst von Nemo.
- **Sync ist optional** und läuft nur über einen Server, den du selbst betreibst, oder im Heimnetz direkt zwischen deinen gekoppelten Geräten (immer verschlüsselt). Inhalte lassen sich Ende-zu-Ende verschlüsseln; der Server sieht dann nur Sammlung, IDs, Feldnamen und Zeitstempel.
- **KI sieht keine Daten:** Der Assistent schickt nur deine Frage, das Datum und die Feldnamen der aktiven Module an einen Anbieter, niemals Einträge. Zwei Ausnahmen löst nur du selbst aus: im Chat kannst du Daten eines Moduls anhängen (die App zeigt vorher genau, was mitgeschickt wird), und über die lokale Import-Schnittstelle kannst du einer KI auf deinem PC Leserechte für einzelne Module geben. Der Passwort-Tresor ist für KI, Suche und Import unsichtbar.
- **Passwörter:** Tresor mit Argon2id und AES-256-GCM, Schlüssel im Betriebssystem-Keystore (Windows Credential Manager, Android Keystore), optional Biometrie; Screenshot-Schutz in der Android-App.
- **Downloads sind signiert:** Der Update-Inhalt ist mit dem Update-Schlüssel des Projekts signiert und wird vor dem Einspielen geprüft; die APK ist mit dem Projekt-Keystore signiert. Ein Windows-Code-Signing-Zertifikat gibt es nicht (SmartScreen-Hinweis beim ersten Start). Die App fragt einmal täglich bei GitHub nach Updates (beim Start und beim Wechsel in den Vordergrund); GitHub sieht dabei deine IP-Adresse. Abschaltbar unter Einstellungen → Updates.
- **Keine Telemetrie, keine Werbung.**

### Verbindungen, die die App aufbaut

Diese Verbindungen baut die App nur in den genannten Fällen auf. Wo eine Zeile nichts anderes nennt, werden nur deine IP-Adresse und die Anfrage selbst übertragen:

- **GitHub** – täglicher Update-Check (abschaltbar) und Download von Updates.
- **frankfurter.dev** (Kurse der EZB) – beim Öffnen des Währungsrechners.
- **open-meteo.com** (Wetter) – erst nachdem du einen Ort gewählt hast: der Ortsname beim Suchen, danach seine auf etwa einen Kilometer gerundete Position (für die 7-Tage-Vorhersage), etwa alle 30 Minuten, solange die Übersicht offen ist. Abschaltbar unter Einstellungen → Verbindungen → Wetter.
- **api.ipify.org** – nur auf Klick auf „Öffentliche IP abfragen“ (Dieser PC → System).
- **huggingface.co** – Download des lokalen KI-Modells, erst nach deiner Bestätigung (Prüfsumme wird kontrolliert).
- **Feed- und Kalender-Adressen**, die du abonniert hast – in der App direkt, im Browser über den Proxy deines eigenen Sync-Servers.
- **Google** und **Spotify** – nur mit einer von dir eingerichteten Verbindung (Google: Kalender; beim Import (Rechnungen, Abos, Termine, Verträge) und im Modul E-Mail deine E-Mails – die Liste, den Text der Mails, die du öffnest, Anhänge, wenn du sie speicherst oder weiterleitest; Senden und Aufräumen nur, wenn du „E-Mails senden“ oder „E-Mails verwalten“ einschaltest; „Bilder laden“ in einer Mail oder die Einstellung „Immer laden“ ruft die Bildadressen ab, die der Absender gewählt hat. Spotify: was gerade läuft, deine Playlists und Bibliothek, Steuerbefehle und was du per Klick änderst; Titel und Interpret bleiben auf diesem Gerät); **KI-Anbieter** – nur mit einem von dir hinterlegten Schlüssel.
- **Karten** (OpenStreetMap und darauf aufbauende freie Dienste für Ortssuche, Routen und Orte in der Nähe; transitous.org) – nur im Modul Karten: der Kartenausschnitt, dein Suchbegriff, Start und Ziel einer Route.
- **Eingebauter Browser** (Windows und Android, aus, bis du das Modul einschaltest), **Downloads** (Windows, nur auf deinen Klick) und **Torrent** (Windows, aus, bis du es einschaltest) – die Seiten und Dateien, die du anforderst; bei Torrent sehen andere Nutzer des Torrent-Netzes deine IP-Adresse und was du lädst, und geladene Teile werden zugleich angeboten.
- **Heimnetz** – Abgleich, Austausch und Fernsteuerung zwischen deinen eigenen gekoppelten Geräten im Heimnetz, verschlüsselt, ohne Server; der PC meldet sich dafür im Heimnetz, während du ein Gerät koppelst und solange eines gekoppelt ist.
- **Erinnerungen als Push** (Browser-App, aus, bis du es einschaltest) – Titel und Text deiner Erinnerungen gehen an deinen eigenen Sync-Server und von dort an den Push-Dienst deines Browsers; verschlüsselt, wenn dein Sync verschlüsselt ist.

### Sync-Server absichern

- Das Token schützt den Server; über reines HTTP im LAN läuft es unverschlüsselt – nutze HTTPS (Tailscale) oder ein
  vertrauenswürdiges Netz. Die Ende-zu-Ende-Verschlüsselung schützt die *Inhalte*, nicht das Token.
- Keine Secrets im Repository: `.env` ist ignoriert, nur `.env.example` ist eingecheckt.
- `CORS_ORIGINS` auf deine Adresse beschränken, wenn du die PWA nicht vom Server selbst auslieferst.
- Jedes verbundene Gerät kann mit seinem eigenen Token andere Geräte abmelden; zum Zurücksetzen des Servers ist das
  gemeinsame Admin-Token nötig.
- Der Server-Test-Stand: `cd server && npm test` (Auth, Rate-Limit, Konfliktregel, Persistenz, Auslieferung der PWA).

Sicherheitslücken bitte vertraulich melden, siehe [`SECURITY.md`](../../SECURITY.md). Interne Prüfungen: [`docs/security/`](../security/).
