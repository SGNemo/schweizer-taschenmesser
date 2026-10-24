# feat/focus2-module-fold

for the next chat:
- Settings → Module: each module with fields is one `FoldedGroup` (`section="module-<id>"`, `id="fields"`); a spec that clicks a module field calls `openFoldedGroup(page, 'module-<id>', 'fields')` first. Deep links and search open the group by themselves (`SettingsLayout`).
- Page is 3835 px on the phone (was 5582). What is left: the start-data row (~110 px per section, 13 sections). Folding or compacting it is the next step; the brief kept it as it was.
- `FoldedGroup` shows only the title when `current` is empty (module with all switches off).
