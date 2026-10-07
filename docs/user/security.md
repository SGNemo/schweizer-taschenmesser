**English** | [Deutsch](security.de.md)

# Security and privacy

## In short

- **Local first:** all data lives in the device's database (IndexedDB or app storage). There is no account and no Nemo cloud service.
- **Sync is optional** and only runs through a server you operate yourself. Content can be end-to-end encrypted; the server then only sees collection, IDs and timestamps.
- **AI sees no data:** the assistant only sends your question, the date and the field names of the active modules to a provider, never entries. The password vault is invisible to AI, search and import.
- **Passwords:** vault with Argon2id and AES-256-GCM, key in the operating system's key store (Windows Credential Manager, Android Keystore), optional biometrics; screenshot protection in the Android app.
- **Downloads are signed:** the update payload is signed with the project's update key and checked before it is applied; the APK is signed with the project keystore. There is no Windows code-signing certificate (SmartScreen notice on first start).
- **No telemetry, no ads.**

### Securing the sync server

- The token protects the server; over plain HTTP in the LAN it travels unencrypted. Use HTTPS (Tailscale) or a
  trusted network. End-to-end encryption protects the *content*, not the token.
- No secrets in the repository: `.env` is ignored, only `.env.example` is checked in.
- Restrict `CORS_ORIGINS` to your address if you do not serve the PWA from the server itself.
- The server's test suite: `cd server && npm test` (auth, rate limit, conflict rule, persistence, serving the PWA).

Please report security vulnerabilities confidentially, see [`SECURITY.md`](../../SECURITY.md). Internal reviews: [`docs/security/`](../security/).
