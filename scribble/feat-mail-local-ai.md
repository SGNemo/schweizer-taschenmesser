# Mail module, package 5: local model (note for the next chat)

- Everything mail→model goes through `core/mail/localAi.ts`; `isolation.test.ts` pins that nothing else imports it and that it has no cloud adapters/router.
- Loopback only on purpose (stricter than `isLocalHost`). If a LAN Ollama is wanted later it needs its own explicit opt-in and text.
- Not built: streaming output, summaries of whole threads (only the opened message), local-model prefill for the notification text (deliberately never).
- Plan 0–5 for the mail module is complete.
