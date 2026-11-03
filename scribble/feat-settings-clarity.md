# feat/settings-clarity – notes for the next chat

- Rarely needed sections are listed in `core/settings/registry/meta.ts` (`ADVANCED_SECTIONS`); scope per core section is there too. Keep that file free of component imports (the planned bundle split reads it from the palette).
- A new `ResetPlan` needs `defaults()` so the reset row can tell "differs"; a new module field needs `help` (or an entry in `strings.settingsHelp.ts`), a test enforces it.
- `core/settings/warnings.ts` is the one place for "weaker choice" notes; add `<section>--<field>` rules, texts in `strings.settings2.ts` (`notes`).
- e2e: `/settings/ki` has `advanced-fold-ki`; the reset button `reset-<section>` exists only after a change.
