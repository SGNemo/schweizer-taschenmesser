**English** | [Deutsch](security.de.md)

# Security and privacy

## In short

- **Local first:** all data lives in the device's database (IndexedDB or app storage). There is no account and no Nemo cloud service.
- **Sync is optional** and only runs through a server you operate yourself. Content can be end-to-end encrypted; the server then only sees collection, IDs and timestamps.
- **AI sees no data:** the assistant only sends your question, the date and the field names of the active modules to a provider, never entries. Two exceptions are triggered only by you: in the chat you can attach a module's data (the app shows exactly what will be sent first), and through the local import API you can give an AI on your PC read access to individual modules. The password vault is invisible to AI, search and import.
- **Passwords:** vault with Argon2id and AES-256-GCM, key in the operating system's key store (Windows Credential Manager, Android Keystore), optional biometrics; screenshot protection in the Android app.
- **Downloads are signed:** the update payload is signed with the project's update key and checked before it is applied; the APK is signed with the project keystore. There is no Windows code-signing certificate (SmartScreen notice on first start). The app asks GitHub for updates once a day (on start and when it returns to the foreground); GitHub sees your IP address. Switch it off under Settings → App updates.
- **No telemetry, no ads.**

### External services without user data

The app opens these connections only in the cases named; apart from your IP address and the request itself nothing is transmitted:

- **GitHub** – daily update check (can be switched off) and update downloads.
- **frankfurter.dev** (ECB rates) – when the currency converter is opened.
- **api.ipify.org** – only on clicking "Öffentliche IP abfragen" (Dieser PC → System).
- **huggingface.co** – download of the local AI model, only after your confirmation (checksum verified).
- **Feed and calendar addresses** you subscribed to – directly in the app, in the browser through the proxy of your own sync server.
- **Google** – only with a connection you set up; **AI providers** – only with a key you stored.

### Securing the sync server

- The token protects the server; over plain HTTP in the LAN it travels unencrypted. Use HTTPS (Tailscale) or a
  trusted network. End-to-end encryption protects the *content*, not the token.
- No secrets in the repository: `.env` is ignored, only `.env.example` is checked in.
- Restrict `CORS_ORIGINS` to your address if you do not serve the PWA from the server itself.
- Every connected device can sign out other devices with its own token; resetting the server needs the shared admin token.
- The server's test suite: `cd server && npm test` (auth, rate limit, conflict rule, persistence, serving the PWA).

Please report security vulnerabilities confidentially, see [`SECURITY.md`](../../SECURITY.md). Internal reviews: [`docs/security/`](../security/).
