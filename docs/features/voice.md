# Voice input (push-to-talk)

One key (or the microphone button in the palette) turns speech into text in the existing search/AI input (`layout/CommandPalette.tsx`). The text is treated like typed text: it is appended to the field and the person sends it with Enter. Nothing is sent to the AI by the key itself.

## What works where (no new dependency)
Engine = the browser's Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). Only what is checked is marked ✔; the rest is from vendor documentation and **needs a hand test** ([MANUAL-TESTS](../MANUAL-TESTS.md) V1–V4).

| Platform | Engine | Result |
|---|---|---|
| Chrome / Edge (desktop, PWA) | present, audio goes to the vendor (Google / Microsoft) | usable; mock-tested in e2e ✔ |
| Chrome on Android (PWA) | present | usable (V3) |
| Safari | prefixed, vendor service | may work; not verified |
| Firefox | absent | hidden / "Hier nicht verfügbar" ✔ |
| Windows app (Tauri, WebView2) | constructor exists in Chromium-based WebView2, but the cloud service may refuse an embedded host (`network` / `service-not-allowed`) | the runtime error is mapped to a calm sentence; works or not decided by V1 |
| Android app (Tauri, System WebView) | **absent** in System WebView | hidden; a native recogniser would need a plugin = new dependency, not done |
| Linux dev shell (WebKitGTK) | absent | hidden |

Availability logic: `core/voice/support.ts` (`voiceSupport`: no API → `no-api`, insecure page → `insecure`). Unavailable = the key is not listened to, no mic button, the settings switch is disabled with "Hier nicht verfügbar". A failure at run time (`not-allowed`, `no-speech`, `network`, …) only ever shows a calm sentence, never an error screen.

## Behaviour
- Key (default `F4`, settable in Einstellungen → Schnellerfassung → Spracheingabe, shown in the `?` sheet): hold ≥ 400 ms = push-to-talk (release ends); a short tap keeps listening, the next tap ends. F-keys work inside text fields; other keys need Ctrl/Alt (`core/voice/keys.ts`). Match logic in `core/keyboard/shortcuts.ts`, listener in `layout/voice/useVoiceKey.ts` (needs key up).
- Button in the palette (`VoiceMic`) toggles; outside the palette a quiet pill (`VoiceStatus`) says "Ich höre zu …". Steady state, no animation, so reduced motion needs nothing special.
- Esc while recording: the recording is dropped, what was already typed stays, the palette stays open (`voice.cancel()`).
- Desktop only, optional: system-wide key (`desktop_set_voice_hotkey` in `capture.rs`, like the vault search key; off by default). One press starts, the next ends; the window comes forward and gets the constant event `tm-voice-toggle`.

## Privacy
- **Off by default** (device-local `tm-voice`), first switch-on shows a notice that the browser/system may send audio to its provider. The notice is stored as "seen", never the audio.
- Language = UI language (`recognitionLang`: de-DE, en-US, es-ES, fr-FR, pt-BR).
- Audio never reaches our code; recognised text lives in memory until the palette takes it; no storage, no logging, nothing in diagnostics (the diagnostics negative list does not read `tm-voice`). The AI receives the text only when the person sends it, under the usual rules (`privacy.test.ts`).

## Code
`core/voice/{support,machine,controller,store,settings,keys,hotkey}.ts` (pure state machine `machine.ts`, controller with an injectable recogniser), `layout/voice/*`, `pages/settings/VoiceSection.tsx`, texts `t.voice`. Tests: `core/voice/*.test.ts`, `e2e/voice.spec.ts` (mock recogniser).
