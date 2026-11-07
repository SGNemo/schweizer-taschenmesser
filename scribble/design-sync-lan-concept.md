# design/sync-lan-concept – for the next chat (home-network sync, PC as server)

- Concept, decisions (provisional) and four package prompts: `docs/design/sync-lan/{CONCEPT,PACKAGES}.md` (PR `design/sync-lan-concept`). Package 1 starts only after Sven answered CONCEPT §11.
- Prototype: `node docs/design/sync-lan/proto/run.mjs` (no install). Handshake is IK-shaped (hub key only in the QR, PSK checked in message 1 = `IKpsk1`); it is Noise-*like*, not Noise – the product uses `snow`.
- Council went 5 rounds; the two blockers it found were both in the pairing handshake (XX leaked the hub key; IKpsk2 let old-QR holders reach the confirmation) and in key rotation (must wipe the hub store like `reset`). Read §4/§5 before touching pairing.
- Found, not fixed (out of scope): `docs/decisions/core.md` Sync bullet "PBKDF2 → AES-GCM" is stale – the code uses Argon2id (`web/src/core/crypto/kdf.ts`).
- Open, needs a device: whether Android keeps a backgrounded app alive long enough for the Wi-Fi callback; Windows firewall behaviour on first listen; a reliable "same home network" check on Windows (gateway MAC).
