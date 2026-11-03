# feat/settings-manage – notes for the next chat

- Allow-list for profiles, history and export: `core/settings/values.ts`. A new key there needs its schema and the list in `profiles.test.ts`; never anything security related.
- `setSettings(scope, patch, defaults?)`: pass `defaults` when you have them, otherwise the first change of a setting cannot be taken back from the history. `useSettings` and `patchFocusSettings` already do.
- A group write (several keys, one entry) uses `withoutHistory` + `recordGroup`; see `applyProfile` and `applyImport`.
- Profile "active" is derived (`activeProfile`: last switched on wins, else most values); schedules and markers are in localStorage.
- e2e: toast undo is `page.getByRole('status').getByRole('button', { name: 'Rückgängig' })` because the history list also has "Rückgängig" buttons.
