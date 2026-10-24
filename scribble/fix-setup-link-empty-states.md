# fix/setup-link-empty-states – for the next chat:
- Link lives in `core/importer/StartDataButton.tsx`; `setupLink={false}` where the button sits inside the assistant, module library or module settings.
- `setupStepIdForModule` (core/setup/registry.ts): module-owned step (`<id>.`), else `core.startdata`. A new module step with the module's id prefix is picked up automatically.
