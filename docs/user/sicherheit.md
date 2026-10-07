# Sicherheit und Datenschutz

## In Kürze

- **Lokal zuerst:** Alle Daten liegen in der Datenbank des Geräts (IndexedDB bzw. App-Speicher). Es gibt kein Konto und keinen Cloud-Dienst von Nemo.
- **Sync ist optional** und läuft nur über einen Server, den du selbst betreibst. Inhalte lassen sich Ende-zu-Ende verschlüsseln; der Server sieht dann nur Sammlung, IDs und Zeitstempel.
- **KI sieht keine Daten:** Der Assistent schickt nur deine Frage, das Datum und die Feldnamen der aktiven Module an einen Anbieter, niemals Einträge. Der Passwort-Tresor ist für KI, Suche und Import unsichtbar.
- **Passwörter:** Tresor mit Argon2id und AES-256-GCM, Schlüssel im Betriebssystem-Keystore (Windows Credential Manager, Android Keystore), optional Biometrie; Screenshot-Schutz in der Android-App.
- **Downloads sind signiert:** Der Update-Inhalt ist mit dem Update-Schlüssel des Projekts signiert und wird vor dem Einspielen geprüft; die APK ist mit dem Projekt-Keystore signiert. Ein Windows-Code-Signing-Zertifikat gibt es nicht (SmartScreen-Hinweis beim ersten Start).
- **Keine Telemetrie, keine Werbung.**

### Sync-Server absichern

- Das Token schützt den Server; über reines HTTP im LAN läuft es unverschlüsselt – nutze HTTPS (Tailscale) oder ein
  vertrauenswürdiges Netz. Die Ende-zu-Ende-Verschlüsselung schützt die *Inhalte*, nicht das Token.
- Keine Secrets im Repository: `.env` ist ignoriert, nur `.env.example` ist eingecheckt.
- `CORS_ORIGINS` auf deine Adresse beschränken, wenn du die PWA nicht vom Server selbst auslieferst.
- Jedes verbundene Gerät kann mit seinem eigenen Token andere Geräte abmelden; zum Zurücksetzen des Servers ist das
  gemeinsame Admin-Token nötig.
- Der Server-Test-Stand: `cd server && npm test` (Auth, Rate-Limit, Konfliktregel, Persistenz, Auslieferung der PWA).

Sicherheitslücken bitte vertraulich melden, siehe [`SECURITY.md`](../../SECURITY.md). Interne Prüfungen: [`docs/security/`](../security/).
