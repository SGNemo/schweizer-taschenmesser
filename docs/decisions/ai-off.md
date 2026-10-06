# Decisions – AI off (feat/ai-off, 2026-10-06)

Index: [DECISIONS](../DECISIONS.md). Code: `web/src/core/ai/switch.ts`, `pages/settings/AiSwitchSection.tsx`.

- **One master switch "KI abschalten" (Einstellungen → KI, top), reversible with one button.** Off removes every AI surface: assistant entries in the palette, "Mit KI eintragen" (module pages, quick add), the AI settings sections, the AI setup steps, outgoing provider calls and the local AI import API (server down, tokens revoked). The normal search and the calculator stay.
- **Turning off deletes immediately** (maintainer decision): provider list, API keys, cache, usage statistics, API tokens. Turning on again starts unconfigured. Reason: "off" must be provable, not hidden.
- **Scope is a choice:** "Nur dieses Gerät" (`tm-ai-off`, like the keys that never leave a device) or "Alle Geräte dieses Kontos" (synced setting `ai.switch`). Keys are device-local, so every device that sees "off" purges itself (`AiOffEnforcer` on app start and when the synced value arrives).
- **Setup assistant:** the AI steps are skipped while off; the AI step offers "Ich möchte keine KI nutzen".
- **Gating at the consumers, not in the manifests:** `aiSchema` stays (the data API reads titles from it).
