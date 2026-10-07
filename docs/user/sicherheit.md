# Sicherheit und Datenschutz

## In Kürze

- **Lokal zuerst:** Alle Daten liegen in der Datenbank des Geräts (IndexedDB bzw. App-Speicher). Es gibt kein Konto und keinen Cloud-Dienst von Nemo.
- **Sync ist optional** und läuft nur über einen Server, den du selbst betreibst. Inhalte lassen sich Ende-zu-Ende verschlüsseln; der Server sieht dann nur Sammlung, IDs und Zeitstempel.
- **KI sieht keine Daten:** Der Assistent schickt nur deine Frage, das Datum und die Feldnamen der aktiven Module an einen Anbieter, niemals Einträge. Zwei Ausnahmen löst nur du selbst aus: im Chat kannst du Daten eines Moduls anhängen (die App zeigt vorher genau, was mitgeschickt wird), und über die lokale Import-Schnittstelle kannst du einer KI auf deinem PC Leserechte für einzelne Module geben. Der Passwort-Tresor ist für KI, Suche und Import unsichtbar.
- **Passwörter:** Tresor mit Argon2id und AES-256-GCM, Schlüssel im Betriebssystem-Keystore (Windows Credential Manager, Android Keystore), optional Biometrie; Screenshot-Schutz in der Android-App.
- **Downloads sind signiert:** Der Update-Inhalt ist mit dem Update-Schlüssel des Projekts signiert und wird vor dem Einspielen geprüft; die APK ist mit dem Projekt-Keystore signiert. Ein Windows-Code-Signing-Zertifikat gibt es nicht (SmartScreen-Hinweis beim ersten Start). Die App fragt einmal täglich bei GitHub nach Updates (beim Start und beim Wechsel in den Vordergrund); GitHub sieht dabei deine IP-Adresse. Abschaltbar unter Einstellungen → App-Updates.
- **Keine Telemetrie, keine Werbung.**

### Externe Dienste ohne Nutzerdaten

Diese Verbindungen baut die App nur in den genannten Fällen auf; außer deiner IP-Adresse und der Anfrage selbst wird nichts übertragen:

- **GitHub** – täglicher Update-Check (abschaltbar) und Download von Updates.
- **frankfurter.dev** (Kurse der EZB) – beim Öffnen des Währungsrechners.
- **api.ipify.org** – nur auf Klick auf „Öffentliche IP abfragen“ (Dieser PC → System).
- **huggingface.co** – Download des lokalen KI-Modells, erst nach deiner Bestätigung (Prüfsumme wird kontrolliert).
- **Feed- und Kalender-Adressen**, die du abonniert hast – in der App direkt, im Browser über den Proxy deines eigenen Sync-Servers.
- **Google** – nur mit einer von dir eingerichteten Verbindung; **KI-Anbieter** – nur mit einem von dir hinterlegten Schlüssel.

### Sync-Server absichern

- Das Token schützt den Server; über reines HTTP im LAN läuft es unverschlüsselt – nutze HTTPS (Tailscale) oder ein
  vertrauenswürdiges Netz. Die Ende-zu-Ende-Verschlüsselung schützt die *Inhalte*, nicht das Token.
- Keine Secrets im Repository: `.env` ist ignoriert, nur `.env.example` ist eingecheckt.
- `CORS_ORIGINS` auf deine Adresse beschränken, wenn du die PWA nicht vom Server selbst auslieferst.
- Jedes verbundene Gerät kann mit seinem eigenen Token andere Geräte abmelden; zum Zurücksetzen des Servers ist das
  gemeinsame Admin-Token nötig.
- Der Server-Test-Stand: `cd server && npm test` (Auth, Rate-Limit, Konfliktregel, Persistenz, Auslieferung der PWA).

Sicherheitslücken bitte vertraulich melden, siehe [`SECURITY.md`](../../SECURITY.md). Interne Prüfungen: [`docs/security/`](../security/).
