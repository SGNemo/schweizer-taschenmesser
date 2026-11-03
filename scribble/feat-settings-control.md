# feat/settings-control – notes for the next chat

- A new place that lists or fires notifications from modules should call `collectDue(range, manifests, 'center' | 'alert')` with its channel (`core/notifications/channels.ts`); without a channel nothing is filtered.
- Lesehilfe (`reading`) and Fokus (`focus`) are now in the category `barrierefreiheit`; `settingsPath('darstellung', 'reading', …)` still works because `CategoryPage` follows a moved section.
- Category texts of `barrierefreiheit` come from `strings.settings4.ts` (`categories.ts` `catText`), not from `strings.ts`.
- The cache action in Storage may only ever touch `LAZY_CACHE`; never the precache and never module data.
- Fixed shortcuts: `core/keyboard/fixed.ts` (the handlers are in `layout/AppShell.tsx`, `layout/useShortcuts.ts`); a new fixed shortcut goes into that list too.
