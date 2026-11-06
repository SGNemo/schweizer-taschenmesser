# Sync in the home network – the PC is the server (concept)

Branch `design/sync-lan-concept`, 2026-11-06. Status: **vorläufig** – decisions in §10 are provisional until Sven answers §11. No product code; prototype in [`proto/`](proto/). Facts with sources: [NOTES.md](NOTES.md) (cited as `N§x`). Package prompts: [PACKAGES.md](PACKAGES.md).

Sven's wish: "Beim Wechsel vom Handy auf den PC syncen und andersrum, nur im WLAN – wenn das Handy heimkommt und der PC an ist. Wenn es nur mit Server geht, soll mein PC der Server sein." Today: own sync server with address + token + passphrase, otherwise "Nicht verbunden".

## 1. Ist-Stand

- **Op:** `FieldOp {collection, id, field, hlc, value}`; HLC `"<ms13>-<ctr4>-<deviceId>"`, compared as strings, drift ≤ 1 h (N§3.1–2).
- **LWW:** twice – client `mergeOps` (`web/src/core/sync/ops.ts:55`), server SQL `WHERE excluded.hlc > field_state.hlc` (`server/src/store.ts:172-178`); both read `contract/lww-cases.json` (10 cases) (N§5).
- **Engine:** pull (pages of 1 000, server `seq` cursor, `epoch` reset → all dirty), then push (≤ 2 000 ops / 3 MB); triggers start, 60 s, `online`, visible, 1.5 s after a write; Web Lock across tabs (N§3.4–6).
- **E2E:** optional, preselected; AES-256-GCM per value, AAD `collection/id/field`, key from passphrase via Argon2id (64 MiB, t 3), salt + check value on the server; only `value` is hidden (N§3.7). Key = non-extractable `CryptoKey` in Dexie `_secrets`, not in `getPlatform().secrets` (N§3.8).
- **Server role:** Fastify + SQLite, stores per field only the greatest HLC and a `seq`, never merges; device tokens (SHA-256), revoke/rotate; also Web Push and a feed proxy; binds `0.0.0.0:8787`, CORS `*` (N§4).
- **Local API:** desktop only, off by default, loopback hard-coded with no setting, token as SHA-256, refuses `Origin`; it is the AI import API, not sync (N§6).
- **Shell:** tray + autostart exist (autostart starts hidden in the tray); "In den Tray minimieren statt beenden" defaults off (N§6). Android has no background service (N§7).

## 2. Nutzungsbild

| Szene | Was der Nutzer tut | Was die App zeigt | Was technisch passiert |
|---|---|---|---|
| Erstes Koppeln | ① PC: Einstellungen → Synchronisation → „Handy koppeln“. ② Handy: „Mit PC koppeln“ → Kamera auf den QR-Code. ③ PC: „Pixel 7 koppeln?“ → **Koppeln**. Kein Tippen. | PC: QR + „Gilt 2 Minuten“; danach „Pixel 7 ist gekoppelt“. Handy: „Mit Svens PC gekoppelt – gleiche ab …“ → „Abgeglichen“. | QR = Hub-Fingerprint + Einmalgeheimnis + Adress-Hinweis (§4). Handy findet den Hub per mDNS, Noise-Handshake mit dem Einmalgeheimnis, PC bestätigt, Hub trägt den statischen Schlüssel des Handys in die Vertrauensliste ein und übergibt im Kanal den Datenschlüssel. Erster Abgleich: beide schieben alles (`markAllDirty`), Feld-LWW führt zusammen. |
| Handy kommt heim | nichts | Nach wenigen Sekunden still „Abgeglichen · gerade eben“ (beim Öffnen der App) | WLAN-Callback bzw. App-Öffnen → mDNS-Suche nach dem gepinnten Fingerprint → Noise-Sitzung → Pull, Push. |
| PC aus | nichts | „PC nicht erreichbar · zuletzt abgeglichen heute 08:12“, grau, kein Rot, keine Meldung | Suche läuft ins Leere; Änderungen bleiben im Outbox; nächster Versuch beim nächsten Auslöser, Rückzug wie heute (5 s → 5 min). |
| Zwei PCs | Zweiter PC: „Mit PC koppeln“ wie ein Handy; statt der Kamera öffnet er die Kopplungsdatei vom Hub-PC (siehe unten) | Zweiter PC wie ein Handy: „Mit Svens PC gekoppelt“ | Genau **ein** Hub; weitere PCs sind Clients. Siehe Frage 4 und §10. |
| Handy unterwegs | nichts | „Wartet aufs Heimnetz · 3 Änderungen“, neutral | Kein Versuch außerhalb von WLAN; mobile Daten nie. Kein Tailscale im ersten Schritt (CGNAT `100.64/10` ist kein privates Netz nach §4). |
| Gerät verloren | PC: Geräteliste → „Pixel 7“ → **Kopplung lösen** | „Pixel 7 kann nicht mehr abgleichen.“ | Statischer Schlüssel raus aus der Vertrauensliste → jeder Handshake scheitert. Optional „Schlüssel erneuern“: neuer Datenschlüssel + `epoch`, alle gekoppelten Geräte laden neu hoch (bestehender `adoptEpoch`-Pfad). Daten auf dem verlorenen Gerät bleiben dort (Rest-Risiko §5). |
| Alter Server-Nutzer | nichts | Sync-Seite zeigt weiter seinen Server; „Im Heimnetz mit PC abgleichen“ ist ein zweiter Weg, nicht aufgezwungen | `selfHosted` bleibt unverändert; LAN ist ein zweiter `SyncAdapter`. Umstieg: §7. |

Zwei PCs, Klarstellung: der zweite PC koppelt wie ein Handy, aber ohne Kamera. Vorschlag: am Hub-PC zeigt „Gerät koppeln“ neben dem QR einen Knopf „Kopplungsdatei speichern“ (dieselben 59 Bytes als Datei, dieselben 2 Minuten); der zweite PC öffnet sie. unsicher: ob das als „kein Tippen“ reicht – sonst Webcam-Scan über `getUserMedia`.

## 3. Varianten

| Kriterium | (a) Node-Server als Sidecar | (b) Rust-Hub in Tauri | (c) Peer-to-Peer über das Op-Protokoll (PC-WebView als Hub) | (d) Server bleibt, nur Kopplung/Entdeckung neu |
|---|---|---|---|---|
| Aufwand (Pakete) | 4: Sidecar-Build + CI/Audit, Server-„LAN-Modus“ ohne Proxy/Push, Kopplung, UI | 5: Protokoll-Vertrag, Hub-Crate, Transport+Entdeckung, Client-Adapter, UI/Android | 5–6: Hub-Store in Dexie + Log/`seq`, Rust-Transport, Adapter, UI, Android; Hotspots `core/sync`, `core/db` | 3: mDNS im Server, QR mit Adresse + Gerätetoken, UI |
| Bundle-Größe (exe heute 10,3 MB, N§4) | **+ ~50–125 MB**: Node-Binary (gemessen 124,9 MB Linux v22; unsicher: Windows/SEA kleiner) + `better-sqlite3` 2,0 MB | unsicher: + 1–3 MB (`mdns-sd`, `snow`, SQLite gebündelt); `tokio`, `ring`, `rustls`, `hyper` sind schon im Lockfile (N§6) | unsicher: < 1 MB (Transport + mDNS), Store in IndexedDB | 0 in der App; Server separat (Docker/Node) |
| LWW-Wahrheit | ✓ die zwei bestehenden | **dritte Kopie** in Rust → muss `contract/lww-cases.json` in `cargo test` bestehen; Regeländerung (§5) | ✓ nur `mergeOps` (ops.ts) – auch die Log-Verdichtung des Hubs nutzt sie | ✓ die zwei bestehenden |
| Android-Hintergrund | Handy ist Client – gleich für alle Varianten (§6) | gleich | gleich, solange Handys nicht selbst lauschen (sonst schlechter) | gleich |
| Akku (Handy) | gleich: Client, nur bei Auslösern | gleich | gleich (Stern); echtes P2P mit lauschendem Handy: schlechter | gleich |
| Angriffsfläche im LAN | ganzer Fastify-Server (HTTP + Token, CORS `*`, Proxy `/v1/proxy`, Push) bis er beschnitten ist; Node-Laufzeit | kleiner Noise-Listener, nur Sync-Nachrichten, nur private Schnittstellen | wie (b), aber jede Anfrage erreicht JS in der WebView | wie heute: `0.0.0.0`, HTTP + Token |
| Wartung | Node-Laufzeit + natives Addon pro Plattform im Release; zwei Prozesse | zweite Implementierung des Protokolls → Protokoll-Vertrag nötig (§10) | Hub-Logik im Hotspot `core/sync`; hängt an einer WebView, die im Tray weiterlaufen muss (unsicher: Drosselung versteckter WebView2-Fenster) | keine neue, aber Sven betreibt weiter einen Server |
| Erfüllt „PC ist der Server“ ohne Einrichtung | ✓ | ✓ | ✓ | ✗ (Server bleibt Extra-Installation) |

**Empfehlung: (b).** Ein kleiner Rust-Hub im Desktop-Shell erfüllt Svens Wunsch ohne Extra-Installation, hält das Bundle bei ~10 MB statt ~60–130 MB und läuft auch dann, wenn die WebView im Tray schläft. Der Preis ist eine dritte LWW-Kopie – eine einzige SQL-Zeile wie im Server –, die per `cargo test` dieselben zehn Fälle aus `contract/lww-cases.json` bestehen muss, plus ein neuer Protokoll-Vertrag, den Node-Server und Rust-Hub gemeinsam erfüllen. (c) ist die Alternative, falls Sven „nur eine LWW-Kopie“ höher gewichtet als Robustheit im Tray (Frage 1).

Shape of (b): new crate `web/src-tauri/crates/lan-sync` (testable on Linux like `local-api`): `hub` (store: SQLite `field_state`/`device`/`meta` like `server/src/store.ts:112-154`, LWW in SQL), `noise` (snow), `discovery` (mdns-sd), `client` (used on Android and by a second PC). The PC's own WebView talks to its hub **in-process** through Tauri commands (no socket); the phone's WebView talks to its Rust client through Tauri commands, which speaks Noise to the hub. TS side: one new `SyncAdapter` `lan` (push/pull/info/devices map 1:1 to today's routes, N§3.5) behind `getPlatform().lanSync`. Meaning stays in TS (`mergeOps`), the hub only stores and numbers, like the Node server.

## 4. Entdeckung & Kopplung

- **mDNS/DNS-SD:** service `_nemo-sync._tcp.local`, instance name random (`nemo-3fa2`, never the PC's name), TXT `v=1`, `fp=<first 8 bytes of SHA-256(hub static key), hex>` – public, not secret; the display name ("Svens PC") travels only inside the encrypted channel.
  - Rust: [`mdns-sd`](https://crates.io/crates/mdns-sd) 0.21.7, Apache-2.0 OR MIT (announce + browse; desktop hub, also the Android client if multicast works there); alternative responder [`libmdns`](https://crates.io/crates/libmdns) 0.10.1, MIT.
  - Android: platform [`NsdManager`](https://developer.android.com/develop/connectivity/wifi/use-nsd) (no extra license); receiving multicast with a raw socket needs a [`WifiManager.MulticastLock`](https://developer.android.com/reference/android/net/wifi/WifiManager.MulticastLock) – both need an own Kotlin plugin (no Tauri API; unsicher: whether `mdns-sd` works on Android with only the lock).
  - Fallback: the QR carries the hub's IPv4:port; the phone remembers the last working address and tries it directly when mDNS finds nothing (multicast filtered). Pinning makes a wrong address harmless.
- **QR content** (59 bytes → `NEMO1:` + base64url, 85 characters, measured): version · hub fingerprint (32 B, full SHA-256 of the static Noise key) · one-time pairing secret (16 B) · expiry (2 min) · port · IPv4 hint. **No long-term secret:** the pairing secret is single-use (burned at the first handshake, prototype check `reusedQrRefused`) and expires; the data key is never in the QR. QR scan on Android: official [`tauri-plugin-barcode-scanner`](https://crates.io/crates/tauri-plugin-barcode-scanner) 2.5.3, Apache-2.0 OR MIT (the WebView `BarcodeDetector` path is unsicher on Android, N§6).
- **Key exchange:** each device has a static X25519 key (created on first use, stored like the sync key today; never synced, never in a backup). Pairing = **Noise `XXpsk3`** with the QR secret as PSK: mutual authentication, the phone checks the hub's static key against the QR fingerprint (MITM fails, check `wrongHubRefused`), the hub learns the phone's static key. Later sessions = Noise `XX` (no PSK); the hub accepts only keys in its trust list (check `strangerRefused`), the phone only the pinned hub key.
- **Device trust:** the hub keeps `device {id, name, staticKey, pairedAt, lastSeenAt, revokedAt}` (same shape as today's `device` table, N§4); the PC confirms each new pairing with one tap (③ in §2) – a photographed QR alone is not enough. "Kopplung lösen" sets `revokedAt`. Devices are never trusted by address.
- **Only RFC 1918 / link-local:** the hub binds the addresses of private interfaces only (10/8, 172.16/12, 192.168/16, 169.254/16; later IPv6 `fe80::/10`, `fc00::/7`), never `0.0.0.0`, never loopback; it drops peers from other ranges before the handshake; the phone refuses hubs announced at other addresses (prototype `isLanV4`).
- **Guest / company Wi-Fi:** client isolation or filtered multicast → nothing is found, nothing is sent except mDNS queries (which reveal the service name `_nemo-sync._tcp`, unsicher: tolerable). The phone does not remember SSIDs (reading the SSID needs location permission on Android, unsicher: from API 27/29) – pinning replaces it: a foreign network simply has no hub with this fingerprint. Status stays neutral: „Im Heimnetz abgleichen“.

## 5. Sicherheit

E2E stays mandatory in LAN mode (no switch): the hub stores only `enc:v1:` values, like an E2E server today. The data key is random (32 B), created by the hub, sent to a newly paired device **inside** the Noise channel, stored there as a non-extractable `CryptoKey` (as today, N§3.8); on the hub PC in `getPlatform().secrets` (OS keystore, N§3.8; unsicher: whether desktop has the native keystore or the WebCrypto fallback).

| Angreifer | Fähigkeit | Gegenmaßnahme | Rest-Risiko |
|---|---|---|---|
| Fremdes Gerät im WLAN | sieht mDNS, verbindet sich zum Port, rät | Nur Geräte mit Schlüssel in der Vertrauensliste; Kopplung nur mit Einmalgeheimnis (2 min) **und** Bestätigung am PC; Handshake-Rate-Limit pro Adresse | Sieht, dass ein Nemo-Hub da ist (TXT-Fingerprint = wiedererkennbar im selben LAN); DoS durch Verbindungsflut |
| ARP-Spoofing / MITM, gefälschte mDNS-Antwort | lenkt Verkehr um, spielt einen Hub | Handy pinnt den statischen Hub-Schlüssel (aus dem QR); Noise authentifiziert beide Seiten; Werte zusätzlich E2E | Kann den Abgleich blockieren (dann „PC nicht erreichbar“) |
| Mitlesender beim Koppeln (QR abfotografiert) | kennt Einmalgeheimnis für ≤ 2 min | Einmal gültig; PC fragt „Pixel 7 koppeln?“; Liste zeigt jedes gekoppelte Gerät | Wenn der Nutzer blind bestätigt: fremdes Gerät gekoppelt – sichtbar in der Liste |
| Gestohlenes, entsperrtes Handy | hat App, Daten, Schlüssel | Daten liegen lokal ohnehin offen (wie heute); am PC „Kopplung lösen“ sperrt künftigen Abgleich; optional „Schlüssel erneuern“ | Alles bis zum Verlust Synchronisierte ist auf dem Handy; Schutz nur durch Geräte-Sperre / Tresor-Biometrie |
| Malware auf dem PC (Nutzerrechte) | liest Dateien, Keystore, IndexedDB | keine – der Hub-PC hält Klartext in der App wie heute | Voller Datenzugriff; LAN-Modus ändert daran nichts (gleich wie heute mit lokalem Server) |
| Alter gekoppelter Laptop (verkauft/weitergegeben) | gültiger statischer Schlüssel | Geräteliste mit „zuletzt gesehen“, nach 90 Tagen Hinweis „lange nicht gesehen – lösen?“ (ruhig, einmal); Kopplung lösen | Bis zum Lösen könnte er im selben WLAN abgleichen |

**Transport: Noise (`snow` 0.10.0, Apache-2.0 OR MIT), nicht TLS.** Reasons: (1) mutual authentication by static keys is the native model – no certificates, no expiry, no clock dependence (HLC drift is already a sync error, N§3.6); (2) PSK pairing is a built-in pattern (`XXpsk3`), while rustls has no external-PSK support (unsicher); (3) pinning = compare 32 bytes, measured in the prototype. What would overturn it: an audit preference for rustls (already in the lock file) with pinned self-signed certificates plus a separate PSK proof after the TLS handshake – equally possible, more moving parts.

**Regel-Abgrenzung.** The Local API rule (`docs/RULES.md:8`: loopback only, never a bind-address setting) stays **unchanged**; the LAN hub is a separate service in a separate crate and must never share code paths that widen the Local API's address. **Vorschlag** for a new hard-rule line in root `CLAUDE.md` (+ full text in `docs/RULES.md`), only in package 1, only after Sven's yes:

> - **LAN sync (desktop hub):** separate from the Local API (whose loopback rule is unchanged); off until the first pairing; binds only private interface addresses (RFC 1918, link-local – never `0.0.0.0`, never a user-entered address) and drops other peers; Noise handshake, only devices in the trust list, pairing only by QR with a single-use secret ≤ 2 min plus confirmation on the PC; values always E2E-encrypted; never log payloads, keys or pairing secrets; its LWW copy (`crates/lan-sync`) passes `contract/lww-cases.json`.

and the Sync rule becomes (**Vorschlag**): "…the rule exists three times (`core/sync/ops.ts`, `server/src/store.ts`, `crates/lan-sync/src/store.rs`) and is pinned by `contract/lww-cases.json` – change all or none."

## 6. Wann wird abgeglichen

- **Android, in the foreground (package 4):** today's triggers stay (start, 60 s, visible, online, after a write, N§3.6). New: an own Kotlin plugin registers a [`ConnectivityManager.NetworkCallback`](https://developer.android.com/reference/android/net/ConnectivityManager.NetworkCallback) for `TRANSPORT_WIFI`; on "Wi-Fi available" it emits an event → `syncNow()`. Works while the process is alive (app open or recently backgrounded). Tauri 2 mobile has no network-change API of its own (unsicher: no official plugin found) → own plugin like `share-intent` (N§7).
- **Android, really in the background (not in the first round):** [WorkManager](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started) with `NetworkType.UNMETERED`, periodic ≥ 15 min. Problem: the sync logic and the data live in the WebView (IndexedDB), a worker has no WebView – it would have to start one headless or move the engine to Rust. unsicher: feasibility and battery; therefore Frage 3, recommendation "beim Öffnen + WLAN-Wechsel bei laufender App".
- **PC:** the hub runs while the app process runs (window or tray). Autostart exists and starts hidden in the tray (N§6). Because "In den Tray minimieren statt beenden" defaults off, the pairing screen shows the switch „Nemo im Tray weiterlaufen lassen, damit dein Handy abgleichen kann“ preselected (visible, one tap to turn off).
- **Fallback:** opening the app always syncs (today's start trigger).
- **Conflicts:** unchanged field LWW (`mergeOps`), conflict list `SyncConflicts` stays (N§8).

## 7. Migration

- Server users keep their path: `selfHosted` adapter, settings and docs unchanged; LAN is offered as a second way, not forced.
- Switch without data loss: ① automatic backup first (existing backup, mandatory step in the switch dialog) ② „Vom Server trennen“ (local data stays, `docs/user/sync.md:91`) ③ couple with the PC ④ first LAN sync: hub store is new → both sides push everything (`markAllDirty`), LWW merges. Because every device keeps its full data locally, nothing depends on the old server.
- E2E passphrase: LAN mode does not use it (random data key, handed over in the channel). The server's vault and passphrase stay on the server untouched; going back to the server = connect with the passphrase as today. Users who want a recoverable copy keep the encrypted backup (unchanged).
- One sync path at a time per device (no server + LAN in parallel in the first round): avoids two cursors/epochs in one engine. unsicher: whether Sven wants both at once (Frage 2).

## 8. UI-Skizze (Einstellungen → Synchronisation)

Built from today's parts (`ConnectParts`: `StateBanner`, `Step`, `Facts`, `Actions`, N§8); `design/settings-identity` is not merged (N§8), so no new building blocks.

```
Synchronisation
  [Banner, ruhig]  ✓ Abgeglichen · vor 2 Min.            (grau statt rot: „PC nicht erreichbar · zuletzt heute 08:12“)
                   Im Heimnetz mit „Svens PC“
  Fakten:          Letzter Abgleich  heute 10:41
                   Wartet            3 Änderungen
  [Jetzt abgleichen]                                      (deaktiviert mit Grund, wenn kein WLAN: „Nur im WLAN“)

  Gekoppelte Geräte                                        (am Hub-PC; am Handy nur „Dieses Gerät“ + Hub)
    Pixel 7          zuletzt gesehen vor 5 Min.  [Kopplung lösen]
    Laptop           zuletzt gesehen vor 94 Tagen · lange nicht gesehen  [Kopplung lösen]
  [Gerät koppeln]  → QR groß, „Gilt noch 1:42“, „Kopplungsdatei speichern“, Bestätigungsfrage beim Eintreffen
  [x] Nemo im Tray weiterlaufen lassen

  ▸ Eigener Server (erweitert)                             (heutige Maske, eingeklappt; offen, wenn verbunden)
```

Phone: one button „Mit PC koppeln“ (opens the scanner); after pairing the same banner. Focus rules ([FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md)): no toast or notification when the PC is unreachable (that is the normal state away from home); red only for real errors (decrypt failure, revoked) and always with text; one calm hint for long-unseen devices, once; no counters that grow guilt; wording „Wartet aufs Heimnetz“, never „Fehler“. Texts de/en first (package prompts), other locales via `check:i18n` in the UI package.

## 9. Prototyp

[`proto/`](proto/), run `node docs/design/sync-lan/proto/run.mjs` (Node ≥ 20, no install, no dependencies). `hub.mjs` (A) announces `_nemo-sync._tcp` via an own minimal mDNS (`mdns.mjs`, `dgram`), opens a one-time pairing window and prints the QR payload; `phone.mjs` (B) finds it, pairs with a Noise-*like* handshake (`channel.mjs`: X25519 + HKDF + AES-GCM, PSK from the QR, pinned hub key – **not** Noise, the product uses `snow`), receives the data key, pushes 1 000 E2E-encrypted ops (`enc:v1:`, same AAD as `crypto.ts`), pulls 2 000 back (1 000 from the PC + its own), decrypts, reconnects without PSK and runs three refusal checks. The hub's store is an append-only log **without** LWW (product: §3).

Measured 2026-11-06, container, both processes on one host over the interface address (not real Wi-Fi), 5 rounds, Node v22.23.4, Xeon 2.1 GHz:

| Measure | median | min | max |
|---|---|---|---|
| Discovery (mDNS query → resolved) | 4.3 ms | 4.1 | 7.2 |
| Pairing handshake + data key | 9.3 ms | 7.9 | 11.8 |
| Encrypt 1 000 values (E2E) | 15.4 ms | 13.0 | 24.6 |
| Push 1 000 ops (244 KiB) | 5.3 ms | 5.0 | 5.8 |
| Pull 2 000 ops (2 pages) | 9.2 ms | 8.4 | 13.4 |
| Decrypt 1 000 values | 11.9 ms | 11.0 | 12.9 |
| Reconnect (session handshake + empty pull) | 5.0 ms | 3.8 | 5.1 |
| Throughput push / pull | ≈ 189 000 / 217 000 ops/s | | |

Checks, all 5 rounds ok: `decryptedOk`, `sessionUpToDate`, `reusedQrRefused`, `strangerRefused`, `wrongHubRefused`. Reading: crypto and transport cost nothing noticeable; on real Wi-Fi discovery is dominated by mDNS timing (responders may delay answers 20–120 ms, RFC 6762 §6) and Wi-Fi latency – unsicher: real numbers need a phone (package 4 measures them). The first full sync of a large database is bounded by the existing engine (pages of 1 000), not by the LAN.

## 10. Entschieden (vorläufig)

- **Variant (b), Rust hub in the desktop shell.** Why: no extra install, ~1–3 MB instead of ~50–125 MB, runs while the WebView sleeps in the tray. Overturned by: Sven weighting one LWW copy over tray robustness (→ (c)), or a measurement showing hidden WebView2 is never throttled (then (c) loses its main drawback).
- **Star topology, exactly one hub (a PC); phones and further PCs are clients.** Why: one `seq` per store keeps today's cursor model; no phone listens (battery). Overturned by: a real need for phone↔phone without PC.
- **Transport Noise (`XXpsk3` pairing, `XX` + trust list afterwards) via `snow`.** Why: §5. Overturned by: a security review preferring rustls with pinned certificates.
- **QR carries no long-term secret;** single-use 16-byte secret, 2 min, plus a confirmation tap on the PC. Overturned by: a pairing flow test showing the tap confuses (then: PC shows the device name without asking, list stays the control).
- **E2E always on in LAN mode, random data key handed over in the channel, no passphrase.** Why: no typing; hub store holds only ciphertext. Overturned by: Sven wanting a passphrase-recoverable LAN store (then Argon2id as today, typed once per device).
- **Only private addresses, bound explicitly; no Tailscale in round 1.** Why: §4; Tailscale `100.64/10` is CGNAT. Overturned by: Sven wanting LAN sync on the go (then a separate rule for the Tailscale interface).
- **Third LWW copy pinned by a Rust contract test + new protocol contract (`contract/protocol-cases.json`) run by server and hub tests.** Why: "LWW only where the contract checks it"; protocol parity between Node and Rust. Overturned by: choosing (c).
- **Server path stays; one path per device at a time.** Overturned by: Frage 2.
- **Android: foreground + Wi-Fi callback while the process lives; no WorkManager in round 1.** Overturned by: Frage 3.

## 11. Fragen an Sven (Empfehlung zuerst)

1. **Variante:** (b) Rust-Hub im PC (empfohlen: klein, läuft im Tray, eine zusätzliche, per Test gepinnte LWW-Kopie) · (c) PC-App selbst als Hub (nur eine LWW-Kopie, aber die WebView muss im Tray wach bleiben) · (a) Node-Server mitliefern (+50–125 MB).
2. **Alter Server-Weg:** bleibt als „Eigener Server (erweitert)“, eingeklappt (empfohlen) · bleibt und darf parallel zum Heimnetz laufen · wird später entfernt.
3. **Android:** Abgleich beim Öffnen und beim WLAN-Wechsel, solange die App läuft (empfohlen) · zusätzlich echter Hintergrund-Abgleich alle ≥ 15 min (eigenes Paket, Akku/Machbarkeit offen).
4. **Mehr als ein PC:** ein Haupt-PC ist der Hub, weitere PCs koppeln sich wie ein Handy (empfohlen) · jeder PC kann Hub sein, das Handy nimmt den, der an ist (deutlich mehr Aufwand: mehrere Stores, Abgleich Hub↔Hub).
