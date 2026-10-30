# feat/settings-appearance-fold – notes for the next chat

for the next chat: Settings → Darstellung is five folded groups (`pages/settings/FoldedGroup.tsx`); numbers in `docs/product/focus/12-results-2.md` ("Darstellung").

- A spec that clicks an appearance control must open its group first: `openAppearanceGroup(page, 'theme' | 'colors' | 'text' | 'motion' | 'other')` in `e2e/helpers.ts`. The groups close again after every reload.
- Group ids and members: theme = theme; colors = accent, palette, colour mode; text = size, spacing, density; motion; other = sidebar, overview. A new appearance field goes into one of them (keep the `appearance--<field>` anchor).
- Unit tests render `AppearanceSection` with the real `useUiStore`; no mocks needed.
- The page is still 4424 px on the phone: the rest is Lesen, Fokus & Aufmerksamkeit, Wetter and the other sections of the category. Same pattern (`FoldedGroup` or `<details>`) would cut them; not done here (other chats' files).
- The audit's 6945 px goal "about half" is only reached together with those sections: this package took the "Darstellung" card from about 1660 to 255 px.
