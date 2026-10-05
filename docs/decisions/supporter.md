# Decisions in full – supporter mode

One-line table: [DECISIONS](../DECISIONS.md). Design: [architecture/supporter.md](../architecture/supporter.md).

- **Cosmetic only, nothing behind a paywall.** Goodies are a badge, colour themes and a logo variant; no feature, widget, data or AI behaviour changes. No nag screen, pop-up or countdown; hints only in Über Nemo, Settings → Supporter and once, dismissible, at the end of the setup assistant. A reason to keep it honest: the app stays free, support is a thank-you loop.
- **Offline verification with an embedded Ed25519 public key.** No online check, tracking, revocation list or expiry. Consequence: a leaked code cannot be revoked; accepted because the damage is cosmetic. Rotation by key id.
- **Established library, no own crypto:** `@noble/curves` (audited, pure JS) instead of WebCrypto Ed25519 (patchy in older Android WebViews) – one implementation for app, CLI and service.
- **Code length ≈ 130 symbols** (a 64-byte signature alone is ~103). A 16-symbol code would need an online lookup or a weaker scheme; both rejected. Paste is the main path.
- **Derived status:** the synced setting holds only the code; tier/name/date are recomputed by verification, so sync cannot be abused to inject a status.
- **Separate service, no link to the sync server or user data.** It knows only: webhook event, buyer mail for the send, generated code. Hosting: Cloudflare Worker (KV, Queues with retry/DLQ on the free plan), mail via Resend.
- **Key variant A (live signing, private key as Worker secret) over B (pre-signed stock).** B keeps the key off the host but needs refilling, cannot carry a name or issue date per buyer, and strands unused codes. A's worst case (key leak) lets someone mint cosmetic codes; mitigation = key rotation. Chosen by the maintainer.
- **Provider: Ko-fi first** (verification token, mail and transaction id in the payload); Buy Me a Coffee can be added as a second adapter.
- **Tiers are display only** (kaffee < 10 €, kuchen ≥ 10 €, plus `developer` for the maintainer); the amount never reaches the app. A display name only with consent (public donation).
- **Dev-Preview is "Entwickler" by default via the existing dev flag, not via a code**; stable builds contain no such path (`devFlag.test.ts`). Key id 255 = public test key, trusted only by the E2E build.
- **Setup hint = new `hint` step kind**, never counted in the checklist, no `SETUP_VERSION` bump.
