# Decisions in full – Imports/API, connectors, disk module, setup assistant

Full text (decision, reason, source). One-line summary table: [DECISIONS](../DECISIONS.md).

New decisions go into the matching topic file as one bullet (not into this index).

- [features-imports-connectors](features-imports-connectors.md) – Imports & AI import API (preview before write, one format per collection, a move is one run, local AI import API, MCP wrapper); Connectors & network (own Google OAuth client, Gmail metadata only, narrow `/v1/proxy`, Spotify connector)
- [features-disk](features-disk.md) – Disk module & platform-only modules: `platforms`, own scan, size on volume, tree in Rust, recycle bin, block list, second confirmation in Rust, async webview commands, per-command permissions, results never persisted; `pdf-lib` pinned; pantry → shopping list event
- [features-setup](features-setup.md) – Setup assistant (manual start, device-local progress, per-step save, `setupSteps`, reuse, profiles, `connectOAuth` abort, first weekday); first run = three questions; setup step „Umzug von einer anderen App“
- [features-extension](features-extension.md) – Browser extension & vault bridge (2026-10): app as only source, native messaging, host mode of the exe, lockstep protocol, browsers, zip artifact, pairing, pipe name, origin matching, form score, `data-nemo-ignore`, strength, clipboard
- [features-capture-spotify](features-capture-spotify.md) – Comfort packages 4 and 2 (search hits, Quick Capture `n`/`r`; capture & presence: tray „Heute“, shortcuts), voice input, reminders by sentence, Spotify widget and player, Spotify playlist editing
- [features-mail](features-mail.md) – Several Google accounts; mail module package 1; Mail → Nemo entries; mail write actions; new-mail notifications; local model may read mail
- [features-kopf-leer](features-kopf-leer.md) – Use case „Kopf leer“ – capture and mail (Q1 …), packages 1, 2 (capture contract), 3b (invoice line), Nachlese
